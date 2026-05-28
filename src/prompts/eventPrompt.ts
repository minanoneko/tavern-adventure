/**
 * Static event generation instructions — put in system message for cache.
 */
export const EVENT_INSTRUCTION = `根据以下信息生成下一轮冒险事件。

=== 生成要求 ===
1. scene.text 控制在 120-220 中文字，包含场景描写、NPC 对白和氛围。
2. actionOptions 通常3个，重要事件最多4个。label 不超过 20 中文。
3. 至少包含一个稳妥选项和一个观察选项。有合适技能时给一个技能选项。
4. 不要返回无变化的 update 字段。数值变化（HP/MP/经验/金钱）已由本地系统处理，不需要 AI 返回。
5. AI 不负责数值裁判，只负责剧情、选项和少量剧情更新建议（任务/物品/关系/地图）。`;

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
