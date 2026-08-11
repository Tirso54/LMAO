import { DamageType } from "./types";

// Ability metadata drives both the HUD and the behavior dispatcher in abilities.ts
// (dispatched by `key`, e.g. "yasou_q").
export interface AbilityDef {
  key: string;
  slot: number; // 0..3 => Q W E R
  name: string;
  glyph: string;
  desc: string;
  cast: "skillshot" | "target" | "self" | "dash" | "ground" | "vector";
  manaCost: number[];
  cooldown: number[]; // seconds per rank
  range: number;
  radius?: number;
  speed?: number;
  width?: number;
  damage?: number[];
  damageType?: DamageType;
  apRatio?: number;
  adRatio?: number;
  maxRank?: number; // default 5 (3 for ult)
  ultLevels?: number[]; // levels at which each rank unlocks
}

export interface PassiveDef {
  name: string;
  glyph: string;
  desc: string;
}

export interface ChampStats {
  hp: number;
  hpPerLvl: number;
  mana: number;
  manaPerLvl: number;
  ad: number;
  adPerLvl: number;
  armor: number;
  armorPerLvl: number;
  mr: number;
  mrPerLvl: number;
  attackRange: number;
  attackSpeed: number;
  asPerLvl: number; // percent per level
  moveSpeed: number;
  hpRegen: number;
  manaRegen: number;
}

export interface ChampDef {
  id: string;
  name: string;
  title: string;
  role: "Fighter" | "Marksman" | "Mage" | "Tank" | "Assassin" | "Support";
  difficulty: 1 | 2 | 3;
  glyph: string;
  color: string; // theme color for the champ
  ranged: boolean;
  projectileSpeed?: number; // for ranged autos
  stats: ChampStats;
  passive: PassiveDef;
  abilities: AbilityDef[]; // Q W E R
  // Storefront flavor.
  price: string;
  listPrice: string;
  rating: number;
  reviews: number;
  blurb: string;
  reviewQuote: string;
  shipping: string;
}

const D: DamageType = "physical";
const M: DamageType = "magic";
const T: DamageType = "true";

export const CHAMPIONS: Record<string, ChampDef> = {
  yasou: {
    id: "yasou",
    name: "Yasøu",
    title: "the Unforgiven Refund",
    role: "Fighter",
    difficulty: 3,
    glyph: "Y",
    color: "#7fd6ff",
    ranged: false,
    stats: {
      hp: 620, hpPerLvl: 92, mana: 100, manaPerLvl: 0,
      ad: 60, adPerLvl: 3.5, armor: 32, armorPerLvl: 3.4,
      mr: 32, mrPerLvl: 1.25, attackRange: 175, attackSpeed: 0.7,
      asPerLvl: 3.5, moveSpeed: 345, hpRegen: 7, manaRegen: 0,
    },
    passive: {
      name: "Windwall Warranty",
      glyph: "W",
      desc: "Builds Flow while moving; at full Flow the next hit taken is shielded. Crit chance is doubled (bootleg dice).",
    },
    abilities: [
      { key: "yasou_q", slot: 0, name: "Steel Tempu", glyph: "S", desc: "Thrust forward, damaging enemies in a line. Stacks to unleash a whirlwind that knocks up.", cast: "skillshot", manaCost: [0,0,0,0,0], cooldown: [4,4,4,4,4], range: 300, width: 60, speed: 1400, damage: [20,45,70,95,120], damageType: D, adRatio: 1.0 },
      { key: "yasou_w", slot: 1, name: "Wind Wallet", glyph: "W", desc: "Conjure a wall that blocks enemy projectiles for a few seconds.", cast: "ground", manaCost: [0,0,0,0,0], cooldown: [24,22,20,18,16], range: 400, width: 260 },
      { key: "yasou_e", slot: 2, name: "Sweeping Dash", glyph: "D", desc: "Dash through a target enemy, dealing magic damage. Can't hit the same target twice for a while.", cast: "target", manaCost: [0,0,0,0,0], cooldown: [8,7,6,5,4], range: 475, damage: [40,55,70,85,100], damageType: M, apRatio: 0.5 },
      { key: "yasou_r", slot: 3, name: "Last Refund", glyph: "L", desc: "Blink to a knocked-up enemy, dealing heavy damage and gaining armor pen.", cast: "target", manaCost: [0,0,0], cooldown: [70,55,40], range: 500, damage: [200,300,400], damageType: D, adRatio: 1.5, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$3.47", listPrice: "$59.99", rating: 4.1, reviews: 2087,
    blurb: "Genuine wind-based swordsman action figure. Batteries not included. May void your ranked warranty.",
    reviewQuote: "\"0/10 my teammate picked this and int'd but the animations slap\" — xXNoScopeXx",
    shipping: "Free shipping (arrives 6–9 weeks)",
  },

  teemoo: {
    id: "teemoo",
    name: "Teemoo",
    title: "the Swift Scoutlite",
    role: "Marksman",
    difficulty: 1,
    glyph: "T",
    color: "#8be36b",
    ranged: true,
    projectileSpeed: 1300,
    stats: {
      hp: 540, hpPerLvl: 90, mana: 340, manaPerLvl: 25,
      ad: 54, adPerLvl: 3.3, armor: 26, armorPerLvl: 3.2,
      mr: 30, mrPerLvl: 0.75, attackRange: 500, attackSpeed: 0.69,
      asPerLvl: 3.4, moveSpeed: 335, hpRegen: 5.5, manaRegen: 9.5,
    },
    passive: {
      name: "Guerrilla Dropshipping",
      glyph: "G",
      desc: "Standing still without acting for 1.5s grants brief invisibility and a burst of move speed when breaking it.",
    },
    abilities: [
      { key: "teemoo_q", slot: 0, name: "Blinding Dart", glyph: "B", desc: "Poison dart that damages and blinds the target, making their attacks miss.", cast: "target", manaCost: [70,75,80,85,90], cooldown: [8,7,6,5,4], range: 560, damage: [80,125,170,215,260], damageType: M, apRatio: 0.8 },
      { key: "teemoo_w", slot: 1, name: "Move Quick.com", glyph: "M", desc: "Gain a big burst of move speed. Doesn't break on damage.", cast: "self", manaCost: [40,40,40,40,40], cooldown: [17,16,15,14,13], range: 0 },
      { key: "teemoo_e", slot: 2, name: "Toxic Shot", glyph: "T", desc: "Passive: auto-attacks deal bonus magic damage and poison over time.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [0,0,0,0,0], range: 0, damage: [14,26,38,50,62], damageType: M },
      { key: "teemoo_r", slot: 3, name: "Noxious Trap", glyph: "M", desc: "Toss a mushroom trap that detonates on enemies, poisoning and slowing them.", cast: "ground", manaCost: [75,75,75], cooldown: [28,22,16], range: 700, radius: 140, damage: [180,300,420], damageType: M, apRatio: 0.7, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$1.99", listPrice: "$44.99", rating: 3.2, reviews: 9142,
    blurb: "Adorable scout plush that inexplicably fills your carpet with landmines. Choking hazard. Ages 3+.",
    reviewQuote: "\"most hated toy in our house. keeps blinding the dog.\" — karen_MID",
    shipping: "Free shipping (some assembly & therapy required)",
  },

  ashee: {
    id: "ashee",
    name: "Ashee",
    title: "the Frost Discount Archer",
    role: "Marksman",
    difficulty: 1,
    glyph: "A",
    color: "#a9e8ff",
    ranged: true,
    projectileSpeed: 1500,
    stats: {
      hp: 570, hpPerLvl: 88, mana: 300, manaPerLvl: 32,
      ad: 57, adPerLvl: 2.9, armor: 26, armorPerLvl: 3.4,
      mr: 30, mrPerLvl: 0.75, attackRange: 575, attackSpeed: 0.66,
      asPerLvl: 3.3, moveSpeed: 325, hpRegen: 5, manaRegen: 9,
    },
    passive: {
      name: "Frost Coupon",
      glyph: "F",
      desc: "Auto-attacks slow enemies. Attacking a slowed target has a chance to crit for bonus damage.",
    },
    abilities: [
      { key: "ashee_q", slot: 0, name: "Rapid Firesale", glyph: "R", desc: "Empower your next several attacks with huge attack speed.", cast: "self", manaCost: [40,40,40,40,40], cooldown: [10,9,8,7,6], range: 0 },
      { key: "ashee_w", slot: 1, name: "Volley of Values", glyph: "V", desc: "Fire a cone of arrows that damage and slow all enemies hit.", cast: "skillshot", manaCost: [60,65,70,75,80], cooldown: [12,10,8,6,4], range: 620, width: 260, damage: [50,85,120,155,190], damageType: D, adRatio: 1.0 },
      { key: "ashee_e", slot: 2, name: "Hawkshot Prime", glyph: "H", desc: "Grants a burst of move speed and reveals the area ahead.", cast: "self", manaCost: [30,30,30,30,30], cooldown: [10,10,10,10,10], range: 0 },
      { key: "ashee_r", slot: 3, name: "Enchanted Clearance Arrow", glyph: "C", desc: "Fire a giant crystal arrow across the map. Stuns and heavily damages the first enemy champion hit.", cast: "skillshot", manaCost: [100,100,100], cooldown: [75,65,55], range: 2600, width: 130, speed: 1600, damage: [250,400,550], damageType: M, apRatio: 1.0, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$2.49", listPrice: "$49.99", rating: 4.4, reviews: 5310,
    blurb: "Frost-themed archery set. Arrows sold separately. Bowstring is definitely not dental floss.",
    reviewQuote: "\"landed a global arrow once and now my whole family respects me\" — dad_of_three",
    shipping: "Free shipping (frozen in transit)",
  },

  garon: {
    id: "garon",
    name: "Garón",
    title: "the Might of Dropshipacia",
    role: "Fighter",
    difficulty: 1,
    glyph: "G",
    color: "#ffd76b",
    ranged: false,
    stats: {
      hp: 690, hpPerLvl: 98, mana: 100, manaPerLvl: 0,
      ad: 66, adPerLvl: 4.5, armor: 36, armorPerLvl: 4.2,
      mr: 32, mrPerLvl: 1.25, attackRange: 175, attackSpeed: 0.625,
      asPerLvl: 3.65, moveSpeed: 340, hpRegen: 8, manaRegen: 0,
    },
    passive: {
      name: "Perseverance (Refurbished)",
      glyph: "P",
      desc: "Regenerate a percentage of max health per second when you haven't taken damage recently.",
    },
    abilities: [
      { key: "garon_q", slot: 0, name: "Decisive Discount", glyph: "D", desc: "Break free of slows and empower your next attack to deal bonus damage and silence.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [8,7.5,7,6.5,6], range: 0, damage: [30,60,90,120,150], damageType: D, adRatio: 0.5 },
      { key: "garon_w", slot: 1, name: "Courage Coupon", glyph: "C", desc: "Gain a shield and reduced damage for a few seconds.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [23,21,19,17,15], range: 0 },
      { key: "garon_e", slot: 2, name: "Judgment Spin2Win", glyph: "J", desc: "Rapidly spin your sword, dealing physical damage to all nearby enemies for a few seconds.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [10,9,8,7,6], range: 330, radius: 330, damage: [16,24,32,40,48], damageType: D, adRatio: 0.36 },
      { key: "garon_r", slot: 3, name: "Demacian Liquidation", glyph: "L", desc: "Call down bootleg justice, dealing true damage that increases the lower the target's health.", cast: "target", manaCost: [0,0,0], cooldown: [55,45,35], range: 400, damage: [200,320,440], damageType: T, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$4.20", listPrice: "$54.99", rating: 4.6, reviews: 7788,
    blurb: "Indestructible plastic knight. Only knows one move but it's a good one. Spins independently of your consent.",
    reviewQuote: "\"DEMACIAAA— sorry. it just does that.\" — verified buyer",
    shipping: "Free shipping (spinning the whole way here)",
  },

  jinix: {
    id: "jinix",
    name: "Jinix",
    title: "the Loose Cannon Return",
    role: "Marksman",
    difficulty: 2,
    glyph: "J",
    color: "#ff8ce0",
    ranged: true,
    projectileSpeed: 1400,
    stats: {
      hp: 555, hpPerLvl: 86, mana: 300, manaPerLvl: 33,
      ad: 56, adPerLvl: 3.4, armor: 26, armorPerLvl: 3.3,
      mr: 30, mrPerLvl: 0.75, attackRange: 525, attackSpeed: 0.625,
      asPerLvl: 4.0, moveSpeed: 335, hpRegen: 5, manaRegen: 8.5,
    },
    passive: {
      name: "Get Excited!!",
      glyph: "E",
      desc: "Scoring a takedown grants a huge burst of move speed and attack speed.",
    },
    abilities: [
      { key: "jinix_q", slot: 0, name: "Switcheroo!", glyph: "S", desc: "Toggle between rapid minigun (attack speed) and rockets (bigger range & splash). Free to swap.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [1,1,1,1,1], range: 0 },
      { key: "jinix_w", slot: 1, name: "Zap!", glyph: "Z", desc: "Fire a long-range shock blast that damages and slows the first enemy hit.", cast: "skillshot", manaCost: [50,60,70,80,90], cooldown: [8,7,6,5,4], range: 1400, width: 60, speed: 3200, damage: [70,120,170,220,270], damageType: D, adRatio: 1.4 },
      { key: "jinix_e", slot: 2, name: "Flame Chompers!", glyph: "F", desc: "Toss a line of snare traps that root the first enemy that walks over them.", cast: "ground", manaCost: [70,75,80,85,90], cooldown: [16,15,14,13,12], range: 900, radius: 130, damage: [60,100,140,180,220], damageType: M },
      { key: "jinix_r", slot: 3, name: "Super Mega Death Rocket!", glyph: "R", desc: "Launch a global rocket that gains damage as it travels and explodes for bonus % health damage.", cast: "skillshot", manaCost: [100,100,100], cooldown: [70,60,50], range: 3200, width: 140, speed: 1700, damage: [250,400,550], damageType: D, adRatio: 1.5, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$3.99", listPrice: "$52.99", rating: 3.9, reviews: 6120,
    blurb: "Chaotic gremlin doll with actual working rockets (please read the 40-page safety insert we did not include).",
    reviewQuote: "\"neighbors have questions. 5 stars.\" — anonymous",
    shipping: "Free shipping (do NOT drop the package)",
  },

  luux: {
    id: "luux",
    name: "Luux",
    title: "the Lady of Luminous Markdowns",
    role: "Mage",
    difficulty: 2,
    glyph: "L",
    color: "#ffe98a",
    ranged: true,
    projectileSpeed: 1300,
    stats: {
      hp: 540, hpPerLvl: 90, mana: 480, manaPerLvl: 23,
      ad: 54, adPerLvl: 3.3, armor: 24, armorPerLvl: 3.0,
      mr: 30, mrPerLvl: 0.75, attackRange: 550, attackSpeed: 0.669,
      asPerLvl: 2.5, moveSpeed: 330, hpRegen: 5.5, manaRegen: 12,
    },
    passive: {
      name: "Illumination Rebate",
      glyph: "I",
      desc: "Damaging an enemy with an ability marks them; your next auto detonates the mark for bonus magic damage.",
    },
    abilities: [
      { key: "luux_q", slot: 0, name: "Light Zip-tie", glyph: "Z", desc: "Fire a bolt of light that roots the first two enemies it passes through.", cast: "skillshot", manaCost: [50,60,70,80,90], cooldown: [11,10.5,10,9.5,9], range: 1200, width: 55, speed: 1200, damage: [70,120,170,220,270], damageType: M, apRatio: 0.9 },
      { key: "luux_w", slot: 1, name: "Prismatic Barrier+", glyph: "B", desc: "Throw a boomerang wand that shields you and allies it touches, both ways.", cast: "self", manaCost: [60,60,60,60,60], cooldown: [14,13,12,11,10], range: 700 },
      { key: "luux_e", slot: 2, name: "Lucent Singularity", glyph: "S", desc: "Create a slowing zone that detonates for area magic damage.", cast: "ground", manaCost: [70,80,90,100,110], cooldown: [10,9.5,9,8.5,8], range: 1100, radius: 300, damage: [65,115,165,215,265], damageType: M, apRatio: 0.7 },
      { key: "luux_r", slot: 3, name: "Final Sparkâ„¢", glyph: "F", desc: "Fire a colossal laser across a huge line, dealing magic damage and detonating Illumination.", cast: "skillshot", manaCost: [100,100,100], cooldown: [60,50,40], range: 3000, width: 220, damage: [300,400,500], damageType: M, apRatio: 1.2, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$2.79", listPrice: "$47.99", rating: 4.7, reviews: 8891,
    blurb: "Sparkly wand that fires a laser large enough to be seen from space. FCC did not approve this.",
    reviewQuote: "\"pew pew rainbow of doom. would markdown again.\" — mom_gamer",
    shipping: "Free shipping (glows in the dark, disturbingly)",
  },

  blitzcronk: {
    id: "blitzcronk",
    name: "Blïtzcronk",
    title: "the Great Steam Dropbot",
    role: "Tank",
    difficulty: 2,
    glyph: "B",
    color: "#f6c453",
    ranged: false,
    stats: {
      hp: 660, hpPerLvl: 108, mana: 267, manaPerLvl: 40,
      ad: 62, adPerLvl: 3.5, armor: 37, armorPerLvl: 3.5,
      mr: 32, mrPerLvl: 1.25, attackRange: 175, attackSpeed: 0.625,
      asPerLvl: 1.13, moveSpeed: 335, hpRegen: 7.5, manaRegen: 8,
    },
    passive: {
      name: "Mana Barrier (AliExpress)",
      glyph: "M",
      desc: "When you drop low on health, convert a chunk of your mana into a temporary shield.",
    },
    abilities: [
      { key: "blitz_q", slot: 0, name: "Rocket Grab.zip", glyph: "G", desc: "Fire your fist to grab the first enemy hit and yank them to you. The signature bootleg hook.", cast: "skillshot", manaCost: [100,100,100,100,100], cooldown: [13,12,11,10,9], range: 1050, width: 70, speed: 1900, damage: [90,140,190,240,290], damageType: M, apRatio: 1.0 },
      { key: "blitz_w", slot: 1, name: "Overdrive Turbo", glyph: "O", desc: "Supercharge for a big burst of move and attack speed, decaying over time.", cast: "self", manaCost: [75,75,75,75,75], cooldown: [15,14,13,12,11], range: 0 },
      { key: "blitz_e", slot: 2, name: "Power Fist Pro", glyph: "P", desc: "Charge your next attack to knock the target up into the air.", cast: "self", manaCost: [25,25,25,25,25], cooldown: [9,8,7,6,5], range: 0, damage: [0,0,0,0,0], damageType: M },
      { key: "blitz_r", slot: 3, name: "Static Field Sale", glyph: "S", desc: "Silence and blast all nearby enemies with a chain of lightning.", cast: "self", manaCost: [100,100,100], cooldown: [45,35,25], range: 600, radius: 600, damage: [275,400,525], damageType: M, apRatio: 1.0, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$5.55", listPrice: "$64.99", rating: 4.3, reviews: 4402,
    blurb: "Vintage-look steam robot. Grabs things. Grabs YOU. We are legally required to say it does not stop grabbing.",
    reviewQuote: "\"hooked my mailman. instant regret. instant respect.\" — cornerpeek_carl",
    shipping: "Free shipping (heavy — sorry, driver)",
  },

  darios: {
    id: "darios",
    name: "Dariôs",
    title: "the Hand of Nyoxus",
    role: "Fighter",
    difficulty: 2,
    glyph: "D",
    color: "#ff6b5e",
    ranged: false,
    stats: {
      hp: 652, hpPerLvl: 100, mana: 263, manaPerLvl: 37,
      ad: 64, adPerLvl: 5.0, armor: 39, armorPerLvl: 4.0,
      mr: 32, mrPerLvl: 1.25, attackRange: 175, attackSpeed: 0.625,
      asPerLvl: 2.6, moveSpeed: 340, hpRegen: 8, manaRegen: 6.75,
    },
    passive: {
      name: "Hemorrhage Rewards",
      glyph: "H",
      desc: "Attacks and abilities apply Bleed stacks that deal damage over time; at 5 stacks you gain massive attack damage.",
    },
    abilities: [
      { key: "darios_q", slot: 0, name: "Decimate Deal", glyph: "D", desc: "Swing your axe in a wide ring; the outer edge deals extra damage and heals you per champ hit.", cast: "self", manaCost: [30,30,30,30,30], cooldown: [9,8,7,6,5], range: 425, radius: 425, damage: [50,80,110,140,170], damageType: D, adRatio: 1.0 },
      { key: "darios_w", slot: 1, name: "Crippling Strike Combo", glyph: "C", desc: "Your next attack deals bonus damage and slows the target hard.", cast: "self", manaCost: [30,30,30,30,30], cooldown: [7,6.5,6,5.5,5], range: 0, damage: [40,70,100,130,160], damageType: D, adRatio: 0.4 },
      { key: "darios_e", slot: 2, name: "Apprehend Express", glyph: "A", desc: "Pull an enemy toward you with your axe and slow them.", cast: "target", manaCost: [40,40,40,40,40], cooldown: [16,14,12,10,8], range: 535 },
      { key: "darios_r", slot: 3, name: "Nyoxian Guillotine", glyph: "G", desc: "Leap and execute an enemy for true damage that scales with their missing health and your Bleed.", cast: "target", manaCost: [100,100,100], cooldown: [60,45,30], range: 475, damage: [150,250,350], damageType: T, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$4.44", listPrice: "$57.99", rating: 4.5, reviews: 6650,
    blurb: "Big axe man. Pulls you in. Chops. Says a scary word. Ergonomically nightmarish. Five stars.",
    reviewQuote: "\"the axe is real metal why is the axe real metal\" — concerned_parent99",
    shipping: "Free shipping (axe ships separately, obviously)",
  },
};

export const CHAMPION_LIST = Object.values(CHAMPIONS);
export const CHAMPION_IDS = Object.keys(CHAMPIONS);
