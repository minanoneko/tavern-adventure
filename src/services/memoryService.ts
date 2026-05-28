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

  // Completed quests
  const completed = player.quests.filter(q => q.status === 'completed').map(q => q.name);
  if (completed.length > 0) {
    s.completedQuests = [...new Set([...s.completedQuests, ...completed])].slice(-10);
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
  const sorted = [...logs].sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.type);
    const bIdx = priorityOrder.indexOf(b.type);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  return sorted.slice(-limit);
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

  // Quest updates
  for (const qu of event.questUpdate) {
    const fact = qu.status === 'active'
      ? `接受任务: ${qu.name}`
      : qu.status === 'completed'
        ? `完成任务: ${qu.name}`
        : null;
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
