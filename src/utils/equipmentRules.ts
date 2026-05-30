import type { Player, EquipmentItem, Trait, EquipmentPenalty, Attributes, AttributeKey, EquipmentSlot } from '../types';
import { getEquipmentById } from '../data/equipment';

// ====== Weapon type classification ======
type WeaponCategory = 'staff' | 'bow' | 'sword' | 'dagger' | 'axe' | 'fist';
const ACTIVE_EQUIPMENT_SLOTS: EquipmentSlot[] = ['mainWeapon', 'armor', 'head', 'accessory1', 'accessory2'];
const ATTRIBUTE_KEYS: AttributeKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function getWeaponCategory(equipId: string): WeaponCategory {
  if (equipId.includes('staff') || equipId.includes('wand')) return 'staff';
  if (equipId.includes('bow') || equipId.includes('arrow')) return 'bow';
  if (equipId.includes('sword') || equipId.includes('blade')) return 'sword';
  if (equipId.includes('dagger') || equipId.includes('knife')) return 'dagger';
  if (equipId.includes('axe') || equipId.includes('greatsword') || equipId.includes('hammer')) return 'axe';
  return 'fist';
}

// ====== Class weapon restrictions ======
const CLASS_WEAPONS: Record<string, WeaponCategory[]> = {
  '魔法师': ['staff'],
  '游侠': ['bow', 'dagger'],
  '剑士': ['sword', 'axe'],
  '盗贼': ['dagger', 'sword'],
  '牧师': ['staff'],
  '野蛮人': ['axe'],
  '炼金术士': ['dagger', 'staff'],
  '贵族落魄子弟': ['sword', 'dagger'],
  '流浪者': ['staff', 'bow', 'sword', 'dagger', 'axe'],
  '吟游诗人': ['dagger', 'sword'],
  '学者': ['staff', 'dagger'],
  '猎魔人': ['sword', 'dagger', 'staff'],
};

export function canUseWeaponType(className: string, weaponType: WeaponCategory): boolean {
  return (CLASS_WEAPONS[className] || ['fist']).includes(weaponType);
}

export function canEquipItem(item: EquipmentItem, player: Player): { canEquip: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const req = item.requirements;

  // Weapon type restriction
  if (item.slot === 'mainWeapon') {
    const cat = getWeaponCategory(item.id);
    const className = player.classOrigin;
    if (!canUseWeaponType(className, cat)) {
      return { canEquip: false, warnings: [`你的职业无法使用此类武器（${cat}）`] };
    }
  }

  if (req.minLevel && player.level < req.minLevel) {
    warnings.push(`等级不足(Lv.${req.minLevel})，装备效果会打折扣`);
  }

  const attrLabels: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
  for (const [key, val] of Object.entries(req)) {
    if (key === 'minLevel') continue;
    const attrVal = player.attributes[key as keyof typeof player.attributes] ?? 0;
    if (attrVal < (val as number)) {
      warnings.push(`${attrLabels[key]}不足(需要${val}，当前${attrVal})`);
    }
  }

  return { canEquip: true, warnings }; // Always allow equipping
}

export function getEquipmentPenalty(item: EquipmentItem, player: Player): EquipmentPenalty {
  const req = item.requirements;
  let penaltyScore = 0;
  const blockedSkills: string[] = [];
  const inactiveTraits: Trait[] = [];
  const activeTraits: Trait[] = [];
  const warnings: string[] = [];

  if (req.minLevel && player.level < req.minLevel) {
    penaltyScore += (req.minLevel - player.level) * 0.2;
  }

  for (const [key, val] of Object.entries(req)) {
    if (key === 'minLevel') continue;
    const attrVal = player.attributes[key as keyof typeof player.attributes] ?? 0;
    if (attrVal < (val as number)) {
      const deficit = (val as number) - attrVal;
      penaltyScore += deficit * 0.15;
    }
  }

  const effectiveness = Math.max(0.1, 1 - penaltyScore);
  const hitPenalty = Math.max(0, penaltyScore * 0.5);

  // Check traits
  for (const trait of item.traits) {
    if (isTraitActive(trait, player)) {
      activeTraits.push(trait);
    } else {
      inactiveTraits.push(trait);
      warnings.push(`词条【${trait.name}】未激活`);
    }
  }

  if (penaltyScore > 0.3) {
    blockedSkills.push(...item.effects.filter(e => e.includes('技能')).map(e => e));
  }

  if (penaltyScore > 0) {
    warnings.push(`基础效果仅发挥 ${Math.round(effectiveness * 100)}%`);
    if (hitPenalty > 0) warnings.push(`命中下降`);
    if (blockedSkills.length > 0) warnings.push(`部分技能无法使用`);
  }

  return { canEquip: true, effectiveness, hitPenalty, blockedSkills, inactiveTraits, activeTraits, warnings };
}

export function getEquippedRuleItems(player: Player): EquipmentItem[] {
  return ACTIVE_EQUIPMENT_SLOTS
    .map(slot => player.equipment[slot])
    .filter((id): id is string => !!id)
    .map(id => getEquipmentById(id))
    .filter((item): item is EquipmentItem => !!item);
}

export function getEquipmentAttributeBonuses(player: Player): Partial<Attributes> {
  const bonuses: Partial<Attributes> = {};
  for (const item of getEquippedRuleItems(player)) {
    const penalty = getEquipmentPenalty(item, player);
    for (const key of ATTRIBUTE_KEYS) {
      const value = item.stats[key] ?? 0;
      if (!value) continue;
      const effectiveValue = Math.floor(value * penalty.effectiveness);
      if (effectiveValue > 0) {
        bonuses[key] = (bonuses[key] ?? 0) + effectiveValue;
      }
    }
  }
  return bonuses;
}

export function getEffectiveAttributes(player: Player): Attributes {
  const bonuses = getEquipmentAttributeBonuses(player);
  return ATTRIBUTE_KEYS.reduce((attrs, key) => {
    attrs[key] = Math.max(1, (player.attributes[key] ?? 0) + (bonuses[key] ?? 0));
    return attrs;
  }, { ...player.attributes });
}

export function getEquipmentDefenseBonus(player: Player): number {
  const armorId = player.equipment.armor;
  const armor = armorId ? getEquipmentById(armorId) : null;
  if (!armor) return 0;
  const penalty = getEquipmentPenalty(armor, player);
  const conBonus = armor.stats.con ?? 0;
  const dexBonus = armor.stats.dex ?? 0;
  return Math.max(0, Math.floor(Math.max(conBonus, dexBonus) * penalty.effectiveness));
}

export function getEquipmentDamageReduction(player: Player): number {
  const armorId = player.equipment.armor;
  const armor = armorId ? getEquipmentById(armorId) : null;
  if (!armor) return 0;
  const penalty = getEquipmentPenalty(armor, player);
  const text = armor.effects.join(' ');
  const match = text.match(/(?:减免|减伤)\+?(\d+)/);
  return match ? Math.floor(Number(match[1]) * penalty.effectiveness) : 0;
}

export function getEquipmentHitBonus(player: Player): number {
  const weaponId = player.equipment.mainWeapon;
  const weapon = weaponId ? getEquipmentById(weaponId) : null;
  if (!weapon) return 0;
  const penalty = getEquipmentPenalty(weapon, player);
  const text = weapon.effects.join(' ');
  const percent = text.match(/命中\+?(\d+)%/);
  const flat = text.match(/命中\+?(\d+)(?!%)/);
  const value = percent ? Math.max(1, Math.floor(Number(percent[1]) / 5)) : flat ? Number(flat[1]) : 0;
  return Math.floor(value * penalty.effectiveness);
}

export function getEquipmentDamageBonus(player: Player, damageKind: 'physical' | 'magic' | 'ranged' = 'physical'): number {
  const weaponId = player.equipment.mainWeapon;
  const weapon = weaponId ? getEquipmentById(weaponId) : null;
  if (!weapon) return 0;
  const penalty = getEquipmentPenalty(weapon, player);
  const text = weapon.effects.join(' ');
  let bonus = 0;

  for (const match of text.matchAll(/伤害\+?(\d+)/g)) {
    const before = text.slice(Math.max(0, match.index! - 4), match.index);
    const isMagic = before.includes('魔法');
    const isRanged = before.includes('远程');
    if (isMagic && damageKind !== 'magic') continue;
    if (isRanged && damageKind !== 'ranged') continue;
    bonus += Number(match[1]);
  }

  return Math.floor(bonus * penalty.effectiveness);
}

export function isTraitActive(trait: Trait, player: Player): boolean {
  const rule = trait.activationRule;

  switch (rule.type) {
    case 'attribute':
      if (rule.combinedAttributes) {
        const checks = Object.entries(rule.combinedAttributes.attrs).map(([key, min]) => {
          const attrVal = player.attributes[key as keyof typeof player.attributes] ?? 0;
          return attrVal >= (min as number);
        });
        return rule.combinedAttributes.requireAll === false
          ? checks.some(Boolean)
          : checks.every(Boolean);
      }
      if (rule.attribute) {
        const attrVal = player.attributes[rule.attribute.key] ?? 0;
        return attrVal >= rule.attribute.min;
      }
      return true;
    case 'skill_count':
      if (rule.skillCount) {
        const count = player.skills.learned.length;
        return count >= rule.skillCount.min;
      }
      return true;
    case 'faction_standing':
      if (rule.factionStanding) {
        const standing = player.relationships.find(r => r.targetId === rule.factionStanding!.factionId)?.standing ?? 0;
        return standing >= rule.factionStanding.min;
      }
      return true;
    case 'hp_threshold':
      if (rule.hpThreshold) {
        const hpPercent = player.resources.hp / player.resources.maxHp;
        return rule.hpThreshold.below ? hpPercent < rule.hpThreshold.percent / 100 : hpPercent > rule.hpThreshold.percent / 100;
      }
      return true;
    default:
      return false;
  }
}

export function getActiveTraits(itemId: string, player: Player): Trait[] {
  const item = getEquipmentById(itemId);
  if (!item) return [];
  return item.traits.filter(t => isTraitActive(t, player));
}

export function getInactiveTraitReasons(itemId: string, player: Player): { trait: Trait; reason: string }[] {
  const item = getEquipmentById(itemId);
  if (!item) return [];
  return item.traits
    .filter(t => !isTraitActive(t, player))
    .map(trait => ({ trait, reason: getTraitInactiveReason(trait, player) }));
}

function getTraitInactiveReason(trait: Trait, player: Player): string {
  const rule = trait.activationRule;
  switch (rule.type) {
    case 'attribute':
      if (rule.attribute) {
        const attrLabels: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
        return `${attrLabels[rule.attribute.key]}不足，需要 ${rule.attribute.min}`;
      }
      return '属性不满足';
    case 'skill_count':
      return `技能数量不足，需要至少 ${rule.skillCount?.min ?? 0} 个`;
    case 'faction_standing':
      return `阵营好感不足，需要 ${rule.factionStanding?.min ?? 0}`;
    case 'hp_threshold':
      return `HP条件不满足`;
    default:
      return '条件不满足';
  }
}
