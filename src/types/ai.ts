import type { Attributes, Money, StatusEffect } from './common';
import type { QuestStatus } from './quest';

// ========== Scene & Event ==========
export interface Scene {
  title: string;
  text: string;
  location: string;
  locationId?: string;   // syncs worldState.currentLocation
  time: string;
  weather: string;
}

export interface AIEvent {
  id: string;
  type: string;
  urgency: 'low' | 'normal' | 'high';
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

// ========== System Events ==========
export interface SystemEvent {
  type: 'check' | 'info' | 'reward' | 'penalty' | 'warning';
  text: string;
}

// ========== Action Options ==========
export interface ActionOption {
  id: string;
  label: string;
  type: string;
  risk: 'low' | 'medium' | 'high' | 'extreme';
  relatedAttribute?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'none';
  relatedSkill?: string | null;
  mpCost?: number;
  difficultyPreview?: string;
  intent?: string;
  contextNote?: string;
  targetEntityId?: string;
  relatedEntityIds?: string[];
  relatedEntityNames?: string[];
  continuesScene?: boolean;
  allowsTransition?: boolean;
  requiresCheck?: boolean;
  checkReason?: string;
  checkAttribute?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  checkSkill?: string;
  difficultyClass?: number;
  failureConsequence?: string;
  moneyCost?: { gold?: number; silver?: number; copper?: number };
  moneyReward?: { gold?: number; silver?: number; copper?: number };
}

/** Structured action context sent to AI alongside the player action */
export interface SelectedActionContext {
  id: string;
  label: string;
  intent: string;
  contextNote: string;
  type: string;
  targetEntityId?: string;
  relatedEntityIds?: string[];
  relatedEntityNames?: string[];
  continuesScene?: boolean;
  allowsTransition?: boolean;
}

// ========== Updates ==========
export interface PlayerUpdate {
  hpChange: number;
  mpChange: number;
  expChange: number;
  moneyChange: { gold?: number; silver?: number; copper?: number };
  statusEffectAdd?: StatusEffect[];
  statusEffectRemove?: StatusEffect[];
  attributeChanges?: Partial<Attributes>;
}

export interface InventoryUpdate {
  action: 'add' | 'remove' | 'modify';
  itemId: string;
  name: string;
  quantity: number;
  type?: string;
  description?: string;
  rarity?: string;
}

export interface QuestUpdate {
  id: string;
  name: string;
  status: QuestStatus;
  description?: string;
  giver?: string;
  objectives?: { id: string; description: string; completed?: boolean }[];
  rewards?: {
    exp?: number;
    money?: { gold?: number; silver?: number; copper?: number };
    items?: string[];
    skills?: string[];
  };
}

export interface SkillStateUpdate {
  skillId: string;
  action: 'learn' | 'discover' | 'upgrade' | 'lock';
  name?: string;
  reason?: string;
}

export interface EquipmentUpdate {
  action: 'add' | 'remove' | 'equip' | 'unequip';
  itemId: string;
  slot?: string;
  name?: string;
}

export interface RelationshipUpdate {
  targetId: string;
  name: string;
  change: number;
  reason: string;
  type?: 'npc' | 'faction';
  race?: string;
  occupation?: string;
  description?: string;
}

export interface MapUpdate {
  targetId: string;
  targetType: 'region' | 'subregion' | 'location' | 'connection';
  name?: string;
  status?: 'discovered' | 'rumored' | 'unlocked';
  unlockCondition?: string;
}

export interface WorldBroadcast {
  type: 'rumor' | 'important' | 'crisis' | 'faction' | 'economy' | 'quest' | 'hidden';
  region?: string;
  text: string;
}

export interface MemoryUpdate {
  flags: string[];
  currentLocation?: string;
  currentLocationId?: string;
  knownLocations?: string[];
  lockedFacts?: string[];
}

// ========== Combat Enemy ==========
export interface CombatEnemy {
  name: string;
  str: number;
  dex: number;
  con: number;
  hp: number;
  maxHp: number;
  level: number;
  description?: string;
  isBoss?: boolean;
}

// ========== AI Response ==========
export interface AIResponse {
  scene: Scene;
  event: AIEvent;
  systemEvents: SystemEvent[];
  actionOptions: ActionOption[];
  customActionEnabled: boolean;
  playerUpdate: PlayerUpdate;
  inventoryUpdate: InventoryUpdate[];
  questUpdate: QuestUpdate[];
  skillStateUpdate: SkillStateUpdate[];
  equipmentUpdate: EquipmentUpdate[];
  relationshipUpdate: RelationshipUpdate[];
  mapUpdate: MapUpdate[];
  worldBroadcasts: WorldBroadcast[];
  memoryUpdate: MemoryUpdate;
  enemy?: CombatEnemy;
  combatStart?: import('./combat').CombatStartProposal;
}

// ========== AI Result (after processing) ==========
export interface AIResult {
  success: boolean;
  response?: AIResponse;
  rawText?: string;
  validationErrors?: string[];
  error?: AIError;
}

export interface AIError {
  type: 'network' | 'cors' | 'http_error' | 'parse_error' | 'validation_error' | 'unknown';
  message: string;
  statusCode?: number;
  details?: string;
}

// ========== Judge System ==========
export type JudgeOutcome = '大成功' | '成功' | '部分成功' | '失败' | '大失败';
export type Difficulty = '简单' | '普通' | '困难' | '极难' | '几乎不可能';
export type Risk = 'low' | 'medium' | 'high' | 'extreme';

export interface JudgeResult {
  outcome: JudgeOutcome;
  roll: number;
  dc: number;
  modifier: number;
  relatedAttribute?: string;
  relatedSkill?: string;
  consumption?: {
    mp: number;
    hp: number;
  };
  notes: string;
}

// ========== Player Action ==========
export interface PlayerAction {
  id: string;
  label?: string;
  type: string;
  risk: Risk;
  relatedAttribute?: string;
  relatedSkill?: string | null;
  mpCost: number;
  difficultyPreview?: string;
  isCustom: boolean;
  customText?: string;
  selectedOptionId?: string;
  selectedOptionLabel?: string;
  requiresCheck?: boolean;
  checkReason?: string;
  checkAttribute?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  checkSkill?: string;
  difficultyClass?: number;
  failureConsequence?: string;
}

// ========== Schemas (for Zod) will be in services/aiService.ts ==========
