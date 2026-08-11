// The Bootleg Bazaar — item shop. Stats are additive and recomputed on buy/sell.

export interface ItemStats {
  ad?: number;
  ap?: number;
  hp?: number;
  armor?: number;
  mr?: number;
  attackSpeed?: number; // additive percent, e.g. 0.4 = +40%
  moveSpeed?: number; // flat units
  moveSpeedPct?: number; // percent
  crit?: number; // additive percent
  lifesteal?: number;
  cdr?: number; // additive, capped at 0.4
  mana?: number;
  hpRegen?: number;
  manaRegen?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  stats: ItemStats;
  desc: string;
  tag: "Attack" | "Magic" | "Defense" | "Boots" | "Utility";
  // Fake retail flavor.
  listPrice: number;
  rating: number;
}

export const ITEMS: Record<string, ItemDef> = {
  boots: {
    id: "boots", name: "Ninja Tabbies", emoji: "👟", cost: 300,
    stats: { moveSpeed: 45 }, desc: "+45 Move Speed. Off-brand ninja slippers.",
    tag: "Boots", listPrice: 39, rating: 4.8,
  },
  bootsplus: {
    id: "bootsplus", name: "Sorcerer's Sh๏es", emoji: "🥾", cost: 1100,
    stats: { moveSpeed: 45, ap: 18 }, desc: "+45 MS, +18 AP. Now with extra vowels.",
    tag: "Boots", listPrice: 79, rating: 4.6,
  },
  swifties: {
    id: "swifties", name: "Boots of Swiftshipping", emoji: "🛼", cost: 900,
    stats: { moveSpeed: 60 }, desc: "+60 Move Speed. Zoom zoom, no refunds.",
    tag: "Boots", listPrice: 69, rating: 4.4,
  },
  longsword: {
    id: "longsword", name: "Long Sword (Longish)", emoji: "🗡️", cost: 350,
    stats: { ad: 10 }, desc: "+10 Attack Damage. Slightly bent in shipping.",
    tag: "Attack", listPrice: 24, rating: 4.1,
  },
  bfsword: {
    id: "bfsword", name: "B. F. Sw๏rd", emoji: "⚔️", cost: 1300,
    stats: { ad: 40 }, desc: "+40 Attack Damage. The B.F. stands for 'Big Frugal'.",
    tag: "Attack", listPrice: 149, rating: 4.7,
  },
  infedge: {
    id: "infedge", name: "Infoggnity Edge", emoji: "🔪", cost: 3400,
    stats: { ad: 65, crit: 0.25 }, desc: "+65 AD, +25% Crit. Crits hit for a LOT.",
    tag: "Attack", listPrice: 349, rating: 4.9,
  },
  brk: {
    id: "brk", name: "Bootleg of the Ruined King", emoji: "🏴‍☠️", cost: 3200,
    stats: { ad: 40, attackSpeed: 0.25, lifesteal: 0.1 },
    desc: "+40 AD, +25% AS, +10% Lifesteal. Legally distinct from any king.",
    tag: "Attack", listPrice: 329, rating: 4.6,
  },
  phantom: {
    id: "phantom", name: "Phantom Dancerr", emoji: "💃", cost: 2600,
    stats: { attackSpeed: 0.4, crit: 0.2, moveSpeedPct: 0.07 },
    desc: "+40% AS, +20% Crit, +7% MS. Ghost not included.",
    tag: "Attack", listPrice: 259, rating: 4.5,
  },
  daggr: {
    id: "daggr", name: "Dagg-r", emoji: "🔩", cost: 250,
    stats: { attackSpeed: 0.12 }, desc: "+12% Attack Speed. It's a screw. It works though.",
    tag: "Attack", listPrice: 19, rating: 3.9,
  },
  amptome: {
    id: "amptome", name: "Amplifying T๏me", emoji: "📕", cost: 400,
    stats: { ap: 20 }, desc: "+20 Ability Power. Pages mostly blank.",
    tag: "Magic", listPrice: 29, rating: 4.0,
  },
  deathcap: {
    id: "deathcap", name: "Rabadong's Deathkap", emoji: "🎩", cost: 3600,
    stats: { ap: 120 }, desc: "+120 AP and amplifies your total AP. Very sparkly.",
    tag: "Magic", listPrice: 379, rating: 4.9,
  },
  luden: {
    id: "luden", name: "Lundon's Tempest", emoji: "🌩️", cost: 2900,
    stats: { ap: 80, mana: 600, cdr: 0.1 },
    desc: "+80 AP, +600 Mana, +10% CDR. Storm in a knockoff bottle.",
    tag: "Magic", listPrice: 289, rating: 4.7,
  },
  voidstaff: {
    id: "voidstaff", name: "V๏id Staff", emoji: "🔮", cost: 3000,
    stats: { ap: 65 }, desc: "+65 AP. Ignores a chunk of enemy magic resist (spooky).",
    tag: "Magic", listPrice: 299, rating: 4.5,
  },
  clotharmor: {
    id: "clotharmor", name: "Cl๏th Armor", emoji: "🧥", cost: 300,
    stats: { armor: 15 }, desc: "+15 Armor. Machine washable.",
    tag: "Defense", listPrice: 22, rating: 4.2,
  },
  warmog: {
    id: "warmog", name: "Warmog's Aromor", emoji: "🧣", cost: 3100,
    stats: { hp: 800, hpRegen: 10 }, desc: "+800 HP and huge regen. Smells faintly of victory.",
    tag: "Defense", listPrice: 309, rating: 4.8,
  },
  thornmail: {
    id: "thornmail", name: "Bramblevestt", emoji: "🌵", cost: 2700,
    stats: { armor: 60, hp: 350 }, desc: "+60 Armor, +350 HP. Reflects some attack damage. Prickly.",
    tag: "Defense", listPrice: 269, rating: 4.4,
  },
  spiritvisage: {
    id: "spiritvisage", name: "Spirit Vis@ge", emoji: "🎭", cost: 2900,
    stats: { hp: 450, mr: 40, cdr: 0.1, hpRegen: 15 },
    desc: "+450 HP, +40 MR, +10% CDR, boosts healing. Slightly cursed.",
    tag: "Defense", listPrice: 289, rating: 4.6,
  },
  nullmantle: {
    id: "nullmantle", name: "Null-Magic Mantel", emoji: "🧶", cost: 450,
    stats: { mr: 25 }, desc: "+25 Magic Resist. Hand-knitted by a bot.",
    tag: "Defense", listPrice: 34, rating: 4.1,
  },
  ruby: {
    id: "ruby", name: "Ruby Crystall", emoji: "🔴", cost: 400,
    stats: { hp: 150 }, desc: "+150 Health. It's just a red rock but ok.",
    tag: "Defense", listPrice: 29, rating: 4.0,
  },
  gauntlet: {
    id: "gauntlet", name: "Sterak's Gauntlett", emoji: "🥊", cost: 3200,
    stats: { ad: 45, hp: 400 }, desc: "+45 AD, +400 HP. Shields you when you almost die.",
    tag: "Attack", listPrice: 319, rating: 4.7,
  },
  hextech: {
    id: "hextech", name: "Hextech Rocketboots", emoji: "🚀", cost: 1100,
    stats: { moveSpeed: 45, ad: 15 }, desc: "+45 MS, +15 AD. Definitely not a fire hazard.",
    tag: "Boots", listPrice: 89, rating: 4.3,
  },
  cdrring: {
    id: "cdrring", name: "Cosmic Drive-thru", emoji: "💫", cost: 3000,
    stats: { ap: 55, hp: 350, cdr: 0.2, moveSpeed: 25 },
    desc: "+55 AP, +350 HP, +20% CDR, +25 MS. Cast fast, drive faster.",
    tag: "Magic", listPrice: 299, rating: 4.6,
  },
};

export const ITEM_LIST = Object.values(ITEMS);

export const STARTER_BUILD = ["longsword", "boots"];

// Recommended items per role for the AI shopper & UI hints.
export const RECOMMENDED: Record<string, string[]> = {
  Marksman: ["boots", "brk", "phantom", "infedge", "bootsplus", "warmog"],
  Mage: ["bootsplus", "luden", "deathcap", "voidstaff", "cdrring", "warmog"],
  Fighter: ["boots", "gauntlet", "bfsword", "spiritvisage", "warmog", "brk"],
  Tank: ["boots", "warmog", "thornmail", "spiritvisage", "gauntlet", "swifties"],
  Assassin: ["boots", "bfsword", "infedge", "gauntlet", "phantom", "warmog"],
  Support: ["boots", "spiritvisage", "warmog", "cdrring", "thornmail", "swifties"],
};
