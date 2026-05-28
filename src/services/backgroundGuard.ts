import type { Player } from '../types';

export interface OriginGuardResult {
  originalOrigin: string;
  sanitizedOrigin: string;
  warnings: string[];
  extractedHooks: string[];
  deniedClaims: string[];
}

// ========== Layer 1: Keyword matching ==========
const OVERPOWER_KEYWORDS = [
  '无敌', '最强', '第一', '至尊', '至高', '无双',
  '神王', '龙王', '龙神', '魔神', '法神', '剑圣', '武神',
  '禁咒', '禁术', '灭世', '灭国', '毁天灭地',
  '神器', '圣器', '传说武器', '上古神兵',
  '无限金币', '富可敌国', '取之不尽', '花不完',
  '统治大陆', '统一王国', '号令天下',
  '秒杀', '碾压', '弹指间', '挥手间',
  '大陆闻名', '无人不知', '人人皆知',
  '满级', '全属性满', '全技能满',
  '不死', '永生', '不朽',
];

const OVERPOWER_PATTERNS = [
  { pattern: /所有.{0,5}都听命于.{0,3}/, label: '权力主张' },
  { pattern: /我.{0,3}是.{0,3}王/, label: '王位主张' },
  { pattern: /我.{0,3}是.{0,3}神/, label: '神格主张' },
  { pattern: /我.{0,5}灭.{0,2}(国|城|族)/, label: '毁灭主张' },
  { pattern: /.{0,5}都是我的.{0,3}/, label: '所有权主张' },
  { pattern: /继承.{0,5}(王位|皇位|神位|龙位)/, label: '继承主张' },
  { pattern: /拥有.{0,2}(十|[百千万]|无数).{0,2}(件|把|个|枚).{0,2}(神器|传说|圣)/, label: '多神器主张' },
];

// ========== Layer 2: Semantic patterns ==========
function checkSemanticPatterns(text: string): string[] {
  const denied: string[] = [];
  for (const { pattern, label } of OVERPOWER_PATTERNS) {
    if (pattern.test(text)) {
      denied.push(label);
    }
  }
  return denied;
}

// ========== Layer 3: Attribute contrast ==========
function checkAttributeContrast(text: string, player: Player): string[] {
  const denied: string[] = [];
  // If text implies power level far exceeding Lv.1
  const levelPhrases = [/Lv\.[5-9]\d/, /Lv\.\d{2,}/, /等级.{0,2}[5-9]\d/, /[五六七八九]十级/];
  for (const p of levelPhrases) {
    if (p.test(text)) {
      denied.push('等级主张(远超Lv.1)');
      break;
    }
  }
  return denied;
}

// ========== Sanitization rewrite rules ==========
interface RewriteRule {
  keywords: string[];
  replacement: string;
}

const REWRITE_RULES: RewriteRule[] = [
  {
    keywords: ['龙王', '龙神', '古龙之主'],
    replacement: '你梦中常听见龙语，身上据说有稀薄龙血，但当前没有任何龙族力量显现。',
  },
  {
    keywords: ['法神', '禁咒法师', '最强法师', '大魔导师'],
    replacement: '你曾在梦中见过几页禁咒残卷，醒来后只记得模糊的音节。当前你只是Lv.1法师。',
  },
  {
    keywords: ['神器', '传说武器', '圣器', '上古神兵'],
    replacement: '你有一件被称为神器碎片的破损遗物——它偶尔发热，但完全没有传说中的力量。',
  },
  {
    keywords: ['无敌', '最强', '第一剑士', '剑圣', '武神'],
    replacement: '你自认身手不差，但还远没到能吹嘘"最强"的程度。酒馆里比你强的人多的是。',
  },
  {
    keywords: ['统治', '号令天下', '统一王国'],
    replacement: '你对政治有些想法——但也只是想法。目前你连酒馆的一桌酒客都指挥不动。',
  },
  {
    keywords: ['无限金币', '富可敌国', '花不完的钱'],
    replacement: '你曾经不算穷，但现在钱包里只剩角色卡上那点铜币。富裕的日子只是过去。',
  },
  {
    keywords: ['秒杀巨龙', '杀过龙', '屠龙', '灭过龙'],
    replacement: '你在酒馆吹嘘自己杀过巨龙。真相是在一头濒死幼龙旁边幸运地逃了出来。',
  },
  {
    keywords: ['大陆闻名', '无人不知', '人人皆知', '赫赫有名'],
    replacement: '你认为自己应该很有名。但说实话，这个镇子上似乎没人认识你。',
  },
  {
    keywords: ['不死', '永生', '不朽'],
    replacement: '你和所有人一样会流血受伤。关于不朽的传闻——你希望它是真的。',
  },
  {
    keywords: ['满级', '全属性满'],
    replacement: '你还远未触及力量的顶点。目前你是一位Lv.1冒险者，前方还有很长的路。',
  },
];

// ========== Main function ==========
export function sanitizeOrigin(customOrigin: string, player: Player): OriginGuardResult {
  const warnings: string[] = [];
  const extractedHooks: string[] = [];
  const deniedClaims: string[] = [];

  if (!customOrigin.trim()) {
    return {
      originalOrigin: '',
      sanitizedOrigin: '',
      warnings: [],
      extractedHooks: [],
      deniedClaims: [],
    };
  }

  let sanitized = customOrigin;

  // Layer 1: Keyword check
  const foundKeywords = OVERPOWER_KEYWORDS.filter(kw => customOrigin.includes(kw));
  if (foundKeywords.length > 0) {
    deniedClaims.push(...foundKeywords);
    warnings.push(`检测到越权关键词：${foundKeywords.join('、')}`);

    // Apply rewrite rules
    for (const rule of REWRITE_RULES) {
      if (rule.keywords.some(kw => customOrigin.includes(kw))) {
        sanitized = rule.replacement;
        extractedHooks.push(rule.keywords[0]);
        break; // First matching rule wins
      }
    }

    if (extractedHooks.length === 0) {
      // Generic rewrite
      sanitized = '你有一段不平凡的过去——至少你是这么认为的。但当前你只是一个普通的冒险者，实力尚浅。';
    }
  }

  // Layer 2: Semantic patterns
  const patternDenials = checkSemanticPatterns(customOrigin);
  if (patternDenials.length > 0) {
    deniedClaims.push(...patternDenials);
    if (warnings.length === 0) {
      warnings.push(`检测到越权语义：${patternDenials.join('、')}`);
      sanitized = '你的过去有些模糊不清。有人说你曾是非凡人物，但你清楚——当前你只是冒险者公会的新人。';
    }
  }

  // Layer 3: Attribute contrast
  const attrDenials = checkAttributeContrast(customOrigin, player);
  if (attrDenials.length > 0) {
    deniedClaims.push(...attrDenials);
  }

  // Collect hooks from what remains usable in the original
  const hookPatterns = [
    { regex: /退学/, label: '退学经历' },
    { regex: /失散|失踪|走散/, label: '失散经历' },
    { regex: /欠.{0,2}(债|钱)/, label: '债务' },
    { regex: /仇|追杀|通缉/, label: '仇家' },
    { regex: /封印|沉睡|失忆/, label: '封印/失忆' },
    { regex: /遗物|遗物|祖传|继承/, label: '遗物/继承' },
    { regex: /纹章|徽章|戒指|项链/, label: '信物' },
    { regex: /梦|幻象|幻觉/, label: '梦境/幻象' },
    { regex: /学院/, label: '学院经历' },
    { regex: /商队/, label: '商队经历' },
    { regex: /佣兵/, label: '佣兵经历' },
  ];

  for (const { regex, label } of hookPatterns) {
    if (regex.test(customOrigin) && !extractedHooks.includes(label)) {
      extractedHooks.push(label);
    }
  }

  return {
    originalOrigin: customOrigin,
    sanitizedOrigin: sanitized,
    warnings,
    extractedHooks,
    deniedClaims: [...new Set(deniedClaims)],
  };
}
