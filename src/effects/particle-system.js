export class ParticleSystem {
  constructor(renderer) {
    this.renderer = renderer;
    this.device = renderer.device;
    this.particles = [];
  }

  reset() {
    this.particles.forEach(particle => {
      if (particle.vertexBuffer) particle.vertexBuffer.destroy();
    });
    this.particles = [];
  }

  createExplosion(position, color) {
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      
      const velocity = [
        Math.cos(angle) * speed,
        (Math.random() - 0.5) * speed,
        Math.sin(angle) * speed
      ];

      const particle = {
        position: [...position],
        velocity,
        color: color || [1, 0.5, 0],
        life: 1.0,
        size: 0.1 + Math.random() * 0.1
      };

      this.createParticleGeometry(particle);
      this.particles.push(particle);
    }
  }

  createParticleGeometry(particle) {
    const s = particle.size;
    const vertices = [
      -s, -s, 0, ...particle.color, 1.0,
       s, -s, 0, ...particle.color, 1.0,
       s,  s, 0, ...particle.color, 1.0,
      -s, -s, 0, ...particle.color, 1.0,
       s,  s, 0, ...particle.color, 1.0,
      -s,  s, 0, ...particle.color, 1.0
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

      particle.velocity[1] -= 2 * deltaTime;

      particle.life -= deltaTime * 0.8;

      if (particle.life <= 0) {
        if (particle.vertexBuffer) particle.vertexBuffer.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  getParticles() {
    return this.particles;
  }
}