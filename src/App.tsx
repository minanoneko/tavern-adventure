import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { getLongTermSummary, getGameFlags } from './services/memoryService';
import { saveGame } from './services/saveService';
import StartPage from './components/StartPage';
import CharacterCreate from './components/CharacterCreate';
import GamePage from './components/GamePage';

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
    <div className="h-full w-full bg-[var(--color-tavern-bg)] text-[var(--color-tavern-text)]">
      {phase === 'start' && <StartPage />}
      {phase === 'create' && <CharacterCreate />}
      {phase === 'game' && <GamePage />}
    </div>
  );
}

export default App;
