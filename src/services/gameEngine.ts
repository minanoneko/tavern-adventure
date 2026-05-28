import type { Player, WorldState, AIResponse, LogEntry } from '../types';
import { clampResource, addMoney, copperValue } from '../types/common';
import { createLogEntry } from '../types/log';
import { SKILL_LIBRARY } from '../data/skills';
import { EQUIPMENT_LIBRARY } from '../data/equipment';

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

  // 10. Apply memory updates
  updatedWorld = applyMemoryUpdate(updatedWorld, response);

  // 11. Broadcasts
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

  p.resources.hp = clampResource(p.resources.hp + response.playerUpdate.hpChange, p.resources.maxHp);
  p.resources.mp = clampResource(p.resources.mp + response.playerUpdate.mpChange, p.resources.maxMp);
  // DEFENSE: Cap exp change per event
  const expCap = 100;
  p.exp += Math.min(response.playerUpdate.expChange, expCap);

  // DEFENSE: Cap money change per event (both positive and negative)
  p.money = clampMoneyChangeByLevel(p, response.playerUpdate.moneyChange, logs);

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
  const p = { ...player, inventory: [...player.inventory] };
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
      existing.description = update.reason;
    } else {
      p.relationships.push({
        targetId: update.targetId,
        name: update.name,
        type: update.type || 'npc',
        standing: update.change,
        description: update.reason,
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

  for (const update of response.equipmentUpdate) {
    if (update.action === 'equip' && update.slot) {
      const isKnownEquip = update.itemId in EQUIPMENT_LIBRARY;
      const isInInventory = player.inventory.some(i => i.id === update.itemId);

      if (!isKnownEquip) {
        // Unknown equipment: ignore equip, log warning
        logs.push(createLogEntry('system', `AI提议装备未知物品"${update.name || update.itemId}"，已忽略。`));
      } else if (!isInInventory) {
        // Known but not in inventory: ignore equip
        logs.push(createLogEntry('system', `AI提议装备不在背包中的物品"${update.name || update.itemId}"，已忽略。`));
      } else {
        (p.equipment as any)[update.slot] = update.itemId;
      }
    } else if (update.action === 'unequip' && update.slot) {
      (p.equipment as any)[update.slot] = null;
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
  const newLevel = player.level + 1;
  const conBonus = player.attributes.con;
  const intWisBonus = Math.floor((player.attributes.int + player.attributes.wis) / 2);

  const p = {
    ...player,
    level: newLevel,
    exp: player.exp - player.nextExp,
    nextExp: Math.floor(player.nextExp * 1.5),
    attributePoints: player.attributePoints + 2,
    skillPoints: player.skillPoints + 1,
    resources: {
      ...player.resources,
      maxHp: player.resources.maxHp + 3 + Math.floor(conBonus / 3),
      maxMp: player.resources.maxMp + 2 + Math.floor(intWisBonus / 4),
      hp: player.resources.maxHp + 3 + Math.floor(conBonus / 3),
      mp: player.resources.maxMp + 2 + Math.floor(intWisBonus / 4),
    },
  };

  logs.push(createLogEntry('system', `升级！Lv.${newLevel}。属性点+2，技能点+1。`));

  return { player: p, newLevel };
}

export function addAttributePoint(player: Player, attr: string): Player {
  const p = { ...player, attributes: { ...player.attributes } };
  (p.attributes as any)[attr] += 1;
  p.attributePoints -= 1;
  return p;
}
