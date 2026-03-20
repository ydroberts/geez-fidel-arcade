// Audio engine for playing Ge'ez syllable sounds
// Uses HTMLAudioElement for syllable playback (simpler, more reliable)
// Uses Web Audio API for synthesized SFX (shoot, hit, wrong, etc.)

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private audioBasePath: string = '/audio/';
  private audioCache: Map<string, HTMLAudioElement> = new Map();

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  // Preload an audio file into cache
  private preload(char: string): HTMLAudioElement {
    const cached = this.audioCache.get(char);
    if (cached) return cached;

    const url = `${this.audioBasePath}${encodeURIComponent(char)}.mp3`;
    const audio = new Audio(url);
    audio.preload = 'auto';
    this.audioCache.set(char, audio);
    return audio;
  }

  // Play a Ge'ez syllable audio file
  async play(char: string, _romanized: string): Promise<void> {
    try {
      const audio = this.preload(char);
      // Clone the audio element so overlapping plays work
      const clone = audio.cloneNode(true) as HTMLAudioElement;
      clone.volume = 1.0;
      await clone.play();
    } catch {
      // Silently fail — no fallback to speech synthesis
    }
  }

  // Preload a set of characters (call during level setup)
  preloadChars(chars: string[]): void {
    chars.forEach(char => this.preload(char));
  }

  // --- Synthesized SFX ---

  playShoot(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playHit(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playWrong(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  playLevelComplete(): void {
    const ctx = this.getContext();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  }

  playGameOver(): void {
    const ctx = this.getContext();
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.4);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.4);
    });
  }
}

export const audioEngine = new AudioEngine();
