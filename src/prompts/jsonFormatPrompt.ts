export const JSON_FORMAT_PROMPT = `你必须只输出合法 JSON。
不要输出 Markdown、解释、代码块、"以下是 JSON"、多余文字、注释。

必须输出完整的 AIResponse 结构（使用 camelCase 字段名）：

{
  "scene": { "title": "", "text": "", "location": "", "locationId": "", "time": "", "weather": "" },
  "event": { "id": "", "type": "", "urgency": "low | normal | high", "riskLevel": "low | medium | high | extreme" },
  "systemEvents": [{ "type": "check | info | reward | penalty | warning", "text": "" }],
  "actionOptions": [
    {
      "id": "", "label": "", "type": "", "risk": "low | medium | high | extreme",
      "relatedAttribute": "str | dex | con | int | wis | cha | none",
      "relatedSkill": null, "mpCost": 0, "difficultyPreview": "简单 | 普通 | 困难 | 极难 | 无"
    }
  ],
  "customActionEnabled": true,
  "playerUpdate": { "hpChange": 0, "mpChange": 0, "expChange": 0, "moneyChange": { "gold": 0, "silver": 0, "copper": 0 } },
  "inventoryUpdate": [{ "action": "add | remove | modify", "itemId": "", "name": "", "quantity": 1, "type": "", "description": "", "rarity": "common" }],
  "questUpdate": [{ "id": "", "name": "", "status": "available | active | completed", "description": "", "giver": "", "objectives": [], "rewards": {} }],
  "skillStateUpdate": [{ "skillId": "", "action": "learn | discover", "name": "" }],
  "equipmentUpdate": [{ "action": "add | remove | equip | unequip", "itemId": "", "slot": "", "name": "" }],
  "relationshipUpdate": [{ "targetId": "", "name": "", "change": 0, "reason": "", "type": "npc | faction" }],
  "mapUpdate": [{ "targetId": "", "targetType": "region | subregion | location | connection", "name": "", "status": "discovered | rumored | unlocked" }],
  "worldBroadcasts": [{ "type": "rumor | important | crisis | faction | economy | quest | hidden", "region": "", "text": "" }],
  "memoryUpdate": { "flags": [], "currentLocation": "", "currentLocationId": "", "knownLocations": [] }
}

重要：所有字段名必须使用 camelCase，不可使用 snake_case。
如果没有更新，必须返回空数组或 0，不要省略字段。`;
