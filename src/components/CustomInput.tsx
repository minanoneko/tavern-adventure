import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function CustomInput() {
  const [input, setInput] = useState('');
  const submitAction = useGameStore(s => s.submitAction);
  const isProcessing = useGameStore(s => s.isProcessing);
  const errorMessage = useGameStore(s => s.errorMessage);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return;
    submitAction('custom', input.trim());
    setInput('');
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="输入行动意图（如：绕到后门看看、调查痕迹、悄悄跟踪、询问NPC...）"
          disabled={isProcessing}
        />
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!input.trim() || isProcessing}>
          行动
        </button>
      </div>
      <div className="text-xs text-muted mt-1">
        可以写：移动/探索、观察/调查、对话/询问、潜行/跟踪、说服/交涉、使用物品、休息。不能写：直接获得金钱/物品/技能、生成NPC/敌人、秒杀、瞬移。
      </div>
      {errorMessage && (
        <div className="text-xs text-danger mt-1">{errorMessage}</div>
      )}
    </div>
  );
}
