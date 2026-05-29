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

    // Exp: base 10 + level * 5 for normal, * 8 for elite, * 12 for boss
    const expBase = enemy.isBoss ? 12 : enemy.level > player.level ? 8 : 5;
    totalExp += 10 + enemy.level * expBase;

    // Money: level * 3~8 copper for normals, more for boss
    const moneyBase = enemy.isBoss ? 50 : enemy.level > player.level ? 20 : 10;
    totalCopper += enemy.level * moneyBase + Math.floor(Math.random() * enemy.level * 5);

    // Material drops (50% chance)
    if (Math.random() > 0.5) {
      items.push({
        id: `monster_part_${enemy.type}`,
        name: `${enemy.name}的残骸`,
        quantity: 1,
        type: 'material',
        rarity: 'common',
      });
    }

    // Boss drops extra
    if (enemy.isBoss && Math.random() > 0.3) {
      items.push({
        id: `boss_loot_${Date.now()}`,
        name: `${enemy.name}的宝物`,
        quantity: 1,
        type: 'valuable',
        rarity: 'uncommon',
      });
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
