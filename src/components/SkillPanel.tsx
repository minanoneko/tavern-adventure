import { useGameStore } from '../store/gameStore';
import { getAllSkillInfos } from '../utils/skillRules';
import { getSkillById } from '../data/skills';

const TYPE_LABELS: Record<string, string> = {
  active: '主动', passive: '被动', reaction: '反应', exploration: '探索',
  social: '社交', hidden: '隐藏', combat: '战斗', magic: '魔法', class: '职业', equipment: '装备',
};

export default function SkillPanel() {
  const player = useGameStore(s => s.player);
  const worldState = useGameStore(s => s.worldState);
  if (!player) return null;

  const skillInfos = getAllSkillInfos(player, worldState.currentLocation);
  const allSkillIds = [...player.skills.learned, ...player.skills.discovered];

  return (
    <div className="p-3 space-y-2">
      {allSkillIds.length === 0 && (
        <div className="text-sm text-muted p-3">尚未发现任何技能。冒险中可能会学到新的技能。</div>
      )}

      <div className="space-y-2">
        {allSkillIds.map(skillId => {
          const skill = getSkillById(skillId);
          const info = skillInfos.find(s => s.skillId === skillId);
          if (!skill) return null;

          const isLearned = player.skills.learned.includes(skillId);

          return (
            <div key={skillId} className="panel p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-base font-bold" style={{ color: isLearned ? 'var(--color-tavern-accent)' : 'var(--color-tavern-text)' }}>
                  {skill.name}
                </span>
                <span className={`tag text-xs ${info?.status === 'castable' ? '' : info?.status === 'learned_locked' ? 'tag-cursed' : info?.status === 'learnable' ? 'tag-rare' : 'tag-common'}`}>
                  {info?.status === 'castable' ? '可释放' :
                   info?.status === 'learned_locked' ? '不可释放' :
                   info?.status === 'learnable' ? '可学习' :
                   info?.status === 'not_learnable' ? '暂不可学' : '未发现'}
                </span>
              </div>
              <div className="text-muted text-xs">{skill.description}</div>
              <div className="flex gap-1 mt-2 flex-wrap text-xs">
                <span className="tag tag-common">{TYPE_LABELS[skill.type] || skill.type}</span>
                {(skill.castRequirements.mpCost ?? 0) > 0 && <span className="tag tag-common">MP {skill.castRequirements.mpCost}</span>}
                {(skill.castRequirements.hpCost ?? 0) > 0 && <span className="tag tag-common">HP {skill.castRequirements.hpCost}</span>}
                {skill.castRequirements.requiresWeaponType && <span className="tag tag-common">需{skill.castRequirements.requiresWeaponType}</span>}
              </div>
              {/* Lock reasons */}
              {info && info.lockReasons.length > 0 && (
                <div className="mt-2 text-xs">
                  {info.lockReasons.map((reason, i) => (
                    <div key={i} className="text-danger">• {reason}</div>
                  ))}
                </div>
              )}
              {/* Learn requirements */}
              {!isLearned && skill.learnRequirements && (
                <div className="text-muted mt-1 text-xs">
                  学习要求：
                  {skill.learnRequirements.minLevel ? `Lv.${skill.learnRequirements.minLevel}` : ''}
                  {skill.learnRequirements.attributes ? Object.entries(skill.learnRequirements.attributes).map(([k, v]) => {
                    const labels: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
                    return ` ${labels[k] || k}≥${v}`;
                  }).join('') : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
