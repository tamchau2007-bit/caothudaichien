/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CharacterId =
  | 'hoang_saigon'
  | 'kendu'
  | 'le_dao'
  | 'hung_chimbay'
  | 'nhat_ban'
  | 'hoang_xitrum'
  | 'khoa_pug'
  | 'bao_ren';

export type GameMode = 'ai' | 'training' | 'local2p' | 'online';

export type SkillSlot = 'J' | 'U' | 'I' | 'WU' | 'WI' | 'SU' | 'SI' | 'WJ' | 'SJ';

export type MapId = 'loi_dai' | 'nguyen_hue' | 'chau_phi' | 'nhat_ban_sakura' | string;

/** A single frame of player intent. Every field must stay serialisable. */
export interface KeyInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  charge: boolean;
  guard: boolean;
  dash?: boolean;
  attackJ?: boolean;
  skillU?: boolean;
  skillI?: boolean;
  jumpPressed?: boolean;
  dashPressed?: boolean;
  attackJPressed?: boolean;
  skillUPressed?: boolean;
  skillIPressed?: boolean;
}

export interface GameSettings {
  screenShake: boolean;
  vfxParticles: boolean;
  fpsLimit: number;
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  /** Online rollback input delay, measured in 60Hz frames. */
  bufferDelay: number;
  showHitboxes: boolean;
  infiniteStamina: boolean;
  dummyBehavior: 'stand' | 'jump' | 'guard' | 'crouch' | 'counter';
}

export type SkillEffectType =
  | 'trip'
  | 'suction'
  | 'freeze'
  | 'burn'
  | 'confuse'
  | 'slow'
  | 'reflect'
  | 'burger_drop'
  | 'speaker_pulse'
  | 'spring_bounce'
  | 'trap_hold'
  | 'ban_tho'
  | 'skibidi_giant';

export interface SkillDefinition {
  id: SkillSlot;
  name: string;
  vietnameseName?: string;
  typeDesc?: string;
  description?: string;
  staminaCost: number;
  damage: number;
  knockback: { x: number; y: number };
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  hitstop: number;
  rangeX: number;
  rangeY: number;
  isProjectile?: boolean;
  isTrap?: boolean;
  isCounter?: boolean;
  isUnblockable?: boolean;
  isGrab?: boolean;
  isBuff?: boolean;
  isSuperArmor?: boolean;
  effectType?: SkillEffectType;
}

export interface CharacterData {
  id: CharacterId;
  name: string;
  title: string;
  archetype: string;
  maxHp: number;
  maxStamina: number;
  /** 0.5 = heavy (hard to launch), 1.5 = light. */
  weight: number;
  speed: number;
  dashSpeed: number;
  dashDuration: number;
  dashType?: string;
  jumpForce: number;
  jumpCount: number;
  passiveName?: string;
  passiveDesc?: string;
  gimmickName?: string;
  gimmickDesc?: string;
  colorTheme: {
    primary: string;
    secondary: string;
    aura?: string;
    spark: string;
  };
  skills: Record<SkillSlot, SkillDefinition>;
  winQuote: string;
  dashHasInvul?: boolean;
  dashHasSuperArmor?: boolean;
  dashLeavesHazard?: boolean;
  hasGliding?: boolean;
  hasWallCling?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hurtbox extends Rect {}

export interface Hitbox {
  id: string;
  attackerId: 'p1' | 'p2';
  x: number;
  y: number;
  w: number;
  h: number;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  hitstop: number;
  isUnblockable?: boolean;
  isTrip?: boolean;
  isGrab?: boolean;
  isHeavy?: boolean;
  sparkColor: string;
  soundType: 'light' | 'heavy' | 'slash' | 'blocked';
  /** Frames of life left. */
  activeTicks: number;
  maxTicks: number;
  /** When true the hitbox follows its attacker each frame. */
  follows?: boolean;
  /** Offset (attacker feet -> hitbox) used while following. */
  offsetX?: number;
  offsetY?: number;
  /** Allows a single hitbox to hit only once per target. */
  hasHit?: boolean;
}

export interface Projectile {
  id: string;
  ownerId: 'p1' | 'p2';
  characterId: CharacterId;
  skillId: SkillSlot;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  lifetime: number;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  color: string;
  name: string;
  gravity?: number;
  hitstop?: number;
  isUnblockable?: boolean;
  isPickupBurger?: boolean;
  isSpeakerPulse?: boolean;
  isSpringBounce?: boolean;
  isFigureTrap?: boolean;
  isPillowRocket?: boolean;
  isBoneSpikes?: boolean;
  isCrossbowArrow?: boolean;
  isShuriken?: boolean;
  isTornado?: boolean;
  isFeatherTrap?: boolean;
  isCatPoop?: boolean;
  isDoraemon?: boolean;
  isSonicExe?: boolean;
  isMiniSkibidi?: boolean;
  isBanTho?: boolean;
  isGiantUlti?: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  type: string;
}

export interface DamageText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  isCritical?: boolean;
}

export interface PlatformData {
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  label?: string;
  isOneWay?: boolean;
}

/** Alias kept for physics helpers. */
export type StagePlatform = PlatformData;

export interface MapData {
  id: string;
  name: string;
  vietnameseName?: string;
  themeDesc?: string;
  description?: string;
  bgColor?: string;
  bgGradient?: string[];
  floorColor?: string;
  floorY?: number;
  platforms: PlatformData[];
}

export interface PetEntity {
  id: string;
  ownerId: 'p1' | 'p2';
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  state: 'follow' | 'bowl_slide';
  timer: number;
}

export type FighterState =
  | 'IDLE'
  | 'WALK'
  | 'JUMP'
  | 'FALL'
  | 'DASH'
  | 'GUARD'
  | 'GUARD_BROKEN'
  | 'ATTACK'
  | 'CHARGE_W'
  | 'HIT_STUN'
  | 'DEAD';

export interface FighterEntity {
  playerId: 'p1' | 'p2';
  character: CharacterData;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 1 | -1;
  hp: number;
  stamina: number;
  state: FighterState;
  stateTime: number;
  currentSkill: SkillDefinition | null;
  skillTick: number;
  jumpsLeft: number;
  isGrounded: boolean;
  isWallClinging: boolean;
  currentPlatform: PlatformData | null;
  droppingPlatformTimer: number;
  normalComboStep: number;
  normalComboTimer: number;
  hitStunTime: number;
  guardBreakTime: number;
  invulnerableTime: number;
  superArmorTime: number;
  counterTime: number;
  buffTime: number;
  buffType: string | null;
  confusedTime: number;
  trappedTime: number;
  stealthTime: number;
  hitFlashTime: number;
  hoangScaleBonus: number;
  hoangArmorBonus: number;
  hoangKnockbackBonus: number;
  hoangDamageAbsorbedSinceLastTier: number;
  beatboxFlowWindow: number;
  beatboxFlowActive: boolean;
  ribBonesAvailable: number;
  maxHpPenalty: number;
  wibuStacks: number;
  poisonClawStacks: number;
  shadowClonesCount: number;
  airDriftCharge: number;
  kickRangeBonusTime: number;
  nextHitCrit: boolean;
  attackFrame: number;
  attackDuration: number;
  comboHits: number;
  comboDamage: number;
  comboTimer: number;
  totalDamageDealt: number;
  /** Extra jumps allowed while the glide buff is active (Hùng Chim Bay). */
  airJumpsUsed: number;
  petCat?: PetEntity;
}

/** Events emitted by a deterministic simulation step (consumed for sound/FX/UI). */
export type GameEvent =
  | { type: 'sound'; name: 'light' | 'heavy' | 'slash' | 'blocked' | 'crit' | 'dash' | 'jump' | 'ultimate' | 'guardBreak' | 'wallBounce' }
  | { type: 'skill'; playerId: 'p1' | 'p2'; slot: SkillSlot }
  | { type: 'matchEnd'; winner: 'p1' | 'p2' | 'draw'; quote: string };
