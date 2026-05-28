import type { Player, WorldState, AIResponse, PlayerAction, JudgeResult } from '../types';
import type { LogEntry } from '../types/log';
import type { LongTermSummary } from '../types/memory';
import { createEmptySummary } from '../types/memory';

const SAVE_KEY = 'tavern_adventure_save';

export interface SaveFile {
  version: 1;
  savedAt: string;
  player: Player;
  worldState: WorldState;
  currentEvent: AIResponse | null;
  eventHistory: AIResponse[];
  logs: LogEntry[];
  longTermSummary: LongTermSummary;
  gameFlags: string[];
  lastPlayerAction?: PlayerAction;
  lastJudgeResult?: JudgeResult;
  // Explicitly NO: apiKey, apiBaseUrl, apiModel, keyStorage, aiMode
}

export function saveGame(
  player: Player,
  worldState: WorldState,
  currentEvent: AIResponse | null,
  eventHistory: AIResponse[],
  logs: LogEntry[],
  longTermSummary: LongTermSummary,
  gameFlags: string[],
  lastPlayerAction?: PlayerAction,
  lastJudgeResult?: JudgeResult
): boolean {
  try {
    const save: SaveFile = {
      version: 1,
      savedAt: new Date().toISOString(),
      player,
      worldState,
      currentEvent,
      eventHistory: eventHistory.slice(-50),
      logs: logs.slice(-200),
      longTermSummary,
      gameFlags,
      lastPlayerAction,
      lastJudgeResult,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (e) {
    console.error('Failed to save game:', e);
    return false;
  }
}

export function loadGame(): SaveFile | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved: SaveFile = JSON.parse(raw);
    if (!saved.version || !saved.player || !saved.worldState) {
      console.warn('Save file is corrupted or from an incompatible version');
      return null;
    }
    // Migrate old saves to current format
    if (!saved.longTermSummary) {
      saved.longTermSummary = createEmptySummary();
    }
    if (!saved.gameFlags) {
      saved.gameFlags = [];
    }
    if (!saved.worldState.generatedLocations) {
      saved.worldState.generatedLocations = {};
    }
    if (!saved.worldState.currentLocationName) {
      saved.worldState.currentLocationName = saved.worldState.currentLocation || '未知地点';
    }
    if (!saved.worldState.combatState) {
      saved.worldState.combatState = { active: false };
    }
    return saved;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

export function deleteSave(): boolean {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    console.error('Failed to delete save:', e);
    return false;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function getSaveInfo(): { savedAt: string; playerName: string; level: number } | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const saved: SaveFile = JSON.parse(raw);
    return {
      savedAt: saved.savedAt,
      playerName: saved.player.name,
      level: saved.player.level,
    };
  } catch {
    return null;
  }
}

export function exportSave(
  player: Player,
  worldState: WorldState,
  currentEvent: AIResponse | null,
  eventHistory: AIResponse[],
  logs: LogEntry[],
  longTermSummary: LongTermSummary,
  gameFlags: string[]
): string {
  const save: SaveFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    player,
    worldState,
    currentEvent,
    eventHistory: eventHistory.slice(-50),
    logs: logs.slice(-200),
    longTermSummary,
    gameFlags,
    // Explicitly exclude AI settings
  };
  return JSON.stringify(save, null, 2);
}
