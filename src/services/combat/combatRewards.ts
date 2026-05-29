import type { Player } from '../../types';
import type { CombatEnemyState, CombatRewards, CombatDropItem } from '../../types/combat';
import { clampMoneyRewardByLevel } from '../../utils/moneyUtils';
import { EQUIPMENT_LIBRARY } from '../../data/equipment';

/**
 * Calculate combat rewards based on enemies defeated.
 * AI must NOT decide rewards — this is purely local.
 */
export function calculateCombatRewards(enemies: CombatEnemyState[], player: Player): CombatRewards {
  let totalExp = 0;
  let totalCopper = 0;
  const items: CombatDropItem[] = [];

  for (const enemy of enemies) {
    if (!enemy.isDefeated) continue;

    // Exp: BOSS = 2.5x normal
    const expMult = enemy.isBoss ? 6 : enemy.level > player.level ? 4 : 3;
    totalExp += 8 + enemy.level * expMult;

    // Money: BOSS = 5x normal
    const moneyBase = enemy.isBoss ? 150 : enemy.level > player.level ? 30 : 15;
    totalCopper += enemy.level * moneyBase + Math.floor(Math.random() * enemy.level * 10);

    // Material drops (50% chance, boss 100%)
    if (Math.random() > 0.5 || enemy.isBoss) {
      items.push({
        id: `monster_part_${enemy.type}`,
        name: `${enemy.name}的残骸`,
        quantity: enemy.isBoss ? 2 : 1,
        type: 'material',
        rarity: 'common',
      });
    }

    // Healing potion drop (15% normal, 50% boss)
    if (Math.random() < (enemy.isBoss ? 0.5 : 0.15)) {
      items.push({ id: 'healing_potion', name: '治疗药水', quantity: enemy.isBoss ? 2 : 1, type: 'consumable', rarity: 'common' });
    }

    // Boss: 20% rare accessory, 30% normal equip, 50% consumable bundle
    if (enemy.isBoss) {
      const roll = Math.random();
      if (roll < 0.2) {
        // Rare boss-only accessory
        const bossItems = ['adventurer_ring', 'sage_amulet', 'warrior_bracer', 'guardian_pendant', 'wind_boots', 'bloodstone_charm', 'mana_crystal', 'charm_pendant', 'spirit_ring'];
        const id = bossItems[Math.floor(Math.random() * bossItems.length)];
        const eq = EQUIPMENT_LIBRARY[id];
        if (eq) items.push({ id: eq.id, name: eq.name, quantity: 1, type: 'accessory', rarity: 'rare' });
      } else if (roll < 0.5) {
        // Random normal equipment
        const equipList = Object.values(EQUIPMENT_LIBRARY).filter(e => e.price && !e.id.startsWith('boss_') && (e.slot === 'mainWeapon' || e.slot === 'armor') && e.quality !== '稀有');
        if (equipList.length > 0) {
          const eq = equipList[Math.floor(Math.random() * equipList.length)];
          items.push({ id: eq.id, name: eq.name, quantity: 1, type: eq.slot === 'mainWeapon' ? 'weapon' : 'armor', rarity: eq.quality as string });
        }
      } else {
        // Consumable bundle
        items.push({ id: 'healing_potion', name: '治疗药水', quantity: 2, type: 'consumable', rarity: 'common' });
        if (Math.random() > 0.5) items.push({ id: 'fire_bomb', name: '燃烧瓶', quantity: 1, type: 'consumable', rarity: 'common' });
      }
    }
  }

  // Clamp money by level
  const clampedCopper = clampMoneyRewardByLevel(totalCopper, player.level);
  const gold = Math.floor(clampedCopper / 10000);
  const remain = clampedCopper - gold * 10000;
  const silver = Math.floor(remain / 100);
  const copper = remain - silver * 100;

  return { exp: totalExp, money: { gold, silver, copper }, items };
}
