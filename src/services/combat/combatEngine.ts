import type { Player, WorldState } from '../../types';
import type { CombatState, CombatStartProposal, CombatAction, CombatResolution, CombatLogEntry } from '../../types/combat';
import { createEnemiesFromProposal, migrateOldEnemyToState } from './enemyFactory';
import { getLegalCombatActions, validateCombatAction, applyCombatResult, enemyAttack, checkVictoryDefeat, tryFlee, observeEnemy, tickBuffs } from './combatRules';
import { getAttributeModifier, rollCheck } from './dice';
import { calculateCombatRewards } from './combatRewards';
import { addMoney } from '../../utils/moneyUtils';
import { SKILL_LIBRARY } from '../../data/skills';

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
  if (!enemies || enemies.length === 0) {
    return {
      combatState: {
        active: false, phase: 'fighting', round: 0, turn: 'player',
        enemies: [], playerBuffs: [], combatLog: [{
          id: `combat_fail_${Date.now()}`, timestamp: new Date().toISOString(),
          type: 'system', text: '战斗启动失败，已转为普通剧情。', round: 0,
        }],
      },
      logs: [{
        id: `combat_fail_${Date.now()}`, timestamp: new Date().toISOString(),
        type: 'system', text: '战斗启动失败，已转为普通剧情。', round: 0,
      }],
    };
  }
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
  const logs = [...combatState.combatLog];
  let updatedPlayer = { ...player, resources: { ...player.resources } };
  let updatedState = { ...combatState, enemies: combatState.enemies.map(e => ({ ...e })) };
  const round = combatState.round;

  // bloodstone_charm: auto-heal at start of player turn (once per combat)
  const hasBloodstone = [player.equipment.accessory1, player.equipment.accessory2].includes('bloodstone_charm');
  const bloodstoneUsed = combatState.playerBuffs.some(b => b.source === 'bloodstone_charm');
  const hpPct = player.resources.hp / player.resources.maxHp;
  if (hasBloodstone && !bloodstoneUsed && hpPct < 0.3 && hpPct > 0) {
    updatedPlayer.resources.hp = Math.min(updatedPlayer.resources.maxHp, updatedPlayer.resources.hp + 3);
    updatedState.playerBuffs = [...updatedState.playerBuffs, { id: `bloodstone_${Date.now()}`, name: '血石回复', type: 'hot' as any, value: 3, duration: 0, source: 'bloodstone_charm' }];
    logs.push(makeLog('action', '血石护符微微发热，HP +3', round));
  }

  const validation = validateCombatAction(action, player, combatState);
  if (!validation.valid) {
    logs.push(makeLog('system', validation.reason || '行动无效', round));
    return {
      player: updatedPlayer,
      combatState: { ...updatedState, combatLog: logs },
      resolution: null, enemyTurnResult: null,
      victory: false, defeat: false, fled: false,
    };
  }

  // Handle healing item before action type switch
  if (action.type === 'item' && action.itemId === 'healing_potion') {
    const potionIdx = updatedPlayer.inventory.findIndex(i => i.id === 'healing_potion');
    if (potionIdx >= 0 && updatedPlayer.inventory[potionIdx].quantity > 0) {
      updatedPlayer.resources.hp = Math.min(updatedPlayer.resources.maxHp, updatedPlayer.resources.hp + 5);
      updatedPlayer.inventory = updatedPlayer.inventory.map((item, idx) =>
        idx === potionIdx ? { ...item, quantity: item.quantity - 1 } : item,
      ).filter(i => i.quantity > 0);
      logs.push(makeLog('action', '使用了治疗药水，HP +5', round));
    }
    updatedState.turn = 'enemy';
    updatedState = { ...updatedState, combatLog: logs };
    const enemyResult = runEnemyTurnInternal(updatedPlayer, updatedState);
    return { player: enemyResult.player, combatState: enemyResult.combatState, resolution: null, enemyTurnResult: enemyResult.result, victory: false, defeat: enemyResult.defeat, fled: false };
  }

  // Buff skill handler — apply buffs directly, no hit/miss roll
  if (action.type === 'skill' && action.skillId) {
    const buff = getSkillBuff(action.skillId);
    if (buff) {
      // Check MP and deduct
      const skill = getSkillByIdFromImport(action.skillId);
      if (skill) {
        const mpCost = skill.mpCost || 0;
        if (updatedPlayer.resources.mp < mpCost) {
          logs.push(makeLog('system', 'MP不足', round));
          return { player: updatedPlayer, combatState: { ...updatedState, combatLog: logs }, resolution: null, enemyTurnResult: null, victory: false, defeat: false, fled: false };
        }
        // Prevent stacking same buff
        if (updatedState.playerBuffs.some(b => b.source === action.skillId)) {
          logs.push(makeLog('system', `${buff.name}效果已存在，不能叠加`, round));
          return { player: updatedPlayer, combatState: { ...updatedState, combatLog: logs }, resolution: null, enemyTurnResult: null, victory: false, defeat: false, fled: false };
        }
        updatedPlayer.resources.mp = Math.max(0, updatedPlayer.resources.mp - mpCost);
        updatedState.playerBuffs = [...updatedState.playerBuffs, {
          id: `buff_${Date.now()}`, name: buff.name, type: buff.type, value: buff.value, duration: buff.duration, source: action.skillId,
        }];
        logs.push(makeLog('action', `${skill.name}！${buff.desc}（持续${buff.duration}回合，消耗${mpCost}MP）`, round));
      }
      updatedState.turn = 'enemy';
      updatedState = { ...updatedState, combatLog: logs };
      const enemyResult = runEnemyTurnInternal(updatedPlayer, updatedState);
      return { player: enemyResult.player, combatState: enemyResult.combatState, resolution: null, enemyTurnResult: enemyResult.result, victory: false, defeat: enemyResult.defeat, fled: false };
    }
  }

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
    logs.push(makeLog('action', '进入防御姿态——本回合伤害减半，敌人命中判定-2。', round));
    updatedState.playerBuffs = [...updatedState.playerBuffs, {
      id: `defend_${Date.now()}`,
      name: '防御',
      type: 'defense',
      value: 2,
      duration: 1,
      source: 'defend',
    }];

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

  // Special actions: custom combat input (call_help, taunt, distract, negotiate, use_environment)
  if (action.type === 'special') {
    const dc = action.difficultyClass || 14;
    const attrKey = action.checkAttribute || 'cha';
    const attrValue = (player.attributes as any)[attrKey] ?? 5;
    const mod = getAttributeModifier(attrValue);
    const { roll, total } = rollCheck(mod);
    const success = total >= dc;

    logs.push(makeLog('action', `${success ? '成功' : '失败'}！${action.label}（掷骰 ${total} vs DC ${dc}）`, round));

    if (success) {
      switch (action.specialType) {
        case 'call_help':
        case 'summon':
          updatedState.playerBuffs = [...updatedState.playerBuffs, {
            id: `help_${Date.now()}`, name: '援护', type: 'defense', value: 2, duration: 1, source: 'call_help',
          }];
          logs.push(makeLog('system', '你大声呼救，虽然没有实质帮手到来，但你的决心让你更加警觉。获得「援护」buff。', round));
          break;
        case 'taunt': {
          const tauntTarget = updatedState.enemies.find(e => !e.isDefeated);
          if (tauntTarget) {
            tauntTarget.statusEffects = [...tauntTarget.statusEffects, '激怒'];
            logs.push(makeLog('system', `${tauntTarget.name}被激怒了！下次攻击伤害-2。`, round));
          }
          break;
        }
        case 'distract':
          updatedState.playerBuffs = [...updatedState.playerBuffs, {
            id: `distract_${Date.now()}`, name: '破绽', type: 'attack', value: 2, duration: 1, source: 'distract',
          }];
          logs.push(makeLog('system', '你制造了一个破绽！下次攻击获得+2加成。', round));
          break;
        case 'negotiate': {
          const negoTarget = updatedState.enemies.find(e => !e.isDefeated && !e.isBoss);
          if (negoTarget && Math.random() > 0.5) {
            updatedState.phase = 'fled';
            updatedState.active = false;
            logs.push(makeLog('system', `${negoTarget.name}接受了你的交涉，停止了战斗。`, round));
            return {
              player: updatedPlayer, combatState: { ...updatedState, combatLog: logs },
              resolution: null, enemyTurnResult: null, victory: true, defeat: false, fled: false,
            };
          } else {
            logs.push(makeLog('system', '交涉失败，敌人没有理会你。', round));
          }
          break;
        }
        case 'use_environment': {
          const envTarget = updatedState.enemies.find(e => !e.isDefeated);
          if (envTarget) {
            const extraDmg = Math.floor(Math.random() * 4) + Math.floor(Math.random() * 4) + 2;
            envTarget.hp = Math.max(0, envTarget.hp - extraDmg);
            logs.push(makeLog('action', `利用环境造成 ${extraDmg} 点额外伤害！`, round));
            if (envTarget.hp <= 0) { envTarget.isDefeated = true; envTarget.hp = 0; logs.push(makeLog('system', `${envTarget.name} 被击败！`, round)); }
          }
          break;
        }
      }
    } else {
      switch (action.specialType) {
        case 'call_help': case 'summon': logs.push(makeLog('system', '你大声呼救，但没有回应。', round)); break;
        case 'taunt': logs.push(makeLog('system', '你的嘲讽没有效果，敌人不为所动。', round)); break;
        case 'negotiate': logs.push(makeLog('system', '敌人拒绝了你的交涉。', round)); break;
      }
    }

    // Always consume turn → enemy turn
    updatedState.turn = 'enemy';
    updatedState = { ...updatedState, combatLog: logs };
    const vicCheck = checkVictoryDefeat(updatedPlayer, updatedState);
    if (vicCheck === 'victory') {
      updatedState.phase = 'victory'; updatedState.active = false;
      logs.push(makeLog('system', '战斗胜利！', round));
      return { player: updatedPlayer, combatState: { ...updatedState, combatLog: logs }, resolution: null, enemyTurnResult: null, victory: true, defeat: false, fled: false };
    }
    const specEnemyResult = runEnemyTurnInternal(updatedPlayer, updatedState);
    return { player: specEnemyResult.player, combatState: specEnemyResult.combatState, resolution: null, enemyTurnResult: specEnemyResult.result, victory: false, defeat: specEnemyResult.defeat, fled: false };
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
    updatedPlayer.money = addMoney(updatedPlayer.money, rewards.money);
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
    // Apply defeat penalty
    const defeatHp = Math.max(1, Math.floor(updatedPlayer.resources.maxHp * 0.2));
    updatedPlayer.resources.hp = defeatHp;
    const loseCopper = Math.floor((updatedPlayer.money.gold * 10000 + updatedPlayer.money.silver * 100 + updatedPlayer.money.copper) * 0.2);
    updatedPlayer.money = addMoney(updatedPlayer.money, { gold: 0, silver: 0, copper: -loseCopper });
    if (!updatedPlayer.statusEffects.includes('疲劳' as any)) {
      updatedPlayer.statusEffects = [...updatedPlayer.statusEffects, '疲劳' as any];
    }
    logs.push(makeLog('system', `战败惩罚：HP恢复至${defeatHp}，失去${loseCopper}铜币，获得「疲劳」状态。`, round));
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
    // Apply defeat penalty
    const defeatHp = Math.max(1, Math.floor(updatedPlayer.resources.maxHp * 0.2));
    updatedPlayer.resources.hp = defeatHp;
    const loseCopper = Math.floor((updatedPlayer.money.gold * 10000 + updatedPlayer.money.silver * 100 + updatedPlayer.money.copper) * 0.2);
    updatedPlayer.money = addMoney(updatedPlayer.money, { gold: 0, silver: 0, copper: -loseCopper });
    if (!updatedPlayer.statusEffects.includes('疲劳' as any)) {
      updatedPlayer.statusEffects = [...updatedPlayer.statusEffects, '疲劳' as any];
    }
    logs.push(makeLog('system', `战败惩罚：HP恢复至${defeatHp}，失去${loseCopper}铜币，获得「疲劳」状态。`, round));
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

// === Buff skill definitions ===
interface BuffDef { name: string; type: 'attack' | 'defense' | 'shield'; value: number; duration: number; desc: string; }
const BUFF_SKILLS: Record<string, BuffDef> = {
  rage: { name: '狂暴', type: 'attack', value: 3, duration: 2, desc: '攻击力大幅上升，防御降低' },
  blessing: { name: '祝福', type: 'attack', value: 2, duration: 2, desc: '获得神圣祝福，攻击力提升' },
  inspire: { name: '鼓舞', type: 'attack', value: 2, duration: 1, desc: '士气高涨，下次攻击+2' },
  shield_block: { name: '格挡', type: 'shield', value: 2, duration: 1, desc: '举起盾牌，吸收下次伤害' },
  mana_shield: { name: '魔力护盾', type: 'shield', value: 3, duration: 1, desc: '魔力凝聚成护盾' },
  holy_shield: { name: '圣盾', type: 'shield', value: 3, duration: 1, desc: '圣光护体' },
  duel_footwork: { name: '决斗步法', type: 'defense', value: 2, duration: 2, desc: '轻盈步法，闪避提升' },
  stealth_step: { name: '潜行步', type: 'defense', value: 2, duration: 1, desc: '阴影中移动，下次攻击有利' },
  counter_strike: { name: '反击姿态', type: 'attack', value: 2, duration: 1, desc: '格挡后反击伤害提升' },
};
function getSkillBuff(skillId: string): BuffDef | null { return BUFF_SKILLS[skillId] || null; }
function getSkillByIdFromImport(skillId: string): { name: string; mpCost: number } | null {
  const s = SKILL_LIBRARY[skillId];
  return s ? { name: s.name, mpCost: s.castRequirements.mpCost || 0 } : null;
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
