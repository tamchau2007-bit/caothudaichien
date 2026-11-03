/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAABBCollision,
  checkGroundAndPlatformsRaycast,
  calculateDamage,
  checkWallBounce,
} from './physics';
import { CHARACTERS } from './characters';
import { FighterEntity, Hitbox, StagePlatform } from './types';

function createMockFighter(charId: keyof typeof CHARACTERS, playerId: 'p1' | 'p2'): FighterEntity {
  const char = CHARACTERS[charId];
  return {
    playerId,
    character: char,
    x: 400,
    y: 540,
    vx: 0,
    vy: 0,
    width: 60,
    height: 100,
    facing: 1,
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
    comboHits: 0,
    comboDamage: 0,
    comboTimer: 0,
    totalDamageDealt: 0,
  };
}

test('checkAABBCollision detects overlapping boxes correctly', () => {
  const boxA = { x: 10, y: 10, w: 50, h: 50 };
  const boxB = { x: 30, y: 30, w: 50, h: 50 };
  const boxFar = { x: 100, y: 100, w: 20, h: 20 };

  assert.equal(checkAABBCollision(boxA, boxB), true);
  assert.equal(checkAABBCollision(boxA, boxFar), false);
});

test('checkGroundAndPlatformsRaycast lands on one-way platform when falling', () => {
  const platforms: StagePlatform[] = [{ x: 300, y: 400, w: 200, h: 20, label: 'Platform Test' }];

  // Falling down onto platform at y = 405 with vy = 6
  const landing = checkGroundAndPlatformsRaycast(350, 405, 6, 60, platforms, 0, 540);
  assert.equal(landing.isGrounded, true);
  assert.equal(landing.correctedY, 400);
  assert.equal(landing.platform?.label, 'Platform Test');

  // Jumping upwards through platform (vy = -10) should NOT land
  const jumpingUp = checkGroundAndPlatformsRaycast(350, 400, -10, 60, platforms, 0, 540);
  assert.equal(jumpingUp.isGrounded, false);
});

test('checkGroundAndPlatformsRaycast passes through platform when dropping down (S + K)', () => {
  const platforms: StagePlatform[] = [{ x: 300, y: 400, w: 200, h: 20, label: 'Platform Test' }];

  // Dropping timer > 0 passes through platform
  const dropping = checkGroundAndPlatformsRaycast(350, 405, 4, 60, platforms, 0.2, 540);
  assert.equal(dropping.isGrounded, false);
});

test('calculateDamage handles normal attacks and guard reduction', () => {
  const attacker = createMockFighter('kendu', 'p1');
  const defender = createMockFighter('hoang_xitrum', 'p2');
  const hitbox: Hitbox = {
    id: 'test_hit',
    attackerId: 'p1',
    x: 400,
    y: 500,
    w: 50,
    h: 50,
    damage: 100,
    knockbackX: 10,
    knockbackY: -5,
    hitstop: 0.05,
    sparkColor: '#fff',
    activeTicks: 1,
    maxTicks: 5,
  };

  const normalResult = calculateDamage(attacker, defender, hitbox);
  assert.equal(normalResult.isBlocked, false);
  assert.equal(normalResult.finalDamage, 100);

  defender.state = 'GUARD';
  defender.stamina = 100;
  const blockedResult = calculateDamage(attacker, defender, hitbox);
  assert.equal(blockedResult.isBlocked, true);
  assert.equal(blockedResult.finalDamage, 20); // 80% reduced
});

test('checkWallBounce reflects high speed impact against arena walls', () => {
  const leftBounce = checkWallBounce(65, -12, 70, 1130);
  assert.equal(leftBounce.bounced, true);
  assert.ok(leftBounce.newVx > 0);
});
