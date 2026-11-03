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

export type MapId = 'loi_dai' | 'nguyen_hue' | 'ben_thanh' | string;

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
  bufferDelay: number;
  showHitboxes: boolean;
  infiniteStamina: boolean;
  dummyBehavior: 'stand' | 'jump' | 'guard' | 'crouch';
}

export interface SkillDefinition {
  id: SkillSlot;
  name: string;
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
  effectType?: 'trip' | 'suction' | 'freeze' | 'burn';
}

export interface CharacterData {
  id: CharacterId;
  name: string;
  title: string;
  avatar: string;
  maxHp: number;
  maxStamina: number;
  speed: number;
  dashSpeed: number;
  dashDuration: number;
  jumpForce: number;
  jumpCount: number;
  colorTheme: {
    primary: string;
    secondary: string;
    spark: string;
  };
  skills: Record<SkillSlot, SkillDefinition>;
  winQuote: string;
  dashHasInvul?: boolean;
  dashHasSuperArmor?: boolean;
  hasGliding?: boolean;
}

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
  soundType: 'light' | 'heavy' | 'slash';
  activeTicks: number;
  maxTicks: number;
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
  isOneWay?: boolean;
}

export interface MapData {
  id: string;
  name: string;
  bgGradient: string[];
  floorColor: string;
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
  state:
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
  petCat?: PetEntity;
}
