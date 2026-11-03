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

    const floorY = STAGE_CONFIG?.floorY || 560;
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
    spawnY: number = 560
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
    const boxX = facing === 1 ? f.x + 10 : f.x - 10 - boxW;
    const boxY = f.y - boxH - 10;

    this.createHitbox(f, {
      id: `${f.playerId}_${skill.id}_${Date.now()}`,
      attackerId: f.playerId,
      x: boxX,
      y: boxY,
      w: boxW,
      h: boxH,
      damage: dmg,
      knockbackX: kx,
      knockbackY: ky,
      hitstop: skill.hitstop,
      isUnblockable: skill.isUnblockable,
      isTrip: skill.effectType === 'trip',
      isGrab: skill.isGrab,
      isHeavy: dmg >= 70,
      sparkColor: f.character.colorTheme.spark,
      soundType: dmg >= 70 ? 'heavy' : 'light',
      activeTicks: skill.activeFrames,
      maxTicks: skill.activeFrames,
    });
  }

  private spawnSkillObject(f: FighterEntity, skill: SkillDefinition) {
    const facing = f.facing;
    const charId = f.character.id;
    const floorY = STAGE_CONFIG?.floorY || 560;

    if (charId === 'hoang_saigon' && skill.id === 'I') {
      this.projectiles.push({
        id: `burger_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'I',
        x: f.x + facing * 80,
        y: floorY,
        vx: 0,
        vy: 0,
        w: 38,
        h: 26,
        lifetime: 8.0,
        damage: 40,
        knockbackX: 4,
        knockbackY: -2,
        isPickupBurger: true,
        color: '#f59e0b',
        name: 'Burger King Hấp Lực',
      });
    } else if (charId === 'kendu' && skill.id === 'SI') {
      this.projectiles.push({
        id: `speaker_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'SI',
        x: f.x + facing * 60,
        y: floorY,
        vx: 0,
        vy: 0,
        w: 42,
        h: 48,
        lifetime: 7.0,
        damage: 50,
        knockbackX: 8,
        knockbackY: -2,
        isSpeakerPulse: true,
        color: '#0284c7',
        name: 'Loa Thùng Thạch Cầu',
      });
    } else if (charId === 'khoa_pug' && skill.id === 'U') {
      this.projectiles.push({
        id: `spring_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'U',
        x: f.x + facing * 70,
        y: floorY,
        vx: 0,
        vy: 0,
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
    } else if (charId === 'khoa_pug' && skill.id === 'SI') {
      this.projectiles.push({
        id: `figure_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'SI',
        x: f.x + facing * 75,
        y: floorY,
        vx: 0,
        vy: 0,
        w: 36,
        h: 42,
        lifetime: 6.0,
        damage: 45,
        knockbackX: 1,
        knockbackY: -1,
        isFigureTrap: true,
        color: '#f472b6',
        name: 'Figure Bẫy Anime',
      });
    } else if (charId === 'khoa_pug' && skill.id === 'SJ') {
      this.projectiles.push({
        id: `pillow_rocket_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'SJ',
        x: f.x + facing * 40,
        y: f.y - 50,
        vx: facing * 15,
        vy: 0,
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
    } else if (charId === 'le_dao' && skill.id === 'SI') {
      for (let s = 1; s <= 4; s++) {
        this.projectiles.push({
          id: `bone_spike_${s}_${Date.now()}`,
          ownerId: f.playerId,
          characterId: charId,
          skillId: 'SI',
          x: f.x + facing * (s * 55),
          y: floorY,
          vx: 0,
          vy: 0,
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
    } else if (charId === 'le_dao' && skill.id === 'WI') {
      for (let a = -1; a <= 1; a++) {
        this.projectiles.push({
          id: `bone_arrow_${a}_${Date.now()}`,
          ownerId: f.playerId,
          characterId: charId,
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
    } else if (charId === 'nhat_ban' && skill.id === 'WI') {
      for (let s = -1.5; s <= 1.5; s += 1) {
        this.projectiles.push({
          id: `shuriken_${s}_${Date.now()}`,
          ownerId: f.playerId,
          characterId: charId,
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
    } else if (charId === 'hung_chimbay' && skill.id === 'SI') {
      this.projectiles.push({
        id: `tornado_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'SI',
        x: f.x + facing * 45,
        y: floorY,
        vx: facing * 8,
        vy: 0,
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
    } else if (charId === 'hung_chimbay' && skill.id === 'WI') {
      for (let lf = 1; lf <= 5; lf++) {
        this.projectiles.push({
          id: `feather_${lf}_${Date.now()}`,
          ownerId: f.playerId,
          characterId: charId,
          skillId: 'WI',
          x: f.x + facing * (lf * 38),
          y: floorY,
          vx: 0,
          vy: 0,
          w: 25,
          h: 30,
          lifetime: 5.0,
          damage: 50,
          knockbackX: 3,
          knockbackY: -5,
          isFeatherTrap: true,
          color: '#4ade80',
          name: 'Bẫy Lông Gai',
        });
      }
    } else if (charId === 'hoang_xitrum' && skill.id === 'SI') {
      if (f.petCat) {
        f.petCat.state = 'bowl_slide';
        f.petCat.vx = f.facing * 15;
        f.petCat.timer = 1.3;
        this.addDamageText(f.petCat.x, f.petCat.y - 40, 'MÈO SÚT BOWLING!', '#ea580c', true);
      }
    } else if (charId === 'hoang_xitrum' && skill.id === 'WI') {
      this.projectiles.push({
        id: `cat_poop_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'WI',
        x: f.x + facing * 60,
        y: floorY,
        vx: 0,
        vy: 0,
        w: 28,
        h: 18,
        lifetime: 6.0,
        damage: 35,
        knockbackX: 4,
        knockbackY: -2,
        isCatPoop: true,
        color: '#78350f',
        name: 'Bẫy Phân Mèo',
      });
    } else if (charId === 'bao_ren' && skill.id === 'U') {
      this.projectiles.push({
        id: `doraemon_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'U',
        x: f.x + facing * 45,
        y: f.y - 45,
        vx: facing * 10,
        vy: 0,
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
    } else if (charId === 'bao_ren' && skill.id === 'I') {
      this.projectiles.push({
        id: `sonic_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'I',
        x: f.x + facing * 45,
        y: floorY,
        vx: facing * 16,
        vy: 0,
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
    } else if (charId === 'bao_ren' && skill.id === 'SI') {
      this.projectiles.push({
        id: `skibidi_mini_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'SI',
        x: f.x + facing * 40,
        y: floorY,
        vx: facing * 5,
        vy: 0,
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
    } else if (charId === 'bao_ren' && skill.id === 'SJ') {
      this.projectiles.push({
        id: `ban_tho_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'SJ',
        x: f.x + facing * 40,
        y: floorY,
        vx: facing * 12,
        vy: 0,
        w: 60,
        h: 45,
        lifetime: 2.0,
        damage: 92,
        knockbackX: 13,
        knockbackY: -6,
        isBanTho: true,
        color: '#7f1d1d',
        name: 'Bàn Thờ Phóng Tới',
      });
    } else if (charId === 'bao_ren' && skill.id === 'WJ') {
      this.projectiles.push({
        id: `giant_skibidi_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: 'WJ',
        x: f.x + facing * 120,
        y: floorY,
        vx: 0,
        vy: 0,
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
    } else {
      this.projectiles.push({
        id: `proj_${Date.now()}`,
        ownerId: f.playerId,
        characterId: charId,
        skillId: skill.id,
        x: f.x + facing * 50,
        y: f.y - 45,
        vx: facing * 11,
        vy: 0,
        w: 35,
        h: 30,
        lifetime: 2.0,
        damage: skill.damage,
        knockbackX: skill.knockback.x,
        knockbackY: skill.knockback.y,
        color: f.character.colorTheme.primary,
        name: skill.name,
      });
    }
  }

  private updatePet(f: FighterEntity, dt: number) {
    if (!f.petCat) return;
    const cat = f.petCat;

    if (cat.state === 'bowl_slide') {
      cat.x += cat.vx;
      cat.timer -= dt;
      const opponent = f.playerId === 'p1' ? this.p2 : this.p1;
      if (Math.abs(cat.x - opponent.x) < 40 && opponent.isGrounded) {
        opponent.vx = cat.facing * 10;
        opponent.state = 'HIT_STUN';
        opponent.hitStunTime = 0.5;
        this.addDamageText(opponent.x, opponent.y - 60, 'MÈO QUÉT NGÃ!', '#ea580c');
        cat.state = 'follow';
      }
      if (cat.timer <= 0) cat.state = 'follow';
    } else {
      const targetX = f.x - f.facing * 45;
      cat.x += (targetX - cat.x) * 0.08;
      cat.facing = f.facing;
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.lifetime -= dt;
      p.x += p.vx;
      p.y += p.vy;

      if (p.lifetime <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const target = p.ownerId === 'p1' ? this.p2 : this.p1;
      const owner = p.ownerId === 'p1' ? this.p1 : this.p2;

      if (p.isPickupBurger) {
        if (Math.abs(owner.x - p.x) < 40 && owner.isGrounded && owner.character.id === 'hoang_saigon') {
          owner.hp = Math.min(owner.character.maxHp, owner.hp + 150);
          owner.hoangScaleBonus = Math.min(1.5, owner.hoangScaleBonus + 0.1);
          this.addDamageText(owner.x, owner.y - 70, '+150 HP (BURGER KING)!', '#f59e0b', true);
          this.projectiles.splice(i, 1);
          continue;
        }
        if (Math.abs(target.x - p.x) < 40 && target.isGrounded) {
          target.vx = target.facing * -8;
          target.state = 'HIT_STUN';
          target.hitStunTime = 0.6;
          this.addDamageText(target.x, target.y - 60, 'TRÚNG BURGER!', '#ef4444');
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        const pBox = { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
        const hurtbox = getFighterHurtbox(target);
        if (checkAABBCollision(pBox, hurtbox)) {
          const dmg = calculateDamage(p.damage, target);
          target.hp = Math.max(0, target.hp - dmg);
          target.state = 'HIT_STUN';
          target.hitStunTime = 0.4;
          target.vx = target.facing === owner.facing ? owner.facing * p.knockbackX : -owner.facing * p.knockbackX;
          target.vy = p.knockbackY;

          this.addDamageText(target.x, target.y - 60, `-${dmg}`, '#ef4444');
          this.spawnSparks(p.x, p.y, p.color, 10);
          sound.playHit('heavy');

          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private processHitboxes(dt: number) {
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const hb = this.hitboxes[i];
      hb.activeTicks--;

      const attacker = hb.attackerId === 'p1' ? this.p1 : this.p2;
      const defender = hb.attackerId === 'p1' ? this.p2 : this.p1;

      if (defender.state !== 'DEAD' && defender.invulnerableTime <= 0) {
        const hurtbox = getFighterHurtbox(defender);
        if (checkAABBCollision(hb, hurtbox)) {
          const isGuarding = defender.state === 'GUARD' && defender.facing !== attacker.facing;
          if (isGuarding && !hb.isUnblockable) {
            defender.stamina -= hb.damage * 0.4;
            if (defender.stamina <= 0) {
              defender.state = 'GUARD_BROKEN';
              defender.guardBreakTime = 1.5;
              this.addDamageText(defender.x, defender.y - 70, 'BỂ GIÁP!', '#ef4444', true);
            } else {
              this.addDamageText(defender.x, defender.y - 60, 'ĐÃ ĐỠ!', '#3b82f6');
            }
          } else {
            const dmg = calculateDamage(hb.damage, defender);
            defender.hp = Math.max(0, defender.hp - dmg);
            defender.state = 'HIT_STUN';
            defender.hitStunTime = 0.35;
            defender.vx = attacker.facing * hb.knockbackX;
            defender.vy = hb.knockbackY;

            this.hitstopTimer = hb.hitstop;
            this.shakeTrauma = Math.min(1.0, this.shakeTrauma + 0.3);
            this.addDamageText(defender.x, defender.y - 70, `-${dmg}`, hb.isHeavy ? '#f59e0b' : '#ef4444', hb.isHeavy);
            this.spawnSparks(defender.x, defender.y - 50, hb.sparkColor, 12);
            sound.playHit(hb.soundType);
          }
          this.hitboxes.splice(i, 1);
          continue;
        }
      }

      if (hb.activeTicks <= 0) {
        this.hitboxes.splice(i, 1);
      }
    }
  }

  private applyPhysics(f: FighterEntity, dt: number) {
    const floorY = STAGE_CONFIG?.floorY || 560;

    // --- BỘ BẢO VỆ TỌA ĐỘ SAFETY GUARD ---
    if (typeof f.x !== 'number' || isNaN(f.x)) {
      f.x = f.playerId === 'p1' ? 300 : 900;
    }
    if (typeof f.y !== 'number' || isNaN(f.y)) {
      f.y = floorY;
    }
    if (typeof f.vx !== 'number' || isNaN(f.vx)) f.vx = 0;
    if (typeof f.vy !== 'number' || isNaN(f.vy)) f.vy = 0;

    f.x += f.vx;
    f.y += f.vy;

    const mapPlatforms = this.currentMap?.platforms || [];
    const checkResult = checkGroundAndPlatformsRaycast(f, mapPlatforms, floorY);
    f.isGrounded = checkResult.isGrounded;
    f.currentPlatform = checkResult.platform;

    // Giữ chân nhân vật không bị lọt khỏi sàn đấu
    if (f.y >= floorY) {
      f.isGrounded = true;
      f.vy = 0;
      f.y = floorY;
      f.jumpsLeft = f.character.jumpCount;
    } else if (f.isGrounded) {
      f.vy = 0;
      f.y = checkResult.groundY;
      f.jumpsLeft = f.character.jumpCount;
    } else {
      f.vy += STAGE_CONFIG?.gravity || 0.8;
    }

    checkWallBounce(f, STAGE_CONFIG?.minX || 50, STAGE_CONFIG?.maxX || 1150);
  }

  private updateFacing() {
    if (this.p1.state === 'IDLE' || this.p1.state === 'WALK') {
      this.p1.facing = this.p1.x <= this.p2.x ? 1 : -1;
    }
    if (this.p2.state === 'IDLE' || this.p2.state === 'WALK') {
      this.p2.facing = this.p2.x <= this.p1.x ? 1 : -1;
    }
  }

  private createHitbox(f: FighterEntity, hbData: Hitbox) {
    this.hitboxes.push(hbData);
  }

  private spawnSparks(x: number, y: number, color: string, count: number) {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = (Math.random() * 2 - 1) * 8;
        p.vy = (Math.random() * 2 - 1) * 8;
        p.color = color;
        p.size = Math.random() * 4 + 2;
        p.alpha = 1;
        p.life = 0;
        p.maxLife = Math.random() * 0.3 + 0.15;
        p.type = 'spark';
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private addDamageText(x: number, y: number, text: string, color: string, isCritical: boolean = false) {
    this.damageTexts.push({
      id: `dmg_${Date.now()}_${Math.random()}`,
      x,
      y,
      text,
      color,
      alpha: 1,
      life: 0,
      maxLife: 0.8,
      isCritical,
    });
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (p.active) {
        p.life += dt;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = 1 - p.life / p.maxLife;
        if (p.life >= p.maxLife) p.active = false;
      }
    }
  }

  private updateDamageTexts(dt: number) {
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const dtObj = this.damageTexts[i];
      dtObj.life += dt;
      dtObj.y -= 1.2;
      dtObj.alpha = 1 - dtObj.life / dtObj.maxLife;
      if (dtObj.life >= dtObj.maxLife) {
        this.damageTexts.splice(i, 1);
      }
    }
  }

  private getDefaultInputs(): KeyInputState {
    return {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      guard: false,
      charge: false,
      attackJPressed: false,
      skillUPressed: false,
      skillIPressed: false,
      dashPressed: false,
    };
  }

  private computeAiInputs(f: FighterEntity, opp: FighterEntity, dt: number): KeyInputState {
    const inputs = this.getDefaultInputs();
    const dist = opp.x - f.x;
    const absDist = Math.abs(dist);

    if (absDist > 120) {
      if (dist > 0) inputs.right = true;
      else inputs.left = true;
    } else {
      inputs.attackJPressed = Math.random() < 0.08;
      if (Math.random() < 0.03) inputs.skillUPressed = true;
      if (Math.random() < 0.02) inputs.skillIPressed = true;
    }
    return inputs;
  }

  private computeTrainingDummyInputs(f: FighterEntity, opp: FighterEntity): KeyInputState {
    return this.getDefaultInputs();
  }

  private handleTimeOut() {
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
    this.onMatchEnd?.(this.winner, this.winQuote);
  }

  private checkMatchEnd() {
    if (this.isMatchOver) return;

    if (this.p1.hp <= 0 && this.p2.hp <= 0) {
      this.p1.state = 'DEAD';
      this.p2.state = 'DEAD';
      this.isMatchOver = true;
      this.winner = 'draw';
      this.winQuote = 'Đồng quy vu tận! Hai cao thủ cùng gục ngã!';
      this.onMatchEnd?.('draw', this.winQuote);
    } else if (this.p1.hp <= 0) {
      this.p1.state = 'DEAD';
      this.isMatchOver = true;
      this.winner = 'p2';
      this.winQuote = `${this.p2.character.name}: ${this.p2.character.winQuote}`;
      this.onMatchEnd?.('p2', this.winQuote);
    } else if (this.p2.hp <= 0) {
      this.p2.state = 'DEAD';
      this.isMatchOver = true;
      this.winner = 'p1';
      this.winQuote = `${this.p1.character.name}: ${this.p1.character.winQuote}`;
      this.onMatchEnd?.('p1', this.winQuote);
    }
  }

  // --- HÀM ĐỒNG BỘ MẠNG TỌA ĐỘ AN TOÀN ---
  public getLocalNetState(isHost: boolean) {
    const localPlayer = isHost ? this.p1 : this.p2;
    if (!localPlayer) return null;
    const floorY = STAGE_CONFIG?.floorY || 560;
    return {
      x: typeof localPlayer.x === 'number' && !isNaN(localPlayer.x) ? localPlayer.x : (isHost ? 300 : 900),
      y: typeof localPlayer.y === 'number' && !isNaN(localPlayer.y) ? localPlayer.y : floorY,
      vx: typeof localPlayer.vx === 'number' && !isNaN(localPlayer.vx) ? localPlayer.vx : 0,
      vy: typeof localPlayer.vy === 'number' && !isNaN(localPlayer.vy) ? localPlayer.vy : 0,
      hp: typeof localPlayer.hp === 'number' && !isNaN(localPlayer.hp) ? localPlayer.hp : 1000,
      stamina: typeof localPlayer.stamina === 'number' && !isNaN(localPlayer.stamina) ? localPlayer.stamina : 100,
      state: localPlayer.state || 'IDLE',
      facing: localPlayer.facing || (isHost ? 1 : -1),
    };
  }

  public applyOpponentNetState(netState: any, isHost: boolean) {
    const opponent = isHost ? this.p2 : this.p1;
    if (!opponent || !netState) return;

    if (typeof netState.x === 'number' && !isNaN(netState.x) && netState.x > 0 && netState.x < 1200) {
      opponent.x = netState.x;
    }
    if (typeof netState.y === 'number' && !isNaN(netState.y) && netState.y > 0 && netState.y < 680) {
      opponent.y = netState.y;
    }
    if (typeof netState.vx === 'number' && !isNaN(netState.vx)) {
      opponent.vx = netState.vx;
    }
    if (typeof netState.vy === 'number' && !isNaN(netState.vy)) {
      opponent.vy = netState.vy;
    }
    if (typeof netState.hp === 'number' && !isNaN(netState.hp)) {
      opponent.hp = netState.hp;
    }
    if (typeof netState.stamina === 'number' && !isNaN(netState.stamina)) {
      opponent.stamina = netState.stamina;
    }
    if (netState.state) {
      opponent.state = netState.state;
    }
    if (netState.facing === 1 || netState.facing === -1) {
      opponent.facing = netState.facing;
    }
  }
}
