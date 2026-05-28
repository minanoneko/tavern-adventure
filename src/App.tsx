import { useGameStore } from './store/gameStore';
import StartPage from './components/StartPage';
import CharacterCreate from './components/CharacterCreate';
import GamePage from './components/GamePage';

function App() {
  const phase = useGameStore(s => s.phase);

  return (
    <div className="h-full w-full bg-[var(--color-tavern-bg)] text-[var(--color-tavern-text)]">
      {phase === 'start' && <StartPage />}
      {phase === 'create' && <CharacterCreate />}
      {phase === 'game' && <GamePage />}
    </div>
  );
}

export default App;
