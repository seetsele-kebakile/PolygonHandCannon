import { WebGPURenderer } from './renderer/webgpu-renderer.js';
import { GameState } from './game/game-state.js';
import { ShapeSpawner } from './game/shape-spawner.js';
import { HandTracker } from './input/hand-tracker.js';
import { ParticleSystem } from './effects/particle-system.js';
import { SoundManager } from './audio/sound-manager.js';

class PolygonHandCannon {
  constructor() {
    this.canvas = document.getElementById('gpuCanvas');
    this.renderer = null;
    this.gameState = null;
    this.shapeSpawner = null;
    this.handTracker = null;
    this.particleSystem = null;
    this.soundManager = null;
    this.isInitialized = false;
    this.lastTime = performance.now();
    this.crosshair = document.getElementById('crosshair');
    this.currentGameState = 'initializing';
    this.canShoot = true;
    this.canActivateMenu = true;
    this.targetedShape = null;
  }

  async init() {
    try {
      this.soundManager = new SoundManager();
      this.handTracker = new HandTracker();
      await this.handTracker.init();
      await this.handTracker.start();
      this.renderer = new WebGPURenderer(this.canvas);
      await this.renderer.init();
      this.gameState = new GameState();
      this.shapeSpawner = new ShapeSpawner(this.renderer);
      this.particleSystem = new ParticleSystem(this.renderer);
      this.setupEventListeners();
      this.isInitialized = true;
      this.currentGameState = 'ready';
      document.getElementById('status').classList.add('hidden');
      requestAnimationFrame(() => this.gameLoop());
    } catch (error) {
      console.error('Initialization error:', error);
      document.getElementById('status').textContent = `Error: ${error.message}`;
    }
  }

  setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
  }

  startGame() {
    if (this.currentGameState !== 'ready') return;
    document.getElementById('startScreen').classList.add('hidden');
    this.currentGameState = 'playing';
    this.gameState.reset();
    this.shapeSpawner.reset();
    this.particleSystem.reset();
  }

  restartGame() {
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('startScreen').classList.remove('hidden');
    this.currentGameState = 'ready';
  }

  gameLoop() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const handPos = this.handTracker.getPointerPosition();
    const isShooting = this.handTracker.getIsShooting();

    this.updateUI(handPos, isShooting);

    if (this.currentGameState === 'playing' && !this.gameState.isGameOver) {
      this.updateGame(deltaTime, handPos, isShooting);
    }
    
    this.renderer.render({
      shapes: this.shapeSpawner.getShapes(),
      particles: this.particleSystem.getParticles(),
      targetedShape: this.targetedShape,
    });

    requestAnimationFrame(() => this.gameLoop());
  }

  updateUI(handPos, isShooting) {
    if (handPos) {
      this.crosshair.style.left = `${handPos.x}px`;
      this.crosshair.style.top = `${handPos.y}px`;
    }

    const handleMenuInteraction = (buttonId, action) => {
        const button = document.getElementById(buttonId);
        const rect = button.getBoundingClientRect();
        const hovering = handPos && (handPos.x > rect.left && handPos.x < rect.right && handPos.y > rect.top && handPos.y < rect.bottom);
        button.classList.toggle('targeted', hovering);
        if (hovering && isShooting && this.canActivateMenu) {
            action();
            this.canActivateMenu = false;
        }
    };

    if (this.currentGameState === 'ready') handleMenuInteraction('startBtn', () => this.startGame());
    else if (this.currentGameState === 'gameOver') handleMenuInteraction('restartBtn', () => this.restartGame());
    
    if (!isShooting) this.canActivateMenu = true;
    
    this.crosshair.classList.toggle('targeting', !!this.targetedShape);
    document.getElementById('score').textContent = this.gameState.score;
    document.getElementById('wave').textContent = this.gameState.wave;
    document.getElementById('shapeCount').textContent = this.shapeSpawner.getShapes().length;
  }
  
  updateGame(deltaTime, handPos, isShooting) {
    this.shapeSpawner.update(deltaTime, this.gameState.wave);
    this.particleSystem.update(deltaTime);

    const shapes = this.shapeSpawner.getShapes();
    this.targetedShape = this.performRaycast(handPos, shapes);

    if (isShooting && this.canShoot && this.targetedShape) {
      this.destroyShape(this.targetedShape);
      this.gameState.addScore(100);
      this.soundManager.playShootSound();
      this.canShoot = false;
      this.targetedShape = null;
    }
    
    if (!isShooting) this.canShoot = true;

    // Update shape positions and check for game over
    for (const shape of shapes) {
        if (shape.toBeRemoved) continue;
        shape.position[2] += shape.velocity * deltaTime;
        shape.rotationX += deltaTime * 0.5;
        shape.rotationY += deltaTime * 0.3;
        
        // Threat calculation for the new coordinate space (z=-10 to z=4.5)
        shape.threat = Math.max(0, Math.min(1, (shape.position[2] + 10) / 14.5));
        
        // Game over check, now much closer to the camera
        if (shape.position[2] > 4.5) {
            this.gameOver();
            break;
        }
    }
  }
  
  destroyShape(shape) {
    if (shape.toBeRemoved) return;
    this.particleSystem.createExplosion(shape.position, shape.color);
    shape.toBeRemoved = true;
  }

  performRaycast(handPos, shapes) {
    if (!handPos) return null;
    let closestShape = null;
    let minDistance = 100;
    for (const shape of shapes) {
      if (shape.toBeRemoved) continue;
      const projected = this.renderer.projectToScreen(shape.position);
      if (projected) {
        const distance = Math.hypot(projected.x - handPos.x, projected.y - handPos.y);
        if (distance < minDistance) {
          minDistance = distance;
          closestShape = shape;
        }
      }
    }
    return closestShape;
  }

  gameOver() {
    this.gameState.isGameOver = true;
    this.currentGameState = 'gameOver';
    document.getElementById('finalScore').textContent = this.gameState.score;
    document.getElementById('gameOver').classList.add('show');
  }
}

new PolygonHandCannon().init();