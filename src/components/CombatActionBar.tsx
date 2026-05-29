import type { CombatAction } from '../types/combat';

interface Props {
  actions: CombatAction[];
  disabled: boolean;
  selectedTarget: string | null;
  onAction: (action: CombatAction) => void;
  onTargetSelect: (enemyId: string) => void;
  enemyIds: string[];
}

export default function CombatActionBar({ actions, disabled, onAction }: Props) {
  return (
    <div className="mt-3">
      <div className="text-sm text-muted mb-2">战斗行动</div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, i) => {
          const isDisabled = disabled;
          return (
            <button
              key={`${action.type}_${action.skillId || action.itemId || i}`}
              className={`btn text-sm py-2 px-3 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                borderColor: action.type === 'attack' ? '#c97a30'
                  : action.type === 'skill' ? '#6b8cce'
                  : action.type === 'item' ? '#5a9e6f'
                  : action.type === 'defend' ? '#8a8a8a'
                  : action.type === 'flee' ? '#c94040'
                  : 'var(--color-tavern-muted)',
              }}
              onClick={() => !isDisabled && onAction(action)}
              disabled={isDisabled}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
