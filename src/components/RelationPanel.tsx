import { useGameStore } from '../store/gameStore';

const FACTION_NAMES: Record<string, string> = {
  adventurers_guild: '冒险者公会', church: '教会', city_guard: '城卫队',
  black_market: '黑市', merchant_guild: '商会', forest_wanderers: '森林游民',
  mage_association: '魔法协会', nobility: '贵族派系',
  old_kingdom_remnants: '旧王国遗民', elf_forest: '精灵森林',
  dark_elves: '地底暗精灵', dragon_blood_clan: '龙裔部族',
};

export default function RelationPanel() {
  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);
  if (!player) return null;

  const npcs = player.relationships.filter(r => r.type === 'npc');
  const factions = Object.entries(worldState.factionStandings);

  const getLevelLabel = (standing: number): string => {
    if (standing >= 50) return '崇敬';
    if (standing >= 30) return '信任';
    if (standing >= 15) return '友善';
    if (standing >= 5) return '熟悉';
    if (standing >= -5) return '中立';
    if (standing >= -15) return '冷淡';
    return '敌对';
  };

  const getLevelColor = (standing: number): string => {
    if (standing >= 30) return 'var(--color-tavern-success)';
    if (standing >= 5) return 'var(--color-tavern-info)';
    if (standing >= -5) return 'var(--color-tavern-muted)';
    return 'var(--color-tavern-danger)';
  };

  return (
    <div className="p-3 space-y-4">
      {/* NPCs */}
      <div>
        <div className="panel-header">NPC</div>
        {npcs.length === 0 ? (
          <div className="text-sm text-muted p-3">还没有结识任何 NPC。</div>
        ) : (
          <div className="space-y-2 p-2">
            {npcs.map(npc => (
              <div key={npc.targetId} className="panel p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{npc.name}</span>
                  <span className="text-xs" style={{ color: getLevelColor(npc.standing) }}>
                    {getLevelLabel(npc.standing)} ({npc.standing > 0 ? '+' : ''}{npc.standing})
                  </span>
                </div>
                {(npc.race || npc.occupation) && (
                  <div className="text-xs text-muted mb-1">
                    {npc.race && <span>{npc.race}</span>}
                    {npc.race && npc.occupation && <span> · </span>}
                    {npc.occupation && <span>{npc.occupation}</span>}
                  </div>
                )}
                {npc.description && <div className="text-xs text-muted">{npc.description}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Factions */}
      <div>
        <div className="panel-header">阵营</div>
        <div className="space-y-1 p-2">
          {factions.map(([id, standing]) => (
            <div key={id} className="flex items-center justify-between text-sm py-0.5">
              <span>{FACTION_NAMES[id] || id}</span>
              <span className="text-xs" style={{ color: getLevelColor(standing) }}>
                {getLevelLabel(standing)} ({standing})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
