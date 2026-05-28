import { useGameStore } from '../store/gameStore';
import { REGIONS, SUBREGIONS, LOCATIONS, CONNECTIONS, getSubregionsByRegion, getLocationsBySubregion } from '../data/regions';
import { useState } from 'react';

const LOCATION_TYPE_LABELS: Record<string, string> = {
  tavern: '酒馆', shop: '商店', temple: '神殿', wilderness: '野外',
  dungeon: '地下城', city: '城市', port: '港口', camp: '营地', ruins: '遗迹', other: '其他',
};

export default function WorldMapPanel() {
  const worldState = useGameStore(s => s.worldState);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

  const getRegionStatus = (regionId: string) => {
    if (worldState.discoveredRegions.includes(regionId)) return '已发现';
    return '未发现';
  };

  const getLocationStatus = (locationId: string) => {
    if (worldState.discoveredLocations.includes(locationId)) return '✓';
    return '';
  };

  return (
    <div className="p-3">
      <div className="text-sm text-muted mb-3">
        已发现 {worldState.discoveredLocations.length} 个地点
      </div>

      <div className="space-y-1">
        {REGIONS.map(region => {
          const status = getRegionStatus(region.id);
          const subregions = getSubregionsByRegion(region.id);
          const isExpanded = expandedRegion === region.id;
          const discovered = status === '已发现';

          return (
            <div key={region.id}>
              <button
                className="w-full text-left panel p-2 text-sm flex items-center justify-between"
                onClick={() => setExpandedRegion(isExpanded ? null : region.id)}
              >
                <span>
                  <span style={{ color: discovered ? 'var(--color-tavern-accent)' : 'var(--color-tavern-muted)' }}>
                    {region.name}
                  </span>
                  <span className="text-muted text-xs ml-1">Lv.{region.recommendedLevel}+</span>
                </span>
                <span className={`tag text-xs ${discovered ? '' : 'tag-cursed'}`}>{status}</span>
              </button>

              {isExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  <div className="text-xs text-muted mb-1">{region.description}</div>
                  {region.unlockCondition && !discovered && (
                    <div className="text-xs mb-1" style={{ color: 'var(--color-tavern-accent)' }}>
                      解锁：{region.unlockCondition.type === 'level' ? `等级≥${region.unlockCondition.minLevel}` : region.unlockCondition.type === 'faction' ? `阵营好感≥${region.unlockCondition.minStanding}` : '事件触发'}
                    </div>
                  )}
                  {subregions.map(sub => {
                    const locations = getLocationsBySubregion(sub.id);
                    return (
                      <div key={sub.id} className="ml-2">
                        <div className="text-xs text-muted">{sub.name}</div>
                        {locations.map(loc => (
                          <div key={loc.id} className="ml-2 text-sm flex items-center gap-1.5 py-0.5">
                            <span className="text-xs w-4">{getLocationStatus(loc.id)}</span>
                            <span>{loc.name}</span>
                            <span className="text-xs text-muted">{LOCATION_TYPE_LABELS[loc.type] || loc.type}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
