// ========== Money ==========
export interface Money {
  gold: number;
  silver: number;
  copper: number;
}

export function formatMoney(m: Money): string {
  const parts: string[] = [];
  if (m.gold > 0) parts.push(`${m.gold} 金`);
  if (m.silver > 0) parts.push(`${m.silver} 银`);
  if (m.copper > 0 || parts.length === 0) parts.push(`${m.copper} 铜`);
  return parts.join(' ');
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
export type Weather = '晴' | '多云' | '阴' | '雾' | '小雨' | '雨' | '雪' | '暴风雨';

export const TIME_NAMES: TimeOfDay[] = ['清晨', '上午', '中午', '下午', '傍晚', '夜晚', '深夜'];
export const WEATHER_NAMES: Weather[] = ['晴', '多云', '阴', '雾', '小雨', '雨', '雪', '暴风雨'];

const TIME_ORDER: TimeOfDay[] = ['清晨', '上午', '中午', '下午', '傍晚', '夜晚', '深夜'];
const WEATHER_CYCLE: Weather[] = ['晴', '多云', '阴', '小雨', '雾', '雨', '雪', '暴风雨'];

/** Normalize AI-returned weather string to Weather type */
export function normalizeWeather(raw: string, fallback: Weather): Weather {
  const r = raw.trim();
  const map: Record<string, Weather> = {
    '晴': '晴', '晴天': '晴', '晴朗': '晴', '晴空': '晴',
    '多云': '多云', '阴天': '阴', '阴': '阴', '乌云': '阴', '昏暗': '阴',
    '雾': '雾', '大雾': '雾', '薄雾': '雾', '浓雾': '雾',
    '小雨': '小雨', '毛毛雨': '小雨', '细雨': '小雨',
    '雨': '雨', '下雨': '雨', '大雨': '雨', '暴雨': '暴风雨',
    '雪': '雪', '小雪': '雪', '大雪': '雪',
    '暴风雨': '暴风雨', '暴风': '暴风雨', '雷雨': '暴风雨',
    'clear': '晴', 'cloudy': '多云', 'overcast': '阴',
    'fog': '雾', 'mist': '雾', 'drizzle': '小雨', 'rain': '雨',
    'snow': '雪', 'storm': '暴风雨', 'heavy rain': '雨',
  };
  return map[r] || map[r.replace(/的|了|了/g, '')] || fallback;
}

/** Normalize AI-returned time string to TimeOfDay type */
export function normalizeTimeOfDay(raw: string, fallback: TimeOfDay): TimeOfDay {
  const r = raw.trim();
  const map: Record<string, TimeOfDay> = {
    '清晨': '清晨', '早晨': '清晨', '早上': '清晨', '日出': '清晨', '拂晓': '清晨', '黎明': '清晨',
    '上午': '上午',
    '中午': '中午', '正午': '中午', '午时': '中午',
    '下午': '下午',
    '傍晚': '傍晚', '黄昏': '傍晚', '日落': '傍晚', '暮色': '傍晚',
    '夜晚': '夜晚', '晚上': '夜晚', '夜里': '夜晚',
    '深夜': '深夜', '午夜': '深夜', '半夜': '深夜', '子时': '深夜', '凌晨': '深夜',
    'morning': '上午', 'noon': '中午', 'afternoon': '下午',
    'evening': '傍晚', 'night': '夜晚', 'midnight': '深夜',
  };
  // Try exact match first
  if (map[r]) return map[r];
  // Try to find any known token inside the raw string
  for (const [key, val] of Object.entries(map)) {
    if (r.includes(key)) return val;
  }
  return fallback;
}

/** Advance time by one step when AI returns vague time like "稍后" */
export function advanceTime(current: TimeOfDay): TimeOfDay {
  const idx = TIME_ORDER.indexOf(current);
  if (idx < 0 || idx >= TIME_ORDER.length - 1) return current;
  return TIME_ORDER[idx + 1];
}

/** Get next weather in cycle (for rotation when AI repeats too much) */
export function nextWeatherInCycle(current: Weather): Weather {
  const idx = WEATHER_CYCLE.indexOf(current);
  if (idx < 0 || idx >= WEATHER_CYCLE.length - 1) return WEATHER_CYCLE[0];
  return WEATHER_CYCLE[idx + 1];
}

// ========== World State ==========
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
  combatState: import('./combat').CombatState;
  lockedStoryFacts: string[];
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
    combatState: { active: false, phase: 'fighting', round: 0, turn: 'player', enemies: [], playerBuffs: [], combatLog: [] },
    lockedStoryFacts: [],
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
