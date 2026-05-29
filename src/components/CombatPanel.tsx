import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { CombatAction, CombatState } from '../types/combat';
import CombatActionBar from './CombatActionBar';
import { parseCombatCustomAction } from '../services/combat/combatRules';
import { validateCombatCustomAction } from '../services/customActionGuard';

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

  // Build legal actions (simple local generation)
  const actions = getCombatActions(player, combatState);

  const handleAction = (action: CombatAction) => {
    // Auto-select first alive enemy for targeting actions
    if ((action.type === 'attack' || action.type === 'skill' || (action.type === 'item' && action.itemId?.includes('bomb'))) && aliveEnemies.length > 0) {
      action = { ...action, targetEnemyId: selectedTarget || aliveEnemies[0].id };
    }
    submitCombatAction(action);
    setSelectedTarget(null);
  };

  return (
    <div className="panel p-4 mb-4">
      {/* Phase indicator */}
      <div className="text-center mb-3">
        {phase === 'fighting' && combatState.turn === 'player' && (
          <span className="text-info font-bold">你的回合</span>
        )}
        {phase === 'fighting' && combatState.turn === 'enemy' && (
          <span className="text-muted">敌人行动中...</span>
        )}
        {phase === 'victory' && (
          <span className="text-success font-bold text-lg">战斗胜利！</span>
        )}
        {phase === 'defeat' && (
          <span className="text-danger font-bold text-lg">你被击败了...</span>
        )}
        {phase === 'fled' && (
          <span className="text-muted">脱离了战斗</span>
        )}
      </div>

      {/* Player Status Bar */}
      <div className="mb-3 p-2 bg-black/20 rounded">
        <div className="flex justify-between items-center">
          <span className="font-bold">{player.name}</span>
          <span className="text-sm text-muted">Lv.{player.level}</span>
        </div>
        <div className="flex gap-4 mt-1 text-sm">
          <span>
            HP: <span className={player.resources.hp < player.resources.maxHp * 0.3 ? 'text-danger' : 'text-success'}>
              {player.resources.hp}/{player.resources.maxHp}
            </span>
          </span>
          <span>
            MP: <span className={player.resources.mp < 3 ? 'text-muted' : 'text-info'}>
              {player.resources.mp}/{player.resources.maxMp}
            </span>
          </span>
          {player.statusEffects.filter(s => s !== '正常').length > 0 && (
            <span className="text-warning">
              状态: {player.statusEffects.filter(s => s !== '正常').join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* HP Bar */}
      <div className="w-full h-1 bg-black/30 rounded mb-3">
        <div
          className="h-full rounded transition-all duration-300"
          style={{
            width: `${(player.resources.hp / player.resources.maxHp) * 100}%`,
            backgroundColor: player.resources.hp < player.resources.maxHp * 0.3 ? 'var(--color-tavern-danger)' : 'var(--color-tavern-success)',
          }}
        />
      </div>

      {/* Enemy Area */}
      <div className="mb-3">
        {combatState.enemies.map(enemy => (
          <div
            key={enemy.id}
            className={`p-2 mb-2 rounded border ${enemy.isDefeated ? 'opacity-50 border-muted' : selectedTarget === enemy.id ? 'border-info' : 'border-muted'} ${!enemy.isDefeated ? 'cursor-pointer hover:border-info' : ''}`}
            onClick={() => !enemy.isDefeated && setSelectedTarget(enemy.id)}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold">
                {enemy.name}
                {enemy.isBoss && <span className="text-danger ml-1">[BOSS]</span>}
              </span>
              <span className="text-sm text-muted">Lv.{enemy.level}</span>
            </div>
            <div className="text-sm mt-1">
              HP: {enemy.hp}/{enemy.maxHp}
              {enemy.statusEffects.length > 0 && (
                <span className="ml-2 text-muted">[{enemy.statusEffects.join(', ')}]</span>
              )}
            </div>
            {/* Enemy HP Bar */}
            <div className="w-full h-1 bg-black/30 rounded mt-1">
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${(enemy.hp / enemy.maxHp) * 100}%`,
                  backgroundColor: enemy.hp < enemy.maxHp * 0.3 ? '#c94040' : '#c97a30',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Hidden buff display */}
      {combatState.playerBuffs.length > 0 && (
        <div className="text-xs text-muted mb-2">
          增益: {combatState.playerBuffs.map(b => `${b.name}(${b.duration}回合)`).join(', ')}
        </div>
      )}

      {/* Combat Log */}
      <div className="max-h-24 overflow-auto mb-3 p-2 bg-black/20 rounded text-xs">
        {combatState.combatLog.slice(-8).map(log => (
          <div key={log.id} className={
            log.type === 'action' ? 'text-info' :
            log.type === 'enemy' ? 'text-danger' :
            log.type === 'reward' ? 'text-success' :
            log.type === 'system' ? 'text-muted' :
            'text-muted'
          }>
            [{log.round}] {log.text}
          </div>
        ))}
      </div>

      {/* Action Bar or Victory/Defeat screen */}
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
          {/* Custom combat input */}
          {combatState.turn === 'player' && (
            <form
              className="flex gap-2 mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const text = customText.trim();
                if (!text || !player) return;
                const guard = validateCombatCustomAction(text, player, combatState);
                if (!guard.allowed) {
                  alert(guard.reason || '该行动在当前战斗中不被允许。');
                  setCustomText('');
                  return;
                }
                const customAction = parseCombatCustomAction(text, player);
                submitCombatAction(customAction);
                setCustomText('');
              }}
            >
              <input
                className="input text-sm flex-1"
                placeholder="自定义行动（如：召唤帮手、推倒书架...）"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                disabled={isProcessing}
              />
              <button type="submit" className="btn text-sm" disabled={isProcessing || !customText.trim()}>
                执行
              </button>
            </form>
          )}
        </>
      ) : phase === 'victory' ? (
        <div>
          <div className="text-success font-bold text-lg mb-2">战斗胜利！</div>
          <div className="text-sm text-muted mb-2">奖励已结算，查看战斗日志获取详情。</div>
          <button className="btn text-sm" onClick={() => useGameStore.getState().dismissCombat?.()}>
            继续冒险
          </button>
        </div>
      ) : phase === 'defeat' ? (
        <div>
          <div className="text-danger font-bold text-lg mb-2">你被击败了...</div>
          <button className="btn text-sm" onClick={() => useGameStore.getState().dismissCombat?.()}>
            继续冒险
          </button>
        </div>
      ) : (
        <div>
          <div className="text-sm text-muted mb-2">战斗结束。</div>
        </div>
      )}
    </div>
  );
}

/** Generate combat actions locally from player state */
function getCombatActions(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>, combatState: CombatState): CombatAction[] {
  const actions: CombatAction[] = [];
  const aliveEnemies = combatState.enemies.filter(e => !e.isDefeated);

  if (aliveEnemies.length > 0) {
    const targetId = aliveEnemies[0].id;

    actions.push({ type: 'attack', label: '普通攻击', targetEnemyId: targetId });

    // Combat skills
    for (const sid of player.skills.learned) {
      const skill = getSkillCombatInfo(sid, player);
      if (skill) {
        const mpOk = (skill.mpCost || 0) <= player.resources.mp;
        const label = mpOk ? skill.name : `${skill.name}(MP不足)`;
        actions.push({ type: 'skill', label, skillId: sid, targetEnemyId: targetId });
      }
    }
  }

  // Combat items
  for (const item of player.inventory) {
    if (item.quantity <= 0) continue;
    if (item.id === 'healing_potion') {
      actions.push({ type: 'item', label: `治疗药水(x${item.quantity})`, itemId: item.id });
    }
    if (item.id === 'fire_bomb') {
      actions.push({ type: 'item', label: `燃烧瓶(x${item.quantity})`, itemId: item.id, targetEnemyId: aliveEnemies[0]?.id });
    }
    if (item.id === 'smoke_bomb') {
      actions.push({ type: 'item', label: `烟雾弹(x${item.quantity})`, itemId: item.id });
    }
  }

  actions.push({ type: 'defend', label: '防御' });
  actions.push({ type: 'flee', label: '逃跑' });
  actions.push({ type: 'observe', label: '观察敌人', targetEnemyId: aliveEnemies[0]?.id });

  return actions;
}

function getSkillCombatInfo(sid: string, player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>): { name: string; mpCost: number } | null {
  // Simple version — check if skill is combat-type and learned
  const combatSkills = ['heavy_strike', 'backstab', 'silver_blade', 'smash', 'throw_bottle', 'duel_footwork', 'fire_arrow', 'frost_bind', 'armor_break', 'poison_blade', 'precise_shot'];
  const magicSkills = ['spark', 'fire_arrow', 'frost_bind', 'mana_blast', 'dispel_weak_evil', 'blessing'];
  const allCombat = [...combatSkills, ...magicSkills, 'inspire', 'rage'];

  if (!player.skills.learned.includes(sid)) return null;
  if (!allCombat.includes(sid)) return null;

  // Simple MP costs
  const mpCosts: Record<string, number> = {
    heavy_strike: 3, backstab: 0, silver_blade: 0, smash: 0, throw_bottle: 0,
    duel_footwork: 0, spark: 2, fire_arrow: 4, frost_bind: 5, mana_blast: 15,
    dispel_weak_evil: 5, blessing: 3, inspire: 3, rage: 0, armor_break: 3,
    poison_blade: 3, precise_shot: 0,
  };

  return { name: getSkillName(sid), mpCost: mpCosts[sid] || 0 };
}

function getSkillName(sid: string): string {
  const names: Record<string, string> = {
    heavy_strike: '重击', backstab: '背刺', silver_blade: '银刃技巧', smash: '猛砸',
    throw_bottle: '投掷瓶', duel_footwork: '决斗步法', spark: '火苗术', fire_arrow: '火焰箭',
    frost_bind: '寒霜束缚', mana_blast: '魔力爆破', dispel_weak_evil: '驱散微弱邪祟',
    blessing: '祝福', inspire: '鼓舞', rage: '狂暴', armor_break: '破甲斩',
    poison_blade: '毒刃', precise_shot: '精准射击',
  };
  return names[sid] || sid;
}
