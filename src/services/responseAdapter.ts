import { z } from 'zod';
import type { AIResponse, ActionOption } from '../types';
import { EMPTY_MONEY } from '../types/common';

// ========== Minimal Zod Schema (what AI is REQUIRED to return) ==========
const SCENE_DEFAULTS = { title: '继续冒险', text: '你环顾四周。', location: '当前地点', time: '稍后', weather: '晴', locationId: '' };

const MinimalSceneSchema = z.object({
  title: z.string().min(1).default(SCENE_DEFAULTS.title),
  text: z.string().min(1).default(SCENE_DEFAULTS.text),
  location: z.string().default(SCENE_DEFAULTS.location),
  locationId: z.string().optional(),
  time: z.string().default(SCENE_DEFAULTS.time),
  weather: z.string().default(SCENE_DEFAULTS.weather),
}).default(SCENE_DEFAULTS);

const MinimalActionOptionSchema = z.object({
  label: z.string().min(1).default('行动'),
  type: z.string().default('dialogue'),
  risk: z.enum(['low', 'medium', 'high', 'extreme']).default('low'),
  relatedSkill: z.string().nullable().default(null),
});


const MinimalSystemEventSchema = z.object({
  type: z.string().default('info'),
  text: z.string().default(''),
});

const MinimalInventoryUpdateSchema = z.object({
  action: z.enum(['add', 'remove', 'modify']).default('add'),
  itemId: z.string().default(''),
  name: z.string().default('物品'),
  quantity: z.number().default(1),
  type: z.string().optional(),
  description: z.string().optional(),
  rarity: z.string().optional(),
});

const MinimalQuestUpdateSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  status: z.enum(['available', 'active', 'completable', 'completed', 'failed', 'hidden', 'expired', 'branching']).default('active'),
  description: z.string().optional(),
  giver: z.string().optional(),
});

const MinimalRelationshipUpdateSchema = z.object({
  targetId: z.string().default(''),
  name: z.string().default(''),
  change: z.number().default(0),
  reason: z.string().default(''),
  type: z.enum(['npc', 'faction']).optional(),
});

const MinimalMapUpdateSchema = z.object({
  targetId: z.string().default(''),
  targetType: z.enum(['region', 'subregion', 'location', 'connection']).default('location'),
  name: z.string().optional(),
  status: z.enum(['discovered', 'rumored', 'unlocked']).optional(),
});

const MinimalWorldBroadcastSchema = z.object({
  type: z.string().default('rumor'),
  region: z.string().optional(),
  text: z.string().default(''),
});

const MinimalAIMemoryUpdateSchema = z.object({
  flags: z.array(z.string()).optional(),
  currentLocation: z.string().optional(),
  currentLocationId: z.string().optional(),
  knownLocations: z.array(z.string()).optional(),
});

/** What the AI minimally needs to return. Everything else is optional and will be completed locally. */
const MinimalAIResponseSchema = z.object({
  scene: MinimalSceneSchema,
  systemEvents: z.array(MinimalSystemEventSchema).optional(),
  actionOptions: z.array(MinimalActionOptionSchema).optional(),
  customActionEnabled: z.boolean().default(true),
  questUpdate: z.array(MinimalQuestUpdateSchema).optional(),
  inventoryUpdate: z.array(MinimalInventoryUpdateSchema).optional(),
  relationshipUpdate: z.array(MinimalRelationshipUpdateSchema).optional(),
  mapUpdate: z.array(MinimalMapUpdateSchema).optional(),
  worldBroadcasts: z.array(MinimalWorldBroadcastSchema).optional(),
  memoryUpdate: MinimalAIMemoryUpdateSchema.optional(),
});

// ========== Snake→Camel map ==========
const SNAKE_TO_CAMEL: Record<string, string> = {
  system_events: 'systemEvents', action_options: 'actionOptions',
  risk_level: 'riskLevel', related_attribute: 'relatedAttribute',
  related_skill: 'relatedSkill', mp_cost: 'mpCost',
  difficulty_preview: 'difficultyPreview', custom_action_enabled: 'customActionEnabled',
  player_update: 'playerUpdate', hp_change: 'hpChange', mp_change: 'mpChange',
  exp_change: 'expChange', money_change: 'moneyChange',
  inventory_update: 'inventoryUpdate', item_id: 'itemId',
  quest_update: 'questUpdate', skill_state_update: 'skillStateUpdate',
  skill_id: 'skillId', equipment_update: 'equipmentUpdate',
  relationship_update: 'relationshipUpdate', target_id: 'targetId',
  map_update: 'mapUpdate', targetId: 'targetId', target_type: 'targetType',
  unlock_condition: 'unlockCondition', world_broadcasts: 'worldBroadcasts',
  memory_update: 'memoryUpdate', current_location: 'currentLocation',
  current_location_id: 'currentLocationId', known_locations: 'knownLocations',
  location_id: 'targetId',
};

/** Recursively convert snake_case keys to camelCase */
function snakeToCamel(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  if (Array.isArray(raw)) return raw.map(snakeToCamel);
  if (typeof raw !== 'object') return raw;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const newKey = SNAKE_TO_CAMEL[key] || key;
    result[newKey] = snakeToCamel(value);
  }
  return result;
}

// ========== Enum normalizer ==========
const CHINESE_ENUM: Record<string, Record<string, string>> = {
  risk: {
    '低': 'low', '中': 'medium', '中等': 'medium', '高': 'high', '极高': 'extreme',
    '无': 'low', 'none': 'low',
  },
  type: {
    '对话': 'dialogue', '交谈': 'dialogue', '询问': 'dialogue',
    '观察': 'check', '检查': 'check', '调查': 'check',
    '战斗': 'combat', '攻击': 'combat',
    '探索': 'exploration', '旅行': 'travel',
    '潜行': 'stealth', '隐匿': 'stealth',
    '社交': 'social', '交涉': 'social',
    '魔法': 'magic', '技能': 'skill', '施法': 'magic',
    '谨慎': 'cautious', '小心': 'cautious', '休息': 'cautious',
    '物品': 'item', '交易': 'trade', '使用物品': 'item',
  },
};

const ENUM_MAP: Record<string, Record<string, string>> = {
  risk: { low: 'low', medium: 'medium', high: 'high', extreme: 'extreme' },
  type: {
    check: 'check', info: 'info', reward: 'reward', penalty: 'penalty', warning: 'warning',
    observe: 'check', dialogue: 'dialogue', combat: 'combat', exploration: 'exploration',
    travel: 'travel', social: 'social', stealth: 'stealth', magic: 'magic', skill: 'skill',
    item: 'item', trade: 'trade', cautious: 'cautious',
  },
};

/** Fix enum values that might be Chinese or non-standard */
function normalizeEnumValue(key: string, value: string): string {
  if (!value || typeof value !== 'string') return value;
  // First try Chinese→English
  const cnMap = CHINESE_ENUM[key];
  if (cnMap && cnMap[value]) return cnMap[value];
  // Then try alias matching
  const enMap = ENUM_MAP[key];
  if (enMap) return enMap[value] || value;
  return value;
}

/** Recursively normalize enum values in minimal AI response */
export function normalizeEnumValues(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw };
  if (Array.isArray(result.actionOptions)) {
    result.actionOptions = result.actionOptions.map((opt: Record<string, unknown>) => {
      const fixed = { ...opt };
      if (fixed.risk && typeof fixed.risk === 'string') fixed.risk = normalizeEnumValue('risk', fixed.risk);
      if (fixed.type && typeof fixed.type === 'string') fixed.type = normalizeEnumValue('type', fixed.type);
      return fixed;
    });
  }
  return result;
}

// ========== Extract JSON from LLM output ==========
export function extractJsonObject(text: string): string {
  let clean = text.trim();
  // Remove <think>...</think> blocks (DeepSeek R1 reasoning)
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Remove residual `<thinking>` or `【思考】` blocks
  clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  // ```json ... ```
  const block = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) return block[1].trim();
  // `...`
  const inline = clean.match(/^`({[\s\S]*})`$/);
  if (inline) return inline[1].trim();
  return clean;
}

// ========== Complete minimal response to full AIResponse ==========
export function completeAIResponse(partial: Record<string, unknown>): AIResponse {
  const scene = (partial.scene || {}) as Record<string, string>;
  const rawOptions = (partial.actionOptions || []) as Partial<ActionOption>[];
  const actionOptions: ActionOption[] = rawOptions.length > 0 ? rawOptions.map((opt, i) => ({
    id: `opt_${Date.now()}_${i}`,
    label: opt.label || '行动',
    type: opt.type || 'dialogue',
    risk: opt.risk || 'low',
    relatedAttribute: opt.relatedAttribute || (opt.type === 'check' ? 'wis' : undefined),
    relatedSkill: opt.relatedSkill || null,
    mpCost: opt.mpCost || 0,
    difficultyPreview: opt.difficultyPreview || '简单',
  })) : [{ id: `opt_${Date.now()}_0`, label: '继续', type: 'dialogue', risk: 'low', relatedAttribute: undefined, relatedSkill: null, mpCost: 0, difficultyPreview: '简单' }];
  const systemEvents = (partial.systemEvents || []) as Array<{ type: string; text: string }>;

  const completed: AIResponse = {
    scene: {
      title: scene.title || '继续冒险',
      text: scene.text || '你环顾四周。',
      location: scene.location || '当前地点',
      locationId: scene.locationId || undefined,
      time: scene.time || '稍后',
      weather: scene.weather || '晴',
    },
    event: {
      id: `evt_${Date.now()}`,
      type: 'dialogue_event',
      urgency: 'normal',
      riskLevel: 'low',
    },
    systemEvents: systemEvents.map(se => ({
      type: (['check', 'info', 'reward', 'penalty', 'warning'].includes(se.type) ? se.type : 'info') as any,
      text: se.text || '',
    })),
    actionOptions,
    customActionEnabled: partial.customActionEnabled !== false,
    playerUpdate: {
      hpChange: 0,
      mpChange: 0,
      expChange: 0,
      moneyChange: { ...EMPTY_MONEY },
    },
    inventoryUpdate: (partial.inventoryUpdate || []) as any,
    questUpdate: (partial.questUpdate || []) as any,
    skillStateUpdate: [],
    equipmentUpdate: [],
    relationshipUpdate: (partial.relationshipUpdate || []) as any,
    mapUpdate: (partial.mapUpdate || []) as any,
    worldBroadcasts: (partial.worldBroadcasts || []) as any,
    memoryUpdate: {
      flags: (partial.memoryUpdate as any)?.flags || [],
      currentLocation: (partial.memoryUpdate as any)?.currentLocation || undefined,
      currentLocationId: (partial.memoryUpdate as any)?.currentLocationId || undefined,
      knownLocations: (partial.memoryUpdate as any)?.knownLocations || undefined,
    },
  };

  return completed;
}

// ========== Validate minimal response ==========
export function validateMinimalAIResponse(raw: unknown): { success: true; data: Record<string, unknown> } | { success: false; errors: string[] } {
  const result = MinimalAIResponseSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data as unknown as Record<string, unknown> };
  }
  const errors = result.error.issues.map(e =>
    `${e.path.join('.')}: ${e.message}`
  );
  return { success: false, errors };
}

// ========== Main normalize + validate + complete pipeline ==========
export function normalizeAndComplete(raw: unknown): { success: true; response: AIResponse } | { success: false; errors: string[]; rawText?: string } {
  try {
    let parsed: Record<string, unknown>;

    if (typeof raw === 'string') {
      // Extract JSON from LLM output (handles markdown blocks)
      const clean = extractJsonObject(raw);
      parsed = JSON.parse(clean) as Record<string, unknown>;
    } else if (raw && typeof raw === 'object') {
      parsed = raw as Record<string, unknown>;
    } else {
      return { success: false, errors: ['Invalid input: expected string or object'] };
    }

    // 1. Normalize snake_case → camelCase
    const normalized = snakeToCamel(parsed) as Record<string, unknown>;

    // 2. Normalize enum values
    const enumFixed = normalizeEnumValues(normalized);

    // 3. Validate minimal schema (AI is only required to return minimal fields)
    const validated = validateMinimalAIResponse(enumFixed);
    if (!validated.success) {
      return { success: false, errors: validated.errors };
    }

    // 4. Complete to full AIResponse
    const completed = completeAIResponse(validated.data);
    return { success: true, response: completed };
  } catch (e) {
    return { success: false, errors: [e instanceof Error ? e.message : 'Unknown error'] };
  }
}
