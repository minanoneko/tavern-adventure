import { useGameStore } from '../store/gameStore';
import type { ActionOption } from '../types';

export default function ActionOptions({ options }: { options: ActionOption[] }) {
  const submitAction = useGameStore(s => s.submitAction);
  const player = useGameStore(s => s.player);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'var(--color-tavern-success)';
      case 'medium': return 'var(--color-tavern-accent)';
      case 'high': return '#c97a30';
      case 'extreme': return 'var(--color-tavern-danger)';
      default: return 'var(--color-tavern-muted)';
    }
  };

  const canAffordMp = (cost?: number) => {
    if (!cost || !player) return true;
    return player.resources.mp >= cost;
  };

  return (
    <div>
      <div className="text-sm text-muted mb-2">行动选项</div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.id}
            className="btn text-sm text-left py-3 px-4 flex-1 min-w-[140px]"
            style={{ borderColor: getRiskColor(opt.risk) }}
            onClick={() => submitAction(opt.id)}
            disabled={!canAffordMp(opt.mpCost)}
          >
            <div>{opt.label}</div>
            <div className="flex gap-1 mt-1">
              {opt.relatedAttribute && opt.relatedAttribute !== 'none' && (
                <span className="tag tag-common text-xs">{opt.relatedAttribute.toUpperCase()}</span>
              )}
              {(opt.mpCost ?? 0) > 0 && (
                <span className={`tag text-xs ${canAffordMp(opt.mpCost) ? 'tag-common' : 'tag-cursed'}`}>MP:{opt.mpCost}</span>
              )}
              {opt.difficultyPreview && (
                <span className="tag tag-common text-xs">{opt.difficultyPreview}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
