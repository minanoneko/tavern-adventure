import type { Player, PlayerAction, JudgeResult, JudgeOutcome } from '../types';
import type { AttributeKey } from '../types/common';
import { ATTRIBUTE_LABELS } from '../types/common';
import { getSkillById } from '../data/skills';

function d20(): number {
  return Math.floor(Math.random() * 20) + 1;
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

/** Returns true only if requiresCheck is explicitly set to true */
export function needsCheck(action: PlayerAction): boolean {
  if (action.type === 'combat') return false;
  if (action.requiresCheck === false) return false;
  if (action.requiresCheck === true) {
    return !!(action.checkAttribute || action.relatedAttribute);
  }
  return false;
}

export function evaluate(
  player: Player,
  action: PlayerAction,
  _worldState?: { currentLocation: string }
): JudgeResult {
  // Use action.difficultyClass if provided, otherwise default 12
  const dc = action.difficultyClass ?? 12;

  // Determine attribute modifier
  const rawAttr = (action.checkAttribute || action.relatedAttribute) as string | undefined;
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

  // Roll
  const roll = d20();
  const total = roll + modifier;
  const outcome = getOutcome(total, dc);

  return {
    outcome,
    roll,        // raw d20 value
    dc,
    modifier,
    relatedAttribute: attrLabel,
    relatedSkill: skillLabel || undefined,
    consumption: { mp: action.mpCost || 0, hp: 0 },
    notes: `d20=${roll} 修正=+${modifier} 总值=${total} DC=${dc} → ${outcome}`,
  };
}
