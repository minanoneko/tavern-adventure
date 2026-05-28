import type { Player, WorldState, AIResponse } from '../types';
import type { OpeningMode } from '../types/settings';
import type { AISettings } from '../store/settingsStore';
import { sanitizeOrigin } from './backgroundGuard';
import { getOpeningByClass } from '../data/openingTemplates';
import { buildOpeningPrompt } from '../prompts/openingPrompt';
import { buildSystemMessages } from './promptService';
import { normalizeAndComplete } from './responseAdapter';

export interface OpeningResult {
  event: AIResponse;
  sanitizedOrigin: string;
  warnings: string[];
  deniedClaims: string[];
}

export async function generateOpeningEvent(
  player: Player,
  worldState: WorldState,
  settings: AISettings,
  openingMode: OpeningMode
): Promise<OpeningResult> {
  // Step 1: Sanitize custom origin
  const guardResult = sanitizeOrigin(player.customOrigin, player);

  // Step 2: Determine actual mode
  // mock aiMode → force mock_template
  // custom_api + ai_generated → call AI
  // custom_api + mock_template or any failure → mock_template
  const useAI = settings.aiMode === 'custom_api' && openingMode === 'ai_generated';

  if (settings.aiMode !== 'custom_api' && openingMode === 'ai_generated') {
    guardResult.warnings.push('当前为 Mock AI 模式，开局使用职业模板。切换到自定义 API 模式并填写 API Key 后，AI 才能根据开端生成第一幕。');
  }

  if (useAI) {
    try {
      const aiEvent = await generateWithAI(player, worldState, settings, guardResult.sanitizedOrigin);
      if (aiEvent) {
        return {
          event: aiEvent,
          sanitizedOrigin: guardResult.sanitizedOrigin,
          warnings: guardResult.warnings,
          deniedClaims: guardResult.deniedClaims,
        };
      }
    } catch (e) {
      // Fall through to mock
    }
    // AI failed, add fallback warning
    guardResult.warnings.push('AI 开局生成失败，已降级为职业模板开局。请检查 API 设置是否正确。');
  }

  // Step 3: Mock template fallback
  const mockEvent = getOpeningByClass(player.classOrigin, guardResult.sanitizedOrigin);
  if (mockEvent) {
    return {
      event: mockEvent,
      sanitizedOrigin: guardResult.sanitizedOrigin,
      warnings: guardResult.warnings,
      deniedClaims: guardResult.deniedClaims,
    };
  }

  // Ultimate fallback: generic tavern opening
  return {
    event: getGenericOpening(player, guardResult.sanitizedOrigin),
    sanitizedOrigin: guardResult.sanitizedOrigin,
    warnings: guardResult.warnings,
    deniedClaims: guardResult.deniedClaims,
  };
}

async function generateWithAI(
  player: Player,
  worldState: WorldState,
  settings: AISettings,
  sanitizedOrigin: string
): Promise<AIResponse | null> {
  const context = buildOpeningContext(player, worldState, sanitizedOrigin);
  const prompt = buildOpeningPrompt(JSON.stringify(context, null, 2));
  const messages = [...buildSystemMessages(), { role: 'user', content: prompt }];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
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
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const result = normalizeAndComplete(content);
    if (result.success) return result.response;

    console.warn('Opening AI response failed:', result.errors);
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

function buildOpeningContext(player: Player, worldState: WorldState, sanitizedOrigin: string) {
  return {
    player_summary: {
      name: player.name,
      level: player.level,
      race: player.race,
      class_origin: player.classOrigin,
      gender: player.gender,
      age: player.age,
      personality_traits: player.personalityTraits,
      custom_origin: player.customOrigin,
      sanitized_origin: sanitizedOrigin,
      attributes: player.attributes,
      hp: `${player.resources.hp}/${player.resources.maxHp}`,
      mp: `${player.resources.mp}/${player.resources.maxMp}`,
      money: player.money,
      learned_skills: player.skills.learned,
      equipment: Object.entries(player.equipment)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}: ${v}`),
    },
    world: {
      current_location: worldState.currentLocation,
      date: worldState.date,
      time_of_day: worldState.timeOfDay,
      weather: worldState.weather,
    },
  };
}

function getGenericOpening(player: Player, sanitizedOrigin: string): AIResponse {
  let text = `你推开了灰鹿酒馆的门。火光、麦酒的气味和低沉的谈话声扑面而来。`;
  if (sanitizedOrigin.trim()) {
    text += `\n\n${sanitizedOrigin}`;
  }
  text += `\n\n酒馆里有几个常客在喝酒，委托板上贴了几张纸。接下来做什么，取决于你。`;

  return {
    scene: { title: '灰鹿酒馆', text, location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
    event: { id: 'generic_opening', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [],
    actionOptions: [
      { id: 'look_around', label: '环顾四周，观察环境', type: 'check', risk: 'low', relatedAttribute: 'wis' },
      { id: 'check_board', label: '看看委托板', type: 'exploration', risk: 'low' },
      { id: 'talk_boss', label: '跟酒馆老板聊聊', type: 'dialogue', risk: 'low' },
      { id: 'sit_down', label: '找个位子坐下，想想接下来的打算', type: 'cautious', risk: 'low' },
      { id: 'go_outside', label: '离开酒馆，去镇上转转', type: 'travel', risk: 'low' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
    mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
    worldBroadcasts: [],
    memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
  };
}
