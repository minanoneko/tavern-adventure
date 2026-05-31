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
      <div className="flex-1 overflow-auto px-3 lg:px-6 py-3 lg:py-5 space-y-3 lg:space-y-4 pb-4">
        {/* Past events breadcrumb */}
        {eventHistory.length > 1 && (
          <div className="text-sm text-muted border-b border-[var(--color-tavern-border)] pb-3 mb-3">
            之前的冒险：{eventHistory.slice(-5, -1).map(e => e.scene.title).join(' → ')}
          </div>
        )}

        {/* Current Event */}
        {currentEvent && (
          <div className="story-page">
            <div className="story-heading flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 mb-3">
              <h2 className="text-lg lg:text-xl leading-snug" style={{ color: 'var(--color-tavern-accent)' }}>{currentEvent.scene.title}</h2>
              <span className="text-xs lg:text-sm text-muted">
                {currentEvent.scene.location} · {currentEvent.scene.time} · {currentEvent.scene.weather}
              </span>
            </div>
            <div className="story-text text-[15px] lg:text-base leading-relaxed whitespace-pre-wrap" style={{ lineHeight: '1.75' }}>
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

        {/* System notification (rest errors, money warnings etc) */}
        {errorMessage && !lastAIResult && (
          <div className="p-3 border border-[var(--color-tavern-accent)] rounded bg-black/30 text-sm text-center cursor-pointer" onClick={() => useGameStore.getState().clearError()}>
            {errorMessage}
            <div className="text-xs text-muted mt-1">点击关闭</div>
          </div>
        )}
        {/* AI error card */}
        {(lastAIResult && !lastAIResult.success) && (
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
        <div className="mobile-action-dock border-t border-[var(--color-tavern-border)] px-2 lg:px-6 py-2 lg:py-3 space-y-1.5 lg:space-y-2 flex-shrink-0">
          {/* AI-generated story options (max 2) */}
          <ActionOptions options={currentEvent.actionOptions.slice(0, 3)} />
          {/* Player fixed actions */}
          <FixedActions />
          {/* Custom input */}
          <CustomInput />
        </div>
      )}
    </div>
  );
}
