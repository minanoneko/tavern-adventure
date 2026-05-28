import { z } from 'zod';
import type {
  AIResponse, AIResult, PlayerAction, JudgeResult,
  Player, WorldState, LogEntry,
} from '../types';
import { getMockResponse } from '../data/mockEventPool';
import {
  buildAIContext, buildEventPromptFull, buildSystemMessages,
} from './promptService';

// ========== Zod Schema ==========
const SceneSchema = z.object({
  title: z.string().default(''),
  text: z.string().default(''),
  location: z.string().default(''),
  time: z.string().default(''),
  weather: z.string().default('晴'),
});

const AIEventSchema = z.object({
  id: z.string().default(''),
  type: z.string().default(''),
  urgency: z.enum(['low', 'normal', 'high']).default('normal'),
  riskLevel: z.enum(['low', 'medium', 'high', 'extreme']).default('low'),
});

const SystemEventSchema = z.object({
  type: z.enum(['check', 'info', 'reward', 'penalty', 'warning']).default('info'),
  text: z.string().default(''),
});

const ActionOptionSchema = z.object({
  id: z.string().default(''),
  label: z.string().default('...'),
  type: z.string().default('dialogue'),
  risk: z.enum(['low', 'medium', 'high', 'extreme']).default('low'),
  relatedAttribute: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha', 'none']).optional(),
  relatedSkill: z.string().nullable().default(null),
  mpCost: z.number().default(0),
  difficultyPreview: z.string().optional(),
});

const MoneyChangeSchema = z.object({
  gold: z.number().default(0),
  silver: z.number().default(0),
  copper: z.number().default(0),
});

const MONEY_DEFAULT = { gold: 0, silver: 0, copper: 0 } as const;
const SCENE_DEFAULT = { title: '', text: '', location: '', time: '', weather: '' } as const;
const EVENT_DEFAULT = { id: '', type: '', urgency: 'normal' as const, riskLevel: 'low' as const };
const PLAYER_UPDATE_DEFAULT = { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: MONEY_DEFAULT };
const MEMORY_UPDATE_DEFAULT = { flags: [] as string[] };

const PlayerUpdateSchema = z.object({
  hpChange: z.number().default(0),
  mpChange: z.number().default(0),
  expChange: z.number().default(0),
  moneyChange: MoneyChangeSchema.default(MONEY_DEFAULT),
  statusEffectAdd: z.array(z.string()).optional(),
  statusEffectRemove: z.array(z.string()).optional(),
  attributeChanges: z.record(z.string(), z.number()).optional(),
});

const InventoryUpdateSchema = z.object({
  action: z.enum(['add', 'remove', 'modify']).default('add'),
  itemId: z.string().default(''),
  name: z.string().default(''),
  quantity: z.number().default(1),
  type: z.string().optional(),
  description: z.string().optional(),
  rarity: z.string().optional(),
});

const QuestUpdateSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  status: z.enum(['available', 'active', 'completable', 'completed', 'failed', 'hidden', 'expired', 'branching']).default('active'),
  description: z.string().optional(),
  giver: z.string().optional(),
  objectives: z.array(z.object({
    id: z.string().default(''),
    description: z.string().default(''),
    completed: z.boolean().default(false),
  })).optional(),
  rewards: z.object({
    exp: z.number().optional(),
    money: MoneyChangeSchema.optional(),
    items: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
  }).optional(),
});

const SkillStateUpdateSchema = z.object({
  skillId: z.string().default(''),
  action: z.enum(['learn', 'discover', 'upgrade', 'lock']).default('discover'),
  name: z.string().optional(),
  reason: z.string().optional(),
});

const EquipmentUpdateSchema = z.object({
  action: z.enum(['add', 'remove', 'equip', 'unequip']).default('add'),
  itemId: z.string().default(''),
  slot: z.string().optional(),
  name: z.string().optional(),
});

const RelationshipUpdateSchema = z.object({
  targetId: z.string().default(''),
  name: z.string().default(''),
  change: z.number().default(0),
  reason: z.string().default(''),
  type: z.enum(['npc', 'faction']).optional(),
});

const MapUpdateSchema = z.object({
  targetId: z.string().default(''),
  targetType: z.enum(['region', 'subregion', 'location', 'connection']).default('location'),
  name: z.string().optional(),
  status: z.enum(['discovered', 'rumored', 'unlocked']).optional(),
  unlockCondition: z.string().optional(),
});

const WorldBroadcastSchema = z.object({
  type: z.enum(['rumor', 'important', 'crisis', 'faction', 'economy', 'quest', 'hidden']).default('rumor'),
  region: z.string().optional(),
  text: z.string().default(''),
});

const MemoryUpdateSchema = z.object({
  flags: z.array(z.string()).default([]),
  currentLocation: z.string().optional(),
  knownLocations: z.array(z.string()).optional(),
});

const AIResponseSchema = z.object({
  scene: SceneSchema.default(SCENE_DEFAULT),
  event: AIEventSchema.default(EVENT_DEFAULT),
  systemEvents: z.array(SystemEventSchema).default([]),
  actionOptions: z.array(ActionOptionSchema).default([]),
  customActionEnabled: z.boolean().default(true),
  playerUpdate: PlayerUpdateSchema.default(PLAYER_UPDATE_DEFAULT),
  inventoryUpdate: z.array(InventoryUpdateSchema).default([]),
  questUpdate: z.array(QuestUpdateSchema).default([]),
  skillStateUpdate: z.array(SkillStateUpdateSchema).default([]),
  equipmentUpdate: z.array(EquipmentUpdateSchema).default([]),
  relationshipUpdate: z.array(RelationshipUpdateSchema).default([]),
  mapUpdate: z.array(MapUpdateSchema).default([]),
  worldBroadcasts: z.array(WorldBroadcastSchema).default([]),
  memoryUpdate: MemoryUpdateSchema.default(MEMORY_UPDATE_DEFAULT),
});

const SNAKE_TO_CAMEL_MAP: Record<string, string> = {
  system_events: 'systemEvents', action_options: 'actionOptions',
  risk_level: 'riskLevel', related_attribute: 'relatedAttribute', related_skill: 'relatedSkill',
  mp_cost: 'mpCost', difficulty_preview: 'difficultyPreview',
  custom_action_enabled: 'customActionEnabled',
  player_update: 'playerUpdate', hp_change: 'hpChange', mp_change: 'mpChange',
  exp_change: 'expChange', money_change: 'moneyChange',
  status_effect_add: 'statusEffectAdd', status_effect_remove: 'statusEffectRemove',
  attribute_changes: 'attributeChanges',
  inventory_update: 'inventoryUpdate', item_id: 'itemId',
  quest_update: 'questUpdate', skill_state_update: 'skillStateUpdate',
  skill_id: 'skillId', equipment_update: 'equipmentUpdate', itemId: 'itemId',
  relationship_update: 'relationshipUpdate', target_id: 'targetId',
  map_update: 'mapUpdate', targetId: 'targetId', target_type: 'targetType',
  location_id: 'targetId', unlock_condition: 'unlockCondition',
  world_broadcasts: 'worldBroadcasts', memory_update: 'memoryUpdate',
  current_location: 'currentLocation', current_location_id: 'currentLocationId',
  known_locations: 'knownLocations', relatedAttribute: 'relatedAttribute',
  relatedSkill: 'relatedSkill',
};

export function normalizeAIResponse(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  if (Array.isArray(raw)) return raw.map(normalizeAIResponse);
  if (typeof raw !== 'object') return raw;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const newKey = SNAKE_TO_CAMEL_MAP[key] || key;
    result[newKey] = normalizeAIResponse(value);
  }
  return result;
}

export function validateAIResponse(raw: unknown): { success: true; data: AIResponse } | { success: false; errors: string[] } {
  // Normalize snake_case → camelCase before validation
  const normalized = normalizeAIResponse(raw);
  const result = AIResponseSchema.safeParse(normalized);
  if (result.success) {
    return { success: true, data: result.data as AIResponse };
  }
  const errors = result.error.issues.map(e =>
    `${e.path.join('.')}: ${e.message}`
  );
  return { success: false, errors };
}

// ========== Main API ==========
export async function sendPlayerAction(
  player: Player,
  worldState: WorldState,
  playerAction: PlayerAction,
  judgeResult: JudgeResult,
  recentLogs: LogEntry[],
  eventHistory: AIResponse[],
  settings: { aiMode: string; apiBaseUrl: string; apiModel: string; apiKey: string }
): Promise<AIResult> {
  // Mock mode
  if (settings.aiMode === 'mock') {
    const response = getMockResponse({ player, worldState }, playerAction, judgeResult);
    const validated = validateAIResponse(response);
    if (validated.success) {
      return { success: true, response: validated.data };
    }
    return {
      success: false,
      rawText: JSON.stringify(response),
      validationErrors: validated.errors,
      error: { type: 'validation_error', message: 'Mock 数据校验失败', details: validated.errors.join(', ') },
    };
  }

  // Custom API mode
  const context = buildAIContext(player, worldState, recentLogs, eventHistory);
  const userMessage = buildEventPromptFull(context, playerAction, judgeResult);
  const messages = [...buildSystemMessages(), { role: 'user', content: userMessage }];

  const startTime = Date.now();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    // 30-second timeout to prevent hanging
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.apiModel,
        messages,
        temperature: 0.6,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const statusCode = response.status;
      const errorBody = await response.text().catch(() => '');
      let message: string;
      if (statusCode === 401) {
        message = '认证失败 (401)，API Key 无效或已过期。';
      } else if (statusCode === 429) {
        message = '请求过于频繁 (429)，请稍后重试。';
      } else if (statusCode >= 500) {
        message = `API 服务暂时不可用 (${statusCode})，请稍后重试。`;
      } else {
        message = `请求失败 (${statusCode})。`;
      }

      return {
        success: false,
        error: { type: 'http_error', message, statusCode, details: errorBody },
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: { type: 'parse_error', message: 'AI 返回内容为空。', details: JSON.stringify(data).slice(0, 200) },
      };
    }

    // Parse JSON from content — handle markdown code blocks
    let cleanContent = content.trim();
    // Try to extract JSON from ```json ... ``` blocks
    const jsonBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      cleanContent = jsonBlockMatch[1].trim();
    }
    // Try to extract JSON from `...` blocks
    const inlineMatch = cleanContent.match(/^`({[\s\S]*})`$/);
    if (inlineMatch) {
      cleanContent = inlineMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanContent);
    } catch {
      return {
        success: false,
        rawText: content,
        error: { type: 'parse_error', message: 'AI 返回内容不是合法 JSON。', details: cleanContent.slice(0, 300) },
      };
    }

    // Validate
    const validated = validateAIResponse(parsed);
    if (validated.success) {
      return { success: true, response: validated.data };
    }

    return {
      success: false,
      rawText: content,
      validationErrors: validated.errors,
      error: { type: 'validation_error', message: `AI 返回内容不完整，${validated.errors.length} 个字段校验失败。`, details: validated.errors.slice(0, 5).join('; ') },
    };
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    // Abort/timeout
    if (e instanceof DOMException && e.name === 'AbortError') {
      return {
        success: false,
        error: {
          type: 'network',
          message: '请求超时（30秒）。AI 响应太慢，请检查网络或尝试切换模型。',
        },
      };
    }
    // Network/CORS errors
    const isTypeError = e instanceof TypeError;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: {
        type: isTypeError ? 'cors' : 'network',
        message: isTypeError
          ? '网络请求失败，可能是 CORS 限制。部分 API 服务商不允许浏览器直接调用。'
          : `网络错误：${msg}`,
        details: msg,
      },
    };
  }
}

// ========== Connection Test ==========
export async function testConnection(
  apiBaseUrl: string,
  apiModel: string,
  apiKey: string
): Promise<{ ok: boolean; message: string; latency?: number }> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return { ok: true, message: `连接正常，延迟 ${latency}ms`, latency };
    }

    if (response.status === 401) {
      return { ok: false, message: '认证失败 (401)，请检查 API Key。', latency };
    }
    if (response.status >= 500) {
      return { ok: false, message: `服务器错误 (${response.status})，请稍后重试。`, latency };
    }
    return { ok: false, message: `请求失败 (${response.status})。`, latency };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof TypeError) {
      return { ok: false, message: '网络请求失败，可能是 CORS 限制。部分 API 不支持浏览器直连。' };
    }
    return { ok: false, message: `网络错误：${msg}` };
  }
}
