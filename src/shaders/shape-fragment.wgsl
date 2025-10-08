struct FragmentInput {
  @location(0) normal: vec3<f32>,
  @location(1) threat: f32,
  @location(2) targeted: f32,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  let N = normalize(input.normal);
  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.8));
  let diffuse = max(dot(N, lightDir), 0.0) * 0.7 + 0.3;
  
  var color: vec3<f32>;
  if (input.threat < 0.5) {
    color = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), input.threat * 2.0);
  } else {
    color = mix(vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), (input.threat - 0.5) * 2.0);
  }
  
  if (input.threat > 0.8) {
    let flash = sin(input.threat * 50.0) * 0.5 + 0.5;
    color += vec3<f32>(flash * 0.5);
  }
  
  if (input.targeted > 0.5) {
    color += vec3<f32>(0.3, 0.3, 0.3);
  }
  
  let finalColor = color * diffuse;
  
  return vec4<f32>(finalColor, 1.0);
}