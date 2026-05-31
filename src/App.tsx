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
    const handleBeforeUnload = () => {
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
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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
