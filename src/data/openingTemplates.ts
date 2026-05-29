import type { AIResponse } from '../types';

interface OpeningTemplate {
  classId: string;
  responses: AIResponse[];
}

/**
 * Each class has 2-3 opening templates. NOT all in the tavern.
 * No forced quest assignments. Old Mine is only a possible clue, never a default main quest.
 */
export const OPENING_TEMPLATES: OpeningTemplate[] = [
  // ===== 魔法师 =====
  {
    classId: 'mage',
    responses: [
      {
        scene: { title: '灰鹿酒馆', text: '你推开灰鹿酒馆的木门，雨水顺着学徒长袍滴落。怀里的破旧魔法笔记还带着学院图书馆的霉味——那是你退学前偷带出来的唯一东西。\n\n酒馆里的火光让你眯了眯眼。几个常客扫了你一眼，继续喝酒。角落一个戴着兜帽的人似乎多看了你两秒。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_mage_1', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你的魔力感知隐约察觉到——角落里那个人身上有微弱的魔力残留。' }],
        actionOptions: [
          { id: 'sit_at_bar', label: '在吧台坐下，点一杯麦酒', type: 'dialogue', risk: 'low' },
          { id: 'observe_corner', label: '观察角落那个兜帽人', type: 'check', risk: 'low', relatedAttribute: 'wis' },
          { id: 'check_board', label: '看看委托板上贴了什么', type: 'exploration', risk: 'low' },
          { id: 'read_notes', label: '翻开魔法笔记温习', type: 'item', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
      {
        scene: { title: '退学之路', text: '你站在白石镇外的土路上，回头还能看到魔法学院的塔尖——已经很远很远了。\n\n退学手续比你想象的简单：签个字，交出学院徽章，门卫就让你走了。你怀里只剩那本破旧笔记。\n\n天快黑了。前面是灰鹿酒馆的灯光。', location: '白石镇郊外', locationId: 'whitestone_outskirts', time: '雾月3日 傍晚', weather: '阴' },
        event: { id: 'opening_mage_2', type: 'travel_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '快天黑了。灰鹿酒馆就在前面不远处。' }],
        actionOptions: [
          { id: 'enter_tavern', label: '走进灰鹿酒馆', type: 'travel', risk: 'low' },
          { id: 'look_back', label: '回头看一眼学院的方向', type: 'check', risk: 'low', relatedAttribute: 'wis' },
          { id: 'check_surroundings', label: '查看周围有没有危险', type: 'check', risk: 'low', relatedAttribute: 'wis' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'whitestone_outskirts', currentLocationId: 'whitestone_outskirts', knownLocations: ['whitestone_outskirts', 'gray_deer_tavern'] },
      },
    ],
  },
  // ===== 游侠 =====
  {
    classId: 'ranger',
    responses: [
      {
        scene: { title: '林道幸存者', text: '你带着松针和泥水的气味站在灰鹿酒馆门口。三天前护送的商队在林道失散，你是唯一的幸存者——至少你认为自己是。\n\n商队的货物散落在林子里，而你的同伴不知所踪。你回镇上是为了找人帮忙，或者至少买点补给。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_ranger_1', type: 'dialogue_event', urgency: 'normal', riskLevel: 'medium' },
        systemEvents: [{ type: 'info', text: '你手臂上还有林道里的擦伤。商队失散的线索不多——但你记得袭击前闻到了一股奇怪的焦味。' }],
        actionOptions: [
          { id: 'enter_tavern', label: '推门走进酒馆', type: 'travel', risk: 'low' },
          { id: 'check_wound', label: '在门口处理手臂擦伤', type: 'cautious', risk: 'low' },
          { id: 'look_for_guard', label: '先去找城卫队报告商队袭击', type: 'travel', risk: 'low' },
          { id: 'track_smell', label: '回忆那股奇怪的焦味来源', type: 'check', risk: 'low', relatedAttribute: 'wis' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: -1, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [{ type: 'rumor', region: '人类联邦', text: '一支商队在林道附近失散，据说只有一人生还。' }],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern', 'forest_road'] },
      },
      {
        scene: { title: '北边林道', text: '晨雾还没散。你蹲在一棵倒下的松树旁，指尖摩挲着地上的泥土——脚印在这里突然断了。\n\n商队在三天前经过这里。他们的货物散落在百米外的灌木丛里，但没留下血迹。这个事实让你更加不安。\n\n远处传来灰鹿酒馆烟囱的炊烟味。你需要补给，也需要信息。', location: '北边林道', locationId: 'forest_road', time: '雾月3日 清晨', weather: '雾' },
        event: { id: 'opening_ranger_2', type: 'exploration_event', urgency: 'normal', riskLevel: 'medium' },
        systemEvents: [{ type: 'info', text: '你的追踪经验告诉你：商队不是被野兽袭击的。脚印太整齐了。' }],
        actionOptions: [
          { id: 'follow_tracks', label: '顺着残留的脚印追踪', type: 'check', risk: 'medium', relatedAttribute: 'wis' },
          { id: 'go_tavern', label: '先回灰鹿酒馆打听消息', type: 'travel', risk: 'low' },
          { id: 'check_scattered_goods', label: '翻查散落的货物', type: 'exploration', risk: 'low' },
          { id: 'find_high_point', label: '找个高处俯瞰周围', type: 'exploration', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 5, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'forest_road', targetType: 'location', name: '林道', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'forest_road', currentLocationId: 'forest_road', knownLocations: ['forest_road', 'gray_deer_tavern'] },
      },
    ],
  },
  // ===== 剑士 =====
  {
    classId: 'warrior',
    responses: [
      {
        scene: { title: '灰鹿酒馆', text: '你的铁剑靠在桌腿上，剑刃还沾着前几日的旅尘。佣兵团解散了——队长说接不到足够的活，大家各奔东西。\n\n这是你第一次独自走进灰鹿酒馆。以前都是跟团友们一起，点上几杯最便宜的麦酒，聊着下一个委托。现在只剩你一个人了。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '多云' },
        event: { id: 'opening_warrior_1', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '吧台后面贴了几张新的委托单。公会最近似乎缺人手。' }],
        actionOptions: [
          { id: 'check_board', label: '看看委托板上的新活', type: 'exploration', risk: 'low' },
          { id: 'talk_boss', label: '跟酒馆老板打听消息', type: 'dialogue', risk: 'low' },
          { id: 'clean_sword', label: '擦擦剑，想想接下来的打算', type: 'cautious', risk: 'low' },
          { id: 'look_for_old_mates', label: '看看有没有前团友在酒馆里', type: 'check', risk: 'low', relatedAttribute: 'wis' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
      {
        scene: { title: '白石镇城门', text: '你靠在白石镇的城门边，看着陆续进出的马车和旅人。佣兵团的旗子已经收起来了——队长说至少三个月内不会有新合同。\n\n城门口有两个城卫兵在闲聊。其中一个提到"矿洞那边又出事了"，另一个让他别多管闲事。\n\n你需要新的收入来源。灰鹿酒馆是个开始的好地方。', location: '白石镇城门', locationId: 'whitestone_gate', time: '雾月3日 下午', weather: '阴' },
        event: { id: 'opening_warrior_2', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你听到城卫兵提到了矿洞。但你不一定非得去——酒馆里的委托板选择更多。' }],
        actionOptions: [
          { id: 'go_tavern', label: '去灰鹿酒馆找新委托', type: 'travel', risk: 'low' },
          { id: 'ask_guards', label: '向城卫兵打听矿洞的事', type: 'dialogue', risk: 'low' },
          { id: 'go_blacksmith', label: '先去铁匠铺磨磨剑', type: 'travel', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'whitestone_gate', currentLocationId: 'whitestone_gate', knownLocations: ['whitestone_gate', 'gray_deer_tavern'] },
      },
    ],
  },
  // ===== 盗贼 =====
  {
    classId: 'thief',
    responses: [
      {
        scene: { title: '灰鹿酒馆后巷', text: '你从后门溜进灰鹿酒馆，黑色斗篷还滴着雨水。后巷里没有人——你确认过了。\n\n你欠黑市一笔钱，数目不大但利息在涨。今晚你需要一个能快速赚钱的委托，或者至少找到一个愿意赊账的雇主。酒馆里的委托板是你的第一站。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 深夜', weather: '雨' },
        event: { id: 'opening_thief_1', type: 'dialogue_event', urgency: 'normal', riskLevel: 'medium' },
        systemEvents: [{ type: 'info', text: '黑市的债主给了你一周的宽限。时间不多了——但也不算太紧。' }],
        actionOptions: [
          { id: 'check_board', label: '溜到委托板前看有什么活', type: 'exploration', risk: 'low' },
          { id: 'eavesdrop', label: '偷听旁边桌的对话', type: 'skill', risk: 'low', relatedSkill: 'eavesdrop' },
          { id: 'talk_boss', label: '试着跟酒馆老板套近乎', type: 'social', risk: 'low', relatedAttribute: 'cha' },
          { id: 'find_back_exit', label: '确认所有出口的位置', type: 'cautious', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
      {
        scene: { title: '市集暗巷', text: '市集已经散了，只剩几个收拾摊位的商贩。你靠在暗巷的墙边，看着最后一批马车驶出镇门。\n\n今天踩点收获不大。只有药剂店的后窗看起来容易进，但里面没什么值钱的东西。你需要一个更靠谱的生计——也许是时候去灰鹿酒馆看看有没有正经委托了。', location: '市集暗巷', locationId: 'market_square', time: '雾月3日 傍晚', weather: '阴' },
        event: { id: 'opening_thief_2', type: 'exploration_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你注意到市集今天来了几个陌生面孔——不像是本地人。' }],
        actionOptions: [
          { id: 'go_tavern', label: '去灰鹿酒馆找活干', type: 'travel', risk: 'low' },
          { id: 'follow_stranger', label: '跟踪一个可疑的陌生人', type: 'stealth', risk: 'medium', relatedAttribute: 'dex' },
          { id: 'check_pharmacy', label: '趁天黑前再探探药剂店', type: 'stealth', risk: 'medium', relatedAttribute: 'dex' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'market_square', targetType: 'location', name: '市集', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'market_square', currentLocationId: 'market_square', knownLocations: ['market_square', 'gray_deer_tavern'] },
      },
    ],
  },
  // ===== 牧师 =====
  {
    classId: 'priest',
    responses: [
      {
        scene: { title: '小礼拜堂', text: '小礼拜堂的石墙上爬满了青苔。你是奉教会命令来到边境的——上面说最近乡镇周边的"邪祟"事件增多，需要一个低级牧师去做初步调查。\n\n说实话，你觉得上面只是想把你打发到远离圣都的地方。但无论如何，礼拜堂里已经没人了——上一任牧师上个月就调走了。\n\n你需要找个地方住。灰鹿酒馆是镇上唯一的选择。', location: '小礼拜堂', locationId: 'small_chapel', time: '雾月3日 傍晚', weather: '阴' },
        event: { id: 'opening_priest_1', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '礼拜堂的访客登记簿上，最后一条是上个月的。"矿工家属来祈祷"——然后就没了。' }],
        actionOptions: [
          { id: 'go_tavern', label: '去灰鹿酒馆找住处', type: 'travel', risk: 'low' },
          { id: 'pray_here', label: '在礼拜堂做一次祝祷', type: 'skill', risk: 'low', relatedSkill: 'blessing', mpCost: 3 },
          { id: 'check_register', label: '细看访客登记簿', type: 'check', risk: 'low', relatedAttribute: 'wis' },
          { id: 'look_around_chapel', label: '检查礼拜堂是否被人翻过', type: 'check', risk: 'low', relatedAttribute: 'wis' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'small_chapel', targetType: 'location', name: '小礼拜堂', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'small_chapel', currentLocationId: 'small_chapel', knownLocations: ['small_chapel', 'gray_deer_tavern'] },
      },
      {
        scene: { title: '灰鹿酒馆', text: '你推门走进灰鹿酒馆。老板娘看了你一眼——准确说，看了你胸前的圣徽一眼。"教会的人？好久没见过了。"\n\n你要了一杯热水——酒馆里没有——然后在角落坐下。边境的生活比圣都简陋得多。但这也是你申请调来这里的原因：离那些政治斗争远一点。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '阴' },
        event: { id: 'opening_priest_2', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '酒馆里有几个人注意到了你的圣徽。大部分只是好奇，但角落一个男人似乎刻意避开了目光。' }],
        actionOptions: [
          { id: 'talk_boss', label: '向老板娘打听镇上的事', type: 'dialogue', risk: 'low' },
          { id: 'observe_man', label: '观察那个避开目光的男人', type: 'check', risk: 'low', relatedAttribute: 'wis' },
          { id: 'check_board', label: '看看委托板', type: 'exploration', risk: 'low' },
          { id: 'rest_and_pray', label: '先安顿下来，做晚祷', type: 'cautious', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
    ],
  },
  // ===== 野蛮人 =====
  {
    classId: 'barbarian',
    responses: [
      {
        scene: { title: '林道路边', text: '你坐在路边一块石头上，粗制战斧插在身旁的泥地里。走了三天，脚底的水泡已经麻木了。\n\n有人告诉你南边有活干——没说具体是什么——所以你就来了。灰鹿酒馆的灯光在前方几百步外闪动。那意味着麦酒、热食和可能打架。', location: '林道', locationId: 'forest_road', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_barbarian_1', type: 'travel_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你饿得前胸贴后背。身上只剩几块肉干和十枚铜币。' }],
        actionOptions: [
          { id: 'go_tavern', label: '冲进灰鹿酒馆大吃一顿', type: 'travel', risk: 'low' },
          { id: 'check_surroundings', label: '先看看周围有没有猎物', type: 'check', risk: 'low', relatedAttribute: 'wis' },
          { id: 'rest_here', label: '先在路边休息一会儿', type: 'cautious', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: -1, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'forest_road', targetType: 'location', name: '林道', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'forest_road', currentLocationId: 'forest_road', knownLocations: ['forest_road', 'gray_deer_tavern'] },
      },
      {
        scene: { title: '灰鹿酒馆', text: '你推开灰鹿酒馆的门，力道没控制好——门撞在墙上发出巨响。酒馆里静了两秒。\n\n"抱歉。"你吼了一声。酒客们纷纷转回去继续喝酒。老板娘摇了摇头，但嘴角似乎有一丝笑意。\n\n你需要工作。而且说实话——你需要有人告诉你去哪打。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_barbarian_2', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '酒馆里几个冒险者偷偷打量你——但不是敌意，更像是评估你能扛几拳。' }],
        actionOptions: [
          { id: 'check_board', label: '去看委托板有没有打架的活', type: 'exploration', risk: 'low' },
          { id: 'challenge', label: '问有没有人想比划比划', type: 'social', risk: 'medium', relatedAttribute: 'cha' },
          { id: 'eat_drink', label: '先吃顿饭再说', type: 'cautious', risk: 'low' },
          { id: 'talk_boss', label: '对着吧台吼一声"有活没"', type: 'dialogue', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 2, mpChange: 0, expChange: 3, moneyChange: { copper: -5 } },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
    ],
  },
  // ===== 炼金术士 =====
  {
    classId: 'alchemist',
    responses: [
      {
        scene: { title: '药剂店门口', text: '药剂店的老板刚刚告诉你——最近几周都没有草药进货。"北边林道不安全，没人敢去采。"\n\n你的炼金包里只剩一瓶治疗药水和一瓶燃烧瓶。材料快用完了。你需要自己去采，或者找到能供应的商人。', location: '药剂店', locationId: 'potion_shop', time: '雾月3日 下午', weather: '阴' },
        event: { id: 'opening_alchemist_1', type: 'shop_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '药剂店老板提到：如果自己去采，北边林子深处有银叶草和月光菇——但最近有狼。' }],
        actionOptions: [
          { id: 'go_tavern', label: '去灰鹿酒馆打听消息', type: 'travel', risk: 'low' },
          { id: 'buy_herbs', label: '在药剂店买点剩余材料', type: 'trade', risk: 'low' },
          { id: 'go_forest', label: '自己去北边林道采药', type: 'travel', risk: 'medium' },
          { id: 'check_market', label: '去市集找草药商', type: 'travel', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'potion_shop', targetType: 'location', name: '药剂店', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [{ type: 'economy', region: '人类联邦', text: '药草供应紧张，药剂价格上涨。' }],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'potion_shop', currentLocationId: 'potion_shop', knownLocations: ['potion_shop', 'gray_deer_tavern'] },
      },
      {
        scene: { title: '灰鹿酒馆', text: '你需要一个安静角落整理你的炼金包。灰鹿酒馆最里面的桌子光线不好，但没人打扰——正合适。\n\n你铺开材料清单：银叶草、月光菇、火石粉。缺的比有的多。\n\n酒馆里有人在讨论最近的传闻，或许能打听到一些采购线索。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_alchemist_2', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '一旁的桌上传来了"稀罕材料"和"旧矿区"的字眼。不过也可能是吹牛的。' }],
        actionOptions: [
          { id: 'eavesdrop_next_table', label: '偷听隔壁桌的对话', type: 'check', risk: 'low', relatedAttribute: 'wis' },
          { id: 'check_board', label: '看看委托板', type: 'exploration', risk: 'low' },
          { id: 'organize_kit', label: '整理炼金包和材料清单', type: 'item', risk: 'low' },
          { id: 'talk_boss', label: '向老板打听药草进货的消息', type: 'dialogue', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
    ],
  },
  // ===== 贵族落魄子弟 =====
  {
    classId: 'noble',
    responses: [
      {
        scene: { title: '旅店房间', text: '旅店老板娘刚刚离开，带走了你最后的两枚银币。这间房能住三晚。三晚之后，你只剩下手指上这枚家族旧戒。\n\n你从王都逃出来已经两周了。不是为了逃避什么人——是为了逃避那种一眼能望到头的生活。可是现在窗外雨声淅沥，你又觉得那种生活至少不会让你在旅店里啃干面包。', location: '旅店', locationId: 'whitestone_inn', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_noble_1', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你的家族旧戒值不少钱，但你现在还不想卖掉它。那是你唯一的身份证明。' }],
        actionOptions: [
          { id: 'go_tavern', label: '去灰鹿酒馆看看有没有适合你的活', type: 'travel', risk: 'low' },
          { id: 'check_ring', label: '仔细看看家族旧戒上的纹章', type: 'item', risk: 'low' },
          { id: 'write_letter', label: '给家里写信——但未必会寄出去', type: 'cautious', risk: 'low' },
          { id: 'go_market', label: '去市集看看有什么差事', type: 'travel', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'whitestone_inn', targetType: 'location', name: '旅店', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'whitestone_inn', currentLocationId: 'whitestone_inn', knownLocations: ['whitestone_inn', 'gray_deer_tavern'] },
      },
      {
        scene: { title: '灰鹿酒馆', text: '你推开灰鹿酒馆的门，尽量让自己看起来不像第一次进这种地方。礼服外套被雨淋湿了一半，但站姿仍然是老样子——脊背挺直，下巴微抬。\n\n酒馆老板看了你一眼，没有多说什么。你注意到有人偷瞄你的细剑——那可不是便宜货。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_noble_2', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你注意到委托板上有一张写着"急寻旧王国遗物鉴别师"的纸条。' }],
        actionOptions: [
          { id: 'check_board', label: '看那张关于旧王国遗物的纸条', type: 'exploration', risk: 'low' },
          { id: 'talk_boss', label: '以礼貌的姿态向老板打听', type: 'social', risk: 'low', relatedAttribute: 'cha' },
          { id: 'sit_quietly', label: '找个角落坐下，先观察', type: 'cautious', risk: 'low' },
          { id: 'approach_interesting_person', label: '找看起来最有身份的人攀谈', type: 'social', risk: 'medium', relatedAttribute: 'cha' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
    ],
  },
  // ===== 流浪者 =====
  {
    classId: 'wanderer',
    responses: [
      {
        scene: { title: '林道醒来', text: '你睁开眼，发现自己躺在林道路边的一棵松树下。不记得怎么到这儿的——只记得昨晚雨很大，你找到这棵树挡雨。\n\n衣服还是湿的，干粮剩两包。远处有炊烟——那应该是白石镇的方向。你爬起来，拍了拍身上的松针。', location: '林道', locationId: 'forest_road', time: '雾月3日 清晨', weather: '雾' },
        event: { id: 'opening_wanderer_1', type: 'travel_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你不会在一个地方待太久。但现在你需要补给——吃的、喝的，或许还能找到些零活。' }],
        actionOptions: [
          { id: 'go_town', label: '朝炊烟方向走去白石镇', type: 'travel', risk: 'low' },
          { id: 'check_belongings', label: '检查身上还有什么', type: 'item', risk: 'low' },
          { id: 'look_for_food', label: '在附近找找有没有野果或水源', type: 'exploration', risk: 'low' },
          { id: 'follow_bird', label: '跟着一只乌鸦看看它飞去哪', type: 'exploration', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: -1, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'forest_road', targetType: 'location', name: '林道', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'forest_road', currentLocationId: 'forest_road', knownLocations: ['forest_road', 'gray_deer_tavern'] },
      },
      {
        scene: { title: '灰鹿酒馆', text: '你不知道下一顿饭在哪里。但你知道——每个镇子的酒馆里总有需要帮手的人。\n\n你推开灰鹿酒馆的门，找了个靠火的位置坐下。衣服慢慢干了。你没有急着去问委托——在这里坐一会儿，听一听，看一看，机会自己会浮出来。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_wanderer_2', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你注意到委托板上有几张新帖的纸，一个猎人在角落擦弓，老板娘在吧台后面忙活。' }],
        actionOptions: [
          { id: 'watch_and_listen', label: '坐着听听周围的对话', type: 'check', risk: 'low', relatedAttribute: 'wis' },
          { id: 'talk_boss', label: '跟老板娘闲聊', type: 'social', risk: 'low', relatedAttribute: 'cha' },
          { id: 'check_board', label: '看看委托板', type: 'exploration', risk: 'low' },
          { id: 'talk_to_hunter', label: '跟那个擦弓的猎人搭话', type: 'dialogue', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 2, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
    ],
  },
  // ===== 吟游诗人 =====
  {
    classId: 'bard',
    responses: [
      {
        scene: { title: '市集角落', text: '你坐在市集的石头台阶上，拨了几下旧鲁特琴的弦。今天弹了三首歌，帽子里只有几个铜币。\n\n不过你不在乎钱——你在乎的是一个戴兜帽的人刚才走过时，低声说了一句"王都派了魔法检察官下来"。\n\n传闻比铜币值钱。你收起琴，决定去灰鹿酒馆看看晚上还有没有什么故事可听。', location: '市集', locationId: 'market_square', time: '雾月3日 下午', weather: '阴' },
        event: { id: 'opening_bard_1', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '传闻总是从酒馆流向四面八方。今晚灰鹿酒馆肯定有故事。' }],
        actionOptions: [
          { id: 'go_tavern', label: '去灰鹿酒馆收集故事', type: 'travel', risk: 'low' },
          { id: 'follow_hooded', label: '跟踪那个提到魔法检察官的人', type: 'stealth', risk: 'medium', relatedAttribute: 'dex' },
          { id: 'play_one_more', label: '再弹一首，看看还有没有人给钱', type: 'social', risk: 'low', relatedAttribute: 'cha' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: { copper: 3 } },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'market_square', targetType: 'location', name: '市集', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'market_square', currentLocationId: 'market_square', knownLocations: ['market_square', 'gray_deer_tavern'] },
      },
      {
        scene: { title: '灰鹿酒馆', text: '你推开灰鹿酒馆的门，扫了一圈酒客。今晚人不多——但有一群商人在角落喝酒，他们总有故事。\n\n你把琴靠在桌边，打算先叫一杯麦酒。老板娘看到你的琴，眼睛亮了一下——看来今晚有免费表演的需求。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_bard_2', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '老板娘朝你使了个眼色——如果你愿意弹两首，她愿意请你喝一杯。' }],
        actionOptions: [
          { id: 'perform', label: '拿出琴弹一首传闻中的曲子', type: 'social', risk: 'low', relatedAttribute: 'cha' },
          { id: 'talk_to_merchants', label: '坐到商人那桌旁边去', type: 'social', risk: 'low', relatedAttribute: 'cha' },
          { id: 'check_board', label: '看看委托板上有没有怪事', type: 'exploration', risk: 'low' },
          { id: 'talk_boss', label: '先跟老板娘套近乎', type: 'social', risk: 'low', relatedAttribute: 'cha' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
    ],
  },
  // ===== 学者 =====
  {
    classId: 'scholar',
    responses: [
      {
        scene: { title: '旅店房间', text: '你趴在旅店房间的小桌上，厚典籍摊开在烛光下。古籍提到白石镇附近某处有旧王国时期的遗迹——但位置模糊，只说"矿区以北，松木间"。\n\n窗外雨声不断。你的旅费快用完了。你需要找到那个遗迹，或者至少找到一个愿意资助你研究的人。', location: '旅店', locationId: 'whitestone_inn', time: '雾月3日 深夜', weather: '雨' },
        event: { id: 'opening_scholar_1', type: 'exploration_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '古籍上的坐标信息残缺不全，但隐约提到了白石镇周边的几个地名。' }],
        actionOptions: [
          { id: 'go_tavern', label: '去灰鹿酒馆打听当地历史', type: 'travel', risk: 'low' },
          { id: 'keep_reading', label: '继续研读古籍寻找更多线索', type: 'check', risk: 'low', relatedAttribute: 'int' },
          { id: 'go_guild', label: '去冒险者公会看看有没有相关委托', type: 'travel', risk: 'low' },
          { id: 'ask_innkeeper', label: '向旅店老板娘打听镇上老人', type: 'dialogue', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 5, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'whitestone_inn', targetType: 'location', name: '旅店', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'whitestone_inn', currentLocationId: 'whitestone_inn', knownLocations: ['whitestone_inn', 'gray_deer_tavern'] },
      },
      {
        scene: { title: '灰鹿酒馆', text: '你带着笔记本走进灰鹿酒馆。有人在喝酒，有人在吹牛，但你的兴趣在别处——酒馆老板据说收藏了几份旧地图，从老矿工手里收来的。\n\n你找到一个靠角落的位子，点了杯热茶。希望能找到愿意跟你聊聊本地史料的人。', location: '灰鹿酒馆', locationId: 'gray_deer_tavern', time: '雾月3日 夜晚', weather: '雨' },
        event: { id: 'opening_scholar_2', type: 'dialogue_event', urgency: 'low', riskLevel: 'low' },
        systemEvents: [{ type: 'info', text: '你听说酒馆老板有几份老矿工留下的旧地图——或许跟古籍里的坐标有关。' }],
        actionOptions: [
          { id: 'ask_boss_maps', label: '请老板给你看旧地图', type: 'dialogue', risk: 'low' },
          { id: 'check_board', label: '扫一眼委托板上有无考古相关任务', type: 'exploration', risk: 'low' },
          { id: 'take_notes', label: '拿出笔记本整理已知线索', type: 'item', risk: 'low' },
          { id: 'talk_to_old_man', label: '找酒馆里最老的人问旧事', type: 'social', risk: 'low', relatedAttribute: 'cha' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 3, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'gray_deer_tavern', currentLocationId: 'gray_deer_tavern', knownLocations: ['gray_deer_tavern'] },
      },
    ],
  },
  // ===== 猎魔人 =====
  {
    classId: 'witch_hunter',
    responses: [
      {
        scene: { title: '白石镇墓园外', text: '墓园的铁栅栏上结了一层不该有的霜——现在是雾月，但霜只在墓园里面。你用银匕首在栅栏上划了一道，刃尖微微发蓝。\n\n有低等邪祟来过。不严重——但足以让几座新坟的草长得比周围快。\n\n你站起身。这种事不值得报告教会，但值得查下去。灰鹿酒馆的旅人常带些边远地方的消息。', location: '白石镇墓园', locationId: 'whitestone_cemetery', time: '雾月3日 傍晚', weather: '阴' },
        event: { id: 'opening_witch_hunter_1', type: 'exploration_event', urgency: 'normal', riskLevel: 'medium' },
        systemEvents: [{ type: 'info', text: '低等邪祟的活动——目前只是痕迹，不构成直接威胁。但你在边境待久了就知道：小事后面常跟着大事。' }],
        actionOptions: [
          { id: 'go_tavern', label: '去灰鹿酒馆打听消息', type: 'travel', risk: 'low' },
          { id: 'track_creature', label: '在墓园周边追踪邪祟痕迹', type: 'skill', risk: 'medium', relatedSkill: 'track_evil', mpCost: 2 },
          { id: 'check_graves', label: '仔细检查那几座新坟', type: 'check', risk: 'medium', relatedAttribute: 'wis' },
          { id: 'report_church', label: '先去小礼拜堂记录此事', type: 'travel', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 5, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [{ targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' }],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'whitestone_cemetery', currentLocationId: 'whitestone_cemetery', knownLocations: ['whitestone_cemetery', 'gray_deer_tavern'] },
      },
      {
        scene: { title: '林道旁', text: '你在林道旁发现了一头死鹿。不是被狼咬死的——没有血。尸体完整，但瞳孔全白。\n\n你把银匕首靠近鹿的额头，刃身微微发暗。这不是低等邪祟——至少要强一些。痕迹朝东南方向延伸，恰好是白石镇的方向。\n\n你需要在镇上找个据点。灰鹿酒馆是最容易收集信息的地方。', location: '林道', locationId: 'forest_road', time: '雾月3日 清晨', weather: '雾' },
        event: { id: 'opening_witch_hunter_2', type: 'exploration_event', urgency: 'normal', riskLevel: 'medium' },
        systemEvents: [{ type: 'info', text: '这头鹿的死亡方式不太寻常。你需要更多信息才能判断是什么东西干的。' }],
        actionOptions: [
          { id: 'go_tavern', label: '前往灰鹿酒馆', type: 'travel', risk: 'low' },
          { id: 'analyze_deer', label: '用怪物辨识分析死因', type: 'skill', risk: 'low', relatedSkill: 'monster_identify' },
          { id: 'follow_trail', label: '沿着痕迹追踪', type: 'check', risk: 'medium', relatedAttribute: 'wis' },
          { id: 'bury_deer', label: '把死鹿埋了防止扩散', type: 'cautious', risk: 'low' },
        ],
        customActionEnabled: true,
        playerUpdate: { hpChange: 0, mpChange: 0, expChange: 5, moneyChange: {} },
        inventoryUpdate: [], questUpdate: [], skillStateUpdate: [], equipmentUpdate: [], relationshipUpdate: [],
        mapUpdate: [
          { targetId: 'forest_road', targetType: 'location', name: '林道', status: 'discovered' },
          { targetId: 'gray_deer_tavern', targetType: 'location', name: '灰鹿酒馆', status: 'discovered' },
        ],
        worldBroadcasts: [],
        memoryUpdate: { flags: ['game_started'], currentLocation: 'forest_road', currentLocationId: 'forest_road', knownLocations: ['forest_road', 'gray_deer_tavern'] },
      },
    ],
  },
];

export function getOpeningByClass(classId: string, sanitizedOrigin: string): AIResponse | null {
  const template = OPENING_TEMPLATES.find(t => t.classId === classId);
  if (!template || template.responses.length === 0) return null;

  // Pick a random template for this class
  const idx = Math.floor(Math.random() * template.responses.length);
  const response = JSON.parse(JSON.stringify(template.responses[idx])) as AIResponse;

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
