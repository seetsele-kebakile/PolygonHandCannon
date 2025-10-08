// src/shaders/particle-vertex.wgsl

struct CameraUniforms {
  vpMatrix: mat4x4<f32>,
};

struct ShapeUniforms {
  modelMatrix: mat4x4<f32>,
  color: vec3<f32>, // This uniform is not actually used by particles but the struct is shared
  life: f32,      // This was also part of the incorrect approach
};

@binding(0) @group(0) var<uniform> camera: CameraUniforms;
@binding(1) @group(0) var<uniform> shape: ShapeUniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) color: vec3<f32>,
  @location(2) alpha: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) alpha: f32, // This will be passed to the fragment shader
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  let worldPos = shape.modelMatrix * vec4<f32>(input.position, 1.0);
  output.position = camera.vpMatrix * worldPos;

  // --- THIS IS THE FIX ---
  // Pass the color and alpha directly from the vertex data, not the uniform
  output.color = input.color;
  output.alpha = input.alpha * shape.life; // We can still use a uniform to fade all particles
  
  return output;
}