/**
 * Builds the world broadcast generation prompt.
 */
export function buildWorldBroadcastPrompt(worldStateJson: string, recentEventsJson: string): string {
  return `你需要根据世界状态、时间流逝、任务变化、地图区域和阵营关系生成世界播报。

当前世界状态：
${worldStateJson}

最近事件：
${recentEventsJson}

播报规则：
1. 最多生成 0-2 条播报。
2. 不要每轮都生成大事件。
3. 播报要和地图区域、任务或阵营有关。
4. 可以埋伏笔，但不要剧透。
5. 早期多用传闻和地方事件。
6. 中后期再出现跨区域事件。

播报格式：
[
  { "type": "rumor | important | crisis | faction | economy | quest | hidden", "region": "区域名", "text": "播报正文" }
]

请以 JSON 数组格式回复。`;
}
