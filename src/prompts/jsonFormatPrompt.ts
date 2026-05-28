export const JSON_FORMAT_PROMPT = `你必须只输出合法 JSON。不要输出 Markdown、解释、代码块、多余文字。

=== 输出格式要求 ===
必填字段：
- scene.title
- scene.text（120-220 中文字）
- actionOptions（通常3个，重要事件最多4个）
- customActionEnabled（始终为 true）

可选字段（只在有变化时返回，没有变化不要返回）：
- systemEvents（系统判定结果或剧情提示）
- questUpdate（任务状态变化时）
- inventoryUpdate（获得或失去物品时）
- relationshipUpdate（关系变化时）
- mapUpdate（发现新地点时）
- worldBroadcasts（世界播报）
- memoryUpdate（flags、地点变化时）

actionOptions 返回格式（简化）：
[{
  "label": "行动选项（不超过20中文）",
  "type": "dialogue | check | combat | exploration | travel | social | stealth | magic | skill | item | trade | cautious",
  "risk": "low | medium | high | extreme",
  "relatedSkill": null
}]

scene.text 控制在 120-220 中文字。
actionOptions 的 label 不超过 20 个中文。
不要返回无变化的字段。`;
