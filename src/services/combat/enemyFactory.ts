import type { Player, WorldState } from '../../types';
import type { CombatStartProposal, CombatEnemyState, EnemyProposal } from '../../types/combat';

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
    // Reject overpowered enemies without proper flags — no downgrade, just refuse combat
    const OP_NAMES = /远古红龙|巨龙|魔王|神明|古神|灾厄|邪神|终焉|世界Boss|大魔王|灭世|龙神/i;
    if (OP_NAMES.test(ep.name)) {
      const hasUnlock = proposal.bossFlag && worldState.worldFlags.includes(proposal.bossFlag);
      const hasQuest = proposal.questFlag && worldState.worldFlags.includes(proposal.questFlag);
      if (!hasUnlock && !hasQuest) {
        // Don't create any combat entity — just a narrative placeholder
        return {
          id: `enemy_${Date.now()}_${i}`,
          name: `${ep.name}（远景）`,
          type: 'monster',
          level: 99, str: 30, dex: 30, con: 30,
          hp: 999, maxHp: 999,
          statusEffects: [],
          isBoss: false, isDefeated: false,
          description: '无法战斗——这只是一个远景压迫/传闻/痕迹。需要剧情flag解锁。',
        };
      }
    }

    // Boss requires unlock flag in worldState, not just AI's proposal
    const hasBossUnlock = proposal.bossFlag ? worldState.worldFlags.includes(proposal.bossFlag) : true;
    const hasQuestUnlock = proposal.questFlag ? worldState.worldFlags.includes(proposal.questFlag) : true;
    const isBoss = !!(proposal.isBoss && hasBossUnlock && hasQuestUnlock);
    const isElite = !isBoss && ep.suggestedLevel && ep.suggestedLevel > player.level + 1;

    // Level cap: boss can be up to +3, elite +2, normal +1
    const maxLevel = isBoss ? player.level + 3 : isElite ? player.level + 2 : player.level + 1;
    const level = Math.max(1, Math.min(ep.suggestedLevel ?? 1, maxLevel));

    // Base stats: boss gets +2 to all stats
    const bossBonus = isBoss ? 2 : 0;
    const str = capStat(ep.suggestedStr ?? (9 + level + bossBonus), level + bossBonus);
    const dex = capStat(ep.suggestedDex ?? (8 + level + bossBonus), level + bossBonus);
    const con = capStat(ep.suggestedCon ?? (8 + level + bossBonus), level + bossBonus);

    // HP: boss gets multiplied by 2.5x, elite 1.5x
    const hpMult = isBoss ? 2.5 : isElite ? 1.5 : 1;
    const maxHp = Math.min(Math.floor((ep.suggestedHp ?? (4 + con + level * 3)) * hpMult), 120);

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
  const max = Math.min(22, 12 + level);
  return Math.max(6, Math.min(value, max));
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
