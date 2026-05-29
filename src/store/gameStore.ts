import { create } from 'zustand';
import type {
  Player, WorldState, AIResponse, LogEntry,
  CharacterCreationData, PlayerAction, JudgeResult, AIResult, ActionOption,
} from '../types';
import { createDefaultPlayer } from '../types/character';
import { createDefaultWorldState } from '../types/common';
import { getRaceById, PERSONALITY_TRAITS } from '../data/races';
import { getClassById } from '../data/classes';
import { evaluate, parseCustomAction, needsCheck } from '../services/judgeService';
import { getSkillById } from '../data/skills';
import { sendPlayerAction } from '../services/aiService';
import { applyAIResponse, addAttributePoint } from '../services/gameEngine';
import { saveGame, loadGame, deleteSave, hasSave, getSaveInfo, exportSave } from '../services/saveService';
import { useSettingsStore } from './settingsStore';
import { getMockResponse } from '../data/mockEventPool';
import { generateOpeningEvent } from '../services/openingService';
import { resetMemory, extractImportantFacts, updateLongTermSummary, trimRecentLogs, getLongTermSummary, getGameFlags, loadMemoryFromSave, formatSummaryForAI } from '../services/memoryService';
import { getEquipmentById } from '../data/equipment';
import { canCastSkill, getSkillLockReasons } from '../utils/skillRules';
import { addMoney, canAfford, subtractMoney } from '../utils/moneyUtils';
import type { CombatEnemy } from '../types/ai';
import type { CombatAction } from '../types/combat';
import { submitCombatAction as runCombatAction, startCombatFromAI, startCombatFromLegacyEnemy } from '../services/combat/combatEngine';
import { validateCustomAction } from '../services/customActionGuard';

export type GamePhase = 'start' | 'create' | 'game';

export interface GameState {
  phase: GamePhase;
  player: Player | null;
  worldState: WorldState;
  currentEvent: AIResponse | null;
  eventHistory: AIResponse[];
  logs: LogEntry[];
  lastJudgeResult: JudgeResult | null;
  lastAIResult: AIResult | null;
  isProcessing: boolean;
  errorMessage: string | null;
  didLevelUp: boolean;
  newLevel: number | null;
  actionCount: number;

  // Actions
  setPhase: (phase: GamePhase) => void;
  newGame: () => void;
  createCharacter: (data: CharacterCreationData) => void;
  continueGame: () => boolean;
  submitAction: (actionId: string, customText?: string) => Promise<void>;
  submitCombatAction: (action: import('../types/combat').CombatAction) => Promise<void>;
  saveCurrentGame: () => boolean;
  loadSavedGame: () => boolean;
  deleteSavedGame: () => boolean;
  hasSavedGame: () => boolean;
  getSavedGameInfo: () => { savedAt: string; playerName: string; level: number } | null;
  exportCurrentSave: () => string;
  dismissLevelUp: () => void;
  allocateAttribute: (attr: string) => void;
  clearError: () => void;
  addLockedStoryFact: (fact: string) => void;
  removeLockedStoryFact: (index: number) => void;
  clearLockedStoryFacts: () => void;
  dismissCombat: () => void;
  restAtLocation: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'start',
  player: null,
  worldState: createDefaultWorldState(),
  currentEvent: null,
  eventHistory: [],
  logs: [],
  lastJudgeResult: null,
  lastAIResult: null,
  isProcessing: false,
  errorMessage: null,
  didLevelUp: false,
  newLevel: null,
  actionCount: 0,

  setPhase: (phase) => set({ phase }),

  newGame: () => {
    resetMemory();
    set({
      phase: 'create',
      player: null,
      worldState: createDefaultWorldState(),
      currentEvent: null,
      eventHistory: [],
      logs: [],
      lastJudgeResult: null,
      lastAIResult: null,
      errorMessage: null,
      didLevelUp: false,
      newLevel: null,
      actionCount: 0,
    });
  },

  createCharacter: async (data) => {
    const race = getRaceById(data.raceId);
    const classOrigin = getClassById(data.classId);
    if (!race || !classOrigin) return;

    let player = createDefaultPlayer(data, race, classOrigin);
    let worldState = createDefaultWorldState();

    // Equip starting gear from class origin
    const equipSlots: Record<string, string> = {
      mainWeapon: 'mainWeapon', offHand: 'offHand', armor: 'armor',
      head: 'head', hands: 'hands', feet: 'feet',
      accessory1: 'accessory1', accessory2: 'accessory2', special: 'special',
    };
    for (const equipId of classOrigin.equipment) {
      const equip = getEquipmentById(equipId);
      if (!equip) continue;
      // Add to inventory
      player.inventory.push({
        id: equip.id,
        name: equip.name,
        type: equip.slot === 'mainWeapon' ? 'weapon' : equip.slot === 'armor' ? 'armor' : 'material',
        description: equip.description,
        quantity: 1,
        rarity: equip.quality as any || 'common',
        usable: true,
        tags: [],
        importance: 'high',
      });
      // Auto-equip to matching slot
      const slot = equip.slot as keyof typeof player.equipment;
      if (slot in player.equipment) {
        (player.equipment as any)[slot] = equip.id;
      }
    }

    const logs: LogEntry[] = [{
      id: 'log_init',
      timestamp: new Date().toISOString(),
      type: 'system',
      text: `${player.name}，${player.race}的${player.classOrigin}，踏入了冒险之旅。`,
      details: `自定义开端：${player.customOrigin}`,
    }];

    set({
      phase: 'game',
      player,
      worldState,
      currentEvent: null,
      eventHistory: [],
      logs,
      lastJudgeResult: null,
      lastAIResult: null,
      errorMessage: null,
      isProcessing: true,
    });

    // Generate opening via openingService
    try {
      const settings = useSettingsStore.getState();
      const openingMode = settings.openingMode || 'mock_template';

      const result = await generateOpeningEvent(player, worldState, settings, openingMode);

      // Log warnings from backgroundGuard
      const updatedLogs = [...logs];
      for (const warning of result.warnings) {
        updatedLogs.push({
          id: `log_warn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'system',
          text: `【开端修正】${warning}`,
        });
      }

      // Sync worldState.currentLocation from opening event
      if (result.event.scene.locationId) {
        worldState = { ...worldState, currentLocation: result.event.scene.locationId };
      } else if (result.event.memoryUpdate.currentLocationId) {
        worldState = { ...worldState, currentLocation: result.event.memoryUpdate.currentLocationId };
      }

      // Write gender into lockedStoryFacts
      if (player.gender) {
        const genderFact = `玩家角色${player.name}的性别是${player.gender === '女' ? '女' : '男'}，叙事称呼必须保持一致，使用${player.gender === '女' ? '她/少女/女士/女冒险者' : '他/少年/先生/男冒险者'}等对应称呼。`;
        worldState.lockedStoryFacts = [...worldState.lockedStoryFacts, genderFact];
      }

      // Apply opening event through gameEngine
      const engineResult = applyAIResponse(result.event, player, worldState, updatedLogs);

      set({
        player: engineResult.player,
        worldState: engineResult.worldState,
        currentEvent: result.event,
        eventHistory: [result.event],
        logs: engineResult.logs,
        isProcessing: false,
      });
    } catch (e) {
      console.error('Failed to generate opening:', e);
      set({ isProcessing: false });
      get().submitAction('start_game');
    }
  },

  continueGame: () => {
    const saved = loadGame();
    if (!saved) return false;

    // Restore long-term memory from save
    loadMemoryFromSave(saved.longTermSummary, saved.gameFlags || []);

    set({
      phase: 'game',
      player: saved.player,
      worldState: saved.worldState,
      currentEvent: saved.currentEvent,
      eventHistory: saved.eventHistory || [],
      logs: saved.logs || [],
      lastJudgeResult: saved.lastJudgeResult || null,
      lastAIResult: null,
      errorMessage: null,
      isProcessing: false,
      actionCount: 0,
    });
    // Do NOT call submitAction — wait for player's next action
    return true;
  },

  submitAction: async (actionId, customText) => {
    const state = get();
    if (!state.player) return;
    if (state.isProcessing) return;

    // Combat guard: actions during combat go through CombatPanel
    if (state.worldState.combatState.active) return;

    // Decrement combat cooldown
    const workingWorldState = {
      ...state.worldState,
      combatCooldown: Math.max(0, state.worldState.combatCooldown - 1),
      wildernessRestUsed: state.worldState.timeOfDay === '清晨' ? 0 : (state.worldState.wildernessRestUsed || 0),
    };

    // Gender self-correction: local only, no AI, no CHECK
    if (customText) {
      const genderMatch = customText.match(/我是(?:个)?(?:一[个名])?(?:女(?:的|性|生)?|男(?:的|性|生)?)/);
      if (genderMatch) {
        const isFemale = /女/.test(genderMatch[0]);
        const player = state.player;
        const worldState = state.worldState;
        const newGender = isFemale ? '女' : '男';
        const logs = [...state.logs, {
          id: `gender_fix_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'system' as const,
          text: `性别已确认为：${newGender}。`,
        }];
        const genderFact = `玩家角色${player.name}的性别是${newGender}，叙事称呼必须保持一致。`;
        set({
          player: { ...player, gender: newGender },
          worldState: { ...worldState, lockedStoryFacts: [...worldState.lockedStoryFacts, genderFact] },
          logs,
          isProcessing: false,
        });
        return;
      }
    }

    set({ isProcessing: true, errorMessage: null });

    // Clone: all mutations go to working copies, not Zustand state
    let player = structuredClone(state.player);
    let worldState = structuredClone(workingWorldState);
    const logs = [...state.logs];
    const eventHistory = state.eventHistory;
    const currentEvent = state.currentEvent;

    try {
      // 1. Build player action
      let playerAction: PlayerAction;
      if (customText) {
        // Apply custom input guard — validate before sending to AI
        const guard = validateCustomAction(customText, player, worldState, currentEvent);
        if (guard.mode === 'reject') {
          set({
            isProcessing: false,
            errorMessage: guard.reason || '这个行动超出了当前规则。',
          });
          return;
        }
        // combat_intent → require valid context, then start combat locally
        if (guard.intent === 'combat_intent') {
          // Dangerous locations (wild/dungeon) always allow combat.
          // Safe locations (town/inn) require danger in narrative.
          const locId = worldState.currentLocation || '';
          const isSafeLoc = locId.includes('tavern') || locId.includes('inn') || locId.includes('town') || locId.includes('shop') || locId.includes('market') || locId.includes('guild') || locId.includes('chapel');
          if (isSafeLoc) {
            const sceneText = currentEvent?.scene.text || '';
            const hasDanger = /危险|威胁|敌人|怪物|攻击|战斗|可疑|敌意|匪|盗|贼|兽|蛇|狼|虫|哥布林|骷髅|强盗|吼叫|咆哮|动静|黑影|人影|脚步|跟踪/.test(sceneText);
            if (!hasDanger) {
              set({ isProcessing: false, errorMessage: '在城镇里没有可以攻击的目标。去野外探索吧。' });
              return;
            }
          }

          const enemyLevel = Math.max(1, player.level - 1 + Math.floor(Math.random() * 2));
          // Enemy name from location context, NOT from player input
          const enemyName = getWildEnemyName(worldState.currentLocation);
          const enemy: CombatEnemy = {
            name: enemyName,
            str: 4 + enemyLevel,
            dex: 3 + Math.floor(enemyLevel / 2),
            con: 3 + Math.floor(enemyLevel / 2),
            hp: 8 + enemyLevel * 3,
            maxHp: 8 + enemyLevel * 3,
            level: enemyLevel,
          };
          const combatResult = startCombatFromLegacyEnemy(player, worldState, enemy);
          worldState.combatState = combatResult.combatState;
          logs.push({ id: `combat_${Date.now()}`, timestamp: new Date().toISOString(), type: 'combat', text: `⚔ 你发起了攻击！${enemyName}出现了！` });
          set({ player, worldState, logs, isProcessing: false });
          return;
        }

        playerAction = {
          id: `custom_${Date.now()}`,
          label: guard.sanitizedText.slice(0, 30),
          type: guard.intent,
          risk: 'medium',
          relatedAttribute: guard.checkAttribute || undefined,
          relatedSkill: guard.detectedSkillId || null,
          mpCost: 0,
          isCustom: true,
          customText: guard.sanitizedText,
          requiresCheck: guard.requiresCheck,
          checkAttribute: guard.checkAttribute,
          difficultyClass: guard.difficultyClass,
        };
      } else {
        // Find from current event's action options
        const option = currentEvent?.actionOptions.find(o => o.id === actionId);
        if (option) {
          playerAction = {
            id: option.id,
            label: option.label,
            type: option.type,
            risk: option.risk,
            relatedAttribute: option.relatedAttribute,
            relatedSkill: option.relatedSkill,
            mpCost: option.mpCost || 0,
            difficultyPreview: option.difficultyPreview,
            isCustom: false,
            selectedOptionId: option.id,
            selectedOptionLabel: option.label,
          };
          // Handle option.moneyCost (purchase from option)
          if (option.moneyCost) {
            if (!canAfford(player.money, option.moneyCost)) {
              set({ isProcessing: false, errorMessage: `钱币不足，需要${option.moneyCost.gold ? `${option.moneyCost.gold}金` : ''}${option.moneyCost.silver ? `${option.moneyCost.silver}银` : ''}${option.moneyCost.copper || 0}铜。` });
              return;
            }
            player.money = subtractMoney(player.money, option.moneyCost);
            logs.push({ id: `purchase_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `花费${option.moneyCost.gold ? `${option.moneyCost.gold}金` : ''}${option.moneyCost.silver ? `${option.moneyCost.silver}银` : ''}${option.moneyCost.copper || 0}铜购买：${option.label}` });
          }
        } else {
          playerAction = {
            id: actionId,
            type: 'other',
            risk: 'medium',
            mpCost: 0,
            isCustom: false,
          };
        }
      }

      // 2. Judge — only if action needs a check
      const doCheck = needsCheck(playerAction);
      const judgeResult = doCheck ? evaluate(player, playerAction, worldState) : {
        outcome: '成功' as const, roll: 0, dc: 0, modifier: 0, notes: '无需判定',
      };

      // 2.5 Skill validation & custom skill detection
      if (playerAction.isCustom && playerAction.customText) {
        playerAction = validateCustomSkillIntent(playerAction, player);
      }
      // Resolve skill costs with canCastSkill check
      let skillMpCost = 0;
      let skillHpCost = 0;
      if (playerAction.relatedSkill) {
        const skill = getSkillById(playerAction.relatedSkill);
        if (!skill || !player.skills.learned.includes(skill.id)) {
          playerAction.relatedSkill = undefined;
        } else if (!canCastSkill(skill, player)) {
          const reasons = getSkillLockReasons(skill, player);
          logs.push({ id: `skill_block_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `技能"${skill.name}"无法释放：${reasons.join('、')}` });
          if (playerAction.isCustom) {
            playerAction.customText = `玩家尝试使用技能"${skill.name}"但本地规则判定无效（${reasons.join('、')}）。请生成失败或无效后果。`;
          }
          playerAction.relatedSkill = undefined;
        } else {
          skillMpCost = skill.castRequirements.mpCost || 0;
          skillHpCost = skill.castRequirements.hpCost || 0;
          // Check MP sufficiency
          if (player.resources.mp < skillMpCost) {
            logs.push({ id: `mp_block_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `MP不足（需${skillMpCost}，当前${player.resources.mp}），技能释放失败。` });
            playerAction.relatedSkill = undefined;
            skillMpCost = 0;
          }
        }
      }

      // 2.6 Local healing & potion effects
      const healResult = applyLocalHealEffect(player, playerAction, logs);
      if (healResult.hpHealed > 0 || healResult.potionUsed) {
        player.resources.hp = Math.min(player.resources.maxHp, player.resources.hp + healResult.hpHealed);
        player.resources.mp = Math.min(player.resources.maxMp, player.resources.mp + healResult.mpRestored);
        if (healResult.potionUsed) {
          player.inventory = player.inventory.map(i =>
            i.id === 'healing_potion' ? { ...i, quantity: i.quantity - 1 } : i
          ).filter(i => i.quantity > 0);
        }
      }

      // 2.8 Exp and money changes (only quest completion and rest costs)
      const moneyAward = getMoneyChange(playerAction, player, judgeResult);
      if (moneyAward.copper !== 0 || moneyAward.silver !== 0 || moneyAward.gold !== 0) {
        player.money = addMoney(player.money, moneyAward);
        const sign = moneyAward.gold > 0 || moneyAward.silver > 0 || moneyAward.copper > 0 ? '+' : '';
        const parts = [];
        if (moneyAward.gold !== 0) parts.push(`${sign}${moneyAward.gold}金`);
        if (moneyAward.silver !== 0) parts.push(`${sign}${moneyAward.silver}银`);
        if (moneyAward.copper !== 0) parts.push(`${sign}${moneyAward.copper}铜`);
        if (parts.length > 0) logs.push({ id: `money_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `金钱 ${parts.join(' ')}` });
      }

      // 2.7 Apply MP/HP cost locally (AI doesn't do this anymore)
      const totalMpCost = playerAction.mpCost || skillMpCost || judgeResult.consumption?.mp || 0;
      const totalHpCost = skillHpCost || judgeResult.consumption?.hp || 0;
      if (totalMpCost > 0 || totalHpCost > 0) {
        player.resources.mp = Math.max(0, player.resources.mp - totalMpCost);
        player.resources.hp = Math.max(0, player.resources.hp - totalHpCost);
        if (totalMpCost > 0) logs.push({ id: `mp_cost_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `MP -${totalMpCost}` });
        if (totalHpCost > 0) logs.push({ id: `hp_cost_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `HP -${totalHpCost}` });
      }

      // 3. Get AI response — pass selectedOption for full intent/entity context
      const settings = useSettingsStore.getState();
      const selectedOption = !customText
        ? currentEvent?.actionOptions.find(o => o.id === actionId)
        : undefined;
      const aiResult = await sendPlayerAction(
        player, worldState, playerAction, judgeResult,
        logs, eventHistory, { ...settings, customGMRules: settings.customGMRules },
        selectedOption,
      );

      // 3.5 Filter AI options: remove unlearned skills
      if (aiResult.success && aiResult.response) {
        aiResult.response.actionOptions = filterAIOptions(aiResult.response.actionOptions, player);
      }

      // 3.6 Combat: detect combatStart (priority) or legacy enemy from AI response
      if (aiResult.success && aiResult.response && !worldState.combatState.active) {
        // Combat cooldown check
        if (worldState.combatCooldown > 0) {
          // On cooldown, ignore combat trigger
          if (aiResult.response) {
            (aiResult.response as any).combatStart = undefined;
            (aiResult.response as any).enemy = undefined;
          }
          logs.push({ id: `cooldown_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `战斗冷却中（还需${worldState.combatCooldown}次行动），跳过本次遭遇。` });
        }
        // Priority 1: combatStart proposal
        if (aiResult.response.combatStart) {
          try {
            const combatResult = startCombatFromAI(player, worldState, aiResult.response.combatStart);
            worldState.combatState = combatResult.combatState;
            if (combatResult.logs.length > 0) {
              logs.push({ id: `combat_${Date.now()}`, timestamp: new Date().toISOString(), type: 'combat', text: combatResult.logs[0]?.text || '战斗开始！' });
            }
            // Clear enemy so gameEngine doesn't double-process
            (aiResult.response as any).enemy = undefined;
          } catch (err) {
            logs.push({ id: `combat_err_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: '战斗启动失败，已转为普通剧情。' });
          }
        }
        // Priority 2: legacy enemy (backward compat)
        else if (aiResult.response.enemy) {
          const combatResult = startCombatFromLegacyEnemy(player, worldState, aiResult.response.enemy);
          worldState.combatState = combatResult.combatState;
          logs.push({ id: `combat_start_${Date.now()}`, timestamp: new Date().toISOString(), type: 'combat', text: combatResult.logs[0]?.text || `战斗开始！${aiResult.response.enemy.name}出现了！` });
          (aiResult.response as any).enemy = undefined;
        }
      }

      // If combat is active after this round, skip normal event processing
      // The CombatPanel will take over for the next action

      // 4. Handle AI result
      if (aiResult.success && aiResult.response) {
        const engineResult = applyAIResponse(aiResult.response, player, worldState, logs);

        // Ensure combatState changes are preserved
        const finalWorldState = { ...engineResult.worldState, combatState: worldState.combatState };

        // Update long-term memory
        extractImportantFacts(aiResult.response);
        updateLongTermSummary(engineResult.player, finalWorldState, engineResult.logs);
        const trimmedLogs = trimRecentLogs(engineResult.logs);
        const newEventHistory = [...eventHistory, aiResult.response].slice(-50);
        const newActionCount = (get().actionCount || 0) + 1;

        set({
          player: engineResult.player,
          worldState: finalWorldState,
          currentEvent: aiResult.response,
          eventHistory: newEventHistory,
          logs: trimmedLogs,
          lastJudgeResult: judgeResult,
          lastAIResult: aiResult,
          isProcessing: false,
          didLevelUp: engineResult.didLevelUp,
          newLevel: engineResult.newLevel || null,
          actionCount: newActionCount,
        });

        // Auto-save every 5 actions
        if (newActionCount % 5 === 0) {
          const summary = getLongTermSummary();
          const flags = getGameFlags();
          saveGame(engineResult.player, engineResult.worldState, aiResult.response, newEventHistory, trimmedLogs, summary, flags);
        }
      } else {
        // Handle error
        set({
          lastJudgeResult: judgeResult,
          lastAIResult: aiResult,
          isProcessing: false,
          errorMessage: aiResult.error?.message || 'AI 请求失败',
        });
      }
    } catch (e) {
      set({
        isProcessing: false,
        errorMessage: e instanceof Error ? e.message : '未知错误',
      });
    }
  },

  saveCurrentGame: () => {
    const { player, worldState, currentEvent, eventHistory, logs, lastJudgeResult } = get();
    if (!player) return false;
    const summary = getLongTermSummary();
    const flags = getGameFlags();
    // Build a dummy lastPlayerAction (not critical for save)
    return saveGame(player, worldState, currentEvent, eventHistory, logs, summary, flags, undefined, lastJudgeResult || undefined);
  },

  loadSavedGame: () => {
    return get().continueGame();
  },

  deleteSavedGame: () => {
    return deleteSave();
  },

  hasSavedGame: () => {
    return hasSave();
  },

  getSavedGameInfo: () => {
    return getSaveInfo();
  },

  exportCurrentSave: () => {
    const { player, worldState, currentEvent, eventHistory, logs } = get();
    if (!player) return '';
    const summary = getLongTermSummary();
    const flags = getGameFlags();
    return exportSave(player, worldState, currentEvent, eventHistory, logs, summary, flags);
  },

  dismissLevelUp: () => {
    set({ didLevelUp: false, newLevel: null });
  },

  allocateAttribute: (attr: string) => {
    const { player, worldState } = get();
    if (!player || player.attributePoints <= 0) return;
    // Only allow allocation in safe locations
    const safeLocations = ['gray_deer_tavern', 'whitestone_inn', 'adventurers_guild_branch'];
    if (!safeLocations.includes(worldState.currentLocation)) return;
    const updated = addAttributePoint(player, attr);
    set({ player: updated });
  },

  clearError: () => set({ errorMessage: null, lastAIResult: null }),

  addLockedStoryFact: (fact) => {
    const { worldState } = get();
    if (!worldState.lockedStoryFacts.includes(fact)) {
      set({
        worldState: {
          ...worldState,
          lockedStoryFacts: [...worldState.lockedStoryFacts, fact],
        },
      });
    }
  },

  removeLockedStoryFact: (index) => {
    const { worldState } = get();
    const facts = [...worldState.lockedStoryFacts];
    facts.splice(index, 1);
    set({ worldState: { ...worldState, lockedStoryFacts: facts } });
  },

  clearLockedStoryFacts: () => {
    const { worldState } = get();
    set({ worldState: { ...worldState, lockedStoryFacts: [] } });
  },

  dismissCombat: () => {
    const { worldState } = get();
    set({
      worldState: {
        ...worldState,
        combatState: {
          active: false,
          phase: 'fighting',
          round: 0,
          turn: 'player' as const,
          enemies: [],
          playerBuffs: [],
          combatLog: [],
        },
        combatCooldown: 4,
      },
    });
  },

  restAtLocation: () => {
    const { player, worldState } = get();
    if (!player) return;

    const locId = worldState.currentLocation;
    const isSafe = locId.includes('tavern') || locId.includes('inn') || locId.includes('chapel') || locId.includes('guild');

    let hpHealed = 0;
    let mpRestored = 0;
    const logs = [...get().logs];

    // Check if already full
    if (player.resources.hp >= player.resources.maxHp && player.resources.mp >= player.resources.maxMp) {
      set({ errorMessage: '你的HP和MP已经是满的，不需要休息。' });
      return;
    }

    if (isSafe) {
      // Full restore at safe locations (cost money), or free when broke. Also clears fatigue.
      const restCost = player.level <= 3 ? { gold: 0, silver: 0, copper: 10 }
        : player.level <= 5 ? { gold: 0, silver: 0, copper: 50 }
        : { gold: 0, silver: 2, copper: 0 };

      const clearFatigue = (p: typeof player) => ({
        ...p,
        statusEffects: p.statusEffects.filter(s => s !== '疲劳'),
      });

      if (!canAfford(player.money, restCost)) {
        const p = clearFatigue({ ...player, resources: { ...player.resources, hp: player.resources.maxHp, mp: player.resources.maxMp } });
        logs.push({ id: `rest_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: '你囊中羞涩，酒馆老板摇了摇头，但还是让你在角落的草垫上睡了一晚。HP/MP完全恢复，疲劳消除（免费）。' });
        set({ player: p, logs, errorMessage: null });
        return;
      }
      hpHealed = player.resources.maxHp - player.resources.hp;
      mpRestored = player.resources.maxMp - player.resources.mp;
      const p = clearFatigue({ ...player, resources: { ...player.resources, hp: player.resources.maxHp, mp: player.resources.maxMp }, money: subtractMoney(player.money, restCost) });
      logs.push({ id: `rest_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `在安全地点休息：HP/MP完全恢复，疲劳消除（花费${restCost.copper}铜${restCost.silver ? `${restCost.silver}银` : ''}）。` });
      set({ player: p, logs, errorMessage: null });
    } else {
      // Non-safe location: only wild areas allow rest
      const isWild = locId.includes('forest') || locId.includes('mine') || locId.includes('road') || locId.includes('wild');
      if (!isWild) {
        set({ errorMessage: '这里不适合休息。去酒馆或旅店吧。' });
        return;
      }
      if ((worldState.wildernessRestUsed || 0) >= 2) {
        set({ errorMessage: '今天已在野外休息了2次，需要等到明天清晨。' });
        return;
      }
      const hpDeficit = player.resources.maxHp - player.resources.hp;
      const mpDeficit = player.resources.maxMp - player.resources.mp;
      hpHealed = Math.min(hpDeficit, 5);
      mpRestored = Math.min(mpDeficit, 3);
      const p = { ...player, resources: { ...player.resources, hp: player.resources.hp + hpHealed, mp: player.resources.mp + mpRestored } };
      const newWorldState = { ...worldState, wildernessRestUsed: (worldState.wildernessRestUsed || 0) + 1 };
      logs.push({ id: `rest_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `野外休息：HP +${hpHealed}，MP +${mpRestored}（今日剩余${2 - (worldState.wildernessRestUsed || 0) - 1}次）。` });
      set({ player: p, worldState: newWorldState, logs, errorMessage: null });
    }
  },

  submitCombatAction: async (action) => {
    const state = get();
    if (!state.player || !state.worldState.combatState.active) return;
    if (state.isProcessing) return;

    // Run local combat settlement immediately
    const result = runCombatAction(state.player, state.worldState.combatState, action);

    // Apply local results to player + combatState immediately
    let updatedPlayer = result.player;
    let updatedCombatState = result.combatState;

    set({
      player: updatedPlayer,
      worldState: { ...state.worldState, combatState: updatedCombatState },
      isProcessing: true,
    });

    // If combat ended, optionally fetch AI narrative description
    if (!updatedCombatState.active) {
      try {
        const settings = useSettingsStore.getState();
        if (settings.aiMode !== 'mock') {
          // Request AI to describe the combat resolution (don't let AI modify numbers)
          const resultText = updatedCombatState.phase === 'victory'
            ? `战斗胜利。玩家击败了敌人。${updatedCombatState.combatLog.slice(-3).map(l => l.text).join(' ')}`
            : updatedCombatState.phase === 'defeat'
              ? `玩家被击败了。`
              : `玩家脱离了战斗。`;

          const aiResult = await sendPlayerAction(
            updatedPlayer, { ...state.worldState, combatState: updatedCombatState },
            { id: 'combat_resolve', type: 'combat', risk: 'low', mpCost: 0, isCustom: false },
            { outcome: '成功', roll: 0, dc: 0, modifier: 0, notes: '' },
            state.logs, state.eventHistory,
            { ...settings, customGMRules: settings.customGMRules },
          );

          if (aiResult.success && aiResult.response) {
            // Apply narrative only (combat numbers already settled)
            const engineResult = applyAIResponse(aiResult.response, updatedPlayer, { ...state.worldState, combatState: updatedCombatState }, state.logs);
            updatedPlayer = engineResult.player;
            // Keep our combat state
            updatedCombatState = engineResult.worldState.combatState.active ? engineResult.worldState.combatState : updatedCombatState;
          } else {
            // AI failed — results already applied, just add system log
            const logs = [...updatedCombatState.combatLog];
            logs.push({
              id: `combat_desc_fail_${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: 'system',
              text: '描述生成失败，但战斗结算已完成。',
              round: updatedCombatState.round,
            });
            updatedCombatState = { ...updatedCombatState, combatLog: logs };
          }
        }
      } catch {
        // AI call failed — combat results stand
        const logs = [...updatedCombatState.combatLog];
        logs.push({
          id: `combat_desc_fail_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'system',
          text: '描述生成失败，但战斗结算已完成。',
          round: updatedCombatState.round,
        });
        updatedCombatState = { ...updatedCombatState, combatLog: logs };
      }

      // Keep combat state visible for victory/defeat display
      // Player can click "继续冒险" to dismiss
      set({
        player: updatedPlayer,
        worldState: { ...state.worldState, combatState: updatedCombatState, combatCooldown: 4 },
        isProcessing: false,
      });
    } else {
      // Combat continuing — no AI call needed for mid-combat
      set({
        player: updatedPlayer,
        worldState: { ...state.worldState, combatState: updatedCombatState },
        isProcessing: false,
      });
    }
  },
}));

/** Money only changes for rest costs. Income comes from quests and text parsing. */
/** Whitelist of items that have local effects */
const ITEM_EFFECTS: Record<string, (player: Player, _: PlayerAction, logs: LogEntry[]) => { hpDelta: number; mpDelta: number; damageBonus: number; consume: boolean; log: string }> = {
  healing_potion: (p, _a, logs) => ({
    hpDelta: 5, mpDelta: 0, damageBonus: 0, consume: true,
    log: 'HP +5（治疗药水）',
  }),
  fire_bomb: (_p, _a, logs) => ({
    hpDelta: 0, mpDelta: 0, damageBonus: 6, consume: true,
    log: '额外火焰伤害 +6（燃烧瓶）',
  }),
  smoke_bomb: (_p, _a, logs) => ({
    hpDelta: 0, mpDelta: 0, damageBonus: 0, consume: true,
    log: '烟雾遮蔽，潜行/逃跑判定+4',
  }),
};

/** Validate custom skill intent — block unlearned skills, match learned ones */
function validateCustomSkillIntent(action: PlayerAction, player: Player): PlayerAction {
  if (!action.isCustom || !action.customText) return action;
  const text = action.customText;

  // Check for skill intent keywords
  const skillIntent = /使用|释放|施展|发动|魔法|术|技能/.test(text);
  if (!skillIntent) return action;

  // Try to match a learned skill
  for (const sid of player.skills.learned) {
    const skill = getSkillById(sid);
    if (skill && text.includes(skill.name)) {
      return { ...action, relatedSkill: skill.id };
    }
  }

  // No learned skill matched — block it
  return {
    ...action,
    customText: `玩家尝试使用未掌握的技能，但本地规则判定无效。原始输入：${text}。请生成失败或无效后果。`,
    relatedSkill: undefined,
  };
}

/** Apply local healing effects (skills, potions, rest) */
function applyLocalHealEffect(player: Player, action: PlayerAction, logs: LogEntry[]): { hpHealed: number; mpRestored: number; potionUsed: boolean } {
  let hpHealed = 0;
  let mpRestored = 0;
  let potionUsed = false;

  // Healing skill: minor_heal
  if (action.relatedSkill === 'minor_heal' && player.skills.learned.includes('minor_heal')) {
    const outcome = action.relatedSkill ? '成功' : '失败'; // simplified
    hpHealed = 5;
    if (action.risk === 'low') hpHealed = 3; // cautious cast
    hpHealed = Math.min(hpHealed, player.resources.maxHp - player.resources.hp);
    if (hpHealed > 0) logs.push({ id: `heal_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `HP +${hpHealed}（小治疗术）` });
  }

  // Potion use
  if (action.type === 'item' || (action.customText && /喝|使用.*药水|治疗药水/.test(action.customText))) {
    const potion = player.inventory.find(i => i.id === 'healing_potion' && i.quantity > 0);
    if (potion) {
      hpHealed = Math.min(5, player.resources.maxHp - player.resources.hp);
      potionUsed = true;
      logs.push({ id: `potion_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `HP +${hpHealed}（治疗药水）` });
    } else if (action.customText && /药水/.test(action.customText)) {
      logs.push({ id: `no_potion_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: '你没有治疗药水。' });
    }
  }

  // Rest recovery
  if (action.type === 'cautious' && (action.id.includes('rest') || action.id.includes('inn'))) {
    // Full restore at safe locations, costing money
    const safeLocations = ['gray_deer_tavern', 'whitestone_inn', 'adventurers_guild_branch', 'small_chapel'];
    const isSafeLocation = safeLocations.includes(action.id) || action.id.includes('inn') || action.id.includes('tavern');
    if (isSafeLocation) {
      // Full HP/MP restore
      const restCost = player.level <= 3 ? { copper: 10 } : player.level <= 5 ? { copper: 50 } : { silver: 2, copper: 0 };
      if (!canAfford(player.money, restCost)) {
        logs.push({ id: `rest_poor_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `钱币不足，无法在此休息（需要${restCost.copper || restCost.silver ? `${restCost.silver || 0}银` : ''}${restCost.copper || 0}铜）。` });
        return { hpHealed: 0, mpRestored: 0, potionUsed: false };
      }
      hpHealed = player.resources.maxHp - player.resources.hp;
      mpRestored = player.resources.maxMp - player.resources.mp;
      // Money will be deducted in getMoneyChange
      if (hpHealed > 0 || mpRestored > 0) {
        logs.push({ id: `rest_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `休息恢复: HP +${hpHealed} MP +${mpRestored}（花费${restCost.copper || 0}铜${restCost.silver ? `${restCost.silver}银` : ''}）` });
      }
    } else {
      mpRestored = Math.min(5, player.resources.maxMp - player.resources.mp);
      hpHealed = Math.min(3, player.resources.maxHp - player.resources.hp);
      if (hpHealed > 0 || mpRestored > 0) {
        logs.push({ id: `rest_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `休息恢复: HP +${hpHealed} MP +${mpRestored}` });
      }
    }
  }

  return { hpHealed, mpRestored, potionUsed };
}

/** Filter AI-generated action options: remove unlearned skills */
function filterAIOptions(options: ActionOption[], player: Player): ActionOption[] {
  return options.map(opt => {
    if (opt.relatedSkill && !player.skills.learned.includes(opt.relatedSkill)) {
      return { ...opt, relatedSkill: null, mpCost: 0 };
    }
    return opt;
  });
}

/** Generate appropriate wild enemy name based on location */
function getWildEnemyName(locId: string): string {
  if (locId.includes('forest') || locId.includes('林')) return pickStr(['野狼', '毒蛇', '哥布林', '巨蛛', '山贼']);
  if (locId.includes('mine') || locId.includes('矿')) return pickStr(['洞穴蝙蝠', '巨蛛', '哥布林矿工', '岩蛇', '亡灵矿工']);
  if (locId.includes('road') || locId.includes('道')) return pickStr(['拦路强盗', '野狗', '饿狼', '可疑旅人']);
  if (locId.includes('ruin') || locId.includes('遗迹') || locId.includes('废')) return pickStr(['亡灵守卫', '石像鬼', '遗迹守护者', '暗影']);
  if (locId.includes('cave') || locId.includes('洞')) return pickStr(['洞穴巨蛛', '暗影生物', '蝙蝠群', '穴居人']);
  return pickStr(['野狼', '哥布林', '强盗', '巨鼠', '毒蛇']);
}
function pickStr(arr: string[]): string { return arr[Math.floor(Math.random() * arr.length)]; }

function getMoneyChange(action: PlayerAction, player: Player, _judge: JudgeResult): { gold: number; silver: number; copper: number } {
  // Resting costs money
  if (action.type === 'cautious' && (action.id.includes('rest') || action.id.includes('inn') || action.id.includes('tavern'))) {
    const isSafe = ['inn', 'tavern', 'gray_deer', 'whitestone'].some(s => action.id.includes(s));
    if (isSafe) {
      return player.level <= 3 ? { gold: 0, silver: 0, copper: -10 }
        : player.level <= 5 ? { gold: 0, silver: 0, copper: -50 }
        : { gold: 0, silver: -2, copper: 0 };
    }
    return { gold: 0, silver: 0, copper: -5 };
  }
  // No per-action money — income comes from quest completion rewards
  return { gold: 0, silver: 0, copper: 0 };
}
