import { Champion } from "./types";
import { CHAMPIONS } from "./champions";
import { ITEMS, ItemStats } from "./items";
import { clamp } from "./math";
import { CHAMP } from "./constants";

// Recompute a champion's derived combat stats from base + level + items + buffs.
// maxHp/maxMana are set here; current hp/mana are preserved by callers.
export function recomputeChampStats(champ: Champion) {
  const def = CHAMPIONS[champ.championId];
  if (!def) return;
  const s = def.stats;
  const lvl = champ.level;
  const g = lvl - 1;

  // Per-level growth uses a mild diminishing curve like LoL (stat * (0.7 + 0.3*n/17)).
  const growth = (per: number) => per * g * (0.685 + (0.315 * g) / 17);

  // Bigger, tankier champions: scale base+level health up (the arena is huge,
  // fights should feel weighty). Item health is added on top afterward.
  let hp = (s.hp + growth(s.hpPerLvl)) * CHAMP.hpScale;
  let mana = s.mana + growth(s.manaPerLvl);
  let ad = s.ad + growth(s.adPerLvl);
  let armor = s.armor + growth(s.armorPerLvl);
  let mr = s.mr + growth(s.mrPerLvl);
  let attackSpeedBonus = (s.asPerLvl / 100) * g; // fractional bonus
  let ap = 0;
  let moveSpeed = s.moveSpeed + CHAMP.msBonus;
  let moveSpeedPct = 0;
  let crit = 0;
  let lifesteal = 0;
  let cdr = 0;
  let hpRegen = s.hpRegen;
  let manaRegen = s.manaRegen;
  let bonusAttackSpeedItems = 0;

  // Aggregate item stats.
  for (const itemId of champ.items) {
    const it = ITEMS[itemId];
    if (!it) continue;
    const st: ItemStats = it.stats;
    if (st.hp) hp += st.hp;
    if (st.mana) mana += st.mana;
    if (st.ad) ad += st.ad;
    if (st.ap) ap += st.ap;
    if (st.armor) armor += st.armor;
    if (st.mr) mr += st.mr;
    if (st.attackSpeed) bonusAttackSpeedItems += st.attackSpeed;
    if (st.moveSpeed) moveSpeed += st.moveSpeed;
    if (st.moveSpeedPct) moveSpeedPct += st.moveSpeedPct;
    if (st.crit) crit += st.crit;
    if (st.lifesteal) lifesteal += st.lifesteal;
    if (st.cdr) cdr += st.cdr;
    if (st.hpRegen) hpRegen += st.hpRegen;
    if (st.manaRegen) manaRegen += st.manaRegen;
  }

  // Deathcap amplifies total AP by 30%.
  if (champ.items.includes("deathcap")) ap *= 1.3;

  // Active buffs with flat stat bonuses (jungle camp buffs, Dragón/Barón).
  for (const b of champ.buffs) {
    if (b.time <= 0) continue;
    if (b.ad) ad += b.ad;
    if (b.ap) ap += b.ap;
    if (b.armor) armor += b.armor;
    if (b.mr) mr += b.mr;
  }

  champ.maxHp = Math.round(hp);
  champ.maxMana = Math.round(mana);
  champ.attackDamage = Math.round(ad);
  champ.abilityPower = Math.round(ap);
  champ.armor = Math.round(armor);
  champ.magicResist = Math.round(mr);
  champ.attackSpeed = clamp(
    s.attackSpeed * (1 + attackSpeedBonus + bonusAttackSpeedItems),
    0.2,
    2.5
  );
  champ.moveSpeed = Math.round(moveSpeed * (1 + moveSpeedPct));
  champ.critChance = clamp(crit, 0, 1);
  champ.lifesteal = lifesteal;
  champ.cooldownReduction = clamp(cdr, 0, 0.4);
  champ.hpRegen = hpRegen;
  champ.manaRegen = manaRegen;
  champ.attackRange = def.stats.attackRange;
}

// Ability magic pen approximation: void staff ignores 40% MR (applied at damage calc
// by lowering the target's MR only when the source has voidstaff). Simplified here as a
// helper the sim can consult.
export function effectiveMagicResist(target: Champion, sourceHasVoid: boolean): number {
  return sourceHasVoid ? target.magicResist * 0.6 : target.magicResist;
}
