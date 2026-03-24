precision highp float;
uniform sampler2D velocity;
uniform vec3 bgColor;
uniform vec3 emotionColor;
uniform float emotionIntensity;
varying vec2 uv;

void main(){
    vec2 vel = texture2D(velocity, uv).xy;
    float len = length(vel);
    vel = vel * 0.5 + 0.5;

    // Blend between velocity-derived color and emotion color based on intensity
    vec3 velColor = vec3(vel.x, vel.y, 1.0);
    vec3 activeColor = mix(velColor, emotionColor, emotionIntensity);

    // Mix with background based on velocity magnitude
    vec3 color = mix(bgColor, activeColor, len);

    gl_FragColor = vec4(color, 1.0);
}
