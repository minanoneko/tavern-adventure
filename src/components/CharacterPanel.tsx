import { useGameStore } from '../store/gameStore';
import { ATTRIBUTE_LABELS, type AttributeKey } from '../types/common';
import { getEquipmentById } from '../data/equipment';
import { getActiveTraits, getEquipmentPenalty } from '../utils/equipmentRules';

const SAFE_LOCATIONS = ['gray_deer_tavern', 'whitestone_inn', 'adventurers_guild_branch'];

export default function CharacterPanel() {
  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);
  const allocateAttribute = useGameStore(s => s.allocateAttribute);
  if (!player) return null;

  const isSafeLocation = SAFE_LOCATIONS.includes(worldState.currentLocation);
  const canAllocate = player.attributePoints > 0 && isSafeLocation;

  return (
    <div className="h-full overflow-auto py-3 pl-4 pr-3 space-y-4">
      {/* Identity */}
      <div className="text-center py-2">
        <div className="text-base" style={{ color: 'var(--color-tavern-accent)' }}>{player.name}</div>
        <div className="text-sm text-muted mt-1">{player.race} · {player.gender} · {player.age}岁</div>
        <div className="text-sm text-muted">{player.classOrigin}</div>
        {player.customOrigin && (
          <div className="text-xs text-muted mt-1 italic">"{player.customOrigin.slice(0, 40)}..."</div>
        )}
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          {player.personalityTraits.map(t => (
            <span key={t} className="tag tag-common text-xs">{t}</span>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--color-tavern-border)]" />

      {/* Attributes */}
      <div>
        <div className="panel-header text-xs">属性 {canAllocate && <span className="text-success">— 点击 + 号加点</span>}</div>
        <div className="p-3 space-y-3">
          {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => {
            const val = player.attributes[key as AttributeKey];
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="text-muted w-10 flex-shrink-0">{label}</span>
                <div className="flex-1 h-3 bar-bg">
                  <div className="h-full rounded-sm" style={{
                    background: `linear-gradient(to right, var(--color-tavern-accent), #8a6a30)`,
                    width: `${val * 10}%`,
                  }} />
                </div>
                <span className="w-6 text-center flex-shrink-0 text-base font-bold" style={{ color: 'var(--color-tavern-accent)' }}>{val}</span>
                {canAllocate ? (
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold flex-shrink-0"
                    style={{ background: 'rgba(90,143,74,0.2)', color: 'var(--color-tavern-success)', border: '1px solid var(--color-tavern-success)' }}
                    onClick={() => allocateAttribute(key)}
                  >
                    +
                  </button>
                ) : (
                  <div className="w-8 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        {canAllocate && (
          <div className="px-3 pb-2 text-xs text-success">点击右侧 + 号分配点数（剩余 {player.attributePoints}）</div>
        )}
        {player.attributePoints > 0 && !isSafeLocation && (
          <div className="px-3 pb-2 text-xs text-muted">有 {player.attributePoints} 点未分配 — 在酒馆或旅店休息时才能分配</div>
        )}
        {player.skillPoints > 0 && (
          <div className="px-3 pb-2 text-xs text-info">未分配技能点：{player.skillPoints}</div>
        )}
      </div>

      <div className="border-t border-[var(--color-tavern-border)]" />

      {/* Equipment */}
      <div>
        <div className="panel-header text-xs">装备</div>
        <div className="p-2 space-y-2">
          {(Object.entries(player.equipment) as [string, string | null][]).map(([slot, itemId]) => {
            const item = itemId ? getEquipmentById(itemId) : null;
            const penalty = item ? getEquipmentPenalty(item, player) : null;
            const traits = item ? getActiveTraits(item.id, player) : [];
            const slotLabel: Record<string, string> = {
              mainWeapon: '主武器', offHand: '副手', armor: '防具',
              head: '头部', hands: '手部', feet: '脚部',
              accessory1: '饰品1', accessory2: '饰品2', special: '特殊',
            };
            return (
              <div key={slot} className="text-sm">
                <span className="text-muted text-xs">{slotLabel[slot] || slot}: </span>
                {item ? (
                  <span>
                    <span>{item.name}</span>
                    {penalty && penalty.warnings.length > 0 && (
                      <span className="text-danger ml-1 text-xs" title={penalty.warnings.join('；')}>⚠</span>
                    )}
                    {traits.length > 0 && (
                      <span className="ml-1 text-xs" style={{ color: 'var(--color-tavern-accent)' }}>
                        [{traits.map(t => t.name).join(',')}]
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted">无</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status */}
      <div>
        <div className="panel-header text-xs">状态</div>
        <div className="p-2 flex flex-wrap gap-1">
          {player.statusEffects.map(s => (
            <span key={s} className={`tag text-xs ${s === '正常' ? 'tag-common' : 'tag-cursed'}`}>{s}</span>
          ))}
        </div>
      </div>

    </div>
  );
}
