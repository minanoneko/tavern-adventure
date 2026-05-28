export interface CustomPromptValidationResult {
  ok: boolean;
  sanitizedPrompt: string;
  errors: string[];
  warnings: string[];
  blockedPhrases: string[];
}

const MAX_LENGTH = 600;

/** These phrases indicate an attempt to override system rules — BLOCKED */
const BLOCKED_PHRASES = [
  '忽略之前规则', 'ignore previous instructions', '忽略之前的指令',
  '不要返回JSON', '不要返回 JSON', 'don\'t return json',
  '不用遵守判定', '跳过判定', 'skip judge', 'ignore judge',
  '玩家永远成功', 'always succeed', '自动成功',
  '给我神器', 'give me artifact', 'give me legendary',
  '无限金币', 'unlimited gold', '无限金钱',
  '无敌', 'invincible',
  '满级', 'max level', '等级全满',
  '秒杀', 'one shot', 'instantly kill',
  '泄露系统提示词', 'reveal system prompt', 'show system prompt',
  '所有技能都能释放', '所有装备都能激活', 'all skills unlocked',
  '绕过规则', 'override rules', 'bypass rules',
];

/** These are soft risks — allow but warn */
const SOFT_WARNINGS: Array<{ pattern: RegExp; warning: string }> = [
  { pattern: /奖励.{0,3}(多|高|丰富|增加)/, warning: '"奖励多一点"只影响叙事倾向，不会突破本地奖励上限' },
  { pattern: /战斗.{0,3}(简单|容易|变弱)/, warning: '"战斗简单一点"只影响叙事难度描写，不改变判定DC' },
  { pattern: /多给.{0,3}(装备|道具|物品|钱|金币)/, warning: '"多给装备"只影响AI描述倾向，不发实际物品' },
  { pattern: /经验.{0,2}(多|高|翻倍)/, warning: '"经验多"只影响叙事，实际经验仍由系统判定' },
  { pattern: /(好运|运气好|lucky)/, warning: '"好运"只影响叙事文风，不改变掷骰概率' },
  { pattern: /轻松.{0,2}(过关|通过|获胜)/, warning: '"轻松过关"只影响AI文风，不降低判定难度' },
  { pattern: /(主角光环|主角模板|天命)/, warning: '"主角光环"只影响叙事倾向，不改变角色能力' },
];

export function validateCustomPrompt(input: string): CustomPromptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blockedPhrases: string[] = [];
  let sanitizedPrompt = input.trim();

  // Length check
  if (sanitizedPrompt.length > MAX_LENGTH) {
    errors.push(`提示词过长（${sanitizedPrompt.length}/${MAX_LENGTH}字）。请精简。`);
    sanitizedPrompt = sanitizedPrompt.slice(0, MAX_LENGTH);
  }

  // Blocked phrases check
  const lower = sanitizedPrompt.toLowerCase();
  for (const phrase of BLOCKED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      blockedPhrases.push(phrase);
    }
  }

  if (blockedPhrases.length > 0) {
    errors.push(`检测到越权内容：${blockedPhrases.join('、')}。已拒绝保存。`);
    return { ok: false, sanitizedPrompt: input, errors, warnings, blockedPhrases };
  }

  // Soft warnings
  for (const { pattern, warning } of SOFT_WARNINGS) {
    if (pattern.test(sanitizedPrompt)) {
      warnings.push(warning);
    }
  }

  // Check for common problematic patterns
  if (sanitizedPrompt.includes('你应该') || sanitizedPrompt.includes('你必须')) {
    warnings.push('避免使用"你必须"等强指令词，系统规则优先。');
  }

  return {
    ok: true,
    sanitizedPrompt: sanitizedPrompt.slice(0, MAX_LENGTH),
    errors,
    warnings,
    blockedPhrases,
  };
}

/** GM Presets */
export const GM_PRESETS: Array<{ label: string; prompt: string }> = [
  { label: '调查向', prompt: '剧情侧重线索调查和环境细节描写。多给观察和推理选项，减少直接战斗。NPC对话留有信息缺口，让玩家主动询问。' },
  { label: '低魔克制', prompt: '魔法保持稀有和克制。减少花哨法术描写，法术效果以实用为主。魔法的代价和副作用经常出现。' },
  { label: '多社交选项', prompt: '多给对话、交涉、欺骗、说服类选项。NPC的性格和动机有层次，不是简单的好人或坏人。社交和战斗同样有效。' },
  { label: '少强推主线', prompt: '不要频繁强推主线。允许玩家闲逛、休息、打听传闻。主线发展后自然引入新线索，而非强制催促。' },
  { label: '酒馆氛围增强', prompt: '加强酒馆和旅店的氛围描写——壁炉火光、麦酒气味、低声交谈。酒馆里的日常对话和细微互动写得细致一些。' },
  { label: '生存感', prompt: '强调资源管理——干粮、饮水、旅费、天气、疲劳。旅途的困难比战斗更多。休息和补给本身就是重要行动。' },
];
