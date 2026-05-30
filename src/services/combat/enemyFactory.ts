import type { Player, WorldState } from '../../types';
import type { CombatStartProposal, CombatEnemyState, EnemyProposal } from '../../types/combat';
import { getAttributeModifier } from './dice';

/**
 * Validate and fill in enemy stats from AI proposal.
 * AI only provides a proposal — local rules determine final stats.
 *
 * Level caps:
 * - Normal enemy: max player.level + 1
 * - Elite: max player.level + 2
 * - Boss: requires bossFlag or questFlag
 */
export function createEnemiesFromProposal(
  proposal: CombatStartProposal,
  player: Player,
  worldState: WorldState,
): CombatEnemyState[] {
  const proposals: EnemyProposal[] = Array.isArray(proposal.enemies) && proposal.enemies.length > 0
    ? proposal.enemies
    : [{ name: '敌对者', type: 'monster', suggestedLevel: player.level }];
  return proposals.map((ep, i) => {
    // Reject or downgrade overpowered enemies without proper flags
    const OP_NAMES = /远古红龙|巨龙|魔王|神明|古神|灾厄|邪神|终焉|世界Boss|大魔王|灭世|龙神/i;
    if (OP_NAMES.test(ep.name) && !proposal.bossFlag && !proposal.questFlag) {
      // Downgrade to a reasonable enemy — keep the name but as normal stats
      return {
        id: `enemy_${Date.now()}_${i}`,
        name: `幻影${ep.name.slice(0, 4)}`,
        type: 'monster',
        level: Math.min(player.level + 1, 3),
        str: 6, dex: 5, con: 5,
        hp: 15, maxHp: 15,
        statusEffects: [],
        isBoss: false,
        isDefeated: false,
        description: '这只是一个虚幻的投影，真正的威胁还在远处。',
      };
    }

    // Boss requires unlock flag
    const isBoss = !!(proposal.isBoss && (proposal.bossFlag || worldState.worldFlags.includes(proposal.bossFlag || '') || proposal.questFlag));
    const isElite = !isBoss && ep.suggestedLevel && ep.suggestedLevel > player.level + 1;

    // Level cap: boss can be up to +3, elite +2, normal +1
    const maxLevel = isBoss ? player.level + 3 : isElite ? player.level + 2 : player.level + 1;
    const level = Math.max(1, Math.min(ep.suggestedLevel ?? 1, maxLevel));

    // Base stats: boss gets +2 to all stats
    const bossBonus = isBoss ? 2 : 0;
    const str = capStat(ep.suggestedStr ?? (3 + level + bossBonus), level + bossBonus);
    const dex = capStat(ep.suggestedDex ?? (3 + Math.floor(level / 2) + bossBonus), level + bossBonus);
    const con = capStat(ep.suggestedCon ?? (3 + Math.floor(level / 2) + bossBonus), level + bossBonus);

    // HP: boss gets multiplied by 2.5x, elite 1.5x
    const hpMult = isBoss ? 2.5 : isElite ? 1.5 : 1;
    const maxHp = Math.min(Math.floor((ep.suggestedHp ?? (5 + con * 2 + level * 2)) * hpMult), 120);

    return {
      id: `enemy_${Date.now()}_${i}`,
      name: ep.name,
      type: ep.type || 'monster',
      level,
      str,
      dex,
      con,
      hp: maxHp,
      maxHp,
      statusEffects: [],
      isBoss,
      isDefeated: false,
      description: ep.description,
    };
  });
}

function capStat(value: number, level: number): number {
  // Hard stat caps by level
  const max = 4 + level * 2;
  return Math.max(1, Math.min(value, max));
}

/** Convert old CombatEnemy to new CombatEnemyState (for backward compat) */
export function migrateOldEnemyToState(
  enemy: import('../../types/ai').CombatEnemy,
): CombatEnemyState {
  return {
    id: `enemy_legacy_${Date.now()}`,
    name: enemy.name,
    type: 'monster',
    level: enemy.level,
    str: enemy.str,
    dex: enemy.dex,
    con: enemy.con,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    statusEffects: [],
    isBoss: enemy.isBoss || false,
    isDefeated: false,
    description: enemy.description,
  };
}
