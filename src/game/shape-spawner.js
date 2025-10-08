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
      shape.vertexBuffer?.destroy();
      shape.indexBuffer?.destroy();
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
  }

  spawnRandomShape(wave) {
    const type = this.shapeTypes[Math.floor(Math.random() * this.shapeTypes.length)];
    let x, y, z = -15;
    let positionIsValid = false;
    const maxAttempts = 10;
    const minDistance = 1.5;

    for (let i = 0; i < maxAttempts && !positionIsValid; i++) {
        x = (Math.random() - 0.5) * 4;
        y = (Math.random() - 0.5) * 3;
        positionIsValid = true;
        for (const existingShape of this.shapes) {
            const dist = Math.hypot(x - existingShape.position[0], y - existingShape.position[1]);
            if (dist < minDistance) {
                positionIsValid = false;
                break;
            }
        }
    }

    if (!positionIsValid) return;

    const velocity = 1.0 + (wave * 0.1);
    const shape = { 
        type, 
        position: [x, y, z], 
        rotationX: 0,
        rotationY: 0,
        velocity, 
        color: this.getShapeColor(type),
        toBeRemoved: false
    };
    this.createShapeGeometry(shape);
    this.shapes.push(shape);
  }
  
  getShapeColor(type) {
    switch(type) {
      case 'cube': return [0.2, 0.6, 1.0];
      case 'sphere': return [1.0, 0.5, 0.2];
      case 'torus': return [0.8, 0.2, 1.0];
      case 'pyramid': return [0.2, 1.0, 0.5];
      default: return [1, 1, 1];
    }
  }

  createShapeGeometry(shape) {
    let data = { vertices: [], indices: [] };
    switch (shape.type) {
      case 'cube': data = this.createCube(); break;
      case 'sphere': data = this.createSphere(); break;
      case 'torus': data = this.createTorus(); break;
      case 'pyramid': data = this.createPyramid(); break;
    }
    const { vertices, indices } = data;
    const vertexData = new Float32Array(vertices);
    const indexData = new Uint16Array(indices);
    shape.vertexBuffer = this.device.createBuffer({ size: vertexData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(shape.vertexBuffer, 0, vertexData);
    shape.indexBuffer = this.device.createBuffer({ size: indexData.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(shape.indexBuffer, 0, indexData);
    shape.indexCount = indices.length;
  }

  createCube() {
    const s = 0.5;
    const vertices = [
      -s, -s,  s,  0,  0,  1,  // Front face
       s, -s,  s,  0,  0,  1,
       s,  s,  s,  0,  0,  1,
      -s,  s,  s,  0,  0,  1,
      
      -s, -s, -s,  0,  0, -1, // Back face
      -s,  s, -s,  0,  0, -1,
       s,  s, -s,  0,  0, -1,
       s, -s, -s,  0,  0, -1,
       
      -s,  s, -s,  0,  1,  0,  // Top face
      -s,  s,  s,  0,  1,  0,
       s,  s,  s,  0,  1,  0,
       s,  s, -s,  0,  1,  0,
       
      -s, -s, -s,  0, -1,  0, // Bottom face
       s, -s, -s,  0, -1,  0,
       s, -s,  s,  0, -1,  0,
      -s, -s,  s,  0, -1,  0,
      
       s, -s, -s,  1,  0,  0,  // Right face
       s,  s, -s,  1,  0,  0,
       s,  s,  s,  1,  0,  0,
       s, -s,  s,  1,  0,  0,
       
      -s, -s, -s, -1,  0,  0, // Left face
      -s, -s,  s, -1,  0,  0,
      -s,  s,  s, -1,  0,  0,
      -s,  s, -s, -1,  0,  0,
    ];
    const indices = [
       0,  1,  2,    0,  2,  3, // front
       4,  5,  6,    4,  6,  7, // back
       8,  9, 10,    8, 10, 11, // top
      12, 13, 14,   12, 14, 15, // bottom
      16, 17, 18,   16, 18, 19, // right
      20, 21, 22,   20, 22, 23, // left
    ];
    return { vertices, indices };
  }
  
  createPyramid() {
    const s = 0.5;
    const h = 0.5;
    const vertices = [
      // Base vertices (y = -h)
      -s, -h, -s,  0, -1,  0,
       s, -h, -s,  0, -1,  0,
       s, -h,  s,  0, -1,  0,
      -s, -h,  s,  0, -1,  0,
      // Tip vertex (y = h)
       0,  h,  0,  1,  0,  0, // Normal isn't perfect but fine for this
    ];
    const indices = [
      0, 1, 2,   0, 2, 3, // Base
      0, 4, 1, // Sides (ensure counter-clockwise winding)
      1, 4, 2,
      2, 4, 3,
      3, 4, 0,
    ];
    return { vertices, indices };
  }

  createSphere() {
      const vertices = [], indices = [];
      const radius = 0.5;
      const segments = 16, rings = 12;
      for (let i = 0; i <= rings; i++) {
        const phi = i * Math.PI / rings;
        for (let j = 0; j <= segments; j++) {
          const theta = j * 2 * Math.PI / segments;
          const x = -radius * Math.cos(theta) * Math.sin(phi);
          const y = radius * Math.cos(phi);
          const z = radius * Math.sin(theta) * Math.sin(phi);
          vertices.push(x, y, z, x, y, z);
        }
      }
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segments; j++) {
          const first = (i * (segments + 1)) + j;
          const second = first + segments + 1;
          indices.push(first, second, first + 1, second, second + 1, first + 1);
        }
      }
      return { vertices, indices };
  }
  
  createTorus() {
      const vertices = [], indices = [];
      const radius = 0.4, tube = 0.15;
      const radialSegments = 20, tubularSegments = 12;
      for (let i = 0; i <= radialSegments; i++) {
        for (let j = 0; j <= tubularSegments; j++) {
          const u = j / tubularSegments * Math.PI * 2;
          const v = i / radialSegments * Math.PI * 2;
          const x = (radius + tube * Math.cos(u)) * Math.cos(v);
          const y = tube * Math.sin(u);
          const z = (radius + tube * Math.cos(u)) * Math.sin(v);
          const nx = Math.cos(u) * Math.cos(v);
          const ny = Math.sin(u);
          const nz = Math.cos(u) * Math.sin(v);
          vertices.push(x, y, z, nx, ny, nz);
        }
      }
      for (let i = 0; i < radialSegments; i++) {
        for (let j = 0; j < tubularSegments; j++) {
          const a = (tubularSegments + 1) * i + j;
          const b = a + tubularSegments + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      return { vertices, indices };
  }

  removeShape(shape) {
    const index = this.shapes.indexOf(shape);
    if (index > -1) {
      shape.vertexBuffer?.destroy();
      shape.indexBuffer?.destroy();
      this.shapes.splice(index, 1);
    }
  }

  getShapes() {
    return this.shapes;
  }
}