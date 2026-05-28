import type { Attributes } from './common';

// ========== Equipment Slots ==========
export type EquipmentSlot = 'mainWeapon' | 'offHand' | 'armor' | 'head' | 'hands' | 'feet' | 'accessory1' | 'accessory2' | 'special';

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainWeapon: '主武器',
  offHand: '副手',
  armor: '防具',
  head: '头部',
  hands: '手部',
  feet: '脚部',
  accessory1: '饰品1',
  accessory2: '饰品2',
  special: '特殊',
};

// ========== Equipment Quality ==========
export type EquipmentQuality = '普通' | '优良' | '稀有' | '史诗' | '传说' | '诅咒' | '遗物';

// ========== Traits ==========
export interface Trait {
  id: string;
  name: string;
  description: string;
  activationRule: TraitActivationRule;
  effect: string;
}

export interface TraitActivationRule {
  type: 'attribute' | 'skill_count' | 'faction_standing' | 'hp_threshold' | 'equipment_set' | 'quest_flag';
  attribute?: { key: keyof Attributes; min: number };
  combinedAttributes?: { attrs: Partial<Attributes>; requireAll?: boolean };
  skillCount?: { type: string; min: number };
  factionStanding?: { factionId: string; min: number };
  hpThreshold?: { percent: number; below: boolean };
  equipmentSet?: string[];
  questFlag?: string;
}

// ========== Equipment Item ==========
export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  quality: EquipmentQuality;
  description: string;
  stats: Partial<Attributes>;
  requirements: Partial<Attributes> & { minLevel?: number };
  traits: Trait[];
  effects: string[];       // base effects (always active)
  price: { gold?: number; silver?: number; copper?: number };
}

// ========== Equipped Items ==========
export interface EquippedItems {
  mainWeapon: string | null;
  offHand: string | null;
  armor: string | null;
  head: string | null;
  hands: string | null;
  feet: string | null;
  accessory1: string | null;
  accessory2: string | null;
  special: string | null;
}

// ========== Equipment Penalty ==========
export interface EquipmentPenalty {
  canEquip: boolean;
  effectiveness: number;     // 0-1, percentage of base effect
  hitPenalty: number;        // 0-1, penalty to accuracy
  blockedSkills: string[];
  inactiveTraits: Trait[];
  activeTraits: Trait[];
  warnings: string[];
}
