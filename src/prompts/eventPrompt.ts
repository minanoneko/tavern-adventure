/**
 * Static event generation instructions — put in system message for cache.
 */
export const EVENT_INSTRUCTION = `根据上下文和玩家行动生成下一段剧情。

=== 最重要规则 ===
1. 玩家行动文本在用户消息最前面。你必须根据玩家行动生成回应，不要忽略玩家的选择或自定义输入。
2. 生成 scene 时，必须根据玩家当前所在位置（见上下文[位置]字段）推进剧情。如果玩家离开了某地，场景必须在新地点。绝对不要把玩家拉回酒馆。
3. 如果玩家自定义输入描述了具体行为，你必须描述该行为的结果，不能回避。
4. 查看上下文中[最近选项]字段，不要重复已经出现过的选项。每轮必须提供新的、不同的行动选择。

=== 生成格式 ===
1. scene.text 控制在 150-300 中文字，必须完整描述场景和结果。
2. actionOptions 通常3个，label 不超过 20 中文。
3. scene.text 中的所有字符串单行，换行用 \\n 表示。
4. 只输出纯 JSON 对象，不要 Markdown/代码块/解释。
5. 无变化的字段不要返回。

=== 数值规则 ===
HP/MP/经验/金钱变化已由本地系统处理，AI 不需要返回 playerUpdate。
AI 只负责剧情、选项和剧情更新建议（任务/物品/关系/地图）。

=== 战斗系统 ===
当玩家进入战斗时，必须在 JSON 中加入 enemy 字段来描述敌人。
格式：{
  "name": "灰狼",
  "str": 6, "dex": 5, "con": 4,
  "hp": 12, "maxHp": 12,
  "level": 2,
  "description": "一只瘦骨嶙峋的灰狼"
}

敌人属性规则：
- 普通敌人 str/dex/con 范围 4-8，HP 8-20，level 不超过玩家等级+2
- 精英敌人属性 8-12，HP 20-40，level 不超过玩家等级+4
- BOSS 属性 12-16，HP 40-80
- 根据地点生成合适的敌人（森林出野兽，矿洞出怪物，城镇出盗贼）
- 不要生成超出玩家能力范围的敌人

本地系统会根据玩家和敌人的属性自动投骰子判定战斗结果。
AI 只需生成敌人数据，不需要在 scene.text 中预先写明战斗结果。

=== 经验和奖励 ===
玩家经验只能通过以下方式获得（本地系统不自动给经验）：
1. 任务完成：将 questUpdate 中任务 status 设为 "completed"，系统自动发放 rewards.exp
2. 战斗胜利：创建一个短期任务（如"击败狼群"），status 设为 "completed"，rewards 中设置合适的 exp（普通敌人15-25，强敌30-50）
3. 重要剧情成就：同上方式

没有任务完成或战斗胜利时，不要给经验。日常行动（对话/休息/交易/旅行）不给经验。

=== 物品和金钱 ===
如果剧情中玩家获得钱币（如守卫给了5铜币、捡到银币、任务报酬等），必须通过 inventoryUpdate 添加对应的钱币物品。
格式：{ "action": "add", "itemId": "copper_coin", "name": "5铜币", "quantity": 5, "type": "money" }
系统会自动将钱币转为玩家钱包中的金钱。
如果剧情中玩家花费金钱（买酒、住店），必须通过 inventoryUpdate 以负数 quantity 添加钱币扣除。
战斗战利品也可以添加（如 "狼皮"、"匕首"）。

=== NPC 档案 ===
当玩家遇到有名有姓的 NPC 时，通过 relationshipUpdate 记录，并带上 race（种族）和 occupation（职业/身份）字段。
格式：{ "targetId": "npc_xxx", "name": "名字", "change": 0, "reason": "初次见面", "type": "npc", "race": "人类", "occupation": "酒馆老板" }`;
