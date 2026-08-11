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
    title: "el Reembolso Imperdonable",
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
      desc: "Acumula Flujo al moverse; con el Flujo al máximo, el siguiente golpe recibido queda escudado. La probabilidad de crítico se duplica (dados pirata).",
    },
    abilities: [
      { key: "yasou_q", slot: 0, name: "Steel Tempu", glyph: "S", desc: "Estocada hacia delante que daña a los enemigos en línea. Acumula cargas para desatar un torbellino que lanza por los aires.", cast: "skillshot", manaCost: [0,0,0,0,0], cooldown: [4,4,4,4,4], range: 300, width: 60, speed: 1400, damage: [20,45,70,95,120], damageType: D, adRatio: 1.0 },
      { key: "yasou_w", slot: 1, name: "Wind Wallet", glyph: "W", desc: "Invoca un muro que bloquea los proyectiles enemigos durante unos segundos.", cast: "ground", manaCost: [0,0,0,0,0], cooldown: [24,22,20,18,16], range: 400, width: 260 },
      { key: "yasou_e", slot: 2, name: "Sweeping Dash", glyph: "D", desc: "Embiste a través de un enemigo objetivo e inflige daño mágico. No puede golpear al mismo objetivo dos veces durante un tiempo.", cast: "target", manaCost: [0,0,0,0,0], cooldown: [8,7,6,5,4], range: 475, damage: [40,55,70,85,100], damageType: M, apRatio: 0.5 },
      { key: "yasou_r", slot: 3, name: "Last Refund", glyph: "L", desc: "Parpadea hasta un enemigo lanzado por los aires, inflige mucho daño y gana penetración de armadura.", cast: "target", manaCost: [0,0,0], cooldown: [70,55,40], range: 500, damage: [200,300,400], damageType: D, adRatio: 1.5, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$3.47", listPrice: "$59.99", rating: 4.1, reviews: 2087,
    blurb: "Auténtico muñeco articulado de espadachín del viento. Pilas no incluidas. Puede anular la garantía de tu ranked.",
    reviewQuote: "\"0/10 mi compañero eligió esto y feedeó, pero las animaciones molan\" — xXNoScopeXx",
    shipping: "Envío gratis (llega en 6–9 semanas)",
  },

  teemoo: {
    id: "teemoo",
    name: "Teemoo",
    title: "el Explorador Rapidito",
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
      desc: "Quedarte quieto sin actuar durante 1,5 s otorga invisibilidad breve y un empujón de velocidad al romperla.",
    },
    abilities: [
      { key: "teemoo_q", slot: 0, name: "Blinding Dart", glyph: "B", desc: "Dardo venenoso que daña y ciega al objetivo, haciendo que sus ataques fallen.", cast: "target", manaCost: [70,75,80,85,90], cooldown: [8,7,6,5,4], range: 560, damage: [80,125,170,215,260], damageType: M, apRatio: 0.8 },
      { key: "teemoo_w", slot: 1, name: "Move Quick.com", glyph: "M", desc: "Gana un gran empujón de velocidad de movimiento. No se rompe al recibir daño.", cast: "self", manaCost: [40,40,40,40,40], cooldown: [17,16,15,14,13], range: 0 },
      { key: "teemoo_e", slot: 2, name: "Toxic Shot", glyph: "T", desc: "Pasiva: los ataques básicos infligen daño mágico extra y envenenan con el tiempo.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [0,0,0,0,0], range: 0, damage: [14,26,38,50,62], damageType: M },
      { key: "teemoo_r", slot: 3, name: "Noxious Trap", glyph: "M", desc: "Lanza una seta trampa que detona sobre los enemigos, envenenándolos y ralentizándolos.", cast: "ground", manaCost: [75,75,75], cooldown: [28,22,16], range: 700, radius: 140, damage: [180,300,420], damageType: M, apRatio: 0.7, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$1.99", listPrice: "$44.99", rating: 3.2, reviews: 9142,
    blurb: "Adorable peluche explorador que, inexplicablemente, llena tu alfombra de minas. Riesgo de asfixia. A partir de 3 años.",
    reviewQuote: "\"el juguete más odiado de casa. no para de cegar al perro.\" — karen_MID",
    shipping: "Envío gratis (requiere montaje y terapia)",
  },

  ashee: {
    id: "ashee",
    name: "Ashee",
    title: "la Arquera de las Rebajas Heladas",
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
      desc: "Los ataques básicos ralentizan a los enemigos. Atacar a un objetivo ralentizado tiene posibilidad de crítico con daño extra.",
    },
    abilities: [
      { key: "ashee_q", slot: 0, name: "Rapid Firesale", glyph: "R", desc: "Potencia tus siguientes ataques con muchísima velocidad de ataque.", cast: "self", manaCost: [40,40,40,40,40], cooldown: [10,9,8,7,6], range: 0 },
      { key: "ashee_w", slot: 1, name: "Volley of Values", glyph: "V", desc: "Dispara un cono de flechas que daña y ralentiza a todos los enemigos alcanzados.", cast: "skillshot", manaCost: [60,65,70,75,80], cooldown: [12,10,8,6,4], range: 620, width: 260, damage: [50,85,120,155,190], damageType: D, adRatio: 1.0 },
      { key: "ashee_e", slot: 2, name: "Hawkshot Prime", glyph: "H", desc: "Otorga un empujón de velocidad de movimiento y revela la zona de delante.", cast: "self", manaCost: [30,30,30,30,30], cooldown: [10,10,10,10,10], range: 0 },
      { key: "ashee_r", slot: 3, name: "Enchanted Clearance Arrow", glyph: "C", desc: "Dispara una flecha de cristal gigante por todo el mapa. Aturde y daña gravemente al primer campeón enemigo alcanzado.", cast: "skillshot", manaCost: [100,100,100], cooldown: [75,65,55], range: 2600, width: 130, speed: 1600, damage: [250,400,550], damageType: M, apRatio: 1.0, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$2.49", listPrice: "$49.99", rating: 4.4, reviews: 5310,
    blurb: "Set de tiro con arco temático de hielo. Flechas se venden aparte. La cuerda no es hilo dental, seguro.",
    reviewQuote: "\"clavé una flecha global una vez y ahora toda mi familia me respeta\" — dad_of_three",
    shipping: "Envío gratis (congelado en tránsito)",
  },

  garon: {
    id: "garon",
    name: "Garón",
    title: "el Poderío de Dropshipacia",
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
      desc: "Regenera un porcentaje de tu vida máxima por segundo cuando no has recibido daño hace poco.",
    },
    abilities: [
      { key: "garon_q", slot: 0, name: "Decisive Discount", glyph: "D", desc: "Libérate de las ralentizaciones y potencia tu siguiente ataque para infligir daño extra y silenciar.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [8,7.5,7,6.5,6], range: 0, damage: [30,60,90,120,150], damageType: D, adRatio: 0.5 },
      { key: "garon_w", slot: 1, name: "Courage Coupon", glyph: "C", desc: "Gana un escudo y reduce el daño recibido durante unos segundos.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [23,21,19,17,15], range: 0 },
      { key: "garon_e", slot: 2, name: "Judgment Spin2Win", glyph: "J", desc: "Gira rápidamente tu espada, infligiendo daño físico a todos los enemigos cercanos durante unos segundos.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [10,9,8,7,6], range: 330, radius: 330, damage: [16,24,32,40,48], damageType: D, adRatio: 0.36 },
      { key: "garon_r", slot: 3, name: "Demacian Liquidation", glyph: "L", desc: "Invoca justicia pirata, infligiendo daño verdadero que aumenta cuanto menos vida tenga el objetivo.", cast: "target", manaCost: [0,0,0], cooldown: [55,45,35], range: 400, damage: [200,320,440], damageType: T, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$4.20", listPrice: "$54.99", rating: 4.6, reviews: 7788,
    blurb: "Caballero de plástico indestructible. Solo sabe un movimiento, pero es bueno. Gira sin tu consentimiento.",
    reviewQuote: "\"¡DEMACIAAA— perdón. Es que lo hace solo.\" — comprador verificado",
    shipping: "Envío gratis (girando todo el camino hasta aquí)",
  },

  jinix: {
    id: "jinix",
    name: "Jinix",
    title: "el Cañón Suelto (Devolución)",
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
      desc: "Conseguir una baja otorga un enorme empujón de velocidad de movimiento y de ataque.",
    },
    abilities: [
      { key: "jinix_q", slot: 0, name: "Switcheroo!", glyph: "S", desc: "Alterna entre minigun rápida (velocidad de ataque) y cohetes (más rango y salpicadura). Cambiar es gratis.", cast: "self", manaCost: [0,0,0,0,0], cooldown: [1,1,1,1,1], range: 0 },
      { key: "jinix_w", slot: 1, name: "Zap!", glyph: "Z", desc: "Dispara una descarga de largo alcance que daña y ralentiza al primer enemigo alcanzado.", cast: "skillshot", manaCost: [50,60,70,80,90], cooldown: [8,7,6,5,4], range: 1400, width: 60, speed: 3200, damage: [70,120,170,220,270], damageType: D, adRatio: 1.4 },
      { key: "jinix_e", slot: 2, name: "Flame Chompers!", glyph: "F", desc: "Lanza una línea de trampas que enraízan al primer enemigo que las pise.", cast: "ground", manaCost: [70,75,80,85,90], cooldown: [16,15,14,13,12], range: 900, radius: 130, damage: [60,100,140,180,220], damageType: M },
      { key: "jinix_r", slot: 3, name: "Super Mega Death Rocket!", glyph: "R", desc: "Lanza un cohete global que gana daño mientras viaja y explota con daño extra según el % de vida.", cast: "skillshot", manaCost: [100,100,100], cooldown: [70,60,50], range: 3200, width: 140, speed: 1700, damage: [250,400,550], damageType: D, adRatio: 1.5, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$3.99", listPrice: "$52.99", rating: 3.9, reviews: 6120,
    blurb: "Muñeca gremlin caótica con cohetes que funcionan de verdad (lee el manual de seguridad de 40 páginas que no incluimos).",
    reviewQuote: "\"los vecinos tienen preguntas. 5 estrellas.\" — anónimo",
    shipping: "Envío gratis (NO dejes caer el paquete)",
  },

  luux: {
    id: "luux",
    name: "Luux",
    title: "la Dama de los Descuentos Luminosos",
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
      desc: "Dañar a un enemigo con una habilidad lo marca; tu siguiente básico detona la marca con daño mágico extra.",
    },
    abilities: [
      { key: "luux_q", slot: 0, name: "Light Zip-tie", glyph: "Z", desc: "Dispara un rayo de luz que enraíza a los dos primeros enemigos que atraviesa.", cast: "skillshot", manaCost: [50,60,70,80,90], cooldown: [11,10.5,10,9.5,9], range: 1200, width: 55, speed: 1200, damage: [70,120,170,220,270], damageType: M, apRatio: 0.9 },
      { key: "luux_w", slot: 1, name: "Prismatic Barrier+", glyph: "B", desc: "Lanza una varita bumerán que escuda a ti y a los aliados que toca, a la ida y a la vuelta.", cast: "self", manaCost: [60,60,60,60,60], cooldown: [14,13,12,11,10], range: 700 },
      { key: "luux_e", slot: 2, name: "Lucent Singularity", glyph: "S", desc: "Crea una zona de ralentización que detona con daño mágico en área.", cast: "ground", manaCost: [70,80,90,100,110], cooldown: [10,9.5,9,8.5,8], range: 1100, radius: 300, damage: [65,115,165,215,265], damageType: M, apRatio: 0.7 },
      { key: "luux_r", slot: 3, name: "Final Spark™", glyph: "F", desc: "Dispara un láser colosal en una línea enorme, infligiendo daño mágico y detonando Iluminación.", cast: "skillshot", manaCost: [100,100,100], cooldown: [60,50,40], range: 3000, width: 220, damage: [300,400,500], damageType: M, apRatio: 1.2, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$2.79", listPrice: "$47.99", rating: 4.7, reviews: 8891,
    blurb: "Varita brillante que dispara un láser lo bastante grande como para verse desde el espacio. La FCC no aprobó esto.",
    reviewQuote: "\"pium pium arcoíris de perdición. volvería a rebajarla.\" — mom_gamer",
    shipping: "Envío gratis (brilla en la oscuridad, inquietantemente)",
  },

  blitzcronk: {
    id: "blitzcronk",
    name: "Blïtzcronk",
    title: "el Gran Robot de Vapor Pirata",
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
      desc: "Cuando te quedas con poca vida, convierte parte de tu maná en un escudo temporal.",
    },
    abilities: [
      { key: "blitz_q", slot: 0, name: "Rocket Grab.zip", glyph: "G", desc: "Dispara tu puño para agarrar al primer enemigo alcanzado y arrastrarlo hacia ti. El gancho pirata por excelencia.", cast: "skillshot", manaCost: [100,100,100,100,100], cooldown: [13,12,11,10,9], range: 1050, width: 70, speed: 1900, damage: [90,140,190,240,290], damageType: M, apRatio: 1.0 },
      { key: "blitz_w", slot: 1, name: "Overdrive Turbo", glyph: "O", desc: "Sobrecárgate para un gran empujón de velocidad de movimiento y de ataque, que decae con el tiempo.", cast: "self", manaCost: [75,75,75,75,75], cooldown: [15,14,13,12,11], range: 0 },
      { key: "blitz_e", slot: 2, name: "Power Fist Pro", glyph: "P", desc: "Carga tu siguiente ataque para lanzar al objetivo por los aires.", cast: "self", manaCost: [25,25,25,25,25], cooldown: [9,8,7,6,5], range: 0, damage: [0,0,0,0,0], damageType: M },
      { key: "blitz_r", slot: 3, name: "Static Field Sale", glyph: "S", desc: "Silencia y golpea a todos los enemigos cercanos con una cadena de relámpagos.", cast: "self", manaCost: [100,100,100], cooldown: [45,35,25], range: 600, radius: 600, damage: [275,400,525], damageType: M, apRatio: 1.0, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$5.55", listPrice: "$64.99", rating: 4.3, reviews: 4402,
    blurb: "Robot de vapor con aire retro. Agarra cosas. Te agarra a TI. Estamos obligados legalmente a decir que no para de agarrar.",
    reviewQuote: "\"enganchó a mi cartero. arrepentimiento instantáneo. respeto instantáneo.\" — cornerpeek_carl",
    shipping: "Envío gratis (pesado — lo siento, repartidor)",
  },

  darios: {
    id: "darios",
    name: "Dariôs",
    title: "la Mano de Nyoxus",
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
      desc: "Los ataques y habilidades aplican cargas de Sangrado que infligen daño con el tiempo; con 5 cargas ganas muchísimo daño de ataque.",
    },
    abilities: [
      { key: "darios_q", slot: 0, name: "Decimate Deal", glyph: "D", desc: "Blande tu hacha en un amplio círculo; el borde exterior inflige daño extra y te cura por cada campeón golpeado.", cast: "self", manaCost: [30,30,30,30,30], cooldown: [9,8,7,6,5], range: 425, radius: 425, damage: [50,80,110,140,170], damageType: D, adRatio: 1.0 },
      { key: "darios_w", slot: 1, name: "Crippling Strike Combo", glyph: "C", desc: "Tu siguiente ataque inflige daño extra y ralentiza mucho al objetivo.", cast: "self", manaCost: [30,30,30,30,30], cooldown: [7,6.5,6,5.5,5], range: 0, damage: [40,70,100,130,160], damageType: D, adRatio: 0.4 },
      { key: "darios_e", slot: 2, name: "Apprehend Express", glyph: "A", desc: "Arrastra a un enemigo hacia ti con tu hacha y lo ralentiza.", cast: "target", manaCost: [40,40,40,40,40], cooldown: [16,14,12,10,8], range: 535 },
      { key: "darios_r", slot: 3, name: "Nyoxian Guillotine", glyph: "G", desc: "Salta y ejecuta a un enemigo con daño verdadero que aumenta con su vida perdida y tu Sangrado.", cast: "target", manaCost: [100,100,100], cooldown: [60,45,30], range: 475, damage: [150,250,350], damageType: T, maxRank: 3, ultLevels: [6,11,16] },
    ],
    price: "$4.44", listPrice: "$57.99", rating: 4.5, reviews: 6650,
    blurb: "Hombre del hacha grande. Te atrae. Corta. Dice una palabra que da miedo. Ergonómicamente una pesadilla. Cinco estrellas.",
    reviewQuote: "\"el hacha es de metal de verdad ¿por qué el hacha es de metal de verdad?\" — concerned_parent99",
    shipping: "Envío gratis (el hacha se envía aparte, obviamente)",
  },
};

export const CHAMPION_LIST = Object.values(CHAMPIONS);
export const CHAMPION_IDS = Object.keys(CHAMPIONS);
