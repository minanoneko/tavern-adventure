const RARITY_ALIASES: Record<string, string> = {
  normal: 'common',
  white: 'common',
  普通: 'common',
  优良: 'uncommon',
  green: 'uncommon',
  蓝色: 'rare',
  blue: 'rare',
  稀有: 'rare',
  purple: 'epic',
  史诗: 'epic',
  orange: 'legendary',
  gold: 'legendary',
  传说: 'legendary',
  red: 'cursed',
  诅咒: 'cursed',
  遗物: 'relic',
};

const EQUIPMENT_TYPES = new Set(['weapon', 'armor', 'accessory']);

export const ITEM_RARITY_COLORS: Record<string, string> = {
  common: 'var(--color-item-common)',
  uncommon: 'var(--color-item-uncommon)',
  rare: 'var(--color-item-rare)',
  epic: 'var(--color-item-epic)',
  legendary: 'var(--color-item-legendary)',
  cursed: 'var(--color-item-cursed)',
  relic: 'var(--color-item-relic)',
};

export const EQUIPMENT_QUALITY_COLORS: Record<string, string> = {
  common: 'var(--color-equipment-common)',
  uncommon: 'var(--color-equipment-uncommon)',
  rare: 'var(--color-equipment-rare)',
  epic: 'var(--color-equipment-epic)',
  legendary: 'var(--color-equipment-legendary)',
  cursed: 'var(--color-equipment-cursed)',
  relic: 'var(--color-equipment-relic)',
};

export function normalizeRarity(rarity?: string): string {
  const value = String(rarity || '').trim().toLowerCase();
  return RARITY_ALIASES[value] || value || 'common';
}

export function getRarityColor(rarity?: string): string {
  return getItemRarityColor(rarity);
}

export function getItemRarityColor(rarity?: string): string {
  return ITEM_RARITY_COLORS[normalizeRarity(rarity)] || ITEM_RARITY_COLORS.common;
}

export function getEquipmentQualityColor(quality?: string): string {
  return EQUIPMENT_QUALITY_COLORS[normalizeRarity(quality)] || EQUIPMENT_QUALITY_COLORS.common;
}

export function getInventoryRarityColor(rarity?: string, type?: string): string {
  const normalizedType = String(type || '').trim().toLowerCase();
  return EQUIPMENT_TYPES.has(normalizedType)
    ? getEquipmentQualityColor(rarity)
    : getItemRarityColor(rarity);
}
