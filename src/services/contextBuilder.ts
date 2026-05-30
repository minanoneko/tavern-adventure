import type { Player, WorldState, AIResponse, PlayerAction, JudgeResult, LogEntry, ActionOption, SelectedActionContext } from '../types';
import { getLocationById, getSubregionById, getRegionById } from '../data/regions';
import { getSkillById } from '../data/skills';
import { getEquipmentById } from '../data/equipment';
import { getSkillLockReasons, canCastSkill } from '../utils/skillRules';
import { getActiveTraits, getEquipmentPenalty } from '../utils/equipmentRules';
import { getLongTermSummary, formatSummaryForAI, getRecentImportantLogs, getGameFlags } from './memoryService';

// ========== Budget limits (character counts) ==========
const BUDGET = {
  playerBrief: 600,
  currentScene: 400,
  inventory: 500,
  skills: 400,
  quests: 400,
  relationships: 300,
  worldBrief: 400,
  recentLogs: 500,
  longTermSummary: 800,
  hardRules: 500,
  selectedAction: 400,
  lockedStoryFacts: 600,
};

// ========== AIContext type ==========
export interface AIContext {
  playerBrief: string;
  currentSceneBrief: string;
  relevantInventory: string;
  relevantSkills: string;
  activeQuests: string;
  relationshipBrief: string;
  worldBrief: string;
  recentLogs: string;
  longTermSummary: string;
  hardRules: string;
  selectedAction?: SelectedActionContext;
  lockedStoryFacts: string;
  combatRequest?: string;
  threatLevel?: number;
}

function trunc(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

// ========== 1. playerBrief ==========
function buildPlayerBrief(player: Player): string {
  const attrKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
  const attrLabels = ['力', '敏', '体', '智', '感', '魅'];
  const attrs = attrKeys.map((k, i) => `${attrLabels[i]}${player.attributes[k]}`).join(' ');

  // Current equipment
  const gear = Object.entries(player.equipment)
    .filter(([, id]) => id !== null)
    .map(([, id]) => getEquipmentById(id!)?.name || id)
    .join(', ');

  // Usable skills
  const usable = player.skills.learned.filter(sid => {
    const skill = getSkillById(sid);
    return skill && canCastSkill(skill, player);
  });

  // Status effects
  const status = player.statusEffects.filter(s => s !== '正常');

  const genderLabel = player.gender === '女' ? '女性(必须用她/少女/女士/女冒险者称呼)' : player.gender === '男' ? '男性(必须用他/少年/先生/男冒险者称呼)' : '未指定';

  return trunc(
    `[${player.name}] ${genderLabel} Lv.${player.level} ${player.race} ${player.classOrigin} | ` +
    `HP ${player.resources.hp}/${player.resources.maxHp} MP ${player.resources.mp}/${player.resources.maxMp} | ` +
    `${attrs} | ` +
    `装备: ${gear || '无'} | ` +
    `可用技能: ${usable.join(', ') || '无'}` +
    (status.length ? ` | 状态: ${status.join(',')}` : '') +
    (player.attributePoints > 0 ? ` | 未分配属性点: ${player.attributePoints}` : '') +
    (player.skillPoints > 0 ? ` | 未分配技能点: ${player.skillPoints}` : ''),
    BUDGET.playerBrief
  );
}

// ========== 2. currentSceneBrief ==========
function buildCurrentScene(worldState: WorldState, currentEvent: AIResponse | null): string {
  const loc = getLocationById(worldState.currentLocation);
  const locName = loc?.name || worldState.currentLocation;

  // Nearby known locations
  const nearby = worldState.discoveredLocations
    .filter(id => id !== worldState.currentLocation)
    .slice(0, 4)
    .map(id => getLocationById(id)?.name || id);

  return trunc(
    `位置: ${locName} | ${worldState.date} ${worldState.timeOfDay} ${worldState.weather}` +
    (nearby.length ? ` | 附近: ${nearby.join(', ')}` : '') +
    (currentEvent ? ` | 当前事件: ${currentEvent.scene.title}` : ''),
    BUDGET.currentScene
  );
}

// ========== 3. relevantInventory ==========
function buildRelevantInventory(player: Player, _action: PlayerAction): string {
  // Priority: high/critical items + quest items + skill books + recent acquisitions
  const priorityItems = player.inventory.filter(i =>
    i.type === 'quest_item' ||
    i.type === 'skill_book' ||
    ['high', 'critical'].includes((i as any).importance || '') ||
    ['uncommon', 'rare', 'epic', 'legendary'].includes(i.rarity)
  );

  if (priorityItems.length === 0) return '无重要物品';

  // Also include currently equipped items as reference
  const equipped = Object.values(player.equipment).filter(Boolean) as string[];
  const equipNames = equipped.map(id => getEquipmentById(id)?.name || id);

  return trunc(
    (equipNames.length ? `装备中: ${equipNames.join(', ')}` : '') +
    (priorityItems.length ? ` | 重要物品: ${priorityItems.map(i =>
      `${i.name}${i.quantity > 1 ? `x${i.quantity}` : ''}`
    ).join('; ')}` : ''),
    BUDGET.inventory
  );
}

// ========== 4. relevantSkills ==========
function buildRelevantSkills(player: Player, action: PlayerAction): string {
  const parts: string[] = [];

  // Usable skills
  const usable = player.skills.learned.filter(sid => {
    const skill = getSkillById(sid);
    return skill && canCastSkill(skill, player);
  });

  if (usable.length > 0) {
    parts.push(`可用: ${usable.join(', ')}`);
  }

  // Action-related skill
  if (action.relatedSkill) {
    const skill = getSkillById(action.relatedSkill);
    if (skill) {
      if (player.skills.learned.includes(action.relatedSkill)) {
        parts.push(`行动关联: ${skill.name}(已学会${canCastSkill(skill, player) ? '/可释放' : '/不可释放'})`);
      } else {
        parts.push(`行动关联: ${skill.name}(未学会)`);
      }
    }
  }

  // Important locked skills (learned but can't cast)
  const locked = player.skills.learned
    .filter(sid => !canCastSkill(getSkillById(sid)!, player))
    .slice(0, 3);
  for (const sid of locked) {
    const skill = getSkillById(sid);
    if (skill) {
      const reasons = getSkillLockReasons(skill, player);
      if (reasons.length > 0) {
        parts.push(`锁定: ${skill.name}(${reasons.join(', ')})`);
      }
    }
  }

  return trunc(parts.join(' | ') || '无技能', BUDGET.skills);
}

// ========== 5. activeQuests ==========
function buildActiveQuests(player: Player, worldState: WorldState): string {
  const active = player.quests.filter(q =>
    q.status === 'active' || q.status === 'available' || q.status === 'completable'
  );

  if (active.length === 0) return '无活跃任务';

  // Sort: current location quests first
  const sorted = [...active].sort((a, b) => {
    const aNearby = a.relatedLocation === worldState.currentLocation ? -1 : 0;
    const bNearby = b.relatedLocation === worldState.currentLocation ? -1 : 0;
    return aNearby - bNearby;
  });

  return trunc(
    sorted.map(q => {
      const incomplete = q.objectives?.filter(o => !o.completed).map(o => o.description).join('; ') || '';
      return `${q.status === 'active' ? '▶' : q.status === 'completable' ? '✓' : '○'} ${q.name}${incomplete ? `: ${incomplete}` : ''}`;
    }).join(' | '),
    BUDGET.quests
  );
}

// ========== 6. relationshipBrief ==========
function buildRelationshipBrief(player: Player, worldState: WorldState): string {
  // Only NPCs with non-zero standing, plus current location relevant factions
  const relevant = player.relationships.filter(r =>
    r.standing !== 0 || r.type === 'npc'
  ).slice(0, 5);

  if (relevant.length === 0) return '无已知关系';

  const getLabel = (s: number) => s >= 30 ? '信任' : s >= 15 ? '友善' : s >= 5 ? '熟悉' : s >= -5 ? '中立' : s >= -15 ? '冷淡' : '敌对';

  return trunc(
    relevant.map(r => `${r.name}(${getLabel(r.standing)}, ${r.standing > 0 ? '+' : ''}${r.standing})`).join(' | '),
    BUDGET.relationships
  );
}

// ========== 7. worldBrief ==========
function buildWorldBrief(worldState: WorldState): string {
  const parts: string[] = [];

  // Active rumors (last 2)
  if (worldState.activeRumors.length > 0) {
    parts.push(`传闻: ${worldState.activeRumors.slice(-2).join('; ')}`);
  }

  // Important flags (filter out boring ones)
  const interestingFlags = worldState.worldFlags.filter(f =>
    !f.startsWith('log_') && !['game_started', 'checked_board'].includes(f)
  ).slice(0, 6);
  if (interestingFlags.length > 0) {
    parts.push(`标记: ${interestingFlags.join(', ')}`);
  }

  return trunc(parts.join(' | ') || '暂无世界动态', BUDGET.worldBrief);
}

// ========== 8. recentLogs ==========
function buildRecentLogs(logs: LogEntry[]): string {
  const important = getRecentImportantLogs(logs, 8);
  if (important.length === 0) return '暂无日志';
  return trunc(
    important.map(l => `[${l.type}] ${l.text}`).join('\n'),
    BUDGET.recentLogs
  );
}

// ========== 9. longTermSummary ==========
function buildLongTermSummary(_player: Player, _worldState: WorldState): string {
  const summary = getLongTermSummary();
  const flags = getGameFlags();
  const text = formatSummaryForAI(summary);
  const flagText = flags.length > 0 ? ` | 标记: ${flags.join(', ')}` : '';
  return trunc(text + flagText, BUDGET.longTermSummary);
}

// ========== 10. hardRules ==========
const HARD_RULES = `[规则] 玩家数据以本地系统为准。AI不可直接改属性/发神器/给大量金币。奖励需合理且符合等级。遵守判定结果。输出camelCase JSON。`;

// ========== 11. selectedAction ==========
function buildSelectedAction(option?: ActionOption): SelectedActionContext | undefined {
  if (!option) return undefined;
  return {
    id: option.id,
    label: option.label,
    intent: option.intent || option.label,
    contextNote: option.contextNote || '当前场景内行动',
    type: option.type,
    targetEntityId: option.targetEntityId,
    relatedEntityIds: option.relatedEntityIds,
    relatedEntityNames: option.relatedEntityNames,
    continuesScene: option.continuesScene,
    allowsTransition: option.allowsTransition,
  };
}

// ========== 12. lockedStoryFacts (relevance-sorted, max 8) ==========
function buildLockedStoryFacts(lockedFacts: string[], worldState: WorldState, selectedOption?: ActionOption): string {
  if (!lockedFacts.length) return '无';

  // Score each fact by relevance: matching entity names in selectedOption or current location
  const entityNames = new Set<string>();
  if (selectedOption?.relatedEntityNames) {
    selectedOption.relatedEntityNames.forEach(n => entityNames.add(n));
  }
  if (selectedOption?.targetEntityId) {
    entityNames.add(selectedOption.targetEntityId);
  }
  if (worldState.currentLocationName) {
    entityNames.add(worldState.currentLocationName);
  }

  const scored = lockedFacts.map(fact => {
    let score = 0;
    for (const name of entityNames) {
      if (fact.includes(name)) score += 10;
    }
    // Also boost facts mentioning current event keywords
    return { fact, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 8).map(s => `- ${s.fact}`).join('\n');

  return trunc(top, BUDGET.lockedStoryFacts);
}

// ========== Main builder ==========
export function buildAIContext(
  player: Player,
  worldState: WorldState,
  playerAction: PlayerAction,
  judgeResult: JudgeResult,
  recentLogs: LogEntry[],
  currentEvent: AIResponse | null,
  selectedOption?: ActionOption,
): AIContext {
  return {
    playerBrief: buildPlayerBrief(player),
    currentSceneBrief: buildCurrentScene(worldState, currentEvent),
    relevantInventory: buildRelevantInventory(player, playerAction),
    relevantSkills: buildRelevantSkills(player, playerAction),
    activeQuests: buildActiveQuests(player, worldState),
    relationshipBrief: buildRelationshipBrief(player, worldState),
    worldBrief: buildWorldBrief(worldState),
    recentLogs: buildRecentLogs(recentLogs),
    longTermSummary: buildLongTermSummary(player, worldState),
    hardRules: HARD_RULES,
    selectedAction: buildSelectedAction(selectedOption),
    lockedStoryFacts: buildLockedStoryFacts(worldState.lockedStoryFacts, worldState, selectedOption),
    combatRequest: worldState.combatTrigger
      ? `[战斗触发器] 类型:${worldState.combatTrigger.type==='hard'?'强制':'建议'} 原因:${worldState.combatTrigger.reason} 目标:${worldState.combatTrigger.targetHint}`
      : undefined,
    threatLevel: worldState.threatLevel || 0,
  };
}

/** Format AIContext as a compact string for the AI prompt */
export function formatAIContext(ctx: AIContext): string {
  const lines: string[] = [
    `[角色] ${ctx.playerBrief}`,
    `[场景] ${ctx.currentSceneBrief}`,
    `[物品] ${ctx.relevantInventory}`,
    `[技能] ${ctx.relevantSkills}`,
    `[任务] ${ctx.activeQuests}`,
    `[关系] ${ctx.relationshipBrief}`,
    `[世界] ${ctx.worldBrief}`,
    `[长期] ${ctx.longTermSummary}`,
    `[日志] ${ctx.recentLogs}`,
  ];

  if (ctx.selectedAction) {
    const sa = ctx.selectedAction;
    const saLines = [`[玩家意图] 目的: ${sa.intent} | 关联: ${sa.contextNote}`];
    if (sa.targetEntityId) saLines.push(`目标: ${sa.targetEntityId}`);
    if (sa.relatedEntityIds?.length) saLines.push(`关联实体: ${sa.relatedEntityIds.join(', ')}`);
    if (sa.relatedEntityNames?.length) saLines.push(`关联名称: ${sa.relatedEntityNames.join(', ')}`);
    lines.push(saLines.join(' | '));
  }

  if (ctx.combatRequest) lines.push(ctx.combatRequest);
  if (ctx.threatLevel && ctx.threatLevel >= 50) lines.push(`[威胁等级] ${ctx.threatLevel}% — 危险临近，应触发战斗`);
  lines.push(`[锁定事实]\n${ctx.lockedStoryFacts}`);
  lines.push(ctx.hardRules);

  return lines.join('\n');
}
