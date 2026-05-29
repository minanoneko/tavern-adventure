import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { buyItem, getItemPrice } from '../services/economyService';
import { EQUIPMENT_LIBRARY } from '../data/equipment';
import { formatMoney } from '../types/common';

interface ShopItem {
  id: string;
  name: string;
  price: { gold: number; silver: number; copper: number };
  type: string;
  description: string;
  slot?: string;
}

const CONSUMABLES: ShopItem[] = [
  { id: 'healing_potion', name: '治疗药水', price: { gold: 0, silver: 0, copper: 50 }, type: '消耗品', description: '恢复5点HP' },
  { id: 'fire_bomb', name: '燃烧瓶', price: { gold: 0, silver: 1, copper: 0 }, type: '消耗品', description: '战斗中使用，额外火焰伤害+6' },
  { id: 'smoke_bomb', name: '烟雾弹', price: { gold: 0, silver: 0, copper: 80 }, type: '消耗品', description: '战斗中遮蔽视野，逃跑判定+4' },
];

const EQUIPMENT_SHOP: ShopItem[] = Object.entries(EQUIPMENT_LIBRARY)
  .filter(([, e]) => e.price && (e.slot === 'mainWeapon' || e.slot === 'armor' || e.slot === 'head' || e.slot === 'hands' || e.slot === 'feet'))
  .map(([id, e]) => ({
    id,
    name: e.name,
    price: { gold: e.price?.gold || 0, silver: e.price?.silver || 0, copper: e.price?.copper || 0 },
    type: e.slot === 'mainWeapon' ? '武器' : e.slot === 'armor' ? '护甲' : '装备',
    description: e.description,
    slot: e.slot,
  }));

export default function ShopPanel({ onClose }: { onClose: () => void }) {
  const player = useGameStore(s => s.player);
  const [message, setMessage] = useState<string | null>(null);

  if (!player) return null;

  const handleBuy = (item: ShopItem) => {
    const result = buyItem(player, item.id, 1);
    if (result.success) {
      useGameStore.setState({ player: result.player });
      setMessage(`已购买：${item.name}`);
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage(result.reason || '购买失败');
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const priceText = (p: { gold: number; silver: number; copper: number }) => {
    const parts = [];
    if (p.gold > 0) parts.push(`${p.gold}金`);
    if (p.silver > 0) parts.push(`${p.silver}银`);
    if (p.copper > 0) parts.push(`${p.copper}铜`);
    return parts.join('') || '免费';
  };

  return (
    <div className="panel p-3 mt-2 max-h-64 overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">商店</span>
        <span className="text-xs">余额：{formatMoney(player.money)}</span>
        <button className="btn text-xs" onClick={onClose}>关闭</button>
      </div>
      {message && <div className="text-xs text-info mb-2">{message}</div>}

      {/* Consumables */}
      <div className="text-xs text-muted mb-1">消耗品</div>
      <div className="space-y-1 mb-3">
        {CONSUMABLES.map(item => {
          const price = getItemPrice(item.id);
          if (!price) return null;
          const afford = (player.money.gold * 10000 + player.money.silver * 100 + player.money.copper) >= (price.gold * 10000 + price.silver * 100 + price.copper);
          return (
            <div key={item.id} className="flex items-center justify-between p-2 bg-black/20 rounded text-xs">
              <div>
                <span>{item.name}</span>
                <span className="text-muted ml-2">{priceText(price)}</span>
                <span className="text-muted ml-1">- {item.description}</span>
              </div>
              <button className={`btn text-xs px-2 py-0.5 ${!afford ? 'opacity-50' : ''}`}
                onClick={() => afford && handleBuy(item)}
                disabled={!afford}>
                {afford ? '购买' : '钱不够'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Equipment */}
      <div className="text-xs text-muted mb-1">装备</div>
      <div className="space-y-1">
        {EQUIPMENT_SHOP.slice(0, 8).map(item => {
          const price = getItemPrice(item.id);
          if (!price) return null;
          const afford = (player.money.gold * 10000 + player.money.silver * 100 + player.money.copper) >= (price.gold * 10000 + price.silver * 100 + price.copper);
          const owned = player.inventory.some(i => i.id === item.id) || Object.values(player.equipment).includes(item.id as any);
          return (
            <div key={item.id} className="flex items-center justify-between p-2 bg-black/20 rounded text-xs">
              <div>
                <span className="text-xs px-1 rounded bg-black/30 mr-1">{item.type}</span>
                <span>{item.name}</span>
                <span className="text-muted ml-2">{priceText(price)}</span>
              </div>
              <button className={`btn text-xs px-2 py-0.5 ${!afford || owned ? 'opacity-50' : ''}`}
                onClick={() => afford && !owned && handleBuy(item)}
                disabled={!afford || owned}>
                {owned ? '已拥有' : afford ? '购买' : '钱不够'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
