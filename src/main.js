// src/main.js

// Main application entry point
import { WebGPURenderer } from './renderer/webgpu-renderer.js';
import { GameState } from './game/game-state.js';
import { ShapeSpawner } from './game/shape-spawner.js';
import { HandTracker } from './input/hand-tracker.js';
// The VoiceRecognition import has been removed
import { ParticleSystem } from './effects/particle-system.js';

class PolygonHandCannon {
  constructor() {
    this.canvas = document.getElementById('gpuCanvas');
    this.renderer = null;
    this.gameState = null;
    this.shapeSpawner = null;
    this.handTracker = null;
    // voiceRecognition property has been removed
    this.particleSystem = null;
    this.isInitialized = false;
    this.lastTime = performance.now();
    this.crosshair = document.getElementById('crosshair');
    this.handIndicator = document.getElementById('handIndicator');
    this.targetedShape = null;
    this.currentGameState = 'initializing'; // initializing, ready, playing, gameOver
    this.startButton = document.getElementById('startBtn');
    this.isHoveringStartButton = false;
    this.isHoveringRestartButton = false;
    this.canShoot = true; 
    this.canActivateMenu = true; // New cooldown for menu actions
  }

  async init() {
    try {
      // Initialize hand tracking
      this.showStatus('Initializing hand tracking...');
      this.handTracker = new HandTracker();
      await this.handTracker.init();
      await this.handTracker.start();

      // Start tracking loop for menu and game
      this.masterTrackingLoop();

      // Initialize WebGPU
      this.showStatus('Initializing WebGPU...');
      this.renderer = new WebGPURenderer(this.canvas);
      await this.renderer.init();

      this.gameState = new GameState();
      this.shapeSpawner = new ShapeSpawner(this.renderer);
      this.particleSystem = new ParticleSystem(this.renderer);

      this.setupEventListeners();
      this.isInitialized = true;
      this.currentGameState = 'ready';
      
      document.getElementById('status').classList.add('hidden');
      this.showStatus('Ready! Aim and make a shooting gesture to START');

    } catch (error) {
      console.error('Initialization error:', error);
      this.showStatus(`Error: ${error.message}`);
    }
  }
  
  // Renamed from startMenuTracking to reflect it's always running
  masterTrackingLoop() {
    const loop = () => {
      const handPos = this.handTracker.getPointerPosition();
      const handDetected = this.handTracker.isHandDetected();
      const isShooting = this.handTracker.getIsShooting();

      // Update UI elements based on hand tracking
      this.updateHandUI(handPos, handDetected);

      // Handle menu interactions
      if (this.currentGameState === 'ready' || this.currentGameState === 'gameOver') {
        this.handleMenuInput(handPos, isShooting);
      }
      
      // Reset menu cooldown when gesture is released
      if (!isShooting) {
          this.canActivateMenu = true;
      }

      requestAnimationFrame(loop);
    };

    loop();
  }
  
  updateHandUI(handPos, handDetected) {
      // Always update hand status indicator
      const handStatus = document.getElementById('handStatus');
      if (handStatus) {
        if (handDetected) {
          handStatus.textContent = 'HAND DETECTED';
          handStatus.classList.add('detected');
          handStatus.classList.remove('not-detected');
        } else {
          handStatus.textContent = 'NO HAND DETECTED';
          handStatus.classList.remove('detected');
          handStatus.classList.add('not-detected');
        }
      }

      // Always update crosshair and hand indicator
      if (handPos) {
        this.crosshair.style.left = `${handPos.x}px`;
        this.crosshair.style.top = `${handPos.y}px`;
        this.handIndicator.style.left = `${handPos.x}px`;
        this.handIndicator.style.top = `${handPos.y}px`;
        this.handIndicator.style.opacity = '0.8';
      } else {
        this.handIndicator.style.opacity = '0';
      }
  }

  handleMenuInput(handPos, isShooting) {
      if (!handPos) return;

      // Check for start button interaction
      if (this.currentGameState === 'ready') {
          const rect = this.startButton.getBoundingClientRect();
          this.isHoveringStartButton = (
            handPos.x >= rect.left && handPos.x <= rect.right &&
            handPos.y >= rect.top && handPos.y <= rect.bottom
          );

          if (this.isHoveringStartButton) {
            this.crosshair.classList.add('targeting');
            this.startButton.classList.add('targeted');
            // Check for gesture to start game
            if (isShooting && this.canActivateMenu) {
                this.startGame();
                this.canActivateMenu = false; // Prevent re-trigger
            }
          } else {
            this.crosshair.classList.remove('targeting');
            this.startButton.classList.remove('targeted');
          }
      }

      // Check for restart button interaction
      if (this.currentGameState === 'gameOver') {
          const restartButton = document.getElementById('restartBtn');
          const rect = restartButton.getBoundingClientRect();
          this.isHoveringRestartButton = (
            handPos.x >= rect.left && handPos.x <= rect.right &&
            handPos.y >= rect.top && handPos.y <= rect.bottom
          );

          if (this.isHoveringRestartButton) {
            this.crosshair.classList.add('targeting');
            restartButton.classList.add('targeted');
            // Check for gesture to restart game
            if (isShooting && this.canActivateMenu) {
                this.restartGame();
                this.canActivateMenu = false; // Prevent re-trigger
            }
          } else {
            this.crosshair.classList.remove('targeting');
            restartButton.classList.remove('targeted');
          }
      }
  }

  setupEventListeners() {
    // Mouse clicks are kept as a fallback input method
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
  }

  // The entire handleVoiceCommand function has been removed

  async startGame() {
    if (this.currentGameState !== 'ready') return; // Prevent starting multiple times

    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('status').classList.add('hidden');

    this.currentGameState = 'playing';
    this.gameState.reset();
    this.shapeSpawner.reset();
    this.particleSystem.reset();
    this.canShoot = true;

    this.gameLoop();
  }

  restartGame() {
    document.getElementById('gameOver').classList.remove('show');
    this.currentGameState = 'ready';
    document.getElementById('startScreen').classList.remove('hidden');
  }

  gameLoop() {
    if (this.gameState.isGameOver) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    const handPos = this.handTracker.getPointerPosition();
    const isShooting = this.handTracker.getIsShooting();

    this.shapeSpawner.update(deltaTime, this.gameState.wave);

    const shapes = this.shapeSpawner.getShapes();
    shapes.forEach(shape => {
      shape.position[2] += shape.velocity * deltaTime;
      if (shape.position[2] > 2) {
        this.gameOver();
      }
    });

    this.targetedShape = this.performRaycast(handPos);

    if (isShooting && this.canShoot && this.targetedShape) {
      this.destroyShape(this.targetedShape);
      this.gameState.addScore(100);
      this.canShoot = false;
    }

    if (!isShooting) {
      this.canShoot = true;
    }

    if (this.targetedShape) {
      this.crosshair.classList.add('targeting');
    } else {
      this.crosshair.classList.remove('targeting');
    }

    this.particleSystem.update(deltaTime);

    this.renderer.render({
      shapes: this.shapeSpawner.getShapes(),
      particles: this.particleSystem.getParticles(),
      targetedShape: this.targetedShape,
      deltaTime
    });

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
    this.currentGameState = 'gameOver';
    document.getElementById('finalScore').textContent = this.gameState.score;
    document.getElementById('gameOver').classList.add('show');
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