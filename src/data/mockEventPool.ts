import type { AIResponse, PlayerAction, JudgeResult, Player, WorldState } from '../types';

interface Ctx { player: Player; worldState: WorldState; }

const f = (ws: WorldState, flag: string) => ws.worldFlags.includes(flag);

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ====================================================================
// GM SIMULATOR — only the opening scene is fixed.
// After that, responses are generated based on: Location + Action + State
// ====================================================================

export function getMockResponse(state: Ctx, action: PlayerAction, judge: JudgeResult): AIResponse {
  const { player, worldState: ws } = state;
  const loc = ws.currentLocation;

  // Handle quest accept/decline BEFORE location dispatch
  const questResponse = handleQuestAction(action, ws);
  if (questResponse) return questResponse;

  // Opening is now handled by openingService. This fallback only fires if no opening was generated.
  if (!f(ws, 'game_started')) return openingScene();

  // === Dispatch by location ===
  switch (loc) {
    case 'gray_deer_tavern':          return tavernResponse(action, player, ws, judge);
    case 'whitestone_inn':            return innResponse(action, player, ws);
    case 'whitestone_blacksmith':     return blacksmithResponse(action, player, ws, judge);
    case 'adventurers_guild_branch':  return guildResponse(action, player, ws);
    case 'forest_road':               return forestRoadResponse(action, player, ws, judge);
    case 'old_mine_entrance':         return mineEntranceResponse(action, player, ws, judge);
    case 'deep_mine_shaft':           return deepMineResponse(action, player, ws, judge);
    case 'silver_sail_port':          return portResponse(action, player, ws);
    case 'market_square':             return marketResponse(action, player, ws);
    default:                          return travelResponse(action, player, ws, judge);
  }
}

// Handle quest accept/decline actions to update quest status
function handleQuestAction(action: PlayerAction, ws: WorldState): AIResponse | null {
  // Accept any quest action
  const isAcceptAction = action.id.includes('accept') || action.id.includes('op_accept')
    || action.id === 'op_ask' || action.id === 'op_why_me';

  if (isAcceptAction) {
    return {
      scene: { title: '接受了委托', text: '"很好。"陌生人微微点头，将银币推到你面前。"三天前矿洞深处有动静。不是塌方——是某种呼吸。带上这枚银币，蓝光亮起时它会发烫。"\n\n他把一张皱巴巴的地图放在桌上，上面标记了旧矿洞入口的位置。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 深夜', weather: '雨' },
      event: { id: 'quest_accepted', type: 'dialogue_event', urgency: 'normal', riskLevel: 'medium' },
      systemEvents: [{ type: 'info', text: '任务「子时的旧矿洞」已接受。矿洞入口已在地图上标记。' }],
      actionOptions: [
        { id: 'go_mine_now', label: '连夜赶往旧矿洞', type: 'travel', risk: 'high' },
        { id: 'rest_first', label: '先在酒馆休息，天亮再出发', type: 'cautious', risk: 'low' },
        { id: 'ask_more_details', label: '追问更多矿洞的细节', type: 'dialogue', risk: 'low' },
        { id: 'prepare_supplies', label: '去市集买些补给再出发', type: 'travel', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 5, moneyChange: {} },
      inventoryUpdate: [],
      questUpdate: [{
        id: 'old_mine', name: '子时的旧矿洞', status: 'active',
        description: '调查旧矿洞深处的异常动静。报酬5银币。', giver: '染血的陌生人',
        objectives: [{ id: 'o1', description: '前往旧矿洞入口', completed: false }, { id: 'o2', description: '调查矿洞深处的异常', completed: false }],
        rewards: { exp: 50, money: { silver: 5 } },
      }],
      skillStateUpdate: [], equipmentUpdate: [],
      relationshipUpdate: [{ targetId: 'stranger', name: '染血的陌生人', change: 5, type: 'npc', reason: '你接下了委托。' }],
      mapUpdate: [{ targetId: 'old_mine_entrance', targetType: 'location', name: '旧矿洞入口', status: 'discovered' }],
      worldBroadcasts: [],
      memoryUpdate: { flags: ['quest_accepted'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern', 'old_mine_entrance'] },
    };
  }

  // Accept a board quest (generic)
  if (action.id.includes('accept_board') || action.id.includes('take_quest')) {
    return {
      scene: { title: '接下委托', text: '你从委托板上取下那张纸条。一个新的任务开始了。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '稍后', weather: '晴' },
      event: { id: 'board_quest_accepted', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'reward', text: '委托已接受。可以在任务面板中查看详情。' }],
      actionOptions: [
        { id: 'go_adventure', label: '出发执行委托', type: 'travel', risk: 'medium' },
        { id: 'prepare_gear', label: '先整理装备', type: 'item', risk: 'low' },
        { id: 'rest_first', label: '休息一下再出发', type: 'cautious', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
      inventoryUpdate: [],
      questUpdate: [{
        id: 'board_quest_1', name: '护送商队', status: 'active',
        description: '护送一支商队安全抵达银帆港。', giver: '冒险者公会',
        objectives: [{ id: 'b1', description: '前往银帆港', completed: false }],
        rewards: { exp: 30, money: { silver: 2 } },
      }],
      skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
      worldBroadcasts: [],
      memoryUpdate: { flags: ['board_quest_taken'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern' },
    };
  }

  return null;
}

// ===================== OPENING =====================

function openingScene(): AIResponse {
  return {
    scene: { title: '陌生人的委托', text: '灰鹿酒馆的木门被推开，冷雨随风灌入。一个披着湿斗篷的男人环顾四周，然后径直朝你走来。他把一枚沾着泥的银币推到桌上。\n\n"我需要一个信得过的人去旧矿洞。报酬……等你活着回来再说。"\n\n窗外旧矿洞的方向隐约闪过蓝光。他袖口有一小片暗红色血迹——不像是他的。', location: '灰鹿酒馆', time: '雾月3日 夜晚', weather: '雨' },
    event: { id: 'opening', type: 'dialogue_event', urgency: 'normal', riskLevel: 'medium' },
    systemEvents: [{ type: 'info', text: '你注意到袖口的血迹和斗篷下做工精致的匕首。' }],
    actionOptions: [
      { id: 'op_ask', label: '询问任务细节', type: 'dialogue', risk: 'low' },
      { id: 'op_accept', label: '收下银币，接下委托', type: 'dialogue', risk: 'medium' },
      { id: 'op_observe', label: '观察他的血迹和神情', type: 'check', risk: 'low', relatedAttribute: 'wis' },
      { id: 'op_magic', label: '使用【魔力感知】检查银币', type: 'skill', risk: 'low', relatedSkill: 'magic_sense', relatedAttribute: 'int', mpCost: 1 },
      { id: 'op_why_me', label: '问他为什么找上你', type: 'dialogue', risk: 'low' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 5, moneyChange: {} },
    inventoryUpdate: [{ action: 'add', itemId: 'muddy_silver_coin', name: '沾泥的银币', quantity: 1, type: 'quest_item', description: '陌生人推到桌上的银币，隐约有魔力残留', rarity: 'common' }],
    questUpdate: [{ id: 'old_mine', name: '子时的旧矿洞', status: 'available', description: '调查旧矿洞深夜出现的蓝光。报酬5银币。', giver: '染血的陌生人', objectives: [{ id: 'o1', description: '前往旧矿洞入口', completed: false }], rewards: { exp: 50, money: { silver: 5 } } }],
    skillStateUpdate: [], equipmentUpdate: [],
    relationshipUpdate: [{ targetId: 'stranger', name: '染血的陌生人', change: 0, type: 'npc', reason: '刚刚见面。' }],
    mapUpdate: [{ targetId: 'old_mine_entrance', targetType: 'location', name: '旧矿洞入口', status: 'discovered' }],
    worldBroadcasts: [{ type: 'rumor', region: '人类联邦', text: '有人说旧矿洞今晚出现了蓝色火光。' }],
    memoryUpdate: { flags: ['game_started', 'met_stranger', 'has_quest_mine'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern', 'old_mine_entrance'] },
  };
}

// ===================== TAVERN =====================

function tavernResponse(action: PlayerAction, p: Player, ws: WorldState, judge: JudgeResult): AIResponse {
  const hasQuest = f(ws, 'has_quest_mine');
  const talkedToBoss = f(ws, 'talked_to_boss');
  const checkedBoard = f(ws, 'checked_board');

  // --- REST ---
  if (action.type === 'cautious' || action.id.includes('rest') || action.id.includes('inn')) {
    const healHp = Math.floor(p.resources.maxHp * 0.5);
    const healMp = Math.floor(p.resources.maxMp * 0.5);
    return {
      scene: { title: '旅店歇息', text: pick([
        '你在旅店要了一间房。热汤和暖和的被窝驱散了疲惫。窗外偶尔传来猫的叫声，但你睡得很沉。',
        '旅店老板娘端来一碗炖菜和一块黑面包。算不上美味，但足以填饱肚子。你靠在床头，翻着那本旧笔记，不知不觉就睡着了。',
        '你趴在桌上打了个盹。醒来时壁炉里的火还在烧，酒馆里的人换了一拨。精神好了不少。',
      ]), location: '灰鹿酒馆', time: '稍后', weather: '晴' },
      event: { id: 'rest', type: 'rest_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'reward', text: `HP +${healHp}  MP +${healMp}` }],
      actionOptions: [
        { id: 'go_mine', label: '前往旧矿洞调查', type: 'travel', risk: 'medium' },
        { id: 'talk_boss', label: '跟酒馆老板聊聊', type: 'dialogue', risk: 'low' },
        { id: 'check_board', label: '查看委托板', type: 'exploration', risk: 'low' },
        { id: 'go_blacksmith', label: '去铁匠铺', type: 'travel', risk: 'low' },
        { id: 'go_market', label: '去市集逛逛', type: 'travel', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: healHp, mpChange: healMp, expChange: 0, moneyChange: { copper: -5 } },
      inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
      worldBroadcasts: [],
      memoryUpdate: { flags: [], currentLocation: 'gray_deer_tavern', knownLocations: ['whitestone_inn', 'market_square'] },
    };
  }

  // --- TALK TO BOSS ---
  if (action.id.includes('talk') || action.id.includes('boss') || action.id.includes('ask')) {
    const dialogues = hasQuest
      ? [
        { text: '老板一边擦杯子一边压低声音："矿洞的事？这两天来了好几拨人问。有个王都的魔法检察官昨天也来打听过。"他顿了顿，"那人不对劲。他的眼睛……一只是蓝的，一只不是。"', hint: '新情报：王都魔法检察官也在调查矿洞' },
        { text: '"矿洞啊。"老板叹了口气，"二十年前塌过一次，埋了好几个矿工。那之后就荒了。最近又有人进去，但出来的不多。"他把杯子放下，"你要是去，多带点绳子。里面比看起来深得多。"', hint: '矿洞比看上去更深，带绳子' },
        { text: '老板给你倒了杯麦酒，没收钱。"那个委托你接了就小心点。来找你的人——"他压低了声音，"不是本地人。他的靴子是王都样式，但旧得厉害。像是走了很久的路。"', hint: '委托人的身份有疑点' },
      ]
      : [
        { text: '老板是个话不多的人，但你多问了几句后，指了指壁炉上方的木板。"新贴了几张委托。矿洞和商队的事似乎有关联。"', hint: '委托板上有新任务' },
        { text: '"最近生意不错。"老板擦着吧台，"冒险者多了，麻烦也多了。你看着是个能打的——公会那边应该欢迎你。"', hint: '可以加入冒险者公会' },
      ];
    const d = pick(dialogues);
    return {
      scene: { title: '酒馆闲谈', text: d.text, location: '灰鹿酒馆', time: '傍晚', weather: '晴' },
      event: { id: 'tavern_talk', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'info', text: d.hint }],
      actionOptions: [
        { id: 'go_mine', label: '前往旧矿洞', type: 'travel', risk: 'medium' },
        { id: 'check_board', label: '查看委托板', type: 'exploration', risk: 'low' },
        { id: 'rest_inn', label: '在旅店休息', type: 'cautious', risk: 'low' },
        { id: 'go_blacksmith', label: '去铁匠铺', type: 'travel', risk: 'low' },
        { id: 'go_market', label: '去市集', type: 'travel', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
      inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
      mapUpdate: [],
      worldBroadcasts: hasQuest && !talkedToBoss ? [{ type: 'rumor', text: '王都魔法检察官现身白石镇。' }] : [],
      memoryUpdate: { flags: ['talked_to_boss'], currentLocation: 'gray_deer_tavern', knownLocations: ['whitestone_blacksmith', 'market_square'] },
    };
  }

  // --- CHECK BOARD ---
  if (action.id.includes('board') || action.id.includes('notice')) {
    return {
      scene: { title: '委托板', text: pick([
        '板上贴了几张委托：护送商队到银帆港（2银）、调查北边林道狼群（1银）、还有一张写着"急寻旧王国遗物鉴别师"的纸条——报酬面议。',
        '公会委托更新了。最显眼的是用红蜡封着的紧急任务：旧矿洞深处出现不明魔力波动，需要至少Lv.3以上的冒险者前往调查。旁边还有几张护送和采集的普通委托。',
      ]), location: '灰鹿酒馆', time: '傍晚', weather: '晴' },
      event: { id: 'board', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'info', text: '可接取委托赚取金钱和经验。部分委托有等级要求。' }],
      actionOptions: [
        { id: 'accept_board', label: '接下护送商队的委托', type: 'dialogue', risk: 'low' },
        { id: 'go_mine', label: '前往旧矿洞', type: 'travel', risk: 'medium' },
        { id: 'talk_boss', label: '跟老板聊聊', type: 'dialogue', risk: 'low' },
        { id: 'rest_inn', label: '在旅店休息', type: 'cautious', risk: 'low' },
        { id: 'go_port', label: '去银帆港看看', type: 'travel', risk: 'medium' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
      inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
      worldBroadcasts: [],
      memoryUpdate: { flags: ['checked_board'], currentLocation: 'gray_deer_tavern' },
    };
  }

  // --- GO TO MINE from tavern ---
  if (action.id.includes('mine') || action.id.includes('go_mine')) {
    return travelToForest(action, p, ws, judge);
  }

  // --- DEFAULT TAVERN ---
  return {
    scene: { title: '灰鹿酒馆', text: '暖黄色的油灯照着木桌。壁炉上面贴着几张委托。老板在吧台后面擦杯子，偶尔扫一眼门口。你可以在这里休息、打听消息、或者出发冒险。', location: '灰鹿酒馆', time: '傍晚', weather: '晴' },
    event: { id: 'tavern_default', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [],
    actionOptions: [
      { id: 'talk_boss', label: '跟酒馆老板打听消息', type: 'dialogue', risk: 'low' },
      { id: 'check_board', label: '查看公会委托板', type: 'exploration', risk: 'low' },
      { id: 'go_mine', label: '前往旧矿洞', type: 'travel', risk: 'medium' },
      { id: 'go_blacksmith', label: '去铁匠铺', type: 'travel', risk: 'low' },
      { id: 'go_market', label: '去市集', type: 'travel', risk: 'low' },
      { id: 'rest_inn', label: '在旅店休息', type: 'cautious', risk: 'low' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'gray_deer_tavern', knownLocations: ['whitestone_blacksmith', 'market_square', 'adventurers_guild_branch'] },
  };
}

// ===================== INN =====================

function innResponse(action: PlayerAction, p: Player, _ws: WorldState): AIResponse {
  const healHp = Math.floor(p.resources.maxHp * 0.7);
  const healMp = Math.floor(p.resources.maxMp * 0.7);
  return {
    scene: { title: '旅店', text: '旅店老板娘给你安排了房间。简单的木床和干净的被褥——对冒险者来说已经足够了。热水和食物让你恢复了精力。', location: '旅店', time: '稍后', weather: '晴' },
    event: { id: 'inn_rest', type: 'rest_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [{ type: 'reward', text: `充分休息：HP +${healHp}  MP +${healMp}` }],
    actionOptions: [
      { id: 'go_tavern', label: '回灰鹿酒馆', type: 'travel', risk: 'low' },
      { id: 'go_mine', label: '前往旧矿洞', type: 'travel', risk: 'medium' },
      { id: 'go_blacksmith', label: '去铁匠铺', type: 'travel', risk: 'low' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: healHp, mpChange: healMp, expChange: 0, moneyChange: { copper: -8 } },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'whitestone_inn' },
  };
}

// ===================== BLACKSMITH =====================

function blacksmithResponse(action: PlayerAction, p: Player, ws: WorldState, judge: JudgeResult): AIResponse {
  const triedSword = f(ws, 'tried_greatsword');
  const meets = p.attributes.str >= 7;

  // Try the greatsword
  if (action.id.includes('sword') || action.id.includes('great') || action.id.includes('try')) {
    return {
      scene: { title: '生锈大剑', text: `老铁匠从角落拖出一把满是锈迹的大剑。"二十年前旧战场的。太重，没人用得了。"\n\n剑身隐约能看到古代符文——虽然黯淡但结构完整。${meets ? `你的力量(${p.attributes.str})足够拿起它。但部分词条需要更高属性激活。` : `你的力量(${p.attributes.str})不足(str≥7)。可以装备但只能发挥约40%威力，词条全部未激活。`}`, location: '铁匠铺', time: '下午', weather: '晴' },
      event: { id: 'greatsword', type: 'shop_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'info', text: meets ? '可以装备。词条【破甲】(力≥9)和【剑气残响】(力≥8,智≥7)未激活。' : '属性不足！装备后效果仅约40%，命中下降，词条不激活。' }],
      actionOptions: [
        { id: 'buy_sword', label: '买下大剑（15银币）', type: 'trade', risk: 'low' },
        { id: 'ask_history', label: '问老铁匠这把剑的来历', type: 'dialogue', risk: 'low' },
        { id: 'go_tavern', label: '回酒馆', type: 'travel', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: {} },
      inventoryUpdate: meets ? [{ action: 'add', itemId: 'rusty_greatsword', name: '生锈大剑', quantity: 1, type: 'weapon', description: '旧战场捡来的附魔大剑，剑身有古代符文。力≥9激活破甲，力≥8且智≥7激活剑气残响。', rarity: 'uncommon' }] : [],
      questUpdate: [], skillStateUpdate: [], equipmentUpdate: [],
      relationshipUpdate: [{ targetId: 'blacksmith', name: '老铁匠', change: 3, type: 'npc', reason: '你对旧藏品感兴趣。' }],
      mapUpdate: [{ targetId: 'whitestone_blacksmith', name: '铁匠铺', targetType: 'location', status: 'discovered' }],
      worldBroadcasts: [],
      memoryUpdate: { flags: ['tried_greatsword'], currentLocation: 'whitestone_blacksmith', knownLocations: ['whitestone_blacksmith'] },
    };
  }

  // Browse
  return {
    scene: { title: '铁匠铺', text: triedSword
      ? '老铁匠又在打磨新刀。"那把大剑还在角落里。识货的人不多。"他朝角落努了努下巴。炉火烧得正旺，你可以看看其他武器或是修修装备。'
      : '炉火烧得正旺，墙上挂着各式刀剑和护甲。角落有一把锈迹斑斑的大剑，看起来很旧但剑身上的符文……不是普通的剑。',
      location: '铁匠铺', time: '下午', weather: '晴' },
    event: { id: 'blacksmith', type: 'shop_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [],
    actionOptions: [
      { id: 'try_sword', label: '问角落那把大剑', type: 'dialogue', risk: 'low' },
      { id: 'browse_weapons', label: '浏览武器', type: 'trade', risk: 'low' },
      { id: 'repair_gear', label: '修理装备', type: 'trade', risk: 'low' },
      { id: 'go_tavern', label: '回酒馆', type: 'travel', risk: 'low' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'whitestone_blacksmith' },
  };
}

// ===================== GUILD =====================

function guildResponse(action: PlayerAction, _p: Player, _ws: WorldState): AIResponse {
  return {
    scene: { title: '冒险者公会', text: pick([
      '公会大厅里稀稀落落坐了几个冒险者。前台的接待员抬头看你。"有新的委托——不过最近大部分人都去银帆港了。那边商船延误，需要护送人手。"',
      '公会比平时冷清。公告板上贴了银帆港的紧急护送任务，报酬不错但路途不近。一个老猎人坐在角落擦弓，看见你点了下头。',
    ]), location: '冒险者公会', time: '下午', weather: '晴' },
    event: { id: 'guild', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [{ type: 'info', text: '银帆港商船延误，护送任务报酬提升。冒险者公会可以接正式委托。' }],
    actionOptions: [
      { id: 'go_tavern', label: '回酒馆', type: 'travel', risk: 'low' },
      { id: 'go_port', label: '前往银帆港', type: 'travel', risk: 'medium' },
      { id: 'go_mine', label: '去旧矿洞', type: 'travel', risk: 'medium' },
      { id: 'go_blacksmith', label: '去铁匠铺', type: 'travel', risk: 'low' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
    mapUpdate: [{ targetId: 'adventurers_guild_branch', name: '冒险者公会', targetType: 'location', status: 'discovered' }],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'adventurers_guild_branch', knownLocations: ['adventurers_guild_branch'] },
  };
}

// ===================== MARKET =====================

function marketResponse(_action: PlayerAction, _p: Player, _ws: WorldState): AIResponse {
  return {
    scene: { title: '市集', text: pick([
      '市集上摊贩的吆喝声此起彼伏。药草摊前围了几个妇女，旁边铁器摊在卖一些看起来不太靠谱的"幸运护符"。药剂店的招牌在不远处晃着。',
      '市集比平时冷清。药草商说他最近不敢去北边林道进货——狼群比以前多了。问他认不认识旧矿洞的路，他摇了摇头："那边更不好走。"',
    ]), location: '市集', time: '上午', weather: '晴' },
    event: { id: 'market', type: 'shop_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [{ type: 'info', text: '可购买消耗品和材料。药剂店有治疗药水出售（2银/瓶）。' }],
    actionOptions: [
      { id: 'buy_potion', label: '购买治疗药水（2银）', type: 'trade', risk: 'low' },
      { id: 'go_tavern', label: '回酒馆', type: 'travel', risk: 'low' },
      { id: 'go_blacksmith', label: '去铁匠铺', type: 'travel', risk: 'low' },
      { id: 'go_mine', label: '去旧矿洞', type: 'travel', risk: 'medium' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'market_square', knownLocations: ['market_square'] },
  };
}

// ===================== FOREST ROAD =====================

function forestRoadResponse(action: PlayerAction, p: Player, ws: WorldState, judge: JudgeResult): AIResponse {
  const ambushed = f(ws, 'forest_ambush');

  // First time on forest road → wolf ambush
  if (!ambushed) {
    const hpLoss = 3 + Math.floor(Math.random() * 3);
    return {
      scene: { title: '林道遇袭', text: pick([
        '夜雾笼罩着林道。左侧灌木突然剧烈晃动——两只瘦骨嶙峋的灰狼扑了出来。一番搏斗后，你击退了它们。手臂上多了几道抓痕，但不算严重。',
        '你听见灌木丛中有动静。还没来得及拔剑，两只灰狼已经冲了出来。好在你反应够快，一番缠斗后它们夹着尾巴逃回了林子。',
      ]), location: '林道', time: '深夜', weather: '雾' },
      event: { id: 'wolf_ambush', type: 'combat_event', urgency: 'high', riskLevel: 'medium' },
      systemEvents: [{ type: 'penalty', text: `击退狼群，HP -${hpLoss}。经验 +20。` }],
      actionOptions: [
        { id: 'continue_mine', label: '继续前往矿洞', type: 'travel', risk: 'medium' },
        { id: 'loot_wolves', label: '检查狼的尸体', type: 'exploration', risk: 'low' },
        { id: 'go_back', label: '返回酒馆', type: 'travel', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: -hpLoss, mpChange: 0, expChange: 20, moneyChange: {} },
      inventoryUpdate: [{ action: 'add', itemId: 'wolf_pelt', name: '狼皮', quantity: 2, type: 'material', description: '可以卖几个铜币', rarity: 'common' }],
      questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
      mapUpdate: [{ targetId: 'forest_road', name: '林道', targetType: 'location', status: 'discovered' }],
      worldBroadcasts: [],
      memoryUpdate: { flags: ['forest_ambush'], currentLocation: 'forest_road', knownLocations: ['forest_road'] },
    };
  }

  // Already fought wolves, just passing through
  return {
    scene: { title: '林道', text: '你又来到了这条林道。上次遇到狼群的地方还留着几根白骨。雾比上次淡了些，旧矿洞的方向隐约能看到。', location: '林道', time: '清晨', weather: '雾' },
    event: { id: 'forest_pass', type: 'travel_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [],
    actionOptions: [
      { id: 'continue_mine', label: '前往矿洞', type: 'travel', risk: 'low' },
      { id: 'explore_forest', label: '在林中探索', type: 'exploration', risk: 'medium' },
      { id: 'go_back', label: '返回酒馆', type: 'travel', risk: 'low' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'forest_road' },
  };
}

// ===================== MINE ENTRANCE =====================

function mineEntranceResponse(action: PlayerAction, p: Player, ws: WorldState, judge: JudgeResult): AIResponse {
  const entered = f(ws, 'entered_mine');
  const hasMagicSense = p.skills.learned.includes('magic_sense');

  // First time
  if (!entered) {
    const baseOptions: Array<{ id: string; label: string; type: string; risk: 'low' | 'medium' | 'high' | 'extreme'; relatedAttribute?: string; relatedSkill?: string | null; mpCost?: number }> = [
      { id: 'enter_mine', label: '小心进入矿洞', type: 'exploration', risk: 'medium' },
      { id: 'check_tracks', label: '仔细检查脚印', type: 'check', risk: 'low', relatedAttribute: 'wis' },
    ];
    if (hasMagicSense) {
      baseOptions.push({ id: 'detect_magic', label: '使用【魔力感知】探测蓝光', type: 'skill', risk: 'low', relatedSkill: 'magic_sense', mpCost: 1, relatedAttribute: 'int' });
    }
    baseOptions.push({ id: 'go_back', label: '返回酒馆', type: 'travel', risk: 'low' });

    return {
      scene: { title: '旧矿洞入口', text: '矿洞口被几根松散的横木半掩着。地面上有三四个人的新鲜脚印——不是矿工的靴子。入口深处透出微弱的蓝光，空气中弥漫着硫磺味。', location: '旧矿洞入口', time: '凌晨', weather: '雾' },
      event: { id: 'mine_entrance', type: 'exploration_event', urgency: 'normal', riskLevel: 'medium' },
      systemEvents: [{ type: 'info', text: '脚印是软底皮靴——有人比你先来。蓝光在深处一明一灭。' }],
      actionOptions: baseOptions as any,
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 5, moneyChange: {} },
      inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
      mapUpdate: [{ targetId: 'deep_mine_shaft', name: '矿洞深处', targetType: 'location', status: 'discovered' }],
      worldBroadcasts: [],
      memoryUpdate: { flags: ['entered_mine'], currentLocation: 'old_mine_entrance', knownLocations: ['old_mine_entrance', 'deep_mine_shaft'] },
    };
  }

  // Returning
  return {
    scene: { title: '旧矿洞入口', text: '你再次站在矿洞口。横木还在，蓝光还在，硫磺味也还在。', location: '旧矿洞入口', time: '傍晚', weather: '雾' },
    event: { id: 'mine_return', type: 'exploration_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [],
    actionOptions: [
      { id: 'enter_mine', label: '进入矿洞', type: 'exploration', risk: 'medium' },
      { id: 'go_back', label: '返回酒馆', type: 'travel', risk: 'low' },
      { id: 'go_port', label: '前往银帆港', type: 'travel', risk: 'medium' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'old_mine_entrance' },
  };
}

// ===================== DEEP MINE =====================

function deepMineResponse(action: PlayerAction, p: Player, ws: WorldState, judge: JudgeResult): AIResponse {
  const foundBook = f(ws, 'found_skill_book');
  const foundRift = f(ws, 'found_deep_rift');

  // First entry → find skill book
  if (!foundBook) {
    return {
      scene: { title: '废弃侧室', text: pick([
        '矿洞侧室堆满了腐朽的木箱。在角落，一本皮面笔记本出奇地完好——《火焰箭术入门》· 魔法学院初级教程。书中夹着一张便条："如果我不回来了，把笔记带给学院。"落款是两年前。',
        '你在废弃的工具箱里找到一本旧笔记。封面上写着"火焰箭术入门"。纸页已经泛黄但字迹清晰。看起来是某个魔法学徒留下的。',
      ]), location: '矿洞深处', time: '上午', weather: '未知' },
      event: { id: 'skill_book', type: 'discovery_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'reward', text: '获得《火焰箭术入门》！经验 +15。' }],
      actionOptions: [
        { id: 'go_deeper', label: '收起书，继续深入', type: 'exploration', risk: 'medium' },
        { id: 'study_book', label: '翻阅技能书', type: 'item', risk: 'low' },
        { id: 'go_back', label: '返回矿洞口', type: 'travel', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 15, moneyChange: {} },
      inventoryUpdate: [{ action: 'add', itemId: 'fire_arrow_skill_book', name: '《火焰箭术入门》', quantity: 1, type: 'skill_book', description: '魔法学院初级教程。学习需要 Lv.2 智力≥6。', rarity: 'uncommon' }],
      questUpdate: [], skillStateUpdate: [{ skillId: 'fire_arrow', action: 'discover', name: '火焰箭' }], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
      worldBroadcasts: [],
      memoryUpdate: { flags: ['found_skill_book'], currentLocation: 'deep_mine_shaft' },
    };
  }

  // Deeper → find rift
  if (!foundRift && (action.id.includes('deep') || action.id.includes('continue') || action.id.includes('explore'))) {
    return {
      scene: { title: '地底裂隙', text: pick([
        '矿洞最深处，岩壁塌了一大块。一条天然裂隙向下延伸，边缘有被人为凿开的痕迹。从深处涌上的空气带着陌生的气味——香料、铁锈、蛇的气息。\n\n你听到了。很轻的，像在交谈的低语。不是人类的语言。',
        '脚下突然一空——你差点踩进一条深不见底的裂隙。稳住身形后你仔细打量：裂隙的人工凿痕说明有人刻意扩大了这条通道。风吹上来的气味不属于你认识的任何地方。',
      ]), location: '矿洞最深处', time: '中午', weather: '未知' },
      event: { id: 'deep_rift', type: 'discovery_event', urgency: 'normal', riskLevel: 'high' },
      systemEvents: [{ type: 'warning', text: '裂隙下方不是人类世界。推荐等级 12+。低语的语言不属于任何已知种族。' }],
      actionOptions: [
        { id: 'go_back_report', label: '返回向公会报告', type: 'travel', risk: 'low' },
        { id: 'listen_closer', label: '靠近裂隙仔细听', type: 'check', risk: 'high', relatedAttribute: 'wis' },
        { id: 'mark_leave', label: '标记地点，日后再来', type: 'cautious', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 25, moneyChange: {} },
      inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
      mapUpdate: [{ targetId: 'underground_rift_location', name: '地底裂隙', targetType: 'location', status: 'discovered' }, { targetId: 'dark_elf_kingdom', targetType: 'region', name: '地底暗精灵王国', status: 'rumored' }],
      worldBroadcasts: [{ type: 'hidden', region: '地底暗精灵王国', text: '地底深处传来低语。' }],
      memoryUpdate: { flags: ['found_deep_rift'], currentLocation: 'deep_mine_shaft', knownLocations: ['underground_rift_location'] },
    };
  }

  // Return visit
  return {
    scene: { title: '矿洞深处', text: foundRift
      ? '你再次来到裂隙前。低语声还在。这下面一定有什么……但不是现在。你还需要更强的实力。'
      : '矿道在黑暗中延伸。你还能继续深入——或者返回地面。', location: '矿洞深处', time: '未知', weather: '未知' },
    event: { id: 'mine_deep', type: 'exploration_event', urgency: 'low', riskLevel: foundRift ? 'high' : 'medium' },
    systemEvents: [],
    actionOptions: foundRift
      ? [
        { id: 'go_back', label: '返回地面', type: 'travel', risk: 'low' },
        { id: 'go_port', label: '去银帆港', type: 'travel', risk: 'medium' },
      ]
      : [
        { id: 'go_deeper', label: '继续深入', type: 'exploration', risk: 'medium' },
        { id: 'go_back', label: '返回矿洞口', type: 'travel', risk: 'low' },
      ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'deep_mine_shaft' },
  };
}

// ===================== PORT =====================

function portResponse(action: PlayerAction, _p: Player, ws: WorldState): AIResponse {
  const gotTicket = f(ws, 'got_ship_ticket');
  const heardDragon = f(ws, 'heard_dragon_rumor');

  if (!gotTicket) {
    return {
      scene: { title: '银帆港 · 船票办事处', text: '海风带着咸味。文员翻开登记簿。"航线只有两条——自由港和群岛。自由港便宜但不安全，群岛贵一倍但太平。"他抬眼看你，"海那边？龙栖海彼岸停航好几年了。没人敢跑。"', location: '银帆港', time: '上午', weather: '晴' },
      event: { id: 'port_ticket', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'info', text: '龙栖海彼岸：状态「传闻中」。需通过自由港获取船票。推荐等级 20+。' }],
      actionOptions: [
        { id: 'buy_free_port', label: '买自由港船票（5银币）', type: 'trade', risk: 'medium' },
        { id: 'buy_islands', label: '买群岛船票（10银币）', type: 'trade', risk: 'low' },
        { id: 'ask_dragon', label: '追问龙栖海彼岸的事', type: 'dialogue', risk: 'low' },
        { id: 'go_tavern', label: '返回白石镇', type: 'travel', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 5, moneyChange: {} },
      inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
      mapUpdate: [{ targetId: 'silver_sail_port', name: '银帆港', targetType: 'location', status: 'discovered' }],
      worldBroadcasts: [],
      memoryUpdate: { flags: ['got_ship_ticket'], currentLocation: 'silver_sail_port', knownLocations: ['silver_sail_port'] },
    };
  }

  if (!heardDragon && (action.id.includes('dragon') || action.id.includes('ask'))) {
    return {
      scene: { title: '码头老水手', text: '花白胡子的老水手坐在缆桩上补网。"龙栖海彼岸？上次有船长尝试穿越风暴海峡，回来头发全白，航海日志写满了一个词——Dragon。"他深吸一口烟："要真想去，先去自由港找情报。那边什么消息都能买到。"', location: '银帆港 码头', time: '下午', weather: '晴' },
      event: { id: 'dragon_rumor', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'info', text: '解锁情报：龙栖海彼岸。需自由港船票。推荐等级 20+。' }],
      actionOptions: [
        { id: 'ask_more', label: '请老水手再讲一些', type: 'dialogue', risk: 'low' },
        { id: 'buy_him_drink', label: '请他喝一杯套近乎', type: 'social', risk: 'low', relatedAttribute: 'cha' },
        { id: 'go_tavern', label: '返回白石镇', type: 'travel', risk: 'low' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 0, mpChange: 0, expChange: 10, moneyChange: {} },
      inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [],
      relationshipUpdate: [{ targetId: 'old_sailor', name: '老水手', change: 5, type: 'npc', reason: '你对海那边的好奇让他很受用。' }],
      mapUpdate: [{ targetId: 'dragon_coast', targetType: 'region', name: '龙栖海彼岸', status: 'rumored' }],
      worldBroadcasts: [{ type: 'rumor', region: '龙栖海彼岸', text: '风暴中偶尔能看见巨大的影子。那不是云。' }],
      memoryUpdate: { flags: ['heard_dragon_rumor'], currentLocation: 'silver_sail_port' },
    };
  }

  return {
    scene: { title: '银帆港', text: '海风吹过码头。老水手还在补他的网。远方的海平线上什么也没有——至少现在是这样。', location: '银帆港', time: '下午', weather: '晴' },
    event: { id: 'port_idle', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [],
    actionOptions: [
      { id: 'go_tavern', label: '返回白石镇', type: 'travel', risk: 'low' },
      { id: 'talk_sailor', label: '找老水手聊天', type: 'dialogue', risk: 'low' },
      { id: 'explore_port', label: '在港口探索', type: 'exploration', risk: 'medium' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 0, mpChange: 0, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: 'silver_sail_port' },
  };
}

// ===================== TRAVEL / TRANSITIONS =====================

function travelToForest(action: PlayerAction, p: Player, ws: WorldState, judge: JudgeResult): AIResponse {
  return forestRoadResponse(action, p, ws, judge);
}

function travelResponse(action: PlayerAction, p: Player, ws: WorldState, judge: JudgeResult): AIResponse {
  // Detect "go to X" from custom input
  const text = action.customText?.toLowerCase() || action.label?.toLowerCase() || '';
  if (text.includes('矿洞') || text.includes('mine')) return travelToForest(action, p, ws, judge);
  if (text.includes('酒馆') || text.includes('tavern')) {
    return { ...tavernResponse(action, p, ws, judge), memoryUpdate: { flags: [], currentLocation: 'gray_deer_tavern' } };
  }
  if (text.includes('铁匠') || text.includes('blacksmith')) return blacksmithResponse(action, p, ws, judge);
  if (text.includes('港') || text.includes('port') || text.includes('银帆')) return portResponse(action, p, ws);

  // Generic travel
  return {
    scene: { title: '旅途中', text: pick([
      '你沿着土路前行。远处能看到白石镇的炊烟，另一边是黑黢黢的旧矿区。去哪边？',
      '岔路口的风吹得路牌嘎吱作响。左边是回白石镇的方向，右边通往旧矿区，往南走是银帆港。',
    ]), location: '野外', time: '午后', weather: '晴' },
    event: { id: 'travel', type: 'travel_event', urgency: 'low', riskLevel: 'low' },
    systemEvents: [],
    actionOptions: [
      { id: 'go_tavern', label: '回灰鹿酒馆', type: 'travel', risk: 'low' },
      { id: 'go_mine', label: '去旧矿洞', type: 'travel', risk: 'medium' },
      { id: 'go_port', label: '前往银帆港', type: 'travel', risk: 'medium' },
      { id: 'rest_here', label: '就地休息', type: 'cautious', risk: 'low' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 2, mpChange: 2, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: ws.currentLocation || 'forest_road' },
  };
}

// ========== FALLBACK FOR CUSTOM_API FAILURES ==========
export function getFallbackAIResponse(locationId: string, _player: Player): AIResponse {
  const fb: Record<string, AIResponse> = {
    gray_deer_tavern: {
      scene: { title: '灰鹿酒馆', text: '酒馆里的火光依旧温暖。你可以跟老板聊聊、看看委托板、或者出发去其他地方。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '稍后', weather: '晴' },
      event: { id: 'fallback_tavern', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
      systemEvents: [{ type: 'warning', text: 'AI 请求未成功，使用本地回退响应。' }],
      actionOptions: [
        { id: 'fb_talk', label: '跟酒馆老板打听消息', type: 'dialogue', risk: 'low' },
        { id: 'fb_board', label: '查看委托板', type: 'exploration', risk: 'low' },
        { id: 'fb_rest', label: '在旅店休息', type: 'cautious', risk: 'low' },
        { id: 'fb_travel', label: '前往其他地点', type: 'travel', risk: 'medium' },
      ],
      customActionEnabled: true,
      playerUpdate: { hpChange: 1, mpChange: 1, expChange: 0, moneyChange: {} },
      inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
      worldBroadcasts: [],
      memoryUpdate: { flags: [], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern' },
    },
  };
  return fb[locationId] || {
    scene: { title: '冒险途中', text: '你环顾四周。旅程还在继续——选择你的下一步行动。', location: locationId, locationId: locationId, time: '稍后', weather: '晴' },
    event: { id: 'fallback_gen', type: 'neutral', urgency: 'low', riskLevel: 'low' },
    systemEvents: [{ type: 'warning', text: 'AI 未能响应，使用通用回退。' }],
    actionOptions: [
      { id: 'fb_tavern', label: '去灰鹿酒馆', type: 'travel', risk: 'low' },
      { id: 'fb_rest', label: '就地休息', type: 'cautious', risk: 'low' },
      { id: 'fb_explore', label: '探索周围', type: 'exploration', risk: 'medium' },
    ],
    customActionEnabled: true,
    playerUpdate: { hpChange: 1, mpChange: 1, expChange: 0, moneyChange: {} },
    inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [], mapUpdate: [],
    worldBroadcasts: [],
    memoryUpdate: { flags: [], currentLocation: locationId, currentLocationId: locationId },
  };
}
