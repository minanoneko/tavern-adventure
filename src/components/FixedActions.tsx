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

  // Determine if current location is safe / has shop
  const loc = getLocationById(worldState.currentLocation);
  const locType = loc?.type || '';
  const hasShop = locType === 'shop' || locType === 'tavern' ||
    (worldState.currentLocation || '').includes('market') ||
    (worldState.currentLocation || '').includes('shop') ||
    (worldState.currentLocation || '').includes('tavern') ||
    (worldState.currentLocation || '').includes('inn') ||
    (worldState.currentLocation || '').includes('store') ||
    (worldState.currentLocationName || '').includes('商店') ||
    (worldState.currentLocationName || '').includes('店') ||
    (worldState.currentLocationName || '').includes('酒馆') ||
    (worldState.currentLocationName || '').includes('旅店') ||
    (worldState.currentLocationName || '').includes('市场') ||
    (worldState.currentLocationName || '').includes('集市');
  const locId = worldState.currentLocation || '';
  const locName = worldState.currentLocationName || '';
  const isSafe = ['tavern', 'temple'].includes(locType as string) ||
    locId.includes('inn') || locId.includes('tavern') || locId.includes('chapel') || locId.includes('guild') ||
    locName.includes('酒馆') || locName.includes('旅店') || locName.includes('礼拜堂');
  const isWild = ['wilderness', 'dungeon'].includes(locType as string) ||
    locId.includes('forest') || locId.includes('mine') || locId.includes('road');

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

  const exploreText = isWild
    ? '警惕地探索周围，寻找是否有敌人或危险的迹象，随时准备战斗。'
    : '探索当前所在的区域，看看周围有什么。';

  return (
    <>
      <div className="flex flex-wrap gap-1 lg:gap-2 px-2 lg:px-6 py-2 lg:py-3 border-t border-[var(--color-tavern-border)] flex-shrink-0">
        <button className="btn text-xs lg:text-sm px-2 lg:px-3 py-1.5" onClick={() => doAction(exploreText)}>
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
        {hasShop && (
          <button className="btn text-xs lg:text-sm px-2 lg:px-3 py-1.5" onClick={() => setShowShop(!showShop)}>
            商店
          </button>
        )}
      </div>
      {showShop && <ShopPanel onClose={() => setShowShop(false)} />}
    </>
  );
}
