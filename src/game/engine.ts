/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CharacterData,
  CharacterId,
  DamageText,
  FighterEntity,
  GameMode,
  GameSettings,
  Hitbox,
  KeyInputState,
  MapData,
  Particle,
  PetEntity,
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
import { sound } from './sound';

const MAX_PARTICLES = 300;

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

  public hitstopTimer: number = 0;
  public screenShake: { x: number; y: number } = { x: 0, y: 0 };
  public shakeTrauma: number = 0;
  public roundTime: number = 99;
  public isMatchOver: boolean = false;
  public winner: 'p1' | 'p2' | 'draw' | null = null;
  public winQuote: string = '';

  public onMatchEnd?: (winner: 'p1' | 'p2' | 'draw', quote: string) => void;

  constructor(
    p1CharId: CharacterId,
    p2CharId: CharacterId,
    mode: GameMode,
    settings: GameSettings,
    mapId: string = 'loi_dai'
  ) {
    this.mode = mode;
    this.settings = settings;
    this.currentMap = MAPS[mapId as keyof typeof MAPS] || MAPS.loi_dai;

    this.p1 = this.createFighter(p1CharId, 'p1', 300, 1);
    this.p2 = this.createFighter(p2CharId, 'p2', 900, -1);

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
    facing: 1 | -1
  ): FighterEntity {
    const char = CHARACTERS[charId] || CHARACTERS.hoang_saigon;
    const fighter: FighterEntity = {
      playerId,
      character: char,
      x: spawnX,
      y: STAGE_CONFIG.floorY,
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
    };

    if (charId === 'hoang_xitrum') {
      fighter.petCat = {
        id: `cat_${playerId}`,
        ownerId: playerId,
        x: spawnX + facing * 35,
        y: STAGE_CONFIG.floorY,
        vx: 0,
        facing,
        state: 'follow',
        timer: 0,
      };
    }

    return fighter;
  }

  public update(rawDt: number, p1Inputs: KeyInputState, p2Inputs?: KeyInputState) {
    const dt = Math.min(rawDt, 0.05);

    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.8);
      const intensity = this.shakeTrauma * this.shakeTrauma * 16;
      if (this.settings.screenShake) {
        this.screenShake.x = (Math.random() * 2 - 1) * intensity;
        this.screenShake.y = (Math.random() * 2 - 1) * intensity;
      }
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
    }

    this.updateParticles(dt);
    this.updateDamageTexts(dt);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    if (!this.isMatchOver && this.mode !== 'training') {
      this.roundTime = Math.max(0, this.roundTime - dt);
      if (this.roundTime <= 0) {
        this.handleTimeOut();
        return;
      }
    }

    let effectiveP2Inputs = p2Inputs || this.getDefaultInputs();
    if (this.mode === 'ai') {
      effectiveP2Inputs = this.computeAiInputs(this.p2, this.p1, dt);
    } else if (this.mode === 'training') {
      effectiveP2Inputs = this.computeTrainingDummyInputs(this.p2, this.p1);
    }

    this.updateFighter(this.p1, this.p2, p1Inputs, dt);
    this.updateFighter(this.p2, this.p1, effectiveP2Inputs, dt);

    this.updatePet(this.p1, dt);
    this.updatePet(this.p2, dt);

    this.updateProjectiles(dt);
    this.processHitboxes(dt);
    this.updateFacing();
    this.checkMatchEnd();
  }

  private updateFighter(f: FighterEntity, opponent: FighterEntity, inputs: KeyInputState, dt: number) {
    if (f.state === 'DEAD') return;

    let moveLeft = inputs.left;
    let moveRight = inputs.right;
    if (f.confusedTime > 0) {
      f.confusedTime -= dt;
      moveLeft = inputs.right;
      moveRight = inputs.left;
    }

    if (f.invulnerableTime > 0) f.invulnerableTime -= dt;
    if (f.superArmorTime > 0) f.superArmorTime -= dt;
    if (f.counterTime > 0) f.counterTime -= dt;
    if (f.stealthTime > 0) f.stealthTime -= dt;
    if (f.hitFlashTime > 0) f.hitFlashTime -= dt;
    if (f.trappedTime > 0) f.trappedTime -= dt;
    if (f.droppingPlatformTimer > 0) f.droppingPlatformTimer -= dt;
    if (f.kickRangeBonusTime > 0) f.kickRangeBonusTime -= dt;
    if (f.normalComboTimer > 0) {
      f.normalComboTimer -= dt;
      if (f.normalComboTimer <= 0) f.normalComboStep = 0;
    }

    if (f.state !== 'CHARGE_W' && f.state !== 'GUARD_BROKEN') {
      f.stamina = Math.min(f.character.maxStamina, f.stamina + 10 * dt);
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
      f.vx *= 0.92;
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
      if (f.stateTime >= f.character.dashDuration) {
        f.state = f.isGrounded ? 'IDLE' : 'FALL';
        f.vx = 0;
      }
      this.applyPhysics(f, dt);
      return;
    }

    if (inputs.dashPressed && f.stamina >= 15 && f.trappedTime <= 0) {
      f.stamina -= 15;
      f.state = 'DASH';
      f.stateTime = 0;
      sound.playDash();

      const isHoldingOpposite = (f.facing === 1 && moveLeft) || (f.facing === -1 && moveRight);
      const dashDir = isHoldingOpposite ? -f.facing : f.facing;
      f.vx = dashDir * f.character.dashSpeed;

      if (f.character.dashHasInvul) f.invulnerableTime = 0.22;
      if (f.character.dashHasSuperArmor) {
        f.superArmorTime = f.character.dashDuration;
        if (f.character.id === 'hoang_saigon') {
          this.createHitbox(f, {
            id: 'sumo_roll',
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
          });
        }
      }

      this.spawnSparks(f.x, f.y - 20, f.character.colorTheme.primary, 8);
      return;
    }

    if (inputs.guard && inputs.jumpPressed && f.currentPlatform) {
      f.droppingPlatformTimer = 0.25;
      f.isGrounded = false;
      f.currentPlatform = null;
      f.vy = 2.0;
      f.state = 'FALL';
      return;
    }

    const triggeredSkill = this.detectSkillInput(f, inputs);
    if (triggeredSkill) {
      this.executeSkill(f, triggeredSkill);
      return;
    }

    if (inputs.charge && f.isGrounded && f.trappedTime <= 0) {
      f.state = 'CHARGE_W';
      f.vx = 0;
      f.stamina = Math.min(f.character.maxStamina, f.stamina + 30 * dt);
      f.hp = Math.min(f.character.maxHp, f.hp + 50 * dt);

      if (f.character.id === 'hoang_saigon') {
        f.hoangScaleBonus = Math.min(1.4, f.hoangScaleBonus + 0.04 * dt);
        f.hoangArmorBonus = Math.min(0.35, f.hoangArmorBonus + 0.05 * dt);
      }

      this.applyPhysics(f, dt);
      return;
    } else if (f.state === 'CHARGE_W') {
      f.state = 'IDLE';
    }

    if (inputs.guard && f.isGrounded && f.trappedTime <= 0) {
      f.state = 'GUARD';
      f.vx = 0;
      this.applyPhysics(f, dt);
      return;
    } else if (f.state === 'GUARD') {
      f.state = 'IDLE';
    }

    if (inputs.jumpPressed && f.jumpsLeft > 0 && f.trappedTime <= 0) {
      f.jumpsLeft -= 1;
      f.vy = -f.character.jumpForce;
      f.isGrounded = false;
      f.currentPlatform = null;
      f.state = 'JUMP';
      sound.playJump();
      this.spawnSparks(f.x, f.y, '#ffffff', 4);
    }

    let moveDir = 0;
    if (moveLeft) moveDir -= 1;
    if (moveRight) moveDir += 1;

    if (f.trappedTime > 0) moveDir = 0;

    if (moveDir !== 0) {
      f.vx = moveDir * f.character.speed;
      if (f.isGrounded) f.state = 'WALK';
    } else {
      f.vx *= 0.75;
      if (Math.abs(f.vx) < 0.2) f.vx = 0;
      if (f.isGrounded && f.state === 'WALK') f.state = 'IDLE';
    }

    if (!f.isGrounded) {
      f.state = f.vy < 0 ? 'JUMP' : 'FALL';
      if (f.character.hasGliding) {
        f.airDriftCharge = Math.min(100, f.airDriftCharge + 35 * dt);
        if (inputs.jump || inputs.up) {
          if (inputs.up) f.vy = -6.0;
          else if (inputs.down) f.vy = 6.0;
          else f.vy = Math.sin(f.stateTime * 6) * 1.2;

          if (moveDir !== 0) f.vx = moveDir * 6.5;
          f.state = 'JUMP';
        } else if (f.vy > 0) {
          f.vy = Math.min(f.vy, 2.5);
        }
      }
    } else {
      if (f.character.id === 'hung_chimbay') {
        f.airDriftCharge = Math.max(0, f.airDriftCharge - 40 * dt);
      }
    }

    this.applyPhysics(f, dt);
  }

  private detectSkillInput(f: FighterEntity, inputs: KeyInputState): SkillSlot | null {
    const isW = inputs.charge || inputs.up;
    const isS = inputs.guard || inputs.down;
    const skills = f.character.skills;

    if (isW && inputs.attackJPressed && f.stamina >= skills.WJ.staminaCost) return 'WJ';
    if (isS && inputs.attackJPressed && f.stamina >= skills.SJ.staminaCost) return 'SJ';
    if (isW && inputs.skillIPressed && f.stamina >= skills.WI.staminaCost) return 'WI';
    if (isW && inputs.skillUPressed && f.stamina >= skills.WU.staminaCost) return 'WU';
    if (isS && inputs.skillIPressed && f.stamina >= skills.SI.staminaCost) return 'SI';
    if (isS && inputs.skillUPressed && f.stamina >= skills.SU.staminaCost) return 'SU';
    if (!isW && !isS && inputs.skillIPressed && f.stamina >= skills.I.staminaCost) return 'I';
    if (!isW && !isS && inputs.skillUPressed && f.stamina >= skills.U.staminaCost) return 'U';
    if (!isW && !isS && inputs.attackJPressed) return 'J';

    return null;
  }

  public executeSkill(f: FighterEntity, slot: SkillSlot) {
    const skill = f.character.skills[slot];
    if (!skill) return;

    if (slot === 'J') {
      if (f.normalComboTimer > 0 && f.normalComboStep === 1) {
        f.normalComboStep = 2;
        f.normalComboTimer = 0.45;
      } else if (f.normalComboTimer > 0 && f.normalComboStep === 2) {
        f.normalComboStep = 0;
        f.normalComboTimer = 0;
      } else {
        f.normalComboStep = 1;
        f.normalComboTimer = 0.45;
      }
    }

    f.stamina = Math.max(0, f.stamina - skill.staminaCost);
    f.state = 'ATTACK';
    f.currentSkill = skill;
    f.skillTick = 0;
    f.stateTime = 0;

    if (slot === 'WJ') {
      sound.playUltimate();
      this.shakeTrauma = Math.min(1.0, this.shakeTrauma + 0.8);
    } else if (slot === 'J' && f.normalComboStep === 0) {
      sound.playHit('heavy');
    } else {
      sound.playHit(skill.damage >= 70 ? 'heavy' : 'slash');
    }

    if (skill.isCounter) f.counterTime = 0.7;

    if (f.character.id === 'hoang_saigon' && slot === 'WU') {
      this.projectiles = this.projectiles.filter((p) => p.ownerId === f.playerId);
      f.stamina = f.character.maxStamina;
      this.addDamageText(f.x, f.y - 70, 'NUỐT ĐẠN! HỒI 100% THỂ LỰC', '#f59e0b', true);
    }

    if (f.character.id === 'hoang_xitrum' && slot === 'SI' && f.petCat) {
      f.petCat.state = 'bowl_slide';
      f.petCat.vx = f.facing * 16;
      f.petCat.timer = 1.8;
    }

    if (f.character.id === 'le_dao') {
      if (slot === 'WU') {
        f.ribBonesAvailable = 12;
        f.maxHpPenalty = 0;
        f.hp = Math.min(f.character.maxHp, f.hp + 120);
        this.addDamageText(f.x, f.y - 75, 'TÁI TẠO 12 XƯƠNG HOÀNG KIM (+120 HP)!', '#f59e0b', true);
      } else if (slot !== 'J') {
        const boneCost = slot === 'U' ? 4 : slot === 'SU' ? 6 : slot === 'WJ' ? 8 : slot === 'SI' ? 3 : 2;
        f.ribBonesAvailable = Math.max(1, f.ribBonesAvailable - boneCost);
        const hpCost = Math.round(f.character.maxHp * 0.02 * (boneCost / 2));
        f.hp = Math.max(1, f.hp - hpCost);
        f.maxHpPenalty += hpCost;
        this.addDamageText(f.x, f.y - 65, `-${hpCost} HP (RÚT ${boneCost} XƯƠNG)!`, '#ef4444');
      }
    }

    if (f.character.id === 'hung_chimbay' && slot === 'WU') {
      f.airDriftCharge = 100;
      f.buffTime = 4.0;
      f.hp = Math.min(f.character.maxHp, f.hp + 90);
      f.stamina = f.character.maxStamina;
      this.addDamageText(f.x, f.y - 75, 'CHAO LƯỢN 360° (HỒI HP & STA)!', '#22c55e', true);
    }

    if (f.character.id === 'khoa_pug' && slot === 'WU') {
      f.buffTime = 4.0;
      const opp = f.playerId === 'p1' ? this.p2 : this.p1;
      opp.confusedTime = 3.0;
      this.addDamageText(f.x, f.y - 75, 'POSTER WAIFU: LÀM CHẬM ĐỊCH 50%!', '#f472b6', true);
    }
  }

  private updateAttackState(f: FighterEntity, dt: number) {
    const skill = f.currentSkill;
    if (!skill) {
      f.state = f.isGrounded ? 'IDLE' : 'FALL';
      return;
    }

    f.skillTick++;
    f.stateTime += dt;

    if (f.skillTick === skill.startupFrames) {
      this.onSkillActiveFrame(f, skill);
    }

    const totalDuration = skill.startupFrames + skill.activeFrames + skill.recoveryFrames;
    if (f.skillTick >= totalDuration) {
      f.state = f.isGrounded ? 'IDLE' : 'FALL';
      f.currentSkill = null;
      f.skillTick = 0;
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
      opponent.vx = -facing * 16;
      this.spawnSparks(opponent.x, opponent.y - 50, f.character.colorTheme.spark, 15);
      this.addDamageText(opponent.x, opponent.y - 70, 'HÚT VÀO LÒNG!', '#00e5ff', true);
      return;
    }

    let dmg = skill.damage;
    let kx = skill.knockback.x;
    let ky = skill.knockback.y;
    if (skill.id === 'J') {
      if (f.normalComboStep === 2) {
        dmg = 38;
        kx = 5;
      } else if (f.normalComboStep === 0) {
        dmg = 58;
        kx = 12;
        ky = -6;
      }
    }

    let extraReach = 0;
    if (charId === 'hoang_xitrum' && f.petCat) {
      const catDist = Math.abs(f.x - f.petCat.x);
      extraReach = Math.min(85, catDist * 0.45);
    }

    if (charId === 'le_dao') {
      if (skill.id === 'WU') {
        f.ribBonesAvailable = 12;
        this.addDamageText(f.x, f.y - 75, 'TÁI TẠO 12 XƯƠNG HOÀNG KIM!', '#f59e0b', true);
      } else {
        const boneCost = skill.id === 'U' ? 4 : skill.id === 'SU' ? 6 : skill.id === 'WJ' ? 8 : 2;
        f.ribBonesAvailable = Math.max(1, f.ribBonesAvailable - boneCost);
      }
    }

    if (charId === 'nhat_ban' && skill.id === 'WU') {
      f.shadowClonesCount = 2;
      f.buffTime = 6.0;
      this.addDamageText(f.x, f.y - 80, 'ẢO ẢNH THUẬT (2 PHÂN THÂN)!', '#c084fc', true);
    }

    const boxW = skill.rangeX + extraReach;
    const boxH = skill.rangeY;
    const boxX
