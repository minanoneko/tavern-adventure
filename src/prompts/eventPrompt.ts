/**
 * Static event generation instructions — put in system message for cache.
 */
export const EVENT_INSTRUCTION = `根据上下文和玩家行动生成下一段剧情。

=== 最重要规则 ===
1. 玩家行动文本在用户消息最前面。你必须根据玩家行动生成回应，不要忽略玩家的选择或自定义输入。
2. 生成 scene 时，要根据玩家行动推进剧情。如果玩家离开了某地，场景必须在新地点。
3. 如果玩家自定义输入描述了具体行为，你必须描述该行为的结果，不能回避。

=== 生成格式 ===
1. scene.text 控制在 150-300 中文字，必须完整描述场景和结果。
2. actionOptions 通常3个，label 不超过 20 中文。
3. scene.text 中的所有字符串单行，换行用 \\n 表示。
4. 只输出纯 JSON 对象，不要 Markdown/代码块/解释。
5. 无变化的字段不要返回。

=== 数值规则 ===
HP/MP/经验/金钱变化已由本地系统处理，AI 不需要返回 playerUpdate。
AI 只负责剧情、选项和剧情更新建议（任务/物品/关系/地图）。

=== 任务和奖励 ===
当任务目标达成时，必须通过 questUpdate 将任务状态设为 "completed"。
任务完成时，本地系统会自动发放该任务的 rewards 中的经验和金钱。
战斗战利品可通过 inventoryUpdate 添加（如 "银币"、"狼皮"），系统会自动将钱币转为金钱。`;
