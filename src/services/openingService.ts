import type { Player, WorldState, AIResponse } from '../types';
import type { TimeOfDay, Weather } from '../types/common';
import type { AISettings } from '../store/settingsStore';
import { sanitizeOrigin } from './backgroundGuard';
import { getOpeningByClass, getSafeDefaultOpening } from '../data/openingTemplates';
import { buildOpeningPrompt } from '../prompts/openingPrompt';
import { buildSystemMessages } from './promptService';
import { normalizeAndComplete } from './responseAdapter';

const STALE_OPENING_TROPE_PATTERN = /矿|采石|洞穴|塌洞|塌陷|商队|护送商路|失踪|失散|不知所踪|森林小道|符文|羊皮纸|蓝光|黑袍|兜帽/;

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
): Promise<OpeningResult> {
  // Step 1: Sanitize custom origin
  const guardResult = sanitizeOrigin(player.customOrigin, player);

  // Step 2: Generate opening with the configured AI. If the API fails, use the safe local opening only as error fallback.
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
  } catch {
    // Fall through to safe local fallback.
  }
  guardResult.warnings.push('AI 开局生成失败，已使用安全本地开局兜底。请检查 API 设置是否正确。');

  // Step 3: Safe local fallback
  const fallbackEvent = getOpeningByClass(player.classOrigin, guardResult.sanitizedOrigin);
  if (fallbackEvent) {
    return {
      event: normalizeOpeningScene(fallbackEvent),
      sanitizedOrigin: guardResult.sanitizedOrigin,
      warnings: guardResult.warnings,
      deniedClaims: guardResult.deniedClaims,
    };
  }

  // Ultimate fallback: safe local incident opening
  return {
    event: getGenericOpening(player.classOrigin, guardResult.sanitizedOrigin),
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
        temperature: 0.3,
        max_tokens: 2000,
        ...(settings.useJsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) {
      content = data.choices?.[0]?.message?.reasoning_content;
    }
    if (!content) return null;

    const result = normalizeAndComplete(content);
    if (result.success) {
      const event = normalizeOpeningScene(result.response);
      if (!sanitizedOrigin.trim() && hasStaleOpeningTrope(event)) {
        console.warn('Opening AI response used stale default trope, falling back to safe template.');
        return null;
      }
      return event;
    }

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

function hasStaleOpeningTrope(event: AIResponse): boolean {
  const searchable = [
    event.scene.title,
    event.scene.text,
    event.scene.location,
    ...event.systemEvents.map(e => e.text),
    ...event.actionOptions.map(o => o.label),
  ].join(' ');
  return STALE_OPENING_TROPE_PATTERN.test(searchable);
}

function normalizeOpeningScene(event: AIResponse): AIResponse {
  const commonOpeningTimes: TimeOfDay[] = ['清晨', '上午', '下午', '傍晚'];
  const commonOpeningWeathers: Weather[] = ['晴', '多云', '阴'];
  const needsTimeNudge = /深夜|夜晚|半夜|午夜/.test(event.scene.time || '');
  const needsWeatherNudge = /雨|暴风雨|雾/.test(event.scene.weather || '');
  if (needsTimeNudge) {
    event.scene.time = `雾月3日 ${commonOpeningTimes[Math.floor(Math.random() * commonOpeningTimes.length)]}`;
  }
  if (needsWeatherNudge) {
    event.scene.weather = commonOpeningWeathers[Math.floor(Math.random() * commonOpeningWeathers.length)];
  }
  return event;
}

function getGenericOpening(classId: string, sanitizedOrigin: string): AIResponse {
  if (!sanitizedOrigin.trim()) {
    return getSafeDefaultOpening(classId);
  }

  const openWeathers: Weather[] = ['晴', '多云', '阴'];
  const openTimes: TimeOfDay[] = ['清晨', '上午', '下午', '傍晚'];
  const weather = openWeathers[Math.floor(Math.random() * openWeathers.length)];
  const time = openTimes[Math.floor(Math.random() * openTimes.length)];
  let text = `你来到灰鹿酒馆外的长桌旁。老板娘正和一个送货人核对账本，桌上摆着两枚成色不对的铜币和一小袋被退回的香料。`;
  if (sanitizedOrigin.trim()) {
    text += `\n\n${sanitizedOrigin}`;
  }
  text += `\n\n送货人坚持自己没动过货，老板娘却说账目昨晚就对不上。事情不大，但周围已经有人开始看热闹。你可以插手，也可以把这当成进镇后的第一段闲事。`;

  return {
    scene: { title: '灰鹿酒馆', text, location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: `雾月3日 ${time}`, weather },
    event: { id: 'generic_opening', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [],
    actionOptions: [
      { id: 'ask_ledger', label: '问老板娘账目', type: 'dialogue', risk: 'low' },
      { id: 'inspect_coins', label: '辨认异常铜币', type: 'check', risk: 'low', relatedAttribute: 'int' },
      { id: 'talk_courier', label: '安抚送货人', type: 'social', risk: 'low', relatedAttribute: 'cha' },
      { id: 'follow_spice_smell', label: '追香料味来源', type: 'check', risk: 'medium', relatedAttribute: 'wis' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
    mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
    worldBroadcasts: [],
    memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
  };
}
