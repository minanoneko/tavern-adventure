import type { Player, WorldState, AIResponse, LogEntry } from '../types';
import type { LongTermSummary } from '../types/memory';
import { createEmptySummary, formatSummaryForAI } from '../types/memory';
import { createLogEntry } from '../types/log';

// In-memory state (survives within session, saved to localStorage for persistence)
let longTermMemory: LongTermSummary = createEmptySummary();
let gameFlags: string[] = [];

// ========== Memory lifecycle ==========

export function resetMemory(): void {
  longTermMemory = createEmptySummary();
  gameFlags = [];
}

export function loadMemoryFromSave(summary: LongTermSummary, flags: string[]): void {
  longTermMemory = summary;
  gameFlags = flags;
}

export function getLongTermSummary(): LongTermSummary {
  return longTermMemory;
}

export function getGameFlags(): string[] {
  return gameFlags;
}

// ========== createEmptySummary (re-export for convenience) ==========
export { createEmptySummary, formatSummaryForAI };

// ========== updateLongTermSummary ==========
export function updateLongTermSummary(
  player: Player,
  worldState: WorldState,
  logs: LogEntry[],
  _oldSummary?: LongTermSummary
): LongTermSummary {
  const s = { ...longTermMemory };

  // Player identity (update when level changes)
  s.playerIdentity = `${player.name}, ${player.race}${player.classOrigin}, Lv.${player.level}`;

  // Story progress from important log events
  const narrativeLogs = logs.filter(l => l.type === 'narrative' || l.type === 'quest' || l.type === 'world');
  if (narrativeLogs.length > 0) {
    s.storyProgress = narrativeLogs.slice(-5).map(l => l.text.slice(0, 60)).join(' → ');
  }

  // Resolved story hooks (replaces completed quests)
  const resolved = (worldState.storyHooks || []).filter(h => h.status === 'resolved').map(h => h.title);
  if (resolved.length > 0) {
    s.completedQuests = [...new Set([...s.completedQuests, ...resolved])].slice(-10);
  }
  // Unresolved hooks for future reference
  const openHooks = (worldState.storyHooks || []).filter(h => h.status === 'open').map(h => h.title);
  if (openHooks.length > 0) {
    s.unresolvedHooks = [...new Set([...s.unresolvedHooks, ...openHooks])].slice(-10);
  }

  // Key NPCs
  const npcs = player.relationships.filter(r => r.standing !== 0).slice(0, 6);
  if (npcs.length > 0) {
    const getLabel = (st: number) => st >= 30 ? '信任' : st >= 15 ? '友善' : st >= 5 ? '熟悉' : st >= -5 ? '中立' : '冷淡';
    s.keyNPCs = npcs.map(n => `${n.name}(${getLabel(n.standing)})`);
  }

  // Discovered locations
  if (worldState.discoveredLocations.length > 0) {
    s.discoveredLocations = worldState.discoveredLocations.slice(-10);
  }

  // Update timestamp
  s.lastUpdated = new Date().toISOString();

  longTermMemory = s;
  return s;
}

// ========== getRecentImportantLogs ==========
export function getRecentImportantLogs(logs: LogEntry[], limit: number = 8): LogEntry[] {
  // Prioritize narrative, quest, world, and judge logs over item/system logs
  const priorityOrder = ['narrative', 'quest', 'world', 'judge', 'combat', 'relationship', 'item', 'system'];
  const recent = logs.slice(-24);
  const selected = [...recent].sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.type);
    const bIdx = priorityOrder.indexOf(b.type);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return logs.indexOf(b) - logs.indexOf(a);
  }).slice(0, limit);

  return selected.sort((a, b) => logs.indexOf(a) - logs.indexOf(b));
}

// ========== extractImportantFacts ==========
export function extractImportantFacts(event: AIResponse): void {
  // System events
  for (const se of event.systemEvents) {
    if (['reward', 'warning', 'info'].includes(se.type)) {
      const fact = se.text.slice(0, 80);
      if (!longTermMemory.importantFacts.includes(fact)) {
        longTermMemory.importantFacts.push(fact);
      }
    }
  }

  // Story hook / quest updates
  for (const qu of event.questUpdate) {
    const fact = qu.status === 'active'
      ? `新线索: ${qu.name}`
      : qu.status === 'completed'
        ? `线索解决: ${qu.name}`
        : null;
    if (fact && !longTermMemory.importantFacts.includes(fact)) {
      longTermMemory.importantFacts.push(fact);
    }
  }
  // storyHookUpdate facts (preferred new system)
  for (const hu of (event.storyHookUpdate || [])) {
    const fact = hu.action === 'add' ? `新线索: ${hu.title || hu.summary}`
      : hu.action === 'resolve' ? `线索解决: ${hu.title || hu.summary}` : null;
    if (fact && !longTermMemory.importantFacts.includes(fact)) {
      longTermMemory.importantFacts.push(fact);
    }
  }

  // Map discoveries
  for (const mu of event.mapUpdate) {
    if (mu.status === 'discovered') {
      const fact = `发现: ${mu.name || mu.targetId}`;
      if (!longTermMemory.importantFacts.includes(fact)) {
        longTermMemory.importantFacts.push(fact);
      }
    }
  }

  // Relationship changes (significant ones)
  for (const ru of event.relationshipUpdate) {
    if (Math.abs(ru.change) >= 5) {
      const fact = `${ru.name}: ${ru.change > 0 ? '+' : ''}${ru.change} (${ru.reason})`;
      if (!longTermMemory.importantFacts.includes(fact)) {
        longTermMemory.importantFacts.push(fact);
      }
    }
  }

  // Keep last 20 facts
  if (longTermMemory.importantFacts.length > 20) {
    longTermMemory.importantFacts = longTermMemory.importantFacts.slice(-20);
  }
}

// ========== trimRecentLogs ==========
export function trimRecentLogs(logs: LogEntry[], maxRecent: number = 10): LogEntry[] {
  if (logs.length <= maxRecent) return logs;
  const old = logs.slice(0, logs.length - maxRecent);
  const recent = logs.slice(-maxRecent);

  if (old.length > 30) {
    const summaryLogs = old.filter(l =>
      ['narrative', 'quest', 'world'].includes(l.type)
    ).slice(-5);

    const summaryText = `[压缩了${old.length}条历史日志] ` +
      summaryLogs.map(l => l.text.slice(0, 60)).join('; ');

    return [
      { id: 'compressed_logs', timestamp: new Date().toISOString(), type: 'system' as const, text: summaryText },
      ...recent,
    ];
  }

  return logs;
}

// ========== buildMemoryContext ==========
export function buildMemoryContext(
  logs: LogEntry[],
  summary: LongTermSummary,
  gameFlags: string[]
): { longTermText: string; recentLogsText: string; flagText: string } {
  const importantLogs = getRecentImportantLogs(logs, 8);
  return {
    longTermText: formatSummaryForAI(summary),
    recentLogsText: importantLogs.map(l => `[${l.type}] ${l.text}`).join('\n'),
    flagText: gameFlags.length > 0 ? gameFlags.join(', ') : '无',
  };
}

// ========== Hooks management ==========
export function addUnresolvedHook(hook: string): void {
  if (!longTermMemory.unresolvedHooks.includes(hook)) {
    longTermMemory.unresolvedHooks.push(hook);
  }
}

export function resolveHook(hook: string): void {
  longTermMemory.unresolvedHooks = longTermMemory.unresolvedHooks.filter(h => h !== hook);
}

export function addGameFlag(flag: string): void {
  if (!gameFlags.includes(flag)) {
    gameFlags.push(flag);
  }
}

// ========== Locked facts validation ==========

/** Relationship words that are mutually exclusive as role assignments */
const RELATION_WORDS = new Set([
  '妹妹', '姐姐', '哥哥', '弟弟', '妻子', '丈夫', '老公', '女儿', '儿子',
  '朋友', '同伴', '恋人', '母亲', '父亲', '爸爸', '妈妈', '未婚妻', '未婚夫',
  '女友', '男友', '前妻', '前夫', '养女', '养子', '继母', '继父',
]);

/** Extract potential entity names from a fact string (2-4 Chinese chars, likely proper nouns) */
function extractEntityNames(fact: string): string[] {
  // Match quoted names or known patterns
  const quoted = fact.match(/[「「]([^」」]+)[」」]/g) || [];
  const names = quoted.map(q => q.replace(/[「「」」]/g, ''));
  // Also try to find unquoted multi-char Chinese names (heuristic)
  const unquoted = fact.match(/(?:[一-鿿]{2,4})(?:是|的|为|和|与|跟|被|把|向|对|给|从)/g) || [];
  for (const m of unquoted) {
    const name = m.replace(/[的是为和与跟被把向对给从]/g, '');
    if (name.length >= 2 && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Extract relationship word from a fact, if any */
function extractRelationWord(fact: string): string | null {
  for (const word of RELATION_WORDS) {
    if (fact.includes(word)) return word;
  }
  return null;
}

/**
 * Validate new facts against locked story facts.
 * A new fact is rejected only when:
 * 1. It shares at least one entity name with a locked fact
 * 2. Both contain relationship words from RELATION_WORDS
 * 3. The relationship words are different (mutually exclusive)
 *
 * Returns: { accepted: string[], rejected: string[] }
 */
export function validateAgainstLockedFacts(
  lockedFacts: string[],
  newFacts: string[],
): { accepted: string[]; rejected: string[] } {
  if (!lockedFacts.length) return { accepted: newFacts, rejected: [] };

  const accepted: string[] = [];
  const rejected: string[] = [];

  for (const newFact of newFacts) {
    const newEntities = extractEntityNames(newFact);
    const newRel = extractRelationWord(newFact);

    if (!newRel || newEntities.length === 0) {
      accepted.push(newFact);
      continue;
    }

    let conflict = false;
    for (const locked of lockedFacts) {
      const lockedEntities = extractEntityNames(locked);
      const lockedRel = extractRelationWord(locked);

      if (!lockedRel) continue;

      // Check if they share at least one entity name
      const sharedEntity = newEntities.some(ne =>
        lockedEntities.some(le => le === ne),
      );
      if (!sharedEntity) continue;

      // Both have relationship words → check if they conflict
      if (newRel !== lockedRel) {
        conflict = true;
        break;
      }
    }

    if (conflict) {
      rejected.push(newFact);
    } else {
      accepted.push(newFact);
    }
  }

  return { accepted, rejected };
}
