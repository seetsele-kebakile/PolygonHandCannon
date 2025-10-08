// Main application entry point
import { WebGPURenderer } from './renderer/webgpu-renderer.js';
import { GameState } from './game/game-state.js';
import { ShapeSpawner } from './game/shape-spawner.js';
import { HandTracker } from './input/hand-tracker.js';
import { VoiceRecognition } from './input/voice-recognition.js';
import { ParticleSystem } from './effects/particle-system.js';

class PolygonHandCannon {
  constructor() {
    this.canvas = document.getElementById('gpuCanvas');
    this.renderer = null;
    this.gameState = null;
    this.shapeSpawner = null;
    this.handTracker = null;
    this.voiceRecognition = null;
    this.particleSystem = null;
    this.isInitialized = false;
    this.lastTime = performance.now();
    this.crosshair = document.getElementById('crosshair');
    this.handIndicator = document.getElementById('handIndicator');
    this.targetedShape = null;
  }

  async init() {
    try {
      this.showStatus('Initializing WebGPU...');

      this.renderer = new WebGPURenderer(this.canvas);
      await this.renderer.init();

      this.gameState = new GameState();
      this.shapeSpawner = new ShapeSpawner(this.renderer);
      this.particleSystem = new ParticleSystem(this.renderer);

      this.showStatus('Initializing hand tracking...');
      this.handTracker = new HandTracker();
      await this.handTracker.init();

      this.showStatus('Initializing voice recognition...');
      this.voiceRecognition = new VoiceRecognition();
      await this.voiceRecognition.init();

      this.setupEventListeners();
      this.isInitialized = true;
      this.showStatus('Ready! Click START GAME');

    } catch (error) {
      console.error('Initialization error:', error);
      this.showStatus(`Error: ${error.message}`);
    }
  }

  setupEventListeners() {
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');

    startBtn.addEventListener('click', () => this.startGame());
    restartBtn.addEventListener('click', () => this.restartGame());

    this.voiceRecognition.on('command', (word) => this.handleVoiceCommand(word));
  }

  async startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('status').classList.add('hidden');

    await this.handTracker.start();
    await this.voiceRecognition.start();

    this.gameState.reset();
    this.shapeSpawner.reset();
    this.particleSystem.reset();

    this.gameLoop();
  }

  restartGame() {
    document.getElementById('gameOver').classList.remove('show');
    this.startGame();
  }

  gameLoop() {
    if (!this.isInitialized || this.gameState.isGameOver) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Update hand tracking crosshair
    const handPos = this.handTracker.getPointerPosition();
    const handDetected = this.handTracker.isHandDetected();

    // Update hand status indicator
    const handStatus = document.getElementById('handStatus');
    if (handDetected) {
      handStatus.textContent = 'HAND DETECTED';
      handStatus.classList.add('detected');
      handStatus.classList.remove('not-detected');
    } else {
      handStatus.textContent = 'NO HAND DETECTED';
      handStatus.classList.remove('detected');
      handStatus.classList.add('not-detected');
    }

    if (handPos) {
      this.crosshair.style.left = `${handPos.x}px`;
      this.crosshair.style.top = `${handPos.y}px`;
      this.handIndicator.style.left = `${handPos.x}px`;
      this.handIndicator.style.top = `${handPos.y}px`;
      this.handIndicator.style.opacity = '0.6';
    } else {
      this.handIndicator.style.opacity = '0';
    }

    // Spawn new shapes
    this.shapeSpawner.update(deltaTime, this.gameState.wave);

    // Update all active shapes
    const shapes = this.shapeSpawner.getShapes();
    shapes.forEach(shape => {
      shape.position[2] += shape.velocity * deltaTime;

      if (shape.position[2] > 2) {
        this.gameOver();
      }
    });

    // Perform raycasting to find targeted shape
    this.targetedShape = this.performRaycast(handPos);

    // Update crosshair appearance
    if (this.targetedShape) {
      this.crosshair.classList.add('targeting');
    } else {
      this.crosshair.classList.remove('targeting');
    }

    // Update particle effects
    this.particleSystem.update(deltaTime);

    // Render scene
    this.renderer.render({
      shapes: this.shapeSpawner.getShapes(),
      particles: this.particleSystem.getParticles(),
      targetedShape: this.targetedShape,
      deltaTime
    });

    // Update HUD
    this.updateHUD();

    requestAnimationFrame(() => this.gameLoop());
  }

  performRaycast(handPos) {
    if (!handPos) return null;

    const shapes = this.shapeSpawner.getShapes();
    const projectedShapes = shapes.map(shape => {
      const projected = this.renderer.projectToScreen(shape.position);
      return { shape, projected };
    });

    let closestShape = null;
    let minDistance = 60;

    projectedShapes.forEach(({ shape, projected }) => {
      if (projected) {
        const dx = projected.x - handPos.x;
        const dy = projected.y - handPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          closestShape = shape;
        }
      }
    });

    return closestShape;
  }

  handleVoiceCommand(word) {
    const feedback = document.getElementById('voiceFeedback');
    feedback.textContent = `"${word}"`;
    feedback.classList.add('show');

    setTimeout(() => {
      feedback.classList.remove('show');
    }, 1000);

    if (!this.targetedShape) {
      feedback.classList.add('incorrect');
      feedback.classList.remove('correct');
      return;
    }

    if (word.toLowerCase() === this.targetedShape.type.toLowerCase()) {
      feedback.classList.add('correct');
      feedback.classList.remove('incorrect');

      this.destroyShape(this.targetedShape);
      this.gameState.addScore(100);
    } else {
      feedback.classList.add('incorrect');
      feedback.classList.remove('correct');
    }
  }

  destroyShape(shape) {
    this.particleSystem.createExplosion(shape.position, shape.color);
    this.shapeSpawner.removeShape(shape);
  }

  updateHUD() {
    document.getElementById('score').textContent = this.gameState.score;
    document.getElementById('wave').textContent = this.gameState.wave;
    document.getElementById('shapeCount').textContent = 
      this.shapeSpawner.getShapes().length;
  }

  gameOver() {
    this.gameState.isGameOver = true;

    document.getElementById('finalScore').textContent = this.gameState.score;
    document.getElementById('gameOver').classList.add('show');

    this.handTracker.stop();
    this.voiceRecognition.stop();
  }

  showStatus(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }
}

const game = new PolygonHandCannon();
game.init();