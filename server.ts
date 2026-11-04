/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Đại Chiến Cao Thủ Online - room server.
 *
 * Responsibilities:
 *  - Serve the built SPA (production) or the Vite dev middleware (development).
 *  - Manage 1v1 rooms over WebSocket.
 *  - Relay frame-tagged inputs between the two peers so both clients can run
 *    deterministic rollback netcode. The server never simulates the match.
 *
 * Deploy: `npm run build && npm start` (Render reads PORT automatically).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt, randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, RoomParticipant, ServerMessage } from './src/game/protocol.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const IS_PROD = process.env.NODE_ENV === 'production';
const HOST = '0.0.0.0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** In production the compiled server lives in `dist-server/`, one level under the project root. */
const PROJECT_ROOT = IS_PROD ? path.resolve(__dirname, '..') : __dirname;
const DIST_DIR = path.resolve(PROJECT_ROOT, 'dist');

const MAX_PLAYERS = 2;
/** Biggest authoritative snapshot we relay (guards against abuse). */
const MAX_SYNC_PAYLOAD = 200_000;
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;
const RECONNECT_GRACE_MS = 25 * 1000;
const MATCH_START_DELAY_MS = 1600;

interface ServerPlayer {
  id: string;
  clientId: string;
  characterId: string;
  isHost: boolean;
  ready: boolean;
  ws: WebSocket | null;
  lastSeen: number;
  inGame: boolean;
}

interface RoomState {
  code: string;
  mapId: string;
  players: Map<string, ServerPlayer>;
  inGame: boolean;
  seed: number;
  createdAt: number;
  updatedAt: number;
}

const rooms = new Map<string, RoomState>();

// --------------------------------------------------------------------- helpers

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function publicPlayers(room: RoomState): RoomParticipant[] {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    isHost: p.isHost,
    characterId: p.characterId,
    ready: p.ready,
  }));
}

function send(ws: WebSocket | null, message: ServerMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(message));
  } catch {
    /* socket died mid send */
  }
}

function broadcast(room: RoomState, message: ServerMessage, exceptId?: string) {
  for (const player of room.players.values()) {
    if (player.id === exceptId) continue;
    send(player.ws, message);
  }
}

function broadcastRoomUpdate(room: RoomState) {
  broadcast(room, {
    type: 'room_update',
    players: publicPlayers(room),
    mapId: room.mapId,
    inGame: room.inGame,
  });
}

function touch(room: RoomState) {
  room.updatedAt = Date.now();
}

function findPlayerByClient(room: RoomState, clientId: string): ServerPlayer | undefined {
  return [...room.players.values()].find((p) => p.clientId === clientId);
}

/** Simple per-socket flood protection: 240 messages/second sustained. */
function allowMessage(state: { tokens: number; last: number }): boolean {
  const now = Date.now();
  const elapsed = Math.max(0, now - state.last) / 1000;
  state.tokens = Math.min(240, state.tokens + elapsed * 240);
  state.last = now;
  if (state.tokens < 1) return false;
  state.tokens -= 1;
  return true;
}

// ------------------------------------------------------------------ websocket

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

// Only claim `/ws` upgrades. Anything else (for example Vite's HMR socket in
// development) is left to the other upgrade listeners on the same server.
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url || '/', 'http://localhost');
  if (pathname !== '/ws') return;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws: WebSocket) => {
  let room: RoomState | null = null;
  let self: ServerPlayer | null = null;
  const bucket = { tokens: 120, last: Date.now() };

  const fail = (message: string, code?: string) => {
    send(ws, { type: 'error', message, code });
  };

  ws.on('message', (raw) => {
    if (!allowMessage(bucket)) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'ping') {
      send(ws, { type: 'pong', t: msg.t });
      return;
    }

    if (msg.type === 'join') {
      const characterId = typeof msg.characterId === 'string' ? msg.characterId : 'hoang_saigon';
      const clientId = typeof msg.clientId === 'string' ? msg.clientId.slice(0, 64) : randomUUID();

      // Reconnection: same clientId in an existing room takes the slot back.
      const requestedCode =
        typeof msg.roomCode === 'string' ? msg.roomCode.toUpperCase().trim() : '';
      if (requestedCode && rooms.has(requestedCode)) {
        const existingRoom = rooms.get(requestedCode)!;
        const existingPlayer = findPlayerByClient(existingRoom, clientId);
        if (existingPlayer) {
          if (existingPlayer.ws && existingPlayer.ws !== ws) {
            try {
              existingPlayer.ws.close();
            } catch {
              /* ignore */
            }
          }
          existingPlayer.ws = ws;
          existingPlayer.lastSeen = Date.now();
          room = existingRoom;
          self = existingPlayer;
          touch(existingRoom);
          send(ws, {
            type: 'joined',
            playerId: self.id,
            roomCode: room.code,
            isHost: self.isHost,
            mapId: room.mapId,
            players: publicPlayers(room),
            inGame: room.inGame,
          });
          broadcastRoomUpdate(room);
          return;
        }
      }

      // Create a room.
      if (msg.create) {
        const code = requestedCode && !rooms.has(requestedCode) ? requestedCode : generateRoomCode();
        const newRoom: RoomState = {
          code,
          mapId: typeof msg.mapId === 'string' ? msg.mapId : 'nguyen_hue',
          players: new Map(),
          inGame: false,
          seed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const player: ServerPlayer = {
          id: `pl_${randomUUID().slice(0, 8)}`,
          clientId,
          characterId,
          isHost: true,
          ready: false,
          ws,
          lastSeen: Date.now(),
          inGame: false,
        };
        newRoom.players.set(player.id, player);
        rooms.set(code, newRoom);
        room = newRoom;
        self = player;
        send(ws, {
          type: 'joined',
          playerId: player.id,
          roomCode: code,
          isHost: true,
          mapId: newRoom.mapId,
          players: publicPlayers(newRoom),
          inGame: false,
        });
        console.log(`[room] created ${code} by ${player.id}`);
        return;
      }

      // Join an existing room.
      if (!requestedCode) {
        fail('Thiếu mã phòng.', 'missing_room');
        return;
      }
      const target = rooms.get(requestedCode);
      if (!target) {
        fail('Mã phòng không tồn tại!', 'room_not_found');
        return;
      }
      if (target.inGame) {
        fail('Trận đấu trong phòng này đã bắt đầu!', 'room_in_game');
        return;
      }
      if (target.players.size >= MAX_PLAYERS) {
        fail('Phòng đấu đã đầy (tối đa 2 người)!', 'room_full');
        return;
      }

      const player: ServerPlayer = {
        id: `pl_${randomUUID().slice(0, 8)}`,
        clientId,
        characterId,
        isHost: target.players.size === 0,
        ready: false,
        ws,
        lastSeen: Date.now(),
        inGame: false,
      };
      target.players.set(player.id, player);
      room = target;
      self = player;
      touch(target);

      send(ws, {
        type: 'joined',
        playerId: player.id,
        roomCode: target.code,
        isHost: player.isHost,
        mapId: target.mapId,
        players: publicPlayers(target),
        inGame: target.inGame,
      });
      broadcastRoomUpdate(target);
      console.log(`[room] ${player.id} joined ${target.code}`);
      return;
    }

    if (!room || !self) {
      fail('Bạn chưa ở trong phòng nào.', 'not_in_room');
      return;
    }

    self.lastSeen = Date.now();
    touch(room);

    switch (msg.type) {
      case 'select_char': {
        if (typeof msg.characterId === 'string') {
          self.characterId = msg.characterId.slice(0, 32);
          broadcastRoomUpdate(room);
        }
        break;
      }
      case 'select_map': {
        if (self.isHost && typeof msg.mapId === 'string' && !room.inGame) {
          room.mapId = msg.mapId.slice(0, 48);
          broadcastRoomUpdate(room);
        }
        break;
      }
      case 'ready': {
        self.ready = !!msg.ready;
        broadcastRoomUpdate(room);
        break;
      }
      case 'start_match': {
        if (!self.isHost) {
          fail('Chỉ chủ phòng mới được bắt đầu trận đấu.', 'not_host');
          break;
        }
        if (room.players.size < MAX_PLAYERS) {
          fail('Cần đủ 2 người chơi mới có thể bắt đầu!', 'waiting_for_opponent');
          break;
        }
        room.inGame = true;
        room.seed = randomInt(1, 2 ** 30);
        for (const p of room.players.values()) p.inGame = true;
        broadcast(room, {
          type: 'match_started',
          seed: room.seed,
          startDelayMs: MATCH_START_DELAY_MS,
          mapId: room.mapId,
          players: publicPlayers(room),
        });
        console.log(`[room] ${room.code} match started (seed ${room.seed})`);
        break;
      }
      case 'rematch': {
        if (!self.isHost) {
          fail('Chỉ chủ phòng mới được yêu cầu tái đấu.', 'not_host');
          break;
        }
        if (room.players.size < MAX_PLAYERS) {
          fail('Cần đủ 2 người chơi để tái đấu!', 'waiting_for_opponent');
          break;
        }
        room.inGame = true;
        room.seed = randomInt(1, 2 ** 30);
        for (const p of room.players.values()) {
          p.inGame = true;
          p.ready = false;
        }
        broadcast(room, {
          type: 'match_started',
          seed: room.seed,
          startDelayMs: MATCH_START_DELAY_MS,
          mapId: room.mapId,
          players: publicPlayers(room),
        });
        break;
      }
      case 'input': {
        if (!room.inGame) break;
        if (!Number.isFinite(msg.frame) || msg.frame < 0 || msg.frame > 60 * 60 * 60) break;
        if (!Number.isFinite(msg.input)) break;
        broadcast(room, { type: 'input', from: self.id, frame: msg.frame, input: msg.input }, self.id);
        break;
      }
      case 'checksum': {
        if (!Number.isFinite(msg.frame) || !Number.isFinite(msg.checksum)) break;
        broadcast(
          room,
          { type: 'checksum', from: self.id, frame: msg.frame, checksum: msg.checksum },
          self.id
        );
        break;
      }
      case 'sync_request': {
        if (!room.inGame) break;
        broadcast(room, { type: 'sync_request', from: self.id }, self.id);
        break;
      }
      case 'state_sync': {
        if (!room.inGame) break;
        if (typeof msg.payload !== 'string' || msg.payload.length > MAX_SYNC_PAYLOAD) break;
        if (!Number.isFinite(msg.frame)) break;
        broadcast(
          room,
          { type: 'state_sync', from: self.id, frame: msg.frame, payload: msg.payload },
          self.id
        );
        break;
      }
      case 'leave': {
        removePlayer(room, self, false);
        room = null;
        self = null;
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (room && self) removePlayer(room, self, true);
    room = null;
    self = null;
  });

  ws.on('error', () => {
    if (room && self) removePlayer(room, self, true);
    room = null;
    self = null;
  });
});

function removePlayer(room: RoomState, player: ServerPlayer, keepSlot: boolean) {
  const wasInGame = player.inGame;

  if (keepSlot && wasInGame) {
    // Keep the slot briefly so a dropped client can reconnect mid-match.
    player.ws = null;
    player.lastSeen = Date.now();
    const deadline = Date.now() + RECONNECT_GRACE_MS;
    setTimeout(() => {
      const current = rooms.get(room.code);
      if (!current) return;
      const entry = current.players.get(player.id);
      if (!entry || entry.ws) return;
      if (Date.now() < deadline) return;
      current.players.delete(player.id);
      broadcast(current, { type: 'peer_left', playerId: player.id });
      promoteHost(current);
      broadcastRoomUpdate(current);
      if (current.players.size === 0) rooms.delete(current.code);
    }, RECONNECT_GRACE_MS + 200);
  } else {
    room.players.delete(player.id);
    promoteHost(room);
    broadcastRoomUpdate(room);
    if (room.players.size === 0) rooms.delete(room.code);
  }

  if (wasInGame) {
    broadcast(room, { type: 'peer_left', playerId: player.id });
  }
  touch(room);
  console.log(`[room] ${player.id} left ${room.code}`);
}

function promoteHost(room: RoomState) {
  const remaining = [...room.players.values()];
  if (remaining.length === 0) return;
  if (!remaining.some((p) => p.isHost)) remaining[0].isHost = true;
}

// Expire abandoned rooms so memory does not grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const alive = [...room.players.values()].some((p) => p.ws);
    const idleTooLong = now - room.updatedAt > ROOM_IDLE_TTL_MS;
    if (!alive && (idleTooLong || now - room.updatedAt > RECONNECT_GRACE_MS)) {
      rooms.delete(code);
      continue;
    }
    if (idleTooLong) rooms.delete(code);
  }
}, 30_000).unref?.();

// --------------------------------------------------------------- dev / static

type NextFn = (err?: unknown) => void;
type Middleware = (req: http.IncomingMessage, res: http.ServerResponse, next: NextFn) => void;

let viteMiddleware: Middleware | null = null;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  const decoded = decodeURIComponent(url.pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(DIST_DIR, relative);

  if (!resolved.startsWith(DIST_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  const filePath = fs.existsSync(resolved) && fs.statSync(resolved).isFile()
    ? resolved
    : path.join(DIST_DIR, 'index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Không tìm thấy trang. Hãy chạy `npm run build` trước khi khởi động server.');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  });
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        rooms: rooms.size,
        players: [...rooms.values()].reduce((sum, r) => sum + r.players.size, 0),
        uptime: Math.round(process.uptime()),
        version: '2.0.0',
      })
    );
    return;
  }

  if (url.pathname === '/api/rooms' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const code = generateRoomCode();
    rooms.set(code, {
      code,
      mapId: typeof body.mapId === 'string' ? body.mapId : 'nguyen_hue',
      players: new Map(),
      inGame: false,
      seed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, roomCode: code }));
    return;
  }

  if (url.pathname.startsWith('/api/rooms/') && req.method === 'GET') {
    const code = url.pathname.split('/').pop()!.toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Phòng không tồn tại' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        roomCode: room.code,
        mapId: room.mapId,
        inGame: room.inGame,
        players: publicPlayers(room),
      })
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'API không tồn tại' }));
    return;
  }

  if (viteMiddleware) {
    viteMiddleware(req, res, () => serveStatic(req, res));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  serveStatic(req, res);
};

server.on('request', (req, res) => {
  requestHandler(req, res).catch((err) => {
    console.error('Request failed:', err);
    if (!res.headersSent) res.writeHead(500);
    res.end('Internal Server Error');
  });
});

async function start() {
  if (!IS_PROD) {
    try {
      const { createServer } = await import('vite');
      // Extra dev hostnames (for example a cloud preview URL) are supplied via
      // PREVIEW_HOSTS so no hostname is ever hard-coded in the repo.
      const allowedHosts = (process.env.PREVIEW_HOSTS || '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean);

      const vite = await createServer({
        server: {
          middlewareMode: true,
          hmr: { server },
          ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
        },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares as unknown as Middleware;
      console.log('[dev] Vite middleware đã sẵn sàng (HMR bật)');
    } catch (err) {
      console.warn('[dev] Không khởi động được Vite middleware:', err);
    }
  }

  server.listen(PORT, HOST, () => {
    console.log(
      `[Đại Chiến Cao Thủ Online] Server chạy tại http://${HOST}:${PORT} (${IS_PROD ? 'production' : 'development'})`
    );
  });
}

start();
