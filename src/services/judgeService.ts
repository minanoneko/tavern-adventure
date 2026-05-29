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

// ========== Daily actions — NO CHECK needed ==========
const DAILY_ACTIONS = new Set([
  '喝酒', '吃饭', '坐下', '休息', '睡觉', '聊天', '闲聊', '打招呼',
  '扫地', '打扫', '擦桌子', '洗碗', '整理', '等待', '逛逛', '散步',
  '普通购买', '普通询问', '看看', '打量', '环顾', '站着', '发呆',
  '喝水', '点菜', '点餐', '付钱', '结账', '问路', '打听',
]);

/** Returns true if this action type actually needs a dice roll */
export function needsCheck(action: PlayerAction): boolean {
  // Daily actions: never check
  if (action.type === 'daily') return false;
  // No-check types
  const noCheckTypes = ['item', 'cautious', 'trade', 'growth', 'daily', 'dialogue'];
  if (noCheckTypes.includes(action.type)) return false;
  // Explicitly marked as no-check
  if (action.requiresCheck === false) return false;
  // No attribute involved
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
      for (const val of Object.values(equip.stats)) {
        bonus += Math.min(val as number, 2) * 0.5;
      }
    }
  }
  return Math.floor(bonus);
}

// ========== Combat keywords — must be explicit multi-char ==========
const COMBAT_KEYWORDS = [
  '攻击', '砍向', '刺向', '射击', '挥剑', '挥刀', '重击',
  '殴打', '打倒', '打死', '杀死', '斩杀', '射箭', '冲锋',
  '偷袭', '刺杀', '搏斗', '开战', '战斗',
];

function isCombatAction(input: string): boolean {
  return COMBAT_KEYWORDS.some(k => input.includes(k));
}

function isDailyAction(input: string): boolean {
  for (const action of DAILY_ACTIONS) {
    if (input.includes(action)) return true;
  }
  return false;
}

// ========== Check type detection ==========
function detectCheckType(input: string): { type: string; attr?: AttributeKey; skill?: string } {
  const lower = input.toLowerCase();

  // Trap / lock / disable device
  if (/拆除|解除.*陷阱|拆.*机关|解除.*机关/.test(input)) {
    return { type: 'check', attr: 'dex', skill: '巧手' };
  }
  if (/撬锁|开锁/.test(input)) {
    return { type: 'check', attr: 'dex', skill: '巧手' };
  }

  // Investigation / search
  if (/调查|搜索|寻找.*线索|搜查|仔细.*看/.test(input)) {
    return { type: 'check', attr: 'wis', skill: '调查' };
  }

  // Stealth
  if (/潜行|悄悄|绕过.*守卫|隐匿|躲藏/.test(input)) {
    return { type: 'stealth', attr: 'dex', skill: '潜行' };
  }

  // Persuasion
  if (/说服|劝说|交涉|谈判/.test(input)) {
    return { type: 'social', attr: 'cha', skill: '说服' };
  }

  // Intimidation
  if (/威吓|恐吓|威胁|吓唬/.test(input)) {
    return { type: 'social', attr: 'cha', skill: '威吓' };
  }

  // Deception
  if (/欺骗|伪装.*身份|冒充|说谎/.test(input)) {
    return { type: 'social', attr: 'cha', skill: '欺骗' };
  }

  // Magic / runes
  if (/辨认.*魔法|辨识.*符文|解读.*符文|分析.*魔法/.test(input)) {
    return { type: 'check', attr: 'int', skill: '奥秘' };
  }

  // Tracking / survival
  if (/追踪|野外.*生|打猎|采集/.test(input)) {
    return { type: 'check', attr: 'wis', skill: '生存' };
  }

  // Generic observe
  if (lower.includes('观察') || lower.includes('查看') || lower.includes('检查') || lower.includes('注意')) {
    return { type: 'check', attr: 'wis' };
  }

  return { type: 'other' };
}

export function parseCustomAction(input: string, _player: Player): PlayerAction {
  const lower = input.toLowerCase();

  // 1. Daily actions first — no check, no combat
  if (isDailyAction(input)) {
    return {
      id: `custom_${Date.now()}`,
      label: input.slice(0, 30),
      type: 'daily',
      risk: 'low',
      mpCost: 0,
      isCustom: true,
      customText: input,
      requiresCheck: false,
    };
  }

  // 2. Travel detection
  const travelKeywords = ['前往', '去', '进入', '离开', '来到', '抵达', '航向', '登上', '回到', '返回'];
  const isTravel = travelKeywords.some(k => input.includes(k));
  if (isTravel) {
    return {
      id: `custom_${Date.now()}`,
      label: input.slice(0, 30),
      type: 'travel',
      risk: 'medium',
      mpCost: 0,
      isCustom: true,
      customText: `玩家正在移动到新地点：${input}。请生成新地点的场景，不要回到酒馆或之前的地点。scene.location 必须更新为玩家去的新地点。`,
    };
  }

  // 3. Combat actions
  if (isCombatAction(input)) {
    return {
      id: `custom_${Date.now()}`,
      label: input.slice(0, 30),
      type: 'combat',
      risk: 'high',
      relatedAttribute: 'str',
      relatedSkill: null,
      mpCost: 0,
      isCustom: true,
      customText: input,
      requiresCheck: false,
    };
  }

  // 4. Check-type actions (traps, locks, stealth, social, etc.)
  const checkInfo = detectCheckType(input);
  if (checkInfo.type === 'check' || checkInfo.type === 'stealth' || checkInfo.type === 'social') {
    return {
      id: `custom_${Date.now()}`,
      label: input.slice(0, 30),
      type: checkInfo.type,
      risk: 'medium',
      relatedAttribute: checkInfo.attr,
      relatedSkill: null,
      mpCost: 0,
      isCustom: true,
      customText: input,
      requiresCheck: true,
      checkReason: input,
      checkAttribute: checkInfo.attr,
    };
  }

  // 5. Item usage
  if (lower.includes('使用') || lower.includes('喝') || lower.includes('投掷')) {
    return {
      id: `custom_${Date.now()}`,
      label: input.slice(0, 30),
      type: 'item',
      risk: 'medium',
      mpCost: 0,
      isCustom: true,
      customText: input,
      requiresCheck: false,
    };
  }

  // 6. Run away
  if (lower.includes('逃跑') || lower.includes('撤退')) {
    return {
      id: `custom_${Date.now()}`,
      label: input.slice(0, 30),
      type: 'travel',
      risk: 'low',
      mpCost: 0,
      isCustom: true,
      customText: input,
      requiresCheck: false,
    };
  }

  // 7. Default: other (AI decides)
  return {
    id: `custom_${Date.now()}`,
    label: input.slice(0, 30),
    type: 'other',
    risk: 'medium',
    mpCost: 0,
    isCustom: true,
    customText: input,
    requiresCheck: false,
  };
}
