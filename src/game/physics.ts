/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FighterEntity, Hitbox, Hurtbox, SkillDefinition, StagePlatform } from './types';

export const STAGE_CONFIG = {
  width: 1200,
  height: 680,
  floorY: 540,
  leftWall: 70,
  rightWall: 1130,
  gravity: 34,
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

export function getFighterHurtbox(f: FighterEntity): Hurtbox {
  // Center hurtbox on fighter feet/body, scale with Hoàng Sài Gòn dynamic size
  const scale = f.character.id === 'hoang_saigon' ? f.hoangScaleBonus : 1.0;
  const w = f.width * 0.75 * scale;
  const h = f.height * 0.88 * scale;
  const x = f.x - w / 2;
  const y = f.y - h;
  return { x, y, w, h };
}

/**
 * Platform and Ground Check:
 * Checks floor Y as well as any one-way overhead platforms!
 */
export function checkGroundAndPlatformsRaycast(
  x: number,
  y: number,
  vy: number,
  width: number,
  platforms: StagePlatform[],
  droppingPlatformTimer: number,
  floorY: number = STAGE_CONFIG.floorY
): { isGrounded: boolean; correctedY: number; platform: StagePlatform | null } {
  // If moving upwards (vy < 0), pass through one-way platforms
  if (vy < 0) {
    return { isGrounded: false, correctedY: y, platform: null };
  }

  // Check platforms if not currently dropping down (S + K)
  if (droppingPlatformTimer <= 0) {
    for (const plat of platforms) {
      const platLeft = plat.x;
      const platRight = plat.x + plat.w;
      const platTop = plat.y;

      // Horizontal containment
      if (x >= platLeft - 10 && x <= platRight + 10) {
        // Vertical landing window: feet near platTop while falling
        if (y >= platTop && y <= platTop + Math.max(14, vy + 4)) {
          return { isGrounded: true, correctedY: platTop, platform: plat };
        }
      }
    }
  }

  // Check main arena floor
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
 * Calculate damage, passives, gimmicks, guard reductions, and knockbacks
 */
export function calculateDamage(
  attacker: FighterEntity,
  defender: FighterEntity,
  hitbox: Hitbox,
  skill?: SkillDefinition | null
): DamageCalculationResult {
  let baseDamage = hitbox.damage;
  let isCritical = false;
  let isBlocked = false;
  let isGuardBreak = false;
  let isSuperArmor = false;
  let isCountered = false;
  let poisonExplosion = false;

  // Attacker buffs & Passives
  if (attacker.nextHitCrit) {
    baseDamage *= 1.8;
    isCritical = true;
  }
  if (attacker.character.id === 'le_dao') {
    // Nội tại "Hoàng Kim Cốt": +20% sát thương chém + số xương đã rút
    const ribSacrificeBonus = (12 - attacker.ribBonesAvailable) * 0.04;
    baseDamage *= 1.2 + ribSacrificeBonus;
  }
  if (attacker.character.id === 'hoang_xitrum') {
    if (attacker.kickRangeBonusTime > 0) baseDamage *= 1.15;
  }
  if (attacker.character.id === 'kendu' && attacker.beatboxFlowActive) {
    baseDamage *= 1.25;
    isCritical = true;
  }
  if (attacker.character.id === 'hung_chimbay' && !attacker.isGrounded) {
    baseDamage *= 1.35; // +35% Air Drift aerial damage!
    isCritical = true;
  }

  // Check Defender Counter stance
  if (defender.counterTime > 0) {
    isCountered = true;
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

  // Defender charging W (High risk: takes 1.5x damage, cannot guard or dodge)
  if (defender.state === 'CHARGE_W') {
    baseDamage *= 1.5;
  }

  // Check Defender Guarding (S)
  if (defender.state === 'GUARD' && !hitbox.isUnblockable) {
    isBlocked = true;
    baseDamage *= 0.2; // 80% reduction

    // Guard drains stamina
    const staminaDrain = Math.max(12, hitbox.damage * 0.45);
    defender.stamina = Math.max(0, defender.stamina - staminaDrain);

    if (defender.stamina <= 0) {
      isGuardBreak = true;
    }
  }

  // Passive: Hoàng Sài Gòn "Mỡ Tạng Kiên Cường" + Gimmick Dynamic Size Armor
  if (defender.character.id === 'hoang_saigon') {
    baseDamage *= 0.85; // Passive
    baseDamage *= 1 - Math.min(0.35, defender.hoangArmorBonus); // Gimmick armor
  }

  // Super Armor
  if (defender.superArmorTime > 0 || (defender.state === 'DASH' && defender.character.dashHasSuperArmor)) {
    isSuperArmor = true;
  }

  // Passive: Nhật Bản "Dấu Ấn Vuốt Độc" (5 stacks -> 100 DMG explosion)
  if (attacker.character.id === 'nhat_ban' && hitbox.attackerId === attacker.playerId) {
    defender.poisonClawStacks += 1;
    if (defender.poisonClawStacks >= 5) {
      defender.poisonClawStacks = 0;
      baseDamage += 100;
      poisonExplosion = true;
      isCritical = true;
    }
  }

  // Passive: KenDu "Dòng Máu Beatbox" (3 consecutive hits restore 10 stamina)
  if (attacker.character.id === 'kendu') {
    attacker.stamina = Math.min(attacker.character.maxStamina, attacker.stamina + 4);
  }

  // Knockback scaling based on defender lost HP
  const hpLossPercent = 1 - Math.max(0, defender.hp / defender.character.maxHp);
  let knockbackScale = (1 + hpLossPercent * 0.75) / (defender.character.weight * (defender.character.id === 'hoang_saigon' ? defender.hoangScaleBonus : 1));

  // Passive: Hùng Chim Bay aerial knockback bonus (+35%)
  if (attacker.character.id === 'hung_chimbay' && !attacker.isGrounded) {
    knockbackScale *= 1.35;
  }
  // Hoàng Sài Gòn Gimmick knockback bonus
  if (attacker.character.id === 'hoang_saigon') {
    knockbackScale *= 1 + attacker.hoangKnockbackBonus;
  }

  const facingDir = attacker.x < defender.x ? 1 : -1;
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
