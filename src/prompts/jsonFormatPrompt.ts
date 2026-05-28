export const JSON_FORMAT_PROMPT = `你必须只输出合法 JSON 对象。不要输出 Markdown、代码块、解释。只输出 JSON 对象。

=== 关键规则 ===
1. 所有字符串必须单行。scene.text 不允许真实换行。如需换行用 \\n。
2. scene.text 推荐写成单段文本。
3. 字符串内双引号必须用反斜杠转义：\\"
4. 输出必须是纯 JSON，不加前后标记。

必填字段：
- scene.title
- scene.text（120-220中文字，单行，换行用\\n）
- actionOptions（通常3个，label不超过20字）
- customActionEnabled（始终为true）

可选字段（有变化才返回，无变化不返回）：
- systemEvents, questUpdate, inventoryUpdate, relationshipUpdate, mapUpdate, worldBroadcasts, memoryUpdate

actionOptions格式（简化）：
[{"label":"选项","type":"dialogue","risk":"low","relatedSkill":null}]`;

