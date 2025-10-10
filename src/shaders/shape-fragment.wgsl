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
  
  // Define the target color for high threat
  let highThreatColor = vec3<f32>(1.0, 0.0, 0.0); // Red
  
  // NEW: Blend from the shape's base color directly to red based on threat level
  var blendedColor = mix(input.color, highThreatColor, input.threat);
  
  // Highlight when targeted
  if (input.targeted > 0.5) {
    blendedColor += vec3<f32>(0.2, 0.3, 0.0);
  }
  
  // Apply standard lighting
  let litColor = blendedColor * diffuse;

  // Add a glow effect that intensifies with threat, using the high-threat color
  let glowIntensity = input.threat * input.threat * 0.4;
  let glowColor = highThreatColor * glowIntensity;
  
  var finalColor = litColor + glowColor;

  // Add a rapid blinking effect when critically close
  if (input.threat > 0.85) {
    let blinkSpeed = 25.0;
    // Use fract() to create a sharp on/off blink
    let blinkPhase = fract(input.threat * blinkSpeed);
    if (blinkPhase > 0.5) {
      // Make it much brighter during the "on" part of the blink
      finalColor += vec3<f32>(0.6, 0.6, 0.4);
    }
  }
  
  return vec4<f32>(finalColor, 1.0);
}