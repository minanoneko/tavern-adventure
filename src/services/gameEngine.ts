import type { Player, WorldState, AIResponse, LogEntry, ItemType, ItemRarity, PlayerAction, ActionOption } from '../types';
import type { TimeOfDay, Weather, WeatherTrend } from '../types/common';
import { clampResource, normalizeWeather, normalizeTimeOfDay, advanceTime } from '../types/common';
import { addMoney as addMoneyUtil } from '../utils/moneyUtils';
import { createLogEntry } from '../types/log';
import { SKILL_LIBRARY } from '../data/skills';
import { EQUIPMENT_LIBRARY } from '../data/equipment';
import { getRegionById, getSubregionById, getLocationById, REGIONS, SUBREGIONS, LOCATIONS } from '../data/regions';
import { isAllowedItem } from '../data/itemCatalog';
import { validateAgainstLockedFacts } from './memoryService';

export interface GameEngineResult {
  player: Player;
  worldState: WorldState;
  logs: LogEntry[];
  didLevelUp: boolean;
  newLevel?: number;
}

/** Clamp money change by player level. Both positive and negative are capped. */
function clampMoneyChangeByLevel(
  player: Player,
  change: { gold?: number; silver?: number; copper?: number },
  logs: LogEntry[]
): { gold: number; silver: number; copper: number } {
  const rawTotal = (change.gold ?? 0) * 10000 + (change.silver ?? 0) * 100 + (change.copper ?? 0);

  // Level-based caps
  const maxGain = player.level <= 3 ? 5000 : player.level <= 5 ? 20000 : 100000; // 50铜 / 2金 / 10金
  const maxLoss = player.level <= 3 ? 3000 : player.level <= 5 ? 10000 : 50000;

  let capped: number;
  if (rawTotal > 0) {
    if (rawTotal > maxGain) {
      capped = maxGain;
      logs.push(createLogEntry('system', `AI提议金钱增加过大(${rawTotal}铜)，已限制为${maxGain}铜。`));
    } else {
      capped = rawTotal;
    }
  } else {
    if (rawTotal < -maxLoss) {
      capped = -maxLoss;
      logs.push(createLogEntry('system', `AI提议金钱扣除过大(${-rawTotal}铜)，已限制为${maxLoss}铜。`));
    } else {
      capped = rawTotal;
    }
  }

  // Prevent negative total money
  const currentTotal = player.money.gold * 10000 + player.money.silver * 100 + player.money.copper;
  if (currentTotal + capped < 0) {
    capped = -currentTotal;
    if (capped < 0) {
      logs.push(createLogEntry('system', '金钱不足以扣除全部费用，已扣至0。'));
    }
  }

  const gold = Math.floor(Math.abs(capped) / 10000) * (capped >= 0 ? 1 : -1);
  const remain = Math.abs(capped) % 10000;
  const silver = Math.floor(remain / 100) * (capped >= 0 ? 1 : -1);
  const copper = (remain % 100) * (capped >= 0 ? 1 : -1);

  return { gold, silver, copper };
}

interface ApplyAIResponseOptions {
  playerAction?: PlayerAction;
  selectedOption?: ActionOption;
  allowMapTransition?: boolean;
}

function normalizeInventoryType(raw?: string): ItemType {
  const value = (raw || 'material').toLowerCase().trim();
  const map: Record<string, ItemType> = {
    quest: 'quest_item',
    questitem: 'quest_item',
    story: 'quest_item',
    story_item: 'quest_item',
    storyitem: 'quest_item',
    equipment: 'quest_item',
    equip: 'quest_item',
    skillbook: 'skill_book',
    skill_book: 'skill_book',
  };
  const allowed: ItemType[] = ['weapon', 'armor', 'accessory', 'consumable', 'material', 'quest_item', 'book', 'skill_book', 'valuable', 'cursed', 'tool'];
  return map[value] || (allowed.includes(value as ItemType) ? value as ItemType : 'material');
}

function normalizeInventoryRarity(raw?: string): ItemRarity {
  const value = (raw || 'common').toLowerCase().trim();
  const map: Record<string, ItemRarity> = {
    normal: 'common',
    white: 'common',
    green: 'uncommon',
    blue: 'uncommon',
    purple: 'rare',
    orange: 'epic',
    gold: 'legendary',
    red: 'cursed',
  };
  const allowed: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'cursed', 'relic'];
  return map[value] || (allowed.includes(value as ItemRarity) ? value as ItemRarity : 'common');
}

export function applyAIResponse(
  response: AIResponse,
  player: Player,
  worldState: WorldState,
  existingLogs: LogEntry[],
  options: ApplyAIResponseOptions = {},
): GameEngineResult {
  const logs: LogEntry[] = [];
  let updatedPlayer = { ...player };
  let updatedWorld = { ...worldState };
  let didLevelUp = false;
  let newLevel: number | undefined;

  // 0. DO NOT parse HP/HP/money from narrative text. All numeric changes go through structured fields or local rules.
  // Scene text is narrative ONLY.

  // 0.5 Combat mode: ignore AI playerUpdate values (HP/MP/money/exp controlled by combatEngine locally)
  if (updatedWorld.combatState.active) {
    response.playerUpdate.hpChange = 0;
    response.playerUpdate.mpChange = 0;
    response.playerUpdate.expChange = 0;
    response.playerUpdate.moneyChange = {};
  }

  // 1. Log scene as a compact index entry; the full prose already appears in the story panel.
  const sceneMeta = [
    response.scene.location || worldState.currentLocationName,
    response.scene.time,
    response.scene.weather,
  ].filter(Boolean).join(' · ');
  logs.push(createLogEntry('narrative', `【${response.scene.title}】${sceneMeta || '剧情推进'}`));

  // 2. Log system events
  for (const se of response.systemEvents) {
    logs.push(createLogEntry('judge', se.text));
  }

  // 3. Apply player updates
  updatedPlayer = applyPlayerUpdate(updatedPlayer, response, logs);

  // 4. Apply inventory updates
  updatedPlayer = applyInventoryUpdate(updatedPlayer, response, logs);

  // 5. Apply story hook updates (replaces legacy quest system)
  updatedWorld = applyStoryHookUpdate(updatedWorld, response, logs);

  // 5.5 Legacy quest compat — keep player.quests for save compat but no rewards
  updatedPlayer = applyLegacyQuestUpdate(updatedPlayer, response, logs);

  // 6. Apply skill updates
  updatedPlayer = applySkillUpdate(updatedPlayer, response, logs);

  // 7. Apply relationship updates
  updatedPlayer = applyRelationshipUpdate(updatedPlayer, response, logs);

  // 8. Apply equipment updates
  updatedPlayer = applyEquipmentUpdate(updatedPlayer, response, logs);

  // 9. Apply map updates
  updatedWorld = applyMapUpdate(updatedWorld, response, logs);

  // 10. Apply scene location (before memory update)
  updatedWorld = applySceneLocation(updatedWorld, response, updatedPlayer, logs, options);

  // 10.5 Sync scene time/weather back to worldState
  updatedWorld = applySceneMeta(updatedWorld, response, logs, options.playerAction);

  // 11. Apply memory updates
  updatedWorld = applyMemoryUpdate(updatedWorld, response, updatedPlayer, logs, options);

  // 11.5 Validate and merge lockedFacts from AI and local continuity facts
  const continuityFacts = deriveContinuityFacts(response, updatedPlayer);
  const incomingFacts = [...(response.memoryUpdate.lockedFacts || []), ...continuityFacts]
    .map(f => f.trim())
    .filter(f => f && !updatedWorld.lockedStoryFacts.includes(f));
  if (incomingFacts.length) {
    const validation = validateAgainstLockedFacts(updatedWorld.lockedStoryFacts, incomingFacts);
    if (validation.accepted.length) {
      updatedWorld = {
        ...updatedWorld,
        lockedStoryFacts: [...updatedWorld.lockedStoryFacts, ...validation.accepted].slice(-60),
      };
    }
    for (const rejected of validation.rejected) {
      logs.push(createLogEntry('system', `AI试图改写锁定事实，已忽略："${rejected}"`));
    }
  }

  // 12. Broadcasts
  for (const b of response.worldBroadcasts) {
    updatedWorld.activeRumors.push(b.text);
    logs.push(createLogEntry('world', `【${b.type}】${b.text}`));
  }

  // 12. Check level up
  if (updatedPlayer.exp >= updatedPlayer.nextExp) {
    const result = processLevelUp(updatedPlayer, logs);
    updatedPlayer = result.player;
    didLevelUp = true;
    newLevel = updatedPlayer.level;
  }

  return {
    player: updatedPlayer,
    worldState: updatedWorld,
    logs: [...existingLogs, ...logs].slice(-200),
    didLevelUp,
    newLevel,
  };
}

function deriveContinuityFacts(response: AIResponse, player: Player): string[] {
  const facts: string[] = [];
  const npcUpdates = response.relationshipUpdate.filter(u => (u.type || 'npc') === 'npc' && u.name);

  for (const u of npcUpdates) {
    const profile = [u.race, u.occupation].filter(Boolean).join('/');
    if (profile) facts.push(`NPC档案：${u.name} 是 ${profile}。`);
    const reason = (u.description || u.reason || '').trim();
    if (reason && /介绍|提到|告诉|指向|委托|线索|小道|失踪|见过|知道/.test(reason)) {
      facts.push(`NPC线索：${u.name} ${reason.slice(0, 80)}。`);
    }
  }

  const sceneText = response.scene.text || '';
  const knownNames = [
    ...player.relationships.filter(r => r.type === 'npc').map(r => r.name),
    ...npcUpdates.map(u => u.name),
  ].filter(Boolean);
  const uniqueNames = [...new Set(knownNames)].filter(n => n.length >= 2);

  for (const source of uniqueNames) {
    if (!sceneText.includes(source)) continue;
    for (const target of uniqueNames) {
      if (source === target || !sceneText.includes(target)) continue;
      const sourceIndex = sceneText.indexOf(source);
      const targetIndex = sceneText.indexOf(target);
      const between = sourceIndex < targetIndex
        ? sceneText.slice(sourceIndex, targetIndex)
        : sceneText.slice(targetIndex, sourceIndex);
      if (/提到|告诉|说|介绍|指向|建议|让你找|去找|问问|质问|知道|见过/.test(between)) {
        facts.push(`线索来源：${source} 与 ${target} 在当前剧情中有关联；不要混淆谁提供线索、谁是被提到的人。`);
      }
    }
  }

  return [...new Set(facts)].slice(0, 6);
}

function applyPlayerUpdate(player: Player, response: AIResponse, logs: LogEntry[]): Player {
  const p = { ...player, resources: { ...player.resources }, attributes: { ...player.attributes }, money: { ...player.money } };

  // Clamp hp/mp changes to [-10, +10] range from AI
  const hpChange = Math.max(-10, Math.min(10, response.playerUpdate.hpChange || 0));
  const mpChange = Math.max(-10, Math.min(10, response.playerUpdate.mpChange || 0));
  p.resources.hp = clampResource(p.resources.hp + hpChange, p.resources.maxHp);
  p.resources.mp = clampResource(p.resources.mp + mpChange, p.resources.maxMp);
  // DEFENSE: Cap exp change per event
  const expCap = 100;
  p.exp += Math.min(response.playerUpdate.expChange, expCap);

  // DEFENSE: Cap money change per event (both positive and negative)
  // clampMoneyChangeByLevel returns a clamped CHANGE, NOT a total — must add, not replace
  const clampedChange = clampMoneyChangeByLevel(p, response.playerUpdate.moneyChange, logs);
  p.money = addMoneyUtil(p.money, clampedChange);
  if (clampedChange.gold !== 0 || clampedChange.silver !== 0 || clampedChange.copper !== 0) {
    const sign = clampedChange.gold! > 0 || clampedChange.silver! > 0 || clampedChange.copper! > 0 ? '+' : '';
    logs.push(createLogEntry('system', `【钱币】${sign}${clampedChange.gold ? `${clampedChange.gold}金` : ''}${clampedChange.silver ? `${clampedChange.silver}银` : ''}${clampedChange.copper ? `${clampedChange.copper}铜` : ''}`));
  }

  // Status effects
  if (response.playerUpdate.statusEffectAdd) {
    p.statusEffects = [...p.statusEffects.filter(s => !response.playerUpdate.statusEffectAdd?.includes(s)), ...response.playerUpdate.statusEffectAdd];
  }
  if (response.playerUpdate.statusEffectRemove) {
    p.statusEffects = p.statusEffects.filter(s => !response.playerUpdate.statusEffectRemove?.includes(s));
  }

  // DEFENSE: Ignore AI-proposed attribute changes (only level-up can change attributes)
  if (response.playerUpdate.attributeChanges) {
    logs.push(createLogEntry('system', 'AI提议的属性变化已被忽略。属性只能通过升级分配。'));
  }

  return p;
}

function applyInventoryUpdate(player: Player, response: AIResponse, logs: LogEntry[]): Player {
  const p = { ...player, inventory: [...player.inventory], money: { ...player.money } };
  const equipLib = ['old_wooden_staff', 'apprentice_robe', 'old_magic_note', 'short_bow', 'hunting_knife',
    'leather_armor', 'iron_sword', 'old_round_shield', 'chainmail', 'dagger', 'black_cloak',
    'lockpick_tools', 'smoke_bomb', 'rusty_greatsword', 'elven_bow', 'holy_symbol',
    'shadow_cloak', 'scholar_monocle'];

  for (const update of response.inventoryUpdate) {
    // Money type: change wallet directly, not inventory
    if ((update as any).type === 'money') {
      // Parse coin amount from name (e.g. "5铜币" → 5, "铜币" quantity=3 → 3)
      const coinName = update.name || '';
      const nameNum = parseInt(coinName.match(/(\d+)/)?.[1] || '0');
      const coinCount = nameNum > 0 ? nameNum : (update.quantity || 1);
      if (update.action === 'add') {
        const coinAmount = { gold: 0, silver: 0, copper: coinCount };
        if (coinName.includes('金')) { coinAmount.gold = coinCount; coinAmount.copper = 0; }
        else if (coinName.includes('银')) { coinAmount.silver = coinCount; coinAmount.copper = 0; }
        p.money = addMoneyUtil(p.money, coinAmount);
        logs.push(createLogEntry('system', `【钱币】获得 ${coinCount}${coinName.includes('金') ? '金' : coinName.includes('银') ? '银' : '铜'}`));
      } else if (update.action === 'remove') {
        const coinAmount = { gold: 0, silver: 0, copper: coinCount };
        if (coinName.includes('金')) { coinAmount.gold = coinCount; coinAmount.copper = 0; }
        else if (coinName.includes('银')) { coinAmount.silver = coinCount; coinAmount.copper = 0; }
        const currentCopper = (p.money.gold * 10000 + p.money.silver * 100 + p.money.copper);
        const costCopper = (coinAmount.gold || 0) * 10000 + (coinAmount.silver || 0) * 100 + (coinAmount.copper || 0);
        if (currentCopper < costCopper) {
          logs.push(createLogEntry('system', '钱币不足，无法支付。'));
        } else {
          p.money = addMoneyUtil(p.money, { gold: -(coinAmount.gold || 0), silver: -(coinAmount.silver || 0), copper: -(coinAmount.copper || 0) });
          logs.push(createLogEntry('item', `支付：${coinName}`));
        }
      }
      continue;
    }
    if (update.action === 'add') {
      let itemType = normalizeInventoryType(update.type);
      let itemRarity = normalizeInventoryRarity(update.rarity);

      // DEFENSE: Items must be in item catalog or equipment library
      const isKnownEquip = equipLib.includes(update.itemId);
      const isEquipType = ['weapon', 'armor', 'accessory'].includes(itemType);
      const isCatalogItem = isAllowedItem(update.itemId);

      if (!isCatalogItem && !isKnownEquip) {
        // Non-whitelist item → downgrade to story item
        itemType = 'quest_item';
        itemRarity = 'common';
        logs.push(createLogEntry('system', `未知道具"${update.name}"已降格为剧情物品，usable=false。`));
      }

      if (!isKnownEquip && isEquipType) {
        // Unknown equipment → downgrade to quest_item
        itemType = 'quest_item';
        itemRarity = 'common';
        logs.push(createLogEntry('system', `未知装备"${update.name}"已降格为剧情物品，不可装备。`));
      }

      // DEFENSE: Low level cannot receive rare+ equipment
      if (isEquipType && ['rare', 'epic', 'legendary', 'relic'].includes(itemRarity) && player.level <= 3) {
        itemType = 'quest_item';
        logs.push(createLogEntry('system', `稀有装备"${update.name}"已降格为剧情物品(Lv.≤3限制)。`));
      }

      // DEFENSE: Epic/legendary/relic → always quest_item unless known
      if (['epic', 'legendary', 'relic'].includes(itemRarity)) {
        itemType = 'quest_item';
      }

      const existing = p.inventory.find(i => i.id === update.itemId);
      if (existing) {
        existing.quantity += update.quantity;
      } else {
        p.inventory.push({
          id: update.itemId,
          name: update.name,
          type: itemType,
          description: update.description || '',
          quantity: update.quantity,
          rarity: itemRarity,
          usable: false,
          tags: [],
        });
      }
      logs.push(createLogEntry('item', `获得：${update.name} x${update.quantity}`));
    } else if (update.action === 'remove') {
      p.inventory = p.inventory.map(i =>
        i.id === update.itemId ? { ...i, quantity: i.quantity - update.quantity } : i
      ).filter(i => i.quantity > 0);
      logs.push(createLogEntry('item', `失去：${update.name} x${update.quantity}`));
    }
  }

  return p;
}

function applyStoryHookUpdate(world: WorldState, response: AIResponse, logs: LogEntry[]): WorldState {
  // Prefer storyHookUpdate; fall back to converting legacy questUpdate
  const legacyUpdates = (response.questUpdate || []).map(q => ({
    action: q.status === 'completed' ? 'resolve' as const
      : q.status === 'active' ? 'add' as const
      : q.status === 'failed' ? 'abandon' as const
      : 'update' as const,
    id: q.id,
    title: q.name,
    summary: q.description || q.name,
    type: 'side' as const,
  }));
  const updates = response.storyHookUpdate?.length ? response.storyHookUpdate : legacyUpdates;

  if (!updates.length) return world;

  const hooks = [...world.storyHooks];
  let currentGoal = world.currentGoal;
  const actionCount = (world.storyHooks.length > 0
    ? Math.max(...world.storyHooks.map(h => h.updatedAtTurn), 0)
    : 0) + 1;

  for (const u of updates) {
    const hookId = u.id || `hook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const existingIdx = hooks.findIndex(h => h.id === hookId);

    if (u.action === 'add' && existingIdx < 0) {
      hooks.push({
        id: hookId,
        title: u.title || u.summary.slice(0, 20),
        summary: u.summary,
        type: u.type || 'side',
        status: 'open',
        createdAtTurn: actionCount,
        updatedAtTurn: actionCount,
      });
      logs.push(createLogEntry('world', `【新线索】${u.title || u.summary.slice(0, 20)}`));
      currentGoal = u.summary;
    } else if (u.action === 'update' && existingIdx >= 0) {
      hooks[existingIdx] = { ...hooks[existingIdx], summary: u.summary, updatedAtTurn: actionCount };
      if (u.title) hooks[existingIdx].title = u.title;
      if (u.type) hooks[existingIdx].type = u.type;
      currentGoal = u.summary;
    } else if (u.action === 'resolve' && existingIdx >= 0) {
      hooks[existingIdx] = { ...hooks[existingIdx], status: 'resolved', summary: u.summary, updatedAtTurn: actionCount };
      logs.push(createLogEntry('world', `【线索解决】${hooks[existingIdx].title}`));
      if (currentGoal === hooks[existingIdx].summary) currentGoal = undefined;
    } else if (u.action === 'abandon' && existingIdx >= 0) {
      hooks[existingIdx] = { ...hooks[existingIdx], status: 'abandoned', summary: u.summary, updatedAtTurn: actionCount };
      logs.push(createLogEntry('world', `【线索放弃】${hooks[existingIdx].title}`));
      if (currentGoal === hooks[existingIdx].summary) currentGoal = undefined;
    } else if (u.action === 'add' && existingIdx >= 0) {
      hooks[existingIdx] = { ...hooks[existingIdx], summary: u.summary, updatedAtTurn: actionCount };
      currentGoal = u.summary;
    }
  }

  return { ...world, storyHooks: hooks, currentGoal };
}

/** Legacy quest compat: keep player.quests updated for save compatibility, no rewards */
function applyLegacyQuestUpdate(player: Player, response: AIResponse, logs: LogEntry[]): Player {
  if (!response.questUpdate?.length) return player;
  const p = { ...player, quests: [...player.quests] };
  for (const update of response.questUpdate) {
    const existingIdx = p.quests.findIndex(q => q.id === update.id);
    const quest = {
      id: update.id,
      name: update.name,
      status: update.status,
      description: update.description || '',
      giver: update.giver || '',
      objectives: (update.objectives || []).map(o => ({ id: o.id, description: o.description, completed: o.completed || false })),
      rewards: update.rewards || {},
    };
    if (existingIdx >= 0) p.quests[existingIdx] = quest;
    else p.quests.push(quest);
  }
  return p;
}


function applySkillUpdate(player: Player, response: AIResponse, logs: LogEntry[]): Player {
  const p = { ...player, skills: { ...player.skills, learned: [...player.skills.learned], discovered: [...player.skills.discovered], locked: [...player.skills.locked] } };

  for (const update of response.skillStateUpdate) {
    const isKnownSkill = update.skillId in SKILL_LIBRARY;

    if (update.action === 'learn') {
      if (!isKnownSkill) {
        // Unknown skill: downgrade to discovered at most
        if (!p.skills.discovered.includes(update.skillId) && !p.skills.learned.includes(update.skillId)) {
          p.skills.discovered.push(update.skillId);
        }
        logs.push(createLogEntry('system', `AI提议学习未知技能"${update.name || update.skillId}"，已降格为发现。`));
      } else {
        if (!p.skills.learned.includes(update.skillId)) p.skills.learned.push(update.skillId);
        p.skills.discovered = p.skills.discovered.filter(s => s !== update.skillId);
      }
    } else if (update.action === 'discover') {
      if (!p.skills.discovered.includes(update.skillId) && !p.skills.learned.includes(update.skillId)) {
        p.skills.discovered.push(update.skillId);
      }
    }
  }

  return p;
}

function applyRelationshipUpdate(player: Player, response: AIResponse, logs: LogEntry[]): Player {
  const p = { ...player, relationships: [...player.relationships] };

  for (const update of response.relationshipUpdate) {
    const existing = p.relationships.find(r => r.targetId === update.targetId);
    if (existing) {
      existing.standing += update.change;
      existing.description = update.description || update.reason || existing.description;
      if (update.race) existing.race = update.race;
      if (update.occupation) existing.occupation = update.occupation;
    } else {
      p.relationships.push({
        targetId: update.targetId,
        name: update.name,
        type: update.type || 'npc',
        standing: update.change,
        description: update.description || update.reason,
        race: update.race,
        occupation: update.occupation,
      });
    }
    if (update.change !== 0) {
      logs.push(createLogEntry('relationship', `${update.name}：关系 ${update.change > 0 ? '+' : ''}${update.change}（${update.reason}）`));
    }
  }

  return p;
}

function applyEquipmentUpdate(player: Player, response: AIResponse, logs: LogEntry[]): Player {
  const p = { ...player, equipment: { ...player.equipment } };
  const validSlots = ['mainWeapon', 'offHand', 'armor', 'head', 'hands', 'feet', 'accessory1', 'accessory2', 'special'];

  for (const update of response.equipmentUpdate) {
    if (update.action === 'equip' && update.slot) {
      // Validate slot exists
      if (!validSlots.includes(update.slot)) {
        logs.push(createLogEntry('system', `无效装备槽"${update.slot}"，已忽略。`));
        continue;
      }
      // Validate item exists in equipment library
      const equip = EQUIPMENT_LIBRARY[update.itemId];
      if (!equip) {
        logs.push(createLogEntry('system', `AI提议装备未知物品"${update.name || update.itemId}"，已忽略。`));
        continue;
      }
      // Validate item is in player inventory
      if (!player.inventory.some(i => i.id === update.itemId)) {
        logs.push(createLogEntry('system', `AI提议装备不在背包中的物品"${update.name || update.itemId}"，已忽略。`));
        continue;
      }
      // Validate slot matches equipment's intended slot
      if (equip.slot !== update.slot) {
        logs.push(createLogEntry('system', `装备"${equip.name}"不能装备到${update.slot}槽（应装备到${equip.slot}），已忽略。`));
        continue;
      }
      (p.equipment as any)[update.slot] = update.itemId;
    } else if (update.action === 'unequip' && update.slot) {
      if (validSlots.includes(update.slot)) {
        (p.equipment as any)[update.slot] = null;
      }
    }
  }

  return p;
}

function applyMapUpdate(world: WorldState, response: AIResponse, logs: LogEntry[]): WorldState {
  const w = {
    ...world,
    discoveredLocations: [...world.discoveredLocations],
    discoveredRegions: [...world.discoveredRegions],
    unlockedRoutes: [...world.unlockedRoutes],
  };

  for (const update of response.mapUpdate) {
    const targetId = update.targetId;
    if (!targetId) continue;

    switch (update.targetType) {
      case 'region':
        if (!w.discoveredRegions.includes(targetId)) w.discoveredRegions.push(targetId);
        logs.push(createLogEntry('world', `发现区域：${update.name || targetId}`));
        break;
      case 'subregion':
      case 'location':
        if (!w.discoveredLocations.includes(targetId)) w.discoveredLocations.push(targetId);
        logs.push(createLogEntry('world', `发现地点：${update.name || targetId}`));
        break;
      case 'connection':
        if (!w.unlockedRoutes.includes(targetId)) w.unlockedRoutes.push(targetId);
        logs.push(createLogEntry('world', `解锁路线：${update.name || targetId}`));
        break;
    }
  }

  return w;
}

function addDiscoveredRegion(w: WorldState, regionId: string, logs: LogEntry[], name?: string): WorldState {
  if (w.discoveredRegions.includes(regionId)) return w;
  logs.push(createLogEntry('world', `发现区域：${name || getRegionById(regionId)?.name || regionId}`));
  return { ...w, discoveredRegions: [...w.discoveredRegions, regionId] };
}

function addDiscoveredLocation(w: WorldState, locationId: string, logs: LogEntry[], name?: string): WorldState {
  if (w.discoveredLocations.includes(locationId)) return w;
  logs.push(createLogEntry('world', `发现地点：${name || getLocationById(locationId)?.name || getSubregionById(locationId)?.name || locationId}`));
  return { ...w, discoveredLocations: [...w.discoveredLocations, locationId] };
}

function resolveKnownMapTarget(locId: string, locName: string): {
  id: string;
  name: string;
  kind: 'region' | 'subregion' | 'location';
  regionId?: string;
} | null {
  const id = locId.trim();
  const name = locName.trim();
  const location = LOCATIONS.find(l => l.id === id || l.name === name || l.name === id);
  if (location) {
    const sub = getSubregionById(location.subregionId);
    return { id: location.id, name: location.name, kind: 'location', regionId: sub?.regionId };
  }

  const subregion = SUBREGIONS.find(s => s.id === id || s.name === name || s.name === id);
  if (subregion) {
    return { id: subregion.id, name: subregion.name, kind: 'subregion', regionId: subregion.regionId };
  }

  const region = REGIONS.find(r => r.id === id || r.name === name || r.name === id);
  if (region) {
    return { id: region.id, name: region.name, kind: 'region', regionId: region.id };
  }

  return null;
}

function meetsUnlockCondition(
  condition: { type: string; minLevel?: number; factionId?: string; minStanding?: number; flag?: string; itemId?: string } | undefined,
  player: Player,
  world: WorldState,
): boolean {
  if (!condition) return true;
  if (condition.type === 'level') return player.level >= (condition.minLevel ?? 1);
  if (condition.type === 'flag') return !!condition.flag && world.worldFlags.includes(condition.flag);
  if (condition.type === 'faction') return (world.factionStandings[condition.factionId || ''] ?? 0) >= (condition.minStanding ?? 0);
  if (condition.type === 'item') return player.inventory.some(i => i.id === condition.itemId && i.quantity > 0);
  return false;
}

function canEnterKnownMapTarget(
  target: ReturnType<typeof resolveKnownMapTarget>,
  player: Player,
  world: WorldState,
): boolean {
  if (!target) return true;
  if (target.kind === 'region' && world.discoveredRegions.includes(target.id)) return true;
  if (target.kind !== 'region' && world.discoveredLocations.includes(target.id)) return true;

  const region = target.regionId ? getRegionById(target.regionId) : undefined;
  const subregion = target.kind === 'subregion'
    ? getSubregionById(target.id)
    : target.kind === 'location'
      ? getSubregionById(getLocationById(target.id)?.subregionId || '')
      : undefined;
  const location = target.kind === 'location' ? getLocationById(target.id) : undefined;

  if (region && !meetsUnlockCondition(region.unlockCondition, player, world)) return false;
  if (subregion && !meetsUnlockCondition(subregion.unlockCondition, player, world)) return false;
  if (location && !meetsUnlockCondition(location.unlockCondition, player, world)) return false;

  const recommended = location?.dangerLevel ?? subregion?.recommendedLevel ?? region?.recommendedLevel ?? 1;
  return player.level + 2 >= recommended;
}

function allowsMapTransition(options: ApplyAIResponseOptions): boolean {
  if (options.allowMapTransition) return true;
  if (options.selectedOption?.allowsTransition) return true;
  if (options.selectedOption?.type === 'travel') return true;
  const action = options.playerAction;
  if (!action) return false;
  return action.type === 'move' || action.type === 'travel';
}

/** Update current location from AI scene response */
function applySceneLocation(world: WorldState, response: AIResponse, player: Player, logs: LogEntry[], options: ApplyAIResponseOptions): WorldState {
  let locId = response.scene.locationId
    || response.memoryUpdate?.currentLocationId
    || response.memoryUpdate?.currentLocation
    || '';
  const locName = response.scene.location || '';

  // Filter generic location names to avoid pollution
  const GENERIC_NAMES = /^(当前地点|附近|原地|这里|那里|此处|稍后|未知|某处)$/;
  if (GENERIC_NAMES.test(locName.trim())) {
    return world;
  }

  const knownTarget = resolveKnownMapTarget(locId, locName);
  if (knownTarget) {
    const isSamePlace = knownTarget.id === world.currentLocation;
    if (!isSamePlace && !allowsMapTransition(options)) {
      logs.push(createLogEntry('world', `地图过渡被延后：${knownTarget.name}。需要玩家选择旅行或明确移动后才能抵达。`));
      return { ...world, currentLocationName: world.currentLocationName };
    }
    if (!canEnterKnownMapTarget(knownTarget, player, world)) {
      logs.push(createLogEntry('world', `尚未解锁区域：${knownTarget.name}。已保留当前位置。`));
      return world;
    }
    let w: WorldState = {
      ...world,
      currentLocation: knownTarget.id,
      currentLocationName: knownTarget.name,
      discoveredRegions: [...world.discoveredRegions],
      discoveredLocations: [...world.discoveredLocations],
    };
    if (knownTarget.regionId) {
      w = addDiscoveredRegion(w, knownTarget.regionId, logs);
    }
    if (knownTarget.kind !== 'region') {
      w = addDiscoveredLocation(w, knownTarget.id, logs, knownTarget.name);
    }
    return w;
  }

  // If we have a name but no id, generate a story location id
  if (!locId && locName) {
    if (!allowsMapTransition(options)) {
      return world;
    }
    const generatedId = `story_${locName.replace(/[^a-zA-Z一-鿿]/g, '_').toLowerCase().slice(0, 30)}`;
    if (!world.generatedLocations[generatedId]) {
      world.generatedLocations[generatedId] = {
        id: generatedId,
        name: locName,
        type: 'story_location',
        discovered: true,
        createdAt: new Date().toISOString(),
      };
      logs.push(createLogEntry('world', `发现新地点：${locName}`));
    }
    locId = generatedId;
  }

  if (locId) {
    if (locId !== world.currentLocation && !allowsMapTransition(options)) {
      return world;
    }
    const w = { ...world, currentLocation: locId, currentLocationName: locName || world.currentLocationName, generatedLocations: { ...world.generatedLocations } };
    if (!w.discoveredLocations.includes(locId) && !locId.startsWith('gray_deer') && !locId.startsWith('whitestone') && !locId.startsWith('forest_road')) {
      w.discoveredLocations = [...w.discoveredLocations, locId];
    }
    return w;
  }

  return world;
}

/** Sync scene.time and scene.weather from AI response back to worldState */
function applySceneMeta(world: WorldState, response: AIResponse, logs: LogEntry[], playerAction?: PlayerAction): WorldState {
  const w = { ...world };
  const timeBeforeMeta = w.timeOfDay;
  const forcedTime = getForcedTimeFromAction(playerAction);

  // Parse time from scene.time string (e.g. "雾月3日 上午")
  if (forcedTime) {
    w.timeOfDay = forcedTime;
    response.scene.time = `${w.date} ${forcedTime}`;
    logs.push(createLogEntry('world', `按玩家等待意图，时间推进到：${forcedTime}`));
  } else if (response.scene.time) {
    const requestedTime = normalizeTimeOfDay(response.scene.time, w.timeOfDay);
    const newTime = smoothTimeTransition(w.timeOfDay, requestedTime, response.scene.text || '');
    if (newTime === w.timeOfDay && /稍后|一会|片刻|不久/.test(response.scene.time)) {
      // Vague time → advance by one step
      w.timeOfDay = advanceTime(w.timeOfDay);
    } else {
      w.timeOfDay = newTime;
    }
    if (newTime !== requestedTime) {
      logs.push(createLogEntry('world', `时间转折过快，已缓冲为：${newTime}`));
      response.scene.time = `${w.date} ${newTime}`;
    }
  }

  // Parse weather from scene.weather
  if (response.scene.weather) {
    const forcedWeather = getForcedWeatherFromAction(playerAction);
    const requestedWeather = forcedWeather || normalizeWeather(response.scene.weather, w.weather);
    const weatherState = forcedWeather
      ? { weather: forcedWeather, trend: 'stable' as WeatherTrend, stableTurns: 0 }
      : resolveWeatherState(w, requestedWeather, response.scene.text || '', timeBeforeMeta !== w.timeOfDay);
    const smoothedWeather = weatherState.weather;
    if (smoothedWeather !== requestedWeather) {
      logs.push(createLogEntry('world', `天气转折过快，已缓冲为：${smoothedWeather}`));
      response.scene.weather = smoothedWeather;
    } else if (forcedWeather) {
      response.scene.weather = forcedWeather;
      logs.push(createLogEntry('world', `按玩家天气意图，天气变为：${forcedWeather}`));
    }
    w.weather = smoothedWeather;
    w.weatherTrend = weatherState.trend;
    w.weatherStableTurns = weatherState.stableTurns;
  }

  // Ordinary weather and time may persist for many turns. Time only changes via AI,
  // player wait intent, or explicit transition cues.
  const weatherBeforeDiversity = w.weather;
  w.weather = avoidRepeatedWeather(w.weather, w.worldFlags);
  if (w.weather !== weatherBeforeDiversity) {
    logs.push(createLogEntry('world', `天气重复过多，已调整为：${w.weather}`));
    response.scene.weather = w.weather;
    w.weatherTrend = 'clearing';
    w.weatherStableTurns = 0;
  }

  // Track last 3 weather values in flags for repetition detection
  const weatherFlags = w.worldFlags.filter(f => f.startsWith('weather_'));
  weatherFlags.push(`weather_${w.weather}`);
  const trimmed = weatherFlags.slice(-3);
  const timeFlags = w.worldFlags.filter(f => f.startsWith('time_'));
  timeFlags.push(`time_${w.timeOfDay}`);
  const trimmedTime = timeFlags.slice(-3);
  w.worldFlags = [
    ...w.worldFlags.filter(f => !f.startsWith('weather_') && !f.startsWith('time_')),
    ...trimmed,
    ...trimmedTime,
  ];

  return w;
}

function getForcedTimeFromAction(action?: PlayerAction): TimeOfDay | undefined {
  const text = `${action?.customText || ''} ${action?.label || ''} ${action?.selectedOptionLabel || ''}`;
  if (!text.trim()) return undefined;
  if (/待到晚上|等到晚上|等到夜晚|等到夜里|等天黑|等到天黑|入夜|等待入夜|守到晚上|守到夜晚|熬到晚上|熬到夜晚/.test(text)) return '夜晚';
  if (/待到深夜|等到深夜|等到半夜|守到深夜|守到半夜|熬到深夜|子时/.test(text)) return '深夜';
  if (/待到清晨|等到清晨|等到黎明|等到天亮|睡到天亮|睡到清晨|等到早上|等到早晨/.test(text)) return '清晨';
  if (/待到上午|等到上午/.test(text)) return '上午';
  if (/待到中午|等到中午|等到正午/.test(text)) return '中午';
  if (/待到下午|等到下午/.test(text)) return '下午';
  if (/待到傍晚|等到傍晚|等到黄昏|等到日落/.test(text)) return '傍晚';
  return undefined;
}

function getForcedWeatherFromAction(action?: PlayerAction): Weather | undefined {
  const text = `${action?.customText || ''} ${action?.label || ''} ${action?.selectedOptionLabel || ''}`;
  if (!text.trim()) return undefined;

  const hasWeatherIntent = /等到|待到|直到|天气|下|起|转为|变成|变为|进入|测试/.test(text);
  if (!hasWeatherIntent) return undefined;

  if (/暴风雨|雷雨|暴雨|风暴/.test(text)) return '暴风雨';
  if (/大雨|下雨|雨天|雨势|雨/.test(text)) return '雨';
  if (/小雨|细雨|毛毛雨/.test(text)) return '小雨';
  if (/大雪|下雪|雪天|雪/.test(text)) return '雪';
  if (/大雾|浓雾|薄雾|起雾|雾天|雾/.test(text)) return '雾';
  if (/阴天|转阴|阴/.test(text)) return '阴';
  if (/多云|云多|云层/.test(text)) return '多云';
  if (/晴天|放晴|晴朗|晴/.test(text)) return '晴';
  return undefined;
}

/** Weather can persist. Only soften repeated harsh weather after several turns. */
function avoidRepeatedWeather(current: Weather, flags: string[]): Weather {
  const harshWeather: Weather[] = ['雨', '小雨', '雾'];
  if (!harshWeather.includes(current)) return current;

  const weatherFlags = flags.filter(f => f.startsWith('weather_')).map(f => f.replace('weather_', ''));
  if (weatherFlags.length >= 3) {
    const last3 = weatherFlags.slice(-3);
    if (last3.every(w => w === current)) {
      return current === '雾' ? '阴' : '多云';
    }
  }
  return current;
}

const WEATHER_FLOW: Weather[] = ['晴', '多云', '阴', '雾', '小雨', '雨', '暴风雨'];
const TIME_FLOW: TimeOfDay[] = ['清晨', '上午', '中午', '下午', '傍晚', '夜晚', '深夜'];
const WORSENING_FLOW: Weather[] = ['晴', '多云', '阴', '小雨', '雨', '暴风雨'];
const CLEARING_FLOW: Weather[] = ['暴风雨', '雨', '小雨', '阴', '多云', '晴'];

function hasTimeTransitionCue(sceneText: string): boolean {
  return /过了很久|一夜|整夜|天亮|黎明|日出|日落|入夜|夜幕|夜色|天黑|天色暗|到了夜晚|到夜晚|等到晚上|等到夜里|半夜|子时|睡到|休息到|等到|守到|熬到/.test(sceneText);
}

function smoothTimeTransition(current: TimeOfDay, requested: TimeOfDay, sceneText: string): TimeOfDay {
  if (current === requested) return requested;
  if (hasTimeTransitionCue(sceneText)) return requested;

  const currentIndex = TIME_FLOW.indexOf(current);
  const requestedIndex = TIME_FLOW.indexOf(requested);
  if (currentIndex < 0 || requestedIndex < 0) return requested;

  const delta = requestedIndex - currentIndex;
  if (Math.abs(delta) <= 1) return requested;

  return TIME_FLOW[currentIndex + Math.sign(delta)] || requested;
}

function hasWeatherTransitionCue(sceneText: string): boolean {
  return /乌云|云层散开|云层压低|风向变了|起风|狂风|雷声|闷雷|闪电|雨势|雨停|放晴|骤然|突然|逼近|压来|转冷|寒意|雪云|风暴/.test(sceneText);
}

function deriveWeatherTrend(current: Weather, requested: Weather, sceneText: string): WeatherTrend {
  if (/雷声|闷雷|闪电|风暴|暴风|狂风/.test(sceneText) || requested === '暴风雨') return 'storm_building';
  if (/雾|薄雾|浓雾|水汽/.test(sceneText) || requested === '雾') return 'foggy';
  const currentSeverity = weatherSeverity(current);
  const requestedSeverity = weatherSeverity(requested);
  if (requestedSeverity > currentSeverity) return 'worsening';
  if (requestedSeverity < currentSeverity) return 'clearing';
  return 'stable';
}

function weatherSeverity(weather: Weather): number {
  const severity: Record<Weather, number> = {
    '晴': 0,
    '多云': 1,
    '阴': 2,
    '雾': 2,
    '小雨': 3,
    '雨': 4,
    '雪': 4,
    '暴风雨': 5,
  };
  return severity[weather] ?? 1;
}

function stepAlong(flow: Weather[], current: Weather): Weather {
  const idx = flow.indexOf(current);
  if (idx < 0 || idx >= flow.length - 1) return current;
  return flow[idx + 1];
}

function stepWeatherByTrend(current: Weather, trend: WeatherTrend): Weather {
  if (trend === 'clearing') {
    if (current === '雪') return '阴';
    if (current === '雾') return '阴';
    return stepAlong(CLEARING_FLOW, current);
  }
  if (trend === 'worsening') {
    if (current === '雾') return '小雨';
    if (current === '雪') return '雪';
    return stepAlong(WORSENING_FLOW, current);
  }
  if (trend === 'foggy') {
    if (current === '雾') return current;
    if (current === '小雨' || current === '雨' || current === '暴风雨' || current === '雪') return current;
    return '雾';
  }
  if (trend === 'storm_building') {
    if (current === '雪') return '雪';
    return stepAlong(WORSENING_FLOW, current);
  }
  return current;
}

function smoothWeatherTransition(current: Weather, requested: Weather, sceneText: string, timeChanged: boolean, trend: WeatherTrend, stableTurns: number): Weather {
  if (current === requested) return requested;
  const hasCue = hasWeatherTransitionCue(sceneText);

  if (!hasCue && !timeChanged && stableTurns < 2) return current;

  if (current === '雪' || requested === '雪') {
    if (current === '雪' && requested === '晴') return '多云';
    if (current === '晴' && requested === '雪') return '多云';
    if (requested === '雪' && current !== '雨' && current !== '小雨' && current !== '雾') return '阴';
    return requested;
  }

  const currentIndex = WEATHER_FLOW.indexOf(current);
  const requestedIndex = WEATHER_FLOW.indexOf(requested);
  if (currentIndex < 0 || requestedIndex < 0) return requested;

  const delta = requestedIndex - currentIndex;
  if (hasCue && Math.abs(delta) <= 2) return requested;
  if (timeChanged && Math.abs(delta) <= 1) return requested;

  const trendStep = stepWeatherByTrend(current, trend);
  if (trendStep !== current) return trendStep;
  return WEATHER_FLOW[currentIndex + Math.sign(delta)] || requested;
}

function resolveWeatherState(
  world: WorldState,
  requestedWeather: Weather,
  sceneText: string,
  timeChanged: boolean,
): { weather: Weather; trend: WeatherTrend; stableTurns: number } {
  const current = world.weather;
  const requestedTrend = deriveWeatherTrend(current, requestedWeather, sceneText);
  const nextTrend = requestedTrend === 'stable' ? (world.weatherTrend || 'stable') : requestedTrend;
  const stableTurns = world.weatherStableTurns || 0;
  const nextWeather = smoothWeatherTransition(current, requestedWeather, sceneText, timeChanged, nextTrend, stableTurns);
  return {
    weather: nextWeather,
    trend: nextWeather === requestedWeather && requestedTrend !== 'stable' ? 'stable' : nextTrend,
    stableTurns: nextWeather === current ? stableTurns + 1 : 0,
  };
}

function applyMemoryUpdate(world: WorldState, response: AIResponse, player: Player, logs: LogEntry[], options: ApplyAIResponseOptions): WorldState {
  let w = {
    ...world,
    worldFlags: [...world.worldFlags],
  };

  for (const flag of response.memoryUpdate.flags) {
    if (!w.worldFlags.includes(flag)) w.worldFlags.push(flag);
  }

  const memoryLocId = response.memoryUpdate.currentLocationId || response.memoryUpdate.currentLocation || '';
  const memoryTarget = resolveKnownMapTarget(memoryLocId, response.scene.location || '');
  if (memoryTarget) {
    const isSamePlace = memoryTarget.id === w.currentLocation;
    if (!isSamePlace && !allowsMapTransition(options)) {
      logs.push(createLogEntry('world', `地图过渡被延后：${memoryTarget.name}。需要玩家选择旅行或明确移动后才能抵达。`));
      return w;
    }
    if (!canEnterKnownMapTarget(memoryTarget, player, w)) {
      logs.push(createLogEntry('world', `尚未解锁区域：${memoryTarget.name}。已忽略本次地图切换。`));
      return w;
    }
    w.currentLocation = memoryTarget.id;
    w.currentLocationName = memoryTarget.name;
    if (memoryTarget.regionId) {
      w = addDiscoveredRegion(w, memoryTarget.regionId, logs);
    }
    if (memoryTarget.kind !== 'region') {
      w = addDiscoveredLocation(w, memoryTarget.id, logs, memoryTarget.name);
    }
  } else if (response.memoryUpdate.currentLocationId) {
    if (response.memoryUpdate.currentLocationId !== w.currentLocation && !allowsMapTransition(options)) return w;
    w.currentLocation = response.memoryUpdate.currentLocationId;
  } else if (response.memoryUpdate.currentLocation) {
    if (response.memoryUpdate.currentLocation !== w.currentLocation && !allowsMapTransition(options)) return w;
    w.currentLocation = response.memoryUpdate.currentLocation;
  }

  return w;
}

export function processLevelUp(player: Player, logs: LogEntry[]): { player: Player; newLevel: number } {
  let p = { ...player };
  let newLevel = player.level;

  // While loop: support consecutive multi-level jumps
  while (p.exp >= p.nextExp) {
    newLevel++;
    p.exp -= p.nextExp;
    p.nextExp = Math.floor(p.nextExp * 1.5);
    p.attributePoints += 2;
    p.skillPoints += 1;

    const conBonus = p.attributes.con;
    const intWisBonus = Math.floor((p.attributes.int + p.attributes.wis) / 2);
    const hpGain = 3 + Math.floor(conBonus / 3);
    const mpGain = 2 + Math.floor(intWisBonus / 4);

    p.resources = {
      ...p.resources,
      maxHp: p.resources.maxHp + hpGain,
      maxMp: p.resources.maxMp + mpGain,
      hp: p.resources.maxHp + hpGain,  // Heal to full on level up
      mp: p.resources.maxMp + mpGain,
    };
    p.level = newLevel;
    p.level = Math.min(p.level, 21); // Cap at 21

    if (newLevel % 3 === 0 && p.skills.learnTokens !== undefined) {
      p.skills.learnTokens += 1;
      logs.push(createLogEntry('system', `Lv.${newLevel}！获得新技能学习机会+1。`));
    }

    logs.push(createLogEntry('system', `升级！Lv.${newLevel}。HP/MP回满。属性点+2，技能点+1。`));
  }

  return { player: p, newLevel };
}

export function addAttributePoint(player: Player, attr: string): Player {
  const p = { ...player, attributes: { ...player.attributes } };
  (p.attributes as any)[attr] += 1;
  p.attributePoints -= 1;
  return p;
}
