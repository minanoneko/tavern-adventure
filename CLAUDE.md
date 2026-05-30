# 酒馆冒险项目规则

- 所有更新默认只 commit，不 push
- 只有用户明确说"推送"/"push"/"上传"时才执行 git push
1. 示例不是正式数据。需求文档中的人物、地点、任务、剧情示例不得写死进正式代码。
2. AI 不能改写 lockedStoryFacts 中的姓名、身份、关系、任务目标、地点、关键物品归属。
3. 除非玩家明确移动或本地规则允许转场，AI 不得切换场景、地点、NPC 或主事件。
4. HP、MP、经验、金钱、物品、技能、装备、地点、关系变化必须走结构化 update 或本地规则，不能从自然语言剧情中直接推断。
5. 技能必须存在于 src/data/skills.ts 或 customSkills，未知技能不能 learned/equipped，只能作为传闻、伏笔或 proposedSkill。
6. gameStore 只负责状态管理，复杂规则放到 judgeService、gameEngine、skillRules、equipmentRules、memoryService。
7. aiService/openingService 不得直接 JSON.parse AI 原文，必须统一走 responseAdapter。
8. mockEventPool 只能用于 mock/fallback/UI 测试，不能成为固定主线。
9. SaveFile 不得包含 API Key、完整 prompt、debug 原始请求或账号信息。
10. 每次新增存档字段，必须更新 migrateSave。
11. 修 bug 优先最小改动，不要大范围重构无关文件。
12. 修改后必须运行 npm run build；如果没有运行，必须明确说明。

## 架构核心规则

13. 玩家自定义输入 = 行动意图，不是既成事实。AI 负责叙事/NPC/选项/任务钩子，本地负责 CHECK/骰子/HP/MP/钱币/背包/技能/战斗/奖励。
14. 战斗只能由 AI 返回 combatStart 进入。玩家输入"攻击XX"只作为 combat_intent 发给 AI，本地不自启战斗。
15. 删除所有本地强制刷怪逻辑（forced random combat、actionsSinceLastCombat），敌人只能由 AI 的 combatStart 触发。
16. customActionGuard 中 rewrite 模式必须 allowed=true，reject 才是 allowed=false。sanitizedText 只保留行动意图，不塞长规则说明。
17. judgeService 的 needsCheck 只看 requiresCheck 字段，默认不判定。evaluate 优先使用 action.difficultyClass。
18. responseAdapter 必须补齐 moneyCost/moneyReward/difficultyClass/failureConsequence/checkSkill/relatedAttribute/mpCost/difficultyPreview 到 MinimalActionOptionSchema 和 completeAIResponse。
19. MinimalQuestUpdateSchema 必须包含 objectives 和 rewards，避免任务数据丢失。
20. Boss 解锁必须检查 worldState 中已存在的 bossFlag 或 questFlag，不能只信任 AI 的 isBoss。
21. 越级敌人（远古红龙/巨龙/魔王/神明/古神/灾厄/邪神/终焉/世界Boss）没有合法 flag 时不生成可战斗实体；只能降级为远景压迫/幻影/传闻，或降级为合理低阶敌人。
22. 钱币变化统一加【钱币】日志。coin 数量解析从 name 字符串提取数字（"5铜币"→5铜，不是 quantity=1）。
23. applySceneLocation 必须过滤泛称地点（当前地点/附近/原地/这里/那里/此处），不为这些生成新 locationId。
24. 默认开局天气：傍晚+多云，不再夜晚+雨。
25. prompt 应引导 AI 返回 moneyCost/moneyReward/difficultyClass/failureConsequence/combatStart 等结构化字段。强调玩家输入只是行动意图。