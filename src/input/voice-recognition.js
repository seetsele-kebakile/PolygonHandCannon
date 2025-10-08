export class VoiceRecognition {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.listeners = new Map();
    this.validCommands = ['cube', 'sphere', 'torus', 'pyramid'];
  }

  async init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const word = event.results[last][0].transcript.trim().toLowerCase();

      if (this.validCommands.includes(word)) {
        this.emit('command', word);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'no-speech') {
        if (this.isListening) {
          this.recognition.start();
        }
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        this.recognition.start();
      }
    };
  }

  async start() {
    if (this.isListening) return;
    
    try {
      this.recognition.start();
      this.isListening = true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
    }
  }

  stop() {
    if (!this.isListening) return;
    
    this.isListening = false;
    this.recognition.stop();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  destroy() {
    this.stop();
    this.listeners.clear();
  }
}