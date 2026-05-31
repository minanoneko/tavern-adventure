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
  // Explicitly NO: apiKey, apiBaseUrl, apiModel, keyStorage
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
      (saved.worldState.combatState as any) = { active: false, phase: 'fighting', round: 0, turn: 'player', enemies: [], playerBuffs: [], combatLog: [] };
    }
    if (!saved.worldState.lockedStoryFacts) {
      saved.worldState.lockedStoryFacts = [];
    }
    if (!(saved.worldState as any).paymentCommitments) {
      (saved.worldState as any).paymentCommitments = [];
    }
    if (!(saved.worldState as any).weatherTrend) {
      (saved.worldState as any).weatherTrend = 'stable';
    }
    if ((saved.worldState as any).weatherStableTurns === undefined) {
      (saved.worldState as any).weatherStableTurns = 0;
    }
    // Migrate old combatState { active, enemy? } to new CombatState
    const cs = saved.worldState.combatState as any;
    if (cs && !('phase' in cs)) {
      const migratedEnemies = cs.enemy ? [{
        id: `enemy_legacy_${Date.now()}`,
        name: cs.enemy.name,
        type: 'monster',
        level: cs.enemy.level || 1,
        str: cs.enemy.str || 4,
        dex: cs.enemy.dex || 4,
        con: cs.enemy.con || 4,
        hp: cs.enemy.hp || 10,
        maxHp: cs.enemy.maxHp || 10,
        statusEffects: [] as string[],
        isBoss: false,
        isDefeated: false,
        description: cs.enemy.description,
      }] : [];
      (saved.worldState.combatState as any) = {
        active: cs.active || false,
        phase: 'fighting',
        round: 1,
        turn: 'player',
        enemies: migratedEnemies,
        playerBuffs: [],
        combatLog: [],
      };
    }
    // Skills migration
    if (!saved.player.skills.equipped) {
      (saved.player.skills as any).equipped = [...(saved.player.skills.learned || [])];
    }
    if (!saved.player.skills.maxSlots) {
      (saved.player.skills as any).maxSlots = 7;
    }
    if (saved.player.skills.learnTokens === undefined) {
      (saved.player.skills as any).learnTokens = 0;
    }
    migratePlayerAttributesToDndScale(saved.player);
    return saved;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

function migratePlayerAttributesToDndScale(player: Player): void {
  const attrs = player.attributes;
  const total = Object.values(attrs).reduce((sum, value) => sum + value, 0);
  if (total >= 60) return;

  const mapOld = (value: number): number => {
    if (value <= 2) return 8;
    if (value === 3) return 9;
    if (value === 4) return 10;
    if (value === 5) return 12;
    if (value === 6) return 14;
    if (value === 7) return 15;
    if (value === 8) return 16;
    if (value === 9) return 17;
    if (value === 10) return 18;
    return Math.min(21, 18 + (value - 10));
  };

  const hpRatio = player.resources.maxHp > 0 ? player.resources.hp / player.resources.maxHp : 1;
  const mpRatio = player.resources.maxMp > 0 ? player.resources.mp / player.resources.maxMp : 1;

  attrs.str = mapOld(attrs.str);
  attrs.dex = mapOld(attrs.dex);
  attrs.con = mapOld(attrs.con);
  attrs.int = mapOld(attrs.int);
  attrs.wis = mapOld(attrs.wis);
  attrs.cha = mapOld(attrs.cha);

  const attrModifier = (value: number) => Math.floor((value - 10) / 2);
  const conMod = attrModifier(attrs.con);
  const castingMod = Math.max(attrModifier(attrs.int), attrModifier(attrs.wis), 0);
  const levelBonus = Math.max(0, player.level - 1);
  const maxHp = Math.max(8, 12 + conMod * 2 + levelBonus * Math.max(2, 5 + conMod));
  const maxMp = Math.max(4, 6 + castingMod * 2 + levelBonus * Math.max(1, 2 + Math.floor(castingMod / 2)));

  player.resources = {
    ...player.resources,
    maxHp,
    maxMp,
    hp: Math.max(1, Math.min(maxHp, Math.round(maxHp * hpRatio))),
    mp: Math.max(0, Math.min(maxMp, Math.round(maxMp * mpRatio))),
  };
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
