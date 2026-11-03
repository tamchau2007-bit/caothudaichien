/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// In-memory Room State for Online Multiplayer
interface RoomPlayer {
  id: string;
  isHost: boolean;
  characterId: string;
  ready: boolean;
  ws?: WebSocket;
}

interface RoomState {
  code: string;
  mapId: string;
  players: Record<string, RoomPlayer>;
  inGame: boolean;
  createdAt: number;
}

const rooms = new Map<string, RoomState>();

// Helper to generate 4-letter room code (e.g. BUEA, VOVI, LONG)
function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

// REST API for Rooms
app.post('/api/rooms', (req, res) => {
  const { hostChar = 'hoang_saigon', mapId = 'nguyen_hue' } = req.body || {};
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const room: RoomState = {
    code,
    mapId,
    players: {},
    inGame: false,
    createdAt: Date.now(),
  };

  rooms.set(code, room);
  res.json({ success: true, roomCode: code, mapId });
});

app.get('/api/rooms/:code', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ success: false, message: 'Phòng không tồn tại' });
  }

  const playerList = Object.values(room.players).map((p) => ({
    id: p.id,
    isHost: p.isHost,
    characterId: p.characterId,
    ready: p.ready,
  }));

  res.json({
    success: true,
    roomCode: room.code,
    mapId: room.mapId,
    inGame: room.inGame,
    players: playerList,
  });
});

// WebSocket Server attached to the same HTTP server on /ws
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const hostHeader = req.headers.host || 'localhost';
  const url = new URL(req.url || '', `http://${hostHeader}`);

  const rawCode =
    url.searchParams.get('roomId') ||
    url.searchParams.get('roomCode') ||
    url.searchParams.get('code') ||
    '';
  const roomCode = rawCode.toUpperCase().trim();

  const peerId =
    url.searchParams.get('peerId') ||
    `player_${Math.random().toString(36).substring(2, 7)}`;
  const isHostReq = url.searchParams.get('isHost') === 'true';
  const charId = url.searchParams.get('characterId') || 'hoang_saigon';

  let currentRoom = rooms.get(roomCode);

  if (!currentRoom) {
    if (isHostReq && roomCode) {
      currentRoom = {
        code: roomCode,
        mapId: 'nguyen_hue',
        players: {},
        inGame: false,
        createdAt: Date.now(),
      };
      rooms.set(roomCode, currentRoom);
    } else {
      ws.send(
        JSON.stringify({ type: 'error', message: 'Mã phòng không tồn tại!' })
      );
      ws.close();
      return;
    }
  }

  const existingPlayerKeys = Object.keys(currentRoom.players);
  if (!currentRoom.players[peerId] && existingPlayerKeys.length >= 2) {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'Phòng đấu đã đầy (Tối đa 2 người)!',
      })
    );
    ws.close();
    return;
  }

  const isHost = isHostReq || existingPlayerKeys.length === 0;
  currentRoom.players[peerId] = {
    id: peerId,
    isHost,
    characterId: charId,
    ready: false,
    ws,
  };

  const broadcast = (data: any, excludeSelf: boolean = false) => {
    const raw = JSON.stringify(data);
    if (!currentRoom) return;
    for (const pid in currentRoom.players) {
      if (excludeSelf && pid === peerId) continue;
      const targetWs = currentRoom.players[pid].ws;
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(raw);
      }
    }
  };

  const sendRoomUpdate = () => {
    if (!currentRoom) return;
    const playerList = Object.values(currentRoom.players).map((p) => ({
      id: p.id,
      isHost: p.isHost,
      characterId: p.characterId,
      ready: p.ready,
    }));
    broadcast({
      type: 'room_update',
      roomCode: currentRoom.code,
      mapId: currentRoom.mapId,
      players: playerList,
      inGame: currentRoom.inGame,
    });
  };

  sendRoomUpdate();

  ws.on('message', (message: Buffer | string) => {
    try {
      const data = JSON.parse(message.toString());
      if (!currentRoom) return;

      if (data.type === 'select_char') {
        if (currentRoom.players[peerId]) {
          currentRoom.players[peerId].characterId = data.characterId;
          sendRoomUpdate();
        }
      } else if (data.type === 'select_map') {
        if (currentRoom.players[peerId]?.isHost) {
          currentRoom.mapId = data.mapId;
          sendRoomUpdate();
        }
      } else if (data.type === 'ready') {
        if (currentRoom.players[peerId]) {
          currentRoom.players[peerId].ready = data.ready;
          sendRoomUpdate();
        }
      } else if (data.type === 'start_match') {
        if (currentRoom.players[peerId]?.isHost) {
          currentRoom.inGame = true;
          broadcast({
            type: 'match_started',
            roomCode: currentRoom.code,
            mapId: currentRoom.mapId,
            players: Object.values(currentRoom.players).map((p) => ({
              id: p.id,
              isHost: p.isHost,
              characterId: p.characterId,
            })),
          });
        }
      } else if (data.type === 'input' || data.type === 'state_sync') {
        broadcast(data, true);
      }
    } catch (err) {
      // Bỏ qua gói tin hỏng
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentRoom.players[peerId]) {
      delete currentRoom.players[peerId];
      if (Object.keys(currentRoom.players).length === 0) {
        rooms.delete(currentRoom.code);
      } else {
        const remaining = Object.values(currentRoom.players);
        if (remaining.length > 0 && !remaining.some((p) => p.isHost)) {
          remaining[0].isHost = true;
        }
        sendRoomUpdate();
      }
    }
  });
});

// Vite Middleware cho Dev / Server Static cho Prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Đại Chiến Cao Thủ Online] Server running on port ${PORT}`);
  });
}

startServer();
