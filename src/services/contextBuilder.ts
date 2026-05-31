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
  relationships: 650,
  worldBrief: 400,
  recentLogs: 500,
  longTermSummary: 800,
  hardRules: 500,
  mapLeads: 500,
  selectedAction: 400,
  lockedStoryFacts: 600,
  continuity: 800,
  diversity: 700,
  pacing: 650,
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
  continuityBrief: string;
  diversityBrief: string;
  pacingBrief: string;
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
  const locName = worldState.currentLocationName || loc?.name || worldState.currentLocation;

  // Nearby known locations
  const nearby = worldState.discoveredLocations
    .filter(id => id !== worldState.currentLocation)
    .slice(0, 4)
    .map(id => getLocationById(id)?.name || id);

  const sceneParts = [
    `位置: ${locName}`,
    `${worldState.date} ${worldState.timeOfDay} ${worldState.weather}，天气趋势:${worldState.weatherTrend || 'stable'}，已稳定:${worldState.weatherStableTurns || 0}轮`,
  ];
  if (nearby.length) sceneParts.push(`附近: ${nearby.join(', ')}`);
  if (currentEvent) {
    const optionHints = currentEvent.actionOptions
      .slice(0, 5)
      .map(o => o.intent || o.contextNote || o.label)
      .filter(Boolean)
      .join(' / ');
    sceneParts.push(`当前事件标题: ${currentEvent.scene.title}`);
    sceneParts.push(`已发生正文(只用于承接，不得复述或改写进下一段): ${currentEvent.scene.text.slice(-420)}`);
    if (optionHints) sceneParts.push(`当前可延展方向: ${optionHints}`);
  }

  return trunc(sceneParts.join(' | '), BUDGET.currentScene);
}

function normalizeSceneLocation(worldState: WorldState, event: AIResponse): string {
  return event.scene.locationId || event.scene.location || worldState.currentLocationName || worldState.currentLocation;
}

function sameCurrentPlace(worldState: WorldState, event: AIResponse): boolean {
  const loc = normalizeSceneLocation(worldState, event);
  return loc === worldState.currentLocation ||
    loc === worldState.currentLocationName ||
    event.scene.locationId === worldState.currentLocation ||
    event.scene.location === worldState.currentLocationName;
}

function buildContinuityBrief(
  player: Player,
  worldState: WorldState,
  currentEvent: AIResponse | null,
  eventHistory: AIResponse[],
  logs: LogEntry[],
): string {
  const parts: string[] = [];
  const currentPlace = worldState.currentLocationName || getLocationById(worldState.currentLocation)?.name || worldState.currentLocation;
  parts.push(`当前位置锚定: ${currentPlace}。除非玩家明确移动或选项allowsTransition=true，下一幕仍发生在这里。`);

  const recentScenes = eventHistory.slice(-5).map(e => {
    const loc = e.scene.location || e.scene.locationId || '当前地点';
    const text = e.scene.text.replace(/\s+/g, '').slice(-90);
    return `${loc}《${e.scene.title}》${text}`;
  });
  if (recentScenes.length) {
    parts.push(`最近剧情顺序: ${recentScenes.join(' -> ')}`);
  }

  const samePlaceScenes = eventHistory.filter(e => sameCurrentPlace(worldState, e)).slice(-3);
  const presentNpcNames = player.relationships
    .filter(r => r.type === 'npc' && r.name && samePlaceScenes.some(e => e.scene.text.includes(r.name)))
    .map(r => r.name);
  if (presentNpcNames.length) {
    parts.push(`当前地点刚刚在场/交谈过的NPC: ${[...new Set(presentNpcNames)].join('、')}。除非最近剧情写明离开，不要把他们突然改成在别处。`);
  }

  const recentNarrative = logs
    .filter(l => ['narrative', 'quest', 'combat', 'world', 'judge'].includes(l.type))
    .slice(-6)
    .map(l => `[${l.type}]${l.text.slice(0, 85)}`);
  if (recentNarrative.length) {
    parts.push(`最近已发生: ${recentNarrative.join(' | ')}`);
  }

  if (worldState.postCombat) {
    parts.push(`刚结束战斗: ${worldState.postCombat.summary}。玩家现在是在战斗后的当前地点继续调查，不是第一次抵达线索地点。`);
  }

  if (currentEvent) {
    parts.push(`承接要求: 自定义输入若问"痕迹/线索/谁是真的/再找找"，默认是在当前地点复核已知矛盾或已追踪到的线索；不要重置为第一次发现，也不要把刚在场NPC挪走。`);
    parts.push(`去重要求: 上一段scene.text是已发生事实，只能写“之后发生的新变化”。不得用同义句复述上一段的动作、环境描写、NPC台词或已揭示信息。`);
  }

  return trunc(parts.join('\n'), BUDGET.continuity);
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
  const currentLocationName = worldState.currentLocationName || worldState.currentLocation;
  const relevant = player.relationships
    .filter(r => r.standing !== 0 || r.type === 'npc')
    .sort((a, b) => {
      const aHere = `${a.description || ''}${a.occupation || ''}`.includes(currentLocationName) ? 1 : 0;
      const bHere = `${b.description || ''}${b.occupation || ''}`.includes(currentLocationName) ? 1 : 0;
      return bHere - aHere;
    })
    .slice(0, 10);

  if (relevant.length === 0) return '无已知关系';

  const getLabel = (s: number) => s >= 30 ? '信任' : s >= 15 ? '友善' : s >= 5 ? '熟悉' : s >= -5 ? '中立' : s >= -15 ? '冷淡' : '敌对';

  return trunc(
    relevant.map(r => {
      const profile = [r.race, r.occupation].filter(Boolean).join('/');
      const desc = r.description ? `; ${r.description.slice(0, 42)}` : '';
      return `${r.name}(${profile || '身份未明'}, ${getLabel(r.standing)}, ${r.standing > 0 ? '+' : ''}${r.standing}${desc})`;
    }).join(' | '),
    BUDGET.relationships
  );
}

// ========== 7. worldBrief ==========
function buildWorldBrief(worldState: WorldState): string {
  const parts: string[] = [];
  const tropeRelevant =
    worldState.currentLocation.includes('mine') ||
    worldState.worldFlags.some(f => f.includes('mine')) ||
    (worldState.currentGoal || '').includes('矿') ||
    (worldState.storyHooks || []).some(h => /矿|磨坊|失踪|商队|小道|旧矿|蓝光/.test(`${h.title}${h.summary}`));

  // Active rumors (last 2)
  if (worldState.activeRumors.length > 0) {
    const rumors = worldState.activeRumors
      .filter(r => tropeRelevant || !/矿洞|矿道|旧矿|蓝光|失踪|磨坊|商队|小道/.test(r))
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

function buildDiversityBrief(worldState: WorldState, currentEvent: AIResponse | null, eventHistory: AIResponse[], logs: LogEntry[]): string {
  const recentText = [
    ...eventHistory.slice(-8).map(e => `${e.scene.title} ${e.scene.location} ${e.scene.text}`),
    ...logs.slice(-12).map(l => l.text),
    currentEvent ? `${currentEvent.scene.title} ${currentEvent.scene.location} ${currentEvent.scene.text}` : '',
  ].join('\n');

  const overused: string[] = [];
  const tropeChecks: Array<[string, RegExp]> = [
    ['矿区/矿洞', /矿区|矿洞|矿道|旧矿/g],
    ['磨坊', /磨坊/g],
    ['失踪', /失踪|失散|不知所踪/g],
    ['商队', /商队/g],
    ['小道', /小道|捷径|隐蔽道路/g],
    ['黑袍/神秘人', /黑袍|神秘人|兜帽人/g],
    ['蓝光/符文/羊皮纸', /蓝光|符文|羊皮纸/g],
    ['夜雨雾', /深夜|夜晚|雨|小雨|暴风雨|雾/g],
  ];

  for (const [label, regex] of tropeChecks) {
    const count = (recentText.match(regex) || []).length;
    if (count >= 2) overused.push(label);
  }

  const placeIdeas = [
    '码头货栈', '集市拍卖台', '药剂温室', '钟楼档案室', '旧桥桥洞',
    '河滩营地', '边境驿站', '废弃哨塔', '小礼拜堂后院', '铁匠铺仓房',
  ];
  const conflictIdeas = [
    '证词冲突', '货物调包', '临时雇佣', '债务纠纷', '伪装身份',
    '误会升级', '竞价争夺', '工匠求助', '禁售药材', '巡逻路障',
  ];

  const parts = [
    `近期过度使用元素: ${overused.join('、') || '无明显重复'}`,
    `本轮优先换用地点类型: ${placeIdeas.join('、')}`,
    `本轮优先换用矛盾来源: ${conflictIdeas.join('、')}`,
    `如果玩家没有明确追旧线，避免主动生成矿区、磨坊、失踪、商队、小道、旧矿洞、蓝光、黑袍人。`,
    `天气时间优先普通化：上午/中午/下午/傍晚，晴/多云/阴；深夜、雨、雾只在当前事实需要时使用。`,
  ];

  return trunc(parts.join('\n'), BUDGET.diversity);
}

function buildPacingBrief(currentEvent: AIResponse | null, eventHistory: AIResponse[], logs: LogEntry[]): string {
  const recentScenes = [
    ...eventHistory.slice(-6),
    ...(currentEvent && !eventHistory.includes(currentEvent) ? [currentEvent] : []),
  ];
  const recentText = recentScenes
    .map(e => `${e.scene.title} ${e.scene.text} ${e.actionOptions.map(o => `${o.label} ${o.intent || ''}`).join(' ')}`)
    .join('\n');
  const recentLogText = logs.slice(-10).map(l => l.text).join('\n');
  const allRecent = `${recentText}\n${recentLogText}`;

  const investigationHits = (allRecent.match(/调查|线索|痕迹|继续|深入|搜索|搜寻|观察|查看|核查|追踪|发现/g) || []).length;
  const actionHits = (allRecent.match(/摊牌|交易|威胁|说服|潜入|追逐|伏击|护送|撤离|战斗|冲突|付钱|求援|转场|前往|离开|打开|破门/g) || []).length;
  const resolvedHits = (allRecent.match(/解决|确认|排除|真相|完成|到手|离开|抵达|击败|达成|失败|代价/g) || []).length;
  const lastOptions = recentScenes
    .slice(-2)
    .flatMap(e => e.actionOptions.map(o => o.label))
    .filter(Boolean);

  const needsBreak = investigationHits >= 6 && actionHits <= 2;
  const parts = [
    `近期调查词密度: ${investigationHits}；行动/冲突词密度: ${actionHits}；收束词密度: ${resolvedHits}。`,
    needsBreak
      ? '节奏判断: 已接近“调查-发现线索”循环。本轮必须给实质推进，不要再只新增线索。'
      : '节奏判断: 可以承接当前行动，但仍要避免空泛地继续找线索。',
    '本轮优先推进方式: 确认一个结论、让NPC主动反应、暴露代价、触发对抗、提供转场机会、解决/升级当前线索、或把风险摆到玩家面前。',
    '如果玩家选择调查，可以得到明确判断或代价；不要把结果写成“还有更深线索，需要继续调查”。',
  ];

  if (lastOptions.length) {
    parts.push(`最近按钮: ${lastOptions.join('、')}。本轮不要复用同类空泛按钮。`);
  }

  return trunc(parts.join('\n'), BUDGET.pacing);
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

  const tropePattern = /矿|磨坊|失踪|商队|小道|旧矿|蓝光/;
  const sortedLeads = leads.sort((a, b) => {
    const aTrope = tropePattern.test(a) ? 1 : 0;
    const bTrope = tropePattern.test(b) ? 1 : 0;
    return aTrope - bTrope;
  });

  return trunc(sortedLeads.slice(0, 5).join(' | ') || '暂无新地图引出条件', BUDGET.mapLeads);
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
[反复套路限制] 除非当前场景/任务/锁定事实/玩家输入明确提到，不要主动生成磨坊、失踪者、商队、小道、符文、羊皮纸、矿道、旧矿洞、蓝光、黑袍神秘人；新女性NPC不要默认叫艾琳。
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
  eventHistory: AIResponse[] = [],
): AIContext {
  return {
    playerBrief: buildPlayerBrief(player),
    currentSceneBrief: buildCurrentScene(worldState, currentEvent),
    continuityBrief: buildContinuityBrief(player, worldState, currentEvent, eventHistory, recentLogs),
    diversityBrief: buildDiversityBrief(worldState, currentEvent, eventHistory, recentLogs),
    pacingBrief: buildPacingBrief(currentEvent, eventHistory, recentLogs),
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
    `[近况锚点]\n${ctx.continuityBrief}`,
    `[多样性要求]\n${ctx.diversityBrief}`,
    `[节奏要求]\n${ctx.pacingBrief}`,
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
