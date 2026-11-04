/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CharacterId,
  DamageText,
  FighterEntity,
  GameEvent,
  GameMode,
  GameSettings,
  Hitbox,
  KeyInputState,
  MapData,
  Particle,
  PlatformData,
  Projectile,
  SkillDefinition,
  SkillSlot,
} from './types';
import { CHARACTERS } from './characters';
import { MAPS } from './maps';
import {
  STAGE_CONFIG,
  calculateDamage,
  checkAABBCollision,
  checkGroundAndPlatformsRaycast,
  checkWallBounce,
  getFighterHurtbox,
} from './physics';
import { Rng } from './rng';

const MAX_PARTICLES = 300;
export const SIMULATION_FPS = 60;
export const FRAME_TIME = 1 / SIMULATION_FPS;

const FIGHTER_DYNAMIC_FIELDS = [
  'x',
  'y',
  'vx',
  'vy',
  'width',
  'height',
  'facing',
  'hp',
  'stamina',
  'state',
  'stateTime',
  'skillTick',
  'jumpsLeft',
  'isGrounded',
  'isWallClinging',
  'droppingPlatformTimer',
  'normalComboStep',
  'normalComboTimer',
  'hitStunTime',
  'guardBreakTime',
  'invulnerableTime',
  'superArmorTime',
  'counterTime',
  'buffTime',
  'buffType',
  'confusedTime',
  'trappedTime',
  'stealthTime',
  'hitFlashTime',
  'hoangScaleBonus',
  'hoangArmorBonus',
  'hoangKnockbackBonus',
  'hoangDamageAbsorbedSinceLastTier',
  'beatboxFlowWindow',
  'beatboxFlowActive',
  'ribBonesAvailable',
  'maxHpPenalty',
  'wibuStacks',
  'poisonClawStacks',
  'shadowClonesCount',
  'airDriftCharge',
  'kickRangeBonusTime',
  'nextHitCrit',
  'attackFrame',
  'attackDuration',
  'comboHits',
  'comboDamage',
  'comboTimer',
  'totalDamageDealt',
  'airJumpsUsed',
] as const;

type FighterDynamicField = (typeof FIGHTER_DYNAMIC_FIELDS)[number];

interface FighterSnapshot extends Record<string, any> {
  skillId: SkillSlot | null;
  platformIndex: number;
  petCat?: {
    id: string;
    ownerId: 'p1' | 'p2';
    x: number;
    y: number;
    vx: number;
    facing: 1 | -1;
    state: 'follow' | 'bowl_slide';
    timer: number;
  };
}

/** Complete deterministic gameplay state at the start of a frame. */
export interface EngineSnapshot {
  frame: number;
  rngState: number;
  nextIdValue: number;
  aiCooldown: number;
  hitstopTimer: number;
  roundTime: number;
  isMatchOver: boolean;
  winner: 'p1' | 'p2' | 'draw' | null;
  winQuote: string;
  p1: FighterSnapshot;
  p2: FighterSnapshot;
  hitboxes: Hitbox[];
  projectiles: Projectile[];
}

export const EMPTY_INPUT: KeyInputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  charge: false,
  guard: false,
  dash: false,
  attackJ: false,
  skillU: false,
  skillI: false,
  jumpPressed: false,
  dashPressed: false,
  attackJPressed: false,
  skillUPressed: false,
  skillIPressed: false,
};

/** Normalises any partial/network supplied input into a full frame input. */
export function normalizeInput(input?: KeyInputState | null): KeyInputState {
  if (!input) return { ...EMPTY_INPUT };
  return {
    left: !!input.left,
    right: !!input.right,
    up: !!input.up,
    down: !!input.down,
    jump: !!input.jump,
    charge: !!input.charge,
    guard: !!input.guard,
    dash: !!input.dash,
    attackJ: !!input.attackJ,
    skillU: !!input.skillU,
    skillI: !!input.skillI,
    jumpPressed: !!input.jumpPressed,
    dashPressed: !!input.dashPressed,
    attackJPressed: !!input.attackJPressed,
    skillUPressed: !!input.skillUPressed,
    skillIPressed: !!input.skillIPressed,
  };
}

export function inputsEqual(a: KeyInputState | undefined, b: KeyInputState | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.up === b.up &&
    a.down === b.down &&
    a.jump === b.jump &&
    a.charge === b.charge &&
    a.guard === b.guard &&
    a.jumpPressed === b.jumpPressed &&
    a.dashPressed === b.dashPressed &&
    a.attackJPressed === b.attackJPressed &&
    a.skillUPressed === b.skillUPressed &&
    a.skillIPressed === b.skillIPressed
  );
}

export class GameEngine {
  public p1: FighterEntity;
  public p2: FighterEntity;
  public mode: GameMode;
  public settings: GameSettings;
  public currentMap: MapData;

  public hitboxes: Hitbox[] = [];
  public projectiles: Projectile[] = [];
  public particles: Particle[] = [];
  public damageTexts: DamageText[] = [];

  public hitstopTimer = 0;
  public screenShake = { x: 0, y: 0 };
  public shakeTrauma = 0;
  public roundTime = 99;
  public isMatchOver = false;
  public winner: 'p1' | 'p2' | 'draw' | null = null;
  public winQuote = '';

  /** Number of simulation frames elapsed (also the online sync frame index). */
  public frame = 0;
  /** Gameplay RNG (AI decisions). Part of the snapshot. */
  public rng: Rng;
  /** Cosmetic RNG (particles, screen shake). Never affects gameplay. */
  private visualRng: Rng;

  /** Events produced by the last simulated frame bank. */
  public events: GameEvent[] = [];

  public onSkillTriggered?: (playerId: 'p1' | 'p2', slot: SkillSlot) => void;
  public onMatchEnd?: (winner: 'p1' | 'p2' | 'draw', quote: string) => void;

  private nextIdValue = 0;
  private visualIdValue = 0;
  private aiCooldown = 0;

  constructor(
    p1CharId: CharacterId,
    p2CharId: CharacterId,
    mode: GameMode,
    settings: GameSettings,
    mapId: string = 'loi_dai',
    seed: number = 1337
  ) {
    this.mode = mode;
    this.settings = settings;
    this.currentMap = MAPS[mapId as keyof typeof MAPS] || MAPS.loi_dai;
    this.rng = new Rng(seed);
    this.visualRng = new Rng(seed ^ 0x5bf03635);

    const floorY = STAGE_CONFIG.floorY;
    this.p1 = this.createFighter(p1CharId, 'p1', 300, 1, floorY);
    this.p2 = this.createFighter(p2CharId, 'p2', 900, -1, floorY);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: '#fff',
        size: 3,
        alpha: 1,
        life: 0,
        maxLife: 1,
        type: 'spark',
      });
    }
  }

  private createFighter(
    charId: CharacterId,
    playerId: 'p1' | 'p2',
    spawnX: number,
    facing: 1 | -1,
    spawnY: number = STAGE_CONFIG.floorY
  ): FighterEntity {
    const char = CHARACTERS[charId] || CHARACTERS.hoang_saigon;
    const fighter: FighterEntity = {
      playerId,
      character: char,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      width: 65,
      height: 105,
      facing,
      hp: char.maxHp,
      stamina: char.maxStamina,
      state: 'IDLE',
      stateTime: 0,
      currentSkill: null,
      skillTick: 0,
      jumpsLeft: char.jumpCount,
      isGrounded: true,
      isWallClinging: false,
      currentPlatform: null,
      droppingPlatformTimer: 0,
      normalComboStep: 0,
      normalComboTimer: 0,
      hitStunTime: 0,
      guardBreakTime: 0,
      invulnerableTime: 0,
      superArmorTime: 0,
      counterTime: 0,
      buffTime: 0,
      buffType: null,
      confusedTime: 0,
      trappedTime: 0,
      stealthTime: 0,
      hitFlashTime: 0,
      hoangScaleBonus: 1.0,
      hoangArmorBonus: 0,
      hoangKnockbackBonus: 0,
      hoangDamageAbsorbedSinceLastTier: 0,
      beatboxFlowWindow: 0,
      beatboxFlowActive: false,
      ribBonesAvailable: 12,
      maxHpPenalty: 0,
      wibuStacks: 0,
      poisonClawStacks: 0,
      shadowClonesCount: 0,
      airDriftCharge: 0,
      kickRangeBonusTime: 0,
      nextHitCrit: false,
      attackFrame: 0,
      attackDuration: 0,
      comboHits: 0,
      comboDamage: 0,
      comboTimer: 0,
      totalDamageDealt: 0,
      airJumpsUsed: 0,
    };

    if (charId === 'hoang_xitrum') {
      fighter.petCat = {
        id: `cat_${playerId}`,
        ownerId: playerId,
        x: spawnX + facing * 35,
        y: spawnY,
        vx: 0,
        facing,
        state: 'follow',
        timer: 0,
      };
    }

    return fighter;
  }

  // ---------------------------------------------------------------- engine API

  private emit(event: GameEvent) {
    this.events.push(event);
  }

  /** Returns and clears all events produced since the last drain. */
  public drainEvents(): GameEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events;
    this.events = [];
    return out;
  }

  public nextId(prefix: string): string {
    this.nextIdValue += 1;
    return `${prefix}_${this.nextIdValue}`;
  }

  /**
   * Simulates exactly one 60Hz frame. Deterministic: identical state + inputs
   * always produce identical results (required by rollback netcode).
   */
  public step(p1Inputs?: KeyInputState, p2Inputs?: KeyInputState) {
    const dt = FRAME_TIME;

    this.updateCosmetics(dt);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.frame++;
      return;
    }

    if (this.isMatchOver) {
      this.frame++;
      return;
    }

    if (this.mode !== 'training') {
      this.roundTime = Math.max(0, this.roundTime - dt);
      if (this.roundTime <= 0) {
        this.handleTimeOut();
        this.frame++;
        return;
      }
    }

    let inP1 = normalizeInput(p1Inputs);
    let inP2 = normalizeInput(p2Inputs);

    if (this.mode === 'ai') {
      inP2 = this.computeAiInputs(this.p2, this.p1);
    } else if (this.mode === 'training') {
      inP2 = this.computeTrainingDummyInputs(this.p2, this.p1);
    }

    this.updateFighter(this.p1, this.p2, inP1, dt);
    this.updateFighter(this.p2, this.p1, inP2, dt);

    this.updatePet(this.p1, dt);
    this.updatePet(this.p2, dt);

    this.updateHitboxes(dt);
    this.processHitboxes();
    this.updateProjectiles(dt);
    this.updateFacing();
    this.updateComboTracking(dt);
    this.checkMatchEnd();

    this.frame++;
  }

  // ------------------------------------------------------------------ snapshot

  private snapshotFighter(f: FighterEntity): FighterSnapshot {
    const snap: FighterSnapshot = {
      skillId: f.currentSkill ? f.currentSkill.id : null,
      platformIndex: f.currentPlatform
        ? this.currentMap.platforms.indexOf(f.currentPlatform)
        : -1,
    };
    for (const key of FIGHTER_DYNAMIC_FIELDS) {
      snap[key] = (f as any)[key];
    }
    if (f.petCat) snap.petCat = { ...f.petCat };
    return snap;
  }

  public snapshot(): EngineSnapshot {
    return {
      frame: this.frame,
      rngState: this.rng.state,
      nextIdValue: this.nextIdValue,
      aiCooldown: this.aiCooldown,
      hitstopTimer: this.hitstopTimer,
      roundTime: this.roundTime,
      isMatchOver: this.isMatchOver,
      winner: this.winner,
      winQuote: this.winQuote,
      p1: this.snapshotFighter(this.p1),
      p2: this.snapshotFighter(this.p2),
      hitboxes: this.hitboxes.map((hb) => ({ ...hb })),
      projectiles: this.projectiles.map((p) => ({ ...p })),
    };
  }

  private restoreFighter(f: FighterEntity, snap: FighterSnapshot) {
    for (const key of FIGHTER_DYNAMIC_FIELDS) {
      const value = snap[key];
      if (value !== undefined) (f as any)[key] = value;
    }
    const skill = snap.skillId ? (f.character.skills[snap.skillId] as SkillDefinition) : null;
    f.currentSkill = skill || null;
    f.currentPlatform =
      snap.platformIndex >= 0 ? this.currentMap.platforms[snap.platformIndex] || null : null;
    f.petCat = snap.petCat ? { ...snap.petCat } : f.petCat ? { ...f.petCat } : undefined;
    // Clear cosmetic-only timers so a rolled back frame looks fresh again.
    f.hitFlashTime = snap.hitFlashTime || 0;
  }

  public restore(snap: EngineSnapshot) {
    this.frame = snap.frame;
    this.rng.state = snap.rngState;
    this.nextIdValue = snap.nextIdValue;
    this.aiCooldown = snap.aiCooldown || 0;
    this.hitstopTimer = snap.hitstopTimer;
    this.roundTime = snap.roundTime;
    this.isMatchOver = snap.isMatchOver;
    this.winner = snap.winner;
    this.winQuote = snap.winQuote;
    this.restoreFighter(this.p1, snap.p1);
    this.restoreFighter(this.p2, snap.p2);
    this.hitboxes = snap.hitboxes.map((hb) => ({ ...hb }));
    this.projectiles = snap.projectiles.map((p) => ({ ...p }));
    // Cosmetic state is rebuilt by the resimulation.
    this.events = [];
    this.damageTexts = [];
  }

  /** Stable hash of gameplay state, used for desync detection. */
  public checksum(): number {
    const nums: number[] = [this.frame, this.roundTime, this.hitstopTimer, this.projectiles.length];
    for (const f of [this.p1, this.p2]) {
      nums.push(f.x, f.y, f.vx, f.vy, f.hp, f.stamina, f.stateTime, f.jumpsLeft);
      nums.push(f.state === 'DEAD' ? 1 : 0, f.state === 'ATTACK' ? 1 : 0, f.skillTick);
    }
    for (const p of this.projectiles) nums.push(p.x, p.y, p.lifetime);
    return Rng.hashNumbers(nums);
  }

  // -------------------------------------------------------------- fighter loop

  private updateFighter(
    f: FighterEntity,
    opponent: FighterEntity,
    inputs: KeyInputState,
    dt: number
  ) {
    if (f.state === 'DEAD') return;

    const char = f.character;
    let moveLeft = inputs.left;
    let moveRight = inputs.right;
    if (f.confusedTime > 0) {
      f.confusedTime = Math.max(0, f.confusedTime - dt);
      const swap = moveLeft;
      moveLeft = moveRight;
      moveRight = swap;
    }

    if (f.invulnerableTime > 0) f.invulnerableTime = Math.max(0, f.invulnerableTime - dt);
    if (f.superArmorTime > 0) f.superArmorTime = Math.max(0, f.superArmorTime - dt);
    if (f.counterTime > 0) f.counterTime = Math.max(0, f.counterTime - dt);
    if (f.stealthTime > 0) f.stealthTime = Math.max(0, f.stealthTime - dt);
    if (f.hitFlashTime > 0) f.hitFlashTime = Math.max(0, f.hitFlashTime - dt);
    if (f.trappedTime > 0) f.trappedTime = Math.max(0, f.trappedTime - dt);
    if (f.droppingPlatformTimer > 0)
      f.droppingPlatformTimer = Math.max(0, f.droppingPlatformTimer - dt);
    if (f.kickRangeBonusTime > 0)
      f.kickRangeBonusTime = Math.max(0, f.kickRangeBonusTime - dt);
    if (f.buffTime > 0) {
      f.buffTime = Math.max(0, f.buffTime - dt);
      if (f.buffTime <= 0) {
        f.buffType = null;
        f.beatboxFlowActive = false;
        f.shadowClonesCount = 0;
      }
    }
    if (f.normalComboTimer > 0) {
      f.normalComboTimer = Math.max(0, f.normalComboTimer - dt);
      if (f.normalComboTimer <= 0) f.normalComboStep = 0;
    }

    if (f.state !== 'CHARGE_W' && f.state !== 'GUARD_BROKEN') {
      if (this.settings?.infiniteStamina) {
        f.stamina = char.maxStamina;
      } else {
        f.stamina = Math.min(char.maxStamina, f.stamina + 12 * dt);
      }
    }

    if (f.state === 'GUARD_BROKEN') {
      f.guardBreakTime -= dt;
      f.vx *= 0.85;
      if (f.guardBreakTime <= 0) {
        f.state = 'IDLE';
        f.stamina = 35;
      }
      this.applyPhysics(f, dt);
      return;
    }

    if (f.state === 'HIT_STUN') {
      f.hitStunTime -= dt;
      f.vx *= f.isGrounded ? 0.88 : 0.985;
      if (f.hitStunTime <= 0) {
        f.state = f.isGrounded ? 'IDLE' : 'FALL';
      }
      this.applyPhysics(f, dt);
      return;
    }

    if (f.state === 'ATTACK') {
      this.updateAttackState(f, dt);
      this.applyPhysics(f, dt);
      return;
    }

    if (f.state === 'DASH') {
      f.stateTime += dt;
      if (f.stateTime >= char.dashDuration) {
        f.state = f.isGrounded ? 'IDLE' : 'FALL';
        f.vx *= 0.4;
      }
      this.applyPhysics(f, dt);
      return;
    }

    // --- Skills (highest priority, and cancel a W charge) ---
    if (f.trappedTime <= 0) {
      const slot = this.detectSkillInput(f, inputs);
      if (slot) {
        this.executeSkill(f, slot);
        this.applyPhysics(f, dt);
        return;
      }
    }

    // --- Dash ---
    if (inputs.dashPressed && f.stamina >= 15 && f.trappedTime <= 0) {
      f.stamina = this.settings?.infiniteStamina ? char.maxStamina : f.stamina - 15;
      f.state = 'DASH';
      f.stateTime = 0;
      this.emit({ type: 'sound', name: 'dash' });

      const holdingOpposite =
        (f.facing === 1 && moveLeft) || (f.facing === -1 && moveRight);
      const dashDir = holdingOpposite ? -f.facing : f.facing;
      f.vx = dashDir * char.dashSpeed;

      if (char.dashHasInvul) f.invulnerableTime = 0.22;
      if (char.dashHasSuperArmor) {
        f.superArmorTime = char.dashDuration;
        if (char.id === 'hoang_saigon') {
          this.createHitbox(f, {
            id: this.nextId('sumo_roll'),
            attackerId: f.playerId,
            x: f.x + (dashDir === 1 ? 10 : -75),
            y: f.y - 65,
            w: 65,
            h: 65,
            damage: 80,
            knockbackX: 12,
            knockbackY: -4,
            hitstop: 0.08,
            sparkColor: '#ff9800',
            soundType: 'heavy',
            activeTicks: 12,
            maxTicks: 12,
            follows: true,
            offsetX: dashDir === 1 ? 10 : -75,
            offsetY: -65,
          });
        }
      }
      this.spawnSparks(f.x, f.y - 20, char.colorTheme.primary, 8);
      this.applyPhysics(f, dt);
      return;
    }

    // --- Drop through a one-way platform (S + Jump) ---
    if (
      (inputs.guard || inputs.down) &&
      inputs.jumpPressed &&
      f.isGrounded &&
      f.currentPlatform
    ) {
      f.droppingPlatformTimer = 0.22;
      f.isGrounded = false;
      f.currentPlatform = null;
      f.vy = 2;
      f.state = 'FALL';
      this.applyPhysics(f, dt);
      return;
    }

    // --- Jump (ground, air jump, wall jump) ---
    if (inputs.jumpPressed && f.trappedTime <= 0) {
      if (f.isWallClinging) {
        const away: 1 | -1 = f.x < STAGE_CONFIG.width / 2 ? 1 : -1;
        f.facing = away;
        f.vx = away * char.speed * 1.7;
        f.vy = -char.jumpForce * 0.95;
        f.isWallClinging = false;
        f.isGrounded = false;
        f.jumpsLeft = char.jumpCount - 1;
        f.state = 'JUMP';
        this.emit({ type: 'sound', name: 'jump' });
      } else if (f.jumpsLeft > 0) {
        const isFirstJump = f.jumpsLeft === char.jumpCount;
        f.jumpsLeft -= 1;
        f.airJumpsUsed += isFirstJump ? 0 : 1;
        f.vy = -char.jumpForce * (isFirstJump ? 1 : 0.92);
        f.isGrounded = false;
        f.currentPlatform = null;
        f.state = 'JUMP';
        f.attackFrame = 0;
        this.emit({ type: 'sound', name: 'jump' });
        this.spawnSparks(f.x, f.y, '#ffffff', 4);
      }
    }

    let moveDir = 0;
    if (moveLeft) moveDir -= 1;
    if (moveRight) moveDir += 1;
    if (f.trappedTime > 0) moveDir = 0;

    // --- Glide / air drift (Hùng Chim Bay) ---
    let gliding = false;
    let maxFallOverride: number | undefined;
    if (!f.isGrounded && char.hasGliding) {
      const wantsGlide = inputs.jump && f.vy > -1.5 && f.airDriftCharge > 0;
      if (wantsGlide) {
        gliding = true;
        f.airDriftCharge = Math.max(0, f.airDriftCharge - 70 * dt);
        if (inputs.up) {
          f.vy = Math.max(-3.4, f.vy - 0.9);
        } else if (inputs.down) {
          f.vy = 5.4;
          maxFallOverride = STAGE_CONFIG.maxFallSpeed;
        } else {
          // Slow, floaty descent while the wings are open.
          f.vy = Math.min(f.vy, 0.4);
        }
        if (maxFallOverride === undefined) maxFallOverride = 1.25;
        if (moveDir !== 0) f.vx = moveDir * Math.max(char.speed, 6.6);
        f.state = 'JUMP';
      } else {
        f.airDriftCharge = Math.min(100, f.airDriftCharge + 45 * dt);
      }
    } else if (f.isGrounded) {
      f.airDriftCharge = Math.max(0, f.airDriftCharge - 30 * dt);
    }

    // --- Movement / charge / guard ---
    const canActOnGround = f.isGrounded && f.trappedTime <= 0;
    if (inputs.charge && canActOnGround) {
      f.state = 'CHARGE_W';
      f.vx *= 0.6;
      if (Math.abs(f.vx) < 0.2) f.vx = 0;
      if (!this.settings?.infiniteStamina) {
        f.stamina = Math.min(char.maxStamina, f.stamina + 30 * dt);
      }
      f.hp = Math.min(char.maxHp, f.hp + 18 * dt);
      if (char.id === 'hoang_saigon') {
        f.hoangScaleBonus = Math.min(1.4, f.hoangScaleBonus + 0.04 * dt);
        f.hoangArmorBonus = Math.min(0.35, f.hoangArmorBonus + 0.05 * dt);
      }
    } else if (inputs.guard && canActOnGround) {
      f.state = 'GUARD';
      f.vx *= 0.6;
      if (Math.abs(f.vx) < 0.2) f.vx = 0;
    } else if (!gliding) {
      if (moveDir !== 0) {
        f.vx = moveDir * char.speed;
        if (f.isGrounded) f.state = 'WALK';
      } else {
        f.vx *= f.isGrounded ? 0.65 : 0.96;
        if (Math.abs(f.vx) < 0.2) f.vx = 0;
        if (f.isGrounded) f.state = 'IDLE';
      }
      if (!f.isGrounded) {
        f.state = f.vy < 0 ? 'JUMP' : 'FALL';
      }
    }

    this.applyPhysics(f, dt, maxFallOverride);
  }

  private detectSkillInput(f: FighterEntity, inputs: KeyInputState): SkillSlot | null {
    const isW = inputs.charge || inputs.up;
    const isS = inputs.guard || inputs.down;
    const skills = f.character.skills;
    const candidates: SkillSlot[] = [];

    if (inputs.attackJPressed) {
      if (isW) candidates.push('WJ');
      if (isS) candidates.push('SJ');
      candidates.push('J');
    }
    if (inputs.skillIPressed) {
      if (isW) candidates.push('WI');
      if (isS) candidates.push('SI');
      candidates.push('I');
    }
    if (inputs.skillUPressed) {
      if (isW) candidates.push('WU');
      if (isS) candidates.push('SU');
      candidates.push('U');
    }

    for (const slot of candidates) {
      const skill = skills[slot];
      if (!skill) continue;
      if (f.stamina >= skill.staminaCost) return slot;
    }
    return null;
  }

  /** Starts a skill for a fighter. Safe to call from UI shortcuts too. */
  public executeSkill(f: FighterEntity, slot: SkillSlot, forceRemote: boolean = false) {
    const skill = f.character.skills[slot];
    if (!skill || f.state === 'DEAD') return;
    if (f.state === 'HIT_STUN' || f.state === 'GUARD_BROKEN') return;
    if (!forceRemote && f.stamina < skill.staminaCost) return;

    if (slot === 'J') {
      if (f.normalComboTimer > 0 && f.normalComboStep === 1) {
        f.normalComboStep = 2;
      } else if (f.normalComboTimer > 0 && f.normalComboStep === 2) {
        f.normalComboStep = 3;
      } else {
        f.normalComboStep = 1;
      }
      f.normalComboTimer = 0.42;
    }

    if (!forceRemote && !this.settings?.infiniteStamina) {
      f.stamina = Math.max(0, f.stamina - skill.staminaCost);
    }
    this.emit({ type: 'skill', playerId: f.playerId, slot });
    this.onSkillTriggered?.(f.playerId, slot);

    f.state = 'ATTACK';
    f.currentSkill = skill;
    f.skillTick = 0;
    f.stateTime = 0;
    f.attackFrame = 0;
    f.attackDuration = skill.startupFrames + skill.activeFrames + skill.recoveryFrames;
    if (f.isGrounded) f.vx *= 0.5;

    if (slot === 'WJ') {
      this.emit({ type: 'sound', name: 'ultimate' });
      this.shakeTrauma = Math.min(1.0, this.shakeTrauma + 0.8);
    } else if (skill.damage >= 70) {
      this.emit({ type: 'sound', name: 'heavy' });
    } else if (skill.damage > 0) {
      this.emit({ type: 'sound', name: 'slash' });
    }

    if (skill.isCounter) f.counterTime = 0.7;

    const char = f.character;

    if (char.id === 'hoang_saigon' && slot === 'WU') {
      f.stamina = char.maxStamina;
      this.addDamageText(f.x, f.y - 70, 'NUỐT ĐẠN! HỒI 100% THỂ LỰC', '#f59e0b', true);
    }

    if (char.id === 'hoang_xitrum' && slot === 'SI' && f.petCat) {
      f.petCat.state = 'bowl_slide';
      f.petCat.vx = f.facing * 16;
      f.petCat.timer = 1.8;
    }

    if (char.id === 'le_dao') {
      if (slot === 'WU') {
        f.ribBonesAvailable = 12;
        f.maxHpPenalty = 0;
        f.hp = Math.min(char.maxHp, f.hp + 120);
        this.addDamageText(f.x, f.y - 75, 'TÁI TẠO 12 XƯƠNG HOÀNG KIM (+120 HP)!', '#f59e0b', true);
      } else if (slot !== 'J') {
        const boneCost = slot === 'U' ? 4 : slot === 'SU' ? 6 : slot === 'WJ' ? 8 : slot === 'SI' ? 3 : 2;
        f.ribBonesAvailable = Math.max(1, f.ribBonesAvailable - boneCost);
        const hpCost = Math.round(char.maxHp * 0.02 * (boneCost / 2));
        f.hp = Math.max(1, f.hp - hpCost);
        f.maxHpPenalty += hpCost;
        this.addDamageText(f.x, f.y - 65, `-${hpCost} HP (RÚT ${boneCost} XƯƠNG)!`, '#ef4444');
      }
    }

    if (char.id === 'hung_chimbay' && slot === 'WU') {
      f.airDriftCharge = 100;
      f.buffTime = 4.0;
      f.buffType = 'glide';
      f.hp = Math.min(char.maxHp, f.hp + 90);
      f.stamina = char.maxStamina;
      this.addDamageText(f.x, f.y - 75, 'CHAO LƯỢN 360° (HỒI HP & STA)!', '#22c55e', true);
    }

    if (char.id === 'khoa_pug' && slot === 'WU') {
      f.buffTime = 4.0;
      f.buffType = 'waifu';
      const opp = f.playerId === 'p1' ? this.p2 : this.p1;
      opp.confusedTime = 3.0;
      this.addDamageText(f.x, f.y - 75, 'POSTER WAIFU: LÀM RỐI LOẠN ĐỊCH!', '#f472b6', true);
    }

    if (char.id === 'nhat_ban' && slot === 'WJ') {
      f.shadowClonesCount = 2;
      f.buffTime = 6.0;
      f.buffType = 'clones';
    }

    if (char.id === 'kendu' && slot === 'WJ') {
      f.beatboxFlowActive = true;
      f.buffTime = 6.0;
      f.buffType = 'beatbox';
    }
  }

  private updateAttackState(f: FighterEntity, dt: number) {
    const skill = f.currentSkill;
    if (!skill) {
      f.state = f.isGrounded ? 'IDLE' : 'FALL';
      return;
    }

    f.skillTick += 1;
    f.stateTime += dt;
    // Animation progress for the renderer (0 -> 1 over the whole skill).
    f.attackFrame = f.skillTick;

    // The active (damaging) frame fires exactly once per skill.
    if (f.skillTick === Math.max(1, skill.startupFrames)) {
      this.onSkillActiveFrame(f, skill);
    }

    if (f.skillTick >= f.attackDuration) {
      f.state = f.isGrounded ? 'IDLE' : 'FALL';
      f.currentSkill = null;
      f.skillTick = 0;
      f.attackFrame = 0;
    }
  }

  private onSkillActiveFrame(f: FighterEntity, skill: SkillDefinition) {
    const facing = f.facing;
    const opponent = f.playerId === 'p1' ? this.p2 : this.p1;
    const charId = f.character.id;

    if (skill.isProjectile || skill.isTrap) {
      this.spawnSkillObject(f, skill);
      return;
    }

    if (skill.effectType === 'suction') {
      if (opponent && opponent.state !== 'DEAD') {
        opponent.vx = -facing * 16;
        opponent.state = 'HIT_STUN';
        opponent.hitStunTime = 0.3;
      }
      this.spawnSparks(opponent.x, opponent.y - 50, f.character.colorTheme.spark, 15);
      this.addDamageText(opponent.x, opponent.y - 70, 'HÚT VÀO LÒNG!', '#00e5ff', true);
      return;
    }

    if (skill.isBuff) {
      return;
    }

    if (skill.damage <= 0) {
      // Pure utility skills (buffs, summons) handled in executeSkill / spawn.
      this.spawnSkillObject(f, skill);
      return;
    }

    let dmg = skill.damage;
    let kx = skill.knockback.x;
    let ky = skill.knockback.y;
    if (skill.id === 'J') {
      if (f.normalComboStep === 2) {
        dmg = Math.round(dmg * 1.1);
        kx = 5;
        ky = -4;
      } else if (f.normalComboStep === 3) {
        dmg = Math.round(dmg * 1.7);
        kx = 12;
        ky = -7;
      }
    }

    let extraReach = 0;
    if (charId === 'hoang_xitrum' && f.petCat) {
      const catDist = Math.abs(f.x - f.petCat.x);
      extraReach = Math.min(85, catDist * 0.45);
    }

    const boxW = skill.rangeX + extraReach;
    const boxH = skill.rangeY;
    const offsetX = facing === 1 ? 10 : -10 - boxW;
    const offsetY = -boxH - 10;

    this.createHitbox(f, {
      id: this.nextId(`${f.playerId}_${skill.id}`),
      attackerId: f.playerId,
      x: f.x + offsetX,
      y: f.y + offsetY,
      w: boxW,
      h: boxH,
      damage: dmg,
      knockbackX: kx,
      knockbackY: ky,
      hitstop: skill.hitstop || 0.05,
      isUnblockable: skill.isUnblockable,
      isTrip: skill.effectType === 'trip',
      isGrab: skill.isGrab,
      isHeavy: dmg >= 70,
      sparkColor: f.character.colorTheme.spark,
      soundType: dmg >= 70 ? 'heavy' : 'light',
      activeTicks: Math.max(1, skill.activeFrames),
      maxTicks: Math.max(1, skill.activeFrames),
      follows: true,
      offsetX,
      offsetY,
    });
  }

  private spawnProjectile(f: FighterEntity, data: Partial<Projectile> & { name: string }) {
    const base: Projectile = {
      id: this.nextId('proj'),
      ownerId: f.playerId,
      characterId: f.character.id,
      skillId: (data.skillId as SkillSlot) || 'U',
      x: f.x,
      y: f.y - 45,
      vx: 0,
      vy: 0,
      w: 35,
      h: 30,
      lifetime: 2,
      damage: 40,
      knockbackX: 6,
      knockbackY: -3,
      color: f.character.colorTheme.primary,
      name: data.name,
    };
    this.projectiles.push({ ...base, ...data });
  }

  private spawnSkillObject(f: FighterEntity, skill: SkillDefinition) {
    const facing = f.facing;
    const charId = f.character.id;
    const floorY = STAGE_CONFIG.floorY;

    switch (`${charId}:${skill.id}`) {
      case 'hoang_saigon:I':
        this.spawnProjectile(f, {
          skillId: 'I',
          x: f.x + facing * 80,
          y: floorY,
          w: 38,
          h: 26,
          lifetime: 8,
          damage: 40,
          knockbackX: 4,
          knockbackY: -2,
          isPickupBurger: true,
          color: '#f59e0b',
          name: 'Burger King Hấp Lực',
        });
        return;
      case 'kendu:SI':
        this.spawnProjectile(f, {
          skillId: 'SI',
          x: f.x + facing * 60,
          y: floorY,
          w: 42,
          h: 48,
          lifetime: 7,
          damage: 50,
          knockbackX: 8,
          knockbackY: -2,
          isSpeakerPulse: true,
          color: '#0284c7',
          name: 'Loa Thùng Thạch Cầu',
        });
        return;
      case 'khoa_pug:U':
        this.spawnProjectile(f, {
          skillId: 'U',
          x: f.x + facing * 70,
          y: floorY,
          w: 60,
          h: 20,
          lifetime: 5.5,
          damage: 25,
          knockbackX: 1,
          knockbackY: -22,
          isSpringBounce: true,
          color: '#ec4899',
          name: 'Gối Đệm Nảy Tưng',
        });
        return;
      case 'khoa_pug:SI':
        this.spawnProjectile(f, {
          skillId: 'SI',
          x: f.x + facing * 75,
          y: floorY,
          w: 36,
          h: 42,
          lifetime: 6,
          damage: 45,
          knockbackX: 1,
          knockbackY: -1,
          isFigureTrap: true,
          color: '#f472b6',
          name: 'Figure Bẫy Anime',
        });
        return;
      case 'khoa_pug:SJ':
        this.spawnProjectile(f, {
          skillId: 'SJ',
          x: f.x + facing * 40,
          y: f.y - 50,
          vx: facing * 15,
          w: 50,
          h: 28,
          lifetime: 2.2,
          damage: 86,
          knockbackX: 11,
          knockbackY: -5,
          isPillowRocket: true,
          color: '#ff4081',
          name: 'Tên Lửa Gối Ôm',
        });
        return;
      case 'le_dao:SI':
        for (let s = 1; s <= 4; s++) {
          this.spawnProjectile(f, {
            skillId: 'SI',
            x: f.x + facing * (s * 55),
            y: floorY,
            w: 40,
            h: 45,
            lifetime: 3.5,
            damage: 58,
            knockbackX: 3,
            knockbackY: -11,
            isBoneSpikes: true,
            color: '#fbbf24',
            name: 'Rừng Gai Xương',
          });
        }
        return;
      case 'le_dao:WI':
        for (let a = -1; a <= 1; a++) {
          this.spawnProjectile(f, {
            skillId: 'WI',
            x: f.x + facing * 40,
            y: f.y - 55 + a * 15,
            vx: facing * 14,
            vy: a * 1.5,
            w: 36,
            h: 12,
            lifetime: 1.8,
            damage: 65,
            knockbackX: 9,
            knockbackY: -3,
            isCrossbowArrow: true,
            color: '#f59e0b',
            name: 'Tên Xương Hoàng Kim',
          });
        }
        return;
      case 'nhat_ban:WI':
        for (let s = -1; s <= 1; s++) {
          this.spawnProjectile(f, {
            skillId: 'WI',
            x: f.x + facing * 35,
            y: f.y - 50 + s * 14,
            vx: facing * 13,
            vy: s * 2,
            w: 24,
            h: 24,
            lifetime: 1.6,
            damage: 55,
            knockbackX: 6,
            knockbackY: -2,
            isShuriken: true,
            color: '#c084fc',
            name: 'Shuriken Vuốt Khí',
          });
        }
        return;
      case 'hung_chimbay:SI':
        this.spawnProjectile(f, {
          skillId: 'SI',
          x: f.x + facing * 45,
          y: floorY,
          vx: facing * 8,
          w: 55,
          h: 90,
          lifetime: 2.8,
          damage: 60,
          knockbackX: 7,
          knockbackY: -17,
          isTornado: true,
          color: '#22c55e',
          name: 'Cơn Lốc Cánh Chim',
        });
        return;
      case 'hung_chimbay:WI':
        for (let lf = 1; lf <= 5; lf++) {
          this.spawnProjectile(f, {
            skillId: 'WI',
            x: f.x + facing * (lf * 38),
            y: floorY,
            w: 25,
            h: 30,
            lifetime: 5,
            damage: 50,
            knockbackX: 3,
            knockbackY: -5,
            isFeatherTrap: true,
            color: '#4ade80',
            name: 'Bẫy Lông Gai',
          });
        }
        return;
      case 'hoang_xitrum:SI':
        if (f.petCat) {
          f.petCat.state = 'bowl_slide';
          f.petCat.vx = f.facing * 15;
          f.petCat.timer = 1.3;
          this.addDamageText(f.petCat.x, f.petCat.y - 40, 'MÈO SÚT BOWLING!', '#ea580c', true);
        }
        return;
      case 'hoang_xitrum:WI':
        this.spawnProjectile(f, {
          skillId: 'WI',
          x: f.x + facing * 60,
          y: floorY,
          w: 28,
          h: 18,
          lifetime: 6,
          damage: 35,
          knockbackX: 4,
          knockbackY: -2,
          isCatPoop: true,
          color: '#78350f',
          name: 'Bẫy Phân Mèo',
        });
        return;
      case 'bao_ren:U':
        this.spawnProjectile(f, {
          skillId: 'U',
          x: f.x + facing * 45,
          y: f.y - 45,
          vx: facing * 10,
          w: 50,
          h: 50,
          lifetime: 2.2,
          damage: 62,
          knockbackX: 8,
          knockbackY: -4,
          isDoraemon: true,
          color: '#1e3a8a',
          name: 'Doraemon.exe',
        });
        return;
      case 'bao_ren:I':
        this.spawnProjectile(f, {
          skillId: 'I',
          x: f.x + facing * 45,
          y: floorY,
          vx: facing * 16,
          w: 48,
          h: 42,
          lifetime: 1.8,
          damage: 75,
          knockbackX: 12,
          knockbackY: -5,
          isSonicExe: true,
          color: '#991b1b',
          name: 'Sonic.exe',
        });
        return;
      case 'bao_ren:SI':
        this.spawnProjectile(f, {
          skillId: 'SI',
          x: f.x + facing * 40,
          y: floorY,
          vx: facing * 5,
          w: 38,
          h: 38,
          lifetime: 4.5,
          damage: 55,
          knockbackX: 2,
          knockbackY: -2,
          isMiniSkibidi: true,
          color: '#b91c1c',
          name: 'Skibidi Mini Cắn Chân',
        });
        return;
      case 'bao_ren:SJ':
        this.spawnProjectile(f, {
          skillId: 'SJ',
          x: f.x + facing * 40,
          y: floorY,
          vx: facing * 12,
          w: 60,
          h: 45,
          lifetime: 2,
          damage: 92,
          knockbackX: 13,
          knockbackY: -6,
          isBanTho: true,
          color: '#7f1d1d',
          name: 'Bàn Thờ Phóng Tới',
        });
        return;
      case 'bao_ren:WJ':
        this.spawnProjectile(f, {
          skillId: 'WJ',
          x: f.x + facing * 120,
          y: floorY,
          w: 140,
          h: 140,
          lifetime: 2.2,
          damage: 215,
          knockbackX: 18,
          knockbackY: -18,
          isGiantUlti: true,
          color: '#d32f2f',
          name: 'Skibidi Toilet Bự',
        });
        return;
      default:
        this.spawnProjectile(f, {
          skillId: skill.id,
          x: f.x + facing * 50,
          y: f.y - 45,
          vx: facing * 11,
          w: 35,
          h: 30,
          lifetime: 2,
          damage: skill.damage,
          knockbackX: skill.knockback.x,
          knockbackY: skill.knockback.y,
          name: skill.name,
        });
    }
  }

  private updatePet(f: FighterEntity, dt: number) {
    const cat = f.petCat;
    if (!cat) return;

    if (cat.state === 'bowl_slide') {
      const prevX = cat.x;
      cat.x += cat.vx;
      cat.timer -= dt;
      const opponent = f.playerId === 'p1' ? this.p2 : this.p1;
      const crossed =
        (prevX <= opponent.x && cat.x >= opponent.x) ||
        (prevX >= opponent.x && cat.x <= opponent.x);
      if (crossed && opponent.isGrounded && opponent.state !== 'DEAD') {
        opponent.vx = cat.facing * 10;
        opponent.vy = -5;
        opponent.state = 'HIT_STUN';
        opponent.hitStunTime = 0.45;
        this.addDamageText(opponent.x, opponent.y - 60, 'MÈO QUÉT NGÃ!', '#ea580c');
        cat.state = 'follow';
      }
      if (cat.timer <= 0 || cat.x < STAGE_CONFIG.leftWall || cat.x > STAGE_CONFIG.rightWall) {
        cat.state = 'follow';
      }
    } else {
      const targetX = f.x - f.facing * 45;
      cat.x += (targetX - cat.x) * 0.08;
      cat.y = f.isGrounded ? f.y : f.y;
      cat.facing = f.facing;
    }
  }

  private updateHitboxes(dt: number) {
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const hb = this.hitboxes[i];
      if (!hb) {
        this.hitboxes.splice(i, 1);
        continue;
      }

      if (hb.follows) {
        const attacker = hb.attackerId === 'p1' ? this.p1 : this.p2;
        if (attacker.state === 'DEAD') {
          this.hitboxes.splice(i, 1);
          continue;
        }
        hb.x = attacker.x + (hb.offsetX || 0);
        hb.y = attacker.y + (hb.offsetY || 0);
      }

      if (hb.activeTicks <= 0) {
        this.hitboxes.splice(i, 1);
      }
    }
    void dt;
  }

  private processHitboxes() {
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const hb = this.hitboxes[i];
      if (!hb) continue;

      hb.activeTicks -= 1;

      const attacker = hb.attackerId === 'p1' ? this.p1 : this.p2;
      const defender = hb.attackerId === 'p1' ? this.p2 : this.p1;

      if (
        defender &&
        defender.state !== 'DEAD' &&
        attacker.state !== 'DEAD' &&
        defender.invulnerableTime <= 0 &&
        checkAABBCollision(hb, getFighterHurtbox(defender))
      ) {
        this.applyHit(attacker, defender, hb, null);
        this.hitboxes.splice(i, 1);
        continue;
      }

      if (hb.activeTicks <= 0) this.hitboxes.splice(i, 1);
    }
  }

  /** Applies a resolved hit to the defender. Pure gameplay, no audio side effects. */
  private applyHit(
    attacker: FighterEntity,
    defender: FighterEntity,
    hitbox: Hitbox,
    skill: SkillDefinition | null
  ) {
    const result = calculateDamage(attacker, defender, hitbox, skill);

    if (result.isCountered) {
      attacker.vx = -attacker.vx * 0.5;
      attacker.state = 'HIT_STUN';
      attacker.hitStunTime = 0.4;
      this.addDamageText(defender.x, defender.y - 75, 'PHẢN ĐÒN!', '#22d3ee', true);
      this.emit({ type: 'sound', name: 'blocked' });
      return;
    }

    if (result.isBlocked && !result.isGuardBreak) {
      // Chip damage: guard eats 80% of the hit but not all of it.
      defender.hp = Math.max(0, defender.hp - result.finalDamage);
      defender.vx += result.knockbackX;
      this.addDamageText(defender.x, defender.y - 60, 'ĐÃ ĐỠ!', '#3b82f6');
      this.spawnSparks(defender.x, defender.y - 50, '#60a5fa', 6);
      this.emit({ type: 'sound', name: 'blocked' });
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.03);
      return;
    }

    if (result.isGuardBreak) {
      defender.state = 'GUARD_BROKEN';
      defender.guardBreakTime = 1.4;
      defender.stamina = 0;
      this.addDamageText(defender.x, defender.y - 72, 'BỂ GIÁP!', '#ef4444', true);
      this.emit({ type: 'sound', name: 'guardBreak' });
    } else if (result.isSuperArmor) {
      this.addDamageText(defender.x, defender.y - 72, 'SIÊU GIÁP!', '#a78bfa');
    } else {
      defender.state = 'HIT_STUN';
      const stun = Math.min(0.65, 0.2 + result.finalDamage / 260);
      defender.hitStunTime = Math.max(defender.hitStunTime, stun);
      defender.hitFlashTime = 0.12;
    }

    defender.hp = Math.max(0, defender.hp - result.finalDamage);
    defender.vx = result.knockbackX;
    if (result.knockbackY !== 0) {
      defender.vy = result.knockbackY;
      defender.isGrounded = false;
      defender.currentPlatform = null;
    }
    if (hitbox.isTrip) {
      defender.vy = -5;
      defender.hitStunTime += 0.2;
    }

    attacker.comboHits += 1;
    attacker.comboDamage += result.finalDamage;
    attacker.comboTimer = 1.2;
    attacker.totalDamageDealt += result.finalDamage;

    this.hitstopTimer = Math.max(this.hitstopTimer, result.hitstop);
    this.shakeTrauma = Math.min(1, this.shakeTrauma + (result.finalDamage > 70 ? 0.45 : 0.24));
    this.addDamageText(
      defender.x,
      defender.y - 70,
      `${result.isCritical ? 'CRIT ' : ''}-${result.finalDamage}`,
      result.isCritical ? '#fbbf24' : '#ef4444',
      result.isCritical
    );
    this.spawnSparks(defender.x, defender.y - 50, hitbox.sparkColor || '#ff0000', 12);
    this.emit({
      type: 'sound',
      name: result.isCritical ? 'crit' : result.finalDamage >= 70 ? 'heavy' : 'light',
    });

    if (result.poisonExplosion) {
      this.addDamageText(defender.x, defender.y - 95, 'NỔ ĐỘC!', '#a855f7', true);
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p) {
        this.projectiles.splice(i, 1);
        continue;
      }

      p.lifetime -= dt;
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;

      if (p.lifetime <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const target = p.ownerId === 'p1' ? this.p2 : this.p1;
      const owner = p.ownerId === 'p1' ? this.p1 : this.p2;

      // Burger pickup heals its own summoner.
      if (p.isPickupBurger) {
        if (
          Math.abs(owner.x - p.x) < 42 &&
          owner.isGrounded &&
          owner.character.id === 'hoang_saigon'
        ) {
          owner.hp = Math.min(owner.character.maxHp, owner.hp + 150);
          owner.hoangScaleBonus = Math.min(1.5, owner.hoangScaleBonus + 0.1);
          this.addDamageText(owner.x, owner.y - 70, '+150 HP (BURGER KING)!', '#f59e0b', true);
          this.projectiles.splice(i, 1);
          continue;
        }
        if (Math.abs(target.x - p.x) < 42 && target.isGrounded) {
          target.state = 'HIT_STUN';
          target.hitStunTime = Math.max(target.hitStunTime, 0.5);
          target.vx = (owner.x < target.x ? 1 : -1) * 8;
          this.addDamageText(target.x, target.y - 60, 'TRÚNG BURGER!', '#ef4444');
          this.projectiles.splice(i, 1);
          continue;
        }
        continue;
      }

      if (
        target.state === 'DEAD' ||
        target.invulnerableTime > 0 ||
        !checkAABBCollision(
          { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h },
          getFighterHurtbox(target)
        )
      ) {
        continue;
      }

      const hitbox: Hitbox = {
        id: p.id,
        attackerId: p.ownerId,
        x: p.x - p.w / 2,
        y: p.y - p.h,
        w: p.w,
        h: p.h,
        damage: p.damage,
        knockbackX: p.knockbackX,
        knockbackY: p.knockbackY,
        hitstop: p.hitstop ?? 0.05,
        isUnblockable: p.isUnblockable,
        sparkColor: p.color,
        soundType: p.damage >= 70 ? 'heavy' : 'light',
        activeTicks: 1,
        maxTicks: 1,
      };

      this.applyHit(owner, target, hitbox, null);
      this.spawnSparks(p.x, p.y, p.color || '#ff0000', 10);
      this.projectiles.splice(i, 1);
    }
  }

  private applyPhysics(f: FighterEntity, dt: number, maxFallOverride?: number) {
    const floorY = this.currentMap.floorY || STAGE_CONFIG.floorY;

    if (!Number.isFinite(f.x)) f.x = f.playerId === 'p1' ? 300 : 900;
    if (!Number.isFinite(f.y)) f.y = floorY;
    if (!Number.isFinite(f.vx)) f.vx = 0;
    if (!Number.isFinite(f.vy)) f.vy = 0;

    const prevY = f.y;
    f.x += f.vx;
    f.y += f.vy;

    // Walls
    const wall = checkWallBounce(f.x, f.vx, STAGE_CONFIG.leftWall, STAGE_CONFIG.rightWall);
    if (wall.bounced) {
      f.vx = wall.newVx;
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.25);
      this.emit({ type: 'sound', name: 'wallBounce' });
      this.spawnSparks(
        f.x < STAGE_CONFIG.width / 2 ? STAGE_CONFIG.leftWall : STAGE_CONFIG.rightWall,
        f.y - 50,
        '#fbbf24',
        8
      );
    }
    f.x = Math.max(STAGE_CONFIG.leftWall, Math.min(STAGE_CONFIG.rightWall, wall.newX));

    const platforms = this.currentMap.platforms || [];
    const ground = checkGroundAndPlatformsRaycast(
      f.x,
      f.y,
      f.vy,
      f.width,
      platforms,
      f.droppingPlatformTimer,
      floorY,
      prevY
    );

    if (ground.isGrounded) {
      f.y = ground.correctedY;
      f.vy = 0;
      f.isGrounded = true;
      f.currentPlatform = ground.platform;
      f.jumpsLeft = f.character.jumpCount;
      f.isWallClinging = false;
    } else {
      f.isGrounded = false;
      if (f.currentPlatform && !ground.platform) f.currentPlatform = null;
      f.vy = Math.min(maxFallOverride ?? STAGE_CONFIG.maxFallSpeed, f.vy + STAGE_CONFIG.gravity);

      // Wall cling: huyền thoại vượn núi (nhân vật có hasWallCling).
      const atWall =
        f.x <= STAGE_CONFIG.leftWall + 2 || f.x >= STAGE_CONFIG.rightWall - 2;
      if (f.character.hasWallCling && atWall && f.vy > 0) {
        f.isWallClinging = true;
        f.vy = 0.6;
        f.jumpsLeft = Math.max(f.jumpsLeft, 1);
      } else if (!atWall) {
        f.isWallClinging = false;
      }
    }
    void dt;
  }

  private updateFacing() {
    const p1CanTurn = ['IDLE', 'WALK', 'GUARD', 'CHARGE_W', 'JUMP', 'FALL'];
    if (p1CanTurn.includes(this.p1.state)) {
      this.p1.facing = this.p1.x <= this.p2.x ? 1 : -1;
    }
    if (p1CanTurn.includes(this.p2.state)) {
      this.p2.facing = this.p2.x <= this.p1.x ? 1 : -1;
    }
  }

  private updateComboTracking(dt: number) {
    for (const f of [this.p1, this.p2]) {
      if (f.comboTimer > 0) {
        f.comboTimer = Math.max(0, f.comboTimer - dt);
        if (f.comboTimer <= 0) {
          f.comboHits = 0;
          f.comboDamage = 0;
        }
      }
    }
  }

  private createHitbox(f: FighterEntity, hbData: Hitbox) {
    if (this.hitboxes.length > 32) this.hitboxes.shift();
    this.hitboxes.push(hbData);
  }

  private updateCosmetics(dt: number) {
    // Screen shake
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.8);
      const intensity = this.shakeTrauma * this.shakeTrauma * 16;
      if (this.settings?.screenShake) {
        this.screenShake.x = this.visualRng.range(-1, 1) * intensity;
        this.screenShake.y = this.visualRng.range(-1, 1) * intensity;
      } else {
        this.screenShake.x = 0;
        this.screenShake.y = 0;
      }
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) p.active = false;
    }

    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const d = this.damageTexts[i];
      d.life += dt;
      d.y -= 0.9;
      d.alpha = Math.max(0, 1 - d.life / d.maxLife);
      if (d.life >= d.maxLife) this.damageTexts.splice(i, 1);
    }
  }

  private spawnSparks(x: number, y: number, color: string, count: number) {
    if (!this.settings?.vfxParticles) return;
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = this.visualRng.range(-8, 8);
      p.vy = this.visualRng.range(-8, 4);
      p.color = color;
      p.size = this.visualRng.range(2, 6);
      p.alpha = 1;
      p.life = 0;
      p.maxLife = this.visualRng.range(0.15, 0.45);
      p.type = 'spark';
      spawned++;
      if (spawned >= count) break;
    }
  }

  private addDamageText(
    x: number,
    y: number,
    text: string,
    color: string,
    isCritical: boolean = false
  ) {
    if (this.damageTexts.length > 24) this.damageTexts.shift();
    this.visualIdValue += 1;
    this.damageTexts.push({
      id: `dmg_${this.visualIdValue}`,
      x,
      y,
      text,
      color,
      alpha: 1,
      life: 0,
      maxLife: 0.85,
      isCritical,
    });
  }

  // -------------------------------------------------------------------- AI/dummy

  private computeAiInputs(f: FighterEntity, opp: FighterEntity): KeyInputState {
    const inputs: KeyInputState = { ...EMPTY_INPUT };
    const dx = opp.x - f.x;
    const adx = Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;

    this.aiCooldown = Math.max(0, this.aiCooldown - 1);

    if (adx > 110) {
      if (dir > 0) inputs.right = true;
      else inputs.left = true;
      if (this.rng.chance(0.02)) {
        inputs.dashPressed = true;
        inputs.dash = true;
      }
    } else if (adx < 55) {
      if (dir > 0) inputs.left = true;
      else inputs.right = true;
    }

    if (opp.y < f.y - 90 && f.isGrounded && this.rng.chance(0.05)) {
      inputs.jumpPressed = true;
      inputs.jump = true;
    }

    if (this.aiCooldown <= 0) {
      if (adx < 130) {
        if (this.rng.chance(0.4)) {
          inputs.attackJPressed = true;
          this.aiCooldown = 8;
        } else if (f.stamina > 30 && this.rng.chance(0.2)) {
          if (this.rng.chance(0.5)) {
            inputs.skillUPressed = true;
          } else {
            inputs.skillIPressed = true;
          }
          this.aiCooldown = 18;
        }
      }
      if (opp.state === 'ATTACK' && this.rng.chance(0.3)) {
        inputs.guard = true;
      }
    }

    return inputs;
  }

  private computeTrainingDummyInputs(f: FighterEntity, opp: FighterEntity): KeyInputState {
    const inputs: KeyInputState = { ...EMPTY_INPUT };
    const behavior = this.settings?.dummyBehavior || 'stand';

    if (behavior === 'guard') {
      inputs.guard = true;
      return inputs;
    }
    if (behavior === 'crouch') {
      inputs.down = true;
      inputs.guard = true;
      return inputs;
    }
    if (behavior === 'jump') {
      if (f.isGrounded && this.frame % 45 === 0) {
        inputs.jumpPressed = true;
        inputs.jump = true;
      }
      if (opp.x < f.x) inputs.left = true;
      else inputs.right = true;
      return inputs;
    }
    if (behavior === 'counter') {
      if (opp.state === 'ATTACK') {
        inputs.skillUPressed = true;
        inputs.guard = true;
      } else if (Math.abs(opp.x - f.x) > 100) {
        if (opp.x < f.x) inputs.left = true;
        else inputs.right = true;
      }
      return inputs;
    }
    return inputs;
  }

  // ------------------------------------------------------------------ match end

  private handleTimeOut() {
    if (this.isMatchOver) return;
    this.isMatchOver = true;
    if (this.p1.hp > this.p2.hp) {
      this.winner = 'p1';
      this.winQuote = `${this.p1.character.name}: Hết giờ! Chiến thắng thuyết phục!`;
    } else if (this.p2.hp > this.p1.hp) {
      this.winner = 'p2';
      this.winQuote = `${this.p2.character.name}: Hết giờ! Hơn máu là thắng!`;
    } else {
      this.winner = 'draw';
      this.winQuote = 'Hòa nhau! Cả hai cao thủ đều ngang tài ngang sức!';
    }
    this.finishMatch(this.winner, this.winQuote);
  }

  private checkMatchEnd() {
    if (this.isMatchOver) return;

    if (this.mode === 'training') {
      // Training never ends: refill whoever hits zero so combos can continue.
      if (this.p1.hp <= 0) this.p1.hp = this.p1.character.maxHp;
      if (this.p2.hp <= 0) this.p2.hp = this.p2.character.maxHp;
      return;
    }

    if (this.p1.hp <= 0 && this.p2.hp <= 0) {
      this.p1.state = 'DEAD';
      this.p2.state = 'DEAD';
      this.isMatchOver = true;
      this.winner = 'draw';
      this.winQuote = 'Đồng quy vu tận! Hai cao thủ cùng gục ngã!';
      this.finishMatch('draw', this.winQuote);
    } else if (this.p1.hp <= 0) {
      this.p1.state = 'DEAD';
      this.isMatchOver = true;
      this.winner = 'p2';
      this.winQuote = `${this.p2.character.name}: ${this.p2.character.winQuote}`;
      this.finishMatch('p2', this.winQuote);
    } else if (this.p2.hp <= 0) {
      this.p2.state = 'DEAD';
      this.isMatchOver = true;
      this.winner = 'p1';
      this.winQuote = `${this.p1.character.name}: ${this.p1.character.winQuote}`;
      this.finishMatch('p1', this.winQuote);
    }
  }

  private finishMatch(winner: 'p1' | 'p2' | 'draw', quote: string) {
    this.emit({ type: 'matchEnd', winner, quote });
    this.onMatchEnd?.(winner, quote);
  }
}
