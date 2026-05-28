import type { Player, WorldState, AIResponse, PlayerAction, JudgeResult, LogEntry } from '../types';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt';
import { STYLE_PROMPT } from '../prompts/stylePrompt';
import { JSON_FORMAT_PROMPT } from '../prompts/jsonFormatPrompt';
import { buildEventPrompt, EVENT_INSTRUCTION } from '../prompts/eventPrompt';
import { buildActionParsePrompt } from '../prompts/actionParsePrompt';
import { buildContextSummaryPrompt } from '../prompts/contextSummaryPrompt';
import { buildWorldBroadcastPrompt } from '../prompts/worldBroadcastPrompt';
import { getLongTermSummary, formatSummaryForAI } from './memoryService';

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
  // Compact context — only what AI needs for this decision
  const attrKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
  const attrLabels = ['力', '敏', '体', '智', '感', '魅'];
  const attrs = attrKeys.map((k, i) => `${attrLabels[i]}${player.attributes[k]}`).join(' ');

  const usableSkills = player.skills.learned.slice(0, 8).join(', ') || '无';

  const gear = Object.entries(player.equipment)
    .filter(([, id]) => id !== null)
    .map(([, id]) => id)
    .join(', ') || '无';

  const importantItems = player.inventory
    .filter(i => i.type === 'quest_item' || i.type === 'skill_book' || ['rare', 'epic', 'legendary'].includes(i.rarity))
    .slice(0, 6)
    .map(i => i.name)
    .join(', ') || '无';

  const activeQuests = player.quests
    .filter(q => q.status === 'active' || q.status === 'available')
    .slice(0, 4)
    .map(q => `${q.status === 'active' ? '▶' : '○'}${q.name}`)
    .join(', ') || '无';

  const recentLogsText = recentLogs.slice(-6)
    .map(l => `[${l.type}] ${l.text.slice(0, 50)}`)
    .join('\n');

  const longSummary = (getLongTermSummary ? formatSummaryForAI(getLongTermSummary()) : '');

  const contextText = [
    `[角色] ${player.name} Lv.${player.level} ${player.race}${player.classOrigin} | HP${player.resources.hp}/${player.resources.maxHp} MP${player.resources.mp}/${player.resources.maxMp} | ${attrs}`,
    `[位置] ${worldState.currentLocation} | ${worldState.date} ${worldState.timeOfDay} ${worldState.weather}`,
    `[技能] ${usableSkills}`,
    `[装备] ${gear}`,
    `[重要物品] ${importantItems}`,
    `[任务] ${activeQuests}`,
    `[长期] ${longSummary}`,
    `[最近日志]\n${recentLogsText}`,
  ].filter(Boolean).join('\n');

  return {
    contextText,
    currentLocation: worldState.currentLocation,
    time: `${worldState.date} ${worldState.timeOfDay}`,
    weather: worldState.weather,
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
