import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { CombatAction, CombatState } from '../types/combat';
import { getSkillById } from '../data/skills';
import { canCastSkill, getSkillLockReasons } from '../utils/skillRules';
import { getWeaponDamageDice } from '../services/combat/weaponDamage';
import { getAttributeModifier } from '../services/combat/dice';

export default function CombatPanel() {
  const player = useGameStore(s => s.player);
  const combatState = useGameStore(s => s.worldState.combatState);
  const submitCombatAction = useGameStore(s => s.submitCombatAction);
  const isProcessing = useGameStore(s => s.isProcessing);

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [skillRoll, setSkillRoll] = useState<{ label: string; value: string; rolling: boolean; caption: string } | null>(null);

  const shouldShow = combatState.active || combatState.phase === 'victory' || combatState.phase === 'defeat' || combatState.phase === 'fled';
  if (!player || !shouldShow) return null;

  const aliveEnemies = combatState.enemies.filter(e => !e.isDefeated);
  const phase = combatState.phase;
  const actions = getCombatActions(player, combatState);

  const playSkillRoll = (action: CombatAction) => {
    const label = action.label || '技能';
    setSkillRoll({ label, value: String(Math.floor(Math.random() * 20) + 1), rolling: true, caption: '技能判定 · d20' });
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setSkillRoll({ label, value: String(Math.floor(Math.random() * 20) + 1), rolling: ticks < 8, caption: '技能判定 · d20' });
      if (ticks >= 8) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          submitCombatAction(action);
          setSelectedTarget(null);
          window.setTimeout(() => {
            const logs = useGameStore.getState().worldState.combatState.combatLog;
            const recentAction = [...logs].reverse().find(log => log.type === 'action' && /d20=(\d+)/.test(log.text));
            const actualRoll = recentAction?.text.match(/d20=(\d+)/)?.[1];
            setSkillRoll({
              label,
              value: actualRoll || '✓',
              rolling: false,
              caption: actualRoll ? '真实判定 · 查看战斗日志' : '技能生效',
            });
          }, 0);
          window.setTimeout(() => setSkillRoll(null), 650);
        }, 180);
      }
    }, 80);
  };

  const handleAction = (action: CombatAction) => {
    if (skillRoll?.rolling) return;
    if ((action.type === 'attack' || action.type === 'skill' || (action.type === 'item' && action.itemId?.includes('bomb'))) && aliveEnemies.length > 0) {
      action = { ...action, targetEnemyId: selectedTarget || aliveEnemies[0].id };
    }
    if (action.type === 'skill') {
      playSkillRoll(action);
      return;
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
  const atkMod = getAttributeModifier(playerDex);
  const defMod = getAttributeModifier(enemyDex);
  const hitTarget = 10 + defMod;
  const weaponDice = getWeaponDamageDice(player.equipment.mainWeapon);
  const strMod = getAttributeModifier(player.attributes.str);
  const dmgMin = 1 + strMod; // minimum damage
  const dmgMax = weaponDice.dice * weaponDice.count + strMod; // max possible damage

  // Victory/Defeat/Fled: just dismiss
  const handleDismiss = () => {
    useGameStore.getState().dismissCombat();
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
          攻击判定：d20+敏{atkMod>=0?'+':''}{atkMod} vs AC{hitTarget} · 伤害：{weaponDice.count}d{weaponDice.dice}+{strMod>=0?'+':''}{strMod}={dmgMin}~{dmgMax}
        </div>
      )}

      {skillRoll && (
        <div className={`dice-roll ${skillRoll.rolling ? 'rolling' : ''}`} aria-live="polite">
          <div className="dice-face">{skillRoll.value}</div>
          <div className="dice-caption">{skillRoll.label} · {skillRoll.caption}</div>
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
                <span className="text-muted">Lv.{enemy.level} AC{10 + getAttributeModifier(enemy.dex)}</span>
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
              if (a.type === 'attack') tip = `d20+敏${atkMod>=0?'+':''}${atkMod} vs AC${hitTarget} · ${weaponDice.count}d${weaponDice.dice}+${strMod>=0?'+':''}${strMod}=${dmgMin}~${dmgMax}伤害`;
              else if (a.type === 'skill') tip = '技能攻击（消耗MP）';
              else if (a.type === 'defend') tip = '本回合伤害减半';
              else if (a.type === 'flee') tip = `d20+敏${atkMod>=0?'+':''}${atkMod} vs DC14 逃跑`;
              return (
                <button key={i} className={`btn text-xs lg:text-sm px-2 py-1.5 ${isProcessing || combatState.turn !== 'player' || skillRoll?.rolling ? 'opacity-50' : ''}`}
                  style={{ borderColor: a.type==='attack'?'#c97a30':a.type==='skill'?'#6b8cce':a.type==='item'?'#5a9e6f':a.type==='defend'?'#8a8a8a':a.type==='flee'?'#c94040':'var(--color-tavern-muted)' }}
                  onClick={() => handleAction(a)} disabled={isProcessing || combatState.turn !== 'player' || !!skillRoll?.rolling}
                  title={tip}>
                  {a.label}
                </button>
              );
            })}
          </div>
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
  actions.push({ type: 'defend', label: '防御' }, { type: 'flee', label: '逃跑' });
  return actions;
}

// Non-combat skills that should NOT appear in combat actions
const NON_COMBAT_SKILLS = new Set([
  'magic_sense', 'read_runes', 'focus_cast', 'tracking', 'wilderness_survival', 'trap_detect',
  'brew_potion', 'identify_herb', 'material_analysis', 'lockpick', 'eavesdrop',
  'history_knowledge', 'ancient_script', 'logic_analysis', 'note_organize',
  'monster_identify', 'curse_resist', 'noble_etiquette', 'negotiation', 'read_people',
  'survival_instinct', 'rumor_gathering', 'performance', 'small_talk', 'soothe',
  'alchemy_craft', 'dual_wield',
]);

function getSkillCombatInfo(sid: string, player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>): { name: string; mpCost: number; hpCost: number; usable: boolean; lockReason?: string } | null {
  const skill = getSkillById(sid);
  if (!skill || !player.skills.learned.includes(sid)) return null;
  if (!['combat', 'magic', 'active', 'reaction'].includes(skill.type)) return null;
  if (NON_COMBAT_SKILLS.has(sid)) return null;
  if (!player.skills.equipped.includes(sid)) return { name: skill.name, mpCost: 0, hpCost: 0, usable: false, lockReason: '未装备' };
  const usable = canCastSkill(skill, player);
  const reasons = usable ? [] : getSkillLockReasons(skill, player);
  return { name: skill.name, mpCost: skill.castRequirements.mpCost || 0, hpCost: skill.castRequirements.hpCost || 0, usable, lockReason: reasons.length > 0 ? reasons.join('、') : undefined };
}
