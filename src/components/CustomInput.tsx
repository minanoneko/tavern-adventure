import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function CustomInput() {
  const [input, setInput] = useState('');
  const submitAction = useGameStore(s => s.submitAction);
  const isProcessing = useGameStore(s => s.isProcessing);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return;
    submitAction('custom', input.trim());
    setInput('');
  };

  return (
    <div className="flex gap-2">
      <input
        className="input flex-1"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder="输入行动（如：绕到后门看看、调查墙上的痕迹、悄悄跟踪那个人、礼貌询问老板...）"
        disabled={isProcessing}
      />
      <button className="btn btn-primary" onClick={handleSubmit} disabled={!input.trim() || isProcessing}>
        行动
      </button>
    </div>
  );
}
