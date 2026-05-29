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
    "locationId": ""
  },
  "actionOptions": [
    {"label":"选项(≤15字)","type":"dialogue","risk":"low"},
    {"label":"选项","type":"check","risk":"low"},
    {"label":"选项","type":"dialogue","risk":"low"}
  ],
  "customActionEnabled": true
}

无变化的可选字段不要返回。
scene.text中所有的字符串单行，真实换行用\\\\n。`;
