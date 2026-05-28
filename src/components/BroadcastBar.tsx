import { useGameStore } from '../store/gameStore';
import { useEffect, useRef } from 'react';

export default function BroadcastBar() {
  const worldState = useGameStore(s => s.worldState);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get the 2 most recent rumors
  const recentRumors = worldState.activeRumors.slice(-2);

  return (
    <div className="panel border-t" style={{ borderRadius: 0, height: '28px', overflow: 'hidden' }}>
      <div className="flex items-center h-full px-3">
        <span className="text-xs text-muted flex-shrink-0 mr-2">世界播报</span>
        <div className="flex-1 overflow-hidden relative">
          {recentRumors.length > 0 ? (
            <div className="text-xs whitespace-nowrap" style={{ animation: 'scroll-left 20s linear infinite' }}>
              {recentRumors.map((rumor, i) => (
                <span key={i} className="mr-8">{rumor}</span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted">世界暂时平静无事...</span>
          )}
        </div>
        <span className="text-xs text-muted flex-shrink-0 ml-2">
          Flags: {worldState.worldFlags.length}
        </span>
      </div>
      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
