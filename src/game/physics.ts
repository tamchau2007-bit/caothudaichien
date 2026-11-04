/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FighterEntity, Hitbox, Hurtbox, SkillDefinition, StagePlatform } from './types';

/**
 * All values are expressed in "per 60Hz frame" units because the simulation
 * runs on a fixed deterministic timestep. Never feed real delta-time in here:
 * the rollback netcode (online play) relies on both clients producing bit
 * identical results from the same inputs.
 */
export const STAGE_CONFIG = {
  width: 1200,
  height: 680,
  floorY: 540,
  leftWall: 70,
  rightWall: 1130,
  gravity: 0.86,
  maxFallSpeed: 15,
  /** Frames of grace after walking off a ledge where a jump still counts. */
  coyoteFrames: 5,
  /** Frames a jump press is remembered while busy. */
  jumpBufferFrames: 4,
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function checkAABBCollision(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Horizontal + vertical body box used for every attack test. */
export function getFighterHurtbox(f: FighterEntity): Hurtbox {
  const scale = f.character.id === 'hoang_saigon' ? f.hoangScaleBonus : 1.0;
  const w = Math.max(28, f.width * 0.72 * scale);
  const h = Math.max(52, f.height * 0.9 * scale);
  return { x: f.x - w / 2, y: f.y - h, w, h };
}

/**
 * Platform and ground resolution for one frame of movement.
 *
 * `y` is the candidate feet position for this frame (already moved), `prevY` is
 * where the feet were before the move. A fighter only lands on a one-way
 * platform when the feet actually cross its top edge while falling, which is
 * what makes jumping up *through* platforms work.
 */
export function checkGroundAndPlatformsRaycast(
  x: number,
  y: number,
  vy: number,
  width: number,
  platforms: StagePlatform[],
  droppingPlatformTimer: number,
  floorY: number = STAGE_CONFIG.floorY,
  prevY?: number
): { isGrounded: boolean; correctedY: number; platform: StagePlatform | null } {
  if (vy < 0) {
    return { isGrounded: false, correctedY: y, platform: null };
  }

  const prev = typeof prevY === 'number' && !isNaN(prevY) ? prevY : y - Math.max(0, vy);
  const halfW = Math.max(12, width * 0.36);

  if (droppingPlatformTimer <= 0) {
    let best: StagePlatform | null = null;
    for (const plat of platforms) {
      // Horizontal overlap with the body, not just the centre point.
      if (x + halfW <= plat.x || x - halfW >= plat.x + plat.w) continue;
      // Must cross the top edge from above while falling.
      const crossedTop = prev <= plat.y + 0.5 && y >= plat.y;
      const restingOnTop = Math.abs(y - plat.y) <= 0.5;
      if (!crossedTop && !restingOnTop) continue;
      if (!best || plat.y < best.y) best = plat;
    }
    if (best) {
      return { isGrounded: true, correctedY: best.y, platform: best };
    }
  }

  if (y >= floorY) {
    return { isGrounded: true, correctedY: floorY, platform: null };
  }

  return { isGrounded: false, correctedY: y, platform: null };
}

export interface DamageCalculationResult {
  finalDamage: number;
  isBlocked: boolean;
  isGuardBreak: boolean;
  isSuperArmor: boolean;
  isCritical: boolean;
  isCountered: boolean;
  knockbackX: number;
  knockbackY: number;
  hitstop: number;
  poisonExplosion: boolean;
}

/**
 * Damage / guard / passive resolution. Pure: same inputs always produce the
 * same numbers so that rollback resimulation stays in sync.
 */
export function calculateDamage(
  attacker: FighterEntity,
  defender: FighterEntity,
  hitbox: Hitbox,
  skill?: SkillDefinition | null
): DamageCalculationResult {
  let baseDamage = Math.max(1, hitbox.damage);
  let isCritical = false;
  let isBlocked = false;
  let isGuardBreak = false;
  let isSuperArmor = false;
  let poisonExplosion = false;

  const isAirborneAttacker = !attacker.isGrounded;

  if (attacker.nextHitCrit) {
    baseDamage *= 1.8;
    isCritical = true;
  }
  if (attacker.character.id === 'le_dao') {
    // "Hoàng Kim Cốt": chém +20%, cộng thêm theo số xương đã rút.
    const ribSacrificeBonus = (12 - attacker.ribBonesAvailable) * 0.04;
    baseDamage *= 1.2 + ribSacrificeBonus;
  }
  if (attacker.character.id === 'hoang_xitrum' && attacker.kickRangeBonusTime > 0) {
    baseDamage *= 1.15;
  }
  if (attacker.character.id === 'kendu' && attacker.beatboxFlowActive) {
    baseDamage *= 1.25;
    isCritical = true;
  }
  if (attacker.character.id === 'hung_chimbay' && isAirborneAttacker) {
    baseDamage *= 1.35; // +35% sát thương trên không
    isCritical = true;
  }

  // Counter stance (Cánh Chim Đỡ Đòn / Phản Đòn): attacker takes nothing.
  if (defender.counterTime > 0 && attacker.playerId !== defender.playerId) {
    return {
      finalDamage: 0,
      isBlocked: false,
      isGuardBreak: false,
      isSuperArmor: false,
      isCritical: false,
      isCountered: true,
      knockbackX: 0,
      knockbackY: 0,
      hitstop: 0.1,
      poisonExplosion: false,
    };
  }

  // Gồng W: high risk, takes 1.5x damage and cannot guard.
  if (defender.state === 'CHARGE_W') {
    baseDamage *= 1.5;
  }

  // Guard (S): 80% reduction, drains stamina instead of HP.
  if (defender.state === 'GUARD' && !hitbox.isUnblockable && defender.stamina > 0) {
    isBlocked = true;
    baseDamage *= 0.2;

    const staminaDrain = Math.max(10, hitbox.damage * 0.45);
    defender.stamina = Math.max(0, defender.stamina - staminaDrain);
    if (defender.stamina <= 0) isGuardBreak = true;
  }

  // Passive + gimmick armour of Hoàng Sài Gòn.
  if (defender.character.id === 'hoang_saigon') {
    baseDamage *= 0.85;
    baseDamage *= 1 - Math.min(0.35, defender.hoangArmorBonus);
  }

  if (
    defender.superArmorTime > 0 ||
    (defender.state === 'DASH' && defender.character.dashHasSuperArmor) ||
    skill?.isSuperArmor === true
  ) {
    isSuperArmor = true;
  }

  // Nhật Bản "Dấu Ấn Vuốt Độc": 5 stacks -> +100 dmg explosion.
  if (attacker.character.id === 'nhat_ban' && hitbox.attackerId === attacker.playerId) {
    defender.poisonClawStacks += 1;
    if (defender.poisonClawStacks >= 5) {
      defender.poisonClawStacks = 0;
      baseDamage += 100;
      poisonExplosion = true;
      isCritical = true;
    }
  }

  // KenDu "Dòng Máu Beatbox": every hit restores a little stamina.
  if (attacker.character.id === 'kendu') {
    attacker.stamina = Math.min(attacker.character.maxStamina, attacker.stamina + 4);
  }

  // Knockback scales with damage already taken (smash-style).
  const hpLossPercent = 1 - Math.max(0, defender.hp / defender.character.maxHp);
  const weight = defender.character.weight || 1;
  const sizeScale = defender.character.id === 'hoang_saigon' ? defender.hoangScaleBonus : 1;
  let knockbackScale = (1 + hpLossPercent * 0.75) / (weight * sizeScale);

  if (attacker.character.id === 'hung_chimbay' && isAirborneAttacker) {
    knockbackScale *= 1.35;
  }
  if (attacker.character.id === 'hoang_saigon') {
    knockbackScale *= 1 + attacker.hoangKnockbackBonus;
  }

  const facingDir = attacker.x <= defender.x ? 1 : -1;
  let kx = hitbox.knockbackX * facingDir * knockbackScale;
  let ky = hitbox.knockbackY * knockbackScale;

  if (isBlocked && !isGuardBreak) {
    kx *= 0.25;
    ky = 0;
  }
  if (isSuperArmor && !hitbox.isUnblockable) {
    kx *= 0.1;
    ky = 0;
  }

  const hitstop = isGuardBreak ? 0.14 : hitbox.hitstop || 0.04;

  return {
    finalDamage: Math.max(1, Math.round(baseDamage)),
    isBlocked,
    isGuardBreak,
    isSuperArmor,
    isCritical,
    isCountered: false,
    knockbackX: kx,
    knockbackY: ky,
    hitstop,
    poisonExplosion,
  };
}

/** Wall clamp + smash-style wall bounce for fast knockback. */
export function checkWallBounce(
  x: number,
  vx: number,
  leftWall: number = STAGE_CONFIG.leftWall,
  rightWall: number = STAGE_CONFIG.rightWall
): { bounced: boolean; newX: number; newVx: number } {
  const minBounceSpeed = 7.5;

  if (x <= leftWall) {
    if (vx < -minBounceSpeed) {
      return { bounced: true, newX: leftWall + 4, newVx: -vx * 0.65 };
    }
    return { bounced: false, newX: leftWall, newVx: 0 };
  }

  if (x >= rightWall) {
    if (vx > minBounceSpeed) {
      return { bounced: true, newX: rightWall - 4, newVx: -vx * 0.65 };
    }
    return { bounced: false, newX: rightWall, newVx: 0 };
  }

  return { bounced: false, newX: x, newVx: vx };
}
