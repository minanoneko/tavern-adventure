import type { Race, PersonalityTrait } from '../types';

// ========== Races ==========
export const RACES: Race[] = [
  {
    id: 'human',
    name: '人类',
    description: '适应力最强的种族，广泛分布于各个国度。没有突出的天赋，但也没有明显的短板。',
    attributeBonus: {},
  },
  {
    id: 'elf',
    name: '精灵',
    description: '古老的长寿种族，天生与自然和魔法亲和。感官敏锐，但体质较为纤弱。',
    attributeBonus: { dex: 1, int: 1, wis: 1, con: -1 },
  },
  {
    id: 'dwarf',
    name: '矮人',
    description: '矿山和锻造的专家，身体强壮，对魔法态度保守。',
    attributeBonus: { str: 1, con: 2, int: -1, cha: -1 },
  },
  {
    id: 'orc',
    name: '兽人',
    description: '强悍的战斗种族，崇尚力量与荣耀。体格过人，但社交手段较为直接。',
    attributeBonus: { str: 2, con: 1, int: -1, cha: -1 },
  },
  {
    id: 'halfling',
    name: '半身人',
    description: '小巧灵活的种族，以敏锐的运气和亲和力著称。不适合正面冲突。',
    attributeBonus: { dex: 2, cha: 1, str: -1 },
  },
  {
    id: 'demon_blood',
    name: '魔族混血',
    description: '身负魔族血脉，魔力感知异常敏锐。但往往被社会排斥。',
    attributeBonus: { int: 2, cha: 1, wis: -1 },
  },
  {
    id: 'dragonborn',
    name: '龙裔',
    description: '远古龙族后裔，体内流淌着龙血。身体素质全面，但骄傲的本性让社交带有距离感。',
    attributeBonus: { str: 1, con: 1, cha: 1, dex: -1 },
  },
  {
    id: 'custom',
    name: '自定义',
    description: '你自己定义的血脉，属性自由分配。',
    attributeBonus: {},
  },
];

export function getRaceById(id: string): Race | undefined {
  return RACES.find(r => r.id === id);
}

// ========== Personality Traits ==========
export const PERSONALITY_TRAITS: PersonalityTrait[] = [
  { id: 'cautious', name: '谨慎', description: '行动前三思，不轻易涉险。' },
  { id: 'greedy', name: '贪财', description: '对金钱有敏锐的嗅觉，不会拒绝任何赚钱的机会。' },
  { id: 'curious', name: '好奇', description: '对未知充满探索欲，即使危险也忍不住想一探究竟。' },
  { id: 'impulsive', name: '冲动', description: '想到就做，不习惯在行动前权衡太久。' },
  { id: 'calm', name: '冷静', description: '泰山崩于前而色不变，危机中仍能做出理性判断。' },
  { id: 'tsundere', name: '嘴硬心软', description: '嘴上刻薄，但有人求助时总是第一个出手。' },
  { id: 'suspicious', name: '多疑', description: '不轻易相信任何人，每句话都要琢磨第二层含义。' },
  { id: 'kind', name: '善良', description: '心地柔软，不忍看到他人受苦。' },
  { id: 'cold', name: '冷漠', description: '对大多数人和事都无所谓，不太容易被情绪左右。' },
  { id: 'honorable', name: '荣誉感强', description: '重视承诺和名誉，一旦答应的事情绝不反悔。' },
  { id: 'adventurous', name: '喜欢冒险', description: '安稳的生活令人窒息，冒险本身就是意义。' },
  { id: 'trouble_averse', name: '害怕麻烦', description: '能不淌的浑水尽量不淌，但被卷进去也不会逃避。' },
];

export function getTraitById(id: string): PersonalityTrait | undefined {
  return PERSONALITY_TRAITS.find(t => t.id === id);
}
