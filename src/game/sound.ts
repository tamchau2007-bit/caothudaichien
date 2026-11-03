/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  public masterVolume: number = 0.8;
  public sfxVolume: number = 0.8;
  public bgmVolume: number = 0.5;
  public isMuted: boolean = false;
  private bgmInterval: number | null = null;
  private isBgmPlaying: boolean = false;
  private beatStep: number = 0;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playHit(type: 'light' | 'heavy' | 'blocked' | 'slash' | 'crit') {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const effectiveVol = this.masterVolume * this.sfxVolume;
    gain.connect(this.ctx.destination);

    if (type === 'light') {
      // Crisp mid punch snap
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

      gain.gain.setValueAtTime(0.4 * effectiveVol, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.08);
    } else if (type === 'heavy' || type === 'crit') {
      // 3-layer punch: Sub-bass 60Hz + Punch snap + Noise burst
      // Layer 1: Sub-bass boom
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(type === 'crit' ? 95 : 75, t);
      subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.22);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.9 * effectiveVol, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(t);
      subOsc.stop(t + 0.25);

      // Layer 2: Noise burst
      const bufferSize = this.ctx.sampleRate * 0.1;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.Q.setValueAtTime(3, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5 * effectiveVol, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      whiteNoise.start(t);
      whiteNoise.stop(t + 0.1);
    } else if (type === 'blocked') {
      // Dull metallic clang
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(350, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);

      gain.gain.setValueAtTime(0.35 * effectiveVol, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (type === 'slash') {
      // Swish cut
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.14);

      gain.gain.setValueAtTime(0.3 * effectiveVol, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.14);
    }
  }

  public playGuardBreak() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7 * this.masterVolume * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playDash() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35 * this.masterVolume * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playJump() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25 * this.masterVolume * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playUltimate() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Massive bass drop + power chord
    [55, 110, 165].forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.6);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4 * this.masterVolume * this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  public playWallBounce() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6 * this.masterVolume * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /**
   * Procedural synth battle background music with upbeat kick, snare, bassline
   */
  public startBGM() {
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    this.beatStep = 0;

    const stepDurationMs = 145; // ~103 BPM 16th notes
    this.bgmInterval = window.setInterval(() => {
      if (this.isMuted || this.bgmVolume <= 0) return;
      this.initContext();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const vol = this.masterVolume * this.bgmVolume * 0.3;
      const step = this.beatStep % 16;
      this.beatStep++;

      // Kick drum on steps 0, 4, 8, 12
      if (step === 0 || step === 4 || step === 8 || step === 12) {
        const kick = this.ctx.createOscillator();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(130, t);
        kick.frequency.exponentialRampToValueAtTime(38, t + 0.08);

        const kickGain = this.ctx.createGain();
        kickGain.gain.setValueAtTime(vol * 0.9, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        kick.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kick.start(t);
        kick.stop(t + 0.09);
      }

      // Snare drum on steps 4, 12
      if (step === 4 || step === 12) {
        const snareOsc = this.ctx.createOscillator();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(180, t);
        snareOsc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

        const snareGain = this.ctx.createGain();
        snareGain.gain.setValueAtTime(vol * 0.5, t);
        snareGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        snareOsc.connect(snareGain);
        snareGain.connect(this.ctx.destination);
        snareOsc.start(t);
        snareOsc.stop(t + 0.06);
      }

      // Bassline arpeggio (C minor / martial pentatonic: C, Eb, F, G, Bb)
      const bassNotes = [65.41, 77.78, 87.31, 98.0, 116.54, 87.31, 98.0, 65.41];
      if (step % 2 === 0) {
        const noteIdx = Math.floor(step / 2) % bassNotes.length;
        const bass = this.ctx.createOscillator();
        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(bassNotes[noteIdx], t);

        const bassFilter = this.ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(320, t);

        const bassGain = this.ctx.createGain();
        bassGain.gain.setValueAtTime(vol * 0.45, t);
        bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        bass.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bass.start(t);
        bass.stop(t + 0.12);
      }
    }, stepDurationMs);
  }

  public stopBGM() {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.isBgmPlaying = false;
  }
}

export const sound = new SoundEngine();
