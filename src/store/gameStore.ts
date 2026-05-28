import { create } from 'zustand';
import type {
  Player, WorldState, AIResponse, LogEntry,
  CharacterCreationData, PlayerAction, JudgeResult, AIResult,
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
  saveCurrentGame: () => boolean;
  loadSavedGame: () => boolean;
  deleteSavedGame: () => boolean;
  hasSavedGame: () => boolean;
  getSavedGameInfo: () => { savedAt: string; playerName: string; level: number } | null;
  exportCurrentSave: () => string;
  dismissLevelUp: () => void;
  allocateAttribute: (attr: string) => void;
  clearError: () => void;
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
    const { player, worldState, logs, eventHistory, currentEvent, isProcessing } = get();
    if (!player) return;
    // Guard: prevent double-clicks and concurrent AI requests
    if (isProcessing) return;

    set({ isProcessing: true, errorMessage: null });

    try {
      // 1. Build player action
      let playerAction: PlayerAction;
      if (customText) {
        playerAction = parseCustomAction(customText, player);
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
          };
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

      // 2.5 Resolve skill cost from relatedSkill (AI doesn't send mpCost)
      let skillMpCost = 0;
      let skillHpCost = 0;
      if (playerAction.relatedSkill) {
        const skill = getSkillById(playerAction.relatedSkill);
        if (skill && player.skills.learned.includes(skill.id)) {
          skillMpCost = skill.castRequirements.mpCost || 0;
          skillHpCost = skill.castRequirements.hpCost || 0;
        }
      }
      // Also detect skill usage from custom text
      if (playerAction.isCustom && playerAction.customText && !playerAction.relatedSkill) {
        for (const sid of player.skills.learned) {
          const skill = getSkillById(sid);
          if (skill && playerAction.customText.includes(skill.name)) {
            playerAction.relatedSkill = skill.id;
            skillMpCost = skill.castRequirements.mpCost || 0;
            skillHpCost = skill.castRequirements.hpCost || 0;
            break;
          }
        }
      }
      // 2.6 Apply MP/HP cost locally (AI doesn't do this anymore)
      const totalMpCost = playerAction.mpCost || skillMpCost || judgeResult.consumption?.mp || 0;
      const totalHpCost = skillHpCost || judgeResult.consumption?.hp || 0;
      if (totalMpCost > 0 || totalHpCost > 0) {
        player.resources.mp = Math.max(0, player.resources.mp - totalMpCost);
        player.resources.hp = Math.max(0, player.resources.hp - totalHpCost);
        if (totalMpCost > 0) logs.push({ id: `mp_cost_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `MP -${totalMpCost}` });
        if (totalHpCost > 0) logs.push({ id: `hp_cost_${Date.now()}`, timestamp: new Date().toISOString(), type: 'system', text: `HP -${totalHpCost}` });
      }

      // 3. Get AI response
      const settings = useSettingsStore.getState();
      const aiResult = await sendPlayerAction(
        player, worldState, playerAction, judgeResult,
        logs, eventHistory, { ...settings, customGMRules: settings.customGMRules }
      );

      // 4. Handle AI result
      if (aiResult.success && aiResult.response) {
        const engineResult = applyAIResponse(aiResult.response, player, worldState, logs);

        // Update long-term memory
        extractImportantFacts(aiResult.response);
        updateLongTermSummary(engineResult.player, engineResult.worldState, engineResult.logs);
        const trimmedLogs = trimRecentLogs(engineResult.logs);
        const newEventHistory = [...eventHistory, aiResult.response].slice(-50);
        const newActionCount = (get().actionCount || 0) + 1;

        set({
          player: engineResult.player,
          worldState: engineResult.worldState,
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
}));
