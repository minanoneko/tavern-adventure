// ========== Log Types ==========
export type LogType = 'narrative' | 'combat' | 'quest' | 'item' | 'relationship' | 'world' | 'system' | 'judge';

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  narrative: '剧情',
  combat: '战斗',
  quest: '任务',
  item: '物品',
  relationship: '关系',
  world: '世界',
  system: '系统',
  judge: '判定',
};

export interface LogEntry {
  id: string;
  timestamp: string;    // ISO
  type: LogType;
  text: string;
  details?: string;
  relatedId?: string;   // quest id, item id, etc.
}

export function createLogEntry(type: LogType, text: string, details?: string, relatedId?: string): LogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type,
    text,
    details,
    relatedId,
  };
}
