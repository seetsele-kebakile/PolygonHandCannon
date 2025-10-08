import { mat4, vec3 } from 'gl-matrix';
import shapeVertexShader from '../shaders/shape-vertex.wgsl?raw';
import shapeFragmentShader from '../shaders/shape-fragment.wgsl?raw';
import particleVertexShader from '../shaders/particle-vertex.wgsl?raw';
import particleFragmentShader from '../shaders/particle-fragment.wgsl?raw';

export class WebGPURenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.format = null;
    this.shapePipeline = null;
    this.particlePipeline = null;
    this.depthTexture = null;
    this.cameraUniformBuffer = null;
    this.shapeUniformBuffer = null;
    this.particleUniformBuffer = null;
    this.shapeBindGroup = null;
    this.particleBindGroup = null;
    this.viewMatrix = mat4.create();
    this.projectionMatrix = mat4.create();
  }

  async init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });
    this.createDepthTexture();
    this.createUniformBuffers();
    this.createPipelines();
    mat4.lookAt(this.viewMatrix, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, -1), vec3.fromValues(0, 1, 0));
    window.addEventListener('resize', () => this.handleResize());
  }

  createDepthTexture() {
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  createUniformBuffers() {
    this.cameraUniformBuffer = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.shapeUniformBuffer = this.device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.particleUniformBuffer = this.device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }

  createPipelines() {
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
      ]
    });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    this.shapeBindGroup = this.device.createBindGroup({ layout: bindGroupLayout, entries: [{ binding: 0, resource: { buffer: this.cameraUniformBuffer } }, { binding: 1, resource: { buffer: this.shapeUniformBuffer } }] });
    this.particleBindGroup = this.device.createBindGroup({ layout: bindGroupLayout, entries: [{ binding: 0, resource: { buffer: this.cameraUniformBuffer } }, { binding: 1, resource: { buffer: this.particleUniformBuffer } }] });

    this.shapePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: this.device.createShaderModule({ code: shapeVertexShader }), entryPoint: 'main', buffers: [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] }] },
      fragment: { module: this.device.createShaderModule({ code: shapeFragmentShader }), entryPoint: 'main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });

    this.particlePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: this.device.createShaderModule({ code: particleVertexShader }), entryPoint: 'main', buffers: [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] }] },
      fragment: { module: this.device.createShaderModule({ code: particleFragmentShader }), entryPoint: 'main', targets: [{ format: this.format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' } } }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' }
    });
  }

  render({ shapes, particles, targetedShape }) {
    const aspect = this.canvas.width / this.canvas.height;
    mat4.perspective(this.projectionMatrix, 60 * Math.PI / 180, aspect, 0.1, 100);
    const vpMatrix = mat4.multiply(mat4.create(), this.projectionMatrix, this.viewMatrix);
    this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, vpMatrix);

    const encoder = this.device.createCommandEncoder();
    const view = this.context.getCurrentTexture().createView();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.0, g: 0.0, b: 0.05, a: 1.0 } }],
      depthStencilAttachment: { view: this.depthTexture.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
    });

    renderPass.setPipeline(this.shapePipeline);
    renderPass.setBindGroup(0, this.shapeBindGroup);
    
    // FIX: Filter shapes before rendering to ensure we only draw valid shapes
    const validShapes = shapes.filter(s => s && s.vertexBuffer && s.indexBuffer && !s.toBeRemoved);
    validShapes.forEach(shape => this.renderShape(renderPass, shape, shape === targetedShape));

    if (particles && particles.length > 0) {
      renderPass.setPipeline(this.particlePipeline);
      renderPass.setBindGroup(0, this.particleBindGroup);
      particles.forEach(particle => this.renderParticle(renderPass, particle));
    }
    renderPass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  renderShape(renderPass, shape, isTargeted) {
    // Validate shape has required buffers
    if (!shape.vertexBuffer || !shape.indexBuffer || !shape.indexCount) {
      return; // Skip invalid shapes
    }

    const shapeData = new Float32Array(24);
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, shape.position);
    mat4.rotateY(modelMatrix, modelMatrix, shape.rotationY);
    mat4.rotateX(modelMatrix, modelMatrix, shape.rotationX);
    
    shapeData.set(modelMatrix, 0);
    shapeData.set(shape.color, 16);
    // Threat: shapes approach from z=-15 to z=1, calculate threat based on proximity
    shapeData[20] = Math.max(0, Math.min(1, shape.threat !== undefined ? shape.threat : 0));
    shapeData[21] = isTargeted ? 1.0 : 0.0;
    
    this.device.queue.writeBuffer(this.shapeUniformBuffer, 0, shapeData);
    
    renderPass.setVertexBuffer(0, shape.vertexBuffer);
    renderPass.setIndexBuffer(shape.indexBuffer, 'uint16');
    renderPass.drawIndexed(shape.indexCount);
  }

  renderParticle(renderPass, particle) {
    const particleData = new Float32Array(20);
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, particle.position);
    particleData.set(modelMatrix, 0);
    particleData[16] = particle.life;
    this.device.queue.writeBuffer(this.particleUniformBuffer, 0, particleData);
    renderPass.setVertexBuffer(0, particle.vertexBuffer);
    renderPass.draw(6);
  }
  
  projectToScreen(worldPos) {
    // FIX: Corrected projection math - handle shapes near/past camera
    const vpMatrix = mat4.multiply(mat4.create(), this.projectionMatrix, this.viewMatrix);
    const clipPos = vec3.transformMat4(vec3.create(), worldPos, vpMatrix);
    
    // Skip if behind camera (negative z in clip space means behind)
    // But allow very close shapes to still be targetable
    if (clipPos[2] < -0.5) return null;
    
    // Avoid division by zero for shapes exactly at camera
    if (Math.abs(clipPos[2]) < 0.01) return null;
    
    // Perspective division for NDC
    const ndcX = clipPos[0] / clipPos[2];
    const ndcY = clipPos[1] / clipPos[2];
    
    // Check if in viewport (allow some margin for near shapes)
    if (ndcX < -2 || ndcX > 2 || ndcY < -2 || ndcY > 2) return null;
    
    // Convert to screen space
    return { 
      x: (ndcX + 1) * 0.5 * this.canvas.width, 
      y: (1 - ndcY) * 0.5 * this.canvas.height 
    };
  }

  handleResize() {
    if (!this.device) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.depthTexture.destroy();
    this.createDepthTexture();
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });
  }

  destroy() {
    this.depthTexture?.destroy();
    this.cameraUniformBuffer?.destroy();
    this.shapeUniformBuffer?.destroy();
    this.particleUniformBuffer?.destroy();
  }
}