/**
 * Combat dice system. Uses a DND-like attribute modifier table.
 * Player level caps at 21, so attributes can grow without early +4 saturation.
 */

export function d20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function getAttributeModifier(attrValue: number): number {
  return Math.floor((attrValue - 10) / 2);
}

/** Roll d20 + modifier, return { roll, total } */
export function rollCheck(modifier: number): { roll: number; total: number } {
  const roll = d20();
  return { roll, total: roll + modifier };
}

/** Get player defense (AC equivalent) */
export function getPlayerDefense(dex: number, armorBonus?: number): number {
  return 10 + getAttributeModifier(dex) + (armorBonus ?? 0);
}
