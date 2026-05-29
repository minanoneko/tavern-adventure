import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { CombatAction, CombatState } from '../types/combat';
import CombatActionBar from './CombatActionBar';
import { parseCombatCustomAction } from '../services/combat/combatRules';
import { validateCombatCustomAction } from '../services/customActionGuard';
import { getSkillById, SKILL_LIBRARY } from '../data/skills';
import { canCastSkill, getSkillLockReasons } from '../utils/skillRules';

export default function CombatPanel() {
  const player = useGameStore(s => s.player);
  const combatState = useGameStore(s => s.worldState.combatState);
  const submitCombatAction = useGameStore(s => s.submitCombatAction);
  const isProcessing = useGameStore(s => s.isProcessing);

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');

  const shouldShow = combatState.active || combatState.phase === 'victory' || combatState.phase === 'defeat' || combatState.phase === 'fled';
  if (!player || !shouldShow) return null;

  const aliveEnemies = combatState.enemies.filter(e => !e.isDefeated);
  const phase = combatState.phase;
  const actions = getCombatActions(player, combatState);

  // Extract latest dice roll info from combat log
  const latestAction = [...combatState.combatLog].reverse().find(l => l.type === 'action' || l.type === 'enemy');

  const handleAction = (action: CombatAction) => {
    if ((action.type === 'attack' || action.type === 'skill' || (action.type === 'item' && action.itemId?.includes('bomb'))) && aliveEnemies.length > 0) {
      action = { ...action, targetEnemyId: selectedTarget || aliveEnemies[0].id };
    }
    submitCombatAction(action);
    setSelectedTarget(null);
  };

  const hpPct = (player.resources.hp / player.resources.maxHp) * 100;
  const mpPct = (player.resources.mp / player.resources.maxMp) * 100;
  const statusText = player.statusEffects.filter(s => s !== '正常');

  return (
    <div className="panel p-3 lg:p-4 mb-2 border-2 border-[#c94040] bg-[#1a0a0a]/90 shadow-lg shadow-[#c94040]/20 overflow-auto max-h-full">
      {/* === Turn Indicator === */}
      <div className="text-center mb-3">
        {phase === 'fighting' && combatState.turn === 'player' && (
          <div className="text-base lg:text-lg font-bold text-info">⚔ 你的回合 —— 选择行动</div>
        )}
        {phase === 'fighting' && combatState.turn === 'enemy' && (
          <div className="text-base lg:text-lg font-bold text-muted">⏳ 敌人行动中...</div>
        )}
        {phase === 'victory' && (
          <div className="text-xl font-bold text-success">⚔ 战斗胜利！</div>
        )}
        {phase === 'defeat' && (
          <div className="text-xl font-bold text-danger">你被击败了...</div>
        )}
        {phase === 'fled' && (
          <div className="text-lg font-bold text-muted">脱离了战斗</div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        {/* === Left: Player + Dice === */}
        <div className="flex-shrink-0 lg:w-56 space-y-3">
          {/* Player card */}
          <div className="p-2 bg-black/30 rounded border border-[#c94040]/50">
            <div className="text-sm font-bold">{player.name} <span className="text-muted">Lv.{player.level}</span></div>
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-danger w-6">HP</span>
                <div className="flex-1 h-2 bg-black/50 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-700 to-red-400 transition-all" style={{ width: `${hpPct}%` }} />
                </div>
                <span className="w-16 text-right text-xs">{player.resources.hp}/{player.resources.maxHp}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-info w-6">MP</span>
                <div className="flex-1 h-2 bg-black/50 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-800 to-blue-400 transition-all" style={{ width: `${mpPct}%` }} />
                </div>
                <span className="w-16 text-right text-xs">{player.resources.mp}/{player.resources.maxMp}</span>
              </div>
            </div>
            {statusText.length > 0 && (
              <div className="text-xs mt-1 text-warning">状态: {statusText.join(', ')}</div>
            )}
          </div>

          {/* Dice roll display */}
          {latestAction && (
            <div className="p-3 bg-black/40 rounded border-2 border-[#c94040] text-center">
              <div className="text-xs text-muted mb-1">最近判定</div>
              <div className="text-sm font-bold" style={{ color: latestAction.type === 'enemy' ? 'var(--color-tavern-danger)' : 'var(--color-tavern-info)' }}>
                {latestAction.text}
              </div>
              <div className="text-xs text-muted mt-1">回合 {latestAction.round}</div>
            </div>
          )}

          {/* Buffs */}
          {combatState.playerBuffs.length > 0 && (
            <div className="text-xs text-muted">
              增益: {combatState.playerBuffs.map(b => `${b.name}(${b.duration})`).join(', ')}
            </div>
          )}
        </div>

        {/* === Right: Enemies + Log + Actions === */}
        <div className="flex-1 space-y-3 min-w-0">
          {/* Enemy cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {combatState.enemies.map(enemy => {
              const eHpPct = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0;
              const isSelected = selectedTarget === enemy.id;
              const canSelect = !enemy.isDefeated && phase === 'fighting' && combatState.turn === 'player';
              return (
                <div
                  key={enemy.id}
                  className={`p-2 rounded border cursor-pointer transition-all ${
                    enemy.isDefeated
                      ? 'border-muted opacity-50 bg-black/20'
                      : isSelected
                        ? 'border-[#c94040] border-2 bg-[#2a0a0a]'
                        : canSelect
                          ? 'border-[#c94040]/40 hover:border-[#c94040] bg-black/30'
                          : 'border-[#c94040]/30 bg-black/20'
                  }`}
                  onClick={() => canSelect && setSelectedTarget(enemy.id)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">
                      {enemy.name}
                      {enemy.isBoss && <span className="text-danger ml-1 text-xs">[BOSS]</span>}
                    </span>
                    <span className="text-xs text-muted">Lv.{enemy.level}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <span className="text-danger w-4">HP</span>
                    <div className="flex-1 h-2 bg-black/50 rounded overflow-hidden">
                      <div className={`h-full transition-all ${enemy.isDefeated ? 'bg-gray-600' : eHpPct < 30 ? 'bg-red-600' : 'bg-orange-600'}`} style={{ width: `${eHpPct}%` }} />
                    </div>
                    <span className="w-16 text-right">{enemy.hp}/{enemy.maxHp}</span>
                  </div>
                  {enemy.isDefeated && (
                    <div className="text-xs text-muted mt-1">☠ 已击败</div>
                  )}
                  {!enemy.isDefeated && enemy.statusEffects.length > 0 && (
                    <div className="text-xs text-warning mt-1">{enemy.statusEffects.join(', ')}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Combat Log (last 5) */}
          <div className="max-h-24 overflow-auto p-2 bg-black/40 rounded text-xs space-y-0.5">
            {combatState.combatLog.slice(-5).map(log => (
              <div key={log.id} className={
                log.type === 'action' ? 'text-info' :
                log.type === 'enemy' ? 'text-danger' :
                log.type === 'reward' ? 'text-success' :
                log.type === 'system' ? 'text-muted' : 'text-muted'
              }>
                <span className="text-muted">[R{log.round}]</span> {log.text}
              </div>
            ))}
            {combatState.combatLog.length === 0 && (
              <div className="text-muted">等待战斗开始...</div>
            )}
          </div>

          {/* Actions or Victory/Defeat */}
          {phase === 'fighting' ? (
            <>
              <CombatActionBar
                actions={actions}
                disabled={isProcessing || combatState.turn !== 'player'}
                selectedTarget={selectedTarget}
                onAction={handleAction}
                onTargetSelect={setSelectedTarget}
                enemyIds={aliveEnemies.map(e => e.id)}
              />
              {combatState.turn === 'player' && (
                <form className="flex gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  const text = customText.trim();
                  if (!text || !player) return;
                  const guard = validateCombatCustomAction(text, player, combatState);
                  if (!guard.allowed) {
                    alert(guard.reason || '该行动在当前战斗中不被允许。');
                    setCustomText(''); return;
                  }
                  const tid = aliveEnemies[0]?.id;
                  if (guard.intent === 'attack') { submitCombatAction({ type: 'attack', label: '攻击', targetEnemyId: tid }); }
                  else if (guard.intent === 'defend') { submitCombatAction({ type: 'defend', label: '防御' }); }
                  else if (guard.intent === 'flee') { submitCombatAction({ type: 'flee', label: '逃跑' }); }
                  else if (guard.intent === 'observe') { submitCombatAction({ type: 'observe', label: '观察敌人', targetEnemyId: tid }); }
                  else if (guard.intent === 'item') { submitCombatAction({ type: 'item', label: '治疗药水', itemId: 'healing_potion' }); }
                  else if (guard.intent === 'skill') {
                    const found = Object.values(SKILL_LIBRARY).find((s: any) => s.name && text.includes(s.name)) as any;
                    if (found) { submitCombatAction({ type: 'skill', label: found.name, skillId: found.id, targetEnemyId: tid }); }
                    else { submitCombatAction({ type: 'attack', label: '攻击', targetEnemyId: tid }); }
                  } else {
                    const customAction = parseCombatCustomAction(text, player);
                    submitCombatAction(customAction);
                  }
                  setCustomText('');
                }}>
                  <input className="input text-sm flex-1" placeholder="自定义（攻击/技能/物品/防御/逃跑/观察）..."
                    value={customText} onChange={(e) => setCustomText(e.target.value)} disabled={isProcessing} />
                  <button type="submit" className="btn text-sm" disabled={isProcessing || !customText.trim()}>执行</button>
                </form>
              )}
            </>
          ) : phase === 'victory' ? (
            <div className="text-center p-3">
              <div className="text-success font-bold text-lg mb-2">战斗胜利！</div>
              {combatState.combatLog.filter(l => l.type === 'reward').map((l, i) => (
                <div key={i} className="text-sm text-success mb-1">{l.text}</div>
              ))}
              <button className="btn text-sm mt-2" onClick={() => useGameStore.getState().dismissCombat?.()}>继续冒险</button>
            </div>
          ) : phase === 'defeat' ? (
            <div className="text-center p-3">
              <div className="text-danger font-bold text-lg mb-2">你被击败了...</div>
              {combatState.combatLog.slice(-3).filter(l => l.type === 'system').map((l, i) => (
                <div key={i} className="text-sm text-muted mb-1">{l.text}</div>
              ))}
              <button className="btn text-sm mt-2" onClick={() => useGameStore.getState().dismissCombat?.()}>继续冒险</button>
            </div>
          ) : (
            <div className="text-center p-3">
              <div className="text-sm text-muted">战斗结束。</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Generate combat actions locally from player state */
function getCombatActions(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>, combatState: CombatState): CombatAction[] {
  const actions: CombatAction[] = [];
  const aliveEnemies = combatState.enemies.filter(e => !e.isDefeated);
  if (aliveEnemies.length > 0) {
    const targetId = aliveEnemies[0].id;
    actions.push({ type: 'attack', label: '攻击', targetEnemyId: targetId });
    for (const sid of player.skills.equipped) {
      const skill = getSkillCombatInfo(sid, player);
      if (!skill) continue;
      const name = skill.usable ? skill.name : `${skill.name}(${skill.lockReason || '不可用'})`;
      actions.push({ type: 'skill', label: name, skillId: sid, targetEnemyId: targetId });
    }
  }
  for (const item of player.inventory) {
    if (item.quantity <= 0) continue;
    if (item.id === 'healing_potion') { actions.push({ type: 'item', label: `治疗药水(x${item.quantity})`, itemId: item.id }); }
    if (item.id === 'fire_bomb') { actions.push({ type: 'item', label: `燃烧瓶(x${item.quantity})`, itemId: item.id, targetEnemyId: aliveEnemies[0]?.id }); }
    if (item.id === 'smoke_bomb') { actions.push({ type: 'item', label: `烟雾弹(x${item.quantity})`, itemId: item.id }); }
  }
  actions.push({ type: 'defend', label: '防御' });
  actions.push({ type: 'flee', label: '逃跑' });
  actions.push({ type: 'observe', label: '观察', targetEnemyId: aliveEnemies[0]?.id });
  return actions;
}

function getSkillCombatInfo(sid: string, player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>): { name: string; mpCost: number; hpCost: number; usable: boolean; lockReason?: string } | null {
  const skill = getSkillById(sid);
  if (!skill) return null;
  if (!player.skills.learned.includes(sid)) return null;
  const combatTypes = ['combat', 'magic', 'active', 'reaction'];
  if (!combatTypes.includes(skill.type)) return null;
  if (!player.skills.equipped.includes(sid)) {
    return { name: skill.name, mpCost: 0, hpCost: 0, usable: false, lockReason: '未装备' };
  }
  const usable = canCastSkill(skill, player);
  const reasons = usable ? [] : getSkillLockReasons(skill, player);
  return {
    name: skill.name,
    mpCost: skill.castRequirements.mpCost || 0,
    hpCost: skill.castRequirements.hpCost || 0,
    usable,
    lockReason: reasons.length > 0 ? reasons.join('、') : undefined,
  };
}
