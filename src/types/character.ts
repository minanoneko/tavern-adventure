import type { Attributes, Resources, Money, StatusEffect, WorldState } from './common';
import type { EquippedItems } from './equipment';
import type { SkillState } from './skill';
import type { Quest } from './quest';

// ========== Race ==========
export interface Race {
  id: string;
  name: string;
  description: string;
  attributeBonus: Partial<Attributes>;
}

// ========== Class Origin ==========
export interface ClassOrigin {
  id: string;
  name: string;
  description: string;
  role: string;
  attributes: Attributes;
  skills: string[];       // skill ids
  equipment: string[];    // equipment ids
  money: Money;
}

// ========== Personality ==========
export interface PersonalityTrait {
  id: string;
  name: string;
  description: string;
}

// ========== Character Creation ==========
export interface CharacterCreationData {
  name: string;
  age: number;
  gender: string;
  raceId: string;
  classId: string;
  personalityTraits: string[];
  customOrigin: string;
  attributes: Attributes;
  remainingAttributePoints: number;
}

// ========== Player ==========
export interface Player {
  name: string;
  level: number;
  exp: number;
  nextExp: number;
  race: string;
  classOrigin: string;
  gender: string;
  age: number;
  personalityTraits: string[];
  customOrigin: string;
  attributes: Attributes;
  attributePoints: number;
  skillPoints: number;
  resources: Resources;
  money: Money;
  equipment: EquippedItems;
  inventory: InventoryItem[];
  skills: SkillState;
  relationships: Relationship[];
  quests: Quest[];
  statusEffects: StatusEffect[];
}

// ========== Inventory ==========
export type ItemType =
  | 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material'
  | 'quest_item' | 'book' | 'skill_book' | 'valuable' | 'cursed' | 'tool';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'cursed' | 'relic';

export interface InventoryItem {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  quantity: number;
  rarity: ItemRarity;
  usable: boolean;
  requirements?: Partial<Attributes> & { minLevel?: number };
  effects?: string[];
  tags: string[];
  importance?: 'low' | 'medium' | 'high' | 'critical';
}

// ========== NPC/Faction Relationship ==========
export interface Relationship {
  targetId: string;
  name: string;
  type: 'npc' | 'faction';
  standing: number;
  description: string;
  race?: string;
  occupation?: string;
}

// ========== Player Creation helper ==========
function attrModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

export function createDefaultPlayer(data: CharacterCreationData, race: Race, classOrigin: ClassOrigin): Player {
  const conMod = attrModifier(data.attributes.con);
  const castingMod = Math.max(attrModifier(data.attributes.int), attrModifier(data.attributes.wis), 0);
  const maxHp = Math.max(8, 12 + conMod * 2);
  const maxMp = Math.max(4, 6 + castingMod * 2);

  return {
    name: data.name,
    level: 1,
    exp: 0,
    nextExp: 100,
    race: race.name,
    classOrigin: classOrigin.name,
    gender: data.gender,
    age: data.age,
    personalityTraits: data.personalityTraits,
    customOrigin: data.customOrigin,
    attributes: data.attributes,
    attributePoints: data.remainingAttributePoints,
    skillPoints: 0,
    resources: { hp: maxHp, maxHp, mp: maxMp, maxMp },
    money: { ...classOrigin.money },
    equipment: {
      mainWeapon: null,
      offHand: null,
      armor: null,
      head: null,
      hands: null,
      feet: null,
      accessory1: null,
      accessory2: null,
      special: null,
    },
    inventory: [],
    skills: {
      learned: [...classOrigin.skills],
      discovered: [],
      locked: [],
      equipped: [...classOrigin.skills],
      maxSlots: 7,
      learnTokens: 0,
    },
    relationships: [],
    quests: [],
    statusEffects: ['正常'],
  };
}
