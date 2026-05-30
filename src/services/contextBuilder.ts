import type { Player, WorldState, AIResponse, PlayerAction, JudgeResult, LogEntry, ActionOption, SelectedActionContext, PostCombat } from '../types';
import { ALLOWED_ITEM_IDS } from '../data/itemCatalog';
import { REGIONS, SUBREGIONS, CONNECTIONS, getLocationById, getSubregionById, getRegionById } from '../data/regions';
import { getSkillById } from '../data/skills';
import { getEquipmentById } from '../data/equipment';
import { getTraitById } from '../data/races';
import { getSkillLockReasons, canCastSkill } from '../utils/skillRules';
import { getActiveTraits, getEquipmentPenalty } from '../utils/equipmentRules';
import { getLongTermSummary, formatSummaryForAI, getRecentImportantLogs, getGameFlags } from './memoryService';

// ========== Budget limits (character counts) ==========
const BUDGET = {
  playerBrief: 600,
  currentScene: 900,
  inventory: 500,
  skills: 400,
  quests: 400,
  relationships: 300,
  worldBrief: 400,
  recentLogs: 500,
  longTermSummary: 800,
  hardRules: 500,
  mapLeads: 500,
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
  postCombatSection?: string;
  combatRequest?: string;
  threatLevel?: number;
  mapLeads: string;
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
  const traitNames = player.personalityTraits.map(id => getTraitById(id)?.name || id).filter(Boolean);
  const ageTone = player.age < 18 ? '少年/少女，阅历较浅但反应直接'
    : player.age >= 50 ? '年长冒险者，阅历较深，行动稳健'
    : '成年冒险者';

  return trunc(
    `[${player.name}] ${genderLabel} Lv.${player.level} ${player.race} ${player.classOrigin} | ` +
    `年龄:${player.age}(${ageTone}) | 性格:${traitNames.join('、') || '未选'} | ` +
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

  const sceneParts = [
    `位置: ${locName}`,
    `${worldState.date} ${worldState.timeOfDay} ${worldState.weather}`,
  ];
  if (nearby.length) sceneParts.push(`附近: ${nearby.join(', ')}`);
  if (currentEvent) {
    const optionHints = currentEvent.actionOptions
      .slice(0, 5)
      .map(o => o.intent || o.contextNote || o.label)
      .filter(Boolean)
      .join(' / ');
    sceneParts.push(`当前事件标题: ${currentEvent.scene.title}`);
    sceneParts.push(`当前事件正文: ${currentEvent.scene.text.slice(-420)}`);
    if (optionHints) sceneParts.push(`当前可延展方向: ${optionHints}`);
  }

  return trunc(sceneParts.join(' | '), BUDGET.currentScene);
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

// ========== 5. storyHooks (replaces activeQuests) ==========
function buildStoryHooks(worldState: WorldState): string {
  const hooks = worldState.storyHooks || [];
  const openHooks = hooks.filter(h => h.status === 'open');
  const resolvedHooks = hooks.filter(h => h.status === 'resolved').slice(-3);

  const parts: string[] = [];

  // Current goal
  if (worldState.currentGoal) {
    parts.push(`[当前目标] ${worldState.currentGoal}`);
  }

  // Open hooks
  if (openHooks.length > 0) {
    parts.push('[未解决线索] ' + openHooks.map(h =>
      `${h.title}: ${h.summary.slice(0, 50)}`
    ).join(' | '));
  }

  // Recently resolved
  if (resolvedHooks.length > 0) {
    parts.push('[最近解决] ' + resolvedHooks.map(h => h.title).join(', '));
  }

  if (parts.length === 0) return '暂无剧情线索';

  return trunc(parts.join('\n'), BUDGET.quests);
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
  const mineRelevant =
    worldState.currentLocation.includes('mine') ||
    worldState.worldFlags.some(f => f.includes('mine')) ||
    (worldState.currentGoal || '').includes('矿') ||
    (worldState.storyHooks || []).some(h => `${h.title}${h.summary}`.includes('矿'));

  // Active rumors (last 2)
  if (worldState.activeRumors.length > 0) {
    const rumors = worldState.activeRumors
      .filter(r => mineRelevant || !/矿洞|矿道|旧矿|蓝光|失踪/.test(r))
      .slice(-2);
    if (rumors.length > 0) parts.push(`传闻: ${rumors.join('; ')}`);
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

function meetsUnlockForContext(condition: { type: string; minLevel?: number; factionId?: string; minStanding?: number; flag?: string } | undefined, player: Player, worldState: WorldState): boolean {
  if (!condition) return true;
  if (condition.type === 'level') return player.level >= (condition.minLevel ?? 1);
  if (condition.type === 'flag') return !!condition.flag && worldState.worldFlags.includes(condition.flag);
  if (condition.type === 'faction') return (worldState.factionStandings[condition.factionId || ''] ?? 0) >= (condition.minStanding ?? 0);
  return false;
}

function buildMapLeads(player: Player, worldState: WorldState): string {
  const leads: string[] = [];

  for (const region of REGIONS) {
    if (worldState.discoveredRegions.includes(region.id)) continue;
    if (!meetsUnlockForContext(region.unlockCondition, player, worldState)) continue;
    if (player.level + 2 < region.recommendedLevel) continue;
    leads.push(`${region.name}(区域, Lv.${region.recommendedLevel}+): 可通过传闻/向导/路线线索自然引出，不能瞬间抵达`);
  }

  for (const sub of SUBREGIONS) {
    if (worldState.discoveredLocations.includes(sub.id)) continue;
    if (!worldState.discoveredRegions.includes(sub.regionId)) continue;
    if (!meetsUnlockForContext(sub.unlockCondition, player, worldState)) continue;
    if (player.level + 2 < sub.recommendedLevel) continue;
    leads.push(`${sub.name}(子区域, Lv.${sub.recommendedLevel}+): 可作为旅行选项或边境线索`);
  }

  const current = worldState.currentLocation;
  for (const route of CONNECTIONS) {
    if (worldState.unlockedRoutes.includes(route.id)) continue;
    if (route.fromId !== current && route.toId !== current) continue;
    if (!meetsUnlockForContext(route.requirements, player, worldState)) continue;
    leads.push(`${route.name}(路线): 可以出现路标/向导/船票/通行许可线索`);
  }

  return trunc(leads.slice(0, 5).join(' | ') || '暂无新地图引出条件', BUDGET.mapLeads);
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

// ========== 10. postCombat section ==========
function buildPostCombatSection(worldState: WorldState): string | undefined {
  const pc = worldState.postCombat;
  if (!pc) return undefined;

  const outcomeLabel = pc.outcome === 'victory' ? '胜利' : pc.outcome === 'defeat' ? '战败' : '逃跑';
  const enemyText = pc.enemyNames.join('、') || '敌人';
  const statusText =
    pc.enemyStatus === 'defeated' ? `已被击败` :
    pc.enemyStatus === 'victorious' ? `击败了玩家，占据上风` :
    pc.enemyStatus === 'left' ? `已离开` : `已脱离战斗`;

  let guidance = '';
  if (pc.outcome === 'defeat') {
    guidance = `下一幕必须承接战败后果：昏迷醒来、被放过、被俘、逃回安全处、被路人救起、敌人离开等。禁止反转成玩家胜利或敌人求饶。`;
  } else if (pc.outcome === 'victory') {
    guidance = `敌人已败/已逃，不能后续写敌人反杀或复活再战。`;
  } else {
    guidance = `敌人仍在该区域，玩家成功脱离。`;
  }

  return `[刚刚战斗结果] 玩家刚刚【${outcomeLabel}】，${enemyText} ${statusText}。${guidance}`;
}

// ========== 11. hardRules ==========
const HARD_RULES = `[规则] 玩家数据以本地系统为准。AI不可直接改属性/发神器/给大量金币。奖励需合理且符合等级。遵守判定结果。输出camelCase JSON。
[连续性] 必须优先承接[场景]中的当前事件正文、NPC、地点、目标和刚刚出现的问题。玩家自定义输入是对当前事件的追问或行动意图，不是新剧情种子；除非玩家明确移动/放弃/转场，不得把当前事件替换成另一个任务、地点或冲突。
[地图权限] 玩家说“前往/来到某地”只是旅行意图，不是既成事实。未发现、未解锁、等级/阵营/旗标不足的区域只能写成打听路线、寻找向导、抵达边境、被拦下或听到传闻；不得直接切到该地图。
[地图引出] 当[可引出的地图]列出新区域/路线时，可以在当前剧情中自然出现线索、邀请、路标、向导、船票或通行许可选项；第一步应是“获得前往机会”，不是上一秒在原地、下一秒直接抵达。
[反复套路限制] 除非当前场景/任务/锁定事实/玩家输入明确提到，不要主动生成磨坊、失踪者、符文、羊皮纸、矿道、旧矿洞、蓝光、黑袍神秘人；新女性NPC不要默认叫艾琳。
[选项质量] actionOptions要有具体对象、收益或风险，避免继续调查/观察四周/谨慎行动这类空按钮。
[可用道具白名单] 功能道具仅限：${ALLOWED_ITEM_IDS.join(', ')}。不在白名单内的道具只能作为quest_item/story_item(usable=false)，无任何效果。`;

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
    activeQuests: buildStoryHooks(worldState),
    relationshipBrief: buildRelationshipBrief(player, worldState),
    worldBrief: buildWorldBrief(worldState),
    mapLeads: buildMapLeads(player, worldState),
    recentLogs: buildRecentLogs(recentLogs),
    longTermSummary: buildLongTermSummary(player, worldState),
    hardRules: HARD_RULES,
    selectedAction: buildSelectedAction(selectedOption),
    lockedStoryFacts: buildLockedStoryFacts(worldState.lockedStoryFacts, worldState, selectedOption),
    postCombatSection: buildPostCombatSection(worldState),
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
    `[可引出的地图] ${ctx.mapLeads}`,
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

  if (ctx.postCombatSection) lines.push(ctx.postCombatSection);
  if (ctx.combatRequest) lines.push(ctx.combatRequest);
  if (ctx.threatLevel && ctx.threatLevel >= 50) lines.push(`[威胁等级] ${ctx.threatLevel}% — 危险临近，应触发战斗`);
  lines.push(`[锁定事实]\n${ctx.lockedStoryFacts}`);
  lines.push(ctx.hardRules);

  return lines.join('\n');
}
