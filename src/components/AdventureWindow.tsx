import { useGameStore } from '../store/gameStore';
import JudgeCard from './JudgeCard';
import ErrorCard from './ErrorCard';
import ActionOptions from './ActionOptions';
import CustomInput from './CustomInput';
import FixedActions from './FixedActions';

export default function AdventureWindow() {
  const currentEvent = useGameStore(s => s.currentEvent);
  const lastJudgeResult = useGameStore(s => s.lastJudgeResult);
  const errorMessage = useGameStore(s => s.errorMessage);
  const lastAIResult = useGameStore(s => s.lastAIResult);
  const isProcessing = useGameStore(s => s.isProcessing);
  const eventHistory = useGameStore(s => s.eventHistory);
  const combatActive = useGameStore(s => s.worldState.combatState.active);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Scrollable event area */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {/* Past events breadcrumb */}
        {eventHistory.length > 1 && (
          <div className="text-sm text-muted border-b border-[var(--color-tavern-border)] pb-3 mb-3">
            之前的冒险：{eventHistory.slice(-5, -1).map(e => e.scene.title).join(' → ')}
          </div>
        )}

        {/* Current Event */}
        {currentEvent && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xl" style={{ color: 'var(--color-tavern-accent)' }}>{currentEvent.scene.title}</h2>
              <span className="text-sm text-muted">
                {currentEvent.scene.location} · {currentEvent.scene.time} · {currentEvent.scene.weather}
              </span>
            </div>
            <div className="text-base leading-relaxed whitespace-pre-wrap" style={{ lineHeight: '1.8' }}>
              {currentEvent.scene.text}
            </div>

            {/* System events */}
            {currentEvent.systemEvents.length > 0 && (
              <div className="mt-4 space-y-2">
                {currentEvent.systemEvents.map((se, i) => (
                  <div key={i} className={`text-sm p-3 rounded ${
                    se.type === 'check' ? 'border border-[var(--color-tavern-info)]' :
                    se.type === 'reward' ? 'border border-[var(--color-tavern-success)]' :
                    se.type === 'penalty' || se.type === 'warning' ? 'border border-[var(--color-tavern-danger)]' :
                    'border border-[var(--color-tavern-border)]'
                  }`}>
                    {se.type === 'check' && <span className="text-info">[判定] </span>}
                    {se.type === 'reward' && <span className="text-success">[奖励] </span>}
                    {se.type === 'penalty' && <span className="text-danger">[惩罚] </span>}
                    {se.type === 'warning' && <span className="text-danger">[警告] </span>}
                    {se.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Judge result card */}
        {lastJudgeResult && (
          <JudgeCard judgeResult={lastJudgeResult} />
        )}

        {/* Error card */}
        {(errorMessage || (lastAIResult && !lastAIResult.success)) && (
          <ErrorCard
            error={lastAIResult?.error}
            validationErrors={lastAIResult?.validationErrors}
          />
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="text-center text-base text-muted py-6">
            正在编织命运之线...
          </div>
        )}
      </div>

      {/* Action area (fixed at bottom) — hidden during combat */}
      {currentEvent && !isProcessing && !combatActive && (
        <div className="border-t border-[var(--color-tavern-border)] px-6 py-3 space-y-2 flex-shrink-0">
          {/* AI-generated story options (max 2) */}
          <ActionOptions options={currentEvent.actionOptions.slice(0, 2)} />
          {/* Player fixed actions */}
          <FixedActions />
          {/* Custom input */}
          <CustomInput />
        </div>
      )}
    </div>
  );
}
