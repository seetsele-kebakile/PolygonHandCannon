// WebGPU rendering engine
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
    this.bindGroup = null;
    this.viewMatrix = mat4.create();
    this.projectionMatrix = mat4.create();
  }

  async init() {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter.requestDevice();

    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    });

    this.createDepthTexture();
    this.createUniformBuffers();
    this.createPipelines();

    mat4.identity(this.viewMatrix);
    mat4.lookAt(this.viewMatrix,
      vec3.fromValues(0, 0, 0),
      vec3.fromValues(0, 0, -1),
      vec3.fromValues(0, 1, 0)
    );

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
    this.cameraUniformBuffer = this.device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.shapeUniformBuffer = this.device.createBuffer({
      size: 80, // Corrected size
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  createPipelines() {
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }
      ]
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraUniformBuffer } },
        { binding: 1, resource: { buffer: this.shapeUniformBuffer } }
      ]
    });

    this.shapePipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: this.device.createShaderModule({ code: shapeVertexShader }),
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' }
            ]
          }
        ]
      },
      fragment: {
        module: this.device.createShaderModule({ code: shapeFragmentShader }),
        entryPoint: 'main',
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    });

    this.particlePipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: this.device.createShaderModule({ code: particleVertexShader }),
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 28,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
              { shaderLocation: 2, offset: 24, format: 'float32' }
            ]
          }
        ]
      },
      fragment: {
        module: this.device.createShaderModule({ code: particleFragmentShader }),
        entryPoint: 'main',
        targets: [{
          format: this.format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one',
              operation: 'add'
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list'
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false,
        depthCompare: 'less'
      }
    });
  }

  render({ shapes, particles, targetedShape, deltaTime }) {
    const aspect = this.canvas.width / this.canvas.height;
    mat4.perspective(this.projectionMatrix, 60 * Math.PI / 180, aspect, 0.1, 100);

    const vpMatrix = mat4.create();
    mat4.multiply(vpMatrix, this.projectionMatrix, this.viewMatrix);

    const cameraData = new Float32Array(32);
    cameraData.set(vpMatrix, 0);
    this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, cameraData);

    const encoder = this.device.createCommandEncoder();
    const view = this.context.getCurrentTexture().createView();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.0, g: 0.0, b: 0.05, a: 1.0 }
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    renderPass.setPipeline(this.shapePipeline);
    renderPass.setBindGroup(0, this.bindGroup);

    shapes.forEach(shape => {
      this.renderShape(renderPass, shape, shape === targetedShape);
    });

    if (particles && particles.length > 0) {
      renderPass.setPipeline(this.particlePipeline);
      particles.forEach(particle => {
        this.renderParticle(renderPass, particle);
      });
    }

    renderPass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  renderShape(renderPass, shape, isTargeted) {
    const distance = Math.abs(shape.position[2]);
    const threat = Math.max(0, Math.min(1, (10 - distance) / 8));
    const time = performance.now() / 1000;

    const shapeData = new Float32Array(20); // Corrected size
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, shape.position);
    mat4.rotateY(modelMatrix, modelMatrix, shape.rotation[1]);
    mat4.rotateX(modelMatrix, modelMatrix, shape.rotation[0]);
    
    shapeData.set(modelMatrix, 0);
    shapeData[16] = threat; // Corrected offset
    shapeData[17] = isTargeted ? 1.0 : 0.0; // Corrected offset
    shapeData[18] = time; // Corrected offset
    shapeData[19] = 0; // Padding

    this.device.queue.writeBuffer(this.shapeUniformBuffer, 0, shapeData);

    renderPass.setVertexBuffer(0, shape.vertexBuffer);
    renderPass.setIndexBuffer(shape.indexBuffer, 'uint16');
    renderPass.drawIndexed(shape.indexCount);
  }

  renderParticle(renderPass, particle) {
    const shapeData = new Float32Array(16);
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, particle.position);
    
    shapeData.set(modelMatrix, 0);
    shapeData.set(particle.color, 12);

    this.device.queue.writeBuffer(this.shapeUniformBuffer, 0, shapeData);

    renderPass.setVertexBuffer(0, particle.vertexBuffer);
    renderPass.draw(6);
  }

  projectToScreen(worldPos) {
    const vpMatrix = mat4.create();
    mat4.multiply(vpMatrix, this.projectionMatrix, this.viewMatrix);

    const clipPos = vec3.create();
    vec3.transformMat4(clipPos, worldPos, vpMatrix);

    if (clipPos[2] > 1) return null;

    const ndcX = clipPos[0] / (clipPos[2] + 0.01);
    const ndcY = clipPos[1] / (clipPos[2] + 0.01);

    const screenX = (ndcX + 1) * 0.5 * this.canvas.width;
    const screenY = (1 - ndcY) * 0.5 * this.canvas.height;

    return { x: screenX, y: screenY };
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    this.depthTexture.destroy();
    this.createDepthTexture();
    
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    });
  }

  destroy() {
    if (this.depthTexture) this.depthTexture.destroy();
    if (this.cameraUniformBuffer) this.cameraUniformBuffer.destroy();
    if (this.shapeUniformBuffer) this.shapeUniformBuffer.destroy();
  }
}