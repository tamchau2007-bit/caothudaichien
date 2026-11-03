/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CharacterId, GameMode, GameSettings, KeyInputState, MapId, SkillSlot } from './game/types';
import { GameEngine } from './game/engine';
import { GameRenderer } from './game/renderer';
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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const netManagerRef = useRef<NetworkManager | null>(null);
  const remoteInputsRef = useRef<KeyInputState | null>(null);

  // App State
  const [gameState, setGameState] = useState<AppGameState>('title');
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [selectedMapId, setSelectedMapId] = useState<MapId>('nguyen_hue');
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

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    screenShake: true,
    vfxParticles: true,
    fpsLimit: 60,
    masterVolume: 0.8,
    bgmVolume: 0.5,
    sfxVolume: 0.8,
    bufferDelay: 0,
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

  // Mobile virtual inputs
  const mobileInputs = useRef<KeyInputState>({
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
  });

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  useEffect(() => {
    sound.masterVolume = settings.masterVolume;
    sound.bgmVolume = settings.bgmVolume;
    sound.sfxVolume = settings.sfxVolume;
  }, [settings]);

  // Autostart & URL Room parameter
  useEffect(() => {
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
  }, []);

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
          setGameState('paused');
          sound.stopBGM();
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
  }, [gameState, showOnlineLobby]);

  const startMatch = useCallback(
    (
      p1Selected: CharacterId,
      p2Selected: CharacterId,
      mapId: MapId,
      mode: GameMode,
      room?: string,
      host: boolean = true,
      existingNet?: NetworkManager
    ) => {
      setP1Char(p1Selected);
      setP2Char(p2Selected);
      setSelectedMapId(mapId);
      setGameMode(mode);
      setIsOnlineHost(host);

      if (mode === 'online') {
        const net = existingNet || new NetworkManager();
        netManagerRef.current = net;
        if (room) setRoomCode(room);

        net.onOpponentInput = (inputs) => {
          remoteInputsRef.current = inputs;
        };

        net.onOpponentState = (netState) => {
          if (engineRef.current) {
            engineRef.current.applyOpponentNetState(netState, host);
          }
        };

        net.onOpponentSkill = (slot: SkillSlot) => {
          if (engineRef.current) {
            const opp = host ? engineRef.current.p2 : engineRef.current.p1;
            engineRef.current.executeSkill(opp, slot, true);
          }
        };

        net.onPlayerJoined = (oppId, oppChar) => {
          if (host) {
            setP2Char(oppChar);
          } else {
            setP1Char(oppChar);
          }
        };
      }

      const engine = new GameEngine(p1Selected, p2Selected, mode, settings, mapId);

      engine.onSkillTriggered = (playerId, slot) => {
        if (mode === 'online' && netManagerRef.current) {
          const isMyFighter = (host && playerId === 'p1') || (!host && playerId === 'p2');
          if (isMyFighter) {
            netManagerRef.current.sendSkill(slot);
          }
        }
      };

      engine.onMatchEnd = (winner, quote) => {
        setMatchWinner(winner);
        setMatchQuote(quote);
        setGameState('gameover');
        sound.stopBGM();
      };
      engineRef.current = engine;

      setHudP1(engine.p1);
      setHudP2(engine.p2);
      setRoundTime(engine.roundTime);

      setGameState('playing');
      sound.startBGM();
    },
    [settings]
  );

  const restartMatch = useCallback(() => {
    startMatch(p1Char, p2Char, selectedMapId, gameMode, roomCode, isOnlineHost, netManagerRef.current || undefined);
  }, [startMatch, p1Char, p2Char, selectedMapId, gameMode, roomCode, isOnlineHost]);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let hudThrottleCounter = 0;

    const loop = (currentTime: number) => {
      const rawDt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (canvas && !rendererRef.current) {
        rendererRef.current = new GameRenderer(canvas);
      }
      const renderer = rendererRef.current;

      if (engine && renderer && (gameState === 'playing' || gameState === 'gameover')) {
        const isJump = heldKeys.current.has('KeyK') || heldKeys.current.has('Space') || mobileInputs.current.jump;
        const isJumpPressed = justPressedKeys.current.has('KeyK') || justPressedKeys.current.has('Space') || mobileInputs.current.jumpPressed;

        const localInputs: KeyInputState = {
          left: heldKeys.current.has('KeyA') || mobileInputs.current.left,
          right: heldKeys.current.has('KeyD') || mobileInputs.current.right,
          up: heldKeys.current.has('KeyW') || mobileInputs.current.up,
          down: heldKeys.current.has('KeyS') || mobileInputs.current.down,
          jump: isJump,
          dash: heldKeys.current.has('KeyL') || mobileInputs.current.dash,
          charge: heldKeys.current.has('KeyW') || mobileInputs.current.charge,
          guard: heldKeys.current.has('KeyS') || mobileInputs.current.guard,
          attackJ: heldKeys.current.has('KeyJ') || mobileInputs.current.attackJ,
          skillU: heldKeys.current.has('KeyU') || mobileInputs.current.skillU,
          skillI: heldKeys.current.has('KeyI') || mobileInputs.current.skillI,
          jumpPressed: isJumpPressed,
          dashPressed: justPressedKeys.current.has('KeyL') || mobileInputs.current.dashPressed,
          attackJPressed: justPressedKeys.current.has('KeyJ') || mobileInputs.current.attackJPressed,
          skillUPressed: justPressedKeys.current.has('KeyU') || mobileInputs.current.skillUPressed,
          skillIPressed: justPressedKeys.current.has('KeyI') || mobileInputs.current.skillIPressed,
        };

        let p1FinalInputs = localInputs;
        let p2FinalInputs: KeyInputState | undefined = undefined;

        if (gameMode === 'local2p') {
          p2FinalInputs = {
            left: heldKeys.current.has('ArrowLeft'),
            right: heldKeys.current.has('ArrowRight'),
            up: heldKeys.current.has('ArrowUp'),
            down: heldKeys.current.has('ArrowDown'),
            jump: heldKeys.current.has('Numpad0') || heldKeys.current.has('KeyM'),
            dash: heldKeys.current.has('Numpad3') || heldKeys.current.has('Period'),
            charge: heldKeys.current.has('ArrowUp'),
            guard: heldKeys.current.has('ArrowDown'),
            attackJ: heldKeys.current.has('Numpad1') || heldKeys.current.has('KeyB'),
            skillU: heldKeys.current.has('Numpad4') || heldKeys.current.has('KeyH'),
            skillI: heldKeys.current.has('Numpad5') || heldKeys.current.has('KeyY'),
            jumpPressed: justPressedKeys.current.has('Numpad0') || justPressedKeys.current.has('KeyM'),
            dashPressed: justPressedKeys.current.has('Numpad3') || justPressedKeys.current.has('Period'),
            attackJPressed: justPressedKeys.current.has('Numpad1') || justPressedKeys.current.has('KeyB'),
            skillUPressed: justPressedKeys.current.has('Numpad4') || justPressedKeys.current.has('KeyH'),
            skillIPressed: justPressedKeys.current.has('Numpad5') || justPressedKeys.current.has('KeyY'),
          };
        } else if (gameMode === 'online') {
          if (isOnlineHost) {
            p1FinalInputs = localInputs;
            p2FinalInputs = remoteInputsRef.current || undefined;
          } else {
            p2FinalInputs = localInputs;
            p1FinalInputs = remoteInputsRef.current || undefined;
          }
          netManagerRef.current?.sendInput(localInputs);
        }

        justPressedKeys.current.clear();
        mobileInputs.current.jumpPressed = false;
        mobileInputs.current.dashPressed = false;
        mobileInputs.current.attackJPressed = false;
        mobileInputs.current.skillUPressed = false;
        mobileInputs.current.skillIPressed = false;

        try {
          if (gameState === 'playing') {
            engine.update(rawDt, p1FinalInputs, p2FinalInputs);

            if (gameMode === 'online' && netManagerRef.current) {
              const myNetState = engine.getLocalNetState(isOnlineHost);
              if (myNetState) {
                netManagerRef.current.sendState(myNetState);
              }
            }
          }

          renderer.render(
            engine.p1,
            engine.p2,
            engine.hitboxes,
            engine.projectiles,
            engine.particles,
            engine.damageTexts,
            engine.screenShake,
            settings.showHitboxes,
            engine.currentMap
          );
        } catch (err) {
          console.warn('Game Loop Render Exception:', err);
        }

        hudThrottleCounter++;
        if (hudThrottleCounter % 4 === 0) {
          setHudP1({ ...engine.p1 });
          setHudP2({ ...engine.p2 });
          setRoundTime(engine.roundTime);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, gameMode, settings.showHitboxes, isOnlineHost]);

  const handleMobileInput = (key: keyof KeyInputState, isPressed: boolean) => {
    mobileInputs.current[key] = isPressed as any;
  };

  const handleMobileQuickSkill = (slot: any) => {
    if (engineRef.current && gameState === 'playing') {
      const localFighter = isOnlineHost ? engineRef.current.p1 : engineRef.current.p2;
      engineRef.current.executeSkill(localFighter, slot);
    }
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
          onSelectMode={(mode, code) => {
            setGameMode(mode);
            if (code) setRoomCode(code);
            setGameState('select');
          }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenOnlineLobby={(code) => {
            if (code) setRoomCode(code);
            setShowOnlineLobby(true);
          }}
        />
      )}

      {showOnlineLobby && (
        <OnlineLobbyModal
          initialRoomCode={roomCode}
          onStartOnlineMatch={(p1, p2, mapId, room, host, net) => {
            setShowOnlineLobby(false);
            startMatch(p1, p2, mapId, 'online', room, host, net);
          }}
          onBack={() => setShowOnlineLobby(false)}
        />
      )}

      {gameState === 'select' && !showOnlineLobby && (
        <CharacterSelect
          mode={gameMode}
          onBack={() => setGameState('title')}
          onStartFight={(p1, p2, mapId) => startMatch(p1, p2, mapId, gameMode, roomCode)}
        />
      )}

      {(gameState === 'playing' || gameState === 'paused') && hudP1 && hudP2 && (
        <InGameHUD
          p1={hudP1}
          p2={hudP2}
          roundTime={roundTime}
          mode={gameMode}
          roomCode={roomCode}
          onPause={() => {
            setGameState('paused');
            sound.stopBGM();
          }}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {(gameState === 'playing' || gameState === 'paused') && (
        <MobileControls
          onInputEvent={handleMobileInput}
          onQuickSkill={handleMobileQuickSkill}
        />
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
          onReturnTitle={() => setGameState('title')}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          mode={gameMode}
          onUpdateSettings={(newSettings) =>
            setSettings((prev) => ({ ...prev, ...newSettings }))
          }
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
