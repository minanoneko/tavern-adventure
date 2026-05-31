import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { RACES } from '../data/races';
import { PERSONALITY_TRAITS } from '../data/races';
import { CLASS_ORIGINS } from '../data/classes';
import { getSkillById } from '../data/skills';
import { getEquipmentById } from '../data/equipment';
import type { CharacterCreationData } from '../types';
import { ATTRIBUTE_LABELS, DEFAULT_ATTRIBUTES, type AttributeKey } from '../types/common';
import type { Attributes } from '../types/common';

type Step = 1 | 2 | 3 | 4;

function buildStartingAttributes(classId: string, raceId: string): Attributes {
  const selectedClass = CLASS_ORIGINS.find(c => c.id === classId);
  const selectedRace = RACES.find(r => r.id === raceId);
  const next = { ...(selectedClass?.attributes || DEFAULT_ATTRIBUTES) };
  if (selectedRace) {
    for (const [key, val] of Object.entries(selectedRace.attributeBonus)) {
      const attr = key as AttributeKey;
      next[attr] = Math.max(1, Math.min(10, (next[attr] || 4) + val));
    }
  }
  return next;
}

function getAgeProfile(age: number): string {
  if (age < 18) return '年轻：更容易冲动和被低估，叙事中应体现阅历较浅。';
  if (age >= 50) return '年长：阅历更深、行事更稳，叙事中应体现经验感。';
  return '成年：状态均衡，叙事中按成熟冒险者处理。';
}

export default function CharacterCreate() {
  const createCharacter = useGameStore(s => s.createCharacter);
  const setPhase = useGameStore(s => s.setPhase);

  const [step, setStep] = useState<Step>(1);

  // Step 1 data
  const [surname, setSurname] = useState('');
  const [givenName, setGivenName] = useState('');
  const fullName = (surname + givenName).trim();
  const [age, setAge] = useState(20);
  const [gender, setGender] = useState('男');
  const [raceId, setRaceId] = useState('human');
  const [traits, setTraits] = useState<string[]>([]);

  // Step 2 data
  const [classId, setClassId] = useState('mage');

  // Step 3 data
  const [attrs, setAttrs] = useState<Attributes>(() => buildStartingAttributes('mage', 'human'));

  // Step 4 data
  const [customOrigin, setCustomOrigin] = useState('');

  const selectedRace = RACES.find(r => r.id === raceId);
  const selectedClass = CLASS_ORIGINS.find(c => c.id === classId);

  const toggleTrait = (id: string) => {
    if (traits.includes(id)) {
      setTraits(traits.filter(t => t !== id));
    } else if (traits.length < 3) {
      setTraits([...traits, id]);
    }
  };

  const applyClassDefaults = (cId: string) => {
    setAttrs(buildStartingAttributes(cId, raceId));
  };

  const handleClassChange = (cId: string) => {
    setClassId(cId);
    applyClassDefaults(cId);
  };

  const handleRaceChange = (rId: string) => {
    setRaceId(rId);
    setAttrs(buildStartingAttributes(classId, rId));
  };

  const classBase = selectedClass ? Object.values(selectedClass.attributes).reduce((a, b) => a + b, 0) : 24;
  const baseline = Object.values(buildStartingAttributes(classId, raceId)).reduce((a, b) => a + b, 0);
  const totalAttrPoints = Object.values(attrs).reduce((a, b) => a + b, 0);
  const availablePoints = 2 + baseline - totalAttrPoints; // 2 free points + any saved from reduced stats

  const adjustAttr = (key: AttributeKey, delta: number) => {
    const newVal = attrs[key] + delta;
    if (newVal < 1 || newVal > 10) return;
    if (delta > 0 && availablePoints <= 0) return;
    setAttrs({ ...attrs, [key]: newVal });
  };

  const handleCreate = () => {
    if (!fullName) return;
    const data: CharacterCreationData = {
      name: fullName,
      age,
      gender,
      raceId,
      classId,
      personalityTraits: traits,
      customOrigin: customOrigin.trim(),
      attributes: attrs,
      remainingAttributePoints: availablePoints,
    };
    createCharacter(data);
  };

  const genderOptions = ['男', '女'];

  return (
    <div className="character-create-page h-full flex justify-center py-6 lg:py-10 px-3 lg:px-6 overflow-y-auto">
      <div className="w-full max-w-3xl pb-20">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {([1, 2, 3, 4] as Step[]).map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border
                ${s === step ? 'border-[var(--color-tavern-accent)] text-[var(--color-tavern-accent)]' :
                  s < step ? 'border-[var(--color-tavern-success)] text-[var(--color-tavern-success)]' :
                    'border-[var(--color-tavern-border)] text-muted'}`}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 4 && <div className="w-8 h-px bg-[var(--color-tavern-border)]" />}
            </div>
          ))}
        </div>

        <h2 className="text-2xl mb-6" style={{ color: 'var(--color-tavern-accent)' }}>
          {step === 1 ? '基础信息' : step === 2 ? '职业开局' : step === 3 ? '属性分配' : '确认角色'}
        </h2>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-muted">姓</label>
                <input className="input" value={surname} onChange={e => setSurname(e.target.value)} placeholder="姓" maxLength={4} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-muted">名</label>
                <input className="input" value={givenName} onChange={e => setGivenName(e.target.value)} placeholder="名" maxLength={8} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-muted">年龄</label>
                <input className="input" type="number" value={age} onChange={e => setAge(Number(e.target.value))} min={14} max={99} />
                <div className="text-xs text-muted mt-1">{getAgeProfile(age)}</div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-muted">性别</label>
                <div className="flex gap-2">
                  {genderOptions.map(g => (
                    <button key={g} className={`btn flex-1 ${gender === g ? 'btn-primary' : ''}`} onClick={() => setGender(g)}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-muted">种族</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                {RACES.map(r => (
                  <button
                    key={r.id}
                    className={`btn text-left ${raceId === r.id ? 'btn-primary' : ''}`}
                    onClick={() => handleRaceChange(r.id)}
                  >
                    <div className="text-sm">{r.name}</div>
                    {r.attributeBonus && Object.keys(r.attributeBonus).length > 0 && (
                      <div className="text-xs text-muted">
                        {Object.entries(r.attributeBonus).map(([k, v]) => `${ATTRIBUTE_LABELS[k as AttributeKey]}${v > 0 ? '+' : ''}${v}`).join(' ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {selectedRace && <p className="text-xs text-muted mt-1">{selectedRace.description}</p>}
            </div>

            <div>
              <label className="block text-sm mb-2 text-muted">性格特征（最多选 3 个）</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                {PERSONALITY_TRAITS.map(t => (
                  <button
                    key={t.id}
                    className={`btn text-sm ${traits.includes(t.id) ? 'btn-primary' : ''}`}
                    onClick={() => toggleTrait(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Class Origin */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {CLASS_ORIGINS.map(c => (
              <button
                key={c.id}
                className={`btn text-left p-4 ${classId === c.id ? 'btn-primary' : ''}`}
                onClick={() => handleClassChange(c.id)}
              >
                <div className="text-base" style={{ color: 'var(--color-tavern-accent)' }}>{c.name}</div>
                <div className="text-xs text-muted mt-1">{c.role}</div>
                <div className="text-xs mt-1">{c.description.slice(0, 40)}...</div>
                <div className="text-xs mt-2 flex gap-2 flex-wrap">
                  {Object.entries(c.attributes).map(([k, v]) => (
                    <span key={k}>{ATTRIBUTE_LABELS[k as AttributeKey]}: {v}</span>
                  ))}
                </div>
                <div className="text-xs text-muted mt-1">
                  技能：{c.skills.length}个 · 初始金钱：{c.money.gold > 0 ? `${c.money.gold}金` : ''}{c.money.silver > 0 ? `${c.money.silver}银` : ''}{c.money.copper}铜
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Attributes */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-sm text-muted mb-4">
              可分配点数：<span style={{ color: 'var(--color-tavern-accent)' }}>{availablePoints}</span>
              （基于{selectedClass?.name}初始值 + {selectedRace?.name}种族修正 + 2 点自由分配）
            </div>
            {ATTRIBUTE_LABELS && Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-4">
                <div className="w-16 text-sm">{label}</div>
                <button className="btn px-3 py-1" onClick={() => adjustAttr(key as AttributeKey, -1)} disabled={attrs[key as AttributeKey] <= 1}>-</button>
                <div className="w-12 text-center text-lg" style={{ color: 'var(--color-tavern-accent)' }}>{attrs[key as AttributeKey]}</div>
                <button className="btn px-3 py-1" onClick={() => adjustAttr(key as AttributeKey, 1)} disabled={availablePoints <= 0 || attrs[key as AttributeKey] >= 10}>+</button>
                <div className="flex-1 h-2 bar-bg">
                  <div className="h-full" style={{
                    background: `linear-gradient(to right, var(--color-tavern-accent), #8a6a30)`,
                    width: `${attrs[key as AttributeKey] * 10}%`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="panel p-4">
              <h3 className="text-lg mb-3" style={{ color: 'var(--color-tavern-accent)' }}>角色确认</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted">姓名：</span>{fullName}</div>
                <div><span className="text-muted">种族：</span>{selectedRace?.name}</div>
                <div><span className="text-muted">年龄：</span>{age}岁</div>
                <div><span className="text-muted">职业：</span>{selectedClass?.name}</div>
                <div><span className="text-muted">性别：</span>{gender}</div>
                <div><span className="text-muted">性格：</span>{traits.map(t => PERSONALITY_TRAITS.find(pt => pt.id === t)?.name).join('、')}</div>
              </div>
              <div className="mt-3">
                <span className="text-muted text-sm">属性：</span>
                <span className="text-sm">
                  {Object.entries(attrs).map(([k, v]) => `${ATTRIBUTE_LABELS[k as AttributeKey]}:${v}`).join(' / ')}
                </span>
              </div>
              <div className="mt-1 text-sm">
                <span className="text-muted">初始技能：</span>
                {selectedClass?.skills.map(s => getSkillById(s)?.name || s).join(' / ')}
              </div>
              <div className="mt-1 text-sm">
                <span className="text-muted">初始装备：</span>
                {selectedClass?.equipment.map(e => getEquipmentById(e)?.name || e).join(' / ')}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-muted">
                自定义开端（可选，将影响 AI 开局剧情）
              </label>
              <textarea
                className="input h-24 resize-none"
                value={customOrigin}
                onChange={e => setCustomOrigin(e.target.value)}
                placeholder="例：我从王都魔法学院退学后，带着一本残缺的魔法笔记来到边境酒馆。"
              />
              <div className="text-xs text-muted mt-2 space-y-1">
                <div>可以写角色过去、传闻、目标、仇家、债务、血脉、遗物等。但当前实力、装备、金钱、技能仍以角色卡为准。</div>
                <div className="mt-1">
                  <span className="text-success">好例子：</span>
                  "我从魔法学院退学，偷带出一本破旧笔记。" / "我曾在北境商队失散，怀疑同伴被人出卖。" / "我带着一枚没人承认的旧王室纹章。"
                </div>
                <div>
                  <span className="text-danger">不建议：</span>
                  "我是大陆最强法神。"（会降格） / "我开局拥有十件神器。"（不会真的给） / "所有贵族都听命于我。"（不会生效）
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary w-full py-3 text-lg"
              disabled={!fullName}
              onClick={handleCreate}
            >
              踏上冒险之路
            </button>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-10">
          {step > 1 ? (
            <button className="btn px-6 py-3" onClick={() => setStep((step - 1) as Step)}>上一步</button>
          ) : (
            <button className="btn px-6 py-3" onClick={() => setPhase('start')}>返回</button>
          )}
          {step < 4 ? (
            <button className="btn btn-primary px-6 py-3" onClick={() => setStep((step + 1) as Step)}
              disabled={step === 1 && !fullName}>
              下一步
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
