import type {
  AIResponse, AIResult, PlayerAction, JudgeResult,
  Player, WorldState, LogEntry,
} from '../types';
import { getMockResponse } from '../data/mockEventPool';
import {
  buildAIContext, buildEventPromptFull, buildSystemMessages,
} from './promptService';
import { normalizeAndComplete } from './responseAdapter';

// ========== Request dedup & logging ==========
let requestCount = 0;
let inFlight = false;

function estimateTokens(text: string): number {
  // Rough: 1 token ≈ 2 Chinese chars or 4 English chars
  const chinese = (text.match(/[一-鿿]/g) || []).length;
  const other = text.length - chinese;
  return Math.ceil(chinese / 1.5 + other / 4);
}

function logRequest(messages: Array<{ role: string; content: string }>, maxTokens: number): void {
  requestCount++;
  const fullText = messages.map(m => m.content).join('\n');
  const estimatedTokens = estimateTokens(fullText);
  console.group(`[AI Request #${requestCount}]`);
  console.log(`Messages: ${messages.length}`);
  console.log(`Estimated input tokens: ~${estimatedTokens}`);
  console.log(`max_tokens: ${maxTokens}`);
  console.log(`Prompt preview:`, fullText.slice(0, 500));
  console.groupEnd();
}

function logResponse(content: string, elapsed: number): void {
  const chars = content?.length || 0;
  const estimatedOut = estimateTokens(content || '');
  console.log(`[AI Response #${requestCount}] ${chars} chars, ~${estimatedOut} tokens, ${elapsed}ms`);
  console.log(`[AI Total requests: ${requestCount}]`);
}

/** Pick max_tokens based on event type */
function getMaxTokensByAction(action: PlayerAction): number {
  switch (action.type) {
    case 'combat': return 900;
    case 'exploration': return 800;
    default: return 700;
  }
}

// ========== Main API ==========
export async function sendPlayerAction(
  player: Player,
  worldState: WorldState,
  playerAction: PlayerAction,
  judgeResult: JudgeResult,
  recentLogs: LogEntry[],
  eventHistory: AIResponse[],
  settings: { aiMode: string; apiBaseUrl: string; apiModel: string; apiKey: string }
): Promise<AIResult> {
  // Mock mode
  if (settings.aiMode === 'mock') {
    const response = getMockResponse({ player, worldState }, playerAction, judgeResult);
    return { success: true, response };
  }

  // Dedup: prevent concurrent AI requests
  if (inFlight) {
    return { success: false, error: { type: 'network', message: '已有 AI 请求正在处理中，请等待。' } };
  }

  inFlight = true;
  try {
    return await sendAIRequest(player, worldState, playerAction, judgeResult, recentLogs, eventHistory, settings);
  } finally {
    inFlight = false;
  }
}

async function sendAIRequest(
  player: Player,
  worldState: WorldState,
  playerAction: PlayerAction,
  judgeResult: JudgeResult,
  recentLogs: LogEntry[],
  eventHistory: AIResponse[],
  settings: { aiMode: string; apiBaseUrl: string; apiModel: string; apiKey: string }
): Promise<AIResult> {
  const context = buildAIContext(player, worldState, recentLogs, eventHistory);
  const userMessage = buildEventPromptFull(context, playerAction, judgeResult);
  const messages = [...buildSystemMessages(), { role: 'user', content: userMessage }];
  const maxTokens = getMaxTokensByAction(playerAction);

  logRequest(messages, maxTokens);

  const startTime = Date.now();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000);

    const body: Record<string, unknown> = {
      model: settings.apiModel,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
    };
    // JSON mode if enabled in settings
    if ((settings as any).useJsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const statusCode = response.status;
      const errorBody = await response.text().catch(() => '');
      let message: string;
      if (statusCode === 401) message = '认证失败 (401)，API Key 无效或已过期。';
      else if (statusCode === 429) message = '请求过于频繁 (429)，请稍后重试。';
      else if (statusCode >= 500) message = `API 服务暂时不可用 (${statusCode})，请稍后重试。`;
      else message = `请求失败 (${statusCode})。`;
      return { success: false, error: { type: 'http_error', message, statusCode, details: errorBody } };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    logResponse(content || '', elapsed);

    if (!content) {
      return { success: false, error: { type: 'parse_error', message: 'AI 返回内容为空。' } };
    }

    // Single-pass: normalizeAndComplete handles JSON extraction internally
    const result = normalizeAndComplete(content);
    if (result.success) {
      return { success: true, response: result.response };
    }

    // Do NOT auto-retry — show error immediately
    return {
      success: false,
      rawText: content.slice(0, 500),
      validationErrors: result.errors,
      error: {
        type: 'validation_error',
        message: `AI 返回格式异常（${result.errors.length} 个错误）。请重试。`,
        details: result.errors.slice(0, 5).join('; '),
      },
    };
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { success: false, error: { type: 'network', message: '请求超时（30秒）。' } };
    }
    const isTypeError = e instanceof TypeError;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: {
        type: isTypeError ? 'cors' : 'network',
        message: isTypeError
          ? '网络请求失败，可能是 CORS 限制。'
          : `网络错误：${msg}`,
        details: msg,
      },
    };
  }
}

// ========== Connection Test (MINIMAL request) ==========
export async function testConnection(
  apiBaseUrl: string,
  apiModel: string,
  apiKey: string
): Promise<{ ok: boolean; message: string; latency?: number }> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [{ role: 'user', content: 'Return only JSON: {"ok":true}' }],
        max_tokens: 20,
        temperature: 0,
      }),
    });
    const latency = Date.now() - startTime;
    if (response.ok) return { ok: true, message: `连接正常，延迟 ${latency}ms`, latency };

    let errorDetail = '';
    try {
      const errorBody = await response.json();
      errorDetail = errorBody?.error?.message || errorBody?.message || '';
    } catch { /* ignore */ }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: `认证失败 (${response.status})${errorDetail ? `：${errorDetail}` : ''}`, latency };
    }
    if (response.status === 404) {
      return { ok: false, message: `接口不存在 (404)。当前：${apiBaseUrl}/chat/completions`, latency };
    }
    return { ok: false, message: `请求失败 (${response.status})${errorDetail ? `：${errorDetail}` : ''}`, latency };
  } catch (e: unknown) {
    if (e instanceof TypeError) return { ok: false, message: '网络请求失败，可能是 CORS 限制。' };
    return { ok: false, message: `网络错误：${e instanceof Error ? e.message : String(e)}` };
  }
}
