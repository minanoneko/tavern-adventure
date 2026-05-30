import { useGameStore } from '../store/gameStore';

const TYPE_LABELS: Record<string, string> = {
  main: '主线', side: '支线', rumor: '传闻', npc: 'NPC',
  mystery: '谜团', danger: '危险',
};

const TYPE_COLORS: Record<string, string> = {
  main: '#e8c040', side: '#8ab4d8', rumor: '#a0a0d0', npc: '#6a9e6a',
  mystery: '#c080d8', danger: '#d86040',
};

export default function StoryHookPanel() {
  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);
  if (!player) return null;

  const hooks = worldState.storyHooks || [];
  const openHooks = hooks.filter(h => h.status === 'open');
  const resolvedHooks = hooks.filter(h => h.status === 'resolved').slice(-5);
  const abandonedHooks = hooks.filter(h => h.status === 'abandoned').slice(-3);

  if (hooks.length === 0) {
    return (
      <div className="p-4 text-sm text-muted">
        暂无剧情线索。探索世界、与NPC交谈、调查传闻会自然地产生线索。
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Current goal */}
      {worldState.currentGoal && (
        <div className="panel p-3 text-sm border-l-4" style={{ borderLeftColor: '#e8c040' }}>
          <div className="text-xs text-muted mb-1">当前目标</div>
          <div className="font-bold" style={{ color: '#e8c040' }}>{worldState.currentGoal}</div>
        </div>
      )}

      {/* Open hooks */}
      {openHooks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted px-1">未解决线索 ({openHooks.length})</div>
          {openHooks.map(h => (
            <div key={h.id} className="panel p-2.5 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm" style={{ color: TYPE_COLORS[h.type] || 'var(--color-tavern-accent)' }}>{h.title}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: TYPE_COLORS[h.type] + '30', color: TYPE_COLORS[h.type] }}>
                  {TYPE_LABELS[h.type] || h.type}
                </span>
              </div>
              <div className="text-muted text-xs">{h.summary.slice(0, 100)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recently resolved */}
      {resolvedHooks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted px-1">最近解决</div>
          {resolvedHooks.map(h => (
            <div key={h.id} className="text-xs text-muted px-2 opacity-60">
              ✓ {h.title}
            </div>
          ))}
        </div>
      )}

      {/* Abandoned */}
      {abandonedHooks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted px-1">已放弃</div>
          {abandonedHooks.map(h => (
            <div key={h.id} className="text-xs text-muted px-2 opacity-40 line-through">
              {h.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
