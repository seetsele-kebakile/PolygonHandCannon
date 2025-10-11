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
    this.music = document.getElementById('background-music');
    this.isInitialized = false;
    this.lastTime = performance.now();
    this.crosshair = document.getElementById('crosshair');
    this.handIndicator = document.getElementById('handIndicator');
    this.handStatus = document.getElementById('handStatus');
    this.currentGameState = 'initializing';
    this.canShoot = true;
    this.shootPressed = false;
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

    const startShooting = (e) => { 
        if(e.type !== 'keydown' || !e.repeat) {
            this.shootPressed = true;
        }
    };
    const stopShooting = () => { 
        this.shootPressed = false; 
    };

    window.addEventListener('mousedown', startShooting);
    window.addEventListener('mouseup', stopShooting);
    window.addEventListener('touchstart', startShooting, { passive: false });
    window.addEventListener('touchend', stopShooting);
    window.addEventListener('keydown', startShooting);
    window.addEventListener('keyup', stopShooting);
  }

  startGame() {
    if (this.currentGameState !== 'ready') return;
    document.body.classList.add('game-playing');
    document.getElementById('startScreen').classList.add('hidden');
    this.currentGameState = 'playing';
    this.gameState.reset();
    this.shapeSpawner.reset();
    this.particleSystem.reset();
    
    // Play music if it's not already playing
    if (this.music.paused) {
        this.music.volume = 0.2;
        this.music.play();
    }
  }

  restartGame() {
    document.body.classList.remove('game-playing');
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('startScreen').classList.remove('hidden');
    this.currentGameState = 'ready';
    // Music pause logic is removed
  }

  gameLoop() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    const handPos = this.handTracker.getPointerPosition();
    this.updateUI(handPos);

    if (this.currentGameState === 'playing' && !this.gameState.isGameOver) {
      this.updateGame(deltaTime, handPos);
    }
    
    this.renderer.render({
      shapes: this.shapeSpawner.getShapes(),
      particles: this.particleSystem.getParticles(),
      targetedShape: this.targetedShape,
    });

    requestAnimationFrame(() => this.gameLoop());
  }

  updateUI(handPos) {
    if (handPos) {
      this.crosshair.style.left = `${handPos.x}px`;
      this.crosshair.style.top = `${handPos.y}px`;
      this.handIndicator.style.left = `${handPos.x}px`;
      this.handIndicator.style.top = `${handPos.y}px`;
    }

    const isHandDetected = this.handTracker.isHandDetected();
    if (isHandDetected) {
        this.handStatus.textContent = 'HAND DETECTED';
        this.handStatus.classList.add('detected');
        this.handStatus.classList.remove('not-detected');
    } else {
        this.handStatus.textContent = 'HAND NOT DETECTED';
        this.handStatus.classList.add('not-detected');
        this.handStatus.classList.remove('detected');
    }
    
    this.crosshair.classList.toggle('targeting', !!this.targetedShape);
    document.getElementById('score').textContent = this.gameState.score;
    document.getElementById('wave').textContent = this.gameState.wave;
    document.getElementById('shapeCount').textContent = this.shapeSpawner.getShapes().length;
  }
  
  updateGame(deltaTime, handPos) {
    this.shapeSpawner.update(deltaTime, this.gameState.wave);
    this.particleSystem.update(deltaTime);

    const shapes = this.shapeSpawner.getShapes();
    this.targetedShape = this.performRaycast(handPos, shapes);

    if (this.shootPressed && this.canShoot && this.targetedShape) {
      this.destroyShape(this.targetedShape);
      this.gameState.addScore(100);
      this.soundManager.playShootSound();
      this.canShoot = false;
      this.targetedShape = null;
    }
    
    if (!this.shootPressed) {
      this.canShoot = true;
    }

    for (const shape of shapes) {
        if (shape.toBeRemoved) continue;
        shape.position[2] += shape.velocity * deltaTime;
        shape.rotationX += deltaTime * 0.5;
        shape.rotationY += deltaTime * 0.3;
        
        shape.threat = Math.max(0, Math.min(1, (shape.position[2] + 10) / 14.5));
        
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

    const HITBOX_RADIUS = 40;
    let closestShape = null;
    let closestDistance = HITBOX_RADIUS;

    for (const shape of shapes) {
      if (shape.toBeRemoved) continue;
      const projected = this.renderer.projectToScreen(shape.position);
      if (projected) {
        const distance = Math.hypot(projected.x - handPos.x, projected.y - handPos.y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestShape = shape;
        }
      }
    }
    
    return closestShape;
  }

  gameOver() {
    document.body.classList.remove('game-playing');
    this.gameState.isGameOver = true;
    this.currentGameState = 'gameOver';
    document.getElementById('finalScore').textContent = this.gameState.score;
    document.getElementById('gameOver').classList.add('show');
    // Music pause logic is removed
  }
}

new PolygonHandCannon().init();