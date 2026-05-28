import type { JudgeResult } from '../types';

export default function JudgeCard({ judgeResult }: { judgeResult: JudgeResult }) {
  const outcomeColors: Record<string, string> = {
    '大成功': 'var(--color-tavern-success)',
    '成功': 'var(--color-tavern-success)',
    '部分成功': 'var(--color-tavern-accent)',
    '失败': 'var(--color-tavern-danger)',
    '大失败': 'var(--color-tavern-danger)',
  };

  return (
    <div className="panel p-4 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted">系统判定</span>
        <span className="text-base font-bold" style={{ color: outcomeColors[judgeResult.outcome] || 'var(--color-tavern-text)' }}>
          {judgeResult.outcome}
        </span>
      </div>
      <div className="text-muted text-sm">
        掷骰 {judgeResult.roll} vs DC {judgeResult.dc}
        {judgeResult.relatedAttribute && ` · ${judgeResult.relatedAttribute}`}
        {judgeResult.relatedSkill && ` · ${judgeResult.relatedSkill}`}
        {judgeResult.consumption && (judgeResult.consumption.mp > 0 || judgeResult.consumption.hp > 0) &&
          ` · 消耗：${judgeResult.consumption.mp > 0 ? `MP ${judgeResult.consumption.mp}` : ''}${judgeResult.consumption.hp > 0 ? `HP ${judgeResult.consumption.hp}` : ''}`}
      </div>
      <div className="mt-1">{judgeResult.notes}</div>
    </div>
  );
}
