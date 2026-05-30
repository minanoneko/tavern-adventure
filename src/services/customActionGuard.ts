import type { Player, WorldState, AIResponse } from '../types';
import type { CombatState } from '../types/combat';
import type { Skill } from '../types/skill';
import type { AttributeKey } from '../types/common';
import { canCastSkill, getSkillLockReasons } from '../utils/skillRules';
import { SKILL_LIBRARY } from '../data/skills';
import { REGIONS, SUBREGIONS, LOCATIONS, getRegionById, getSubregionById } from '../data/regions';

export interface CustomActionGuardResult {
  allowed: boolean;
  mode: 'allow' | 'check' | 'rewrite' | 'reject';
  reason?: string;
  sanitizedText: string;
  intent: string;
  requiresCheck?: boolean;
  checkAttribute?: AttributeKey;
  difficultyClass?: number;
  detectedSkillId?: string;
}

/**
 * Scan input for any known skill name from the skill library.
 * Returns { skill, matched } if found, null otherwise.
 */
function detectSkillAttempt(text: string): { skill: Skill; matched: string } | null {
  for (const [, skill] of Object.entries(SKILL_LIBRARY)) {
    if (skill.name && text.includes(skill.name)) {
      return { skill, matched: skill.name };
    }
  }
  return null;
}

/**
 * Validate player custom input for non-combat scenarios.
 * Rejects: claiming rewards, generating NPCs/items, instant kills, stat changes, unlearned skills
 * Rewrites: "I found gold" → "try searching", "instant kill" → "attack with full force"
 */
/** Sanitize raw input: truncate, strip HTML/scripts, detect injection */
function sanitizeInput(text: string): string {
  let t = text.trim().slice(0, 500);
  // Strip HTML tags
  t = t.replace(/<[^>]*>/g, '');
  // Strip JavaScript event handlers
  t = t.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
  t = t.replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');
  // Strip script/CSS blocks
  t = t.replace(/<script[\s\S]*?<\/script>/gi, '');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, '');
  return t;
}

/** Detect prompt injection attempts */
function detectInjection(text: string): string | null {
  const t = text.toLowerCase();
  // System override patterns
  if (/(?:ignore|无视|忽略|覆盖).*(?:规则|指令|指令|prompt|设定|系统)/.test(t)) return '不能尝试覆盖系统规则或指令。';
  if (/(?:你是|你现在是|你变成|假装|扮演).*(?:gm|管理员|系统|开发者|神|上帝|管理员)/.test(t)) return '不能尝试改变AI的角色定位。';
  if (/(?:系统指令|system\s*:|开发者指令|后台指令|调试模式|debug\s*mode)/.test(t)) return '不能尝试注入系统指令。';
  if (/(?:输出.*JSON|不要.*JSON|跳过.*JSON|忽略.*JSON|别.*JSON)/.test(t) && /格式|规则|检查/.test(t)) return '不能尝试修改输出格式规则。';
  if (/(?:delete|drop|truncate|insert\s+into|update\s+set|exec\s*\(|eval\s*\(|<script|javascript\s*:)/.test(t)) return '输入包含非法字符或代码。';
  // Mass reward injection
  if (/(?:100000|99999|无限|unlimited).*(?:金币|金|银|铜|经验|exp|等级|级)/.test(t)) return '不能请求异常数量的奖励。';
  return null;
}

function resolveKnownMapName(text: string): { id: string; name: string; kind: 'region' | 'subregion' | 'location'; regionId?: string } | null {
  const targetText = text.replace(/^(我)?(想要|准备|打算)?(前往|去|进入|离开|来到|回到|返回|走向|走到)/, '').trim();
  const location = LOCATIONS.find(l => targetText.includes(l.name) || targetText.includes(l.id));
  if (location) {
    const sub = getSubregionById(location.subregionId);
    return { id: location.id, name: location.name, kind: 'location', regionId: sub?.regionId };
  }

  const subregion = SUBREGIONS.find(s => targetText.includes(s.name) || targetText.includes(s.id));
  if (subregion) {
    return { id: subregion.id, name: subregion.name, kind: 'subregion', regionId: subregion.regionId };
  }

  const region = REGIONS.find(r => targetText.includes(r.name) || targetText.includes(r.id));
  if (region) {
    return { id: region.id, name: region.name, kind: 'region', regionId: region.id };
  }

  return null;
}

function meetsUnlock(condition: { type: string; minLevel?: number; factionId?: string; minStanding?: number; flag?: string; itemId?: string } | undefined, player: Player, worldState: WorldState): boolean {
  if (!condition) return true;
  if (condition.type === 'level') return player.level >= (condition.minLevel ?? 1);
  if (condition.type === 'flag') return !!condition.flag && worldState.worldFlags.includes(condition.flag);
  if (condition.type === 'faction') return (worldState.factionStandings[condition.factionId || ''] ?? 0) >= (condition.minStanding ?? 0);
  if (condition.type === 'item') return player.inventory.some(i => i.id === condition.itemId && i.quantity > 0);
  return false;
}

function canReachKnownMapTarget(target: ReturnType<typeof resolveKnownMapName>, player: Player, worldState: WorldState): boolean {
  if (!target) return true;
  if (target.kind === 'region' && worldState.discoveredRegions.includes(target.id)) return true;
  if (target.kind !== 'region' && worldState.discoveredLocations.includes(target.id)) return true;
  if (target.regionId && !worldState.discoveredRegions.includes(target.regionId)) {
    const region = getRegionById(target.regionId);
    if (region && !meetsUnlock(region.unlockCondition, player, worldState)) return false;
    if (region && player.level + 2 < region.recommendedLevel) return false;
  }

  const region = target.regionId ? getRegionById(target.regionId) : undefined;
  const subregion = target.kind === 'subregion' ? getSubregionById(target.id) : target.kind === 'location' ? getSubregionById(LOCATIONS.find(l => l.id === target.id)?.subregionId || '') : undefined;
  const location = target.kind === 'location' ? LOCATIONS.find(l => l.id === target.id) : undefined;

  if (region && !meetsUnlock(region.unlockCondition, player, worldState)) return false;
  if (subregion && !meetsUnlock(subregion.unlockCondition, player, worldState)) return false;
  if (location && !meetsUnlock(location.unlockCondition, player, worldState)) return false;

  const recommended = location?.dangerLevel ?? subregion?.recommendedLevel ?? region?.recommendedLevel ?? 1;
  return player.level + 2 >= recommended;
}

export function validateCustomAction(
  text: string,
  _player: Player,
  _worldState: WorldState,
  _currentEvent: AIResponse | null,
): CustomActionGuardResult {
  // Sanitize first
  const raw = sanitizeInput(text);
  if (!raw) return { allowed: false, mode: 'reject', reason: '输入为空。', sanitizedText: '', intent: 'other' };

  // Check injection
  const injectionReason = detectInjection(raw);
  if (injectionReason) {
    return { allowed: false, mode: 'reject', reason: injectionReason, sanitizedText: raw, intent: 'other' };
  }

  const t = raw;

  // Very short inputs like "商队？" are usually follow-up questions about the current scene,
  // not a request to spawn a new plot branch.
  if (t.length <= 12 && /[?？]$/.test(t)) {
    return {
      allowed: true,
      mode: 'allow',
      sanitizedText: `围绕当前事件追问：${t}`,
      intent: 'talk',
      requiresCheck: false,
    };
  }

  // === Skill attempt detection (before general patterns) ===
  const skillAttempt = detectSkillAttempt(t);
  if (skillAttempt) {
    const { skill } = skillAttempt;
    if (!_player.skills.learned.includes(skill.id)) {
      return { allowed: false, mode: 'reject', reason: `未学会技能"${skill.name}"。技能只能通过升级或训练获得。`, sanitizedText: t, intent: 'invalid_modify_stats' };
    }
    if (!canCastSkill(skill, _player)) {
      const reasons = getSkillLockReasons(skill, _player);
      return { allowed: false, mode: 'reject', reason: `技能"${skill.name}"当前无法释放：${reasons.join('、')}。`, sanitizedText: t, intent: 'invalid_modify_stats' };
    }
    // Skill is learned and castable → allow with appropriate check
    const attrMap: Record<string, AttributeKey> = { combat: 'str', magic: 'int', active: 'dex', reaction: 'dex' };
    const attr = attrMap[skill.type] || 'int';
    return {
      allowed: true, mode: 'check',
      sanitizedText: `使用技能「${skill.name}」：${t}`,
      intent: 'use_item', requiresCheck: true, checkAttribute: attr,
      difficultyClass: 12, detectedSkillId: skill.id,
    };
  }

  // === REJECT: creating enemies / events / scenarios ===
  if (/[来了出现]了.*(?:并|然后|而且|，|,).*(?:攻击|杀|打|砍|闹事|破坏|抢|偷|袭击)/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能自己设定敌人和事件的发生。观察周围是否危险由AI决定，事件是否发生也由AI决定。', sanitizedText: t, intent: 'invalid_create_enemy' };
  }
  if (/(?:突然|忽然|猛然).*(?:冲出|窜出|出现|来袭|袭击)/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能自己设定突发事件。保持警惕观察四周，事件由AI生成。', sanitizedText: t, intent: 'invalid_create_enemy' };
  }
  if (/(?:哥布林|兽人|骷髅|巨龙|巨魔|狼人|吸血鬼|僵尸|幽灵|恶魔|怪物|强盗|土匪|刺客|杀手|野兽|魔物).*(?:正在|在|冲).*(?:攻击|杀|砍|闹|破坏|抢)/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能自己设定敌人正在做什么。敌人行为和剧情由AI决定。', sanitizedText: t, intent: 'invalid_create_enemy' };
  }

  // === REJECT: instant rewards / loot / stat changes ===
  if (/捡到\d+|捡了\d+|获得.*金币|获得.*神器|获得.*装备|捡到.*物品|得到.*武器|捡到.*剑|捡到.*盾/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能直接获得金钱或物品，请描述你想做什么（如：尝试搜索、检查周围）。', sanitizedText: t, intent: 'invalid_create_reward' };
  }
  if (/恢复满血|回满血|满血复活|回复全部.*HP|加满血|完全恢复/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能直接恢复满血，请使用休息或治疗物品。', sanitizedText: t, intent: 'invalid_modify_stats' };
  }
  if (/学会|习得|领悟.*技能|掌握.*魔法|突然.*会了/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '技能只能通过升级或训练获得，不能直接声称学会。', sanitizedText: t, intent: 'invalid_modify_stats' };
  }
  if (/升到.*级|升级到|等级变成/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '经验只能通过任务和战斗获得。', sanitizedText: t, intent: 'invalid_modify_stats' };
  }

  // === REJECT: generating NPCs / allies / enemies ===
  if (/生成.*队友|召唤.*强者|召唤.*帮手|生成.*NPC|生成.*一条龙|生成.*怪物|召唤.*龙|召唤.*恶魔|召唤.*天使/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能凭空生成NPC或队友。如果你需要帮助，可以尝试寻找附近的居民或冒险者。', sanitizedText: t, intent: 'invalid_create_npc' };
  }
  if (/生成.*敌人|生成.*Boss|制造.*怪物|召唤.*boss/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能凭空生成敌人。', sanitizedText: t, intent: 'invalid_create_enemy' };
  }

  // === REJECT: instant kills / forced results ===
  if (/一刀秒杀|一招秒|秒杀.*敌人|直接.*秒|瞬杀/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能直接秒杀敌人。请使用攻击行动，由战斗系统判定结果。', sanitizedText: t, intent: 'invalid_force_result' };
  }
  if (/让.*投降|强制.*投降|命令.*投降/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能强制敌人投降。你可以尝试威吓或交涉。', sanitizedText: t, intent: 'invalid_force_result' };
  }
  if (/我赢了|战斗结束|直接胜利/.test(t) && t.length < 10) {
    return { allowed: false, mode: 'reject', reason: '战斗结果由战斗系统决定。', sanitizedText: t, intent: 'invalid_force_result' };
  }

  // === REJECT: claiming ownership / authority ===
  if (/这里.*是我.*城堡|这里.*是我.*家|这里.*是我.*领地|其实.*是我.*手下|我是.*国王|我是.*领主|我是.*城主/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '你的身份和背景已在角色创建时确定，不能随意更改。', sanitizedText: t, intent: 'invalid_force_result' };
  }
  if (/老板.*是.*我.*手下|NPC.*听.*我.*命令|所有.*NPC.*服从/.test(t)) {
    return { allowed: false, mode: 'reject', reason: 'NPC有自己的意志，不能随意命令。', sanitizedText: t, intent: 'invalid_force_result' };
  }

  // === REJECT: identity claims ===
  if (/我是(?!谁|个)[一-鿿]{2,8}$/.test(t) || /我其实是|我本来就是|我真实身份|我的真正身份/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能随意更改角色身份。你的背景已在创建角色时确定。', sanitizedText: t, intent: 'invalid_force_result' };
  }

  // === REJECT: teleportation / impossible movement ===
  if (/瞬移|传送|飞过去|飞越|凭空消失|闪现到|一下.*就到了/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能瞬移或飞行，请描述正常的移动方式。', sanitizedText: t, intent: 'invalid_force_result' };
  }

  const knownMapTarget = resolveKnownMapName(t);
  if (knownMapTarget && /前往|去|进入|来到|回到|返回|走向|走到/.test(t) && !canReachKnownMapTarget(knownMapTarget, _player, _worldState)) {
    return {
      allowed: true,
      mode: 'rewrite',
      reason: `${knownMapTarget.name}当前还不能直接抵达。`,
      sanitizedText: `尝试打听前往「${knownMapTarget.name}」的路线、通行条件或可靠向导；如果条件不足，只推进到合理的边境/线索阶段。`,
      intent: 'move',
      requiresCheck: false,
    };
  }

  // === REJECT: declaring world facts / meta-knowledge ===
  if (/发现.*暗门|发现.*密道|发现.*密门|这里.*有.*暗格|墙.*上.*有.*机关|地板.*下.*有/.test(t)) {
    return { allowed: true, mode: 'rewrite', reason: '已改写为搜索意图。', sanitizedText: '仔细观察四周的墙壁和地面，寻找可能的隐藏通道或机关。', intent: 'investigate', requiresCheck: true, checkAttribute: 'wis', difficultyClass: 14 };
  }
  if (/就是凶手|就是.*犯人|就是.*卧底|在说谎|是假的/.test(t)) {
    return { allowed: true, mode: 'rewrite', reason: '已改写为观察意图。', sanitizedText: '仔细观察这个人的言行举止，尝试判断他的真实意图。', intent: 'investigate', requiresCheck: true, checkAttribute: 'wis', difficultyClass: 12 };
  }

  // === REJECT: controlling NPCs ===
  if (/帮.*我.*打|帮.*我.*杀|帮.*我.*攻击|命令.*NPC|命令.*守卫|命令.*老板|叫.*老板.*过来|给我.*叫.*过来/.test(t)) {
    return { allowed: false, mode: 'reject', reason: '不能直接命令NPC。你可以尝试说服或请求他们帮忙。', sanitizedText: t, intent: 'invalid_force_result' };
  }

  // === REJECT: claiming items not in inventory ===
  if (/我.*拿出|我.*掏出|我.*拔出|我.*戴上|我.*穿上|从.*背包.*拿出|从.*口袋.*拿出/.test(t)) {
    return { allowed: true, mode: 'rewrite', reason: '已改写为检查背包意图。', sanitizedText: '先检查自己的背包和装备栏，确认是否有需要的物品。', intent: 'use_item', requiresCheck: false };
  }

  // === REWRITE: loot → search intent ===
  if (/捡到|捡了|找到.*金币|找到.*宝物|发现.*宝箱|发现.*金币|找到.*钱/.test(t)) {
    return { allowed: true, mode: 'rewrite', reason: '已改写为搜索意图。', sanitizedText: '尝试在周围仔细搜索，看看有没有值钱的东西或线索。', intent: 'investigate', requiresCheck: true, checkAttribute: 'wis', difficultyClass: 12 };
  }

  // === REWRITE: summon/call help → call for help (social check) ===
  if (/召唤.*帮手|叫.*帮手|喊.*帮手|叫.*支援|喊.*支援|找.*帮手|找.*人.*帮|叫人.*帮/.test(t)) {
    return { allowed: true, mode: 'rewrite', reason: '已改写为呼救尝试。', sanitizedText: '大声呼救，尝试引起附近可能存在的友善人物的注意。', intent: 'social', requiresCheck: true, checkAttribute: 'cha', difficultyClass: 14 };
  }

  // === REWRITE: instant kill → attack intent ===
  if (/秒杀|瞬杀|一击.*杀|一下.*打死/.test(t)) {
    return { allowed: true, mode: 'rewrite', reason: '已改写为全力攻击意图。', sanitizedText: '用尽全力攻击敌人。', intent: 'combat_intent', requiresCheck: false };
  }

  // === REWRITE: full heal → rest intent ===
  if (/恢复.*血|回血|治疗.*自己|补.*血/.test(t)) {
    return { allowed: true, mode: 'rewrite', reason: '已改写为休息恢复意图。', sanitizedText: '尝试找个安全的地方坐下休息，恢复体力。', intent: 'rest', requiresCheck: false };
  }

  // === ALLOW: movement ===
  if (/前往|去|进入|离开|来到|回到|返回|绕到|走向|走到/.test(t)) {
    return { allowed: true, mode: 'allow', sanitizedText: t, intent: 'move' };
  }

  // === ALLOW: observe / investigate ===
  if (/观察|查看|检查|调查|搜索|寻找|仔细.*看|看看/.test(t)) {
    return { allowed: true, mode: 'check', sanitizedText: t, intent: 'investigate', requiresCheck: true, checkAttribute: 'wis' };
  }

  // === ALLOW: talk ===
  if (/询问|打听|对话|聊天|交谈|问|聊聊|跟.*说/.test(t)) {
    return { allowed: true, mode: 'allow', sanitizedText: t, intent: 'talk' };
  }

  // === ALLOW: stealth ===
  if (/潜行|悄悄|躲|隐藏|跟踪|尾随|隐匿/.test(t)) {
    return { allowed: true, mode: 'check', sanitizedText: t, intent: 'stealth', requiresCheck: true, checkAttribute: 'dex', difficultyClass: 12 };
  }

  // === ALLOW: social / persuade ===
  if (/说服|交涉|威吓|恐吓|欺骗|伪装|冒充/.test(t)) {
    return { allowed: true, mode: 'check', sanitizedText: t, intent: 'social', requiresCheck: true, checkAttribute: 'cha' };
  }

  // === ALLOW: use item / rest ===
  if (/使用|喝|投掷|休息|睡觉|坐下/.test(t)) {
    return { allowed: true, mode: 'allow', sanitizedText: t, intent: 'use_item' };
  }

  // === ALLOW: trade ===
  if (/购买|买|卖|出售|交易/.test(t)) {
    return { allowed: true, mode: 'allow', sanitizedText: t, intent: 'trade' };
  }

  // === ALLOW: combat intent (will be routed to combat system) ===
  if (/攻击|砍|打倒|射击|刺|杀/.test(t)) {
    return { allowed: true, mode: 'allow', sanitizedText: t, intent: 'combat_intent' };
  }

  // === Default: unknown input → pass as player intent ===
  return {
    allowed: true, mode: 'allow',
    sanitizedText: `玩家想要：${t}`,
    intent: 'other',
  };
}

/**
 * Validate custom input specifically during combat.
 * Only allows actions that map to legal CombatActions.
 */
export function validateCombatCustomAction(
  text: string,
  player: Player,
  _combatState: CombatState,
): { allowed: boolean; reason?: string; intent: string } {
  const raw = sanitizeInput(text);
  if (!raw) return { allowed: false, reason: '输入为空。', intent: 'other' };
  const inj = detectInjection(raw);
  if (inj) return { allowed: false, reason: inj, intent: 'other' };

  const t = raw;

  // === Skill attempt detection (before general patterns) ===
  const skillAttempt = detectSkillAttempt(t);
  if (skillAttempt) {
    const { skill } = skillAttempt;
    if (!player.skills.learned.includes(skill.id)) {
      return { allowed: false, reason: `未学会技能"${skill.name}"。`, intent: 'invalid_modify_stats' };
    }
    if (!player.skills.equipped.includes(skill.id)) {
      return { allowed: false, reason: `技能"${skill.name}"未装备到技能栏。`, intent: 'invalid_modify_stats' };
    }
    if (!canCastSkill(skill, player)) {
      const reasons = getSkillLockReasons(skill, player);
      return { allowed: false, reason: `技能"${skill.name}"无法释放：${reasons.join('、')}。`, intent: 'invalid_modify_stats' };
    }
    // Skill is learned, equipped, and castable → allow as skill action
    return { allowed: true, intent: 'skill' };
  }

  // Reject: summon / generate NPCs / allies / instant results
  if (/召唤|生成.*队友|生成.*帮手|生成.*NPC|帮手.*帮我|叫.*人.*帮/.test(t)) {
    return { allowed: false, reason: '战斗中不能凭空召唤帮手。你可以尝试呼救（可能获得短暂buff），或使用已学会的召唤技能。', intent: 'invalid_create_npc' };
  }
  if (/秒杀|瞬杀|一刀.*死|一招.*死|直接.*死/.test(t)) {
    return { allowed: false, reason: '不能秒杀敌人。请正常攻击。', intent: 'invalid_force_result' };
  }
  if (/投降|求饶|命令.*投降/.test(t)) {
    return { allowed: false, reason: '不能强制敌人投降。你可以尝试交涉。', intent: 'invalid_force_result' };
  }
  if (/生成.*敌人|生成.*boss|制造.*怪物/.test(t)) {
    return { allowed: false, reason: '不能凭空生成敌人。', intent: 'invalid_create_enemy' };
  }
  if (/获得.*金币|捡到|获得.*武器|获得.*装备|获得.*神器|恢复满血/.test(t)) {
    return { allowed: false, reason: '战斗中不能直接获得物品或恢复状态。', intent: 'invalid_create_reward' };
  }
  if (/学会|习得|突然.*技能/.test(t)) {
    return { allowed: false, reason: '战斗中不能学习新技能。', intent: 'invalid_modify_stats' };
  }

  // Allow: attack-related → normal attack
  if (/攻击|砍|刺|射击|打倒|杀/.test(t)) {
    return { allowed: true, intent: 'attack' };
  }
  // Allow: defend
  if (/防御|格挡|挡/.test(t)) {
    return { allowed: true, intent: 'defend' };
  }
  // Allow: flee
  if (/逃跑|撤退|跑/.test(t)) {
    return { allowed: true, intent: 'flee' };
  }
  // Allow: observe
  if (/观察|弱点|查看/.test(t)) {
    return { allowed: true, intent: 'observe' };
  }
  // Allow: use healing potion (if in inventory)
  if (/喝.*药水|治疗.*药水|使用.*药水/.test(t)) {
    const hasPotion = player.inventory.some(i => i.id === 'healing_potion' && i.quantity > 0);
    if (!hasPotion) {
      return { allowed: false, reason: '背包中没有治疗药水。', intent: 'item' };
    }
    return { allowed: true, intent: 'item' };
  }

  // === Combat: additional rejections ===
  // Searching/looting during combat
  if (/搜刮|搜.*尸体|捡.*尸体|翻.*口袋|搜.*身/.test(t)) {
    return { allowed: false, reason: '战斗中不能搜刮。战斗奖励会在战斗结束后自动结算。', intent: 'invalid_create_reward' };
  }
  // Switching weapons mid-combat
  if (/换.*武器|换.*剑|换.*弓|切换.*武器|拿出.*武器|掏出.*武器/.test(t)) {
    return { allowed: false, reason: '战斗中不能切换武器。请使用当前装备的武器。', intent: 'invalid_force_result' };
  }
  // Teleport / impossible actions in combat
  if (/瞬移|传送|飞过去|凭空消失|闪现/.test(t)) {
    return { allowed: false, reason: '战斗中不能进行瞬移或飞行。', intent: 'invalid_force_result' };
  }
  // Giving items to non-existent allies
  if (/给.*队友|递给.*同伴|分给/.test(t)) {
    return { allowed: false, reason: '当前没有队友可以接收物品。', intent: 'invalid_force_result' };
  }

  // Allow: combat special actions (environment, distract, taunt, negotiate)
  if (/踢沙|干扰|制造.*破绽|虚晃|分散.*注意|推倒|砸碎|利用.*环境|踢.*桌子|扔.*椅子|掀.*桌子|嘲讽|激怒|辱骂|谈判|求饶/.test(t)) {
    return { allowed: true, intent: 'special' };
  }

  // Fallback: reject unknown combat inputs
  return { allowed: false, reason: '该行动不被战斗系统识别。战斗中请选择：攻击敌人、使用技能、使用物品、防御、逃跑、观察敌人。', intent: 'other' };
}
