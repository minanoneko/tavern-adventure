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

const STOCK_MAX = 3;
const STOCK_RESET_MS = 5 * 60 * 1000; // 5 minutes real time

const shopStock: Record<string, { remaining: number; resetAt: number }> = {};

function getStock(itemId: string): { remaining: number; resetAt: number } {
  const now = Date.now();
  let stock = shopStock[itemId];
  if (!stock || (stock.remaining <= 0 && now >= stock.resetAt)) {
    // Reset stock
    stock = { remaining: STOCK_MAX, resetAt: 0 };
    shopStock[itemId] = stock;
  }
  return stock;
}

function consumeStock(itemId: string): number {
  const stock = getStock(itemId);
  stock.remaining--;
  if (stock.remaining <= 0) {
    stock.resetAt = Date.now() + STOCK_RESET_MS;
  }
  shopStock[itemId] = stock;
  return stock.remaining;
}

function formatStockTime(resetAt: number): string {
  if (!resetAt) return '';
  const sec = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
  if (sec >= 60) return `${Math.ceil(sec / 60)}分钟后`;
  return `${sec}秒后`;
}

const CONSUMABLES: ShopItem[] = [
  { id: 'healing_potion', name: '治疗药水', price: { gold: 0, silver: 0, copper: 50 }, type: '消耗品', description: '恢复5点HP' },
  { id: 'fire_bomb', name: '燃烧瓶', price: { gold: 0, silver: 1, copper: 0 }, type: '消耗品', description: '额外火焰伤害+6' },
  { id: 'smoke_bomb', name: '烟雾弹', price: { gold: 0, silver: 0, copper: 80 }, type: '消耗品', description: '逃跑判定+4' },
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
  const [, setTick] = useState(0); // force re-render for stock timer

  if (!player) return null;

  const handleBuy = (item: ShopItem) => {
    const stock = getStock(item.id);
    if (stock.remaining <= 0) {
      setMessage(`${item.name}已售罄，${formatStockTime(stock.resetAt)}补货`);
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    const result = buyItem(player, item.id, 1);
    if (result.success) {
      consumeStock(item.id);
      useGameStore.setState({ player: result.player });
      const rem = getStock(item.id).remaining;
      setMessage(`已购买：${item.name}${rem > 0 ? `（剩余${rem}）` : ''}`);
      setTimeout(() => setMessage(null), 2000);
      setTick(t => t + 1);
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

  const renderStockInfo = (itemId: string) => {
    const stock = getStock(itemId);
    if (stock.remaining <= 0) {
      return <span className="text-danger ml-1">售罄 {formatStockTime(stock.resetAt)}</span>;
    }
    return <span className="text-muted ml-1">库存{stock.remaining}</span>;
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
      <div className="text-xs text-muted mb-1">消耗品 · 每种限购{STOCK_MAX}个 · 5分钟补货</div>
      <div className="space-y-1 mb-3">
        {CONSUMABLES.map(item => {
          const price = getItemPrice(item.id);
          if (!price) return null;
          const stock = getStock(item.id);
          const afford = (player.money.gold * 10000 + player.money.silver * 100 + player.money.copper) >= (price.gold * 10000 + price.silver * 100 + price.copper);
          const canBuy = afford && stock.remaining > 0;
          return (
            <div key={item.id} className="flex items-center justify-between p-2 bg-black/20 rounded text-xs">
              <div>
                <span>{item.name}</span>
                <span className="text-muted ml-2">{priceText(price)}</span>
                <span className="text-muted ml-1">- {item.description}</span>
                {renderStockInfo(item.id)}
              </div>
              <button className={`btn text-xs px-2 py-0.5 ${!canBuy ? 'opacity-50' : ''}`}
                onClick={() => canBuy && handleBuy(item)}
                disabled={!canBuy}>
                {!afford ? '钱不够' : stock.remaining <= 0 ? '售罄' : '购买'}
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
          const stock = getStock(item.id);
          const afford = (player.money.gold * 10000 + player.money.silver * 100 + player.money.copper) >= (price.gold * 10000 + price.silver * 100 + price.copper);
          const owned = player.inventory.some(i => i.id === item.id) || Object.values(player.equipment).includes(item.id as any);
          const canBuy = afford && stock.remaining > 0 && !owned;
          return (
            <div key={item.id} className="flex items-center justify-between p-2 bg-black/20 rounded text-xs">
              <div>
                <span className="text-xs px-1 rounded bg-black/30 mr-1">{item.type}</span>
                <span>{item.name}</span>
                <span className="text-muted ml-2">{priceText(price)}</span>
                {renderStockInfo(item.id)}
              </div>
              <button className={`btn text-xs px-2 py-0.5 ${!canBuy ? 'opacity-50' : ''}`}
                onClick={() => canBuy && handleBuy(item)}
                disabled={!canBuy}>
                {owned ? '已拥有' : !afford ? '钱不够' : stock.remaining <= 0 ? '售罄' : '购买'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
