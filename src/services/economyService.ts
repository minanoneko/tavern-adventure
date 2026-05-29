import type { Player } from '../types';
import { addMoney, subtractMoney, canAfford, moneyToCopper } from '../utils/moneyUtils';
import { EQUIPMENT_LIBRARY } from '../data/equipment';
import type { Money } from '../types/common';

// Consumable item prices (not in equipment library)
const CONSUMABLE_PRICES: Record<string, Money> = {
  healing_potion: { gold: 0, silver: 0, copper: 50 },
  fire_bomb: { gold: 0, silver: 1, copper: 0 },
  smoke_bomb: { gold: 0, silver: 0, copper: 80 },
};

export function getItemPrice(itemId: string): Money | null {
  // Check equipment library
  const equip = EQUIPMENT_LIBRARY[itemId];
  if (equip?.price) return { gold: equip.price.gold || 0, silver: equip.price.silver || 0, copper: equip.price.copper || 0 };
  // Check consumables
  const consumable = CONSUMABLE_PRICES[itemId];
  if (consumable) return consumable;
  return null;
}

export function buyItem(
  player: Player,
  itemId: string,
  quantity: number = 1,
): { success: boolean; player: Player; reason?: string } {
  const price = getItemPrice(itemId);
  if (!price) return { success: false, player, reason: `未知物品：${itemId}` };

  const totalCost = {
    gold: (price.gold || 0) * quantity,
    silver: (price.silver || 0) * quantity,
    copper: (price.copper || 0) * quantity,
  };

  if (!canAfford(player.money, totalCost)) {
    return { success: false, player, reason: '钱币不足' };
  }

  const p = { ...player, money: subtractMoney(player.money, totalCost), inventory: [...player.inventory] };

  // Check if item already in inventory (stackable consumables)
  const existing = p.inventory.find(i => i.id === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    // Determine item type and name
    const equip = EQUIPMENT_LIBRARY[itemId];
    const name = equip?.name || itemId;
    const itemType = equip ? (equip.slot === 'mainWeapon' ? 'weapon' : equip.slot === 'armor' ? 'armor' : 'accessory') : 'consumable';
    p.inventory.push({
      id: itemId,
      name,
      type: itemType as any,
      description: equip?.description || '',
      quantity,
      rarity: (equip?.quality as any) || 'common',
      usable: itemId === 'healing_potion' || itemId === 'fire_bomb' || itemId === 'smoke_bomb',
      tags: [],
    });
  }

  return { success: true, player: p };
}

/** Sell at half price, rounded down */
export function sellItem(
  player: Player,
  itemId: string,
  quantity: number = 1,
): { success: boolean; player: Player; reason?: string } {
  const item = player.inventory.find(i => i.id === itemId);
  if (!item || item.quantity < quantity) return { success: false, player, reason: '物品不足' };

  const price = getItemPrice(itemId);
  if (!price) return { success: false, player, reason: '该物品无法出售' };

  // Half price
  const sellValue = Math.floor(moneyToCopper(price) / 2) * quantity;
  const gold = Math.floor(sellValue / 10000);
  const remain = sellValue - gold * 10000;
  const silver = Math.floor(remain / 100);
  const copper = remain - silver * 100;

  const p = {
    ...player,
    money: addMoney(player.money, { gold, silver, copper }),
    inventory: player.inventory.map(i =>
      i.id === itemId ? { ...i, quantity: i.quantity - quantity } : i
    ).filter(i => i.quantity > 0),
  };

  return { success: true, player: p };
}
