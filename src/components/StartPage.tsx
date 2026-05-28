import { useGameStore } from '../store/gameStore';
import { useState, useEffect } from 'react';
import SettingsPanel from './SettingsPanel';

export default function StartPage() {
  const [showSettings, setShowSettings] = useState(false);
  const newGame = useGameStore(s => s.newGame);
  const continueGame = useGameStore(s => s.continueGame);
  const hasSavedGame = useGameStore(s => s.hasSavedGame);
  const getSavedGameInfo = useGameStore(s => s.getSavedGameInfo);

  const [saveInfo, setSaveInfo] = useState<ReturnType<typeof getSavedGameInfo>>(null);

  useEffect(() => {
    if (hasSavedGame()) {
      setSaveInfo(getSavedGameInfo());
    }
  }, []);

  if (showSettings) {
    return (
      <div className="fixed inset-0 overflow-y-auto p-4 pt-8" style={{ zIndex: 100 }}>
        <SettingsPanel onBack={() => setShowSettings(false)} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center">
      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-5xl mb-2 tracking-wider" style={{ color: 'var(--color-tavern-accent)', fontFamily: 'var(--font-display)' }}>
          灰鹿酒馆
        </h1>
        <p className="text-lg" style={{ color: 'var(--color-tavern-muted)' }}>
          Gray Deer Tavern — 奇幻冒险器
        </p>
      </div>

      {/* Menu buttons */}
      <div className="flex flex-col gap-4 w-72">
        <button className="btn btn-primary text-lg py-4" onClick={newGame}>
          新游戏
        </button>
        <button
          className="btn text-lg py-4"
          disabled={!hasSavedGame()}
          onClick={() => continueGame()}
        >
          继续游戏
          {saveInfo && (
            <span className="block text-xs text-muted mt-1">
              {saveInfo.playerName} Lv.{saveInfo.level}
            </span>
          )}
        </button>
        <button className="btn text-lg py-4" onClick={() => setShowSettings(true)}>
          设置
        </button>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-xs text-muted">
        纯前端项目 · Mock AI 模式可直接游玩 · 个人自用
      </div>
    </div>
  );
}
