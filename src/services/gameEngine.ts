import type { Player, WorldState, AIResponse, LogEntry } from '../types';
import { clampResource, addMoney, copperValue } from '../types/common';
import { createLogEntry } from '../types/log';
import { SKILL_LIBRARY } from '../data/skills';
import { EQUIPMENT_LIBRARY } from '../data/equipment';
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
  const currentTotal = copperValue(player.money);
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

export function applyAIResponse(
  response: AIResponse,
  player: Player,
  worldState: WorldState,
  existingLogs: LogEntry[]
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

  // 1. Log scene
  logs.push(createLogEntry('narrative', `【${response.scene.title}】${response.scene.text.slice(0, 100)}...`));

  // 2. Log system events
  for (const se of response.systemEvents) {
    logs.push(createLogEntry('judge', se.text));
  }

  // 3. Apply player updates
  updatedPlayer = applyPlayerUpdate(updatedPlayer, response, logs);

  // 4. Apply inventory updates
  updatedPlayer = applyInventoryUpdate(updatedPlayer, response, logs);

  // 5. Apply quest updates
  updatedPlayer = applyQuestUpdate(updatedPlayer, response, logs);

  // 6. Apply skill updates
  updatedPlayer = applySkillUpdate(updatedPlayer, response, logs);

  // 7. Apply relationship updates
  updatedPlayer = applyRelationshipUpdate(updatedPlayer, response, logs);

  // 8. Apply equipment updates
  updatedPlayer = applyEquipmentUpdate(updatedPlayer, response, logs);

  // 9. Apply map updates
  updatedWorld = applyMapUpdate(updatedWorld, response, logs);

  // 10. Apply scene location (before memory update)
  updatedWorld = applySceneLocation(updatedWorld, response, logs);

  // 11. Apply memory updates
  updatedWorld = applyMemoryUpdate(updatedWorld, response);

  // 11.5 Validate and merge lockedFacts from AI
  if (response.memoryUpdate.lockedFacts?.length) {
    const validation = validateAgainstLockedFacts(updatedWorld.lockedStoryFacts, response.memoryUpdate.lockedFacts);
    if (validation.accepted.length) {
      updatedWorld = {
        ...updatedWorld,
        lockedStoryFacts: [...updatedWorld.lockedStoryFacts, ...validation.accepted],
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
  p.money = addMoneyToPlayer(p.money, clampedChange);

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
    if (update.action === 'add') {
      let itemType = (update.type as any) || 'material';
      let itemRarity = (update.rarity as any) || 'common';

      // DEFENSE: Unknown items → treat as quest_item/storyItem
      const isKnownEquip = equipLib.includes(update.itemId);
      const isEquipType = ['weapon', 'armor', 'accessory'].includes(itemType);

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

      // Convert coin items to actual money
      const coinName = update.name || '';
      const isCoin = coinName.includes('金币') || coinName.includes('银币') || coinName.includes('铜币')
        || coinName.includes('Gold') || coinName.includes('Silver') || coinName.includes('Copper')
        || itemType === 'money';
      if (isCoin) {
        // Extract numeric amount from name (e.g. "5铜币" → 5, "铜币 x3" → 3)
        let coinValue = update.quantity || 1;
        const numMatch = coinName.match(/(\d+)/);
        if (numMatch) coinValue = Math.max(coinValue, parseInt(numMatch[1]));
        // Determine coin type
        if (coinName.includes('金') || coinName.includes('Gold')) p.money.gold += coinValue;
        else if (coinName.includes('银') || coinName.includes('Silver')) p.money.silver += coinValue;
        else p.money.copper += coinValue;
        // Normalize
        while (p.money.copper >= 100) { p.money.copper -= 100; p.money.silver += 1; }
        while (p.money.silver >= 100) { p.money.silver -= 100; p.money.gold += 1; }
        while (p.money.copper < 0) { p.money.copper += 100; p.money.silver -= 1; }
        logs.push(createLogEntry('item', `获得：${coinName}${coinValue > 1 ? ` x${coinValue}` : ''}（已转入钱包）`));
        continue;
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

function applyQuestUpdate(player: Player, response: AIResponse, logs: LogEntry[]): Player {
  const p = { ...player, quests: [...player.quests] };

  for (const update of response.questUpdate) {
    const existingIdx = p.quests.findIndex(q => q.id === update.id);
    const oldStatus = existingIdx >= 0 ? p.quests[existingIdx].status : null;
    const quest = {
      id: update.id,
      name: update.name,
      status: update.status,
      description: update.description || '',
      giver: update.giver || '',
      objectives: (update.objectives || []).map(o => ({ id: o.id, description: o.description, completed: o.completed || false })),
      rewards: update.rewards || {},
    };

    if (existingIdx >= 0) {
      p.quests[existingIdx] = quest;
    } else {
      p.quests.push(quest);
    }
    logs.push(createLogEntry('quest', `任务：${update.name}（${update.status}）`));

    // Award exp + money on quest completion
    if (update.status === 'completed' && oldStatus !== 'completed' && update.rewards) {
      if (update.rewards.exp) {
        p.exp += update.rewards.exp;
        logs.push(createLogEntry('quest', `任务奖励：经验 +${update.rewards.exp}`));
      }
      if (update.rewards.money) {
        p.money = addMoneyToPlayer(p.money, update.rewards.money);
        const m = update.rewards.money;
        const parts = [];
        if (m.gold) parts.push(`${m.gold}金`);
        if (m.silver) parts.push(`${m.silver}银`);
        if (m.copper) parts.push(`${m.copper}铜`);
        if (parts.length > 0) logs.push(createLogEntry('quest', `任务奖励：${parts.join(' ')}`));
      }
    }
  }

  return p;
}

/** Parse money gains/losses from AI narrative text */
function parseMoneyFromNarrative(player: Player, text: string, logs: LogEntry[]): Player {
  const p = { ...player, money: { ...player.money } };
  let totalChange = 0;

  // Match patterns: "给了你X金币", "获得X银币", "递给X枚铜币", "失去X金币", "花了X银币", "报酬X金币"
  const gainPatterns = [
    /(?:给|递给|交给|塞给|付给|递给|扔给).*?(\d+)\s*(?:枚)?\s*(金币|银币|铜币|金|银|铜)/g,
    /(?:获得|得到|收到|拿到|捡到|赚了).*?(\d+)\s*(?:枚)?\s*(金币|银币|铜币|金|银|铜)/g,
    /(?:报酬|奖励|赏金|工钱).*?(\d+)\s*(?:枚)?\s*(金币|银币|铜币|金|银|铜)/g,
    /(?:掉落|爆出|遗落).*?(\d+)\s*(?:枚)?\s*(金币|银币|铜币|金|银|铜)/g,
  ];
  const lossPatterns = [
    /(?:花了|花费|支付|付出|用了|被拿走|被抢|丢失|损失).*?(\d+)\s*(?:枚)?\s*(金币|银币|铜币|金|银|铜)/g,
    /(?:买|购入|购买).*?(\d+)\s*(?:枚)?\s*(金币|银币|铜币|金|银|铜)/g,
  ];

  const applyMatch = (match: RegExpExecArray, isGain: boolean) => {
    const amount = parseInt(match[1]);
    const unit = match[2];
    let copper = 0;
    if (unit.startsWith('金')) copper = amount * 10000;
    else if (unit.startsWith('银')) copper = amount * 100;
    else copper = amount;
    totalChange += isGain ? copper : -copper;
  };

  for (const pattern of gainPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      applyMatch(m, true);
    }
  }
  for (const pattern of lossPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      applyMatch(m, false);
    }
  }

  if (totalChange !== 0) {
    p.money.copper += totalChange;
    while (p.money.copper >= 100) { p.money.copper -= 100; p.money.silver += 1; }
    while (p.money.silver >= 100) { p.money.silver -= 100; p.money.gold += 1; }
    while (p.money.copper < 0) { p.money.copper += 100; p.money.silver -= 1; }
    while (p.money.silver < 0) { p.money.silver += 100; p.money.gold -= 1; }
    if (p.money.gold < 0) p.money.gold = 0;

    const sign = totalChange > 0 ? '+' : '';
    const absCopper = Math.abs(totalChange);
    const g = Math.floor(absCopper / 10000);
    const s = Math.floor((absCopper % 10000) / 100);
    const c = absCopper % 100;
    const parts = [];
    if (g > 0) parts.push(`${sign}${g}金`);
    if (s > 0) parts.push(`${sign}${s}银`);
    if (c > 0) parts.push(`${sign}${c}铜`);
    if (parts.length > 0) logs.push(createLogEntry('system', `金钱 ${parts.join(' ')}（从文本解析）`));
  }

  return p;
}

/** Parse HP change from narrative — ONLY explicit HP -X / HP +X / 生命 -X / 生命 +X format */
function parseHPFromNarrative(player: Player, text: string, logs: LogEntry[]): Player {
  const p = { ...player, resources: { ...player.resources } };
  let hpChange = 0;

  // Only explicit numeric format: HP -3, HP +5, 生命 -3, 生命 +5
  const patterns = [
    /HP\s*[-−]\s*(\d+)/gi,
    /HP\s*\+\s*(\d+)/gi,
    /生命\s*[-−]\s*(\d+)/gi,
    /生命\s*\+\s*(\d+)/gi,
  ];

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (pattern.source.includes('[-−]')) {
        hpChange -= parseInt(m[1]) || 0;
      } else {
        hpChange += parseInt(m[1]) || 0;
      }
    }
  }

  if (hpChange !== 0) {
    p.resources.hp = Math.max(0, Math.min(p.resources.maxHp, p.resources.hp + hpChange));
    const sign = hpChange > 0 ? '+' : '';
    logs.push(createLogEntry('system', `HP ${sign}${hpChange}（文本解析）`));
  }

  return p;
}

function addMoneyToPlayer(current: { gold: number; silver: number; copper: number }, reward: { gold?: number; silver?: number; copper?: number }): { gold: number; silver: number; copper: number } {
  const m = { ...current };
  m.copper += reward.copper || 0;
  m.silver += reward.silver || 0;
  m.gold += reward.gold || 0;
  while (m.copper < 0) { m.copper += 100; m.silver -= 1; }
  while (m.copper >= 100) { m.copper -= 100; m.silver += 1; }
  while (m.silver < 0) { m.silver += 100; m.gold -= 1; }
  while (m.silver >= 100) { m.silver -= 100; m.gold += 1; }
  if (m.gold < 0) m.gold = 0;
  return m;
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
      existing.description = update.reason;
      if (update.race) existing.race = update.race;
      if (update.occupation) existing.occupation = update.occupation;
    } else {
      p.relationships.push({
        targetId: update.targetId,
        name: update.name,
        type: update.type || 'npc',
        standing: update.change,
        description: update.reason,
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

/** Update current location from AI scene response */
function applySceneLocation(world: WorldState, response: AIResponse, logs: LogEntry[]): WorldState {
  let locId = response.scene.locationId
    || response.memoryUpdate?.currentLocationId
    || response.memoryUpdate?.currentLocation
    || '';
  const locName = response.scene.location || '';

  // If we have a name but no id, generate a story location id
  if (!locId && locName) {
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
    const w = { ...world, currentLocation: locId, currentLocationName: locName || world.currentLocationName, generatedLocations: { ...world.generatedLocations } };
    if (!w.discoveredLocations.includes(locId) && !locId.startsWith('gray_deer') && !locId.startsWith('whitestone') && !locId.startsWith('forest_road')) {
      w.discoveredLocations = [...w.discoveredLocations, locId];
    }
    return w;
  }

  return world;
}

function applyMemoryUpdate(world: WorldState, response: AIResponse): WorldState {
  const w = {
    ...world,
    worldFlags: [...world.worldFlags],
  };

  for (const flag of response.memoryUpdate.flags) {
    if (!w.worldFlags.includes(flag)) w.worldFlags.push(flag);
  }

  if (response.memoryUpdate.currentLocationId) {
    w.currentLocation = response.memoryUpdate.currentLocationId;
  } else if (response.memoryUpdate.currentLocation) {
    w.currentLocation = response.memoryUpdate.currentLocation;
  }

  // Sync from scene locationId as well
  if (response.scene.locationId) {
    w.currentLocation = response.scene.locationId;
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
