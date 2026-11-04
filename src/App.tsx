/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CharacterId, GameEvent, GameMode, GameSettings, KeyInputState, SkillSlot } from './game/types';
import { GameEngine, FRAME_TIME } from './game/engine';
import { RollbackSession } from './game/rollback';
import { GameRenderer } from './game/renderer';
import { ViewSmoothing } from './game/viewSmoothing';
import { sound } from './game/sound';
import { NetworkManager } from './game/network';
import { TitleScreen } from './components/TitleScreen';
import { CharacterSelect } from './components/CharacterSelect';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { InGameHUD } from './components/InGameHUD';
import { MobileControls } from './components/MobileControls';
import { SettingsModal } from './components/SettingsModal';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';

type AppGameState = 'title' | 'select' | 'playing' | 'paused' | 'gameover';

const MAX_STEPS_PER_TICK = 6;

interface NetInfo {
  ping: number;
  rollback: number;
  predicted: number;
  delay: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const netManagerRef = useRef<NetworkManager | null>(null);
  const sessionRef = useRef<RollbackSession | null>(null);
  const onlineStartAtRef = useRef<number>(0);
  const smootherRef = useRef<ViewSmoothing>(new ViewSmoothing());
  const delayCounter = useRef(0);
  const splashTimerRef = useRef<number | null>(null);

  // App State
  const [gameState, setGameState] = useState<AppGameState>('title');
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [selectedMapId, setSelectedMapId] = useState<string>('nguyen_hue');
  const [roomCode, setRoomCode] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [showOnlineLobby, setShowOnlineLobby] = useState(false);
  const [isOnlineHost, setIsOnlineHost] = useState(true);

  // Characters
  const [p1Char, setP1Char] = useState<CharacterId>('hoang_saigon');
  const [p2Char, setP2Char] = useState<CharacterId>('kendu');

  // Match Over Snapshot
  const [matchWinner, setMatchWinner] = useState<'p1' | 'p2' | 'draw'>('p1');
  const [matchQuote, setMatchQuote] = useState<string>('');

  // Online status
  const [netInfo, setNetInfo] = useState<NetInfo | null>(null);
  const netInfoCounter = useRef(0);
  const [netNotice, setNetNotice] = useState<string | null>(null);
  const [waitingOnlineStart, setWaitingOnlineStart] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    screenShake: true,
    vfxParticles: true,
    fpsLimit: 60,
    masterVolume: 0.8,
    bgmVolume: 0.5,
    sfxVolume: 0.8,
    bufferDelay: 2,
    showHitboxes: false,
    infiniteStamina: false,
    dummyBehavior: 'stand',
  });

  // Reactive state for HUD
  const [hudP1, setHudP1] = useState<any>(null);
  const [hudP2, setHudP2] = useState<any>(null);
  const [roundTime, setRoundTime] = useState<number>(99);

  // Input Tracking
  const heldKeys = useRef<Set<string>>(new Set());
  const justPressedKeys = useRef<Set<string>>(new Set());
  const soundDedupe = useRef<Map<string, number>>(new Map());

  // Mobile virtual inputs
  const mobileInputs = useRef<any>({
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    dash: false,
    charge: false,
    guard: false,
    attackJ: false,
    skillU: false,
    skillI: false,
    jumpPressed: false,
    dashPressed: false,
    attackJPressed: false,
    skillUPressed: false,
    skillIPressed: false,
    quickSkill: null as SkillSlot | null,
  });

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  useEffect(() => {
    sound.masterVolume = settings.masterVolume;
    sound.bgmVolume = settings.bgmVolume;
    sound.sfxVolume = settings.sfxVolume;
  }, [settings]);

  useEffect(() => {
    if (sessionRef.current) sessionRef.current.inputDelay = Math.max(0, settings.bufferDelay);
  }, [settings.bufferDelay]);

  // ------------------------------------------------------------------ helpers

  const playSplash = useCallback(() => {
    setShowSplash(true);
    if (splashTimerRef.current !== null) window.clearTimeout(splashTimerRef.current);
    splashTimerRef.current = window.setTimeout(() => setShowSplash(false), 1300);
  }, []);

  /** Pausing online would freeze one client while the other keeps playing (desync), so it is blocked. */
  const handlePause = useCallback(() => {
    if (gameMode === 'online') {
      const message = 'Không thể tạm dừng khi đang đấu online (tránh lệch trạng thái trận đấu).';
      setNetNotice(message);
      window.setTimeout(() => {
        setNetNotice((prev) => (prev === message ? null : prev));
      }, 2400);
      return;
    }
    setGameState('paused');
    sound.stopBGM();
  }, [gameMode]);

  const playEvent = useCallback((event: GameEvent) => {
    if (event.type === 'skill') {
      const now = performance.now();
      const key = `skill_${event.slot}`;
      const last = soundDedupe.current.get(key) || 0;
      if (now - last < 60) return;
      soundDedupe.current.set(key, now);
      return;
    }
    if (event.type !== 'sound') return;

    const now = performance.now();
    const last = soundDedupe.current.get(event.name) || 0;
    if (now - last < 35) return;
    soundDedupe.current.set(event.name, now);

    switch (event.name) {
      case 'dash':
        sound.playDash();
        break;
      case 'jump':
        sound.playJump();
        break;
      case 'ultimate':
        sound.playUltimate();
        break;
      case 'guardBreak':
        sound.playGuardBreak();
        break;
      case 'wallBounce':
        sound.playWallBounce();
        break;
      default:
        sound.playHit(event.name);
        break;
    }
  }, []);

  const drainEngineEvents = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const event of engine.drainEvents()) playEvent(event);
  }, [playEvent]);

  /** Starts a match (offline modes and online, using an existing network room). */
  const startMatch = useCallback(
    (
      p1Selected: CharacterId,
      p2Selected: CharacterId,
      mapId: string,
      mode: GameMode,
      room?: string,
      host: boolean = true,
      existingNet?: NetworkManager
    ) => {
      const prevNet = netManagerRef.current;
      setP1Char(p1Selected);
      setP2Char(p2Selected);
      setSelectedMapId(mapId);
      setGameMode(mode);
      setIsOnlineHost(host);
      setNetNotice(null);
      setNetInfo(null);

      let net: NetworkManager | null = null;
      if (mode === 'online') {
        net = existingNet || prevNet || new NetworkManager();
        netManagerRef.current = net;
        if (room) setRoomCode(room);
      } else if (prevNet) {
        prevNet.leave();
        netManagerRef.current = null;
      }

      const seed = net ? net.matchSeed || 1337 : (Date.now() % 2147483647) || 1337;
      const engine = new GameEngine(p1Selected, p2Selected, mode, settings, mapId, seed);

      // Match end is detected after each simulated tick (never inside a
      // rollback resimulation, which would fire for a prediction that may be
      // corrected a frame later).
      engineRef.current = engine;
      smootherRef.current.reset();

      if (mode === 'online' && net) {
        // Ensure minimum inputDelay=1 for online determinism (per our tests,
        // delay 0-1 causes immediate desync; delay 2+ keeps rollback stable).
        const effectiveDelay = Math.max(1, settings.bufferDelay);
        const session = new RollbackSession(engine, {
          localPlayer: host ? 'p1' : 'p2',
          inputDelay: effectiveDelay,
          sendInput: (frame, input) => net!.sendInput(frame, input),
          sendChecksum: (frame, checksum) => net!.sendChecksum(frame, checksum),
          onDesync: (_frame, _local, _remote, streak) => {
            if (streak <= 0) return;
            setNetNotice('Đang đồng bộ lại trạng thái trận đấu...');
            window.setTimeout(() => setNetNotice(null), 2500);
            // The host is authoritative: only the guest asks for a resync.
            if (!host && session.wantsResync(performance.now())) {
              net!.requestStateSync();
            }
          },
        });
        sessionRef.current = session;
        onlineStartAtRef.current = performance.now() + (net.startDelayMs || 1200);
        setWaitingOnlineStart(true);

        net.onRemoteInput = (frame, input) => {
          sessionRef.current?.receiveRemoteInput(frame, input);
        };
        net.onRemoteChecksum = (frame, checksum) => {
          sessionRef.current?.receiveChecksum(frame, checksum);
        };
        net.onPeerLeft = () => {
          setNetNotice('Đối thủ mất kết nối. Đang chờ họ quay lại...');
        };
        net.onSyncRequest = () => {
          const active = sessionRef.current;
          if (!host || !active) return;
          net!.sendStateSync(active.frame, JSON.stringify(active.snapshotForSync()));
        };
        net.onStateSync = (_frame, payload) => {
          try {
            const snapshot = JSON.parse(payload);
            sessionRef.current?.adoptSnapshot(snapshot);
            setNetNotice('Đã đồng bộ lại trận đấu với đối thủ.');
            window.setTimeout(() => setNetNotice(null), 1800);
          } catch (err) {
            console.warn('State sync failed:', err);
          }
        };
        net.onRoomUpdate = (players) => {
          if (players.filter((p) => p.id !== net!.peerId).length > 0) {
            setNetNotice((prev) => (prev && prev.includes('mất kết nối') ? null : prev));
          }
        };
        net.onMatchStart = (nextMapId) => {
          const hostP = net!.currentParticipants.find((p) => p.isHost);
          const guestP = net!.currentParticipants.find((p) => !p.isHost);
          if (!hostP || !guestP) return;
          startMatch(
            hostP.characterId as CharacterId,
            guestP.characterId as CharacterId,
            nextMapId || mapId,
            'online',
            net!.roomId,
            net!.isHost,
            net
          );
        };
      } else {
        sessionRef.current = null;
      }

      setHudP1({ ...engine.p1 });
      setHudP2({ ...engine.p2 });
      setRoundTime(engine.roundTime);
      setGameState('playing');
      sound.startBGM();
      if (mode !== 'online') playSplash();
    },
    [settings, playSplash]
  );

  const restartMatch = useCallback(() => {
    if (gameMode === 'online') {
      const net = netManagerRef.current;
      if (!net) return;
      setNetNotice('Đã gửi yêu cầu tái đấu, chờ đối thủ...');
      net.requestRematch();
      return;
    }
    startMatch(p1Char, p2Char, selectedMapId, gameMode);
  }, [gameMode, startMatch, p1Char, p2Char, selectedMapId]);

  // Autostart & URL Room parameter (only once: settings changes must not restart the match)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart');
    const roomParam = params.get('room') || params.get('roomCode') || params.get('code');

    if (roomParam) {
      setGameMode('online');
      setRoomCode(roomParam.toUpperCase().trim());
      setShowOnlineLobby(true);
    } else if (autostart === '1') {
      startMatch('hoang_saigon', 'kendu', 'nguyen_hue', 'ai');
    }
  }, [startMatch]);

  // Keyboard Event Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (gameState === 'title' && !showOnlineLobby && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyK')) {
        setGameState('select');
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'playing') {
          handlePause();
        } else if (gameState === 'paused') {
          setGameState('playing');
          sound.startBGM();
        }
        return;
      }

      if (e.code === 'KeyR' && (gameState === 'paused' || gameState === 'gameover')) {
        restartMatch();
        return;
      }

      if (!heldKeys.current.has(e.code)) {
        justPressedKeys.current.add(e.code);
      }
      heldKeys.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.current.delete(e.code);
    };

    const onBlur = () => {
      heldKeys.current.clear();
      justPressedKeys.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onBlur);
    };
  }, [gameState, showOnlineLobby, restartMatch, handlePause]);

  // ----------------------------------------------------------- simulation loop

  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let hudCounter = 0;
    let onlineStartAnnounced = false;

    const sampleLocalInput = (): KeyInputState => {
      const held = heldKeys.current;
      const pressed = justPressedKeys.current;
      const m = mobileInputs.current;
      const quick = m.quickSkill as SkillSlot | null;

      const quickW = quick === 'WU' || quick === 'WI' || quick === 'WJ';
      const quickS = quick === 'SU' || quick === 'SI' || quick === 'SJ';

      const inputs: KeyInputState = {
        left: held.has('KeyA') || !!m.left,
        right: held.has('KeyD') || !!m.right,
        up: held.has('KeyW') || !!m.up,
        down: held.has('KeyS') || !!m.down,
        jump: held.has('KeyK') || held.has('Space') || !!m.jump,
        charge: held.has('KeyW') || !!m.charge || quickW,
        guard: held.has('KeyS') || !!m.guard || quickS,
        jumpPressed: pressed.has('KeyK') || pressed.has('Space') || !!m.jumpPressed,
        dashPressed: pressed.has('KeyL') || !!m.dashPressed,
        attackJPressed:
          pressed.has('KeyJ') || !!m.attackJPressed || quick === 'WJ' || quick === 'SJ',
        skillUPressed:
          pressed.has('KeyU') || !!m.skillUPressed || quick === 'WU' || quick === 'SU',
        skillIPressed:
          pressed.has('KeyI') || !!m.skillIPressed || quick === 'WI' || quick === 'SI',
      };

      m.quickSkill = null;
      return inputs;
    };

    const sampleP2Input = (): KeyInputState => {
      const held = heldKeys.current;
      const pressed = justPressedKeys.current;
      return {
        left: held.has('ArrowLeft'),
        right: held.has('ArrowRight'),
        up: held.has('ArrowUp'),
        down: held.has('ArrowDown'),
        jump: held.has('Numpad0') || held.has('KeyM'),
        charge: held.has('ArrowUp'),
        guard: held.has('ArrowDown'),
        jumpPressed: pressed.has('Numpad0') || pressed.has('KeyM'),
        dashPressed: pressed.has('Numpad3') || pressed.has('Period'),
        attackJPressed: pressed.has('Numpad1') || pressed.has('KeyB'),
        skillUPressed: pressed.has('Numpad4') || pressed.has('KeyH'),
        skillIPressed: pressed.has('Numpad5') || pressed.has('KeyY'),
      };
    };

    const clearOneShotInputs = () => {
      justPressedKeys.current.clear();
      const m = mobileInputs.current;
      m.jumpPressed = false;
      m.dashPressed = false;
      m.attackJPressed = false;
      m.skillUPressed = false;
      m.skillIPressed = false;
    };

    const stripPressed = (input: KeyInputState): KeyInputState => ({
      ...input,
      jumpPressed: false,
      dashPressed: false,
      attackJPressed: false,
      skillUPressed: false,
      skillIPressed: false,
    });

    const loop = (currentTime: number) => {
      const rawDt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (canvas && !rendererRef.current) {
        rendererRef.current = new GameRenderer(canvas);
      }
      const renderer = rendererRef.current;

      if (engine && renderer) {
        const session = sessionRef.current;

        if (gameState === 'playing') {
          const localInput = sampleLocalInput();
          const p2Input = gameMode === 'local2p' ? sampleP2Input() : undefined;

          if (session && gameMode === 'online') {
            const notStartedYet = currentTime < onlineStartAtRef.current;
            if (notStartedYet) {
              accumulator = 0;
              if (!onlineStartAnnounced) {
                onlineStartAnnounced = true;
                setWaitingOnlineStart(true);
              }
            } else {
              if (onlineStartAnnounced) {
                onlineStartAnnounced = false;
                setWaitingOnlineStart(false);
                playSplash();
              }
              session.setLocalInput(localInput);
              accumulator += rawDt;
              let steps = 0;
              while (accumulator >= FRAME_TIME && steps < MAX_STEPS_PER_TICK) {
                session.advance();
                accumulator -= FRAME_TIME;
                steps++;
              }
              if (accumulator > FRAME_TIME * MAX_STEPS_PER_TICK) accumulator = 0;

              const net = netManagerRef.current;
              netInfoCounter.current++;
              if (net && netInfoCounter.current % 15 === 0) {
                setNetInfo({
                  ping: net.latencyMs,
                  rollback: session.stats.rollbacks,
                  predicted: session.predictionFrames,
                  delay: session.inputDelay,
                });
              }

              // Auto input delay: enough buffer to hide jitter, never more than
              // needed so the controls stay responsive.
              delayCounter.current++;
              if (net && delayCounter.current >= 120) {
                delayCounter.current = 0;
                const ping = net.latencyMs;
                const autoTarget = ping > 130 ? 3 : ping > 75 ? 2 : 1;
                const desired = Math.min(6, Math.max(Math.max(0, settings.bufferDelay), autoTarget));
                if (desired !== session.inputDelay) session.inputDelay = desired;
              }
            }
          } else {
            accumulator += rawDt;
            let steps = 0;
            while (accumulator >= FRAME_TIME && steps < MAX_STEPS_PER_TICK) {
              engine.step(steps === 0 ? localInput : stripPressed(localInput), p2Input);
              accumulator -= FRAME_TIME;
              steps++;
            }
            if (accumulator > FRAME_TIME * MAX_STEPS_PER_TICK) accumulator = 0;
          }

          clearOneShotInputs();
          drainEngineEvents();

          if (engine.isMatchOver && gameMode !== 'training') {
            setMatchWinner(engine.winner || 'draw');
            setMatchQuote(engine.winQuote);
            setHudP1({ ...engine.p1 });
            setHudP2({ ...engine.p2 });
            setGameState('gameover');
            sound.stopBGM();
          }
        } else {
          accumulator = 0;
          clearOneShotInputs();
        }

        try {
          const smoothDt = Math.min(0.05, rawDt);
          smootherRef.current.strength = gameMode === 'online' ? 0.46 : 0.34;
          const viewP1 = smootherRef.current.view('p1', engine.p1, smoothDt);
          const viewP2 = smootherRef.current.view('p2', engine.p2, smoothDt);

          renderer.render(
            viewP1,
            viewP2,
            engine.hitboxes,
            engine.projectiles,
            engine.particles,
            engine.damageTexts,
            engine.screenShake,
            settings.showHitboxes,
            engine.currentMap,
            {
              visualFx: engine.visualFx,
              screenFlash: engine.screenFlash,
              flashColor: engine.flashColor,
              online: gameMode === 'online',
            }
          );
        } catch (err) {
          console.warn('Game Loop Render Exception:', err);
        }

        hudCounter++;
        if (hudCounter % 4 === 0) {
          setHudP1({ ...engine.p1 });
          setHudP2({ ...engine.p2 });
          setRoundTime(engine.roundTime);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    gameState,
    gameMode,
    isOnlineHost,
    settings.showHitboxes,
    drainEngineEvents,
  ]);

  // ------------------------------------------------------------------- actions

  const handleMobileInput = (key: string, isPressed: boolean) => {
    mobileInputs.current[key] = isPressed;
  };

  const handleMobileQuickSkill = (slot: SkillSlot) => {
    if (gameState === 'playing') mobileInputs.current.quickSkill = slot;
  };

  const leaveOnline = () => {
    netManagerRef.current?.leave();
    netManagerRef.current = null;
    sessionRef.current = null;
    setNetNotice(null);
    setNetInfo(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex items-center justify-center font-sans">
      <canvas
        ref={canvasRef}
        width={1200}
        height={680}
        className="w-full h-full object-contain max-w-[100vw] max-h-[100vh]"
      />

      {gameState === 'title' && !showOnlineLobby && (
        <TitleScreen
          onSelectMode={(mode: any, code: any) => {
            setGameMode(mode);
            if (code) setRoomCode(code);
            setGameState('select');
          }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenOnlineLobby={(code: any) => {
            if (code) setRoomCode(code);
            setShowOnlineLobby(true);
          }}
        />
      )}

      {showOnlineLobby && (
        <OnlineLobbyModal
          initialRoomCode={roomCode}
          onStartOnlineMatch={(p1: any, p2: any, mapId: any, room: any, host: any, net: any) => {
            setShowOnlineLobby(false);
            startMatch(p1, p2, mapId, 'online', room, host, net);
          }}
          onBack={() => {
            setShowOnlineLobby(false);
            leaveOnline();
          }}
        />
      )}

      {gameState === 'select' && !showOnlineLobby && (
        <CharacterSelect
          mode={gameMode}
          onBack={() => setGameState('title')}
          onStartFight={(p1: any, p2: any, mapId: any) => startMatch(p1, p2, mapId, gameMode, roomCode)}
        />
      )}

      {(gameState === 'playing' || gameState === 'paused') && hudP1 && hudP2 && (
        <InGameHUD
          p1={hudP1}
          p2={hudP2}
          roundTime={roundTime}
          mode={gameMode}
          roomCode={roomCode}
          netInfo={gameMode === 'online' ? netInfo : null}
          onPause={handlePause}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {(gameState === 'playing' || gameState === 'paused') && (
        <MobileControls
          onInputEvent={handleMobileInput}
          onQuickSkill={handleMobileQuickSkill}
        />
      )}

      {/* Trạng thái mạng: gọn ở góc trái, không che giữa màn hình */}
      {(waitingOnlineStart || netNotice) && gameState === 'playing' && (
        <div className="pointer-events-none absolute left-3 top-[6.2rem] sm:top-[7.4rem] z-30 flex max-w-[15rem] flex-col gap-1.5">
          {waitingOnlineStart && (
            <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-zinc-950/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-300 backdrop-blur-md shadow-[0_0_16px_rgba(0,0,0,0.6)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
              </span>
              Đang đồng bộ
            </div>
          )}
          {netNotice && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/80 px-2 py-1 text-[9px] font-semibold leading-snug text-rose-200 backdrop-blur-md shadow-lg">
              {netNotice}
            </div>
          )}
        </div>
      )}

      {/* FIGHT splash */}
      {showSplash && gameState === 'playing' && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
          <div className="animate-splash text-center">
            <div className="bg-gradient-to-b from-amber-100 via-amber-300 to-orange-600 bg-clip-text text-[15vw] font-black italic leading-none tracking-tight text-transparent drop-shadow-[0_0_50px_rgba(251,191,36,0.55)] sm:text-[8.5vw]">
              FIGHT!
            </div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.55em] text-amber-200/70 sm:text-xs">
              {hudP1.character.name} vs {hudP2.character.name}
            </div>
          </div>
        </div>
      )}

      {gameState === 'paused' && (
        <PauseModal
          onResume={() => {
            setGameState('playing');
            sound.startBGM();
          }}
          onRestart={restartMatch}
          onOpenSettings={() => setShowSettings(true)}
          onReturnTitle={() => {
            sound.stopBGM();
            leaveOnline();
            setGameState('title');
          }}
        />
      )}

      {gameState === 'gameover' && hudP1 && hudP2 && (
        <GameOverModal
          winner={matchWinner}
          winQuote={matchQuote}
          p1={hudP1}
          p2={hudP2}
          onRestart={restartMatch}
          onReturnTitle={() => {
            leaveOnline();
            setGameState('title');
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          mode={gameMode}
          onUpdateSettings={(newSettings: any) =>
            setSettings((prev) => ({ ...prev, ...newSettings }))
          }
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
