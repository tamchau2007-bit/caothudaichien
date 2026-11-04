/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared wire protocol for online play. Imported by the browser client and by
 * the Node room server so both sides can never drift apart.
 */

import type { KeyInputState } from './types.js';

export const PROTOCOL_VERSION = 2;
export const WS_PATH = '/ws';

export interface RoomParticipant {
  id: string;
  isHost: boolean;
  characterId: string;
  ready: boolean;
}

export type ClientMessage =
  | { type: 'join'; create?: boolean; roomCode?: string; clientId?: string; characterId: string; mapId?: string }
  | { type: 'select_char'; characterId: string }
  | { type: 'select_map'; mapId: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'start_match' }
  | { type: 'rematch' }
  | { type: 'input'; frame: number; input: number }
  | { type: 'checksum'; frame: number; checksum: number }
  /** Guest asks the host for an authoritative snapshot after a desync. */
  | { type: 'sync_request' }
  | { type: 'state_sync'; frame: number; payload: string }
  | { type: 'ping'; t: number }
  | { type: 'leave' };

export type ServerMessage =
  | {
      type: 'joined';
      playerId: string;
      roomCode: string;
      isHost: boolean;
      mapId: string;
      players: RoomParticipant[];
      inGame: boolean;
    }
  | {
      type: 'room_update';
      players: RoomParticipant[];
      mapId: string;
      inGame: boolean;
    }
  | {
      type: 'match_started';
      seed: number;
      startDelayMs: number;
      mapId: string;
      players: RoomParticipant[];
    }
  | { type: 'input'; from: string; frame: number; input: number }
  | { type: 'checksum'; from: string; frame: number; checksum: number }
  | { type: 'sync_request'; from: string }
  | { type: 'state_sync'; from: string; frame: number; payload: string }
  | { type: 'pong'; t: number }
  | { type: 'peer_left'; playerId: string }
  | { type: 'error'; message: string; code?: string };

const INPUT_BITS: (keyof KeyInputState)[] = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'charge',
  'guard',
  'dash',
  'jumpPressed',
  'dashPressed',
  'attackJPressed',
  'skillUPressed',
  'skillIPressed',
];

/** Packs a frame of input into a 13 bit integer (~2 bytes on the wire). */
export function packInput(input: KeyInputState | undefined): number {
  if (!input) return 0;
  let bits = 0;
  for (let i = 0; i < INPUT_BITS.length; i++) {
    if (input[INPUT_BITS[i]]) bits |= 1 << i;
  }
  return bits;
}

export function unpackInput(bits: number): KeyInputState {
  const value = Number.isFinite(bits) ? bits : 0;
  const out: KeyInputState = {
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
  for (let i = 0; i < INPUT_BITS.length; i++) {
    if (value & (1 << i)) (out as any)[INPUT_BITS[i]] = true;
  }
  // "Held" mirrors for UI/debug consumers.
  out.attackJ = out.attackJPressed;
  out.skillU = out.skillUPressed;
  out.skillI = out.skillIPressed;
  return out;
}
