import { useGameStore } from '../store/gameStore';
import { ATTRIBUTE_LABELS, type AttributeKey } from '../types/common';
import { getEquipmentById } from '../data/equipment';
import { getTraitById } from '../data/races';
import { getActiveTraits, getEffectiveAttributes, getEquipmentAttributeBonuses, getEquipmentPenalty } from '../utils/equipmentRules';
import { getEquipmentQualityColor } from '../utils/rarityColors';

const SAFE_LOCATIONS = ['gray_deer_tavern', 'whitestone_inn', 'adventurers_guild_branch'];
const DISPLAY_EQUIPMENT_SLOTS = ['mainWeapon', 'armor', 'head', 'accessory1', 'accessory2'] as const;

function getAgeProfile(age: number): string {
  if (age < 18) return '年轻';
  if (age >= 50) return '年长';
  return '成年';
}

function getEquipmentIcon(slot: string, itemId?: string | null): string {
  const id = itemId || '';
  if (slot === 'mainWeapon') {
    if (id.includes('staff')) return '🪄';
    if (id.includes('bow')) return '🏹';
    if (id.includes('dagger') || id.includes('knife')) return '🗡️';
    if (id.includes('axe')) return '🪓';
    return '⚔️';
  }
  if (slot === 'offHand') {
    if (id.includes('shield')) return '🛡️';
    if (id.includes('note') || id.includes('tome') || id.includes('book')) return '📘';
    if (id.includes('symbol')) return '✚';
    return '👐';
  }
  if (slot === 'armor') return '🥋';
  if (slot === 'head') return '🎩';
  if (slot === 'hands') return '🧤';
  if (slot === 'feet') return '🥾';
  if (slot.includes('accessory')) return '💍';
  return '🎒';
}

function getClassIcon(classOrigin: string): string {
  if (classOrigin.includes('法')) return '🪄';
  if (classOrigin.includes('剑') || classOrigin.includes('战')) return '⚔️';
  if (classOrigin.includes('游') || classOrigin.includes('猎')) return '🏹';
  if (classOrigin.includes('牧')) return '✚';
  if (classOrigin.includes('盗')) return '🗡️';
  if (classOrigin.includes('诗')) return '🎵';
  return '🧭';
}

function getQualityColor(quality?: string): string {
  return getEquipmentQualityColor(quality);
}

export default function CharacterPanel() {
  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);
  const allocateAttribute = useGameStore(s => s.allocateAttribute);
  if (!player) return null;

  const isSafeLocation = SAFE_LOCATIONS.includes(worldState.currentLocation);
  const canAllocate = player.attributePoints > 0 && isSafeLocation;
  const effectiveAttributes = getEffectiveAttributes(player);
  const equipmentAttributeBonuses = getEquipmentAttributeBonuses(player);

  return (
    <div className="h-full overflow-auto py-3 pl-4 pr-3 space-y-4">
      <div className="panel p-3 text-center">
        <div className="mx-auto mb-2 w-14 h-14 rounded-full border border-[var(--color-tavern-accent)] grid place-items-center text-2xl bg-black/30">
          {getClassIcon(player.classOrigin)}
        </div>
        <div className="text-lg" style={{ color: 'var(--color-tavern-accent)' }}>{player.name}</div>
        <div className="text-sm text-muted mt-1">{player.race} · {player.gender} · {player.age}岁 · {getAgeProfile(player.age)}</div>
        <div className="text-sm text-muted">{player.classOrigin}</div>
        {player.customOrigin && (
          <div className="text-xs text-muted mt-2 italic leading-relaxed">"{player.customOrigin.slice(0, 56)}..."</div>
        )}
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          {player.personalityTraits.map(t => (
            <span key={t} className="tag tag-common text-xs">{getTraitById(t)?.name || t}</span>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header text-xs">属性{canAllocate && <span className="text-success"> · 可加点</span>}</div>
        <div className="p-3 grid grid-cols-2 gap-2">
          {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => {
            const attrKey = key as AttributeKey;
            const val = player.attributes[attrKey];
            const effectiveVal = effectiveAttributes[attrKey];
            const bonus = equipmentAttributeBonuses[attrKey] ?? 0;
            return (
              <div key={key} className="bg-black/25 border border-[var(--color-tavern-border)] rounded p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">{label}</span>
                  <span className="text-base font-bold" style={{ color: 'var(--color-tavern-accent)' }}>
                    {effectiveVal}{bonus > 0 && <span className="text-xs text-success ml-1">+{bonus}</span>}
                  </span>
                </div>
                <div className="mt-1 h-2 bar-bg">
                  <div className="h-full rounded-sm" style={{ background: 'linear-gradient(to right, var(--color-tavern-accent), #8a6a30)', width: `${val * 10}%` }} />
                </div>
                {canAllocate && (
                  <button
                    className="mt-2 w-full h-7 flex items-center justify-center rounded text-sm font-bold"
                    style={{ background: 'rgba(90,143,74,0.2)', color: 'var(--color-tavern-success)', border: '1px solid var(--color-tavern-success)' }}
                    onClick={() => allocateAttribute(key)}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {canAllocate && (
          <div className="px-3 pb-2 text-xs text-success">剩余属性点：{player.attributePoints}</div>
        )}
        {player.attributePoints > 0 && !isSafeLocation && (
          <div className="px-3 pb-2 text-xs text-muted">有 {player.attributePoints} 点未分配，需要在酒馆或旅店休息时分配。</div>
        )}
        {player.skillPoints > 0 && (
          <div className="px-3 pb-2 text-xs text-info">未分配技能点：{player.skillPoints}</div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header text-xs">装备</div>
        <div className="p-2 grid grid-cols-1 gap-2">
          {DISPLAY_EQUIPMENT_SLOTS.map(slot => {
            const itemId = player.equipment[slot];
            const item = itemId ? getEquipmentById(itemId) : null;
            const penalty = item ? getEquipmentPenalty(item, player) : null;
            const traits = item ? getActiveTraits(item.id, player) : [];
            const slotLabel: Record<string, string> = {
              mainWeapon: '主武器',
              armor: '护甲',
              head: '头部',
              accessory1: '饰品1',
              accessory2: '饰品2',
            };
            return (
              <div key={slot} className="text-sm flex items-start gap-2 bg-black/20 border border-[var(--color-tavern-border)] rounded p-2">
                <span className="text-lg leading-none mt-0.5">{getEquipmentIcon(slot, itemId)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-muted text-xs">{slotLabel[slot] || slot}</div>
                  {item ? (
                    <div>
                      <span style={{ color: getQualityColor(item.quality) }}>{item.name}</span>
                      {penalty && penalty.warnings.length > 0 && (
                        <span className="text-danger ml-1 text-xs" title={penalty.warnings.join('；')}>⚠</span>
                      )}
                      {traits.length > 0 && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--color-tavern-accent)' }}>
                          [{traits.map(t => t.name).join(',')}]
                        </span>
                      )}
                      {item.effects.length > 0 && (
                        <div className="text-xs text-muted mt-0.5 truncate">{item.effects.join(' / ')}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">无</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel overflow-hidden">
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
