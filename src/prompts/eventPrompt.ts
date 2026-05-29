export const EVENT_INSTRUCTION = `根据上下文和玩家行动生成下一段剧情。

=== 最重要规则 ===
1. 玩家行动文本在用户消息最前面。你必须根据玩家行动生成回应。
1.5. 必须维持故事连续性。查看上下文中的"刚才"和"剧情"字段，了解正在发生什么。不要在玩家刚离开酒馆后又写回到酒馆。
2. 生成 scene 时，必须根据玩家当前所在位置推进剧情。绝对不要把玩家拉回酒馆。
3. 天气和时间必须自然变化。scene.time 和 scene.weather 会被本地同步到 worldState，必须给出具体值（如"上午""夜""小雨""晴"）。不要写"稍后"或"过了一会"等模糊词，会被自动推进一轮。
   - 不要反复写雨夜、冷雨、湿斗篷。
   - 如果上一轮是雨，本轮优先变为小雨、阴、雾、多云或晴。
   - scene.weather 必须是：晴、多云、阴、雾、小雨、雨、雪、暴风雨 之一。
4. 查看上下文中[最近选项]字段，不要重复已经出现过的选项。

=== 生成格式 ===
1. scene.text 80-160中文字（重要事件160-260字），单行，换行用\\n。
2. actionOptions 固定3个，label不超过15字。商店选项必须带moneyCost。
3. 每个 actionOption 必须包含 intent（动作目的）和 contextNote（关联的NPC/目标/当前事件）。label 可短，intent 和 contextNote 必须清楚。
4. 只输出纯JSON，不要Markdown/代码块/解释。
5. 无变化的字段不要返回（questUpdate/inventoryUpdate等，没有变化就省略）。
6. scene.text 不要重复之前已经说过的内容。
7. 查看上下文中的 lockedStoryFacts（锁定事实），不得改写其中的姓名、身份、关系、任务目标。这是硬约束。
8. 如果玩家选择的行动包含 [玩家意图] 信息，必须围绕其中的 intent 和 contextNote 生成剧情。

=== 战斗系统 ===
当剧情需要进入战斗时，返回 combatStart 字段：
{
  "combatStart": {
    "enemies": [{"name":"灰狼","type":"monster","suggestedLevel":2,"suggestedStr":6,"suggestedDex":5,"suggestedCon":4,"suggestedHp":12}],
    "reason":"狼群从树丛中窜出",
    "location":"林道"
  }
}
战斗完全由本地规则驱动。AI 只负责：
1. 决定是否触发战斗（通过 combatStart）
2. 在战斗结束后根据本地 CombatResolution 写描述文本
AI 不得：
- 直接设置 HP、MP、金钱、经验变化（由本地 combatEngine 和 combatRewards 控制）
- 决定命中/未命中/伤害数值（由本地 dice 系统判定）
- 给予战斗奖励（由本地 combatRewards 计算）
- 在战斗中改变敌人属性
你只能提供 enemy 描述和 name，本地系统会填充具体数值并执行判定。

=== 商店与经济 ===
城镇/集市/铁匠铺/药剂店等地点可以生成购买选项。
购买选项必须带 moneyCost 字段，格式：{"label":"购买治疗药水(50铜)","type":"trade","moneyCost":{"copper":50}}
系统会自动扣钱给物品。AI 不能直接赠送物品，必须走购买流程。
可购买的物品包括：治疗药水(50铜)、燃烧瓶(1银)、烟雾弹(80铜)，以及装备库中的武器护甲（参考其price字段）。
普通装备价格在40-200铜之间。

=== 休息恢复 ===
酒馆/旅店/安全营地应生成休息选项：
{"label":"在酒馆休息(10铜)","type":"cautious","moneyCost":{"copper":10},"intent":"花钱休息恢复体力"}
系统会全额恢复HP/MP并自动扣钱。休息选项的 label 中必须写明价格。

=== 战斗频率 ===
不要连续触发战斗。两次战斗之间至少间隔 2-3 次普通行动。
给玩家喘息、探索、对话、交易的机会。
冒险探索为主，战斗是冒险的一部分，不是全部。
大部分行动应该是非战斗的：调查线索、对话NPC、探索地点、交易购物、休息恢复。
如果上一轮刚结束战斗，本轮不应该再触发新战斗。

=== 经验和奖励 ===
经验只能通过任务完成获得：questUpdate status设为"completed"，系统自动发放rewards.exp。
战斗奖励由本地系统自动计算并发放，AI 不得在 JSON 中给战斗经验或战斗金钱。
日常行动不给经验。

=== 物品和金钱 ===
钱币通过inventoryUpdate添加：{"action":"add","itemId":"copper_coin","name":"5铜币","quantity":5,"type":"money"}
系统自动将钱币转为钱包金钱。战斗战利品同样方式添加。

=== NPC 档案 ===
遇到有名有姓的NPC时，relationshipUpdate带race和occupation字段。
格式：{"targetId":"npc_xxx","name":"名字","change":0,"reason":"初次见面","type":"npc","race":"人类","occupation":"酒馆老板"}`;
