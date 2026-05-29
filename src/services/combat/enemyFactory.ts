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
    // Determine enemy rank
    const isBoss = !!(proposal.isBoss && (proposal.bossFlag || proposal.questFlag));
    const isElite = !isBoss && ep.suggestedLevel && ep.suggestedLevel > player.level + 1;

    // Level cap
    const maxLevel = isBoss ? player.level + 3 : isElite ? player.level + 2 : player.level + 1;
    const level = Math.max(1, Math.min(ep.suggestedLevel ?? 1, maxLevel));

    // Base stats derived from level
    const str = capStat(ep.suggestedStr ?? (3 + level), level);
    const dex = capStat(ep.suggestedDex ?? (3 + Math.floor(level / 2)), level);
    const con = capStat(ep.suggestedCon ?? (3 + Math.floor(level / 2)), level);

    // HP scales with level and con
    const maxHp = Math.min(ep.suggestedHp ?? (5 + con * 2 + level * 2), 80);

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
    isBoss: false,
    isDefeated: false,
    description: enemy.description,
  };
}
