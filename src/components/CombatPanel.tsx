import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { CombatAction, CombatState } from '../types/combat';
import { parseCombatCustomAction } from '../services/combat/combatRules';
import { validateCombatCustomAction } from '../services/customActionGuard';
import { getSkillById, SKILL_LIBRARY } from '../data/skills';
import { canCastSkill, getSkillLockReasons } from '../utils/skillRules';
import { sendPlayerAction } from '../services/aiService';
import { useSettingsStore } from '../store/settingsStore';
import { applyAIResponse } from '../services/gameEngine';

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

  // Combat stats display: DEX vs DEX for hit, STR for damage
  const playerDex = player.attributes.dex;
  const enemyDex = aliveEnemies[0]?.dex || 0;
  const atkMod = playerDex >= 9 ? 4 : playerDex >= 8 ? 3 : playerDex >= 7 ? 2 : playerDex >= 6 ? 1 : playerDex >= 5 ? 0 : playerDex >= 4 ? -1 : -2;
  const defMod = enemyDex >= 9 ? 4 : enemyDex >= 8 ? 3 : enemyDex >= 7 ? 2 : enemyDex >= 6 ? 1 : enemyDex >= 5 ? 0 : enemyDex >= 4 ? -1 : -2;
  const hitTarget = 10 + defMod;
  const dmgBase = 2 + (player.attributes.str >= 9 ? 4 : player.attributes.str >= 8 ? 3 : player.attributes.str >= 7 ? 2 : player.attributes.str >= 6 ? 1 : player.attributes.str >= 5 ? 0 : player.attributes.str >= 4 ? -1 : -2);

  // Victory/Defeat/Fled: dismiss immediately, AI narrative in background
  const handleDismiss = () => {
    const s = useGameStore.getState();
    // Dismiss right away
    s.dismissCombat();
    // AI narrative in background
    if (phase !== 'fighting') {
      const summary = phase === 'victory'
        ? `战斗胜利！${s.player?.name}击败了${combatState.enemies.map(e => e.name).join('、')}。请生成一段战斗结束后的过渡剧情。`
        : phase === 'defeat'
          ? `玩家被击败了，HP剩余${s.player?.resources.hp}。请生成一段战败后的过渡剧情。`
          : `玩家逃离了战斗。请生成一段逃跑后的过渡剧情。`;
      const settings = useSettingsStore.getState();
      if (settings.aiMode !== 'mock') {
        sendPlayerAction(
          s.player!, { ...s.worldState, combatState: { active: false, phase: 'fighting', round: 0, turn: 'player' as const, enemies: [], playerBuffs: [], combatLog: [] }, combatCooldown: 4 },
          { id: 'cb_end', type: 'other', risk: 'low', mpCost: 0, isCustom: true, customText: summary },
          { outcome: '成功', roll: 0, dc: 0, modifier: 0, notes: '' },
          s.logs, s.eventHistory, { ...settings, customGMRules: settings.customGMRules },
        ).then(r => {
          if (r.success && r.response) {
            r.response.combatStart = undefined;
            r.response.enemy = undefined;
            const st = useGameStore.getState();
            const eng = applyAIResponse(r.response, st.player!, { ...st.worldState, combatCooldown: 4 }, st.logs);
            useGameStore.setState({ player: eng.player, worldState: { ...eng.worldState, combatCooldown: 4 }, currentEvent: r.response, eventHistory: [...st.eventHistory, r.response], logs: eng.logs, isProcessing: false });
          }
        }).catch(() => {});
      }
    }
  };

  return (
    <div className="border-2 border-[#c94040] bg-[#1a0a0a] shadow-lg shadow-[#c94040]/20 p-3 space-y-3 overflow-auto max-h-full flex-shrink-0" style={{minHeight: '200px'}}>
      {/* === Turn + Player Bar (compact) === */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          {phase === 'fighting' && combatState.turn === 'player' && (
            <span className="text-sm lg:text-base font-bold text-info">⚔ 你的回合</span>
          )}
          {phase === 'fighting' && combatState.turn === 'enemy' && (
            <span className="text-sm lg:text-base font-bold text-muted">⏳ 敌人行动中</span>
          )}
          {phase !== 'fighting' && (
            <span className={`text-sm lg:text-base font-bold ${phase === 'victory' ? 'text-success' : 'text-danger'}`}>
              {phase === 'victory' ? '⚔ 战斗胜利！' : phase === 'defeat' ? '你被击败了...' : '脱离了战斗'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span>{player.name} Lv.{player.level}</span>
          <span className="text-danger">HP {player.resources.hp}/{player.resources.maxHp}</span>
          <span className="text-info">MP {player.resources.mp}/{player.resources.maxMp}</span>
          {statusText.length > 0 && (
            <span className="text-warning">{statusText.map(s => s === '疲劳' ? '疲劳(判定-1,酒馆休息解除)' : s).join(' ')}</span>
          )}
        </div>
      </div>

      {/* Combat formula hint (compact) */}
      {phase === 'fighting' && aliveEnemies.length > 0 && (
        <div className="text-xs text-muted text-center">
          攻击判定：d20+敏{atkMod>=0?'+':''}{atkMod} vs AC{hitTarget} · 伤害：{dmgBase}~{dmgBase+4}
        </div>
      )}

      {/* === Combat Log (primary dice display) === */}
      <div className="h-32 lg:h-36 overflow-auto p-3 bg-black/60 rounded border border-[#c94040] text-sm lg:text-base space-y-1.5">
        {combatState.combatLog.length === 0 && <div className="text-muted text-center">等待战斗开始...</div>}
        {combatState.combatLog.slice(-6).map(log => (
          <div key={log.id} className={`${log.type === 'action' ? 'text-info' : log.type === 'enemy' ? 'text-danger' : log.type === 'reward' ? 'text-success' : 'text-muted'}`}>
            {log.type === 'action' ? '🎲 ' : log.type === 'enemy' ? '💢 ' : ''}{log.text}
          </div>
        ))}
      </div>

      {/* === Enemy cards === */}
      <div className="grid grid-cols-2 gap-2">
        {combatState.enemies.map(enemy => {
          const eHpPct = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0;
          const isSelected = selectedTarget === enemy.id;
          return (
            <div key={enemy.id} className={`p-2 rounded border text-xs lg:text-sm cursor-pointer transition-all ${
              enemy.isDefeated ? 'border-gray-700 opacity-40 bg-black/20' :
              isSelected ? 'border-[#c94040] bg-[#2a0a0a]' :
              'border-[#c94040]/40 hover:border-[#c94040] bg-black/30'
            }`} onClick={() => !enemy.isDefeated && setSelectedTarget(enemy.id)}>
              <div className="flex justify-between font-bold">
                <span>{enemy.name}{enemy.isBoss ? <span className="text-danger ml-1">BOSS</span> : ''}</span>
                <span className="text-muted">Lv.{enemy.level} AC{10 + (enemy.dex>=9?4:enemy.dex>=8?3:enemy.dex>=7?2:enemy.dex>=6?1:enemy.dex>=5?0:enemy.dex>=4?-1:-2)}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-danger text-xs">HP</span>
                <div className="flex-1 h-2 bg-black/50 rounded overflow-hidden">
                  <div className={`h-full ${enemy.isDefeated ? 'bg-gray-600' : eHpPct<30 ? 'bg-red-600' : 'bg-orange-600'}`} style={{width:`${eHpPct}%`}}/>
                </div>
                <span className="text-xs">{enemy.hp}/{enemy.maxHp}</span>
              </div>
              {enemy.isDefeated && <div className="text-xs text-muted mt-1">☠ 已击败</div>}
            </div>
          );
        })}
      </div>

      {/* === Actions or End Screen === */}
      {phase === 'fighting' ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {actions.map((a, i) => {
              let tip = '';
              if (a.type === 'attack') tip = `d20+敏${atkMod>=0?'+':''}${atkMod} vs AC${hitTarget} · ${dmgBase}~${dmgBase+4}伤害`;
              else if (a.type === 'skill') tip = '技能攻击（消耗MP）';
              else if (a.type === 'defend') tip = '本回合伤害减半';
              else if (a.type === 'flee') tip = `d20+敏${atkMod>=0?'+':''}${atkMod} vs DC14 逃跑`;
              return (
                <button key={i} className={`btn text-xs lg:text-sm px-2 py-1.5 ${isProcessing || combatState.turn !== 'player' ? 'opacity-50' : ''}`}
                  style={{ borderColor: a.type==='attack'?'#c97a30':a.type==='skill'?'#6b8cce':a.type==='item'?'#5a9e6f':a.type==='defend'?'#8a8a8a':a.type==='flee'?'#c94040':'var(--color-tavern-muted)' }}
                  onClick={() => handleAction(a)} disabled={isProcessing || combatState.turn !== 'player'}
                  title={tip}>
                  {a.label}
                </button>
              );
            })}
          </div>
          {combatState.turn === 'player' && (
            <form className="flex gap-2" onSubmit={e => {
              e.preventDefault();
              const t = customText.trim();
              if (!t) return;
              const g = validateCombatCustomAction(t, player!, combatState);
              if (!g.allowed) { alert(g.reason); setCustomText(''); return; }
              const tid = aliveEnemies[0]?.id;
              if (g.intent==='attack') submitCombatAction({type:'attack',label:'攻击',targetEnemyId:tid});
              else if (g.intent==='defend') submitCombatAction({type:'defend',label:'防御'});
              else if (g.intent==='flee') submitCombatAction({type:'flee',label:'逃跑'});
              else if (g.intent==='observe') submitCombatAction({type:'observe',label:'观察',targetEnemyId:tid});
              else if (g.intent==='item') submitCombatAction({type:'item',label:'治疗药水',itemId:'healing_potion'});
              else if (g.intent==='skill') {
                const f = Object.values(SKILL_LIBRARY).find((s:any)=>s.name&&t.includes(s.name)) as any;
                submitCombatAction({type:'skill',label:f?.name||'技能',skillId:f?.id,targetEnemyId:tid});
              } else {
                submitCombatAction(parseCombatCustomAction(t, player!));
              }
              setCustomText('');
            }}>
              <input className="input text-sm flex-1" placeholder="自定义（攻击/技能/防御/逃跑）" value={customText} onChange={e=>setCustomText(e.target.value)} disabled={isProcessing}/>
              <button className="btn text-sm" disabled={isProcessing}>执行</button>
            </form>
          )}
        </>
      ) : (
        <div className="text-center p-3">
          {phase === 'victory' && combatState.combatLog.filter(l=>l.type==='reward').map((l,i)=>(
            <div key={i} className="text-sm text-success">{l.text}</div>
          ))}
          <button className="btn text-sm mt-3" onClick={handleDismiss}>继续冒险</button>
        </div>
      )}
    </div>
  );
}

// --- helpers (unchanged) ---
function getCombatActions(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>, combatState: CombatState): CombatAction[] {
  const actions: CombatAction[] = [];
  const aliveEnemies = combatState.enemies.filter(e => !e.isDefeated);
  if (aliveEnemies.length > 0) {
    const tid = aliveEnemies[0].id;
    actions.push({ type: 'attack', label: '攻击', targetEnemyId: tid });
    for (const sid of player.skills.equipped) {
      const s = getSkillCombatInfo(sid, player);
      if (!s) continue;
      actions.push({ type: 'skill', label: s.usable ? s.name : `${s.name}(${s.lockReason||'不可用'})`, skillId: sid, targetEnemyId: tid });
    }
  }
  for (const item of player.inventory) {
    if (item.quantity <= 0) continue;
    if (item.id === 'healing_potion') actions.push({ type: 'item', label: `药水(x${item.quantity})`, itemId: item.id });
    if (item.id === 'fire_bomb') actions.push({ type: 'item', label: `燃烧瓶(x${item.quantity})`, itemId: item.id, targetEnemyId: aliveEnemies[0]?.id });
    if (item.id === 'smoke_bomb') actions.push({ type: 'item', label: `烟雾弹(x${item.quantity})`, itemId: item.id });
  }
  actions.push({ type: 'defend', label: '防御' }, { type: 'flee', label: '逃跑' }, { type: 'observe', label: '观察', targetEnemyId: aliveEnemies[0]?.id });
  return actions;
}

function getSkillCombatInfo(sid: string, player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>): { name: string; mpCost: number; hpCost: number; usable: boolean; lockReason?: string } | null {
  const skill = getSkillById(sid);
  if (!skill || !player.skills.learned.includes(sid)) return null;
  if (!['combat', 'magic', 'active', 'reaction'].includes(skill.type)) return null;
  if (!player.skills.equipped.includes(sid)) return { name: skill.name, mpCost: 0, hpCost: 0, usable: false, lockReason: '未装备' };
  const usable = canCastSkill(skill, player);
  const reasons = usable ? [] : getSkillLockReasons(skill, player);
  return { name: skill.name, mpCost: skill.castRequirements.mpCost || 0, hpCost: skill.castRequirements.hpCost || 0, usable, lockReason: reasons.length > 0 ? reasons.join('、') : undefined };
}
