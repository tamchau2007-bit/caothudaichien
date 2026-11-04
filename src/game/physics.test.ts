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
  STAGE_CONFIG,
} from './physics';
import { GameEngine, EMPTY_INPUT } from './engine';
import { RollbackSession } from './rollback';
import { GameMode, GameSettings, Hitbox, KeyInputState, StagePlatform } from './types';

const settings: GameSettings = {
  screenShake: false,
  vfxParticles: false,
  fpsLimit: 60,
  masterVolume: 0,
  bgmVolume: 0,
  sfxVolume: 0,
  bufferDelay: 0,
  showHitboxes: false,
  infiniteStamina: false,
  dummyBehavior: 'stand',
};

function makeEngine(
  p1: any = 'hung_chimbay',
  p2: any = 'kendu',
  mode: GameMode = 'online',
  seed = 12345
): GameEngine {
  return new GameEngine(p1, p2, mode, settings, 'nguyen_hue', seed);
}

function down(engine: GameEngine, frames: number, input: Partial<KeyInputState> = {}) {
  for (let i = 0; i < frames; i++) {
    engine.step({ ...EMPTY_INPUT, ...input }, { ...EMPTY_INPUT });
  }
}

// --------------------------------------------------------------- geometry

test('checkAABBCollision detects overlapping boxes correctly', () => {
  assert.equal(
    checkAABBCollision({ x: 10, y: 10, w: 50, h: 50 }, { x: 30, y: 30, w: 50, h: 50 }),
    true
  );
  assert.equal(
    checkAABBCollision({ x: 10, y: 10, w: 50, h: 50 }, { x: 100, y: 100, w: 20, h: 20 }),
    false
  );
});

test('lands on a one-way platform when falling through its top edge', () => {
  const platforms: StagePlatform[] = [{ x: 300, y: 400, w: 200, h: 20, label: 'Platform Test' }];

  const landing = checkGroundAndPlatformsRaycast(350, 405, 6, 60, platforms, 0, 540, 399);
  assert.equal(landing.isGrounded, true);
  assert.equal(landing.correctedY, 400);
  assert.equal(landing.platform?.label, 'Platform Test');

  const jumpingUp = checkGroundAndPlatformsRaycast(350, 400, -10, 60, platforms, 0, 540, 410);
  assert.equal(jumpingUp.isGrounded, false);
});

test('passes through a platform while dropping down (S + Jump)', () => {
  const platforms: StagePlatform[] = [{ x: 300, y: 400, w: 200, h: 20, label: 'Platform Test' }];
  const dropping = checkGroundAndPlatformsRaycast(350, 405, 4, 60, platforms, 0.2, 540, 399);
  assert.equal(dropping.isGrounded, false);
});

test('ground check ignores platforms that are horizontally out of reach', () => {
  const platforms: StagePlatform[] = [{ x: 600, y: 400, w: 200, h: 20 }];
  const result = checkGroundAndPlatformsRaycast(350, 405, 6, 60, platforms, 0, 540, 399);
  assert.equal(result.isGrounded, false);
});

test('wall bounce reflects fast impacts and clamps slow ones', () => {
  const bounced = checkWallBounce(65, -12, 70, 1130);
  assert.equal(bounced.bounced, true);
  assert.ok(bounced.newVx > 0);

  const clamped = checkWallBounce(66, -2, 70, 1130);
  assert.equal(clamped.bounced, false);
});

// --------------------------------------------------------------- combat

test('calculateDamage applies normal damage and 80% guard reduction', () => {
  const engine = makeEngine('kendu', 'khoa_pug', 'online');
  const attacker = engine.p1;
  const defender = engine.p2;

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
    soundType: 'light',
    activeTicks: 1,
    maxTicks: 5,
  };

  const normal = calculateDamage(attacker, defender, hitbox);
  assert.equal(normal.isBlocked, false);
  assert.equal(normal.finalDamage, 100);

  defender.state = 'GUARD';
  defender.stamina = 100;
  const blocked = calculateDamage(attacker, defender, hitbox);
  assert.equal(blocked.isBlocked, true);
  assert.equal(blocked.finalDamage, 20);
});

test('guarding reduces HP loss and drains stamina instead', () => {
  const engine = makeEngine('kendu', 'khoa_pug', 'online');
  engine.p2.x = engine.p1.x + 40;
  const hpBefore = engine.p2.hp;

  engine.executeSkill(engine.p1, 'J');
  for (let i = 0; i < 12; i++) {
    engine.step({ ...EMPTY_INPUT }, { ...EMPTY_INPUT, guard: true });
  }

  assert.ok(engine.p2.stamina < 100, 'thủ phải bị trừ thể lực');
  const lost = hpBefore - engine.p2.hp;
  assert.ok(lost > 0 && lost < 20, `sát thương khi đỡ phải rất thấp, nhận ${lost}`);
});

test('attacks actually deal damage within range', () => {
  const engine = makeEngine('kendu', 'khoa_pug', 'online');
  engine.p2.x = engine.p1.x + 50;
  const hpBefore = engine.p2.hp;

  engine.executeSkill(engine.p1, 'J');
  down(engine, 20);

  assert.ok(engine.p2.hp < hpBefore, 'đòn đánh phải gây sát thương');
});

// --------------------------------------------------------------- jumping

test('Hùng Chim Bay can jump off the ground (regression: nhảy không được)', () => {
  const engine = makeEngine('hung_chimbay', 'kendu', 'training');
  const startY = engine.p1.y;
  assert.equal(engine.p1.isGrounded, true);

  engine.step({ ...EMPTY_INPUT, jump: true, jumpPressed: true }, { ...EMPTY_INPUT });

  assert.equal(engine.p1.isGrounded, false, 'phải rời mặt đất sau khi nhảy');
  assert.ok(engine.p1.y < startY, 'phải bay lên');
  assert.equal(engine.p1.jumpsLeft, 1, 'còn 1 lần nhảy trên không');
});

test('Hùng Chim Bay has a working double jump and gets jumps refilled on landing', () => {
  const engine = makeEngine('hung_chimbay', 'kendu', 'training');

  engine.step({ ...EMPTY_INPUT, jump: true, jumpPressed: true }, { ...EMPTY_INPUT });
  down(engine, 6, { jump: true });
  const vyAfterFirst = engine.p1.vy;

  engine.step({ ...EMPTY_INPUT, jump: true, jumpPressed: true }, { ...EMPTY_INPUT });
  assert.equal(engine.p1.jumpsLeft, 0);
  assert.ok(engine.p1.vy < vyAfterFirst, 'nhảy lần 2 phải đẩy lên cao hơn');

  // Fall back to the floor.
  down(engine, 200);
  assert.equal(engine.p1.isGrounded, true);
  assert.equal(engine.p1.jumpsLeft, engine.p1.character.jumpCount);
});

test('holding jump while airborne glides instead of falling fast', () => {
  const engine = makeEngine('hung_chimbay', 'kendu', 'training');

  engine.step({ ...EMPTY_INPUT, jump: true, jumpPressed: true }, { ...EMPTY_INPUT });
  down(engine, 25, { jump: true }); // pass the apex, keep holding jump

  assert.ok(engine.p1.vy <= 2, `tốc độ rơi khi chao lượn phải chậm, nhận ${engine.p1.vy}`);
  assert.ok(engine.p1.airDriftCharge < 100, 'chao lượn phải tiêu hao năng lượng cánh');

  // A non-gliding character must not get the slow fall: it ends up much lower.
  const gravityEngine = makeEngine('kendu', 'hoang_saigon', 'training');
  gravityEngine.step({ ...EMPTY_INPUT, jump: true, jumpPressed: true }, { ...EMPTY_INPUT });
  down(gravityEngine, 25, { jump: true });
  assert.ok(
    gravityEngine.p1.y > engine.p1.y,
    `nhân vật không bay phải rơi nhanh hơn (${gravityEngine.p1.y} vs ${engine.p1.y})`
  );
});

test('jumping lands on the overhead platform of the stage', () => {
  const engine = makeEngine('hung_chimbay', 'kendu', 'training');
  const platform = engine.currentMap.platforms[0];
  engine.p1.x = platform.x + platform.w / 2;
  engine.p1.y = STAGE_CONFIG.floorY;

  engine.step({ ...EMPTY_INPUT, jump: true, jumpPressed: true }, { ...EMPTY_INPUT });
  down(engine, 90);

  assert.equal(engine.p1.isGrounded, true);
  assert.equal(engine.p1.y, platform.y, 'phải đáp xuống mặt bàn trên cao');
});

// --------------------------------------------------------------- rollback

function makeInputStream(count: number, salt: number): KeyInputState[] {
  let seed = salt;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const list: KeyInputState[] = [];
  for (let f = 0; f < count; f++) {
    const input: KeyInputState = { ...EMPTY_INPUT };
    input.right = rand() < 0.55;
    input.left = !input.right && rand() < 0.2;
    input.jump = rand() < 0.3;
    input.jumpPressed = input.jump && rand() < 0.35;
    input.guard = rand() < 0.12;
    input.charge = !input.guard && rand() < 0.1;
    input.attackJPressed = rand() < 0.3;
    input.skillUPressed = rand() < 0.14;
    input.skillIPressed = rand() < 0.1;
    input.dashPressed = rand() < 0.07;
    list.push(input);
  }
  return list;
}

test('snapshot/restore reproduces the exact same state', () => {
  const engine = makeEngine('kendu', 'nhat_ban', 'online', 99);
  const inputs1 = makeInputStream(120, 7);
  const inputs2 = makeInputStream(120, 11);

  for (let f = 0; f < 60; f++) engine.step(inputs1[f], inputs2[f]);
  const snapshot = engine.snapshot();
  const checksum = engine.checksum();

  for (let f = 60; f < 120; f++) engine.step(inputs1[f], inputs2[f]);
  engine.restore(snapshot);

  assert.equal(engine.checksum(), checksum);

  // Re-running the same frames must produce the same result again.
  for (let f = 60; f < 120; f++) engine.step(inputs1[f], inputs2[f]);
  const replayed = engine.checksum();
  engine.restore(snapshot);
  for (let f = 60; f < 120; f++) engine.step(inputs1[f], inputs2[f]);
  assert.equal(engine.checksum(), replayed);
});

test('rollback netcode converges to the reference simulation after late inputs', () => {
  const TOTAL = 320;
  const LATE_BY = 4;
  const p1Inputs = makeInputStream(TOTAL, 12345);
  const p2Inputs = makeInputStream(TOTAL, 54321);

  const reference = new GameEngine(
    'hung_chimbay',
    'kendu',
    'online',
    settings,
    'nguyen_hue',
    424242
  );
  for (let f = 0; f < TOTAL; f++) reference.step(p1Inputs[f], p2Inputs[f]);

  const local = new GameEngine(
    'hung_chimbay',
    'kendu',
    'online',
    settings,
    'nguyen_hue',
    424242
  );
  const session = new RollbackSession(local, { localPlayer: 'p1', inputDelay: 0 });

  for (let f = 0; f < TOTAL; f++) {
    session.setLocalInput(p1Inputs[f]);
    session.advance();

    const lateFrame = f - LATE_BY;
    if (lateFrame >= 0) session.receiveRemoteInput(lateFrame, p2Inputs[lateFrame]);
  }
  for (let f = TOTAL - LATE_BY; f < TOTAL; f++) {
    if (f >= 0) session.receiveRemoteInput(f, p2Inputs[f]);
  }

  assert.equal(local.frame, reference.frame);
  assert.equal(local.p1.hp, reference.p1.hp, 'HP P1 phải khớp bản tham chiếu');
  assert.equal(local.p2.hp, reference.p2.hp, 'HP P2 phải khớp bản tham chiếu');
  assert.equal(local.checksum(), reference.checksum(), 'trạng thái phải hội tụ sau rollback');
  assert.ok(session.stats.rollbacks > 0, 'phải có ít nhất một lần rollback');
});

test('rollback session predicts remote input when nothing has arrived yet', () => {
  const local = makeEngine('kendu', 'bao_ren', 'online', 5);
  const session = new RollbackSession(local, { localPlayer: 'p2', inputDelay: 2 });
  const inputs = makeInputStream(30, 3);

  for (let f = 0; f < 30; f++) {
    session.setLocalInput(inputs[f]);
    session.advance();
  }

  assert.equal(local.frame, 30);
  assert.ok(session.stats.predictedFrames > 0);
  assert.equal(session.predictionFrames, 0);
});
