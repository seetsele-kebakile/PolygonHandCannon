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
  
  // FIX: Threat color gradient - green (threat=0) -> yellow (threat=0.5) -> red (threat=1)
  var threatColor: vec3<f32>;
  if (input.threat < 0.5) {
    // Green to Yellow (threat 0.0 to 0.5)
    threatColor = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), input.threat * 2.0);
  } else {
    // Yellow to Red (threat 0.5 to 1.0)
    threatColor = mix(vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), (input.threat - 0.5) * 2.0);
  }
  
  // FIX: Start with green and gradually blend to threat color
  // Use threat level to determine how much to blend toward the warning color
  var finalColor = mix(input.color, threatColor, input.threat * 0.9);
  
  // Add pulsing effect when very close (high threat)
  if (input.threat > 0.7) {
    let pulse = (sin(input.threat * 100.0) * 0.5 + 0.5) * 0.3;
    finalColor += vec3<f32>(pulse);
  }
  
  // Highlight when targeted
  if (input.targeted > 0.5) {
    finalColor += vec3<f32>(0.2, 0.3, 0.0);
  }
  
  return vec4<f32>(finalColor * diffuse, 1.0);
}