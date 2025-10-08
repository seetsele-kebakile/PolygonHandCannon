export class GameState {
  constructor() {
    this.score = 0;
    this.wave = 1;
    this.isGameOver = false;
    this.shapesDestroyed = 0;
  }

  reset() {
    this.score = 0;
    this.wave = 1;
    this.isGameOver = false;
    this.shapesDestroyed = 0;
  }

  addScore(points) {
    this.score += points;
    this.shapesDestroyed++;

    if (this.shapesDestroyed % 10 === 0) {
      this.wave++;
    }
  }

  getSpawnRate() {
    return Math.max(0.5, 2.0 - (this.wave * 0.1));
  }

  getShapeSpeed() {
    return 1.0 + (this.wave * 0.1);
  }
}