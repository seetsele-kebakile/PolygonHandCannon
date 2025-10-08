struct FragmentInput {
  @location(0) color: vec3<f32>,
  @location(1) alpha: f32,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color, input.alpha);
}