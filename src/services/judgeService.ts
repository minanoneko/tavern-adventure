import type { Player, PlayerAction, JudgeResult, JudgeOutcome, Difficulty } from '../types';
import type { AttributeKey } from '../types/common';
import { ATTRIBUTE_LABELS } from '../types/common';
import { getSkillById } from '../data/skills';
import { getEquipmentById } from '../data/equipment';

function d20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function getDifficultyDC(difficulty: Difficulty): number {
  switch (difficulty) {
    case '简单': return 8;
    case '普通': return 12;
    case '困难': return 16;
    case '极难': return 20;
    case '几乎不可能': return 25;
  }
}

function difficultyFromRisk(risk: string): Difficulty {
  switch (risk) {
    case 'low': return '简单';
    case 'medium': return '普通';
    case 'high': return '困难';
    case 'extreme': return '极难';
    default: return '普通';
  }
}

function getAttributeModifier(attrValue: number): number {
  if (attrValue >= 9) return 4;
  if (attrValue >= 8) return 3;
  if (attrValue >= 7) return 2;
  if (attrValue >= 6) return 1;
  if (attrValue >= 5) return 0;
  if (attrValue >= 4) return -1;
  return -2;
}

function getOutcome(roll: number, dc: number): JudgeOutcome {
  const diff = roll - dc;
  if (diff >= 8) return '大成功';
  if (diff >= 0) return '成功';
  if (diff >= -4) return '部分成功';
  if (diff >= -8) return '失败';
  return '大失败';
}

/** Returns true if this action type actually needs a dice roll */
export function needsCheck(action: PlayerAction): boolean {
  // No check needed for these types
  const noCheckTypes = ['item', 'cautious', 'trade', 'growth'];
  if (noCheckTypes.includes(action.type)) return false;
  // No check if no attribute is involved
  const attr = action.relatedAttribute as string | undefined;
  if (!attr || attr === 'none') return false;
  return true;
}

export function evaluate(
  player: Player,
  action: PlayerAction,
  _worldState?: { currentLocation: string }
): JudgeResult {
  // Determine difficulty
  const difficulty = action.difficultyPreview
    ? (action.difficultyPreview as Difficulty)
    : difficultyFromRisk(action.risk);
  const dc = getDifficultyDC(difficulty);

  // Determine attribute modifier
  const rawAttr = action.relatedAttribute as string | undefined;
  let modifier = 0;
  let attrLabel = '';

  if (rawAttr && rawAttr !== 'none') {
    const attrKey = rawAttr as AttributeKey;
    const attrValue = player.attributes[attrKey] ?? 5;
    modifier = getAttributeModifier(attrValue);
    attrLabel = ATTRIBUTE_LABELS[attrKey];
  }

  // Skill bonus
  let skillLabel = '';
  if (action.relatedSkill) {
    const skill = getSkillById(action.relatedSkill);
    if (skill && player.skills.learned.includes(action.relatedSkill)) {
      modifier += 2;
      skillLabel = skill.name;
    }
  }

  // Equipment bonus
  const equipBonus = getEquipmentBonus(player);
  modifier += equipBonus;

  // Roll
  const roll = d20();
  const total = roll + modifier;
  const outcome = getOutcome(total, dc);

  // Consumption
  const consumption = {
    mp: action.mpCost || 0,
    hp: 0,
  };

  // Notes
  const notes = outcome === '大成功'
    ? `${attrLabel ? `${attrLabel}属性 + ` : ''}${skillLabel ? `${skillLabel} + ` : ''}${equipBonus > 0 ? `装备修正 +${equipBonus} ` : ''}判定：掷骰 ${roll} + 修正 ${modifier} = ${total} vs DC ${dc} → 大成功！`
    : outcome === '成功'
      ? `${attrLabel ? `${attrLabel}判定：` : ''}${roll} + ${modifier} = ${total} vs DC ${dc} → 成功`
      : outcome === '部分成功'
        ? `${attrLabel ? `${attrLabel}判定：` : ''}${roll} + ${modifier} = ${total} vs DC ${dc} → 部分成功`
        : `${attrLabel ? `${attrLabel}判定：` : ''}${roll} + ${modifier} = ${total} vs DC ${dc} → ${outcome}`;

  return {
    outcome,
    roll: total,
    dc,
    modifier,
    relatedAttribute: attrLabel,
    relatedSkill: skillLabel || undefined,
    consumption,
    notes,
  };
}

function getEquipmentBonus(player: Player): number {
  let bonus = 0;
  const equipIds = Object.values(player.equipment).filter(Boolean) as string[];
  for (const id of equipIds) {
    const equip = getEquipmentById(id);
    if (equip) {
      // Simple: each equipped item gives +1 to the attribute it boosts
      for (const val of Object.values(equip.stats)) {
        bonus += Math.min(val as number, 2) * 0.5;
      }
    }
  }
  return Math.floor(bonus);
}

export function parseCustomAction(input: string, _player: Player): PlayerAction {
  // Simple local parsing for custom actions
  const lower = input.toLowerCase();

  let actionType = 'other';
  let relatedAttr: string | undefined;
  let risk: 'low' | 'medium' | 'high' | 'extreme' = 'medium';

  // Type detection
  if (lower.includes('观察') || lower.includes('查看') || lower.includes('检查') || lower.includes('注意')) {
    actionType = 'check';
    relatedAttr = 'wis';
    risk = 'low';
  } else if (lower.includes('攻击') || lower.includes('砍') || lower.includes('打') || lower.includes('射')) {
    actionType = 'combat';
    relatedAttr = 'str';
    risk = 'high';
  } else if (lower.includes('潜行') || lower.includes('躲') || lower.includes('隐藏') || lower.includes('悄悄')) {
    actionType = 'stealth';
    relatedAttr = 'dex';
    risk = 'medium';
  } else if (lower.includes('说服') || lower.includes('威吓') || lower.includes('欺骗') || lower.includes('交涉')) {
    actionType = 'social';
    relatedAttr = 'cha';
    risk = 'medium';
  } else if (lower.includes('施法') || lower.includes('魔力') || lower.includes('魔法') || lower.includes('术')) {
    actionType = 'magic';
    relatedAttr = 'int';
    risk = 'medium';
  } else if (lower.includes('离开') || lower.includes('逃跑') || lower.includes('撤退')) {
    actionType = 'travel';
    risk = 'low';
  } else if (lower.includes('使用') || lower.includes('喝') || lower.includes('投掷')) {
    actionType = 'item';
    risk = 'medium';
  }

  return {
    id: `custom_${Date.now()}`,
    label: input.slice(0, 30),
    type: actionType,
    risk,
    relatedAttribute: relatedAttr,
    relatedSkill: null,
    mpCost: 0,
    isCustom: true,
    customText: input,
  };
}
