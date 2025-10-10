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
      shape.uniformBuffer?.destroy(); // Clean up uniform buffer
    });
    this.shapes = [];
    this.spawnTimer = 0;
  }

  update(deltaTime, wave) {
    // Handle spawning new shapes
    this.spawnTimer += deltaTime;
    const spawnRate = Math.max(0.5, 2.0 - (wave * 0.1));
    if (this.spawnTimer >= spawnRate) {
      this.spawnTimer = 0;
      this.spawnRandomShape(wave);
    }

    // Handle removing destroyed shapes
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      if (this.shapes[i].toBeRemoved) {
        const shape = this.shapes[i];
        shape.vertexBuffer?.destroy();
        shape.indexBuffer?.destroy();
        shape.uniformBuffer?.destroy(); // Clean up uniform buffer
        this.shapes.splice(i, 1);
      }
    }
  }

  spawnRandomShape(wave) {
    const type = this.shapeTypes[Math.floor(Math.random() * this.shapeTypes.length)];
    // This line ensures the z-axis position is always -10 for every new shape.
    let x, y, z = -10; 
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

    shape.uniformBuffer = this.device.createBuffer({
      size: 96,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    shape.bindGroup = this.device.createBindGroup({
      // Corrected the property name here
      layout: this.renderer.genericBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.renderer.cameraUniformBuffer } },
        { binding: 1, resource: { buffer: shape.uniformBuffer } },
      ],
    });
  }

  createCube() {
    const s = 0.5;
    const vertices = [
      -s,-s,s,0,0,1, s,-s,s,0,0,1, s,s,s,0,0,1, -s,s,s,0,0,1,
      -s,-s,-s,0,0,-1, -s,s,-s,0,0,-1, s,s,-s,0,0,-1, s,-s,-s,0,0,-1,
      -s,s,-s,0,1,0, -s,s,s,0,1,0, s,s,s,0,1,0, s,s,-s,0,1,0,
      -s,-s,-s,0,-1,0, s,-s,-s,0,-1,0, s,-s,s,0,-1,0, -s,-s,s,0,-1,0,
      s,-s,-s,1,0,0, s,s,-s,1,0,0, s,s,s,1,0,0, s,-s,s,1,0,0,
      -s,-s,-s,-1,0,0, -s,-s,s,-1,0,0, -s,s,s,-1,0,0, -s,s,-s,-1,0,0,
    ];
    const indices = [
      0,1,2, 0,2,3, 4,5,6, 4,6,7, 8,9,10, 8,10,11,
      12,13,14, 12,14,15, 16,17,18, 16,18,19, 20,21,22, 20,22,23,
    ];
    return { vertices, indices };
  }

  createPyramid() {
    const s = 0.5, h = 0.5;
    const n = Math.sqrt(h*h + s*s);
    const nxz = h/n, ny = s/n;
    const vertices = [
      -s,-h,-s,0,-1,0, s,-h,-s,0,-1,0, s,-h,s,0,-1,0, -s,-h,s,0,-1,0,
      0,h,0,0,ny,nxz, -s,-h,s,0,ny,nxz, s,-h,s,0,ny,nxz,
      0,h,0,0,ny,-nxz, s,-h,-s,0,ny,-nxz, -s,-h,-s,0,ny,-nxz,
      0,h,0,nxz,ny,0, s,-h,s,nxz,ny,0, s,-h,-s,nxz,ny,0,
      0,h,0,-nxz,ny,0, -s,-h,-s,-nxz,ny,0, -s,-h,s,-nxz,ny,0,
    ];
    const indices = [ 0,1,2,0,2,3, 4,5,6, 7,8,9, 10,11,12, 13,14,15 ];
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

  getShapes() {
    return this.shapes;
  }
}