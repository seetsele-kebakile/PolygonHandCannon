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
    if (this.shapesDestroyed > 0 && this.shapesDestroyed % 10 === 0) {
      this.wave++;
    }
  }
}