import type { Skill } from './skill';

// ========== Combat State ==========
export interface CombatState {
  active: boolean;
  phase: CombatPhase;
  round: number;
  turn: 'player' | 'enemy' | 'resolution';
  enemies: CombatEnemyState[];
  playerBuffs: CombatBuff[];
  combatLog: CombatLogEntry[];
  /** The original AI proposal that started combat */
  combatStart?: CombatStartProposal;
}

export type CombatPhase = 'fighting' | 'victory' | 'defeat' | 'fled';

// ========== Combat Enemy ==========
/** AI can propose this, local enemyFactory validates and fills in the rest */
export interface CombatStartProposal {
  enemies: EnemyProposal[];
  reason: string;
  location: string;
  isBoss?: boolean;
  questFlag?: string;
  bossFlag?: string;
}

export interface EnemyProposal {
  name: string;
  type: string;
  description?: string;
  suggestedLevel?: number;
  suggestedStr?: number;
  suggestedDex?: number;
  suggestedCon?: number;
  suggestedHp?: number;
}

/** Full enemy runtime state after local validation */
export interface CombatEnemyState {
  id: string;
  name: string;
  type: string;
  level: number;
  str: number;
  dex: number;
  con: number;
  hp: number;
  maxHp: number;
  statusEffects: string[];
  isBoss: boolean;
  isDefeated: boolean;
  description?: string;
}

// ========== Combat Actions ==========
export interface CombatAction {
  type: CombatActionType;
  label: string;
  /** Skill id if type is 'skill' */
  skillId?: string;
  /** Item id if type is 'item' */
  itemId?: string;
  /** Which enemy this targets */
  targetEnemyId?: string;
  /** Player flavor text (custom input in combat) */
  flavorText?: string;
  /** Special action subtype */
  specialType?: CombatSpecialType;
  /** Attribute for CHECK roll */
  checkAttribute?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  /** DC for CHECK roll */
  difficultyClass?: number;
  /** Reason shown in combat log */
  checkReason?: string;
}

export type CombatActionType = 'attack' | 'skill' | 'item' | 'defend' | 'flee' | 'observe' | 'special';
export type CombatSpecialType = 'call_help' | 'summon' | 'taunt' | 'distract' | 'negotiate' | 'use_environment';

// ========== Combat Resolution ==========
export interface CombatResolution {
  action: CombatAction;
  /** Whether the action succeeded (hit landed) */
  hit: boolean;
  /** Roll result (hit total) */
  roll: number;
  /** Damage dealt (0 if missed) */
  damage: number;
  /** Enemy state after resolution */
  targetEnemy: CombatEnemyState;
  /** Player HP/MP change from this action */
  playerHpChange: number;
  playerMpChange: number;
  /** Status effects applied */
  appliedEffects: string[];
  /** Log messages */
  results: string[];
  /** Raw d20 roll */
  hitRoll?: number;
  /** d20 + modifier */
  hitTotal?: number;
  /** Target's AC */
  targetAC?: number;
  /** Raw weapon/skill dice roll */
  damageRoll?: number;
  /** Attribute modifier added to damage */
  damageModifier?: number;
  /** Human-readable damage breakdown e.g. "短剑 1d6=4 + 力量1" */
  damageDetail?: string;
}

// ========== Combat Log ==========
export interface CombatLogEntry {
  id: string;
  timestamp: string;
  type: 'action' | 'enemy' | 'system' | 'narrative' | 'reward';
  text: string;
  round: number;
}

// ========== Combat Buffs / Temp Effects ==========
export interface CombatBuff {
  id: string;
  name: string;
  type: 'defense' | 'attack' | 'speed' | 'shield' | 'dot' | 'hot';
  value: number;
  duration: number; // rounds remaining
  source: string; // skillId or effectId
}

// ========== Combat Skill (subset of Skill relevant to combat) ==========
export interface CombatSkillInfo {
  skillId: string;
  name: string;
  mpCost: number;
  hpCost: number;
  damageMultiplier: number;
  description: string;
  requiresWeaponType?: string;
  requiresEquipment?: string;
  requiresItem?: string;
  oncePerRest?: boolean;
  cooldownRounds?: number;
  currentCooldown: number;
}

// ========== Combat Rewards ==========
export interface CombatRewards {
  exp: number;
  money: { gold: number; silver: number; copper: number };
  items: CombatDropItem[];
}

export interface CombatDropItem {
  id: string;
  name: string;
  quantity: number;
  type: string;
  rarity: string;
}
