import type { Player, Skill, SkillStatus, SkillLockInfo } from '../types';
import { getSkillById } from '../data/skills';
import { getEquipmentById } from '../data/equipment';

export function canLearnSkill(skill: Skill, player: Player): boolean {
  const req = skill.learnRequirements;
  if (req.minLevel && player.level < req.minLevel) return false;
  if (req.prerequisiteSkills) {
    for (const sid of req.prerequisiteSkills) {
      if (!player.skills.learned.includes(sid)) return false;
    }
  }
  if (req.attributes) {
    for (const [key, val] of Object.entries(req.attributes)) {
      if ((player.attributes[key as keyof typeof player.attributes] ?? 0) < val) return false;
    }
  }
  return true;
}

export function canCastSkill(skill: Skill, player: Player, currentLocation?: string): boolean {
  const req = skill.castRequirements;
  if (req.minLevel && player.level < req.minLevel) return false;
  if (req.mpCost && player.resources.mp < req.mpCost) return false;
  if (req.hpCost && player.resources.hp < req.hpCost) return false;
  if (req.attributes) {
    for (const [key, val] of Object.entries(req.attributes)) {
      if ((player.attributes[key as keyof typeof player.attributes] ?? 0) < val) return false;
    }
  }
  // Check weapon type requirement
  if (req.requiresWeaponType) {
    const mainWeapon = player.equipment.mainWeapon;
    if (!mainWeapon) return false;
    const equip = getEquipmentById(mainWeapon);
    if (!equip || equip.slot !== 'mainWeapon') return false;
    // Simple check: weapon ID includes the type
    if (req.requiresWeaponType === 'staff' && !mainWeapon.includes('staff')) return false;
    if (req.requiresWeaponType === 'bow' && !mainWeapon.includes('bow')) return false;
    if (req.requiresWeaponType === 'sword' && !mainWeapon.includes('sword')) return false;
    if (req.requiresWeaponType === 'dagger' && !mainWeapon.includes('dagger')) return false;
  }
  // Check equipment requirement
  if (req.requiresEquipment) {
    const hasEquipment = Object.values(player.equipment).some(id => id === req.requiresEquipment);
    if (!hasEquipment) return false;
  }
  // Check item requirement
  if (req.requiresItem) {
    if (!player.inventory.some(i => i.id === req.requiresItem)) return false;
  }
  if (req.requiresStatusFree) {
    for (const status of req.requiresStatusFree) {
      if (player.statusEffects.includes(status as any)) return false;
    }
  }
  if (req.requiresLocation && currentLocation && !req.requiresLocation.includes(currentLocation)) {
    return false;
  }
  return true;
}

export function getSkillLockReasons(skill: Skill, player: Player, currentLocation?: string): string[] {
  const reasons: string[] = [];
  const req = skill.castRequirements;

  if (req.minLevel && player.level < req.minLevel) {
    reasons.push(`等级不足，需要 Lv.${req.minLevel}`);
  }
  if (req.mpCost && player.resources.mp < req.mpCost) {
    reasons.push(`MP 不足，需要 ${req.mpCost} MP`);
  }
  if (req.hpCost && player.resources.hp < req.hpCost) {
    reasons.push(`HP 不足，需要 ${req.hpCost} HP`);
  }
  if (req.attributes) {
    for (const [key, val] of Object.entries(req.attributes)) {
      const attrLabels: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
      if ((player.attributes[key as keyof typeof player.attributes] ?? 0) < val) {
        reasons.push(`${attrLabels[key]}不足，需要 ${val}`);
      }
    }
  }
  if (req.requiresWeaponType) {
    const mainWeapon = player.equipment.mainWeapon;
    const hasWeapon = mainWeapon && (
      (req.requiresWeaponType === 'staff' && mainWeapon.includes('staff')) ||
      (req.requiresWeaponType === 'bow' && mainWeapon.includes('bow')) ||
      (req.requiresWeaponType === 'sword' && mainWeapon.includes('sword')) ||
      (req.requiresWeaponType === 'dagger' && mainWeapon.includes('dagger'))
    );
    if (!hasWeapon) {
      const label = req.requiresWeaponType === 'staff' ? '法杖' : req.requiresWeaponType === 'bow' ? '弓' : req.requiresWeaponType === 'dagger' ? '匕首' : req.requiresWeaponType === 'sword' ? '剑' : req.requiresWeaponType;
      reasons.push(`需要装备${label}`);
    }
  }
  if (req.requiresEquipment) {
    const hasEquip = Object.values(player.equipment).some(id => id === req.requiresEquipment);
    if (!hasEquip) {
      reasons.push(`需要装备：${req.requiresEquipment}`);
    }
  }
  if (req.requiresStatusFree) {
    for (const status of req.requiresStatusFree) {
      if (player.statusEffects.includes(status as any)) {
        reasons.push(`当前处于${status}状态`);
      }
    }
  }
  if (req.requiresLocation && currentLocation && !req.requiresLocation.includes(currentLocation)) {
    reasons.push('当前地点不能释放');
  }
  if (req.requiresItem && !player.inventory.some(i => i.id === req.requiresItem)) {
    reasons.push(`缺少材料：${req.requiresItem}`);
  }

  return reasons;
}

export function getSkillStatus(skillId: string, player: Player, currentLocation?: string): SkillStatus {
  const skill = getSkillById(skillId);
  if (!skill) return 'undiscovered';

  const learned = player.skills.learned.includes(skillId);
  const discovered = player.skills.discovered.includes(skillId);

  if (!learned && !discovered) return 'undiscovered';
  if (learned && canCastSkill(skill, player, currentLocation)) return 'castable';
  if (learned && !canCastSkill(skill, player, currentLocation)) return 'learned_locked';
  if (discovered && canLearnSkill(skill, player)) return 'learnable';
  if (discovered && !canLearnSkill(skill, player)) return 'not_learnable';

  return 'undiscovered';
}

export function getSkillLockInfo(skillId: string, player: Player, currentLocation?: string): SkillLockInfo | null {
  const skill = getSkillById(skillId);
  if (!skill) return null;

  const status = getSkillStatus(skillId, player, currentLocation);
  const reasons = status === 'learned_locked'
    ? getSkillLockReasons(skill, player, currentLocation)
    : [];

  return { skillId, skillName: skill.name, status, lockReasons: reasons };
}

export function getAllSkillInfos(player: Player, currentLocation?: string): SkillLockInfo[] {
  const allIds = [...player.skills.learned, ...player.skills.discovered];
  return allIds
    .map(id => getSkillLockInfo(id, player, currentLocation))
    .filter((s): s is SkillLockInfo => s !== null);
}

// ====== Skill Slots & Equip ======

/** Calculate total used skill slots from equipped skills */
export function getUsedSkillSlots(player: Player): number {
  return player.skills.equipped.reduce((sum, sid) => {
    const skill = getSkillById(sid);
    return sum + (skill?.slotCost || 1);
  }, 0);
}

export function isSkillEquipped(player: Player, skillId: string): boolean {
  return player.skills.equipped.includes(skillId);
}

/** Check if current location allows skill loadout changes */
export function canChangeSkillLoadout(worldState?: { currentLocation: string; combatState?: { active: boolean } }): boolean {
  if (!worldState) return false;
  if (worldState.combatState?.active) return false;
  const safeLocations = ['gray_deer_tavern', 'whitestone_inn', 'adventurers_guild_branch', 'small_chapel'];
  return safeLocations.includes(worldState.currentLocation);
}

/** Check if player can learn a skill */
export function canLearn(player: Player, skill: Skill): boolean {
  if (player.skills.learned.includes(skill.id)) return false;
  if (player.skills.learnTokens <= 0) return false;
  const req = skill.learnRequirements;
  if (req.minLevel && player.level < req.minLevel) return false;
  if (req.requiredClassOrigin && !req.requiredClassOrigin.includes(player.classOrigin)) return false;
  if (req.attributes) {
    for (const [k, v] of Object.entries(req.attributes)) {
      if ((player.attributes as any)[k] < v) return false;
    }
  }
  if (req.prerequisiteSkills) {
    for (const sid of req.prerequisiteSkills) {
      if (!player.skills.learned.includes(sid)) return false;
    }
  }
  if (req.requiredFlags) {
    for (const f of req.requiredFlags) {
      // flags are in worldState, not passed here. Skip for now.
    }
  }
  return true;
}

/** Equip a skill */
export function equipSkill(player: Player, skillId: string, worldState?: { currentLocation: string; combatState?: { active: boolean } }): { success: boolean; player: Player; reason?: string } {
  if (!canChangeSkillLoadout(worldState)) {
    return { success: false, player, reason: '当前位置不允许替换技能（需要酒馆/旅店/安全营地）' };
  }
  if (!player.skills.learned.includes(skillId)) {
    return { success: false, player, reason: '未学会该技能' };
  }
  if (player.skills.equipped.includes(skillId)) {
    return { success: false, player, reason: '技能已装备' };
  }
  const skill = getSkillById(skillId);
  if (!skill) return { success: false, player, reason: '技能不存在' };

  const used = getUsedSkillSlots(player);
  if (used + skill.slotCost > player.skills.maxSlots) {
    return { success: false, player, reason: `技能栏不足（${used}/${player.skills.maxSlots}，需${skill.slotCost}格）` };
  }

  const p = { ...player, skills: { ...player.skills, equipped: [...player.skills.equipped, skillId] } };
  return { success: true, player: p };
}

/** Unequip a skill */
export function unequipSkill(player: Player, skillId: string, worldState?: { currentLocation: string; combatState?: { active: boolean } }): { success: boolean; player: Player; reason?: string } {
  if (!canChangeSkillLoadout(worldState)) {
    return { success: false, player, reason: '当前位置不允许替换技能' };
  }
  if (!player.skills.equipped.includes(skillId)) {
    return { success: false, player, reason: '技能未装备' };
  }
  const p = { ...player, skills: { ...player.skills, equipped: player.skills.equipped.filter(s => s !== skillId) } };
  return { success: true, player: p };
}

/** Learn a skill (consume learnToken) */
export function learnSkill(player: Player, skillId: string): { success: boolean; player: Player; reason?: string } {
  const skill = getSkillById(skillId);
  if (!skill) return { success: false, player, reason: '技能不存在于技能库' };
  if (player.skills.learned.includes(skillId)) return { success: false, player, reason: '已学会' };
  if (!canLearn(player, skill)) {
    const reasons = getSkillLearnReasons(player, skill);
    return { success: false, player, reason: reasons.join('；') || '不满足学习条件' };
  }
  const p = {
    ...player,
    skills: {
      ...player.skills,
      learned: [...player.skills.learned, skillId],
      discovered: player.skills.discovered.filter(s => s !== skillId),
      learnTokens: player.skills.learnTokens - 1,
    },
  };
  return { success: true, player: p };
}

function getSkillLearnReasons(player: Player, skill: Skill): string[] {
  const reasons: string[] = [];
  const req = skill.learnRequirements;
  if (player.skills.learnTokens <= 0) reasons.push('没有新技能学习机会');
  if (req.minLevel && player.level < req.minLevel) reasons.push(`等级不足，需要Lv.${req.minLevel}`);
  if (req.attributes) {
    const labels: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
    for (const [k, v] of Object.entries(req.attributes)) {
      if ((player.attributes as any)[k] < v) reasons.push(`${labels[k] || k}不足，需要${v}`);
    }
  }
  if (req.prerequisiteSkills) {
    for (const sid of req.prerequisiteSkills) {
      if (!player.skills.learned.includes(sid)) {
        const pre = getSkillById(sid);
        reasons.push(`缺少前置技能：${pre?.name || sid}`);
      }
    }
  }
  return reasons.length > 0 ? reasons : ['不满足学习条件'];
}

/** Validate skill usage from custom text or AI output */
export function validateSkillAttempt(player: Player, skillNameOrId: string): { valid: boolean; skillId?: string; reason?: string } {
  // Try to find skill by name or id
  let skill = getSkillById(skillNameOrId);
  if (!skill) {
    // Search by name
    const allSkills = getAllSkillInfos(player);
    const found = allSkills.find(s => s.skillName === skillNameOrId);
    skill = found ? getSkillById(found.skillId) : undefined;
  }
  if (!skill) return { valid: false, reason: `未知技能"${skillNameOrId}"不在技能库中` };
  if (!player.skills.learned.includes(skill.id)) return { valid: false, skillId: skill.id, reason: `未学会技能"${skill.name}"` };
  if (!player.skills.equipped.includes(skill.id)) return { valid: false, skillId: skill.id, reason: `技能"${skill.name}"未装备到技能栏` };
  if (!canCastSkill(skill, player)) {
    const reasons = getSkillLockReasons(skill, player);
    return { valid: false, skillId: skill.id, reason: reasons.join('；') };
  }
  return { valid: true, skillId: skill.id };
}
