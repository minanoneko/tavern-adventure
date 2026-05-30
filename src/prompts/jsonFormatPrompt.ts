export const JSON_FORMAT_PROMPT = `=== 输出规则（极其重要）===
你只能输出一个JSON对象。第一个字符必须是{，最后一个字符必须是}。
禁止输出JSON外的任何内容：Markdown、解释、代码块标记、自然语言段落、中文前言（如"好的""以下是"之类）一概禁止。

剧情文本必须放在 scene.text 字段里。不要把剧情写在JSON外面。

你必须返回的JSON结构：
{
  "scene": {
    "title": "",
    "text": "(80-160中文字，单行，换行用\\\\n)",
    "location": "",
    "locationId": "",
    "time": "傍晚",
    "weather": "多云"
  },
  "actionOptions": [
    {"label":"逼问报价漏洞","type":"dialogue","risk":"low","intent":"套出对方隐瞒的条件或破绽","contextNote":"关联当前NPC/交易/委托","targetEntityId":"npc_xxx"},
    {"label":"花钱买捷径","type":"trade","risk":"low","intent":"用小额钱币换取路线、情报或引荐","moneyCost":{"copper":50},"requiresCheck":false},
    {"label":"冒险抢先手","type":"check","risk":"medium","intent":"用一次有风险的行动换取先手或关键情报","requiresCheck":true,"checkAttribute":"dex","difficultyClass":14,"failureConsequence":"暴露意图或引发冲突"}
  ],
  "combatStart": { "enemies": [{"name":"灰狼","type":"monster","suggestedLevel":2}], "reason":"理由" },
  "customActionEnabled": true
}

无变化的可选字段不要返回。
scene.text中所有的字符串单行，真实换行用\\\\n。`;
