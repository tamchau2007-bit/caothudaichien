/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WebSocket client for the room server. Only *inputs* travel over the wire
 * (no state snapshots) because the match simulation is deterministic and runs
 * on both machines - see `rollback.ts`.
 */

import {
  ClientMessage,
  PROTOCOL_VERSION,
  ServerMessage,
  WS_PATH,
  packInput,
  unpackInput,
} from './protocol';
import { CharacterId, KeyInputState } from './types';

/** Room participant as seen by the lobby UI (character ids are typed here). */
export interface RoomParticipant {
  id: string;
  isHost: boolean;
  characterId: CharacterId;
  ready: boolean;
}

function toParticipants(
  players: { id: string; isHost: boolean; characterId: string; ready: boolean }[]
): RoomParticipant[] {
  return players.map((p) => ({
    id: p.id,
    isHost: p.isHost,
    characterId: p.characterId as CharacterId,
    ready: p.ready,
  }));
}

const RECONNECT_ATTEMPTS = 8;

function makeClientId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `p_${rand}`;
}

function wsUrl(customHost: string | null = null): string {
  if (typeof window === 'undefined') return `ws://localhost:3000${WS_PATH}`;
  const envUrl = (import.meta as any)?.env?.VITE_WS_URL as string | undefined;
  if (envUrl) return envUrl;
  // If user provided a custom host (for LAN), use it.
  if (customHost) return `${customHost}${WS_PATH}`;
  // When on localhost, try to get local IP for LAN play.
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // IP detection simplified: return localhost for now.
    // User can manually specify customHost when joining LAN.
    return `ws://localhost:3000${WS_PATH}`;
  }
  return `${window.location.protocol}//${window.location.host}${WS_PATH}`;
}

export class NetworkManager {
  public socket: WebSocket | null = null;
  public clientId = makeClientId();
  public peerId = '';
  public roomId = '';
  public isHost = false;
  public currentParticipants: RoomParticipant[] = [];
  public opponentCharacter: CharacterId | null = null;
  public mapId = 'nguyen_hue';
  public inGame = false;

  /** Deterministic match seed issued by the server. */
  public matchSeed = 0;
  public startDelayMs = 0;
  public latencyMs = 0;
  public connected = false;

  public onRoomUpdate?: (participants: RoomParticipant[], mapId: string) => void;
  public onMatchStart?: (mapId: string) => void;
  public onConnectionChange?: (connected: boolean) => void;
  public onError?: (message: string) => void;
  public onRemoteInput?: (frame: number, input: KeyInputState) => void;
  public onRemoteChecksum?: (frame: number, checksum: number) => void;
  /** Peer asked for our authoritative state (host only). */
  public onSyncRequest?: () => void;
  /** Host sent an authoritative snapshot after a desync. */
  public onStateSync?: (frame: number, payload: string) => void;
  public onPeerLeft?: () => void;
  public onLatency?: (ms: number) => void;

  private createRoomResolve: ((code: string) => void) | null = null;
  private joinRoomResolve: (() => void) | null = null;
  private joinRoomReject: ((err: Error) => void) | null = null;

  private pingTimer: number | null = null;
  private shouldStayConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pendingJoin: ClientMessage | null = null;
  /** Custom server host (for LAN play). Overrides auto-detected URL. */
  public customHost: string | null = null;
  
  // ------------------------------------------------------------------ public

  public async createRoom(characterId: CharacterId, mapId: string): Promise<string> {
    this.disconnectSocket();
    this.isHost = true;
    this.mapId = mapId;
    this.shouldStayConnected = true;
    this.reconnectAttempts = 0;

    const code = await new Promise<string>((resolve, reject) => {
      this.createRoomResolve = resolve;
      this.joinRoomReject = reject;
      this.pendingJoin = {
        type: 'join',
        create: true,
        clientId: this.clientId,
        characterId,
        mapId,
      };
      this.openSocket();
      window.setTimeout(() => {
        if (this.createRoomResolve) {
          this.createRoomResolve = null;
          this.joinRoomReject = null;
          reject(new Error('Không kết nối được máy chủ (quá thời gian chờ).'));
        }
      }, 12000);
    });

    return code;
  }

  public async joinRoom(code: string, characterId: CharacterId): Promise<void> {
    const roomCode = code.trim().toUpperCase();
    if (roomCode.length < 4) throw new Error('Mã phòng phải có ít nhất 4 ký tự.');

    this.disconnectSocket();
    this.isHost = false;
    this.shouldStayConnected = true;
    this.reconnectAttempts = 0;

    await new Promise<void>((resolve, reject) => {
      this.joinRoomResolve = resolve;
      this.joinRoomReject = reject;
      this.pendingJoin = {
        type: 'join',
        create: false,
        roomCode,
        clientId: this.clientId,
        characterId,
        mapId: this.mapId,
      };
      this.openSocket();
      window.setTimeout(() => {
        if (this.joinRoomReject) {
          const rejectFn = this.joinRoomReject;
          this.joinRoomResolve = null;
          this.joinRoomReject = null;
          rejectFn(new Error('Không kết nối được máy chủ (quá thời gian chờ).'));
        }
      }, 12000);
    });
  }

  public selectCharacter(characterId: CharacterId) {
    this.send({ type: 'select_char', characterId });
  }

  public selectMap(mapId: string) {
    this.send({ type: 'select_map', mapId });
  }

  public setReady(ready: boolean) {
    this.send({ type: 'ready', ready });
  }

  public requestStartMatch() {
    this.send({ type: 'start_match' });
  }

  /** Asks the server for a fresh rematch (new seed) after the current one ends. */
  public requestRematch() {
    this.send({ type: 'rematch' });
  }

  /** Sends one frame of local input for rollback netcode. */
  public sendInput(frame: number, input: KeyInputState) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.send({ type: 'input', frame, input: packInput(input) });
  }

  public sendChecksum(frame: number, checksum: number) {
    this.send({ type: 'checksum', frame, checksum });
  }

  /** Asks the host to resend the full authoritative simulation state. */
  public requestStateSync() {
    this.send({ type: 'sync_request' });
  }

  public sendStateSync(frame: number, payload: string) {
    this.send({ type: 'state_sync', frame, payload });
  }

  public leave() {
    this.shouldStayConnected = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.send({ type: 'leave' });
    this.disconnectSocket();
    this.currentParticipants = [];
    this.opponentCharacter = null;
    this.roomId = '';
    this.peerId = '';
    this.inGame = false;
    this.setConnected(false);
  }

  public disconnect() {
    this.leave();
  }

  // ----------------------------------------------------------------- internal

  private setConnected(value: boolean) {
    if (this.connected === value) return;
    this.connected = value;
    this.onConnectionChange?.(value);
  }

  private send(message: ClientMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(message));
    } catch (err) {
      console.warn('Không gửi được gói tin:', err);
    }
  }

  private openSocket() {
    try {
      const socket = new WebSocket(wsUrl(this.customHost));
      this.socket = socket;

      socket.onopen = () => {
        this.setConnected(true);
        this.reconnectAttempts = 0;
        if (!this.pendingJoin) {
          // Reconnection: re-announce ourselves so the server can re-attach us.
          this.pendingJoin = {
            type: 'join',
            create: false,
            roomCode: this.roomId,
            clientId: this.clientId,
            characterId: (this.currentParticipants.find((p) => p.id === this.peerId)
              ?.characterId as CharacterId) || 'hoang_saigon',
            mapId: this.mapId,
          };
        }
        if (this.pendingJoin) this.send(this.pendingJoin);
        this.startPing();
      };

      socket.onmessage = (event) => this.handleMessage(event.data);
      socket.onerror = () => {
        this.onError?.('Lỗi kết nối tới máy chủ phòng đấu.');
      };
      socket.onclose = () => {
        this.setConnected(false);
        this.stopPing();
        if (this.shouldStayConnected) this.scheduleReconnect();
      };
    } catch (err) {
      console.error('Không mở được WebSocket:', err);
      this.onError?.('Trình duyệt không mở được kết nối WebSocket.');
    }
  }

  private handleMessage(raw: string) {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'joined': {
        this.peerId = msg.playerId;
        this.roomId = msg.roomCode;
        this.isHost = msg.isHost;
        this.mapId = msg.mapId;
        this.inGame = msg.inGame;
        this.currentParticipants = toParticipants(msg.players);
        this.opponentCharacter =
          this.currentParticipants.find((p) => p.id !== this.peerId)?.characterId || null;

        this.pendingJoin = null;
        if (this.createRoomResolve) {
          const resolve = this.createRoomResolve;
          this.createRoomResolve = null;
          this.joinRoomReject = null;
          resolve(msg.roomCode);
        }
        if (this.joinRoomResolve) {
          const resolve = this.joinRoomResolve;
          this.joinRoomResolve = null;
          this.joinRoomReject = null;
          resolve();
        }
        this.onRoomUpdate?.(this.currentParticipants, msg.mapId);
        break;
      }
      case 'room_update': {
        this.currentParticipants = toParticipants(msg.players);
        this.mapId = msg.mapId;
        this.inGame = msg.inGame;
        this.opponentCharacter =
          this.currentParticipants.find((p) => p.id !== this.peerId)?.characterId || null;
        this.onRoomUpdate?.(this.currentParticipants, msg.mapId);
        break;
      }
      case 'match_started': {
        this.currentParticipants = toParticipants(msg.players);
        this.mapId = msg.mapId;
        this.matchSeed = msg.seed;
        this.startDelayMs = msg.startDelayMs;
        this.inGame = true;
        const me = this.currentParticipants.find((p) => p.id === this.peerId);
        if (me) this.isHost = me.isHost;
        this.opponentCharacter =
          this.currentParticipants.find((p) => p.id !== this.peerId)?.characterId || null;
        this.onRoomUpdate?.(this.currentParticipants, msg.mapId);
        this.onMatchStart?.(msg.mapId);
        break;
      }
      case 'input': {
        this.onRemoteInput?.(msg.frame, unpackInput(msg.input));
        break;
      }
      case 'checksum': {
        this.onRemoteChecksum?.(msg.frame, msg.checksum);
        break;
      }
      case 'sync_request': {
        this.onSyncRequest?.();
        break;
      }
      case 'state_sync': {
        this.onStateSync?.(msg.frame, msg.payload);
        break;
      }
      case 'pong': {
        const rtt = Math.max(0, Date.now() - msg.t);
        this.latencyMs = this.latencyMs === 0 ? rtt : Math.round(this.latencyMs * 0.7 + rtt * 0.3);
        this.onLatency?.(this.latencyMs);
        break;
      }
      case 'peer_left': {
        this.inGame = false;
        this.onPeerLeft?.();
        break;
      }
      case 'error': {
        const error = new Error(msg.message || 'Máy chủ báo lỗi.');
        if (this.joinRoomReject) {
          const reject = this.joinRoomReject;
          this.joinRoomResolve = null;
          this.joinRoomReject = null;
          this.createRoomResolve = null;
          this.shouldStayConnected = false;
          reject(error);
        } else {
          this.onError?.(error.message);
        }
        break;
      }
      default:
        break;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= RECONNECT_ATTEMPTS) {
      this.onError?.('Mất kết nối máy chủ. Vui lòng thử lại.');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(6000, 500 * this.reconnectAttempts);
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldStayConnected) this.openSocket();
    }, delay);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      this.send({ type: 'ping', t: Date.now() });
    }, 2000);
  }

  private stopPing() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private disconnectSocket() {
    this.stopPing();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.setConnected(false);
  }

  public get protocolVersion(): number {
    return PROTOCOL_VERSION;
  }
}
