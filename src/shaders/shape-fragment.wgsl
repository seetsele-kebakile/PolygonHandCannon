struct FragmentInput {
  @location(0) normal: vec3<f32>,
  @location(1) color: vec3<f32>,
  @location(2) threat: f32,
  @location(3) targeted: f32,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  let N = normalize(input.normal);
  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.8));
  let diffuse = max(dot(N, lightDir), 0.0) * 0.7 + 0.3;
  
  var threatColor: vec3<f32>;
  if (input.threat < 0.5) {
    threatColor = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), input.threat * 2.0);
  } else {
    threatColor = mix(vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), (input.threat - 0.5) * 2.0);
  }
  
  var finalColor = mix(input.color, threatColor, input.threat * 0.9);
  
  if (input.threat > 0.7) {
    let pulse = (sin(input.threat * 100.0) * 0.5 + 0.5) * 0.3;
    finalColor += vec3<f32>(pulse);
  }
  
  if (input.targeted > 0.5) {
    finalColor += vec3<f32>(0.2, 0.3, 0.0);
  }
  
  return vec4<f32>(finalColor * diffuse, 1.0);
}