import { useGameStore } from '../store/gameStore';
import { formatMoney } from '../types/common';
import { getLocationById } from '../data/regions';

export default function StatusBar({ onSettingsClick }: { onSettingsClick: () => void }) {
  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);

  if (!player) return null;

  const locationName = worldState.currentLocationName || getLocationById(worldState.currentLocation)?.name || worldState.currentLocation;
  const hpPct = (player.resources.hp / player.resources.maxHp) * 100;
  const mpPct = (player.resources.mp / player.resources.maxMp) * 100;
  const expPct = (player.exp / player.nextExp) * 100;

  return (
    <div className="flex items-center gap-2 lg:gap-4 px-2 lg:px-4 py-1 lg:py-2 panel" style={{ borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>

      {/* Mobile compact rows */}
      <div className="flex lg:hidden flex-col w-full gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--color-tavern-accent)' }}>{player.name}</span>
          <span className="text-xs text-muted">Lv.{player.level}</span>
          <span className="text-xs text-muted flex-1 min-w-0 truncate">{locationName}</span>
          <span className="text-xs flex-shrink-0">{formatMoney(player.money)}</span>
          <button className="btn text-xs px-2 py-1 flex-shrink-0" onClick={onSettingsClick}>设置</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs text-danger">HP</span>
            <div className="flex-1 bar-bg h-1.5">
              <div className="bar-hp" style={{ width: `${hpPct}%` }} />
            </div>
            <span className="text-xs w-12 text-right">{player.resources.hp}/{player.resources.maxHp}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs text-info">MP</span>
            <div className="flex-1 bar-bg h-1.5">
              <div className="bar-mp" style={{ width: `${mpPct}%` }} />
            </div>
            <span className="text-xs w-12 text-right">{player.resources.mp}/{player.resources.maxMp}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs" style={{ color: 'var(--color-tavern-exp)' }}>EXP</span>
            <div className="flex-1 bar-bg h-1.5">
              <div className="bar-exp" style={{ width: `${expPct}%` }} />
            </div>
            <span className="text-xs w-12 text-right">{player.exp}/{player.nextExp}</span>
          </div>
        </div>
      </div>

      {/* Desktop full row */}
      <div className="hidden lg:flex items-center gap-4 w-full">
      {/* Name & Info */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-bold" style={{ color: 'var(--color-tavern-accent)' }}>{player.name}</span>
        <span className="text-xs text-muted">{player.classOrigin}</span>
        <span className="text-sm" style={{ color: 'var(--color-tavern-accent)' }}>Lv.{player.level}</span>
      </div>

      <div className="w-px h-6 bg-[var(--color-tavern-border)]" />

      {/* HP */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '150px' }}>
        <span className="text-sm text-danger font-bold w-6">HP</span>
        <div className="flex-1 bar-bg">
          <div className="bar-hp" style={{ width: `${hpPct}%` }} />
        </div>
        <span className="text-sm w-18 text-right">{player.resources.hp}/{player.resources.maxHp}</span>
      </div>

      {/* MP */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '150px' }}>
        <span className="text-sm text-info font-bold w-6">MP</span>
        <div className="flex-1 bar-bg">
          <div className="bar-mp" style={{ width: `${mpPct}%` }} />
        </div>
        <span className="text-sm w-18 text-right">{player.resources.mp}/{player.resources.maxMp}</span>
      </div>

      {/* EXP */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '130px' }}>
        <span className="text-sm font-bold w-8" style={{ color: 'var(--color-tavern-exp)' }}>EXP</span>
        <div className="flex-1 bar-bg">
          <div className="bar-exp" style={{ width: `${expPct}%` }} />
        </div>
        <span className="text-sm w-16 text-right">{player.exp}/{player.nextExp}</span>
      </div>

      <div className="w-px h-6 bg-[var(--color-tavern-border)]" />

      {/* Money */}
      <span className="text-sm flex-shrink-0">{formatMoney(player.money)}</span>

      <div className="flex-1" />

      <span className="text-sm text-muted flex-shrink-0">{locationName}</span>
      <span className="text-sm text-muted flex-shrink-0">{worldState.date}</span>
      <span className="text-sm text-muted flex-shrink-0">{worldState.timeOfDay}</span>
      <span className="text-sm text-muted flex-shrink-0">{worldState.weather}</span>

      <button className="btn text-sm px-2 py-1" onClick={onSettingsClick}>⚙</button>
      </div>{/* end desktop row */}
    </div>
  );
}
