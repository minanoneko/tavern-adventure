import type { AIResponse } from '../types';

interface OpeningTemplate {
  classId: string;
  responses: AIResponse[];
}

const DEFAULT_OPENING_TROPE_PATTERN = /矿|采石|洞穴|塌洞|塌陷|商队|失踪|失散|不知所踪|小道|符文|羊皮纸|蓝光|黑袍|兜帽/;

const SAFE_DEFAULT_OPENINGS: AIResponse[] = [
  {
    scene: { title: '市集早摊', text: '白石镇的市集刚摆开摊位，烤麦饼的香气混着皮革和湿木箱味。一个草药贩正和城卫争执：他说昨晚有人把一整箱银叶草调包，只留下一袋普通干草。围观的人越聚越多，谁都不肯先让路。\n\n你刚好从摊位旁经过，听见草药贩压低声音说：“我不怕赔钱，我怕那箱东西落到不该拿的人手里。”', location: '市集', locationId: 'market_square', time: '雾月3日 上午', weather: '晴' },
    event: { id: 'opening_safe_market', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [{ type: 'info', text: '这是一起本地纠纷，看起来暂时没有直接危险。' }],
    actionOptions: [
      { id: 'ask_herbalist', label: '问草药贩丢了什么', type: 'dialogue', risk: 'low' },
      { id: 'talk_guard', label: '请城卫说清经过', type: 'social', risk: 'low', relatedAttribute: 'cha' },
      { id: 'check_crate', label: '检查被调包的木箱', type: 'check', risk: 'medium', relatedAttribute: 'wis' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
    mapUpdate: [{ targetId: 'market_square', targetType: 'location', name: '市集', status: 'discovered' }],
    worldBroadcasts: [],
    memoryUpdate: { flags: ['game_started', 'opening_no_old_tropes'], currentLocation: 'market_square', currentLocationId: 'market_square', knownLocations: ['market_square', 'gray_deer_tavern'] },
  },
  {
    scene: { title: '铁匠铺门前', text: '铁匠铺的炉火刚升起来，门口却摆着一排没人认领的兵器。老铁匠把一把弯曲的短剑丢进废铁桶，骂了一句：“又是劣货，刻个贵族纹章就敢卖高价。”\n\n旁边一个年轻跑腿脸色发白，坚持说这些货是有人托他送来的，收货人就在灰鹿酒馆。他不敢进去，因为包袱里还夹着一封没有署名的账单。', location: '铁匠铺', locationId: 'whitestone_blacksmith', time: '雾月3日 下午', weather: '多云' },
    event: { id: 'opening_safe_blacksmith', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [{ type: 'info', text: '这更像是一桩赝品交易或债务纠纷，不是必须接下的任务。' }],
    actionOptions: [
      { id: 'inspect_weapon', label: '辨认那批劣质兵器', type: 'check', risk: 'low', relatedAttribute: 'int' },
      { id: 'ask_runner', label: '安抚跑腿问收货人', type: 'dialogue', risk: 'low' },
      { id: 'go_tavern_bill', label: '带账单去酒馆问问', type: 'travel', risk: 'medium' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
    mapUpdate: [{ targetId: 'whitestone_blacksmith', targetType: 'location', name: '铁匠铺', status: 'discovered' }],
    worldBroadcasts: [],
    memoryUpdate: { flags: ['game_started', 'opening_no_old_tropes'], currentLocation: 'whitestone_blacksmith', currentLocationId: 'whitestone_blacksmith', knownLocations: ['whitestone_blacksmith', 'gray_deer_tavern'] },
  },
  {
    scene: { title: '小礼拜堂钟声', text: '小礼拜堂的钟声响到一半突然哑了。院子里几个孩子吓得缩到篱笆后面，临时代管礼拜堂的老抄写员站在台阶上，手里攥着断掉的钟绳。\n\n他说钟不是坏了，而是有人把钟舌拆走了。那东西不值多少钱，却关系到镇上的报时和集会。老抄写员愿意付几枚铜币，请人先查清是谁在恶作剧。', location: '小礼拜堂', locationId: 'small_chapel', time: '雾月3日 清晨', weather: '晴' },
    event: { id: 'opening_safe_chapel', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [{ type: 'info', text: '这是一件小镇麻烦事，可能只是恶作剧，也可能牵涉到谁的私人恩怨。' }],
    actionOptions: [
      { id: 'ask_scribe', label: '问老抄写员细节', type: 'dialogue', risk: 'low' },
      { id: 'check_bell_rope', label: '查看断掉的钟绳', type: 'check', risk: 'low', relatedAttribute: 'wis' },
      { id: 'talk_children', label: '问问躲着的孩子', type: 'social', risk: 'low', relatedAttribute: 'cha' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
    mapUpdate: [{ targetId: 'small_chapel', targetType: 'location', name: '小礼拜堂', status: 'discovered' }],
    worldBroadcasts: [],
    memoryUpdate: { flags: ['game_started', 'opening_no_old_tropes'], currentLocation: 'small_chapel', currentLocationId: 'small_chapel', knownLocations: ['small_chapel', 'gray_deer_tavern'] },
  },
];

const SAFE_OPENING_IDS_BY_CLASS: Record<string, string[]> = {
  mage: ['opening_safe_market', 'opening_safe_blacksmith'],
  ranger: ['opening_safe_market'],
  warrior: ['opening_safe_blacksmith', 'opening_safe_market'],
  thief: ['opening_safe_market', 'opening_safe_blacksmith'],
  priest: ['opening_safe_chapel', 'opening_safe_market'],
  barbarian: ['opening_safe_blacksmith', 'opening_safe_market'],
  alchemist: ['opening_safe_market'],
  noble: ['opening_safe_blacksmith', 'opening_safe_chapel'],
  wanderer: ['opening_safe_market', 'opening_safe_chapel'],
  bard: ['opening_safe_market', 'opening_safe_chapel'],
  scholar: ['opening_safe_chapel', 'opening_safe_blacksmith'],
  witch_hunter: ['opening_safe_chapel'],
};

const CLASS_OPENING_FLAVORS: Record<string, { note: string; actionLabel: string; actionType: AIResponse['actionOptions'][number]['type'] }> = {
  mage: {
    note: '你的魔法笔记和基础感知能帮你判断这件小事里有没有异常魔力，但现在的你仍只是低阶施法者。',
    actionLabel: '用魔力感知细节',
    actionType: 'skill',
  },
  ranger: {
    note: '你的野外经验让你更容易注意脚印、气味和人群动向，但眼前的问题仍是镇上的小麻烦。',
    actionLabel: '辨认现场痕迹',
    actionType: 'check',
  },
  warrior: {
    note: '你的佣兵经验更适合压住场面、判断武器或保护弱势一方，而不是立刻拔剑。',
    actionLabel: '站到冲突中间',
    actionType: 'cautious',
  },
  thief: {
    note: '你的街头经验让你看得出谁在撒谎、谁在藏东西；这也许能换来一顿饭或几枚铜币。',
    actionLabel: '留意谁在藏东西',
    actionType: 'stealth',
  },
  priest: {
    note: '你的圣徽让旁人更愿意相信你能公正调停，但这不代表他们会立刻说真话。',
    actionLabel: '以圣徽调停',
    actionType: 'social',
  },
  barbarian: {
    note: '你的体格足以让吵闹的人先闭嘴，但真正解决问题还得弄清是谁在占便宜。',
    actionLabel: '用气势压住场面',
    actionType: 'social',
  },
  alchemist: {
    note: '你的炼金常识能分辨药材、金属和气味里的问题，也可能看出谁动过手脚。',
    actionLabel: '用炼金常识辨认',
    actionType: 'check',
  },
  noble: {
    note: '你的礼仪和旧身份能让某些人愿意开口，也会让另一些人先观察你值不值得利用。',
    actionLabel: '以礼貌套出话',
    actionType: 'social',
  },
  wanderer: {
    note: '你见过太多路边闲事，知道小麻烦常常比大传闻更容易换来食宿。',
    actionLabel: '问能否换顿饭',
    actionType: 'dialogue',
  },
  bard: {
    note: '你的耳朵擅长捕捉人群里的破绽；一句玩笑或一段小调也许比盘问更好用。',
    actionLabel: '用玩笑套消息',
    actionType: 'social',
  },
  scholar: {
    note: '你的书本知识和记录习惯能帮你把账目、时间和证词对上，而不是盲目追线索。',
    actionLabel: '整理证词矛盾',
    actionType: 'check',
  },
  witch_hunter: {
    note: '你的猎魔训练让你先排除伪装、恐吓和低级骗术；不是什么怪事都来自邪祟。',
    actionLabel: '排除伪装骗术',
    actionType: 'check',
  },
};

// Deprecated legacy template bucket. Keep the export for compatibility, but do not put campaign content here.
export const OPENING_TEMPLATES: OpeningTemplate[] = [];

export function getOpeningByClass(classId: string, sanitizedOrigin: string): AIResponse | null {
  const response = getSafeDefaultOpening(classId);
  applyClassFlavor(response, classId);

  // If sanitized origin exists, slightly modify the scene text to incorporate it
  if (sanitizedOrigin.trim()) {
    response.scene.text += `\n\n（${sanitizedOrigin}）`;
    response.systemEvents.push({
      type: 'info',
      text: `你的背景：${sanitizedOrigin}`,
    });
  }

  return response;
}

function applyClassFlavor(response: AIResponse, classId: string) {
  const flavor = CLASS_OPENING_FLAVORS[classId];
  if (!flavor) return;

  response.scene.text += `\n\n${flavor.note}`;
  response.systemEvents.push({
    type: 'info',
    text: flavor.note,
  });
  response.actionOptions = [
    ...response.actionOptions.slice(0, 2),
    {
      id: `class_flavor_${classId}`,
      label: flavor.actionLabel,
      type: flavor.actionType,
      risk: 'low',
    },
    ...response.actionOptions.slice(2, 3),
  ];
}

export function getSafeDefaultOpening(classId?: string): AIResponse {
  const allowedIds = classId ? SAFE_OPENING_IDS_BY_CLASS[classId] : undefined;
  const pool = allowedIds?.length
    ? SAFE_DEFAULT_OPENINGS.filter(opening => allowedIds.includes(opening.event.id))
    : SAFE_DEFAULT_OPENINGS;
  const finalPool = pool.length > 0 ? pool : SAFE_DEFAULT_OPENINGS;
  const idx = Math.floor(Math.random() * finalPool.length);
  return JSON.parse(JSON.stringify(finalPool[idx])) as AIResponse;
}




