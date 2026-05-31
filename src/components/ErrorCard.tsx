import { useGameStore } from '../store/gameStore';
import type { AIError } from '../types';

const errorMessages: Record<string, string> = {
  cors: '网络请求失败，可能是 CORS 限制。部分 API 不支持浏览器直连。',
  network: '网络连接失败，请检查网络。',
  http_error_401: '认证失败，API Key 无效或已过期。',
  http_error_429: '请求过于频繁，请稍后重试。',
  parse_error: 'AI 返回格式异常，无法解析。',
  validation_error: 'AI 返回内容不完整，请重试。',
};

const errorSuggestions: Record<string, string> = {
  cors: '请检查 API 服务商是否支持浏览器端调用。',
  http_error_401: '请检查 API Key 是否正确。',
  http_error_429: '等待几秒后重试。',
  parse_error: '可重试，或更换更稳定遵守 JSON 的模型。',
  validation_error: '可重试，或检查当前模型是否按要求返回完整 JSON。',
};

export default function ErrorCard({ error, validationErrors }: { error?: AIError; validationErrors?: string[] }) {
  const clearError = useGameStore(s => s.clearError);
  const lastAIResult = useGameStore(s => s.lastAIResult);

  const errorType = error?.type || 'unknown';
  const key = errorType === 'http_error' ? `http_error_${error?.statusCode}` : errorType;
  const message = error?.message || errorMessages[key] || '未知错误';
  const suggestion = errorSuggestions[key] || '';

  return (
    <div className="panel p-4 border-[var(--color-tavern-danger)]">
      <div className="text-sm text-danger mb-2">AI 请求失败</div>
      <div className="text-xs text-muted mb-2">{message}</div>
      {error?.details && (
        <div className="text-xs mb-2 p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: '#ff8888', wordBreak: 'break-all' }}>
          {error.details.slice(0, 200)}
        </div>
      )}
      {lastAIResult?.rawText && (error?.type === 'parse_error' || error?.type === 'validation_error') && (
        <details className="mb-2">
          <summary className="text-xs text-muted cursor-pointer">AI 原始返回（前800字）</summary>
          <pre className="text-xs mt-1 p-2 rounded overflow-auto max-h-40" style={{ background: 'rgba(0,0,0,0.4)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {lastAIResult.rawText.slice(0, 800)}
          </pre>
          {!lastAIResult.rawText.trim().startsWith('{') && (
            <div className="text-xs text-muted mt-1">模型未遵守JSON输出格式，返回了纯文本剧情。已使用兜底包装，游戏可继续。</div>
          )}
        </details>
      )}
      {suggestion && <div className="text-xs text-muted mb-3">{suggestion}</div>}
      {validationErrors && validationErrors.length > 0 && (
        <div className="text-xs text-muted mb-3">
          缺失字段：{validationErrors.slice(0, 3).map((e, i) => <span key={i} className="block">{e}</span>)}
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn text-xs" onClick={clearError}>关闭</button>
      </div>
    </div>
  );
}
