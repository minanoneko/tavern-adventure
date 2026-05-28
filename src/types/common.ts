// ========== Money ==========
export interface Money {
  gold: number;
  silver: number;
  copper: number;
}

export function copperValue(m: Money): number {
  return m.gold * 10000 + m.silver * 100 + m.copper;
}

export function formatMoney(m: Money): string {
  const parts: string[] = [];
  if (m.gold > 0) parts.push(`${m.gold} 金`);
  if (m.silver > 0) parts.push(`${m.silver} 银`);
  if (m.copper > 0 || parts.length === 0) parts.push(`${m.copper} 铜`);
  return parts.join(' ');
}

export function addMoney(a: Money, b: { gold?: number; silver?: number; copper?: number }): Money {
  let total = copperValue(a) + (b.gold ?? 0) * 10000 + (b.silver ?? 0) * 100 + (b.copper ?? 0);
  const gold = Math.floor(total / 10000);
  total -= gold * 10000;
  const silver = Math.floor(total / 100);
  total -= silver * 100;
  return { gold, silver, copper: total };
}

export const EMPTY_MONEY: Money = { gold: 0, silver: 0, copper: 0 };

// ========== Attributes ==========
export interface Attributes {
  str: number; // 力量
  dex: number; // 敏捷
  con: number; // 体质
  int: number; // 智力
  wis: number; // 感知
  cha: number; // 魅力
}

export type AttributeKey = keyof Attributes;

export const ATTRIBUTE_KEYS: AttributeKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力',
};

export const DEFAULT_ATTRIBUTES: Attributes = { str: 4, dex: 4, con: 4, int: 4, wis: 4, cha: 4 };

// ========== Resources ==========
export interface Resources {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

// ========== Time & Weather ==========
export type TimeOfDay = '清晨' | '上午' | '中午' | '下午' | '傍晚' | '夜晚' | '深夜';
export type Weather = '晴' | '雨' | '雾' | '雪' | '暴风雨';

export const TIME_NAMES: TimeOfDay[] = ['清晨', '上午', '中午', '下午', '傍晚', '夜晚', '深夜'];
export const WEATHER_NAMES: Weather[] = ['晴', '雨', '雾', '雪', '暴风雨'];

// ========== World State ==========
export interface CombatState {
  active: boolean;
  enemy?: import('./ai').CombatEnemy;
}

export interface GeneratedLocation {
  id: string;
  name: string;
  type: 'story_location';
  discovered: boolean;
  createdAt: string;
}

export interface WorldState {
  currentLocation: string;
  currentLocationName?: string;
  generatedLocations: Record<string, GeneratedLocation>;
  date: string;
  timeOfDay: TimeOfDay;
  weather: Weather;
  discoveredRegions: string[];
  discoveredLocations: string[];
  unlockedRoutes: string[];
  factionStandings: Record<string, number>;
  worldFlags: string[];
  activeRumors: string[];
  combatState: CombatState;
}

export function createDefaultWorldState(): WorldState {
  return {
    currentLocation: 'gray_deer_tavern',
    currentLocationName: '灰鹿酒馆',
    generatedLocations: {},
    date: '雾月3日',
    timeOfDay: '夜晚',
    weather: '雨',
    discoveredRegions: ['human_federation'],
    discoveredLocations: ['gray_deer_tavern'],
    unlockedRoutes: [],
    factionStandings: {
      adventurers_guild: 0,
      church: 0,
      city_guard: 0,
      black_market: 0,
      merchant_guild: 0,
      forest_wanderers: 0,
      mage_association: 0,
      nobility: 0,
      old_kingdom_remnants: 0,
      elf_forest: 0,
      dark_elves: 0,
      dragon_blood_clan: 0,
    },
    worldFlags: [],
    activeRumors: [],
    combatState: { active: false },
  };
}

// ========== Status Effects ==========
export type StatusEffect =
  | '正常'
  | '轻伤'
  | '重伤'
  | '中毒'
  | '疲劳'
  | '饥饿'
  | '沉默'
  | '束缚'
  | '诅咒'
  | '祝福'
  | '鼓舞'
  | '恐惧'
  | '隐匿'
  | '流血'
  | '魔力过载';

// ========== Game Settings ==========
export interface GameSettings {
  debugMode: boolean;
}

// ========== Relationship Level ==========
export type RelationLevel = '敌对' | '冷淡' | '中立' | '熟悉' | '友善' | '信任' | '崇敬';

// ========== Helpers ==========
export function clampResource(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}
