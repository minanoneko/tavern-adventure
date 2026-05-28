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
