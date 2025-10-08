struct CameraUniforms {
  vpMatrix: mat4x4<f32>,
};

struct ShapeUniforms {
  modelMatrix: mat4x4<f32>,
  threat: f32,
  targeted: f32,
  time: f32,
  padding: f32,
};

@binding(0) @group(0) var<uniform> camera: CameraUniforms;
@binding(1) @group(0) var<uniform> shape: ShapeUniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) threat: f32,
  @location(2) targeted: f32,
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  let worldPos = shape.modelMatrix * vec4<f32>(input.position, 1.0);
  output.position = camera.vpMatrix * worldPos;
  
  let normalMatrix = mat3x3<f32>(
    shape.modelMatrix[0].xyz,
    shape.modelMatrix[1].xyz,
    shape.modelMatrix[2].xyz
  );
  output.normal = normalize(normalMatrix * input.normal);
  
  output.threat = shape.threat;
  output.targeted = shape.targeted;
  
  return output;
}