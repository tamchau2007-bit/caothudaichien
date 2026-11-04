/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Small deterministic PRNG (mulberry32). The simulation must never call
 * Math.random(): both machines in an online match have to produce identical
 * results from identical inputs, including for AI decisions.
 */
export class Rng {
  private s: number;

  constructor(seed: number = 0x9e3779b9) {
    this.s = (seed >>> 0) || 1;
  }

  public next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public chance(p: number): boolean {
    return this.next() < p;
  }

  public get state(): number {
    return this.s;
  }

  public set state(value: number) {
    this.s = (value >>> 0) || 1;
  }

  /** Stable integer hash of a frame's gameplay state (desync detection). */
  public static hashNumbers(values: number[]): number {
    let h = 0x811c9dc5;
    for (const v of values) {
      const n = Number.isFinite(v) ? Math.round(v * 1000) : 0;
      h ^= n & 0xffffffff;
      h = Math.imul(h, 0x01000193);
      h ^= (n >> 16) & 0xffff;
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
}
