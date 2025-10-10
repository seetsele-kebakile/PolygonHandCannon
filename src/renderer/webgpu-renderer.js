import { mat4, vec3, vec4 } from 'gl-matrix';
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
    this.genericBindGroupLayout = null; // Renamed for clarity
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
    mat4.lookAt(this.viewMatrix, vec3.fromValues(0, 0, 5), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    window.addEventListener('resize', () => this.handleResize());
  }

  createDepthTexture() {
    // FIX: The assignment 'this.depthTexture =' was missing here.
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  createUniformBuffers() {
    this.cameraUniformBuffer = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }

  createPipelines() {
    this.genericBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
      ]
    });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [this.genericBindGroupLayout] });

    this.shapePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({ code: shapeVertexShader }),
        entryPoint: 'main',
        buffers: [{
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // Position
            { shaderLocation: 1, offset: 12, format: 'float32x3' } // Normal
          ]
        }]
      },
      fragment: {
        module: this.device.createShaderModule({ code: shapeFragmentShader }),
        entryPoint: 'main',
        targets: [{ format: this.format }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });

    this.particlePipeline = this.device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: { 
            module: this.device.createShaderModule({ code: particleVertexShader }), 
            entryPoint: 'main', 
            buffers: [{ 
                arrayStride: 24,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Position
                    { shaderLocation: 1, offset: 12, format: 'float32x3' } // Color
                ] 
            }] 
        },
        fragment: { 
            module: this.device.createShaderModule({ code: particleFragmentShader }), 
            entryPoint: 'main', 
            targets: [{ 
                format: this.format, 
                blend: { 
                    color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, 
                    alpha: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' } 
                } 
            }] 
        },
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

    // Render Shapes
    renderPass.setPipeline(this.shapePipeline);
    const validShapes = shapes.filter(s => s && s.vertexBuffer && s.indexBuffer && !s.toBeRemoved);
    validShapes.forEach(shape => this.renderShape(renderPass, shape, shape === targetedShape));

    // Render Particles
    if (particles && particles.length > 0) {
      renderPass.setPipeline(this.particlePipeline);
      particles.forEach(particle => this.renderParticle(renderPass, particle));
    }
    renderPass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  renderShape(renderPass, shape, isTargeted) {
    if (!shape.vertexBuffer || !shape.indexBuffer || !shape.indexCount || !shape.uniformBuffer || !shape.bindGroup) {
      return;
    }

    const shapeData = new Float32Array(24);
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, shape.position);
    mat4.rotateY(modelMatrix, modelMatrix, shape.rotationY);
    mat4.rotateX(modelMatrix, modelMatrix, shape.rotationX);
    
    shapeData.set(modelMatrix, 0);
    shapeData.set(shape.color, 16);
    shapeData[20] = Math.max(0, Math.min(1, shape.threat !== undefined ? shape.threat : 0));
    shapeData[21] = isTargeted ? 1.0 : 0.0;
    
    this.device.queue.writeBuffer(shape.uniformBuffer, 0, shapeData);
    
    renderPass.setBindGroup(0, shape.bindGroup);
    renderPass.setVertexBuffer(0, shape.vertexBuffer);
    renderPass.setIndexBuffer(shape.indexBuffer, 'uint16');
    renderPass.drawIndexed(shape.indexCount);
  }

  renderParticle(renderPass, particle) {
    if (!particle.vertexBuffer || !particle.uniformBuffer || !particle.bindGroup) {
        return;
    }
    const particleData = new Float32Array(20);
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, particle.position);
    particleData.set(modelMatrix, 0);
    particleData[16] = particle.life;
    
    this.device.queue.writeBuffer(particle.uniformBuffer, 0, particleData);

    renderPass.setBindGroup(0, particle.bindGroup);
    renderPass.setVertexBuffer(0, particle.vertexBuffer);
    renderPass.draw(6);
  }
  
  projectToScreen(worldPos) {
    const vpMatrix = mat4.multiply(mat4.create(), this.projectionMatrix, this.viewMatrix);
    const clipPos = vec4.transformMat4(vec4.create(), vec4.fromValues(worldPos[0], worldPos[1], worldPos[2], 1.0), vpMatrix);

    if (clipPos[3] <= 0) {
      return null;
    }

    const ndcX = clipPos[0] / clipPos[3];
    const ndcY = clipPos[1] / clipPos[3];

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
  }
}