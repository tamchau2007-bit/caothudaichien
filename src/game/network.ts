/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Peer from 'peerjs';
import { KeyInputState, SkillSlot } from './types';

export class NetworkManager {
  public peer: any = null;
  public conn: any = null;
  public isHost: boolean = false;
  public roomCode: string = '';

  public onOpponentInput?: (inputs: KeyInputState) => void;
  public onOpponentState?: (state: any) => void;
  public onOpponentSkill?: (slot: SkillSlot) => void;
  public onPlayerJoined?: (id: string, char: any) => void;
  public onConnected?: () => void;
  public onError?: (err: string) => void;

  public createRoom(onCreated: (code: string) => void) {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.roomCode = code;
    this.isHost = true;

    try {
      this.peer = new Peer(`caothudaichien_${code}`);

      this.peer.on('open', () => {
        onCreated(code);
      });

      this.peer.on('connection', (c: any) => {
        this.conn = c;
        this.setupConnection();
      });

      this.peer.on('error', (err: any) => {
        console.error('PeerJS Host Error:', err);
        this.onError?.('Không thể tạo phòng kết nối.');
      });
    } catch (e) {
      console.error(e);
    }
  }

  public joinRoom(code: string, onJoined: () => void) {
    const cleanCode = code.trim().toUpperCase();
    this.roomCode = cleanCode;
    this.isHost = false;

    try {
      this.peer = new Peer();

      this.peer.on('open', () => {
        if (this.peer) {
          this.conn = this.peer.connect(`caothudaichien_${cleanCode}`);
          this.setupConnection();
          onJoined();
        }
      });

      this.peer.on('error', (err: any) => {
        console.error('PeerJS Join Error:', err);
        this.onError?.('Phòng không tồn tại hoặc lỗi mạng.');
      });
    } catch (e) {
      console.error(e);
    }
  }

  private setupConnection() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.onConnected?.();
    });

    this.conn.on('data', (data: any) => {
      if (!data) return;
      if (data.type === 'INPUT') {
        this.onOpponentInput?.(data.inputs);
      } else if (data.type === 'STATE') {
        this.onOpponentState?.(data.state);
      } else if (data.type === 'SKILL') {
        this.onOpponentSkill?.(data.slot);
      } else if (data.type === 'JOIN') {
        this.onPlayerJoined?.(data.id, data.char);
      }
    });

    this.conn.on('close', () => {
      console.warn('Network Connection closed.');
    });
  }

  public sendInput(inputs: KeyInputState) {
    if (this.conn && this.conn.open) {
      this.conn.send({ type: 'INPUT', inputs });
    }
  }

  public sendState(state: any) {
    if (this.conn && this.conn.open) {
      this.conn.send({ type: 'STATE', state });
    }
  }

  public sendSkill(slot: SkillSlot) {
    if (this.conn && this.conn.open) {
      this.conn.send({ type: 'SKILL', slot });
    }
  }

  public disconnect() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}
