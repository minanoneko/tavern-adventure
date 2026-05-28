/**
 * Static event generation instructions — put in system message for cache.
 */
export const EVENT_INSTRUCTION = `根据以下信息生成下一轮冒险事件。

=== 生成要求 ===
1. scene：当前场景标题、文本、地点、时间、天气（含 locationId）。
2. event：事件信息（id, type, urgency, riskLevel）。
3. systemEvents：判定结果在剧情中的体现。
4. actionOptions：3-5 个推荐行动。至少包含一个稳妥选项、一个观察选项。如果玩家有合适技能，给一个技能选项。
5. 选项 label 要短，像游戏按钮。示例："询问任务细节" "观察对方袖口的血迹" "使用【魔力感知】检查银币"。
6. 所有 playerUpdate 中的数值变化必须合理，不要随意给大量 HP/MP/经验/金钱变化。
7. 输出必须为完整的合法 JSON，字段名使用 camelCase。`;

/**
 * Builds the variable user message content. Only the changing data, no static instructions.
 * This maximizes cache hit rate — all static instructions are in system messages.
 */
export function buildEventPrompt(
  contextJson: string,
  playerActionJson: string,
  judgeResultJson: string
): string {
  return `=== 当前上下文 ===
${contextJson}

=== 玩家行动 ===
${playerActionJson}

=== 判定结果 ===
${judgeResultJson}`;
}
