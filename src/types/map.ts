// ========== Map Types ==========

export type RegionStatus = 'discovered' | 'undiscovered' | 'rumored';
export type LocationType = 'tavern' | 'shop' | 'temple' | 'wilderness' | 'dungeon' | 'city' | 'port' | 'camp' | 'ruins' | 'other';
export type ConnectionType = 'land' | 'sea' | 'underground' | 'portal';

export interface UnlockCondition {
  type: 'level' | 'quest' | 'faction' | 'item' | 'flag' | 'connection';
  minLevel?: number;
  questId?: string;
  factionId?: string;
  minStanding?: number;
  itemId?: string;
  flag?: string;
  connectionId?: string;
}

export interface Region {
  id: string;
  name: string;
  description: string;
  dangerLevel: number;        // 1-20
  recommendedLevel: number;
  currentSituation?: string;
  unlockCondition?: UnlockCondition;
}

export interface Subregion {
  id: string;
  regionId: string;
  name: string;
  description: string;
  dangerLevel: number;
  recommendedLevel: number;
  unlockCondition?: UnlockCondition;
}

export interface Location {
  id: string;
  subregionId: string;
  name: string;
  type: LocationType;
  description: string;
  dangerLevel: number;
  unlockCondition?: UnlockCondition;
}

export interface Connection {
  id: string;
  fromId: string;       // subregion or location id
  toId: string;
  type: ConnectionType;
  name: string;
  description: string;
  requirements?: UnlockCondition;
}
