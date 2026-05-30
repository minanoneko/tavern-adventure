import type { Attributes } from './common';

export type SkillType =
  | 'active' | 'passive' | 'reaction' | 'exploration'
  | 'social' | 'ritual' | 'crafting' | 'combat' | 'magic' | 'class' | 'equipment';

export type SkillRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type SkillStatus =
  | 'undiscovered' | 'discovered' | 'learnable' | 'not_learnable'
  | 'learned' | 'learned_locked' | 'castable' | 'upgraded'
  | 'equipment_granted' | 'disabled';

export interface LearnRequirement {
  minLevel?: number;
  attributes?: Partial<Attributes>;
  prerequisiteSkills?: string[];
  requiredClassOrigin?: string[];
  requiredItems?: string[];
  requiredFlags?: string[];
}

export interface CastRequirement {
  minLevel?: number;
  attributes?: Partial<Attributes>;
  mpCost?: number;
  hpCost?: number;
  maxHpCost?: number;
  requiresWeaponType?: string;
  requiresEquipment?: string;
  requiresStatusFree?: string[];
  requiresLocation?: string[];
  requiresItem?: string;
  oncePerRest?: boolean;
  cooldownTurns?: number;
}

export interface CombatDamage {
  /** Whether to add weapon dice (default true for weapon skills) */
  useWeaponDice?: boolean;
  /** Replacement dice, e.g. "1d6" for pure magic skills */
  damageDice?: string;
  /** Extra dice on top, e.g. "1d4" for heavy_strike bonus */
  bonusDice?: string;
  /** Which attribute mod to use for damage (default 'str') */
  damageAttribute?: import('./common').AttributeKey;
}

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  rarity: SkillRarity;
  slotCost: number;
  description: string;
  classTags?: string[];
  learnRequirements: LearnRequirement;
  castRequirements: CastRequirement;
  combatDamage?: CombatDamage;
  effectsDescription?: string;
  source?: string;
}

export interface SkillState {
  learned: string[];
  discovered: string[];
  locked: string[];
  equipped: string[];
  maxSlots: number;
  learnTokens: number;
}

export interface SkillLockInfo {
  skillId: string;
  skillName: string;
  status: SkillStatus;
  lockReasons: string[];
}
