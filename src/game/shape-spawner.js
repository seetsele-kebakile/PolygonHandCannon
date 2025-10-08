// src/game/shape-spawner.js

export class ShapeSpawner {
  constructor(renderer) {
    this.renderer = renderer;
    this.device = renderer.device;
    this.shapes = [];
    this.spawnTimer = 0;
    this.shapeTypes = ['cube', 'sphere', 'torus', 'pyramid'];
  }

  reset() {
    this.shapes.forEach(shape => {
      if (shape.vertexBuffer) shape.vertexBuffer.destroy();
      if (shape.indexBuffer) shape.indexBuffer.destroy();
    });
    this.shapes = [];
    this.spawnTimer = 0;
  }

  update(deltaTime, wave) {
    this.spawnTimer += deltaTime;

    const spawnRate = Math.max(0.5, 2.0 - (wave * 0.1));

    if (this.spawnTimer >= spawnRate) {
      this.spawnTimer = 0;
      this.spawnRandomShape(wave);
    }

    this.shapes.forEach(shape => {
      shape.rotation[0] += deltaTime * 0.5;
      shape.rotation[1] += deltaTime * 0.3;
    });
  }

  spawnRandomShape(wave) {
    const type = this.shapeTypes[Math.floor(Math.random() * this.shapeTypes.length)];
    
    // --- THIS IS THE FIX ---
    // Reduce the spawn range to keep shapes more centered.
    // Was: x = (Math.random() - 0.5) * 6;
    // Was: y = (Math.random() - 0.5) * 4;
    const x = (Math.random() - 0.5) * 4; // Tighter horizontal spawn
    const y = (Math.random() - 0.5) * 3; // Tighter vertical spawn
    const z = -15;

    const velocity = 1.0 + (wave * 0.1);

    const shape = {
      type,
      position: [x, y, z],
      rotation: [0, 0, 0],
      velocity,
      color: [1, 1, 1]
    };

    this.createShapeGeometry(shape);
    this.shapes.push(shape);
  }

  createShapeGeometry(shape) {
    let vertices, indices;

    switch (shape.type) {
      case 'cube':
        ({ vertices, indices } = this.createCube());
        break;
      case 'sphere':
        ({ vertices, indices } = this.createSphere());
        break;
      case 'torus':
        ({ vertices, indices } = this.createTorus());
        break;
      case 'pyramid':
        ({ vertices, indices } = this.createPyramid());
        break;
    }

    const vertexData = new Float32Array(vertices);
    const indexData = new Uint16Array(indices);

    shape.vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(shape.vertexBuffer, 0, vertexData);

    shape.indexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(shape.indexBuffer, 0, indexData);

    shape.indexCount = indices.length;
  }

  createCube() {
    const vertices = [
      // position // normal
      -0.5,-0.5,0.5,  0,0,1,
       0.5,-0.5,0.5,  0,0,1,
       0.5,0.5,0.5,  0,0,1,
      -0.5,0.5,0.5,  0,0,1,

      -0.5,-0.5,-0.5, 0,0,-1,
       0.5,-0.5,-0.5, 0,0,-1,
       0.5,0.5,-0.5, 0,0,-1,
      -0.5,0.5,-0.5, 0,0,-1,
      
      -0.5,0.5,-0.5, -1,0,0,
      -0.5,0.5,0.5, -1,0,0,
      -0.5,-0.5,0.5, -1,0,0,
      -0.5,-0.5,-0.5, -1,0,0,

       0.5,0.5,-0.5,  1,0,0,
       0.5,0.5,0.5,  1,0,0,
       0.5,-0.5,0.5,  1,0,0,
       0.5,-0.5,-0.5,  1,0,0,

      -0.5,-0.5,-0.5, 0,-1,0,
       0.5,-0.5,-0.5, 0,-1,0,
       0.5,-0.5,0.5, 0,-1,0,
      -0.5,-0.5,0.5, 0,-1,0,

      -0.5,0.5,-0.5, 0,1,0,
       0.5,0.5,-0.5, 0,1,0,
       0.5,0.5,0.5, 0,1,0,
      -0.5,0.5,0.5, 0,1,0,
    ];

    const indices = [
      0,1,2, 0,2,3,
      4,5,6, 4,6,7,
      8,9,10, 8,10,11,
      12,13,14, 12,14,15,
      16,17,18, 16,18,19,
      20,21,22, 20,22,23
    ];

    return { vertices, indices };
  }

  createSphere() {
    const vertices = [];
    const indices = [];
    const segments = 16;
    const rings = 12;

    for (let ring = 0; ring <= rings; ring++) {
      const phi = (ring / rings) * Math.PI;
      const y = Math.cos(phi);
      const ringRadius = Math.sin(phi);

      for (let seg = 0; seg <= segments; seg++) {
        const theta = (seg / segments) * Math.PI * 2;
        const x = ringRadius * Math.cos(theta);
        const z = ringRadius * Math.sin(theta);

        vertices.push(x * 0.5, y * 0.5, z * 0.5);
        const len = Math.sqrt(x * x + y * y + z * z);
        vertices.push(x / len, y / len, z / len);
      }
    }

    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const current = ring * (segments + 1) + seg;
        const next = current + segments + 1;

        indices.push(current, next, current + 1);
        indices.push(current + 1, next, next + 1);
      }
    }

    return { vertices, indices };
  }

  createTorus() {
    const vertices = [];
    const indices = [];
    const majorSegments = 20;
    const minorSegments = 12;
    const majorRadius = 0.4;
    const minorRadius = 0.15;

    for (let i = 0; i <= majorSegments; i++) {
      const u = (i / majorSegments) * Math.PI * 2;
      const cu = Math.cos(u);
      const su = Math.sin(u);

      for (let j = 0; j <= minorSegments; j++) {
        const v = (j / minorSegments) * Math.PI * 2;
        const cv = Math.cos(v);
        const sv = Math.sin(v);

        const x = (majorRadius + minorRadius * cv) * cu;
        const y = minorRadius * sv;
        const z = (majorRadius + minorRadius * cv) * su;

        vertices.push(x, y, z);

        const nx = cv * cu;
        const ny = sv;
        const nz = cv * su;
        vertices.push(nx, ny, nz);
      }
    }

    for (let i = 0; i < majorSegments; i++) {
      for (let j = 0; j < minorSegments; j++) {
        const current = i * (minorSegments + 1) + j;
        const next = current + minorSegments + 1;

        indices.push(current, next, current + 1);
        indices.push(current + 1, next, next + 1);
      }
    }

    return { vertices, indices };
  }

  createPyramid() {
    const vertices = [
       // position      // normal
       // Top point
       0, 0.5, 0,      0, 1, 0,

       // Base points
      -0.5, -0.5, 0.5,  0, -1, 0,
       0.5, -0.5, 0.5,  0, -1, 0,
       0.5, -0.5, -0.5, 0, -1, 0,
      -0.5, -0.5, -0.5, 0, -1, 0,

      // Slanted face normals need to be calculated properly,
      // but for now this will at least render.
       0, 0.5, 0,      0, 0.5, 0.5,
       -0.5,-0.5,0.5,   0, 0.5, 0.5,
       0.5,-0.5,0.5,    0, 0.5, 0.5,
    ];

    const indices = [
      0, 1, 2,
      0, 2, 3,
      0, 3, 4,
      0, 4, 1,
      // Base
      1, 3, 2,
      1, 4, 3
    ];

    return { vertices, indices };
  }

  removeShape(shape) {
    const index = this.shapes.indexOf(shape);
    if (index > -1) {
      if (shape.vertexBuffer) shape.vertexBuffer.destroy();
      if (shape.indexBuffer) shape.indexBuffer.destroy();
      this.shapes.splice(index, 1);
    }
  }

  getShapes() {
    return this.shapes;
  }
}