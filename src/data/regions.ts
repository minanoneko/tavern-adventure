import type { Region, Subregion, Location, Connection } from '../types';

export const REGIONS: Region[] = [
  {
    id: 'human_federation',
    name: '人类联邦',
    description: '人类主国度，商业、港口、酒馆、冒险者公会、教会、贵族政治集中地。',
    dangerLevel: 1,
    recommendedLevel: 1,
    currentSituation: '表面平静，但旧矿洞的传闻和周边的商队失踪事件令人不安。',
  },
  {
    id: 'elf_forest',
    name: '精灵森林',
    description: '古老森林国度，精灵、树灵、月湖、圣树、禁忌林、古代自然魔法。',
    dangerLevel: 4,
    recommendedLevel: 5,
    currentSituation: '森林外围正在驱逐人类伐木队，边境气氛紧张。',
    unlockCondition: { type: 'faction', factionId: 'elf_forest', minStanding: 10 },
  },
  {
    id: 'dark_elf_kingdom',
    name: '地底暗精灵王国',
    description: '地下世界，暗精灵、蛛后神殿、毒药市场、黑曜石城、地底商道。',
    dangerLevel: 6,
    recommendedLevel: 12,
    currentSituation: '传闻旧矿洞深处有通往地底的裂隙。',
    unlockCondition: { type: 'flag', flag: 'found_deep_rift' },
  },
  {
    id: 'dwarf_mountains',
    name: '矮人山脉',
    description: '矿山、锻造城、古代熔炉、地下矿道、机械遗迹、龙骨武器。',
    dangerLevel: 5,
    recommendedLevel: 8,
    currentSituation: '黑铁熔炉重新点燃，矮人工匠开始招募护卫。',
    unlockCondition: { type: 'flag', flag: 'heard_dwarf_news' },
  },
  {
    id: 'north_ice_plain',
    name: '北境冰原',
    description: '冰雪覆盖的北境大地，古老战场、寒冰遗迹和失落王座的所在地。',
    dangerLevel: 8,
    recommendedLevel: 15,
    currentSituation: '遥远而寒冷，几乎没有商队敢前往。',
    unlockCondition: { type: 'level', minLevel: 12 },
  },
  {
    id: 'western_wasteland',
    name: '西部荒原',
    description: '兽人部落、佣兵据点、废土商队、古战场、强盗营地。',
    dangerLevel: 5,
    recommendedLevel: 7,
    currentSituation: '商道上的强盗活动日益猖獗。',
    unlockCondition: { type: 'level', minLevel: 6 },
  },
  {
    id: 'island_sea',
    name: '群岛海域',
    description: '海盗、自由港、海商联盟、沉船遗迹、海妖传闻。',
    dangerLevel: 6,
    recommendedLevel: 10,
    currentSituation: '自由港附近出现海盗旗，远洋航运受到威胁。',
    unlockCondition: { type: 'flag', flag: 'has_ship_ticket' },
  },
  {
    id: 'dragon_coast',
    name: '龙栖海彼岸',
    description: '海那边的龙族栖息地，远古龙巢、龙裔部族、火山岛、龙语遗迹。',
    dangerLevel: 10,
    recommendedLevel: 20,
    currentSituation: '海那边的传闻很少到达人类联邦。',
    unlockCondition: { type: 'flag', flag: 'crossed_dragon_sea' },
  },
  {
    id: 'old_kingdom_waste',
    name: '旧王国废土',
    description: '曾经的人类古王国，如今被诅咒、亡灵、失控魔法和遗迹覆盖。',
    dangerLevel: 7,
    recommendedLevel: 14,
    currentSituation: '废土中偶尔仍有活人走出来……但不一定是正常人。',
    unlockCondition: { type: 'flag', flag: 'found_old_kingdom_path' },
  },
  {
    id: 'mage_academy_city',
    name: '魔法学院自治城',
    description: '法师塔、魔法学院、禁书馆、传送阵、魔法议会。',
    dangerLevel: 3,
    recommendedLevel: 1,
    currentSituation: '魔法议会对旧王国遗迹的研究兴趣日益增长。',
    unlockCondition: { type: 'faction', factionId: 'mage_association', minStanding: 5 },
  },
  {
    id: 'holy_city',
    name: '圣都教国',
    description: '教会总部、圣骑士团、审判庭、圣物库、神迹和政治斗争。',
    dangerLevel: 3,
    recommendedLevel: 1,
    currentSituation: '审判庭宣布追查禁忌魔法书。',
    unlockCondition: { type: 'faction', factionId: 'church', minStanding: 15 },
  },
  {
    id: 'south_desert_kingdom',
    name: '南方沙漠王庭',
    description: '沙漠王国、遗迹金字塔、商队、古代神庙、沙虫、幻术。',
    dangerLevel: 7,
    recommendedLevel: 12,
    currentSituation: '沙海中传来商队失踪的流言，据说与古代诅咒有关。',
    unlockCondition: { type: 'level', minLevel: 10 },
  },
];

export const SUBREGIONS: Subregion[] = [
  { id: 'whitestone_town', regionId: 'human_federation', name: '白石镇', description: '边境小镇，冒险者的起点。', dangerLevel: 1, recommendedLevel: 1 },
  { id: 'silver_sail_port', regionId: 'human_federation', name: '银帆港', description: '繁华的港口城市，船来船往。', dangerLevel: 2, recommendedLevel: 3 },
  { id: 'royal_capital', regionId: 'human_federation', name: '王都', description: '人类联邦的政治中心。', dangerLevel: 2, recommendedLevel: 5 },
  { id: 'north_border', regionId: 'human_federation', name: '北境边防线', description: '连接北境的前哨。', dangerLevel: 4, recommendedLevel: 7 },
  { id: 'old_mine_area', regionId: 'human_federation', name: '旧矿区', description: '废弃的矿洞区域，传闻有奇怪动静。', dangerLevel: 3, recommendedLevel: 3 },
  { id: 'forest_road', regionId: 'human_federation', name: '林道与村落', description: '连接白石镇和周边森林的乡野地带。', dangerLevel: 2, recommendedLevel: 2 },
  { id: 'forest_border', regionId: 'elf_forest', name: '森林边境', description: '精灵森林外缘，人类与精灵的交界地。', dangerLevel: 3, recommendedLevel: 5 },
  { id: 'moon_lake', regionId: 'elf_forest', name: '月湖', description: '圣湖，月神殿所在地。', dangerLevel: 4, recommendedLevel: 7 },
  { id: 'starleaf_city', regionId: 'elf_forest', name: '星叶城', description: '精灵的主城，建在巨树之间。', dangerLevel: 3, recommendedLevel: 6 },
  { id: 'forbidden_forest', regionId: 'elf_forest', name: '禁忌林深处', description: '被污染的古老森林，危险而黑暗。', dangerLevel: 7, recommendedLevel: 12 },
  { id: 'underground_rift', regionId: 'dark_elf_kingdom', name: '地底裂隙', description: '旧矿洞深处延伸至地底的裂隙。', dangerLevel: 5, recommendedLevel: 10 },
  { id: 'dark_elf_border_city', regionId: 'dark_elf_kingdom', name: '暗精灵边境城', description: '暗精灵在地底的前哨城市。', dangerLevel: 6, recommendedLevel: 12 },
  { id: 'spider_temple', regionId: 'dark_elf_kingdom', name: '蛛后神殿', description: '暗精灵信仰的中心。', dangerLevel: 8, recommendedLevel: 16 },
  { id: 'underground_trade_route', regionId: 'dark_elf_kingdom', name: '地底商道', description: '连接地底各城市的隐秘商路。', dangerLevel: 6, recommendedLevel: 13 },
];

export const LOCATIONS: Location[] = [
  // 白石镇
  { id: 'gray_deer_tavern', subregionId: 'whitestone_town', name: '灰鹿酒馆', type: 'tavern', description: '白石镇最热闹的酒馆，传闻和委托的集散地。', dangerLevel: 1 },
  { id: 'adventurers_guild_branch', subregionId: 'whitestone_town', name: '冒险者公会分部', type: 'other', description: '接取和交付正式委托的地方。', dangerLevel: 1 },
  { id: 'whitestone_blacksmith', subregionId: 'whitestone_town', name: '铁匠铺', type: 'shop', description: '老铁匠经营多年的铺子，能修理和购买装备。', dangerLevel: 1 },
  { id: 'small_chapel', subregionId: 'whitestone_town', name: '小礼拜堂', type: 'temple', description: '镇上唯一的小教堂，平时没什么人。', dangerLevel: 1 },
  { id: 'market_square', subregionId: 'whitestone_town', name: '市集', type: 'shop', description: '摊贩聚集的广场，各种货物都有。', dangerLevel: 1 },
  { id: 'city_guard_post', subregionId: 'whitestone_town', name: '城卫队哨所', type: 'other', description: '城卫队驻守的小哨所。', dangerLevel: 1 },
  { id: 'whitestone_inn', subregionId: 'whitestone_town', name: '旅店', type: 'other', description: '供旅人过夜的地方。', dangerLevel: 1 },
  { id: 'potion_shop', subregionId: 'whitestone_town', name: '药剂店', type: 'shop', description: '售卖药水和炼金材料的铺子。', dangerLevel: 1 },
  // 旧矿区
  { id: 'old_mine_entrance', subregionId: 'old_mine_area', name: '旧矿洞入口', type: 'dungeon', description: '废弃矿洞的入口，被木栅栏半掩着。', dangerLevel: 3 },
  { id: 'deep_mine_shaft', subregionId: 'old_mine_area', name: '矿洞深处', type: 'dungeon', description: '矿洞的深层，空气中有淡淡的硫磺味。', dangerLevel: 5 },
  { id: 'underground_rift_location', subregionId: 'underground_rift', name: '地底裂隙', type: 'dungeon', description: '一条天然的深裂隙，通往地底世界。', dangerLevel: 7 },
  // 银帆港
  { id: 'port_docks', subregionId: 'silver_sail_port', name: '港口码头', type: 'port', description: '停满大小船只的繁忙码头。', dangerLevel: 2 },
  { id: 'sailor_tavern', subregionId: 'silver_sail_port', name: '水手酒馆', type: 'tavern', description: '酒气熏天的港口酒馆，什么人都有。', dangerLevel: 2 },
  { id: 'ship_ticket_office', subregionId: 'silver_sail_port', name: '船票办事处', type: 'shop', description: '购买远洋船票的地方。', dangerLevel: 1 },
  { id: 'smuggler_alley', subregionId: 'silver_sail_port', name: '走私者暗巷', type: 'other', description: '一条阴暗的小巷，据说有通往黑市的入口。', dangerLevel: 4 },
  // 地底
  { id: 'glowing_mushroom_forest', subregionId: 'underground_rift', name: '发光菌菇林', type: 'wilderness', description: '幽蓝色的菌菇照亮了地下洞穴。', dangerLevel: 5 },
  { id: 'obsidian_gate', subregionId: 'dark_elf_border_city', name: '黑曜石城门', type: 'city', description: '暗精灵边境城的大门，由黑曜石筑成。', dangerLevel: 6 },
  { id: 'poison_market', subregionId: 'dark_elf_border_city', name: '毒药市场', type: 'shop', description: '出售毒药、暗器和各种奇异商品的集市。', dangerLevel: 5 },
];

export const CONNECTIONS: Connection[] = [
  { id: 'whitestone_to_forest_road', fromId: 'whitestone_town', toId: 'forest_road', type: 'land', name: '林道', description: '连接白石镇和林区的道路。', },
  { id: 'whitestone_to_old_mine', fromId: 'whitestone_town', toId: 'old_mine_area', type: 'land', name: '矿道', description: '通往旧矿区的土路。', },
  { id: 'whitestone_to_port', fromId: 'whitestone_town', toId: 'silver_sail_port', type: 'land', name: '官道', description: '通往银帆港的大路。', },
  { id: 'old_mine_to_rift', fromId: 'old_mine_area', toId: 'underground_rift', type: 'underground', name: '地底裂隙', description: '矿洞深处延伸的地底裂隙。', requirements: { type: 'flag', flag: 'found_deep_rift' } },
  { id: 'port_to_islands', fromId: 'silver_sail_port', toId: 'island_sea', type: 'sea', name: '远洋航线', description: '从银帆港出发的远洋航线。', requirements: { type: 'flag', flag: 'has_ship_ticket' } },
  { id: 'forest_road_to_border', fromId: 'forest_road', toId: 'forest_border', type: 'land', name: '林间小路', description: '通往森林边境的小路。', requirements: { type: 'faction', factionId: 'elf_forest', minStanding: 10 } },
];

export function getRegionById(id: string): Region | undefined {
  return REGIONS.find(r => r.id === id);
}

export function getSubregionById(id: string): Subregion | undefined {
  return SUBREGIONS.find(s => s.id === id);
}

export function getLocationById(id: string): Location | undefined {
  return LOCATIONS.find(l => l.id === id);
}

export function getSubregionsByRegion(regionId: string): Subregion[] {
  return SUBREGIONS.filter(s => s.regionId === regionId);
}

export function getLocationsBySubregion(subregionId: string): Location[] {
  return LOCATIONS.filter(l => l.subregionId === subregionId);
}
