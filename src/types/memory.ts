export interface LongTermSummary {
  playerIdentity: string;        // "艾伦, 人类魔法师, Lv.2"
  storyProgress: string;         // key story beats summary
  completedQuests: string[];     // completed quest names
  keyNPCs: string[];             // important NPCs with standing
  discoveredLocations: string[]; // discovered important locations
  unresolvedHooks: string[];    // unresolved plot hooks
  importantFacts: string[];      // key facts extracted from events
  lastUpdated: string;           // ISO timestamp
}

export function createEmptySummary(): LongTermSummary {
  return {
    playerIdentity: '',
    storyProgress: '',
    completedQuests: [],
    keyNPCs: [],
    discoveredLocations: [],
    unresolvedHooks: [],
    importantFacts: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function formatSummaryForAI(s: LongTermSummary): string {
  const parts: string[] = [];
  if (s.playerIdentity) parts.push(s.playerIdentity);
  if (s.storyProgress) parts.push(`剧情: ${s.storyProgress}`);
  if (s.completedQuests.length) parts.push(`已完成: ${s.completedQuests.join(', ')}`);
  if (s.keyNPCs.length) parts.push(`NPC: ${s.keyNPCs.join(', ')}`);
  if (s.unresolvedHooks.length) parts.push(`伏笔: ${s.unresolvedHooks.slice(0, 5).join('; ')}`);
  if (s.importantFacts.length) parts.push(`关键: ${s.importantFacts.slice(0, 8).join('; ')}`);
  return parts.join(' | ') || '冒险刚开始';
}
