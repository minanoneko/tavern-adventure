import type { Player } from '../../types';
import type { CombatEnemyState, CombatRewards, CombatDropItem } from '../../types/combat';
import { clampMoneyRewardByLevel } from '../../utils/moneyUtils';

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

    // Exp: BOSS = 3x normal, Elite = 1.5x
    const expMult = enemy.isBoss ? 8 : enemy.level > player.level ? 4 : 3;
    totalExp += 10 + enemy.level * expMult;

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

    // Boss guaranteed rare loot
    if (enemy.isBoss) {
      items.push({
        id: `boss_loot_${Date.now()}`,
        name: `${enemy.name}的宝物`,
        quantity: 1,
        type: 'valuable',
        rarity: 'rare',
      });
      // 30% chance for second rare drop
      if (Math.random() > 0.7) {
        items.push({
          id: `boss_loot2_${Date.now()}`,
          name: `稀有的${enemy.name}掉落物`,
          quantity: 1,
          type: 'material',
          rarity: 'rare',
        });
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
