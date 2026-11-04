/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The simulation runs at a fixed 60Hz while screens draw at 60/120/144Hz, and
 * rollback corrections can teleport a fighter backwards for a single frame.
 * Rendering the raw simulation state therefore looks steppy online.
 *
 * This keeps a separate, purely visual position that eases toward the simulated
 * one, so motion stays smooth without ever changing gameplay (hit detection and
 * hurtboxes still use the simulated coordinates).
 */

import { FighterEntity } from './types';

interface SmoothState {
  x: number;
  y: number;
  initialized: boolean;
}

export class ViewSmoothing {
  private states: Record<'p1' | 'p2', SmoothState> = {
    p1: { x: 0, y: 0, initialized: false },
    p2: { x: 0, y: 0, initialized: false },
  };

  /** 0 = hard snap to simulation, 1 = never move. */
  public strength = 0.42;
  /** Larger jumps than this are teleports (spawn, respawn) and must snap. */
  public snapDistance = 110;

  public reset() {
    this.states.p1.initialized = false;
    this.states.p2.initialized = false;
  }

  private smooth(id: 'p1' | 'p2', f: FighterEntity, dt: number): SmoothState {
    const state = this.states[id];
    if (!state.initialized) {
      state.x = f.x;
      state.y = f.y;
      state.initialized = true;
      return state;
    }

    const dx = f.x - state.x;
    const dy = f.y - state.y;

    if (Math.abs(dx) > this.snapDistance || Math.abs(dy) > this.snapDistance) {
      state.x = f.x;
      state.y = f.y;
      return state;
    }

    // Frame-rate independent exponential damping.
    const frames = Math.max(1, Math.min(6, dt * 60));
    const t = 1 - Math.pow(1 - this.strength, frames);
    state.x += dx * t;
    state.y += dy * t;

    return state;
  }

  /** Returns a render-only copy of the fighter with the smoothed position. */
  public view(
    id: 'p1' | 'p2',
    f: FighterEntity,
    dt: number
  ): FighterEntity {
    const state = this.smooth(id, f, dt);
    if (Math.abs(state.x - f.x) < 0.15 && Math.abs(state.y - f.y) < 0.15) {
      return f;
    }
    return { ...f, x: state.x, y: state.y };
  }
}
