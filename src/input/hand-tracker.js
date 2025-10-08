// src/input/hand-tracker.js

// Hand tracking using MediaPipe Hands
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export class HandTracker {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.video = null;
    this.isRunning = false;
    this.currentHandPos = null;
    this.smoothedHandPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.smoothing = 0.3;
    this.handDetected = false;
    this.isShooting = false; // New property to track the gesture
  }

  async init() {
    // Create hidden video element
    this.video = document.createElement('video');
    this.video.style.display = 'none';
    this.video.width = 640;
    this.video.height = 480;
    document.body.appendChild(this.video);

    // Initialize MediaPipe Hands
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults((results) => this.onResults(results));
  }

  async start() {
    if (this.isRunning) return;

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        await this.hands.send({ image: this.video });
      },
      width: 640,
      height: 480
    });

    await this.camera.start();
    this.isRunning = true;
  }

  // New helper function to check for the gesture
  isShootingGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexMcp = landmarks[5]; // Knuckle at the base of the index finger

    // Rule 1: Index finger is extended (tip is further up than the knuckle)
    const isIndexExtended = indexTip.y < indexMcp.y;

    // Rule 2: Other three fingers are curled (tips are lower than their knuckles)
    const areOthersCurled = middleTip.y > landmarks[9].y &&
                             ringTip.y > landmarks[13].y &&
                             pinkyTip.y > landmarks[17].y;

    // Rule 3: Thumb is extended (optional, but makes it more robust)
    // For a right hand in mirrored view, a lower X value means it's further to the left (outwards)
    const isThumbExtended = thumbTip.x < landmarks[2].x;

    return isIndexExtended && areOthersCurled && isThumbExtended;
  }

  onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.handDetected = true;
      const landmarks = results.multiHandLandmarks[0];

      // Use index finger tip (landmark 8) for aiming
      const indexFingerTip = landmarks[8];

      // Convert normalized coordinates to screen coordinates
      // Note: flip X coordinate for mirror effect
      const x = (1 - indexFingerTip.x) * window.innerWidth;
      const y = indexFingerTip.y * window.innerHeight;

      this.currentHandPos = { x, y };

      // Smooth the hand position
      this.smoothedHandPos.x = this.smoothedHandPos.x * (1 - this.smoothing) +
                               this.currentHandPos.x * this.smoothing;
      this.smoothedHandPos.y = this.smoothedHandPos.y * (1 - this.smoothing) +
                               this.currentHandPos.y * this.smoothing;

      // Check for the gesture on every frame
      this.isShooting = this.isShootingGesture(landmarks);

    } else {
      this.handDetected = false;
      this.currentHandPos = null;
      this.isShooting = false; // Reset when no hand is detected
    }
  }

  getPointerPosition() {
    return this.isRunning && this.currentHandPos ? this.smoothedHandPos : null;
  }

  isHandDetected() {
    return this.handDetected;
  }

  // New getter for the shooting state
  getIsShooting() {
    return this.isShooting;
  }

  stop() {
    if (!this.isRunning) return;

    if (this.camera) {
      this.camera.stop();
    }

    this.isRunning = false;
  }

  destroy() {
    this.stop();

    if (this.video && this.video.parentNode) {
      this.video.parentNode.removeChild(this.video);
    }

    if (this.hands) {
      this.hands.close();
    }
  }
}