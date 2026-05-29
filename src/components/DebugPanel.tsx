import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { maskApiKey } from '../utils/maskApiKey';
import { getDebugPrompt } from '../services/promptService';
import { useState } from 'react';

export default function DebugPanel() {
  const debugMode = import.meta.env.VITE_DEBUG_PROMPT === 'true';
  const [isOpen, setIsOpen] = useState(false);

  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);
  const logs = useGameStore(s => s.logs);
  const lastJudgeResult = useGameStore(s => s.lastJudgeResult);
  const eventHistory = useGameStore(s => s.eventHistory);
  const addLockedStoryFact = useGameStore(s => s.addLockedStoryFact);
  const removeLockedStoryFact = useGameStore(s => s.removeLockedStoryFact);
  const clearLockedStoryFacts = useGameStore(s => s.clearLockedStoryFacts);
  const settings = useSettingsStore();

  if (!debugMode) return null;
  if (!player) return null;

  // Build debug info
  const lastAction = eventHistory.length > 0
    ? eventHistory[eventHistory.length - 1].event
    : null;

  const playerAction = {
    id: 'debug',
    type: 'unknown',
    risk: 'low' as const,
    mpCost: 0,
    isCustom: false,
  };

  const judgeResult = lastJudgeResult || {
    outcome: '成功' as const,
    roll: 0,
    dc: 0,
    modifier: 0,
    notes: 'Debug mode - no real judge',
  };

  let promptData = { systemMessages: [] as Array<{ role: string; content: string }>, userMessage: '' };
  try {
    promptData = getDebugPrompt(player, worldState, playerAction, judgeResult, logs.slice(-5));
  } catch { /* ignore */ }

  const handleCopyPrompt = () => {
    const text = [
      ...promptData.systemMessages.map(m => `[${m.role}]\n${m.content}`),
      `[user]\n${promptData.userMessage}`,
    ].join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => alert('Prompt 已复制到剪贴板。'));
  };

  return (
    <div className="fixed bottom-16 lg:bottom-8 right-2 lg:right-4 z-40">
      {!isOpen && (
        <button className="btn text-xs opacity-60 hover:opacity-100" onClick={() => setIsOpen(true)}>
          Debug
        </button>
      )}
      {isOpen && (
        <div className="panel p-3 w-80 lg:w-96 max-h-64 lg:max-h-96 overflow-auto text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted">Debug Panel</span>
            <button className="btn text-xs" onClick={() => setIsOpen(false)}>关闭</button>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-muted">AI 模式：</span>{settings.aiMode}
            </div>
            {settings.apiKey && (
              <div>
                <span className="text-muted">API Key：</span>{maskApiKey(settings.apiKey)}
              </div>
            )}
            <div>
              <span className="text-muted">Flags：</span>{worldState.worldFlags.join(', ') || '无'}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted">锁定事实：</span>
                <button className="btn text-xs" onClick={clearLockedStoryFacts}>清空</button>
              </div>
              {worldState.lockedStoryFacts.length === 0 ? (
                <div className="text-muted">无</div>
              ) : (
                <ul className="space-y-1 max-h-24 overflow-auto">
                  {worldState.lockedStoryFacts.map((fact, i) => (
                    <li key={i} className="flex items-center justify-between text-xs">
                      <span>{fact}</span>
                      <button className="btn text-xs" onClick={() => removeLockedStoryFact(i)}>×</button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex gap-1 mt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).elements.namedItem('newFact') as HTMLInputElement;
                  if (input.value.trim()) {
                    addLockedStoryFact(input.value.trim());
                    input.value = '';
                  }
                }}
              >
                <input name="newFact" className="input text-xs flex-1" placeholder="添加锁定事实..." />
                <button type="submit" className="btn text-xs">+</button>
              </form>
            </div>
            <div>
              <span className="text-muted">当前地点：</span>{worldState.currentLocation}
            </div>
            <div>
              <button className="btn text-xs" onClick={handleCopyPrompt}>复制 Prompt</button>
            </div>
            <details>
              <summary className="cursor-pointer text-muted">完整 Prompt 文本</summary>
              <div className="mt-1 p-2 bg-black/30 rounded max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                {promptData.systemMessages.map((m, i) => (
                  <div key={i} className="mb-1"><span className="text-info">[{m.role}]</span> {m.content.slice(0, 100)}...</div>
                ))}
                <div className="text-success">[user] {promptData.userMessage.slice(0, 300)}...</div>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
