export class ParticleSystem {
  constructor(renderer) {
    this.renderer = renderer;
    this.device = renderer.device;
    this.particles = [];
  }

  reset() {
    this.particles.forEach(particle => {
      particle.vertexBuffer?.destroy();
      particle.uniformBuffer?.destroy();
    });
    this.particles = [];
  }

  createExplosion(position, color) {
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      
      const velocity = [
        (Math.random() - 0.5) * speed * 2.0,
        (Math.random() - 0.5) * speed * 2.0,
        (Math.random() - 0.5) * speed * 2.0
      ];

      const particle = {
        position: [...position],
        velocity,
        color: color || [1, 0.5, 0],
        life: 1.0,
        size: 0.05 + Math.random() * 0.08
      };

      // Create dedicated GPU resources for this particle
      particle.uniformBuffer = this.device.createBuffer({
          size: 80, // mat4(64) + f32(4) padded to 16-byte alignment
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      particle.bindGroup = this.device.createBindGroup({
          layout: this.renderer.genericBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: this.renderer.cameraUniformBuffer } },
            { binding: 1, resource: { buffer: particle.uniformBuffer } },
          ],
      });

      this.createParticleGeometry(particle);
      this.particles.push(particle);
    }
  }

  createParticleGeometry(particle) {
    const s = particle.size;
    // This creates a 2D square (or "quad") that will always face the camera
    const vertices = [
      -s, -s, 0, ...particle.color,
       s, -s, 0, ...particle.color,
       s,  s, 0, ...particle.color,
      -s, -s, 0, ...particle.color,
       s,  s, 0, ...particle.color,
      -s,  s, 0, ...particle.color
    ];

    const vertexData = new Float32Array(vertices);

    particle.vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(particle.vertexBuffer, 0, vertexData);
  }

  update(deltaTime) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      particle.position[0] += particle.velocity[0] * deltaTime;
      particle.position[1] += particle.velocity[1] * deltaTime;
      particle.position[2] += particle.velocity[2] * deltaTime;

      // Apply gravity
      particle.velocity[1] -= 2 * deltaTime;

      particle.life -= deltaTime * 0.8;

      if (particle.life <= 0) {
        particle.vertexBuffer?.destroy();
        particle.uniformBuffer?.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  getParticles() {
    return this.particles;
  }
}