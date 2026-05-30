import { getWeaponCategory } from '../../utils/equipmentRules';

/** Weapon type → damage dice */
const WEAPON_DICE: Record<string, { dice: number; count: number }> = {
  fist:   { dice: 4, count: 1 },  // 1d4
  dagger: { dice: 4, count: 1 },  // 1d4
  sword:  { dice: 6, count: 1 },  // 1d6
  bow:    { dice: 6, count: 1 },  // 1d6
  axe:    { dice: 8, count: 1 },  // 1d8
  staff:  { dice: 4, count: 1 },  // 1d4
};

export function getWeaponDamageDice(weaponId: string | null): { dice: number; count: number } {
  const category = getWeaponCategory(weaponId || '');
  return WEAPON_DICE[category] || WEAPON_DICE.fist;
}

/** Parse dice notation like "1d6", "2d4" and roll */
export function rollDice(notation: string): { roll: number; detail: string } {
  const match = notation.match(/^(\d+)d(\d+)$/);
  if (!match) return { roll: 0, detail: '0' };
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  let total = 0;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    total += r;
  }
  return { roll: total, detail: `${notation}=${rolls.join('+')}` };
}

/** Roll weapon damage and return total + detail */
export function rollWeaponDamage(weaponId: string | null): { total: number; detail: string } {
  const wd = getWeaponDamageDice(weaponId);
  const result = rollDice(`${wd.count}d${wd.dice}`);
  return { total: result.roll, detail: result.detail };
}
