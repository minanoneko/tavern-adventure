import type { Money } from '../types/common';

export interface CatalogItem {
  id: string;
  name: string;
  type: 'consumable' | 'tool';
  description: string;
  basePrice: Money;
  usable: boolean;
  effects?: {
    hpHeal?: number;
    mpRestore?: number;
    combatDamage?: number;
    fleeBonus?: number;
    statusRemove?: string[];
  };
}

export const ITEM_CATALOG: Record<string, CatalogItem> = {
  healing_potion: {
    id: 'healing_potion',
    name: '治疗药水',
    type: 'consumable',
    description: '恢复5点HP的红色药水',
    basePrice: { gold: 0, silver: 0, copper: 20 },
    usable: true,
    effects: { hpHeal: 5 },
  },
  mana_potion: {
    id: 'mana_potion',
    name: '魔力药水',
    type: 'consumable',
    description: '恢复3点MP的蓝色药水，喝下后舌尖有微弱的魔力刺痛感',
    basePrice: { gold: 0, silver: 0, copper: 25 },
    usable: true,
    effects: { mpRestore: 3 },
  },
  fire_bomb: {
    id: 'fire_bomb',
    name: '燃烧瓶',
    type: 'consumable',
    description: '投掷后造成额外6点火焰伤害',
    basePrice: { gold: 0, silver: 1, copper: 0 },
    usable: true,
    effects: { combatDamage: 6 },
  },
  smoke_bomb: {
    id: 'smoke_bomb',
    name: '烟雾弹',
    type: 'consumable',
    description: '制造烟雾，逃跑判定+4',
    basePrice: { gold: 0, silver: 0, copper: 50 },
    usable: true,
    effects: { fleeBonus: 4 },
  },
  lockpick_tools: {
    id: 'lockpick_tools',
    name: '开锁工具',
    type: 'tool',
    description: '一套精巧的开锁工具，撬锁判定时提供加成',
    basePrice: { gold: 0, silver: 2, copper: 0 },
    usable: false,
    effects: undefined,
  },
};

export const ALLOWED_ITEM_IDS = Object.keys(ITEM_CATALOG);

export function getCatalogItem(id: string): CatalogItem | undefined {
  return ITEM_CATALOG[id];
}

export function isAllowedItem(id: string): boolean {
  return id in ITEM_CATALOG;
}
