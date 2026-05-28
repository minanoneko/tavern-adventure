import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
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

const OptionalPlayerUpdateSchema = z.object({
  hpChange: z.number().optional(),
  mpChange: z.number().optional(),
  expChange: z.number().optional(),
  moneyChange: z.object({
    gold: z.number().optional(),
    silver: z.number().optional(),
    copper: z.number().optional(),
  }).optional(),
}).optional();

/** What the AI minimally needs to return. Everything else is optional and will be completed locally. */
const MinimalAIResponseSchema = z.object({
  scene: MinimalSceneSchema,
  systemEvents: z.array(MinimalSystemEventSchema).optional().default([]),
  actionOptions: z.array(MinimalActionOptionSchema).optional(),
  customActionEnabled: z.boolean().default(true),
  playerUpdate: OptionalPlayerUpdateSchema,
  questUpdate: z.array(MinimalQuestUpdateSchema).optional().default([]),
  inventoryUpdate: z.array(MinimalInventoryUpdateSchema).optional().default([]),
  relationshipUpdate: z.array(MinimalRelationshipUpdateSchema).optional().default([]),
  mapUpdate: z.array(MinimalMapUpdateSchema).optional().default([]),
  worldBroadcasts: z.array(MinimalWorldBroadcastSchema).optional().default([]),
  memoryUpdate: MinimalAIMemoryUpdateSchema.optional().default({}),
  enemy: z.any().optional(),
});

/** Ultra-lenient fallback: accept ANY object with scene and actionOptions */
const LenientAIResponseSchema = z.object({
  scene: z.any(),
  actionOptions: z.any().optional(),
  customActionEnabled: z.any().optional(),
  systemEvents: z.any().optional(),
  questUpdate: z.any().optional(),
  inventoryUpdate: z.any().optional(),
  relationshipUpdate: z.any().optional(),
  mapUpdate: z.any().optional(),
  worldBroadcasts: z.any().optional(),
  memoryUpdate: z.any().optional(),
  enemy: z.any().optional(),
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
  clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  // ```json ... ```
  const block = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) {
    clean = block[1].trim();
  }
  // `...`
  const inline = clean.match(/^`({[\s\S]*})`$/);
  if (inline) {
    clean = inline[1].trim();
  }
  // If text starts with non-JSON characters (Chinese preamble), find first {
  const firstBrace = clean.indexOf('{');
  if (firstBrace > 0) {
    clean = clean.slice(firstBrace);
  }
  return clean;
}

// ========== Complete minimal response to full AIResponse ==========
export function completeAIResponse(partial: Record<string, unknown>): AIResponse {
  const scene = (partial.scene || {}) as Record<string, string>;
  const rawOptions = (partial.actionOptions || []) as Partial<ActionOption>[];

  // Filter out obviously bad options (empty labels, truncated)
  const validOptions = rawOptions.filter(o => o.label && o.label.length > 0);
  const actionOptions: ActionOption[] = validOptions.length > 0 ? validOptions.map((opt, i) => ({
    id: `opt_${Date.now()}_${i}`,
    label: opt.label || '行动',
    type: opt.type || 'dialogue',
    risk: opt.risk || 'low',
    relatedAttribute: opt.relatedAttribute || (opt.type === 'check' ? 'wis' : undefined),
    relatedSkill: opt.relatedSkill || null,
    mpCost: opt.mpCost || 0,
    difficultyPreview: opt.difficultyPreview || '简单',
  })) : [{ id: `opt_${Date.now()}_0`, label: '继续探索', type: 'exploration', risk: 'low', relatedAttribute: undefined, relatedSkill: null, mpCost: 0, difficultyPreview: '简单' },
        { id: `opt_${Date.now()}_1`, label: '观察周围', type: 'check', risk: 'low', relatedAttribute: 'wis', relatedSkill: null, mpCost: 0, difficultyPreview: '简单' },
        { id: `opt_${Date.now()}_2`, label: '和附近的人交谈', type: 'dialogue', risk: 'low', relatedAttribute: undefined, relatedSkill: null, mpCost: 0, difficultyPreview: '简单' }];
  const systemEvents = (partial.systemEvents || []) as Array<{ type: string; text: string }>;

  // Detect and fix truncated text (ends without proper sentence closure)
  let sceneText = scene.text || '你环顾四周。';
  const lastChar = sceneText.trim().slice(-1);
  if (!'。！？…~.?!'.includes(lastChar)) {
    sceneText = sceneText.trim() + '…';
  }
  // Cap scene text length
  if (sceneText.length > 600) sceneText = sceneText.slice(0, 600) + '…';

  const completed: AIResponse = {
    scene: {
      title: scene.title || '继续冒险',
      text: sceneText,
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
      hpChange: (partial.playerUpdate as any)?.hpChange ?? 0,
      mpChange: (partial.playerUpdate as any)?.mpChange ?? 0,
      expChange: (partial.playerUpdate as any)?.expChange ?? 0,
      moneyChange: (partial.playerUpdate as any)?.moneyChange ? { ...EMPTY_MONEY, ...(partial.playerUpdate as any).moneyChange } : { ...EMPTY_MONEY },
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
    enemy: (partial.enemy as any) || undefined,
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

// ========== JSON parsing with repair ==========
function tryParseJson(text: string): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  // 1. Direct parse
  try {
    return { success: true, data: JSON.parse(text) as Record<string, unknown> };
  } catch (e1) {
    // JSON.parse failed — continue to repair
  }
  // 1.5: Pre-fix common issues before jsonrepair
  let fixed = text;
  // Fix unterminated strings (missing closing quote)
  fixed = fixed.replace(/:\s*"([^"]*?)(?:\n|$)/g, (_, val) => {
    if (val.includes('\\n')) return `: "${val}"`; // already escaped
    return `: "${val.replace(/\n/g, '\\n')}"`;
  });
  // 2. jsonrepair
  try {
    const repaired = jsonrepair(fixed);
    const parsed = JSON.parse(repaired) as Record<string, unknown>;
    return { success: true, data: parsed };
  } catch (e2) {
    return { success: false, error: e2 instanceof Error ? e2.message : 'JSON repair failed' };
  }
}

// ========== Main normalize + validate + complete pipeline ==========
export function normalizeAndComplete(raw: unknown): { success: true; response: AIResponse } | { success: false; errors: string[]; rawText?: string } {
  try {
    let parsed: Record<string, unknown>;

    if (typeof raw === 'string') {
      const clean = extractJsonObject(raw);
      const parseResult = tryParseJson(clean);
      if (!parseResult.success) {
        return { success: false, errors: [parseResult.error], rawText: raw.slice(0, 1000) };
      }
      parsed = parseResult.data;
    } else if (raw && typeof raw === 'object') {
      parsed = raw as Record<string, unknown>;
    } else {
      return { success: false, errors: ['Invalid input: expected string or object'] };
    }

    // 1. Normalize snake_case → camelCase
    const normalized = snakeToCamel(parsed) as Record<string, unknown>;

    // 1.5 Normalize worldBroadcasts (AI often sends strings instead of objects)
    if (Array.isArray(normalized.worldBroadcasts)) {
      normalized.worldBroadcasts = normalized.worldBroadcasts.map((b: unknown) => {
        if (typeof b === 'string') return { type: 'rumor', text: b };
        return b;
      });
    }
    // 1.6 Normalize systemEvents (AI may send strings instead of objects)
    if (Array.isArray(normalized.systemEvents)) {
      (normalized as any).systemEvents = (normalized as any).systemEvents.map((s: unknown) => {
        if (typeof s === 'string') return { type: 'info', text: s };
        return s;
      });
    }
    // 1.7 Normalize single objects to arrays for optional array fields
    for (const field of ['mapUpdate', 'questUpdate', 'inventoryUpdate', 'relationshipUpdate']) {
      const val = (normalized as any)[field];
      if (val && !Array.isArray(val) && typeof val === 'object') {
        (normalized as any)[field] = [val];
      }
    }
    // 1.8 Normalize quest objectives: strings → objects
    if (Array.isArray((normalized as any).questUpdate)) {
      (normalized as any).questUpdate = (normalized as any).questUpdate.map((q: any) => {
        if (q.objectives && Array.isArray(q.objectives)) {
          q.objectives = q.objectives.map((o: any) => {
            if (typeof o === 'string') return { id: `obj_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, description: o, completed: false };
            return o;
          });
        }
        return q;
      });
    }

    // 2. Normalize enum values
    const enumFixed = normalizeEnumValues(normalized);

    // 3. Validate — try strict first, fall back to lenient
    let validated = validateMinimalAIResponse(enumFixed);
    if (!validated.success) {
      // Fallback: lenient schema accepts anything that vaguely looks right
      const lenient = LenientAIResponseSchema.safeParse(enumFixed);
      if (lenient.success) {
        const completed = completeAIResponse(lenient.data as Record<string, unknown>);
        return { success: true, response: completed };
      }
      return { success: false, errors: validated.errors };
    }

    // 4. Complete to full AIResponse
    const completed = completeAIResponse(validated.data);
    return { success: true, response: completed };
  } catch (e) {
    return { success: false, errors: [e instanceof Error ? e.message : 'Unknown error'] };
  }
}
