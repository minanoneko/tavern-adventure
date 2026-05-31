import type { WorldBroadcast } from '../types';

export const BROADCAST_POOL: WorldBroadcast[] = [
  // ===== 人类联邦 =====
  {
    type: 'economy',
    region: '人类联邦',
    text: '银帆港商船延迟抵达，药草与盐价上涨。',
  },
  {
    type: 'rumor',
    region: '人类联邦',
    text: '白石镇集市有人高价收购一批来历不明的古铜齿轮。',
  },
  {
    type: 'rumor',
    region: '人类联邦',
    text: '白石镇北边林道附近最近出现了狼群。',
  },
  {
    type: 'important',
    region: '人类联邦',
    text: '冒险者公会发布公告，招募码头货栈夜间巡守。',
  },
  {
    type: 'rumor',
    region: '人类联邦',
    text: '王都来的魔法检察官正在白石镇调查违禁魔法物品。',
  },
  {
    type: 'economy',
    region: '人类联邦',
    text: '矮人山脉的铁矿石供应恢复，武器价格开始回落。',
  },
  {
    type: 'quest',
    region: '人类联邦',
    text: '药草商和城卫队因禁售药材账本起了争执，正在找见证人。',
  },
  {
    type: 'faction',
    region: '人类联邦',
    text: '黑市最近在大量收购旧王国遗物，出价很高。',
  },

  // ===== 精灵森林 =====
  {
    type: 'faction',
    region: '精灵森林',
    text: '精灵哨兵驱逐了三支越界伐木队。',
  },
  {
    type: 'rumor',
    region: '精灵森林',
    text: '月湖的水位连续七天下降，精灵长老正在调查原因。',
  },
  {
    type: 'important',
    region: '精灵森林',
    text: '圣树根部被不明力量污染，星叶城寻求外界帮助。',
  },
  {
    type: 'faction',
    region: '精灵森林',
    text: '精灵王庭宣布限制人类进入森林内层。',
  },

  // ===== 地底暗精灵 =====
  {
    type: 'rumor',
    region: '地底暗精灵王国',
    text: '有人在地底商道听见陌生语言，还看见带毒的银针被暗中交易。',
  },
  {
    type: 'hidden',
    region: '地底暗精灵王国',
    text: '暗精灵蛛后神殿的祭司在秘密寻找特定的人类冒险者。',
  },
  {
    type: 'faction',
    region: '地底暗精灵王国',
    text: '黑曜石城的暗精灵贵族之间爆发了暗杀潮。',
  },
  {
    type: 'economy',
    region: '地底暗精灵王国',
    text: '地底商道出现新的毒药供应，来源不明。',
  },

  // ===== 其他区域 =====
  {
    type: 'important',
    region: '矮人山脉',
    text: '黑铁熔炉重新点燃，矮人工匠开始招募护卫。',
  },
  {
    type: 'rumor',
    region: '矮人山脉',
    text: '矮人在黑铁熔炉旁修复出一台会自己计数的古代机械。',
  },
  {
    type: 'rumor',
    region: '北境冰原',
    text: '北方商队说冰原上出现了不正常的暖风。',
  },
  {
    type: 'crisis',
    region: '北境冰原',
    text: '冰原深处的失落王座似乎在重新发光，周边地区出现空间扭曲。',
  },
  {
    type: 'rumor',
    region: '西部荒原',
    text: '兽人部落在古战场附近举行了罕见的大规模集会。',
  },
  {
    type: 'rumor',
    region: '群岛海域',
    text: '自由港附近出现海盗旗，商船被要求绕行。',
  },
  {
    type: 'rumor',
    region: '龙栖海彼岸',
    text: '远洋水手声称在风暴中看见龙影。',
  },
  {
    type: 'hidden',
    region: '龙栖海彼岸',
    text: '龙语石碑在无人触碰的情况下自行发光。',
  },
  {
    type: 'important',
    region: '圣都教国',
    text: '审判庭宣布追查禁忌魔法书。',
  },
  {
    type: 'faction',
    region: '圣都教国',
    text: '圣骑士团在旧王国废土边缘布置了新的哨站。',
  },
  {
    type: 'rumor',
    region: '魔法学院自治城',
    text: '魔法议会正在组织对旧王国遗迹的大型考察队。',
  },
  {
    type: 'rumor',
    region: '旧王国废土',
    text: '废土深处据说还有未被诅咒的旧王国宝库。',
  },
  {
    type: 'crisis',
    region: '旧王国废土',
    text: '旧王国废土的诅咒边界正在缓慢扩张。',
  },
  {
    type: 'rumor',
    region: '南方沙漠王庭',
    text: '沙海商队称金字塔深处传来叹息般的声音。',
  },
];
