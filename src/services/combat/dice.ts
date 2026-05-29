/**
 * Combat dice system. Uses the same attribute modifier table as judgeService.ts
 * (attr 4=-1, 5=0, 6=1, 7=2, 8=3, 9+=4), NOT DND (attr-10)/2.
 */

export function d20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function getAttributeModifier(attrValue: number): number {
  if (attrValue >= 9) return 4;
  if (attrValue >= 8) return 3;
  if (attrValue >= 7) return 2;
  if (attrValue >= 6) return 1;
  if (attrValue >= 5) return 0;
  if (attrValue >= 4) return -1;
  return -2;
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
