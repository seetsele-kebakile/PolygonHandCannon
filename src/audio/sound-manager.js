export class SoundManager {
  constructor() {
    this.audioContext = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn('Web Audio API not supported');
      return;
    }
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.initialized = true;
  }

  playShootSound() {
    if (!this.audioContext) {
      this.init();
      if (!this.audioContext) return;
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;
    const duration = 0.15;
    
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 4000;

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(400, now);
    osc1.frequency.exponentialRampToValueAtTime(300, now + duration);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(600, now);
    osc2.frequency.exponentialRampToValueAtTime(200, now + duration);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(filter);
    filter.connect(this.audioContext.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }
}