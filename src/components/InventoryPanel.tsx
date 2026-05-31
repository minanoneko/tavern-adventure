import { useGameStore } from '../store/gameStore';
import { formatMoney } from '../types/common';
import { useState } from 'react';
import { getInventoryRarityColor, normalizeRarity } from '../utils/rarityColors';

const TYPE_FILTERS = ['全部', '武器', '防具', '饰品', '消耗品', '材料', '任务物品', '技能书'];

const TYPE_LABELS: Record<string, string> = {
  weapon: '武器', armor: '防具', accessory: '饰品',
  consumable: '消耗品', material: '材料', quest_item: '任务物品',
  skill_book: '技能书', book: '书籍', valuable: '贵重物', cursed: '诅咒物',
};

const RARITY_LABELS: Record<string, string> = {
  common: '普通', uncommon: '优良', rare: '稀有',
  epic: '史诗', legendary: '传说', cursed: '诅咒', relic: '遗物',
};

function normalizeType(type: string): string {
  const value = String(type || '').toLowerCase();
  if (value === 'quest' || value === 'questitem' || value === 'story' || value === 'story_item') return 'quest_item';
  if (value === 'skillbook') return 'skill_book';
  return value;
}

export default function InventoryPanel() {
  const player = useGameStore(s => s.player);
  if (!player) return null;

  const [filter, setFilter] = useState('全部');
  const items = player.inventory;

  const filtered = filter === '全部' ? items : items.filter(i => {
    const typeMap: Record<string, string> = {
      '武器': 'weapon', '防具': 'armor', '饰品': 'accessory',
      '消耗品': 'consumable', '材料': 'material', '任务物品': 'quest_item', '技能书': 'skill_book',
    };
    return i.type === typeMap[filter];
  });

  return (
    <div className="p-3">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 mb-3">
        {TYPE_FILTERS.map(f => (
          <button
            key={f}
            className={`text-sm px-3 py-1.5 rounded ${filter === f ? 'btn-primary' : 'btn'}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted p-3">背包空空如也。</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const rarity = normalizeRarity(item.rarity);
            const rarityColor = getInventoryRarityColor(item.rarity, item.type);
            return (
            <div key={item.id} className="panel p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: rarityColor }}>
                  {item.name}
                  {item.quantity > 1 && <span className="text-muted ml-1">x{item.quantity}</span>}
                </span>
                <span className="tag text-xs" style={{ color: rarityColor, borderColor: rarityColor }}>
                  {RARITY_LABELS[rarity] || rarity}
                </span>
              </div>
              <div className="text-xs text-muted">{TYPE_LABELS[normalizeType(item.type)] || '剧情物品'}</div>
              {item.description && <div className="text-muted mt-1 text-xs">{item.description.slice(0, 60)}</div>}
              {item.effects && item.effects.length > 0 && (
                <div className="text-info mt-1 text-xs">{item.effects.join('，')}</div>
              )}
            </div>
          )})}
        </div>
      )}

      {/* Money display */}
      <div className="mt-4 panel p-3">
        <div className="text-sm text-muted">持有金钱</div>
        <div className="text-base font-bold" style={{ color: 'var(--color-tavern-accent)' }}>{formatMoney(player.money)}</div>
      </div>
    </div>
  );
}
