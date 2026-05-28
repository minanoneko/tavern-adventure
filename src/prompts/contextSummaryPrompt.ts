/**
 * Builds the context summary prompt for compressing long logs.
 */
export function buildContextSummaryPrompt(logsJson: string): string {
  return `你需要把长日志压缩成 AI 可用的冒险上下文摘要。

完整日志：
${logsJson}

摘要必须包含：
1. playerSummary：玩家姓名、等级、种族、职业、关键属性、HP/MP、状态、可用技能摘要
2. currentSituation：当前地点、时间、天气
3. activeQuests：当前进行中的任务
4. importantItems：关键背包物品
5. knownNpcs：已知重要 NPC 及关系
6. knownLocations：已解锁地点列表
7. importantFlags：重要事件标记
8. recentEvents：最近 5 个事件的关键点

规则：
- 不要保留无意义细节
- 不要编造没有发生过的事情
- 不要改变任务状态
- 不要替玩家总结性格（除非角色卡明确写了）

请以 JSON 格式回复。`;
}
