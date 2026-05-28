/**
 * Builds the prompt for parsing a player's custom free-text action.
 */
export function buildActionParsePrompt(playerInput: string, contextJson: string): string {
  return `你需要解析玩家的自定义行动。

玩家输入：${playerInput}

当前上下文：
${contextJson}

请判断：
1. actionType：行动类型 (observe | dialogue | combat | stealth | skill | magic | social | travel | item | cautious | risky | other)
2. relatedAttribute：最相关的属性 (str | dex | con | int | wis | cha | none)
3. relatedSkill：可能的技能 ID 或 null
4. risk：风险等级 (low | medium | high | extreme)
5. requiresCheck：是否需要判定
6. difficulty：难度 (easy | normal | hard | extreme)
7. resourceCost：消耗 { mp: 0, hp: 0, itemId: null }
8. notes：简短说明

解析原则：
- 不要替玩家行动加戏
- 不要把模糊行动强行变成攻击
- 如果玩家行动谨慎，应降低风险
- 如果玩家提到技能或装备，要优先匹配
- 如果无法判断，设置 actionType 为 other，relatedAttribute 为 none

请以 JSON 格式回复。`;
}
