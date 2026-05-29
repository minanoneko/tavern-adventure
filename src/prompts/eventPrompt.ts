export const EVENT_INSTRUCTION = `根据上下文和玩家行动生成下一段剧情。

=== 最重要规则 ===
1. 玩家行动文本在用户消息最前面。你必须根据玩家行动生成回应。
1.5. 必须维持故事连续性。查看上下文中的"刚才"和"剧情"字段，了解正在发生什么。不要在玩家刚离开酒馆后又写回到酒馆。
2. 生成 scene 时，必须根据玩家当前所在位置推进剧情。绝对不要把玩家拉回酒馆。
3. 天气和时间必须自然变化。不要连续多轮同一种天气。晴/阴/雾/小雨/多云交替。
4. 查看上下文中[最近选项]字段，不要重复已经出现过的选项。

=== 生成格式 ===
1. scene.text 80-160中文字（重要事件160-260字），单行，换行用\\n。
2. actionOptions 固定3个，label不超过15字。
3. 只输出纯JSON，不要Markdown/代码块/解释。
4. 无变化的字段不要返回（questUpdate/inventoryUpdate等，没有变化就省略）。
5. scene.text 不要重复之前已经说过的内容。

=== 战斗系统 ===
当进入战斗时，JSON 中必须包含 enemy 字段。敌人每回合都会攻击玩家。
格式：{"name":"灰狼","str":6,"dex":5,"con":4,"hp":12,"maxHp":12,"level":2}
属性规则：普通敌人4-8/HP8-20/≤玩家等级+2；精英8-12/HP20-40/≤+4；BOSS 12-16/HP40-80。
本地系统自动掷骰子判定战斗结果。战斗未结束时继续返回enemy字段。
玩家自定义输入可以描述攻击或防御动作。

=== 经验和奖励 ===
经验只能通过任务完成获得：questUpdate status设为"completed"，系统自动发放rewards.exp。
战斗胜利也通过questUpdate发放（普通15-25，强敌30-50）。
日常行动不给经验。

=== 物品和金钱 ===
钱币通过inventoryUpdate添加：{"action":"add","itemId":"copper_coin","name":"5铜币","quantity":5,"type":"money"}
系统自动将钱币转为钱包金钱。战斗战利品同样方式添加。

=== NPC 档案 ===
遇到有名有姓的NPC时，relationshipUpdate带race和occupation字段。
格式：{"targetId":"npc_xxx","name":"名字","change":0,"reason":"初次见面","type":"npc","race":"人类","occupation":"酒馆老板"}`;
