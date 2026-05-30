import { useGameStore } from '../store/gameStore';

export default function RelationPanel() {
  const player = useGameStore(s => s.player);
  const logs = useGameStore(s => s.logs);
  if (!player) return null;

  const npcs = player.relationships
    .filter(r => r.type === 'npc' && r.name && !r.name.startsWith('npc_'))
    .map(npc => ({
      ...npc,
      lastMention: [...logs].reverse().find(log => log.text.includes(npc.name)),
    }));

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
      <div>
        <div className="panel-header">人物回忆</div>
        {npcs.length === 0 ? (
          <div className="text-sm text-muted p-3">还没有值得记住的人。和有名有姓的角色交流后，这里会变成你的回忆簿。</div>
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
                {npc.description && <div className="text-xs text-muted leading-relaxed">{npc.description}</div>}
                {npc.lastMention && (
                  <div className="mt-2 text-xs leading-relaxed border-t border-[var(--color-tavern-border)] pt-2">
                    <span className="text-muted">最近想起：</span>
                    {npc.lastMention.text.slice(0, 90)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
