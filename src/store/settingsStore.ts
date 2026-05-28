import { create } from 'zustand';

export type AIMode = 'mock' | 'custom_api';
export type KeyStorage = 'none' | 'session' | 'local';
export type OpeningMode = 'ai_generated' | 'mock_template';
export type OptionMode = 'ai_options' | 'manual_options' | 'hybrid';

export interface AISettings {
  aiMode: AIMode;
  apiBaseUrl: string;
  apiModel: string;
  apiKey: string;
  keyStorage: KeyStorage;
  openingMode: OpeningMode;
  optionMode: OptionMode;
  useJsonMode: boolean;
}

interface TestResult {
  ok: boolean;
  message: string;
  latency?: number;
}

interface SettingsState extends AISettings {
  isTesting: boolean;
  testResult: TestResult | null;

  setMode: (mode: AIMode) => void;
  setApiBaseUrl: (url: string) => void;
  setApiModel: (model: string) => void;
  setApiKey: (key: string) => void;
  setKeyStorage: (mode: KeyStorage) => void;
  setOpeningMode: (mode: OpeningMode) => void;
  setOptionMode: (mode: OptionMode) => void;
  setUseJsonMode: (v: boolean) => void;
  testConnection: () => Promise<void>;
  clearTestResult: () => void;
}

// Session/local storage keys for AI settings (SEPARATE from game saves)
const SESSION_KEY = 'tavern_ai_settings_session';
const LOCAL_KEY = 'tavern_ai_settings_local';

function loadInitialSettings(): AISettings {
  // 1. Try to find saved keyStorage preference
  const localSettings = loadFromLocal();
  const sessionSettings = loadFromSession();

  // Determine which storage mode was last used
  const lastMode = (localSettings?.keyStorage || sessionSettings?.keyStorage || 'session') as KeyStorage;

  // Load settings from the appropriate storage
  if (lastMode === 'local' && localSettings) {
    return { ...localSettings, keyStorage: 'local' };
  }
  if (lastMode === 'session' && sessionSettings) {
    return { ...sessionSettings, keyStorage: 'session' };
  }

  // Defaults
  return {
    aiMode: (import.meta.env.VITE_USE_MOCK_AI === 'true' ? 'mock' : 'mock') as AIMode,
    apiBaseUrl: (import.meta.env.VITE_DEFAULT_AI_BASE_URL as string) || 'https://api.openai.com/v1',
    apiModel: (import.meta.env.VITE_DEFAULT_AI_MODEL as string) || 'gpt-4o',
    apiKey: '',
    keyStorage: 'session',
    openingMode: 'mock_template' as OpeningMode,
    optionMode: 'ai_options' as OptionMode,
    useJsonMode: false,
  };
}

function saveToSession(settings: Partial<AISettings>): void {
  try {
    const existing = loadFromSession() || {};
    const merged = { ...existing, ...settings };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  } catch { /* ignore */ }
}

function loadFromSession(): AISettings | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveToLocal(settings: Partial<AISettings>): void {
  try {
    const existing = loadFromLocal() || {};
    const merged = { ...existing, ...settings };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
  } catch { /* ignore */ }
}

function loadFromLocal(): AISettings | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearSettingsFromStorage(): void {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LOCAL_KEY);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadInitialSettings(),
  isTesting: false,
  testResult: null,

  setMode: (mode: AIMode) => {
    set({ aiMode: mode });
    // Save mode preference
    const { keyStorage } = get();
    if (keyStorage === 'session') saveToSession({ aiMode: mode });
    else if (keyStorage === 'local') saveToLocal({ aiMode: mode });
  },

  setApiBaseUrl: (url: string) => {
    set({ apiBaseUrl: url });
    const { keyStorage } = get();
    if (keyStorage === 'session') saveToSession({ apiBaseUrl: url });
    else if (keyStorage === 'local') saveToLocal({ apiBaseUrl: url });
  },

  setApiModel: (model: string) => {
    set({ apiModel: model });
    const { keyStorage } = get();
    if (keyStorage === 'session') saveToSession({ apiModel: model });
    else if (keyStorage === 'local') saveToLocal({ apiModel: model });
  },

  setApiKey: (key: string) => {
    set({ apiKey: key });
    const { keyStorage } = get();
    if (keyStorage === 'session') saveToSession({ apiKey: key });
    else if (keyStorage === 'local') saveToLocal({ apiKey: key });
    // 'none' mode: stays in memory only
  },

  setKeyStorage: (mode: KeyStorage) => {
    const current = get();
    const currentKey = current.apiKey;
    const currentMode = current.aiMode;
    const currentUrl = current.apiBaseUrl;
    const currentModel = current.apiModel;

    // Migrate key to new storage
    if (mode === 'none') {
      // Clear from all storage, keep in memory
      clearSettingsFromStorage();
      // Save that keyStorage is 'none' so we know on reload
      saveToSession({ keyStorage: 'none', apiKey: '', aiMode: currentMode, apiBaseUrl: currentUrl, apiModel: currentModel });
    } else if (mode === 'session') {
      localStorage.removeItem(LOCAL_KEY);
      saveToSession({ apiKey: currentKey, keyStorage: 'session', aiMode: currentMode, apiBaseUrl: currentUrl, apiModel: currentModel });
    } else if (mode === 'local') {
      sessionStorage.removeItem(SESSION_KEY);
      saveToLocal({ apiKey: currentKey, keyStorage: 'local', aiMode: currentMode, apiBaseUrl: currentUrl, apiModel: currentModel });
    }

    set({ keyStorage: mode });
  },

  setOpeningMode: (mode: OpeningMode) => {
    set({ openingMode: mode });
    const { keyStorage } = get();
    if (keyStorage === 'session') saveToSession({ openingMode: mode });
    else if (keyStorage === 'local') saveToLocal({ openingMode: mode });
  },

  setOptionMode: (mode: OptionMode) => {
    set({ optionMode: mode });
    const { keyStorage } = get();
    if (keyStorage === 'session') saveToSession({ optionMode: mode });
    else if (keyStorage === 'local') saveToLocal({ optionMode: mode });
  },

  setUseJsonMode: (v: boolean) => set({ useJsonMode: v }),

  testConnection: async () => {
    const { apiBaseUrl, apiModel, apiKey } = get();
    set({ isTesting: true, testResult: null });

    try {
      const startTime = Date.now();
      const response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: apiModel,
          messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
          max_tokens: 10,
        }),
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        set({ isTesting: false, testResult: { ok: true, message: `连接正常，延迟 ${latency}ms`, latency } });
        return;
      }

      // Try to read error details from response body
      let errorDetail = '';
      try {
        const errorBody = await response.json();
        errorDetail = errorBody?.error?.message || errorBody?.message || JSON.stringify(errorBody).slice(0, 200);
      } catch {
        errorDetail = await response.text().catch(() => '');
      }

      if (response.status === 401 || response.status === 403) {
        set({ isTesting: false, testResult: { ok: false, message: `认证失败 (${response.status})：请检查 API Key。` + (errorDetail ? ` 详情：${errorDetail}` : ''), latency } });
      } else if (response.status === 404) {
        set({ isTesting: false, testResult: { ok: false, message: `接口不存在 (404)。请检查 Base URL 是否正确。当前：${apiBaseUrl}/chat/completions`, latency } });
      } else if (response.status === 503) {
        set({ isTesting: false, testResult: { ok: false, message: `服务暂时不可用 (503)。可能原因：模型名不存在、账号欠费、服务商暂时过载。` + (errorDetail ? ` 详情：${errorDetail}` : ''), latency } });
      } else {
        set({ isTesting: false, testResult: { ok: false, message: `请求失败 (${response.status})。` + (errorDetail ? ` 详情：${errorDetail}` : ''), latency } });
      }
    } catch (e: unknown) {
      if (e instanceof TypeError) {
        set({ isTesting: false, testResult: { ok: false, message: '网络请求失败，可能是 CORS 限制。部分 API 不支持浏览器直连。' } });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        set({ isTesting: false, testResult: { ok: false, message: `网络错误：${msg}` } });
      }
    }
  },

  clearTestResult: () => set({ testResult: null }),
}));
