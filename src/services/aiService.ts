import type {
  AIResponse, AIResult, PlayerAction, JudgeResult,
  Player, WorldState, LogEntry,
} from '../types';
import { getMockResponse } from '../data/mockEventPool';
import {
  buildAIContext, buildEventPromptFull, buildSystemMessages,
} from './promptService';
import { normalizeAndComplete } from './responseAdapter';

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

  // Custom API mode
  const context = buildAIContext(player, worldState, recentLogs, eventHistory);
  const userMessage = buildEventPromptFull(context, playerAction, judgeResult);
  const messages = [...buildSystemMessages(), { role: 'user', content: userMessage }];

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.apiModel,
        messages,
        temperature: 0.6,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
    if (!content) {
      return { success: false, error: { type: 'parse_error', message: 'AI 返回内容为空。', details: JSON.stringify(data).slice(0, 200) } };
    }

    // Use responseAdapter: normalize, validate minimal, complete to full AIResponse
    const result = normalizeAndComplete(content);
    if (result.success) {
      return { success: true, response: result.response };
    }

    return {
      success: false,
      rawText: content.slice(0, 500),
      validationErrors: result.errors,
      error: {
        type: 'validation_error',
        message: `AI 返回内容格式不完整，${result.errors.length} 个字段校验失败。`,
        details: result.errors.slice(0, 5).join('; '),
      },
    };
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { success: false, error: { type: 'network', message: '请求超时（30秒）。AI 响应太慢，请检查网络或尝试切换模型。' } };
    }
    const isTypeError = e instanceof TypeError;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: {
        type: isTypeError ? 'cors' : 'network',
        message: isTypeError
          ? '网络请求失败，可能是 CORS 限制。部分 API 服务商不允许浏览器直接调用。'
          : `网络错误：${msg}`,
        details: msg,
      },
    };
  }
}

// ========== Connection Test ==========
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
        messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
        max_tokens: 10,
      }),
    });
    const latency = Date.now() - startTime;
    if (response.ok) return { ok: true, message: `连接正常，延迟 ${latency}ms`, latency };

    let errorDetail = '';
    try {
      const errorBody = await response.json();
      errorDetail = errorBody?.error?.message || errorBody?.message || JSON.stringify(errorBody).slice(0, 200);
    } catch { errorDetail = await response.text().catch(() => ''); }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: `认证失败 (${response.status})：请检查 API Key。${errorDetail ? ` ${errorDetail}` : ''}`, latency };
    }
    if (response.status === 404) {
      return { ok: false, message: `接口不存在 (404)。请检查 Base URL 是否正确。当前：${apiBaseUrl}/chat/completions`, latency };
    }
    if (response.status === 503) {
      return { ok: false, message: `服务暂时不可用 (503)。可能原因：模型名不存在、账号欠费、服务商暂时过载。${errorDetail ? ` ${errorDetail}` : ''}`, latency };
    }
    return { ok: false, message: `请求失败 (${response.status})。${errorDetail ? ` ${errorDetail}` : ''}`, latency };
  } catch (e: unknown) {
    if (e instanceof TypeError) return { ok: false, message: '网络请求失败，可能是 CORS 限制。部分 API 不支持浏览器直连。' };
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `网络错误：${msg}` };
  }
}
