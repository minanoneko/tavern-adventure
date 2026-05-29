import type { Money } from '../types/common';

/** Convert Money to total copper value */
export function moneyToCopper(m: Money): number {
  return m.gold * 10000 + m.silver * 100 + m.copper;
}

/** Convert total copper back to Money (guaranteed valid, no negatives) */
export function copperToMoney(totalCopper: number): Money {
  // Clamp to [0, 9,999,999] copper (999g 99s 99c)
  const clamped = Math.max(0, Math.min(totalCopper, 9_999_999));
  const gold = Math.floor(clamped / 10000);
  const remain = clamped - gold * 10000;
  const silver = Math.floor(remain / 100);
  const copper = remain - silver * 100;
  return { gold, silver, copper };
}

/** Add a change (positive or negative) to existing money, return new money */
export function addMoney(current: Money, change: { gold?: number; silver?: number; copper?: number }): Money {
  const total = moneyToCopper(current) + moneyToCopper(change as Money);
  return copperToMoney(total);
}

/** Subtract money, clamping to 0 */
export function subtractMoney(current: Money, cost: { gold?: number; silver?: number; copper?: number }): Money {
  const total = moneyToCopper(current) - moneyToCopper(cost as Money);
  return copperToMoney(total);
}

/** Check if player can afford a cost */
export function canAfford(current: Money, cost: { gold?: number; silver?: number; copper?: number }): boolean {
  return moneyToCopper(current) >= moneyToCopper(cost as Money);
}

/** Clamp money reward by player level */
export function clampMoneyRewardByLevel(copperAmount: number, playerLevel: number): number {
  const maxCopper = playerLevel <= 3 ? 5000 : playerLevel <= 5 ? 20000 : 100000;
  return Math.min(copperAmount, maxCopper);
}

/** Format money change for display */
export function formatMoneyChange(change: { gold?: number; silver?: number; copper?: number }): string {
  const g = change.gold ?? 0;
  const s = change.silver ?? 0;
  const c = change.copper ?? 0;
  const parts: string[] = [];
  if (g !== 0) parts.push(`${g > 0 ? '+' : ''}${g}金`);
  if (s !== 0) parts.push(`${s > 0 ? '+' : ''}${s}银`);
  if (c !== 0) parts.push(`${c > 0 ? '+' : ''}${c}铜`);
  return parts.join(' ') || '+0铜';
}
