import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getLocationById } from '../data/regions';
import ShopPanel from './ShopPanel';

export default function FixedActions() {
  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);
  const isProcessing = useGameStore(s => s.isProcessing);
  const combatActive = useGameStore(s => s.worldState.combatState.active);
  const restAtLocation = useGameStore(s => s.restAtLocation);
  const [showShop, setShowShop] = useState(false);

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

  const doAction = (text: string) => {
    const store = useGameStore.getState();
    store.submitAction('custom', text);
  };

  return (
    <>
      <div className="flex flex-wrap gap-1 lg:gap-2 px-2 lg:px-6 py-2 lg:py-3 border-t border-[var(--color-tavern-border)] flex-shrink-0">
        <button className="btn text-xs lg:text-sm px-2 lg:px-3 py-1.5" onClick={() => doAction('探索当前所在的区域，看看周围有什么。')}>
          探索
        </button>
        <button className="btn text-xs lg:text-sm px-2 lg:px-3 py-1.5" onClick={() => doAction('尝试和附近的人交谈，打听消息。')}>
          交谈
        </button>
        <button className="btn text-xs lg:text-sm px-2 lg:px-3 py-1.5" onClick={() => doAction('仔细观察周围的细节，寻找线索或可疑之处。')}>
          调查
        </button>
        <button className="btn text-xs lg:text-sm px-2 lg:px-3 py-1.5" onClick={handleRest} title={isSafe ? '全额恢复HP/MP（需花费钱币）' : isWild ? `野外休息(剩余${wildRestRemaining}次)` : '少量恢复'}>
          休息{isSafe ? '(全额)' : isWild ? `(${wildRestRemaining})` : ''}
        </button>
        {(locType === 'shop' || locType === 'tavern' || worldState.currentLocation.includes('market')) && (
          <button className="btn text-xs lg:text-sm px-2 lg:px-3 py-1.5" onClick={() => setShowShop(!showShop)}>
            商店
          </button>
        )}
      </div>
      {showShop && <ShopPanel onClose={() => setShowShop(false)} />}
    </>
  );
}
