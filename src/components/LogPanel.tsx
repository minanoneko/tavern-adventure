import { useGameStore } from '../store/gameStore';
import { LOG_TYPE_LABELS, type LogType } from '../types/log';
import { useState } from 'react';

const LOG_FILTERS: Array<LogType | '全部'> = ['全部', 'narrative', 'combat', 'quest', 'item', 'world', 'system', 'judge'];

export default function LogPanel() {
  const logs = useGameStore(s => s.logs);
  const [filter, setFilter] = useState<LogType | '全部'>('全部');

  const filtered = filter === '全部' ? logs : logs.filter(l => l.type === filter);

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap gap-0.5 p-2 border-b border-[var(--color-tavern-border)]">
        {LOG_FILTERS.map(f => (
          <button
            key={f}
            className={`text-sm px-2 py-1 rounded ${filter === f ? 'btn-primary' : 'btn'}`}
            onClick={() => setFilter(f)}
          >
            {f === '全部' ? '全部' : LOG_TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-px">
        {filtered.length === 0 ? (
          <div className="text-sm text-muted p-3">暂无日志记录。</div>
        ) : (
          filtered.slice().reverse().map(log => (
            <div key={log.id} className="text-sm p-1.5 border-b border-[var(--color-tavern-bg)]">
              <span className="text-xs text-muted">
                {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`ml-2 px-1 text-xs ${log.type === 'combat' ? 'text-danger' : log.type === 'quest' ? 'text-info' : log.type === 'system' ? 'text-muted' : log.type === 'world' ? 'text-info' : ''}`}>
                [{LOG_TYPE_LABELS[log.type] || log.type}]
              </span>
              <span className="ml-1">{log.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
