// Core shared types for the LMAO game engine.
// The engine is pure TypeScript with no framework dependencies so it can run
// identically on the host (authoritative) and be reasoned about on clients.

export type Team = "blue" | "red" | "neutral";

export type EntityKind =
  | "champion"
  | "minion"
  | "turret"
  | "nexus"
  | "monster";

export type MinionType = "melee" | "caster" | "cannon";

export type DamageType = "physical" | "magic" | "true";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Buff {
  id: string;
  kind:
    | "slow"
    | "stun"
    | "root"
    | "shield"
    | "speed"
    | "haste"
    | "dot"
    | "attackspeed"
    | "invuln"
    | "airborne"
    | "empower";
  // Remaining seconds.
  time: number;
  // Generic magnitude — meaning depends on kind (e.g. slow % , shield amount).
  magnitude: number;
  // For DoTs.
  tickDamage?: number;
  tickType?: DamageType;
  tickAcc?: number;
  sourceId?: number;
  // Flat stat bonuses folded into recomputeChampStats (jungle/epic buffs).
  ad?: number;
  ap?: number;
  armor?: number;
  mr?: number;
  // Cosmetic label for the HUD.
  label?: string;
}

export interface AbilityState {
  cd: number; // remaining cooldown seconds
  rank: number; // 0 = not learned yet
  charges?: number;
  // Passive/stateful counters an ability may need (e.g. Yasou tempo stacks).
  data?: Record<string, number>;
}

export interface Entity {
  id: number;
  kind: EntityKind;
  team: Team;
  pos: Vec2;
  // Facing / last move direction (for animations + skillshots).
  face: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
}

export interface Champion extends Entity {
  kind: "champion";
  championId: string;
  // Owner: a network player id, or "bot:<n>" for AI.
  ownerId: string;
  displayName: string;
  isBot: boolean;

  mana: number;
  maxMana: number;

  level: number;
  xp: number;
  gold: number;

  // Base + item-derived combat stats (recomputed when items/level change).
  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  attackRange: number;
  attackSpeed: number; // attacks per second
  moveSpeed: number; // units per second
  hpRegen: number; // per second
  manaRegen: number; // per second
  critChance: number;
  lifesteal: number;
  cooldownReduction: number; // 0..0.4

  // Runtime combat.
  attackWindup: number; // seconds until current auto lands (>0 = winding up)
  attackCooldown: number; // seconds until can start next auto
  attackTargetId: number | null;

  // Orders (set by inputs / AI).
  moveTarget: Vec2 | null;
  holdPosition: boolean;

  abilities: AbilityState[]; // [Q, W, E, R]
  passiveData: Record<string, number>;
  buffs: Buff[];

  items: string[];

  // Death / respawn.
  respawnTimer: number;

  // Score.
  kills: number;
  deaths: number;
  assists: number;
  cs: number; // creep score

  // Recent damagers for assist/kill credit: entityId -> secondsSince.
  recentDamagers: Record<number, number>;

  // Shop convenience: whether currently in fountain.
  inFountain: boolean;

  // Netcode: latest input sequence acknowledged.
  lastInputSeq: number;

  // Spell fx accumulator (client cosmetic only, host authoritative counters).
  recallTimer: number; // >0 while channeling recall
}

export interface Minion extends Entity {
  kind: "minion";
  minionType: MinionType;
  attackDamage: number;
  attackRange: number;
  attackSpeed: number;
  attackCooldown: number;
  moveSpeed: number;
  goldValue: number;
  xpValue: number;
  targetId: number | null;
  // Which of the three lanes this minion marches down.
  lane: "top" | "mid" | "bot";
  // Waypoint index along the lane path for this team.
  waypoint: number;
  aggroLockId: number | null;
  aggroLockTimer: number;
}

export interface Turret extends Entity {
  kind: "turret";
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  targetId: number | null;
  // Which lane this turret guards (base turrets have no lane).
  lane: "top" | "mid" | "bot" | null;
  order: number; // 3 = outer, 2 = inner, 1 = inhibitor, 0 = base turret
  // Escalating damage on the same champion target.
  focusTargetId: number | null;
  focusStacks: number;
  goldValue: number;
}

export interface Nexus extends Entity {
  kind: "nexus";
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  targetId: number | null;
}

// A neutral jungle monster (team is always "neutral" so both sides are foes).
export interface Monster extends Entity {
  kind: "monster";
  team: "neutral";
  monsterKind: string; // MonsterKind
  epic: boolean;
  campId: number;
  home: Vec2;
  level: number;
  attackDamage: number;
  attackRange: number;
  attackSpeed: number;
  attackCooldown: number;
  moveSpeed: number;
  armor: number;
  magicResist: number;
  targetId: number | null;
  goldValue: number;
  xpValue: number;
  respawnTimer: number; // >0 while the camp is cleared and regrowing
  buff: string; // reward buff id (MonsterKind)
  name: string;
}

export interface Projectile {
  id: number;
  team: Team;
  pos: Vec2;
  vel: Vec2;
  speed: number;
  // Homing target (auto attacks) or null (skillshots).
  targetId: number | null;
  sourceId: number;
  damage: number;
  damageType: DamageType;
  radius: number;
  kind: "auto" | "skillshot";
  spellId?: string;
  // Skillshot travel budget.
  maxRange?: number;
  traveled?: number;
  // Entities already hit (for piercing shots).
  hits?: number[];
  pierce?: boolean;
  // Apply on-hit effect id, resolved by combat.
  onHit?: string;
  onHitMagnitude?: number;
  onHitDuration?: number;
  // For crit auto visuals.
  crit?: boolean;
  // Ability-specific scratch data (e.g. pierce limits).
  data?: Record<string, number>;
  width?: number;
}

// A transient visual/impact event the renderer plays (explosions, text, etc).
export interface FxEvent {
  t: string; // type: "hit" | "cast" | "level" | "death" | "ping" | "text" | "aoe" | "beam" | "heal" | "shield"
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  team?: Team;
  value?: number;
  color?: string;
  text?: string;
  spellId?: string;
  radius?: number;
  ttl?: number;
}

export interface KillFeedItem {
  id: number;
  killer: string;
  victim: string;
  killerTeam: Team;
  victimTeam: Team;
  time: number;
  isTurret?: boolean;
  isNexus?: boolean;
  multi?: number; // multikill count
  shutdown?: boolean;
}

export interface PlayerSlot {
  playerId: string; // network id or bot:n
  name: string;
  team: Team;
  championId: string;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  // Filled once the game starts.
  championEntityId?: number;
}

export interface GameConfig {
  teamSize: number; // target size of YOUR team (you + ally bots)
  enemyBots: number; // target size of the ENEMY team (bots)
  botFill: boolean;
  difficulty: "casual" | "normal" | "savage";
  minionsEnabled: boolean;
}

export type Phase = "lobby" | "loading" | "countdown" | "playing" | "ended";

export interface GameState {
  tick: number;
  time: number; // seconds elapsed in-match
  phase: Phase;
  winner: Team | null;
  nextEntityId: number;
  nextProjectileId: number;
  nextFxId: number;

  champions: Record<number, Champion>;
  minions: Record<number, Minion>;
  turrets: Record<number, Turret>;
  nexuses: Record<number, Nexus>;
  monsters: Record<number, Monster>;
  projectiles: Projectile[];

  // Traps / zones (mushrooms, chompers, singularities) keyed by id.
  zones: Zone[];

  // Transient per-tick fx queue (drained by clients each snapshot).
  fx: FxEvent[];
  killFeed: KillFeedItem[];

  minionSpawnTimer: number;
  minionWave: number;

  config: GameConfig;

  // Aggregate team stats for scoreboard/economy bars.
  teamKills: Record<Team, number>;
  teamGold: Record<Team, number>;
}

export interface Zone {
  id: number;
  spellId: string;
  team: Team;
  sourceId: number;
  pos: Vec2;
  radius: number;
  // Lifetime.
  time: number;
  // Behavior params.
  damage?: number;
  damageType?: DamageType;
  tickInterval?: number;
  tickAcc?: number;
  kind: "trap" | "aura" | "wall" | "ward" | "delayed";
  // For delayed bombs (Luux E / Jinix rocket).
  fuse?: number;
  armed?: boolean;
  triggeredBy?: number | null;
  slow?: number;
  rootDuration?: number;
  stunDuration?: number;
  // wind wall orientation
  angle?: number;
  length?: number;
}

// Input command a player sends to the host each frame.
export interface PlayerInput {
  seq: number;
  // Right-click move / attack-move.
  move?: Vec2 | null;
  attackMove?: Vec2 | null;
  // Explicit attack target (from clicking an enemy).
  attackTarget?: number | null;
  stop?: boolean;
  // Ability casts this frame.
  casts?: CastCommand[];
  // Shop purchases.
  buy?: string[];
  sell?: string[];
  // Recall toggle.
  recall?: boolean;
  // Level up an ability [0..3].
  levelUp?: number | null;
  // Cosmetic ping.
  ping?: { x: number; y: number; kind: string } | null;
}

export interface CastCommand {
  slot: number; // 0..3 => Q W E R
  x: number;
  y: number;
  targetId?: number | null;
}
