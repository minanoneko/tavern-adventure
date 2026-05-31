import { useState } from 'react';
import StatusBar from './StatusBar';
import CharacterPanel from './CharacterPanel';
import AdventureWindow from './AdventureWindow';
import TabContainer from './TabContainer';
import LevelUpModal from './LevelUpModal';
import SettingsPanel from './SettingsPanel';
import DebugPanel from './DebugPanel';
import CombatPanel from './CombatPanel';
import { useGameStore } from '../store/gameStore';

type MobilePanel = 'none' | 'character' | 'tabs';

export default function GamePage() {
  const didLevelUp = useGameStore(s => s.didLevelUp);
  const combatState = useGameStore(s => s.worldState.combatState);
  const combatActive = combatState.active || combatState.phase === 'victory' || combatState.phase === 'defeat' || combatState.phase === 'fled';
  const [showSettings, setShowSettings] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('none');
  const [mobileTab, setMobileTab] = useState<string>('quest');

  if (showSettings) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-2 panel">
          <span className="text-sm text-muted">设置</span>
          <button className="btn text-sm" onClick={() => setShowSettings(false)}>返回游戏</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <SettingsPanel inGame onBack={() => setShowSettings(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top: Status Bar */}
      <StatusBar onSettingsClick={() => setShowSettings(true)} />

      {/* Middle: Main Layout */}
      <div className="game-layout flex-1 flex overflow-hidden relative">
        {/* Left: Character Panel — hidden during combat */}
        {!combatActive && <div className="game-side-panel hidden lg:block w-64 flex-shrink-0 overflow-auto border-r border-[var(--color-tavern-border)]">
          <CharacterPanel />
        </div>}

        {/* Mobile left overlay */}
        {mobilePanel === 'character' && (
          <div className="lg:hidden fixed inset-0 z-30 flex">
            <div className="flex-1 bg-black/50" onClick={() => setMobilePanel('none')} />
            <div className="w-[86vw] max-w-80 h-full overflow-auto panel border-l border-[var(--color-tavern-border)]">
              <div className="flex justify-between items-center p-2 border-b border-[var(--color-tavern-border)]">
                <span className="text-sm text-muted">角色</span>
                <button className="btn text-xs" onClick={() => setMobilePanel('none')}>关闭</button>
              </div>
              <CharacterPanel />
            </div>
          </div>
        )}

        {/* Center: Adventure Window */}
        <div className="game-main-panel flex-1 flex flex-col overflow-hidden min-w-0">
          <CombatPanel />
          {!combatActive && <AdventureWindow />}
        </div>

        {/* Right: Tab Container — hidden during combat */}
        {!combatActive && <div className="game-side-panel hidden lg:block w-80 flex-shrink-0 overflow-hidden border-l border-[var(--color-tavern-border)]">
          <TabContainer />
        </div>}

        {/* Mobile right overlay */}
        {mobilePanel === 'tabs' && (
          <div className="lg:hidden fixed inset-0 z-30 flex justify-end">
            <div className="flex-1 bg-black/50" onClick={() => setMobilePanel('none')} />
            <div className="w-[92vw] max-w-96 h-full overflow-hidden flex flex-col panel border-l border-[var(--color-tavern-border)]">
              <div className="flex justify-between items-center p-2 border-b border-[var(--color-tavern-border)]">
                <span className="text-sm text-muted">面板</span>
                <button className="btn text-xs" onClick={() => setMobilePanel('none')}>关闭</button>
              </div>
              <div className="flex-1 overflow-hidden">
                <TabContainer initialTab={mobileTab} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="mobile-bottom-nav lg:hidden grid grid-cols-5 border-t border-[var(--color-tavern-border)] bg-[var(--color-tavern-panel)]">
        <button
          className={`py-2.5 text-sm flex items-center justify-center ${mobilePanel === 'character' ? 'text-[var(--color-tavern-accent)]' : 'text-muted'}`}
          onClick={() => setMobilePanel(mobilePanel === 'character' ? 'none' : 'character')}
        >
          <span>角色</span>
        </button>
        <button
          className="py-2.5 text-sm flex items-center justify-center text-[var(--color-tavern-accent)]"
          onClick={() => setMobilePanel('none')}
        >
          <span>冒险</span>
        </button>
        <button
          className={`py-2.5 text-sm flex items-center justify-center ${mobilePanel === 'tabs' && mobileTab === 'log' ? 'text-[var(--color-tavern-accent)]' : 'text-muted'}`}
          onClick={() => { setMobileTab('log'); setMobilePanel('tabs'); }}
        >
          <span>日志</span>
        </button>
        <button
          className={`py-2.5 text-sm flex items-center justify-center ${mobilePanel === 'tabs' && mobileTab === 'inventory' ? 'text-[var(--color-tavern-accent)]' : 'text-muted'}`}
          onClick={() => { setMobileTab('inventory'); setMobilePanel('tabs'); }}
        >
          <span>背包</span>
        </button>
        <button
          className={`py-2.5 text-sm flex items-center justify-center ${mobilePanel === 'tabs' && mobileTab === 'relation' ? 'text-[var(--color-tavern-accent)]' : 'text-muted'}`}
          onClick={() => { setMobileTab('relation'); setMobilePanel('tabs'); }}
        >
          <span>人物</span>
        </button>
      </div>

      {/* Level Up Modal */}
      {didLevelUp && <LevelUpModal />}

      {/* Debug Panel */}
      <DebugPanel />
    </div>
  );
}
