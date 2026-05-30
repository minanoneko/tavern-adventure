# 酒馆冒险 (Tavern Adventure)

AI 驱动的奇幻文字冒险 + 本地 D20 回合制战斗。

## 体验

https://minanoneko.github.io/tavern-adventure/

## 启动

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`

## 玩法

创建角色（11 个职业可选）→ AI 生成开局剧情 → 自由探索。

- **固定按钮**：探索/交谈/调查/休息/商店
- **自定义输入**：输入行动意图（如"绕到后门看看""悄悄跟踪那个人"），AI 回应对应剧情
- **不能口胡**：不能写"我捡到 100 金币""我生成一条龙""我一刀秒杀"，系统会拦截

### 战斗

玩家在野外/地城探索时 AI 会触发战斗，或输入攻击指令（如"攻击守卫"）后 AI 返回 combatStart 进入战斗。

回合制 D20 系统：

- **攻击** — d20 + 敏修正 vs 敌人 AC
- **技能** — 消耗 MP，有倍率加成
- **物品** — 治疗药水、燃烧瓶、烟雾弹
- **防御** — 伤害减半
- **逃跑** — d20 + 敏修正 vs DC14

战斗奖励本地结算：经验、钱币、材料、稀有饰品。

### BOSS

只在关键剧情节点触发（区域深处、任务终点、反派登场），有独立掉落。

### CHECK 判定

需要 AI 选项带 `requiresCheck: true` 才会判定。`d20 + 属性修正 vs DC`，成功/失败由本地结算。

## 技术栈

React + TypeScript + Vite + Zustand + Tailwind CSS + Zod

```
src/
├── components/     UI 组件
├── services/      核心逻辑 (combat/gameEngine/judgeService)
├── store/         Zustand 状态管理
├── types/         类型定义
├── prompts/       AI 提示词
├── data/          技能/装备/地图数据
└── utils/         工具函数
```

## 配置

复制 `.env.example` 为 `.env`：

```
VITE_USE_MOCK_AI=true    # 本地模拟，不开战
VITE_DEBUG_PROMPT=false
```

如需 AI：设为 `false`，填入 API 地址、模型、Key。

## License

MIT
