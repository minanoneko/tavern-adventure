import { useGameStore } from '../store/gameStore';
import { QUEST_STATUS_LABELS } from '../types/quest';

export default function QuestPanel() {
  const player = useGameStore(s => s.player);
  if (!player) return null;

  const quests = player.quests;

  if (quests.length === 0) {
    return <div className="p-4 text-sm text-muted">暂无任务。走进酒馆，看看有什么委托可接。</div>;
  }

  return (
    <div className="p-3 space-y-2">
      {quests.map(q => (
        <div key={q.id} className="panel p-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-bold" style={{ color: 'var(--color-tavern-accent)' }}>{q.name}</span>
            <span className={`tag text-xs ${q.status === 'active' ? 'tag-rare' : q.status === 'completed' ? 'tag-common' : q.status === 'available' ? '' : 'tag-cursed'}`}>
              {QUEST_STATUS_LABELS[q.status]}
            </span>
          </div>
          <div className="text-muted text-xs">{q.description?.slice(0, 80)}</div>
          {q.giver && <div className="text-muted mt-1 text-xs">委托人：{q.giver}</div>}
          {q.objectives && q.objectives.length > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              {q.objectives.map(o => (
                <div key={o.id} className="flex items-center gap-1.5">
                  <span>{o.completed ? '✓' : '○'}</span>
                  <span className={o.completed ? 'text-success' : ''}>{o.description}</span>
                </div>
              ))}
            </div>
          )}
          {q.rewards && (
            <div className="mt-2 text-xs text-muted">
              奖励：
              {q.rewards.exp ? `${q.rewards.exp} EXP` : ''}
              {q.rewards.money ? ` ${q.rewards.money.gold ? q.rewards.money.gold + '金' : ''}${q.rewards.money.silver ? q.rewards.money.silver + '银' : ''}${q.rewards.money.copper ? q.rewards.money.copper + '铜' : ''}` : ''}
              {q.rewards.items?.length ? ` 物品x${q.rewards.items.length}` : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
