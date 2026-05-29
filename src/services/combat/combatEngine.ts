import type { Player, WorldState } from '../../types';
import type { CombatState, CombatStartProposal, CombatAction, CombatResolution, CombatLogEntry } from '../../types/combat';
import { createEnemiesFromProposal, migrateOldEnemyToState } from './enemyFactory';
import { getLegalCombatActions, validateCombatAction, applyCombatResult, enemyAttack, checkVictoryDefeat, tryFlee, observeEnemy, tickBuffs } from './combatRules';
import { calculateCombatRewards } from './combatRewards';

// ========== Start Combat ==========

export interface StartCombatResult {
  combatState: CombatState;
  logs: CombatLogEntry[];
}

/**
 * Start combat from AI proposal. Local enemyFactory validates and fills in stats.
 */
export function startCombatFromAI(
  player: Player,
  worldState: WorldState,
  combatStart: CombatStartProposal,
): StartCombatResult {
  const enemies = createEnemiesFromProposal(combatStart, player, worldState);
  const logs: CombatLogEntry[] = [{
    id: `combat_start_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'system',
    text: `战斗开始！敌人：${enemies.map(e => e.name).join('、')}`,
    round: 0,
  }];

  const combatState: CombatState = {
    active: true,
    phase: 'fighting',
    round: 1,
    turn: 'player',
    enemies,
    playerBuffs: [],
    combatLog: logs,
    combatStart,
  };

  return { combatState, logs };
}

/**
 * Start combat from old-format enemy (backward compat).
 */
export function startCombatFromLegacyEnemy(
  player: Player,
  worldState: WorldState,
  enemy: import('../../types/ai').CombatEnemy,
): StartCombatResult {
  const enemyState = migrateOldEnemyToState(enemy);
  const logs: CombatLogEntry[] = [{
    id: `combat_start_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'system',
    text: `战斗开始！${enemyState.name} 出现了！`,
    round: 0,
  }];

  const combatState: CombatState = {
    active: true,
    phase: 'fighting',
    round: 1,
    turn: 'player',
    enemies: [enemyState],
    playerBuffs: [],
    combatLog: logs,
  };

  return { combatState, logs };
}

// ========== Submit Combat Action ==========

export interface CombatActionResult {
  player: Player;
  combatState: CombatState;
  resolution: CombatResolution | null;
  enemyTurnResult: { damage: number; hit: boolean; roll: number; results: string[] } | null;
  victory: boolean;
  defeat: boolean;
  fled: boolean;
}

/**
 * Process player combat action. Local settlement happens immediately.
 */
export function submitCombatAction(
  player: Player,
  combatState: CombatState,
  action: CombatAction,
): CombatActionResult {
  const validation = validateCombatAction(action, player, combatState);
  const logs = [...combatState.combatLog];
  let updatedPlayer = { ...player, resources: { ...player.resources } };
  let updatedState = { ...combatState, enemies: combatState.enemies.map(e => ({ ...e })) };

  const round = combatState.round;

  // Handle non-targeting actions first
  if (action.type === 'flee') {
    const success = tryFlee(player);
    if (success) {
      logs.push(makeLog('system', '逃跑成功！脱离了战斗。', round));
      updatedState.phase = 'fled';
      updatedState.active = false;
      return {
        player: updatedPlayer,
        combatState: { ...updatedState, combatLog: logs },
        resolution: null,
        enemyTurnResult: null,
        victory: false, defeat: false, fled: true,
      };
    } else {
      logs.push(makeLog('system', '逃跑失败！', round));
      updatedState.turn = 'enemy';
      updatedState = { ...updatedState, combatLog: logs };
      // Enemy gets a turn
      const enemyResult = runEnemyTurnInternal(updatedPlayer, updatedState);
      updatedPlayer = enemyResult.player;
      updatedState = enemyResult.combatState;
      return {
        player: updatedPlayer,
        combatState: updatedState,
        resolution: null,
        enemyTurnResult: enemyResult.result,
        victory: false, defeat: enemyResult.defeat, fled: false,
      };
    }
  }

  if (action.type === 'observe') {
    const target = updatedState.enemies.find(e => e.id === action.targetEnemyId);
    if (target) {
      const obsText = observeEnemy(target);
      logs.push(makeLog('system', obsText, round));
    }
    updatedState.turn = 'enemy';
    updatedState = { ...updatedState, combatLog: logs };
    const enemyResult = runEnemyTurnInternal(updatedPlayer, updatedState);
    updatedPlayer = enemyResult.player;
    updatedState = enemyResult.combatState;
    return {
      player: updatedPlayer,
      combatState: updatedState,
      resolution: null,
      enemyTurnResult: enemyResult.result,
      victory: false, defeat: enemyResult.defeat, fled: false,
    };
  }

  if (action.type === 'defend') {
    logs.push(makeLog('action', '进入防御姿态，受到的伤害减半。', round));
    updatedState.playerBuffs = [...updatedState.playerBuffs, {
      id: `defend_${Date.now()}`,
      name: '防御',
      type: 'defense',
      value: 2,
      duration: 1,
      source: 'defend',
    }];

    if (action.itemId === 'healing_potion') {
      const potionIdx = updatedPlayer.inventory.findIndex(i => i.id === 'healing_potion');
      if (potionIdx >= 0 && updatedPlayer.inventory[potionIdx].quantity > 0) {
        updatedPlayer.resources.hp = Math.min(updatedPlayer.resources.maxHp, updatedPlayer.resources.hp + 5);
        updatedPlayer.inventory = updatedPlayer.inventory.map((item, idx) =>
          idx === potionIdx ? { ...item, quantity: item.quantity - 1 } : item,
        ).filter(i => i.quantity > 0);
        logs.push(makeLog('action', '使用了治疗药水，HP +5', round));
      }
    }

    updatedState.turn = 'enemy';
    updatedState = { ...updatedState, combatLog: logs };
    const enemyResult = runEnemyTurnInternal(updatedPlayer, updatedState);
    updatedPlayer = enemyResult.player;
    updatedState = enemyResult.combatState;
    return {
      player: updatedPlayer,
      combatState: updatedState,
      resolution: null,
      enemyTurnResult: enemyResult.result,
      victory: false, defeat: enemyResult.defeat, fled: false,
    };
  }

  // Targeting actions: attack, skill, item (offensive)
  const enemy = updatedState.enemies.find(e => e.id === action.targetEnemyId);
  if (!enemy || enemy.isDefeated) {
    logs.push(makeLog('system', '目标无效或已被击败。', round));
    updatedState.turn = 'enemy';
    return {
      player: updatedPlayer,
      combatState: { ...updatedState, combatLog: logs },
      resolution: null,
      enemyTurnResult: null,
      victory: false, defeat: false, fled: false,
    };
  }

  // Apply action
  const resolution = applyCombatResult(player, enemy, action, combatState);

  // Deduct MP/HP
  if (resolution.playerMpChange !== 0) {
    updatedPlayer.resources.mp = Math.max(0, updatedPlayer.resources.mp + resolution.playerMpChange);
  }
  if (resolution.playerHpChange !== 0) {
    updatedPlayer.resources.hp = Math.max(0, updatedPlayer.resources.hp + resolution.playerHpChange);
  }

  // Consume item
  if (action.itemId) {
    const itemIdx = updatedPlayer.inventory.findIndex(i => i.id === action.itemId);
    if (itemIdx >= 0) {
      updatedPlayer.inventory = updatedPlayer.inventory.map((item, idx) =>
        idx === itemIdx ? { ...item, quantity: item.quantity - 1 } : item,
      ).filter(i => i.quantity > 0);
    }
  }

  // Update enemy in state
  updatedState.enemies = updatedState.enemies.map(e =>
    e.id === resolution.targetEnemy.id ? resolution.targetEnemy : e,
  );

  // Log results
  for (const r of resolution.results) {
    logs.push(makeLog('action', r, round));
  }

  // Check victory
  const result = checkVictoryDefeat(updatedPlayer, updatedState);
  if (result === 'victory') {
    updatedState.phase = 'victory';
    updatedState.active = false;
    logs.push(makeLog('system', '战斗胜利！', round));
    // Calculate and log rewards
    const rewards = calculateCombatRewards(updatedState.enemies, updatedPlayer);
    updatedPlayer.exp += rewards.exp;
    updatedPlayer.money = {
      gold: updatedPlayer.money.gold + rewards.money.gold,
      silver: updatedPlayer.money.silver + rewards.money.silver,
      copper: updatedPlayer.money.copper + rewards.money.copper,
    };
    // Normalize money
    while (updatedPlayer.money.copper >= 100) {
      updatedPlayer.money.copper -= 100;
      updatedPlayer.money.silver += 1;
    }
    while (updatedPlayer.money.silver >= 100) {
      updatedPlayer.money.silver -= 100;
      updatedPlayer.money.gold += 1;
    }
    for (const item of rewards.items) {
      const existing = updatedPlayer.inventory.find(i => i.id === item.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        updatedPlayer.inventory.push({
          id: item.id,
          name: item.name,
          type: item.type as any,
          description: '',
          quantity: item.quantity,
          rarity: item.rarity as any,
          usable: false,
          tags: [],
        });
      }
    }
    const rewardText = `获得：经验 +${rewards.exp}，钱币 ${rewards.money.gold > 0 ? `${rewards.money.gold}金` : ''}${rewards.money.silver > 0 ? `${rewards.money.silver}银` : ''}${rewards.money.copper}铜`;
    logs.push(makeLog('reward', rewardText, round));

    return {
      player: updatedPlayer,
      combatState: { ...updatedState, combatLog: logs },
      resolution,
      enemyTurnResult: null,
      victory: true, defeat: false, fled: false,
    };
  }

  if (result === 'defeat') {
    updatedState.phase = 'defeat';
    updatedState.active = false;
    logs.push(makeLog('system', '你被击败了……', round));
    return {
      player: updatedPlayer,
      combatState: { ...updatedState, combatLog: logs },
      resolution,
      enemyTurnResult: null,
      victory: false, defeat: true, fled: false,
    };
  }

  // Enemy turn
  updatedState.turn = 'enemy';
  updatedState = { ...updatedState, combatLog: logs };
  const enemyResult = runEnemyTurnInternal(updatedPlayer, updatedState);

  return {
    player: enemyResult.player,
    combatState: enemyResult.combatState,
    resolution,
    enemyTurnResult: enemyResult.result,
    victory: false, defeat: enemyResult.defeat, fled: false,
  };
}

// ========== Enemy Turn (internal) ==========

function runEnemyTurnInternal(
  player: Player,
  combatState: CombatState,
): { player: Player; combatState: CombatState; result: { damage: number; hit: boolean; roll: number; results: string[] } | null; defeat: boolean } {
  let updatedPlayer = { ...player, resources: { ...player.resources } };
  const logs = [...combatState.combatLog];
  const round = combatState.round;

  // Tick buffs
  const tickedBuffs = tickBuffs(combatState.playerBuffs);

  // Find first alive enemy
  const aliveEnemies = combatState.enemies.filter(e => !e.isDefeated);
  let enemyTurnResult: { damage: number; hit: boolean; roll: number; results: string[] } | null = null;

  if (aliveEnemies.length > 0) {
    const attacker = aliveEnemies[0];
    const result = enemyAttack(updatedPlayer, attacker, tickedBuffs);
    enemyTurnResult = result;

    if (result.damage > 0) {
      updatedPlayer.resources.hp = Math.max(0, updatedPlayer.resources.hp - result.damage);
    }

    for (const r of result.results) {
      logs.push(makeLog('enemy', r, round));
    }
  }

  // Check defeat after enemy turn
  const result = checkVictoryDefeat(updatedPlayer, combatState);
  if (result === 'defeat') {
    const updatedState: CombatState = {
      ...combatState,
      phase: 'defeat',
      active: false,
      turn: 'resolution',
      playerBuffs: tickedBuffs,
      combatLog: logs,
    };
    logs.push(makeLog('system', '你被击败了……', round));
    return { player: updatedPlayer, combatState: { ...updatedState, combatLog: logs }, result: enemyTurnResult, defeat: true };
  }

  // Next round
  const updatedState: CombatState = {
    ...combatState,
    round: round + 1,
    turn: 'player',
    playerBuffs: tickedBuffs,
    combatLog: logs,
  };

  return { player: updatedPlayer, combatState: updatedState, result: enemyTurnResult, defeat: false };
}

// ========== End Combat ==========

export function endCombat(player: Player, combatState: CombatState): { player: Player; combatState: CombatState } {
  return {
    player,
    combatState: {
      active: false,
      phase: 'fighting',
      round: 0,
      turn: 'player',
      enemies: [],
      playerBuffs: [],
      combatLog: [],
    },
  };
}

function makeLog(type: CombatLogEntry['type'], text: string, round: number): CombatLogEntry {
  return {
    id: `combat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    text,
    round,
  };
}
