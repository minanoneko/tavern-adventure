import type { Player } from '../../types';
import type { CombatState, CombatEnemyState, CombatAction, CombatResolution, CombatLogEntry, CombatSkillInfo, CombatBuff } from '../../types/combat';
import { d20, getAttributeModifier, rollCheck, getPlayerDefense } from './dice';
import { getSkillById } from '../../data/skills';
import { canCastSkill, getSkillLockReasons } from '../../utils/skillRules';

// ========== Legal Actions ==========

export function getLegalCombatActions(player: Player, combatState: CombatState): CombatAction[] {
  const actions: CombatAction[] = [];
  const aliveEnemies = combatState.enemies.filter(e => !e.isDefeated);

  // Can player act?
  const canAct = canPlayerAct(player);

  if (!canAct) return actions;

  if (aliveEnemies.length > 0) {
    const targetId = aliveEnemies[0].id;

    // Basic attack
    actions.push({ type: 'attack', label: '攻击', targetEnemyId: targetId });

    // Skills that can be used in combat
    for (const skillId of player.skills.learned) {
      const skill = getSkillById(skillId);
      if (!skill) continue;
      if (!['combat', 'magic', 'active', 'reaction'].includes(skill.type)) continue;

      const skillInfo = buildCombatSkillInfo(skill, player);
      if (skillInfo) {
        actions.push({
          type: 'skill',
          label: skill.name,
          skillId: skill.id,
          targetEnemyId: targetId,
        });
      }
    }

    // Usable combat items from inventory
    for (const item of player.inventory) {
      if (item.quantity <= 0) continue;
      if (['consumable'].includes(item.type) || item.id === 'healing_potion' || item.id === 'fire_bomb' || item.id === 'smoke_bomb') {
        actions.push({
          type: 'item',
          label: `${item.name} (x${item.quantity})`,
          itemId: item.id,
          targetEnemyId: item.id.includes('bomb') || item.id.includes('smoke') ? targetId : undefined,
        });
      }
    }
  }

  // Always available
  actions.push({ type: 'defend', label: '防御' });
  actions.push({ type: 'flee', label: '逃跑' });
  actions.push({ type: 'observe', label: '观察敌人' });

  return actions;
}

function canPlayerAct(player: Player): boolean {
  const status = player.statusEffects;
  if (status.includes('束缚') || status.includes('恐惧')) {
    return false;
  }
  return true;
}

function buildCombatSkillInfo(skill: ReturnType<typeof getSkillById>, player: Player): CombatSkillInfo | null {
  if (!skill) return null;
  if (!canCastSkill(skill, player) && player.resources.mp < (skill.castRequirements.mpCost || 0)) return null;

  const reasons = getSkillLockReasons(skill, player);
  // Only block if it's a hard lock (not just MP cost)
  const hardBlock = reasons.filter(r =>
    !r.includes('MP') && !r.includes('冷却'),
  );
  if (hardBlock.length > 0) return null;

  return {
    skillId: skill.id,
    name: skill.name,
    mpCost: skill.castRequirements.mpCost || 0,
    hpCost: skill.castRequirements.hpCost || 0,
    damageMultiplier: skill.rarity === 'uncommon' ? 1.5 : skill.rarity === 'rare' ? 2.0 : 1.0,
    description: skill.description,
    requiresWeaponType: skill.castRequirements.requiresWeaponType,
    requiresEquipment: skill.castRequirements.requiresEquipment,
    requiresItem: skill.castRequirements.requiresItem,
    oncePerRest: skill.castRequirements.oncePerRest,
    currentCooldown: 0, // Will be managed by combat state
  };
}

// ========== Validate Action ==========

export function validateCombatAction(
  action: CombatAction,
  player: Player,
  combatState: CombatState,
): { valid: boolean; reason?: string } {
  const enemy = combatState.enemies.find(e => e.id === action.targetEnemyId);
  if (action.type === 'attack' || action.type === 'skill') {
    if (!enemy) return { valid: false, reason: '目标不存在' };
    if (enemy.isDefeated) return { valid: false, reason: '目标已被击败' };
  }

  if (action.type === 'skill' && action.skillId) {
    const skill = getSkillById(action.skillId);
    if (!skill) return { valid: false, reason: '技能不存在' };
    if (!player.skills.learned.includes(action.skillId)) {
      return { valid: false, reason: '未学会此技能' };
    }
    if (skill.castRequirements.mpCost && player.resources.mp < skill.castRequirements.mpCost) {
      return { valid: false, reason: 'MP不足' };
    }
    const reasons = getSkillLockReasons(skill, player).filter(r =>
      !r.includes('MP'),
    );
    if (reasons.length > 0) {
      return { valid: false, reason: reasons.join('、') };
    }
  }

  if (action.type === 'item' && action.itemId) {
    const item = player.inventory.find(i => i.id === action.itemId);
    if (!item || item.quantity <= 0) return { valid: false, reason: '物品不足' };
  }

  if (!canPlayerAct(player)) {
    return { valid: false, reason: '当前状态无法行动' };
  }

  return { valid: true };
}

// ========== Hit & Damage ==========

export function calculateHitRoll(attackerDex: number, defenderDex: number): { roll: number; total: number; hit: boolean } {
  const atkMod = getAttributeModifier(attackerDex);
  const defValue = 10 + getAttributeModifier(defenderDex);
  const { roll, total } = rollCheck(atkMod);
  return { roll, total, hit: total >= defValue };
}

export function calculateDamage(str: number, skillMultiplier: number = 1.0, isDefending: boolean = false): number {
  const base = 2 + getAttributeModifier(str);
  let damage = Math.max(1, Math.floor(base * skillMultiplier));
  if (isDefending) damage = Math.max(1, Math.floor(damage / 2));
  return damage;
}

// ========== Apply Combat Result ==========

export function applyCombatResult(
  player: Player,
  enemy: CombatEnemyState,
  action: CombatAction,
  combatState: CombatState,
): CombatResolution {
  const { roll, total, hit } = calculateHitRoll(player.attributes.dex, enemy.dex);

  let damage = 0;
  let mpCost = 0;
  let hpCost = 0;
  const results: string[] = [];

  const updatedEnemy = { ...enemy };

  // Skill cost always deducted, even on miss
  if (action.type === 'skill' && action.skillId) {
    const skill = getSkillById(action.skillId);
    if (skill) {
      mpCost = skill.castRequirements.mpCost || 0;
      hpCost = skill.castRequirements.hpCost || 0;
    }
  }

  if (hit) {
    let multiplier = 1.0;
    if (action.type === 'skill' && action.skillId) {
      const skill = getSkillById(action.skillId);
      if (skill) {
        multiplier = skill.rarity === 'uncommon' ? 1.5 : skill.rarity === 'rare' ? 2.0 : 1.0;
      }
    }

    damage = calculateDamage(player.attributes.str, multiplier);

    // Item effects
    if (action.itemId === 'fire_bomb') {
      damage += 6;
      results.push('燃烧瓶额外火焰伤害 +6');
    }

    updatedEnemy.hp = Math.max(0, updatedEnemy.hp - damage);
    results.push(`命中！造成 ${damage} 点伤害（掷骰 ${total}）`);
  } else {
    results.push(`未命中（掷骰 ${total}）`);
  }

  if (updatedEnemy.hp <= 0) {
    updatedEnemy.isDefeated = true;
    updatedEnemy.hp = 0;
    results.push(`${updatedEnemy.name} 被击败！`);
  }

  // Smoke bomb effect
  if (action.itemId === 'smoke_bomb') {
    results.push('烟雾遮蔽，下次逃跑判定+4');
  }

  return {
    action,
    hit,
    roll: total,
    damage,
    targetEnemy: updatedEnemy,
    playerHpChange: -hpCost,
    playerMpChange: -mpCost,
    appliedEffects: [],
    results,
  };
}

// ========== Enemy Turn ==========

export function enemyAttack(
  player: Player,
  enemy: CombatEnemyState,
  playerBuffs: CombatBuff[],
): { damage: number; hit: boolean; roll: number; results: string[] } {
  const shield = playerBuffs.find(b => b.type === 'shield');
  const defenseBonus = playerBuffs.find(b => b.type === 'defense');
  const playerDef = getPlayerDefense(player.attributes.dex, defenseBonus?.value);
  const { roll, total } = rollCheck(getAttributeModifier(enemy.dex));
  const hit = total >= playerDef;

  const results: string[] = [];
  let damage = 0;

  if (hit) {
    damage = Math.max(1, 2 + getAttributeModifier(enemy.str));
    if (shield) {
      const absorbed = Math.min(damage, shield.value);
      damage -= absorbed;
      results.push(`${enemy.name} 攻击命中！护盾吸收了 ${absorbed} 点，实际受到 ${damage} 点伤害`);
    } else {
      results.push(`${enemy.name} 攻击命中！造成 ${damage} 点伤害`);
    }
  } else {
    results.push(`${enemy.name} 攻击未命中`);
  }

  return { damage, hit, roll: total, results };
}

// ========== Victory / Defeat ==========

export function checkVictoryDefeat(player: Player, combatState: CombatState): 'ongoing' | 'victory' | 'defeat' {
  const aliveEnemies = combatState.enemies.filter(e => !e.isDefeated);
  if (aliveEnemies.length === 0) return 'victory';
  if (player.resources.hp <= 0) return 'defeat';
  return 'ongoing';
}

// ========== Flee Check ==========

export function tryFlee(player: Player): boolean {
  const mod = getAttributeModifier(player.attributes.dex);
  const { total } = rollCheck(mod);
  return total >= 14;
}

// ========== Observe ==========

export function observeEnemy(enemy: CombatEnemyState): string {
  const powerEstimate = enemy.level > playerLevel(enemy) + 1 ? '强大' : enemy.level > 1 ? '相当' : '弱小';
  const hpRatio = enemy.hp / enemy.maxHp;
  const woundState = hpRatio <= 0.3 ? '重伤' : hpRatio <= 0.6 ? '受伤' : hpRatio <= 0.8 ? '轻伤' : '完好';
  return `观察 ${enemy.name} (Lv.${enemy.level})：${powerEstimate}的对手，${woundState}。`;
}

function playerLevel(e: CombatEnemyState): number { return e.level; }

// ========== Buff tick ==========

export function tickBuffs(buffs: CombatBuff[]): CombatBuff[] {
  return buffs
    .map(b => ({ ...b, duration: b.duration - 1 }))
    .filter(b => b.duration > 0);
}
