import type { Player, WorldState, AIResponse, PlayerAction, JudgeResult, LogEntry } from '../types';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt';
import { STYLE_PROMPT } from '../prompts/stylePrompt';
import { JSON_FORMAT_PROMPT } from '../prompts/jsonFormatPrompt';
import { buildEventPrompt, EVENT_INSTRUCTION } from '../prompts/eventPrompt';
import { buildActionParsePrompt } from '../prompts/actionParsePrompt';
import { buildContextSummaryPrompt } from '../prompts/contextSummaryPrompt';
import { buildWorldBroadcastPrompt } from '../prompts/worldBroadcastPrompt';
import { buildAIContext as buildStructuredContext, formatAIContext } from './contextBuilder';

/**
 * Build system messages array.
 * All 4 messages are static — LLM APIs cache these automatically.
 * Only the user message changes between requests.
 */
export function buildSystemMessages(): Array<{ role: string; content: string }> {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: STYLE_PROMPT },
    { role: 'system', content: JSON_FORMAT_PROMPT },
    { role: 'system', content: EVENT_INSTRUCTION },
  ];
}

export function buildAIContext(
  player: Player,
  worldState: WorldState,
  recentLogs: LogEntry[],
  eventHistory: AIResponse[] = []
): Record<string, unknown> {
  // Build structured context via contextBuilder (10 modules with budgets)
  // This is a dummy playerAction for the full context, actual calls use buildEventPromptFullWithContext
  const dummyAction = { id: '', type: '', risk: 'low' as const, mpCost: 0, isCustom: false };
  const dummyJudge = { outcome: '成功' as const, roll: 0, dc: 0, modifier: 0, notes: '' };
  const currentEvent = eventHistory.length > 0 ? eventHistory[eventHistory.length - 1] : null;
  const ctx = buildStructuredContext(player, worldState, dummyAction, dummyJudge, recentLogs, currentEvent);
  const formatted = formatAIContext(ctx);

  return {
    contextText: formatted,
    currentLocation: worldState.currentLocation,
    time: `${worldState.date} ${worldState.timeOfDay}`,
    weather: worldState.weather,
    customOrigin: player.customOrigin,
    personalityTraits: player.personalityTraits,
    hp: `${player.resources.hp}/${player.resources.maxHp}`,
    mp: `${player.resources.mp}/${player.resources.maxMp}`,
    statusEffects: player.statusEffects,
    money: player.money,
  };
}

export function buildEventPromptFull(
  context: Record<string, unknown>,
  playerAction: PlayerAction,
  judgeResult: JudgeResult
): string {
  // context now contains 'contextText' from buildAIContext — use it directly
  const contextText = (context as any).contextText || JSON.stringify(context, null, 2);
  const actionJson = JSON.stringify({ type: playerAction.type, risk: playerAction.risk, isCustom: playerAction.isCustom }, null, 2);
  const judgeJson = JSON.stringify(judgeResult, null, 2);

  // The contextText already contains the 10-module summary. Just append action + judge.
  return `${contextText}

=== 玩家行动 ===
${actionJson}

=== 判定结果 ===
${judgeJson}`;
}

export function buildActionParsePromptFull(playerInput: string, context: Record<string, unknown>): string {
  return buildActionParsePrompt(playerInput, JSON.stringify(context, null, 2));
}

export function buildContextSummaryPromptFull(logs: LogEntry[], context: Record<string, unknown>): string {
  return buildContextSummaryPrompt(JSON.stringify({ logs, context }, null, 2));
}

export function buildWorldBroadcastPromptFull(worldState: WorldState, recentEvents: AIResponse[]): string {
  return buildWorldBroadcastPrompt(
    JSON.stringify(worldState, null, 2),
    JSON.stringify(recentEvents.slice(-3), null, 2)
  );
}

// For debug: return the full prompt that would be sent to AI
export function getDebugPrompt(
  player: Player,
  worldState: WorldState,
  playerAction: PlayerAction,
  judgeResult: JudgeResult,
  recentLogs: LogEntry[]
): { systemMessages: Array<{ role: string; content: string }>; userMessage: string } {
  const context = buildAIContext(player, worldState, recentLogs);
  const userMessage = buildEventPromptFull(context, playerAction, judgeResult);
  return {
    systemMessages: buildSystemMessages(),
    userMessage,
  };
}
