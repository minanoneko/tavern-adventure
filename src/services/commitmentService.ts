import type { AIResponse, PlayerAction, WorldState, Player, PaymentCommitment, Money } from '../types';
import type { LogEntry } from '../types/log';
import { createLogEntry } from '../types/log';
import { moneyToCopper, copperToMoney, formatMoneyChange } from '../utils/moneyUtils';

type MoneyChange = { gold?: number; silver?: number; copper?: number };

const PAY_WORDS = /付|支付|给了|递给|交给|结清|兑现|报酬|酬劳|赏钱|银币|铜币|金币|钱呢|钱/;
const ACCEPT_WORDS = /答应|同意|成交|可以|行吧|点头|应下|愿意|承诺|说定|一言为定/;
const REFUSE_WORDS = /拒绝|不可能|太贵|离谱|没那么多|付不起|还价|砍价|摇头|冷笑|嗤笑/;

function normalizeMoney(m?: MoneyChange): Money {
  return {
    gold: Math.max(0, Math.floor(m?.gold || 0)),
    silver: Math.max(0, Math.floor(m?.silver || 0)),
    copper: Math.max(0, Math.floor(m?.copper || 0)),
  };
}

function parseMoney(text: string): Money | null {
  const money: Money = { gold: 0, silver: 0, copper: 0 };
  const patterns: Array<[keyof Money, RegExp]> = [
    ['gold', /(\d+)\s*(?:金|金币)/g],
    ['silver', /(\d+)\s*(?:银|银币)/g],
    ['copper', /(\d+)\s*(?:铜|铜币)/g],
  ];

  for (const [key, regex] of patterns) {
    for (const match of text.matchAll(regex)) {
      money[key] += Number(match[1] || 0);
    }
  }

  return moneyToCopper(money) > 0 ? money : null;
}

function servicePaymentCap(player: Player, action?: PlayerAction): number {
  const text = action?.customText || '';
  if (/任务|委托|危险|战斗|护送|救|追回|夺回/.test(text)) {
    return player.level <= 3 ? 300 : player.level <= 5 ? 1000 : 3000;
  }
  if (/鉴定|检查|辨认|查看|解读|翻译|修理|带路|传话/.test(text)) {
    return player.level <= 3 ? 100 : player.level <= 5 ? 300 : 800;
  }
  return player.level <= 3 ? 100 : player.level <= 5 ? 500 : 1500;
}

function makeCommitmentId(worldState: WorldState): string {
  return `pay_${Date.now()}_${worldState.paymentCommitments.length}`;
}

function getActionText(action?: PlayerAction): string {
  return action?.customText || action?.id || '';
}

function inferPayer(response: AIResponse): string {
  return response.relationshipUpdate.find(u => (u.type || 'npc') === 'npc' && u.name)?.name || '当前NPC';
}

function inferReason(actionText: string, response: AIResponse): string {
  const compact = actionText.replace(/\s+/g, '').slice(0, 28);
  if (compact) return compact;
  return response.scene.title || '当前服务';
}

function sumPositiveStructuredMoney(response: AIResponse): number {
  const playerMoney = moneyToCopper(response.playerUpdate.moneyChange || {});
  const inventoryMoney = response.inventoryUpdate
    .filter(u => u.action === 'add' && u.type === 'money')
    .reduce((sum, update) => {
      const parsed = parseMoney(update.name || '') || normalizeMoney({ copper: update.quantity || 0 });
      return sum + moneyToCopper(parsed);
    }, 0);
  return Math.max(0, playerMoney) + inventoryMoney;
}

function stripPositiveMoneyUpdates(response: AIResponse): void {
  const change = response.playerUpdate.moneyChange || {};
  response.playerUpdate.moneyChange = {
    gold: Math.min(0, change.gold || 0),
    silver: Math.min(0, change.silver || 0),
    copper: Math.min(0, change.copper || 0),
  };
  response.inventoryUpdate = response.inventoryUpdate.filter(u => !(u.action === 'add' && u.type === 'money'));
}

function pendingPayment(worldState: WorldState): PaymentCommitment | undefined {
  return (worldState.paymentCommitments || [])
    .filter(c => c.type === 'payment' && c.status === 'promised')
    .slice(-1)[0];
}

function settleCommitment(worldState: WorldState, commitment: PaymentCommitment): WorldState {
  return {
    ...worldState,
    paymentCommitments: worldState.paymentCommitments.map(c =>
      c.id === commitment.id ? { ...c, status: 'paid', updatedAtTurn: c.updatedAtTurn + 1 } : c
    ),
  };
}

function addCommitment(worldState: WorldState, commitment: PaymentCommitment): WorldState {
  return {
    ...worldState,
    paymentCommitments: [...(worldState.paymentCommitments || []), commitment].slice(-30),
  };
}

export function formatPendingCommitments(worldState: WorldState): string {
  const pending = (worldState.paymentCommitments || []).filter(c => c.status === 'promised' || c.status === 'requested');
  if (!pending.length) return '无';
  return pending.slice(-5).map(c =>
    `${c.status === 'promised' ? '已承诺' : '仅报价'}: ${c.payerName} ${c.status === 'promised' ? '欠玩家' : '收到玩家报价'} ${formatMoneyChange(c.amount)}，原因:${c.reason}`
  ).join(' | ');
}

export function enforcePaymentCommitments(
  response: AIResponse,
  player: Player,
  worldState: WorldState,
  playerAction: PlayerAction | undefined,
  logs: LogEntry[],
): WorldState {
  let nextWorld = { ...worldState, paymentCommitments: [...(worldState.paymentCommitments || [])] };
  const actionText = getActionText(playerAction);
  const sceneText = `${response.scene.title}\n${response.scene.text}\n${response.systemEvents.map(e => e.text).join('\n')}`;
  const textBlob = `${actionText}\n${sceneText}`;

  const promised = pendingPayment(nextWorld);
  const narrativeLooksPaid = PAY_WORDS.test(sceneText) && (ACCEPT_WORDS.test(sceneText) || /给了|递给|交给|结清|兑现/.test(sceneText));
  const asksForPayment = /钱呢|报酬呢|酬劳呢|付钱|结账|给钱|银呢|金币呢|铜币呢/.test(actionText);

  if (promised && (narrativeLooksPaid || asksForPayment)) {
    const original = sumPositiveStructuredMoney(response);
    stripPositiveMoneyUpdates(response);
    response.playerUpdate.moneyChange = { ...promised.amount };
    nextWorld = settleCommitment(nextWorld, promised);
    logs.push(createLogEntry('system', `【钱币】按本地承诺账本结算：${promised.payerName}支付${formatMoneyChange(promised.amount).replace('+', '')}（${promised.reason}）。`));
    if (original > 0 && original !== moneyToCopper(promised.amount)) {
      logs.push(createLogEntry('system', `AI付款金额与承诺不一致，已按原承诺修正。`));
    }
    return nextWorld;
  }

  const quote = parseMoney(actionText);
  const looksLikeQuote = !!quote && /收|收费|报价|要价|报酬|酬劳|给我|支付|付我|价钱|工钱/.test(actionText);
  if (!looksLikeQuote || !quote) return nextWorld;

  const requestedCopper = moneyToCopper(quote);
  const cap = servicePaymentCap(player, playerAction);
  const payerName = inferPayer(response);
  const reason = inferReason(actionText, response);

  if (requestedCopper > cap || REFUSE_WORDS.test(sceneText)) {
    nextWorld = addCommitment(nextWorld, {
      id: makeCommitmentId(nextWorld),
      type: 'payment',
      payerName,
      payee: 'player',
      amount: copperToMoney(Math.min(requestedCopper, cap)),
      reason,
      status: 'requested',
      createdAtTurn: logs.length,
      updatedAtTurn: logs.length,
      source: 'player_quote',
    });
    stripPositiveMoneyUpdates(response);
    logs.push(createLogEntry('system', `玩家报价${formatMoneyChange(quote).replace('+', '')}未通过本地承诺上限，不能登记为NPC欠款。`));
    return nextWorld;
  }

  if (ACCEPT_WORDS.test(sceneText) && !REFUSE_WORDS.test(sceneText)) {
    nextWorld = addCommitment(nextWorld, {
      id: makeCommitmentId(nextWorld),
      type: 'payment',
      payerName,
      payee: 'player',
      amount: quote,
      reason,
      status: 'promised',
      createdAtTurn: logs.length,
      updatedAtTurn: logs.length,
      source: 'player_quote',
    });
    stripPositiveMoneyUpdates(response);
    logs.push(createLogEntry('system', `【承诺】${payerName}已承诺支付${formatMoneyChange(quote).replace('+', '')}：${reason}。`));
  }

  return nextWorld;
}
