import type { Player } from '../../types';
import type { CombatState, CombatEnemyState, CombatAction, CombatResolution, CombatLogEntry, CombatSkillInfo, CombatBuff } from '../../types/combat';
import type { Skill } from '../../types/skill';
import { d20, getAttributeModifier, rollCheck, getPlayerDefense } from './dice';
import { getSkillById } from '../../data/skills';
import { canCastSkill, getSkillLockReasons } from '../../utils/skillRules';
import { getWeaponCategory } from '../../utils/equipmentRules';
import { rollWeaponDamage, rollDice, getWeaponDamageDice } from './weaponDamage';

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

export function calculateHitRoll(attackerDex: number, defenderDex: number): {
  roll: number;
  total: number;
  modifier: number;
  ac: number;
  hit: boolean;
} {
  const atkMod = getAttributeModifier(attackerDex);
  const ac = 10 + getAttributeModifier(defenderDex);
  const { roll, total } = rollCheck(atkMod);
  return { roll, total, modifier: atkMod, ac, hit: total >= ac };
}

/**
 * Calculate damage with weapon dice + attribute modifier.
 * Skills with combatDamage override the dice/attribute used.
 * Skills without combatDamage fall back to the old rarity multiplier.
 */
export function calculateDamage(params: {
  weaponId: string | null;
  player: Player;
  skill?: Skill;
}): { damageRoll: number; damageModifier: number; damageTotal: number; detail: string } {
  const { weaponId, player, skill } = params;
  const cd = skill?.combatDamage;

  if (cd) {
    // New system: explicit combatDamage config
    let baseRoll = 0;
    const parts: string[] = [];

    // damageDice replaces weapon dice entirely (e.g. spark: "1d4")
    if (cd.damageDice) {
      const r = rollDice(cd.damageDice);
      baseRoll += r.roll;
      parts.push(r.detail);
    } else if (cd.useWeaponDice !== false) {
      // useWeaponDice defaults to true
      const r = rollWeaponDamage(weaponId);
      baseRoll += r.total;
      parts.push(r.detail);
    }

    // bonusDice always adds on top
    if (cd.bonusDice) {
      const r = rollDice(cd.bonusDice);
      baseRoll += r.roll;
      parts.push(r.detail);
    }

    // Attribute modifier
    const attrKey = cd.damageAttribute || 'str';
    const attrValue = (player.attributes as any)[attrKey] ?? player.attributes.str;
    const mod = getAttributeModifier(attrValue);
    const total = Math.max(1, baseRoll + mod);

    const attrLabel = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }[attrKey] || '力量';
    const modSign = mod >= 0 ? '+' : '';
    parts.push(`${attrLabel}${modSign}${mod}`);

    return { damageRoll: baseRoll, damageModifier: mod, damageTotal: total, detail: parts.join(' + ') };
  }

  // Fallback: old rarity multiplier system for skills without combatDamage
  const weaponResult = rollWeaponDamage(weaponId);
  const strMod = getAttributeModifier(player.attributes.str);
  const multiplier = skill
    ? (skill.rarity === 'uncommon' ? 1.5 : skill.rarity === 'rare' ? 2.0 : 1.0)
    : 1.0;
  const base = weaponResult.total + strMod;
  const damage = Math.max(1, Math.floor(base * multiplier));
  const modSign = strMod >= 0 ? '+' : '';
  return {
    damageRoll: weaponResult.total,
    damageModifier: strMod,
    damageTotal: damage,
    detail: `${weaponResult.detail} + 力量${modSign}${strMod}${multiplier !== 1 ? ` ×${multiplier}` : ''}`,
  };
}

/** Check if player has specific rare accessories equipped */
export function getEquipEffects(player: import('../../types').Player) {
  const acc = [player.equipment.accessory1, player.equipment.accessory2, player.equipment.feet];
  return {
    warriorBracer: acc.includes('warrior_bracer'),
    adventurerRing: acc.includes('adventurer_ring'),
    bloodstoneCharm: acc.includes('bloodstone_charm'),
    manaCrystal: acc.includes('mana_crystal'),
    guardianPendant: acc.includes('guardian_pendant'),
    sageAmulet: acc.includes('sage_amulet'),
    windBoots: acc.includes('wind_boots'),
    charmPendant: acc.includes('charm_pendant'),
    spiritRing: acc.includes('spirit_ring'),
  };
}

// ========== Apply Combat Result ==========

// ==== Combat narrative templates (local, no AI) ====
const ATTACK_ACTIONS: Record<string, ((p: string, e: string) => string)[]> = {
  staff: [
    (p, e) => `${p}挥动法杖，魔力激荡着袭向${e}`,
    (p, e) => `${p}用法杖释放一道能量冲击打向${e}`,
    (p, e) => `${p}举起法杖，魔法能量射向${e}`,
    (p, e) => `${p}法杖尖端闪烁光芒，击向${e}`,
  ],
  sword: [
    (p, e) => `${p}挥剑斩向${e}`,
    (p, e) => `${p}一记横扫攻向${e}`,
    (p, e) => `${p}箭步上前，利剑直刺${e}`,
    (p, e) => `${p}双手握剑劈向${e}`,
  ],
  bow: [
    (p, e) => `${p}拉弓搭箭射向${e}`,
    (p, e) => `${p}瞄准后一箭射向${e}的要害`,
    (p, e) => `${p}快速射出箭矢，直取${e}`,
    (p, e) => `${p}弓弦一响，箭矢飞向${e}`,
  ],
  dagger: [
    (p, e) => `${p}匕首快速刺向${e}的要害`,
    (p, e) => `${p}绕到侧面，匕首扎向${e}`,
    (p, e) => `${p}反握匕首戳向${e}`,
    (p, e) => `${p}短刃一闪，攻向${e}`,
  ],
  axe: [
    (p, e) => `${p}抡起沉重的武器砸向${e}`,
    (p, e) => `${p}猛地砸向${e}`,
    (p, e) => `${p}大步上前，重武器劈向${e}`,
    (p, e) => `${p}怒吼着挥动武器砸向${e}`,
  ],
  fist: [
    (p, e) => `${p}一拳打向${e}`,
    (p, e) => `${p}赤手空拳地攻击${e}`,
    (p, e) => `${p}猛踢向${e}`,
    (p, e) => `${p}扑上去用拳头揍向${e}`,
  ],
};
const ATTACK_HITS = [
  (d: number) => `命中！${e_react()}，造成了 ${d} 点伤害`,
  (d: number) => `精准命中要害！${d} 点伤害`,
  (d: number) => `${e_react()}，受到 ${d} 点伤害`,
  (d: number) => `攻击得手！${d} 点伤害`,
];
const ATTACK_MISSES = [
  () => '攻击落空了！',
  () => '敌人侧身闪避了攻击',
  () => '武器擦过敌人身旁，没有命中',
  () => '敌人堪堪躲过这一击',
];
const SKILL_CASTS: Record<string, string[]> = {
  heavy_strike: ['蓄力后猛然挥出重击！', '双手握剑，一记势大力沉的重击！'],
  backstab: ['从暗处刺出致命一击！', '绕到背后，匕首刺入！'],
  spark: ['指尖凝聚火焰，射出火苗！', '魔力涌动，火花四溅！'],
  fire_arrow: ['凝聚火焰成箭矢射出！', '火焰箭划破空气飞向敌人！'],
  smash: ['用蛮力猛砸过去！', '举起武器狠狠砸下！'],
  default: ['发动技能攻击！', '凝聚力量释放技能！'],
};
const ENEMY_ATTACKS = [
  (e: string) => `${e}猛扑过来！`,
  (e: string) => `${e}挥爪攻击`,
  (e: string) => `${e}张开大口咬来`,
  (e: string) => `${e}冲撞过来`,
  (e: string) => `${e}发出一声咆哮，攻了过来`,
];
const ENEMY_HITS = [
  () => '你被击中，踉跄后退！',
  () => '攻击命中，你咬紧牙关稳住身形。',
  () => '这一击擦过护甲，仍然造成了伤害。',
];
const ENEMY_MISSES = [
  () => '你闪开了攻击！',
  () => '攻击擦身而过',
  () => '你堪堪躲过',
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function e_react(): string { return pick(['敌人闷哼一声', '敌人吃痛后退', '敌人脚步踉跄', '敌人发出一声惨叫', '鲜血飞溅', '敌人咬牙硬撑']); }

export function applyCombatResult(
  player: Player,
  enemy: CombatEnemyState,
  action: CombatAction,
  combatState: CombatState,
): CombatResolution {
  const hitResult = calculateHitRoll(player.attributes.dex, enemy.dex);

  let damage = 0;
  let mpCost = 0;
  let hpCost = 0;
  let damageRoll = 0;
  let damageModifier = 0;
  let damageDetail = '';
  const results: string[] = [];

  const updatedEnemy = { ...enemy };
  const pName = player.name;

  // Skill cost always deducted, even on miss
  let skillUsed: ReturnType<typeof getSkillById> = undefined;
  const eqFx = getEquipEffects(player);
  if (action.type === 'skill' && action.skillId) {
    skillUsed = getSkillById(action.skillId);
    if (skillUsed) {
      mpCost = skillUsed.castRequirements.mpCost || 0;
      hpCost = skillUsed.castRequirements.hpCost || 0;
      if (eqFx.manaCrystal && mpCost > 0) mpCost = Math.max(1, mpCost - 1);
    }
  }

  // Action narrative
  if (action.flavorText) {
    results.push(action.flavorText);
  } else if (action.type === 'skill' && skillUsed) {
    const casts = SKILL_CASTS[action.skillId!] || SKILL_CASTS.default;
    results.push(pick(casts));
  } else {
    const wCat = getWeaponCategory(player.equipment.mainWeapon || '');
    results.push(pick(ATTACK_ACTIONS[wCat] || ATTACK_ACTIONS.fist)(pName, enemy.name));
  }

  if (hitResult.hit) {
    const dmgResult = calculateDamage({
      weaponId: player.equipment.mainWeapon,
      player,
      skill: skillUsed,
    });
    damage = dmgResult.damageTotal;
    damageRoll = dmgResult.damageRoll;
    damageModifier = dmgResult.damageModifier;
    damageDetail = dmgResult.detail;

    // warrior_bracer: +1 damage
    if (eqFx.warriorBracer) {
      damage += 1;
      damageDetail += ' + 腕甲1';
    }

    if (action.itemId === 'fire_bomb') { damage += 6; results.push('燃烧瓶额外火焰伤害 +6'); }

    updatedEnemy.hp = Math.max(0, updatedEnemy.hp - damage);
    results.push(`d20=${hitResult.roll} + 敏${hitResult.modifier} = ${hitResult.total} vs AC${hitResult.ac} → ${pick(ATTACK_HITS)(damage)}`);
    results.push(`${damageDetail} = ${damage}`);
  } else {
    results.push(`d20=${hitResult.roll} + 敏${hitResult.modifier} = ${hitResult.total} vs AC${hitResult.ac} → ${pick(ATTACK_MISSES)()}`);
  }

  if (updatedEnemy.hp <= 0) {
    updatedEnemy.isDefeated = true;
    updatedEnemy.hp = 0;
    results.push(`${updatedEnemy.name} 被击败！`);
  }

  if (action.itemId === 'smoke_bomb') {
    results.push('烟雾遮蔽，下次逃跑判定+4');
  }

  return {
    action,
    hit: hitResult.hit,
    roll: hitResult.total,
    damage,
    targetEnemy: updatedEnemy,
    playerHpChange: -hpCost,
    playerMpChange: -mpCost,
    appliedEffects: [],
    results,
    hitRoll: hitResult.roll,
    hitTotal: hitResult.total,
    targetAC: hitResult.ac,
    damageRoll,
    damageModifier,
    damageDetail,
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
  const dexMod = getAttributeModifier(enemy.dex);
  const { roll, total } = rollCheck(dexMod);
  const hit = total >= playerDef;

  const results: string[] = [];
  let damage = 0;

  results.push(pick(ENEMY_ATTACKS)(enemy.name));

  if (hit) {
    // Enemy uses unarmed dice (1d4) + STR mod, min 2
    const diceRoll = Math.floor(Math.random() * 4) + 1;
    const strMod = getAttributeModifier(enemy.str);
    damage = Math.max(2, diceRoll + strMod);
    const eqFx2 = getEquipEffects(player);
    if (eqFx2.adventurerRing) damage = Math.max(1, damage - 1);
    if (shield) {
      const absorbed = Math.min(damage, shield.value);
      damage -= absorbed;
      results.push(`d20=${roll}${dexMod >= 0 ? '+' : ''}${dexMod}=${total} vs 防御${playerDef} → 命中！护盾吸收${absorbed}，实际伤害${damage}`);
    } else {
      results.push(`d20=${roll}${dexMod >= 0 ? '+' : ''}${dexMod}=${total} vs 防御${playerDef} → 命中！伤害 1d4=${diceRoll}${strMod >= 0 ? '+' : ''}${strMod}=${damage}。${pick(ENEMY_HITS)()}`);
    }
  } else {
    results.push(`d20=${roll}${dexMod >= 0 ? '+' : ''}${dexMod}=${total} vs 防御${playerDef} → ${pick(ENEMY_MISSES)()}`);
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

// ========== Combat Custom Action Parser ==========

const SPECIAL_DEFAULTS: Record<string, { specialType: import('../../types/combat').CombatSpecialType; checkAttribute: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; defaultDC: number }> = {
  'call_help': { specialType: 'call_help', checkAttribute: 'cha', defaultDC: 14 },
  'summon': { specialType: 'summon', checkAttribute: 'cha', defaultDC: 14 },
  'taunt': { specialType: 'taunt', checkAttribute: 'cha', defaultDC: 14 },
  'distract': { specialType: 'distract', checkAttribute: 'dex', defaultDC: 12 },
  'negotiate': { specialType: 'negotiate', checkAttribute: 'cha', defaultDC: 16 },
  'use_environment': { specialType: 'use_environment', checkAttribute: 'str', defaultDC: 14 },
};

/**
 * Parse player's freeform combat text into a special CombatAction.
 * "召唤帮手" → call_help (CHA check, buff only, no actual NPC)
 * "推倒书架" → use_environment (STR check, extra damage)
 */
export function parseCombatCustomAction(
  text: string,
  _player: import('../../types').Player,
): import('../../types/combat').CombatAction {
  const t = text.trim();

  // Summon / call help
  if (/召唤|叫人|喊人|帮手|支援|求援|援军|呼救/.test(t)) {
    return {
      type: 'special',
      label: `呼救：${t.slice(0, 15)}`,
      specialType: 'call_help',
      checkAttribute: 'cha',
      difficultyClass: 14,
      checkReason: '尝试呼救或召唤帮手',
      flavorText: t,
    };
  }

  // Taunt / provoke
  if (/嘲讽|激怒|挑衅|辱骂|叫骂/.test(t)) {
    return {
      type: 'special',
      label: `嘲讽：${t.slice(0, 15)}`,
      specialType: 'taunt',
      checkAttribute: 'cha',
      difficultyClass: 14,
      checkReason: '尝试嘲讽或激怒敌人',
      flavorText: t,
    };
  }

  // Distract / kick sand / create opening
  if (/踢沙|干扰|制造.*破绽|分散.*注意|虚晃/.test(t)) {
    return {
      type: 'special',
      label: `干扰：${t.slice(0, 15)}`,
      specialType: 'distract',
      checkAttribute: 'dex',
      difficultyClass: 12,
      checkReason: '尝试制造破绽',
      flavorText: t,
    };
  }

  // Negotiate / parley
  if (/谈判|交涉|求饶|讲和|停战/.test(t)) {
    return {
      type: 'special',
      label: `交涉：${t.slice(0, 15)}`,
      specialType: 'negotiate',
      checkAttribute: 'cha',
      difficultyClass: 16,
      checkReason: '尝试与敌人交涉',
      flavorText: t,
    };
  }

  // Use environment (push pillar, smash lamp, etc.)
  if (/推倒|砸碎|利用.*环境|推.*柱子|砸.*灯|踢.*桌子|扔.*椅子|掀.*桌子/.test(t)) {
    return {
      type: 'special',
      label: `环境：${t.slice(0, 15)}`,
      specialType: 'use_environment',
      checkAttribute: 'str',
      difficultyClass: 14,
      checkReason: '利用环境进行攻击',
      flavorText: t,
    };
  }

  // Fallback: treat as general environment use
  return {
    type: 'special',
    label: `尝试：${t.slice(0, 15)}`,
    specialType: 'use_environment',
    checkAttribute: 'dex',
    difficultyClass: 14,
    checkReason: t,
    flavorText: t,
  };
}

/** Get default DC for a special action type */
export function getSpecialDefaultDC(specialType: string): number {
  return SPECIAL_DEFAULTS[specialType]?.defaultDC ?? 14;
}

/** Get default attribute for a special action type */
export function getSpecialDefaultAttr(specialType: string): 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' {
  return SPECIAL_DEFAULTS[specialType]?.checkAttribute ?? 'dex';
}
