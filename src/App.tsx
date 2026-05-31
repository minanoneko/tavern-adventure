import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { getLongTermSummary, getGameFlags } from './services/memoryService';
import { saveGame } from './services/saveService';
import StartPage from './components/StartPage';
import CharacterCreate from './components/CharacterCreate';
import GamePage from './components/GamePage';
import FantasyBackdrop from './components/FantasyBackdrop';

function App() {
  const phase = useGameStore(s => s.phase);

  // Auto-save on page close / mobile browser exit
  useEffect(() => {
    const persistCurrentGame = () => {
      const state = useGameStore.getState();
      if (state.phase === 'game' && state.player) {
        const summary = getLongTermSummary();
        const flags = getGameFlags();
        saveGame(
          state.player, state.worldState, state.currentEvent,
          state.eventHistory, state.logs, summary, flags,
        );
      }
    };

    const handleVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      document.documentElement.classList.toggle('app-page-hidden', hidden);
      if (hidden) persistCurrentGame();
    };

    const handlePageHide = () => {
      document.documentElement.classList.add('app-page-hidden');
      persistCurrentGame();
    };

    const handlePageShow = () => {
      document.documentElement.classList.remove('app-page-hidden');
    };

    window.addEventListener('beforeunload', persistCurrentGame);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', persistCurrentGame);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="fantasy-shell h-full w-full text-[var(--color-tavern-text)]">
      <FantasyBackdrop />
      <div className="relative z-10 h-full w-full">
        {phase === 'start' && <StartPage />}
        {phase === 'create' && <CharacterCreate />}
        {phase === 'game' && <GamePage />}
      </div>
    </div>
  );
}

export default App;
