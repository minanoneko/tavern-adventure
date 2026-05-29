import { useGameStore } from '../store/gameStore';
import { getLocationById } from '../data/regions';

export default function FixedActions() {
  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);
  const isProcessing = useGameStore(s => s.isProcessing);
  const combatActive = useGameStore(s => s.worldState.combatState.active);
  const restAtLocation = useGameStore(s => s.restAtLocation);

  if (!player || combatActive || isProcessing) return null;

  // Determine if current location is safe
  const loc = getLocationById(worldState.currentLocation);
  const locType = loc?.type || '';
  const isSafe = ['tavern', 'inn', 'temple'].includes(locType) ||
    worldState.currentLocation.includes('inn') ||
    worldState.currentLocation.includes('tavern') ||
    worldState.currentLocation.includes('chapel') ||
    worldState.currentLocation.includes('guild');
  const isWild = ['wilderness', 'dungeon', 'forest', 'road', 'mine'].includes(locType) ||
    worldState.currentLocation.includes('forest') ||
    worldState.currentLocation.includes('mine') ||
    worldState.currentLocation.includes('road');

  // Wilderness rest limit: 2 per timeOfDay cycle
  const wildRestRemaining = 2 - (worldState.wildernessRestUsed || 0);

  const handleRest = () => {
    if (isSafe) {
      restAtLocation();
    } else if (isWild) {
      if (wildRestRemaining <= 0) {
        alert('今天已在野外休息了2次，需要等到明天清晨才能再次休息。');
        return;
      }
      restAtLocation();
    } else {
      restAtLocation(); // town/market — partial rest
    }
  };

  return (
    <div className="flex flex-wrap gap-2 px-6 py-3 border-t border-[var(--color-tavern-border)] flex-shrink-0">
      <button className="btn text-sm px-3" onClick={() => useGameStore.getState().submitAction('explore_location')}>
        探索
      </button>
      <button className="btn text-sm px-3" onClick={() => useGameStore.getState().submitAction('talk_npc')}>
        交谈
      </button>
      <button className="btn text-sm px-3" onClick={() => useGameStore.getState().submitAction('investigate_area')}>
        调查
      </button>
      <button className="btn text-sm px-3" onClick={handleRest} title={isSafe ? '全额恢复HP/MP（需花费钱币）' : isWild ? `野外休息(剩余${wildRestRemaining}次)` : '少量恢复'}>
        休息{isSafe ? '(安全)' : isWild ? `(${wildRestRemaining})` : ''}
      </button>
      {(locType === 'shop' || locType === 'tavern' || worldState.currentLocation.includes('market')) && (
        <button className="btn text-sm px-3" onClick={() => useGameStore.getState().submitAction('open_shop')}>
          商店
        </button>
      )}
    </div>
  );
}
