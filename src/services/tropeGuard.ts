import type { AIResponse, PlayerAction, WorldState } from '../types';
import type { LogEntry } from '../types/log';
import { createLogEntry } from '../types/log';

const STALE_TROPE_PATTERN = /商队|采石场|旧矿|矿道|矿洞|塌洞|塌陷洞穴|森林小道|小道|羊皮纸|黑袍|兜帽|蓝光/;

function textAllowsTrope(worldState: WorldState, action?: PlayerAction): boolean {
  const actionText = action?.customText || action?.id || '';
  const knownText = [
    actionText,
    worldState.currentLocation,
    worldState.currentLocationName || '',
    worldState.currentGoal || '',
    ...(worldState.lockedStoryFacts || []),
    ...(worldState.storyHooks || []).map(h => `${h.title} ${h.summary}`),
  ].join('\n');
  return STALE_TROPE_PATTERN.test(knownText);
}

function neutralizeText(text: string): string {
  return text
    .replace(/旧采石场|采石场|旧矿洞|矿洞|矿道|塌洞|塌陷洞穴/g, '旧仓库')
    .replace(/商队/g, '送货队')
    .replace(/森林小道|小道/g, '街巷')
    .replace(/羊皮纸/g, '便条')
    .replace(/黑袍人|兜帽人|黑袍|兜帽/g, '陌生人')
    .replace(/蓝光/g, '冷光');
}

export function guardStaleTropes(response: AIResponse, worldState: WorldState, action: PlayerAction | undefined, logs: LogEntry[]): void {
  if (textAllowsTrope(worldState, action)) return;

  const before = JSON.stringify({
    scene: response.scene,
    systemEvents: response.systemEvents,
    actionOptions: response.actionOptions,
    questUpdate: response.questUpdate,
    storyHookUpdate: response.storyHookUpdate,
    mapUpdate: response.mapUpdate,
    worldBroadcasts: response.worldBroadcasts,
    memoryUpdate: response.memoryUpdate,
  });

  if (!STALE_TROPE_PATTERN.test(before)) return;

  response.scene = {
    ...response.scene,
    title: neutralizeText(response.scene.title),
    text: neutralizeText(response.scene.text),
    location: neutralizeText(response.scene.location),
    locationId: /mine|old_mine|forest_road/.test(response.scene.locationId || '') ? worldState.currentLocation : response.scene.locationId,
  };
  response.systemEvents = response.systemEvents.map(e => ({ ...e, text: neutralizeText(e.text) }));
  response.actionOptions = response.actionOptions
    .filter(o => !STALE_TROPE_PATTERN.test(`${o.label}${o.intent || ''}${o.contextNote || ''}`))
    .map(o => ({ ...o, label: neutralizeText(o.label), intent: o.intent ? neutralizeText(o.intent) : o.intent, contextNote: o.contextNote ? neutralizeText(o.contextNote) : o.contextNote }));
  response.questUpdate = response.questUpdate.filter(q => !STALE_TROPE_PATTERN.test(`${q.name}${q.description || ''}${q.giver || ''}`));
  response.storyHookUpdate = (response.storyHookUpdate || []).filter(h => !STALE_TROPE_PATTERN.test(`${h.title || ''}${h.summary}`));
  response.mapUpdate = response.mapUpdate.filter(m => !STALE_TROPE_PATTERN.test(`${m.name || ''}${m.targetId}`));
  response.worldBroadcasts = response.worldBroadcasts.filter(b => !STALE_TROPE_PATTERN.test(b.text));
  response.memoryUpdate = {
    ...response.memoryUpdate,
    knownLocations: response.memoryUpdate.knownLocations?.filter(l => !/mine|old_mine|forest_road/.test(l)),
    lockedFacts: response.memoryUpdate.lockedFacts?.filter(f => !STALE_TROPE_PATTERN.test(f)),
  };

  if (response.actionOptions.length < 2) {
    response.actionOptions.push(
      { id: `local_follow_${Date.now()}_1`, label: '追问当前条件', type: 'dialogue', risk: 'low', intent: '向当前人物追问眼前条件', contextNote: '当前场景内的人物或交易' },
      { id: `local_follow_${Date.now()}_2`, label: '复核当前物件', type: 'check', risk: 'low', relatedAttribute: 'wis', intent: '检查当前物件或证词', contextNote: '当前场景内的物件或证词' },
    );
  }

  logs.push(createLogEntry('system', 'AI输出包含已禁用旧套路元素，已按当前场景本地改写/移除。'));
}
