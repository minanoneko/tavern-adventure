import { useSettingsStore, type KeyStorage } from '../store/settingsStore';
import { useGameStore } from '../store/gameStore';
import { maskApiKey } from '../utils/maskApiKey';
import { GM_PRESETS } from '../services/customPromptGuard';
import { useState } from 'react';

export default function SettingsPanel({ inGame, onBack }: { inGame?: boolean; onBack?: () => void }) {
  const settings = useSettingsStore();
  const game = useGameStore();

  const [showKeyInput, setShowKeyInput] = useState(false);

  const handleSave = () => {
    game.saveCurrentGame();
    alert('游戏已保存。');
  };

  const handleDeleteSave = () => {
    if (confirm('确定要删除存档吗？此操作不可撤销。')) {
      game.deleteSavedGame();
      alert('存档已删除。');
    }
  };

  const handleExportSave = () => {
    const json = game.exportCurrentSave();
    if (!json) {
      alert('没有可导出的存档。');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tavern_save_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Security warning */}
      <div className="panel p-3 border-[var(--color-tavern-danger)]">
        <div className="text-sm text-danger mb-1">安全提醒</div>
        <div className="text-xs text-muted">
          这是纯前端项目，API Key 保存在浏览器中存在泄露风险。仅建议个人自用，请勿在公用设备上使用 local 模式。<br />
          部分模型 API 可能因 CORS 限制不允许浏览器直连。如遇请求失败，请检查 API 服务商是否支持浏览器端调用。
        </div>
      </div>

      {/* API Settings */}
      <div className="panel p-3 space-y-3">
        <div className="panel-header">API 设置</div>
        <div>
          <label className="block text-xs text-muted mb-1">API Base URL</label>
          <input className="input text-sm" value={settings.apiBaseUrl} onChange={e => settings.setApiBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Model Name</label>
          <input className="input text-sm" value={settings.apiModel} onChange={e => settings.setApiModel(e.target.value)} placeholder="gpt-4o" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">API Key</label>
          <div className="flex gap-2">
            {showKeyInput ? (
              <input className="input text-sm flex-1" type="password" value={settings.apiKey} onChange={e => settings.setApiKey(e.target.value)} placeholder="sk-..." />
            ) : (
              <input className="input text-sm flex-1" type="password" value={settings.apiKey} onChange={e => settings.setApiKey(e.target.value)} placeholder={settings.apiKey ? maskApiKey(settings.apiKey) : 'sk-...'} />
            )}
            <button className="btn text-xs" onClick={() => setShowKeyInput(!showKeyInput)}>
              {showKeyInput ? '隐藏' : '显示'}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Key 保存方式</label>
          <select className="input text-sm" value={settings.keyStorage} onChange={e => settings.setKeyStorage(e.target.value as KeyStorage)}>
            <option value="none">none — 仅内存，刷新后丢失</option>
            <option value="session">session — sessionStorage，关浏览器清空</option>
            <option value="local">local — localStorage（泄露风险）</option>
          </select>
          {settings.keyStorage === 'local' && (
            <div className="text-xs text-danger mt-1">当前使用 local 模式，API Key 将持久保存在浏览器中。</div>
          )}
        </div>

        <div>
          <button className="btn text-sm" onClick={settings.testConnection} disabled={settings.isTesting || !settings.apiKey}>
            {settings.isTesting ? '测试中...' : '测试连接'}
          </button>
          {settings.testResult && (
            <div className={`text-xs mt-1 ${settings.testResult.ok ? 'text-success' : 'text-danger'}`}>
              {settings.testResult.ok ? '✓' : '✗'} {settings.testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Gameplay Settings */}
      <div className="panel p-3 space-y-3">
        <div className="panel-header">游戏设置</div>

        <div>
          <label className="block text-xs text-muted mb-1">选项模式（Option Mode）</label>
          <select className="input text-sm" value={settings.optionMode || 'ai_options'} onChange={e => settings.setOptionMode(e.target.value as any)}>
            <option value="ai_options">AI 生成全部剧情和选项</option>
            <option value="manual_options" disabled>手写事件选项（后续版本）</option>
            <option value="hybrid" disabled>混合模式（后续版本）</option>
          </select>
          <div className="text-xs text-muted mt-1">当前仅支持 AI 生成全部选项。manual/hybrid 模式在后续版本中开放。</div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <label className="text-xs text-muted">JSON Mode（强制 AI 输出 JSON）</label>
          <input type="checkbox" checked={settings.useJsonMode || false} onChange={e => settings.setUseJsonMode(e.target.checked)} />
        </div>
        <div className="text-xs text-muted mt-1">部分 API 支持 response_format: json_object。开启后减少 JSON 格式错误。DeepSeek 目前不支持此功能，建议关闭。</div>
      </div>

      {/* Custom GM Rules */}
      <div className="panel p-3 space-y-2">
        <div className="panel-header">自定义 GM 提示词</div>
        <textarea
          className="input h-20 resize-none text-xs"
          value={settings.customGMRules || ''}
          onChange={e => settings.setCustomGMRules(e.target.value)}
          placeholder="例：剧情侧重调查和解谜，减少战斗。NPC对话多给线索。"
          maxLength={600}
        />
        <div className="text-xs text-muted">{(settings.customGMRules || '').length}/600 字 · 只影响叙事倾向，不改变系统规则</div>
        <div className="flex flex-wrap gap-1">
          {GM_PRESETS.map(p => (
            <button key={p.label} className="btn text-xs py-1 px-2"
              onClick={() => settings.setCustomGMRules((settings.customGMRules ? settings.customGMRules + ' ' : '') + p.prompt)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save management */}
      <div className="panel p-3">
        <div className="panel-header">存档管理</div>
        {(() => {
          const info = game.getSavedGameInfo();
          return info ? (
            <div className="text-xs text-muted mt-2 mb-2">
              存档时间：{new Date(info.savedAt).toLocaleString('zh-CN')}<br />
              角色：{info.playerName} Lv.{info.level}
            </div>
          ) : (
            <div className="text-xs text-muted mt-2 mb-2">暂无存档</div>
          );
        })()}
        <div className="flex gap-2">
          <button className="btn text-xs" onClick={handleSave}>保存游戏</button>
          <button className="btn text-xs" onClick={handleExportSave}>导出存档</button>
          <button className="btn btn-danger text-xs" onClick={handleDeleteSave}>删除存档</button>
        </div>
      </div>

      {/* Back button — sticky at bottom */}
      {onBack && (
        <div className="sticky bottom-0 pt-4 pb-2 space-y-2" style={{ background: 'var(--color-tavern-bg)' }}>
          <button className="btn w-full py-3 text-base" onClick={onBack}>返回游戏</button>
          <button className="btn w-full py-3 text-base" style={{ borderColor: 'var(--color-tavern-danger)' }}
            onClick={() => {
              if (confirm('返回主菜单将丢失未保存的进度。确定要返回吗？')) {
                game.setPhase('start');
              }
            }}
          >
            返回主菜单
          </button>
        </div>
      )}
    </div>
  );
}
