/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic rollback netcode (GGPO-style) for 1v1 online play.
 *
 * How it works
 * ------------
 * 1. Both clients run the exact same deterministic 60Hz simulation
 *    (`GameEngine.step`).
 * 2. Each client samples its own input, applies it locally after a short
 *    `inputDelay`, and forwards the input tagged with the frame it belongs to.
 * 3. When the remote input for a frame has not arrived yet we *predict* it
 *    (repeat the last known input) and keep playing immediately - zero delay
 *    feeling.
 * 4. When the real input shows up late, the simulation is rolled back to a
 *    stored snapshot, resimulated with the correct input and fast-forwarded to
 *    the current frame. Players only see the corrected result.
 *
 * Snapshots live in a ring buffer (`historyFrames`) so a rollback can never
 * reach further back than we can restore.
 */

import { EngineSnapshot, GameEngine, SIMULATION_FPS, EMPTY_INPUT, inputsEqual, normalizeInput } from './engine';
import { KeyInputState } from './types';

export interface RollbackStats {
  frame: number;
  rollbacks: number;
  lastRollbackFrames: number;
  predictedFrames: number;
  staleInputsIgnored: number;
  desyncs: number;
}

export interface RollbackOptions {
  localPlayer: 'p1' | 'p2';
  /** Frames of local input delay (0 = maximum responsiveness). */
  inputDelay?: number;
  /** How many frames of history to keep for resimulation. */
  historyFrames?: number;
  sendInput?: (frame: number, input: KeyInputState) => void;
  sendChecksum?: (frame: number, checksum: number) => void;
  onDesync?: (frame: number, local: number, remote: number) => void;
}

const DEFAULT_HISTORY = 150;

export class RollbackSession {
  public readonly engine: GameEngine;
  public readonly localPlayer: 'p1' | 'p2';
  public inputDelay: number;
  public frame = 0;

  public stats: RollbackStats = {
    frame: 0,
    rollbacks: 0,
    lastRollbackFrames: 0,
    predictedFrames: 0,
    staleInputsIgnored: 0,
    desyncs: 0,
  };

  private readonly historyFrames: number;
  private readonly sendInput?: (frame: number, input: KeyInputState) => void;
  private readonly sendChecksum?: (frame: number, checksum: number) => void;
  private readonly onDesync?: (frame: number, local: number, remote: number) => void;

  private localInputs = new Map<number, KeyInputState>();
  private remoteInputs = new Map<number, KeyInputState>();
  private predictedRemote = new Map<number, KeyInputState>();
  private snapshots = new Map<number, EngineSnapshot>();
  private checksums = new Map<number, number>();

  private lastLocalInput: KeyInputState = { ...EMPTY_INPUT };
  private lastKnownRemote: KeyInputState = { ...EMPTY_INPUT };
  private checksumCounter = 0;

  constructor(engine: GameEngine, options: RollbackOptions) {
    this.engine = engine;
    this.localPlayer = options.localPlayer;
    this.inputDelay = Math.max(0, Math.min(12, options.inputDelay ?? 2));
    this.historyFrames = Math.max(30, options.historyFrames ?? DEFAULT_HISTORY);
    this.sendInput = options.sendInput;
    this.sendChecksum = options.sendChecksum;
    this.onDesync = options.onDesync;

    // Seed the delayed input window so the very first frames are played with
    // the first sampled input instead of "nothing pressed".
    this.snapshots.set(0, engine.snapshot());
  }

  /** Number of frames currently being simulated per real second. */
  public get fps(): number {
    return SIMULATION_FPS;
  }

  /**
   * Stores + transmits the locally sampled input. The input is applied
   * `inputDelay` frames in the future, which hides most jitter without
   * introducing visible lag.
   */
  public setLocalInput(sampled: KeyInputState) {
    const input = normalizeInput(sampled);
    this.lastLocalInput = input;
    const targetFrame = this.frame + this.inputDelay;

    // Fill frames we skipped over (multiple rAF ticks collapsed into one).
    for (let f = this.frame; f < targetFrame; f++) {
      if (!this.localInputs.has(f)) this.localInputs.set(f, input);
    }
    this.localInputs.set(targetFrame, input);
    this.sendInput?.(targetFrame, input);
  }

  /** Called by the network layer whenever a remote input frame arrives. */
  public receiveRemoteInput(frame: number, input: KeyInputState) {
    if (!Number.isFinite(frame) || frame < 0) return;
    const norm = normalizeInput(input);

    const existing = this.remoteInputs.get(frame);
    if (existing && inputsEqual(existing, norm)) return;

    this.remoteInputs.set(frame, norm);
    if (frame >= this.frame - 1) {
      this.lastKnownRemote = norm;
    }

    if (frame < this.frame) {
      const predicted = this.predictedRemote.get(frame);
      if (predicted && inputsEqual(predicted, norm)) return;
      this.rollback(frame);
    }
  }

  /** Receives a remote state checksum, used only for desync diagnostics. */
  public receiveChecksum(frame: number, remoteChecksum: number) {
    const local = this.checksums.get(frame);
    if (local === undefined) return;
    if (local !== remoteChecksum) {
      this.stats.desyncs += 1;
      this.onDesync?.(frame, local, remoteChecksum);
    }
  }

  /** Simulates exactly one frame. */
  public advance() {
    const frame = this.frame;
    const local = this.localInputs.get(frame) ?? this.lastLocalInput;
    const remote = this.remoteInputs.get(frame) ?? this.predictRemote(frame);

    this.predictedRemote.set(frame, remote);
    if (!this.remoteInputs.has(frame)) this.stats.predictedFrames += 1;

    if (!this.snapshots.has(frame)) {
      this.snapshots.set(frame, this.engine.snapshot());
    }

    this.stepEngine(frame, local, remote);
    this.frame = this.engine.frame;

    this.maybeSendChecksum(frame);
    this.prune();
  }

  /** Resimulates `[fromFrame, frame)` with the now-correct remote inputs. */
  private rollback(fromFrame: number) {
    const snapshot = this.snapshots.get(fromFrame);
    if (!snapshot) {
      // Input is older than our history window: nothing we can do.
      this.stats.staleInputsIgnored += 1;
      return;
    }

    this.engine.restore(snapshot);

    for (let f = fromFrame; f < this.frame; f++) {
      const local = this.localInputs.get(f) ?? this.lastLocalInput;
      const remote =
        this.remoteInputs.get(f) ?? this.predictedRemote.get(f) ?? this.predictRemote(f);
      this.predictedRemote.set(f, remote);
      // Re-store the corrected state so a later rollback to this frame is safe.
      this.snapshots.set(f, this.engine.snapshot());
      this.stepEngine(f, local, remote);
      this.checksums.delete(f);
    }

    this.stats.rollbacks += 1;
    this.stats.lastRollbackFrames = this.frame - fromFrame;
  }

  private stepEngine(frame: number, local: KeyInputState, remote: KeyInputState) {
    const p1 = this.localPlayer === 'p1' ? local : remote;
    const p2 = this.localPlayer === 'p1' ? remote : local;
    this.engine.step(p1, p2);
    if (this.engine.frame - 1 === frame) {
      this.checksums.set(frame, this.engine.checksum());
    }
  }

  /** Remote input prediction: repeat the most recent known remote input. */
  private predictRemote(frame: number): KeyInputState {
    for (let k = frame - 1; k >= Math.max(0, frame - 12); k--) {
      const known = this.remoteInputs.get(k);
      if (known) return known;
    }
    if (!this.remoteInputs.has(frame)) {
      for (let k = frame + 1; k <= frame + 12; k++) {
        const known = this.remoteInputs.get(k);
        if (known) return known;
      }
    }
    return this.lastKnownRemote;
  }

  private maybeSendChecksum(frame: number) {
    if (!this.sendChecksum) return;
    this.checksumCounter++;
    if (this.checksumCounter % 90 !== 0) return;
    const checksum = this.checksums.get(frame);
    if (checksum !== undefined) this.sendChecksum(frame, checksum);
  }

  private prune() {
    const cutoff = this.frame - this.historyFrames;
    if (cutoff <= 0) return;

    for (const map of [
      this.snapshots,
      this.checksums,
      this.predictedRemote,
      this.remoteInputs,
    ] as Map<number, unknown>[]) {
      for (const key of map.keys()) {
        if (key < cutoff) map.delete(key);
      }
    }
    for (const key of this.localInputs.keys()) {
      if (key < Math.min(cutoff, this.frame)) this.localInputs.delete(key);
    }

    this.stats.frame = this.frame;
  }

  /**
   * How many frames this client is ahead of the newest remote input.
   * Used by the HUD to display the connection health.
   */
  public get predictionFrames(): number {
    let newest = -1;
    for (const key of this.remoteInputs.keys()) {
      if (key > newest) newest = key;
    }
    return newest < 0 ? 0 : Math.max(0, this.frame - newest);
  }
}
