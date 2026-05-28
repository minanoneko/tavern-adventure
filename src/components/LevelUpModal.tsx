import { useGameStore } from '../store/gameStore';
import { ATTRIBUTE_LABELS, type AttributeKey } from '../types/common';

export default function LevelUpModal() {
  const player = useGameStore(s => s.player);
  const newLevel = useGameStore(s => s.newLevel);
  const dismissLevelUp = useGameStore(s => s.dismissLevelUp);
  const allocateAttribute = useGameStore(s => s.allocateAttribute);
  if (!player) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="panel p-6 max-w-sm w-full mx-4">
        <h3 className="text-xl mb-4 text-center" style={{ color: 'var(--color-tavern-accent)' }}>
          升级！
        </h3>
        <div className="text-center text-sm mb-4">
          你升到了 <span style={{ color: 'var(--color-tavern-accent)' }}>Lv.{newLevel || player.level}</span>
        </div>
        <div className="text-xs space-y-1 mb-4 text-muted">
          <div>获得：属性点 +2</div>
          <div>获得：技能点 +1</div>
          <div>最大 HP 和 MP 已提升</div>
        </div>

        {/* Quick attribute allocation */}
        {player.attributePoints > 0 && (
          <div className="mb-4">
            <div className="text-xs text-muted mb-2">分配属性点（剩余：{player.attributePoints}）</div>
            <div className="grid grid-cols-3 gap-1">
              {ATTRIBUTE_LABELS && Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className="btn text-xs py-1"
                  disabled={player.attributePoints <= 0}
                  onClick={() => allocateAttribute(key)}
                >
                  {label} +1
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary w-full" onClick={dismissLevelUp}>
          {player.attributePoints > 0 ? '稍后再分配' : '继续冒险'}
        </button>
      </div>
    </div>
  );
}
