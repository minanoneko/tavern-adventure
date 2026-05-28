import type { Attributes } from './common';

// ========== Skill Types ==========
export type SkillType =
  | 'active' | 'passive' | 'reaction' | 'exploration'
  | 'social' | 'hidden' | 'combat' | 'magic' | 'class' | 'equipment';

export type SkillStatus =
  | 'undiscovered' | 'discovered' | 'learnable' | 'not_learnable'
  | 'learned' | 'learned_locked' | 'castable' | 'upgraded'
  | 'equipment_granted' | 'disabled';

// ========== Requirements ==========
export interface LearnRequirement {
  minLevel?: number;
  attributes?: Partial<Attributes>;
  prerequisiteSkills?: string[];
  requiresItem?: string;
  requiresQuest?: string;
  requiresFaction?: { factionId: string; minStanding: number };
}

export interface CastRequirement {
  minLevel?: number;
  attributes?: Partial<Attributes>;
  mpCost?: number;
  hpCost?: number;
  requiresWeaponType?: string;    // 'staff', 'bow', 'sword', etc.
  requiresEquipment?: string;
  requiresStatusFree?: string[];   // status effects that block casting
  requiresLocation?: string[];
  requiresItem?: string;
  cooldown?: number;               // turns
}

// ========== Skill Definition ==========
export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  learnRequirements: LearnRequirement;
  castRequirements: CastRequirement;
  source?: string;
  proficiency?: number;            // 0-100
  upgradeCondition?: string;
}

// ========== Skill State ==========
export interface SkillState {
  learned: string[];     // skill ids
  discovered: string[];  // known but not learned
  locked: string[];      // not yet known
}

// ========== Lock Reason ==========
export interface SkillLockInfo {
  skillId: string;
  skillName: string;
  status: SkillStatus;
  lockReasons: string[];
}
