/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CharacterId, FighterState, KeyInputState, MapId } from './types';

export interface NetworkPacket {
  type:
    | 'join'
    | 'joined'
    | 'ready'
    | 'select_char'
    | 'select_map'
    | 'start_match'
    | 'match_started'
    | 'room_update'
    | 'input'
    | 'state_sync'
    | 'leave';
  roomId: string;
  senderId: string;
  payload?: any;
  timestamp: number;
}

export interface PlayerNetState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  stamina: number;
  state: FighterState;
  facing: 1 | -1;
  skillId?: string | null;
}

export interface RoomParticipant {
  id: string;
  isHost: boolean;
  characterId: CharacterId;
  ready: boolean;
}

export class NetworkManager {
  private socket: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  public roomId: string = '';
  public peerId: string = '';
  public isHost: boolean = false;
  public isConnected: boolean = false;
  public isConnecting: boolean = false;
  public opponentReady: boolean = false;
  public opponentCharacter: CharacterId = 'kendu';
  public selectedMapId: MapId = 'nguyen_hue';
  public currentParticipants: RoomParticipant[] = [];

  public onOpponentInput?: (inputs: KeyInputState) => void;
  public onOpponentState?: (state: PlayerNetState) => void;
  public onRoomUpdate?: (participants: RoomParticipant[], mapId: MapId) => void;
  public onMatchStart?: (mapId: MapId) => void;
  public onPlayerJoined?: (oppId: string, oppChar: CharacterId) => void;
  public onConnectionChange?: (connected: boolean, error?: string) => void;

  constructor() {
    this.peerId = 'player_' + Math.random().toString(36).substring(2, 8);
  }

  public static generateRoomCode(): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return code;
  }

  public async createRoom(charId: CharacterId, mapId: MapId = 'nguyen_hue'): Promise<string> {
    this.isHost = true;
    this.selectedMapId = mapId;
    this.roomId = NetworkManager.generateRoomCode();

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostChar: charId, mapId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.roomCode) {
          this.roomId = data.roomCode;
        }
      }
    } catch (e) {
      console.warn('Fallback to local room code creation');
    }

    this.connectTransport(this.roomId, charId, true);
    return this.roomId;
  }

  public async joinRoom(roomCode: string, charId: CharacterId) {
    this.roomId = roomCode.toUpperCase().trim();
    this.isHost = false;
    this.connectTransport(this.roomId, charId, false);
  }

  private connectTransport(roomId: string, charId: CharacterId, host: boolean) {
    this.isConnecting = true;

    if (this.channel) this.channel.close();
    try {
      this.channel = new BroadcastChannel(`daichien_${roomId}`);
      this.channel.onmessage = (event) => {
        this.handleIncomingPacket(event.data);
      };
    } catch (e) {
      // BroadcastChannel fallback
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?roomId=${roomId}&roomCode=${roomId}&peerId=${this.peerId}&isHost=${host}&characterId=${charId}`;

    try {
      if (this.socket) {
        this.socket.close();
      }
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.onConnectionChange?.(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingPacket(data);
        } catch (err) {
          console.error('Failed to parse websocket message', err);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('WebSocket connection error, utilizing BroadcastChannel fallback', err);
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.onConnectionChange?.(false);
      };
    } catch (e) {
      console.warn('WebSocket not available, fallback to BroadcastChannel', e);
      this.isConnected = true;
      this.isConnecting = false;
      this.onConnectionChange?.(true);
    }
  }

  private handleIncomingPacket(packet: any) {
    if (!packet || packet.senderId === this.peerId) return;

    if (packet.type === 'room_update') {
      const players: RoomParticipant[] = packet.players || [];
      this.currentParticipants = players;
      if (packet.mapId) this.selectedMapId = packet.mapId;

      const opp = players.find((p) => p.id !== this.peerId);
      if (opp) {
        this.opponentCharacter = opp.characterId;
        this.opponentReady = opp.ready;
        this.onPlayerJoined?.(opp.id, opp.characterId);
      }

      this.onRoomUpdate?.(players, this.selectedMapId);
    } else if (packet.type === 'match_started') {
      if (packet.mapId) this.selectedMapId = packet.mapId;
      this.onMatchStart?.(this.selectedMapId);
    } else if (packet.type === 'input') {
      this.onOpponentInput?.(packet.payload);
    } else if (packet.type === 'state_sync') {
      this.onOpponentState?.(packet.payload);
    }
  }

  public selectCharacter(charId: CharacterId) {
    this.sendRaw({
      type: 'select_char',
      characterId: charId,
      senderId: this.peerId,
      roomId: this.roomId,
    });
  }

  public selectMap(mapId: MapId) {
    this.selectedMapId = mapId;
    this.sendRaw({
      type: 'select_map',
      mapId,
      senderId: this.peerId,
      roomId: this.roomId,
    });
  }

  public setReady(ready: boolean) {
    this.sendRaw({
      type: 'ready',
      ready,
      senderId: this.peerId,
      roomId: this.roomId,
    });
  }

  public requestStartMatch() {
    this.sendRaw({
      type: 'start_match',
      senderId: this.peerId,
      roomId: this.roomId,
      mapId: this.selectedMapId,
    });
  }

  public sendInput(inputs: KeyInputState) {
    this.sendRaw({
      type: 'input',
      roomId: this.roomId,
      senderId: this.peerId,
      payload: inputs,
      timestamp: Date.now(),
    });
  }

  public sendState(state: PlayerNetState) {
    this.sendRaw({
      type: 'state_sync',
      roomId: this.roomId,
      senderId: this.peerId,
      payload: state,
      timestamp: Date.now(),
    });
  }

  private sendRaw(data: any) {
    const raw = JSON.stringify(data);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(raw);
    }
    if (this.channel) {
      this.channel.postMessage(data);
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }
}