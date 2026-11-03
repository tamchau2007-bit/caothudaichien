/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CharacterId =
  | 'hoang_saigon'
  | 'kendu'
  | 'le_dao'
  | 'khoa_pug'
  | 'nhat_ban'
  | 'hung_chimbay'
  | 'hoang_xitrum'
  | 'bao_ren';

export type MapId = 'loi_dai' | 'nguyen_hue' | 'chau_phi' | 'nhat_ban_sakura';

export interface StagePlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface MapData {
  id: MapId;
  name: string;
  vietnameseName: string;
  themeDesc: string;
  description?: string;
  bgColor: string;
  floorY: number;
  platforms: StagePlatform[];
}

export type FighterState =
  | 'IDLE'
  | 'WALK'
  | 'JUMP'
  | 'FALL'
  | 'DASH'
  | 'CHARGE_W'
  | 'GUARD'
  | 'GUARD_BROKEN'
  | 'ATTACK'
  | 'HIT_STUN'
  | 'KNOCKED_DOWN'
  | 'DEAD';

export type SkillSlot =
  | 'J'     // Đánh thường (0 Sta) - Combo 3 đòn J1, J2, J3
  | 'U'     // Chiêu 1 (10 Sta)
  | 'I'     // Chiêu 2 (15 Sta)
  | 'SU'    // Chiêu 3: S + U (20 Sta)
  | 'SI'    // Chiêu 4: S + I (20 Sta)
  | 'WU'    // Chiêu 5: W + U (25 Sta)
  | 'WI'    // Chiêu 6: W + I (30 Sta)
  | 'SJ'    // Chiêu 7: S + J (35 Sta)
  | 'WJ';   // Chiêu 8: W + J - Tuyệt Chiêu Tối Thượng (60 Sta)

export interface SkillDefinition {
  id: SkillSlot;
  name: string;
  vietnameseName: string;
  typeDesc: string;
  staminaCost: number;
  damage: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  knockback: { x: number; y: number };
  hitstop: number;
  description: string;
  rangeX: number;
  rangeY: number;
  isSuperArmor?: boolean;
  isUnblockable?: boolean;
  isGrab?: boolean;
  isProjectile?: boolean;
  isTrap?: boolean;
  isBuff?: boolean;
  isCounter?: boolean;
  effectType?:
    | 'reflect'
    | 'suction'
    | 'crit_buff'
    | 'trip'
    | 'bleed'
    | 'confuse'
    | 'slow'
    | 'trap_hold'
    | 'spring_bounce'
    | 'burger_drop'
    | 'speaker_pulse'
    | 'ban_tho'
    | 'skibidi_giant';
}

export interface CharacterData {
  id: CharacterId;
  name: string;
  title: string;
  archetype: string;
  maxHp: number;
  maxStamina: number;
  weight: number;
  speed: number;
  jumpCount: number;
  jumpForce: number;
  hasWallCling?: boolean;
  hasGliding?: boolean;
  dashType: string;
  dashSpeed: number;
  dashDuration: number;
  dashHasSuperArmor?: boolean;
  dashHasInvul?: boolean;
  dashLeavesHazard?: boolean;
  passiveName: string;
  passiveDesc: string;
  gimmickName: string;
  gimmickDesc: string;
  winQuote: string;
  colorTheme: {
    primary: string;
    secondary: string;
    aura: string;
    spark: string;
  };
  skills: Record<SkillSlot, SkillDefinition>;
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
  soundType?: 'light' | 'heavy' | 'slash' | 'grab' | 'slam' | 'magic' | 'bass' | 'dj' | 'flush';
  activeTicks: number;
  maxTicks: number;
}

export interface Hurtbox {
  x: number;
  y: number;
  w: number;
  h: number;
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
  isTrap?: boolean;
  isBoomerang?: boolean;
  isHeldReturn?: boolean;
  isGiantUlti?: boolean;
  isPickupBurger?: boolean;
  isSpeakerPulse?: boolean;
  isFigureTrap?: boolean;
  isBanTho?: boolean;
  isSpringBounce?: boolean;
  isCrossbowArrow?: boolean;
  isBoneSpikes?: boolean;
  isShuriken?: boolean;
  isTornado?: boolean;
  isFeatherTrap?: boolean;
  isPillowRocket?: boolean;
  isCatPoop?: boolean;
  isDoraemon?: boolean;
  isSonicExe?: boolean;
  isMiniSkibidi?: boolean;
  color: string;
  name: string;
  extraState?: any;
}

export interface PetEntity {
  id: string;
  ownerId: 'p1' | 'p2';
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  state: 'follow' | 'attack' | 'bowl_slide';
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
  state: FighterState;
  stateTime: number;
  currentSkill: SkillDefinition | null;
  skillTick: number;
  jumpsLeft: number;
  isGrounded: boolean;
  isWallClinging: boolean;
  currentPlatform: StagePlatform | null;
  droppingPlatformTimer: number;

  // Normal Attack J Combo Chain (J1 -> J2 -> J3)
  normalComboStep: 0 | 1 | 2; // 0 = J1, 1 = J2, 2 = J3 finisher
  normalComboTimer: number;   // Window to press J next

  // Status timers
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

  // Gimmick state trackers
  // 1. Hoàng Sài Gòn
  hoangScaleBonus: number; // 1.0 to 1.6x size
  hoangArmorBonus: number; // +15% per tier
  hoangKnockbackBonus: number; // +30% per tier
  hoangDamageAbsorbedSinceLastTier: number;

  // 2. KenDu Beatbox Flow
  beatboxFlowWindow: number; // rhythm timer
  beatboxFlowActive: boolean;

  // 3. Lê Đào 12 Xương Sườn
  ribBonesAvailable: number; // 0 to 12 ribs
  maxHpPenalty: number;

  // 4. Khoa Pug Wibu Stack
  wibuStacks: number;

  // 5. Nhật Bản Móng Độc
  poisonClawStacks: number;
  shadowClonesCount: number;

  // 6. Hùng Chim Bay Air Drift
  airDriftCharge: number; // 0 to 100%

  // 7. Hoàng Xì Trum Pet Mèo
  petCat?: PetEntity;
  kickRangeBonusTime: number;
  nextHitCrit: boolean;
  attackFrame: number;
  attackDuration: number;

  // Stats tracking for match
  comboHits: number;
  comboDamage: number;
  comboTimer: number;
  totalDamageDealt: number;
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
  type:
    | 'spark'
    | 'smoke'
    | 'shockwave'
    | 'ring'
    | 'waifu_heart'
    | 'glitch_line'
    | 'feather'
    | 'bone'
    | 'soundwave'
    | 'sakura'
    | 'rock_rubble';
}

export interface DamageText {
  id: string;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  alpha?: number;
  isCrit?: boolean;
}

export interface KeyInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;      // KeyK
  dash: boolean;      // KeyL
  charge: boolean;    // KeyW
  guard: boolean;     // KeyS
  attackJ: boolean;   // KeyJ
  skillU: boolean;    // KeyU
  skillI: boolean;    // KeyI

  // Edge triggers
  jumpPressed?: boolean;
  dashPressed?: boolean;
  attackJPressed?: boolean;
  skillUPressed?: boolean;
  skillIPressed?: boolean;
}

export type GameMode = 'ai' | 'training' | 'local2p' | 'online';

export interface GameSettings {
  screenShake: boolean;
  vfxParticles: boolean;
  fpsLimit: 60 | 120 | 0;
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  bufferDelay: number;
  showHitboxes: boolean;
  infiniteStamina: boolean;
  dummyBehavior: 'stand' | 'guard' | 'jump' | 'counter';
}
