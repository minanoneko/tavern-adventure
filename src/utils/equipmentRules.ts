import type { Player, EquipmentItem, Trait, EquipmentPenalty } from '../types';
import { getEquipmentById } from '../data/equipment';

export function canEquipItem(item: EquipmentItem, player: Player): { canEquip: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const req = item.requirements;

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

export function isTraitActive(trait: Trait, player: Player): boolean {
  const rule = trait.activationRule;

  switch (rule.type) {
    case 'attribute':
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
