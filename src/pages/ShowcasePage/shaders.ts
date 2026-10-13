export const vertexShader = /* glsl */`
  uniform vec2 uViewport;
  uniform float uVelocity;
  uniform float uBend;
  uniform float uCurve;
  uniform float uPixel;

  attribute float aStrip;

  varying vec2 vUv;

  void main() {
    vUv = uv;

    vec4 world = modelMatrix * vec4(position, 1.0);

    // each strip of the plane slides on its own when the carousel moves (the middle leads the way),
    // snapped to chunky pixels so the bend looks like a staircase
    float bend = sin(aStrip * 3.14159265) * uVelocity * uBend;
    float stepSize = uPixel * 3.0;
    world.x -= floor(bend / stepSize + 0.5) * stepSize;

    // bulge like an old CRT: the further from the centre, the further from the camera
    float nx = world.x / uViewport.x;
    world.z -= nx * nx * uCurve;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

// text of the titles below the planes
export const labelFragmentShader = /* glsl */`
  precision highp float;

  uniform sampler2D uMap;
  uniform vec3 uColor;

  varying vec2 vUv;

  void main() {
    gl_FragColor = vec4(uColor, texture2D(uMap, vUv).a);
  }
`

export const fragmentShader = /* glsl */`
  precision highp float;

  uniform sampler2D uMap;
  uniform vec2 uMediaSize;
  uniform vec2 uPlaneSize;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uPixel;
  uniform float uDither;
  uniform float uColorLeak;
  uniform float uVelocity;
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uIris;
  uniform float uWipe;
  uniform float uWipeDir;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // ordered dithering thresholds (4x4 bayer matrix)
  float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
  }
  float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
  }

  // object-fit: cover
  vec2 cover(vec2 uv) {
    float planeRatio = uPlaneSize.x / uPlaneSize.y;
    float mediaRatio = uMediaSize.x / uMediaSize.y;
    vec2 scale = planeRatio > mediaRatio
      ? vec2(1.0, mediaRatio / planeRatio)
      : vec2(planeRatio / mediaRatio, 1.0);
    return (uv - 0.5) * scale + 0.5;
  }

  vec3 palette(float level) {
    if (level < 0.5) return uColor0;
    if (level < 1.5) return uColor1;
    if (level < 2.5) return uColor2;
    return uColor3;
  }

  void main() {
    vec2 px = vUv * uPlaneSize;

    // big blocks used to dissolve the plane in and out and to reveal the real colours
    vec2 block = floor(px / (uPixel * 4.0));
    if (hash(block) >= uOpacity) discard;

    // the opened plane is eaten from the centre to the edges, in a rough circle
    vec2 fromCentre = (block + 0.5) * uPixel * 4.0 / uPlaneSize - 0.5;
    float edge = length(fromCentre) / 0.7071 + (hash(block + 31.0) - 0.5) * 0.3;
    if (edge < mix(-0.2, 1.2, uIris)) discard;

    // wiped in from right to left when the carousel shows up (and out the opposite way, uWipeDir mirrors it),
    // the front bulges forward in the middle
    float front = 0.5 - fromCentre.x * uWipeDir + fromCentre.y * fromCentre.y * 1.4 + (hash(block + 53.0) - 0.5) * 0.2;
    if (front > mix(-0.15, 1.5, uWipe)) discard;

    // pixels get a bit chunkier when the carousel moves fast
    float size = uPixel * (1.0 + floor(min(abs(uVelocity), 1.0) * 1.99));
    vec2 cell = floor(px / size);
    vec2 cellUv = (cell + 0.5) * size / uPlaneSize;

    vec3 source = texture2D(uMap, cover(cellUv)).rgb;
    float luminance = smoothstep(0.05, 0.95, dot(source, vec3(0.299, 0.587, 0.114)));

    // 4 tone LCD, softened with a continuous version of the same palette
    float level = clamp(floor(luminance * 3.0 + bayer4(cell)), 0.0, 3.0);
    float tone = luminance * 3.0;
    vec3 smoothTone = mix(palette(floor(tone)), palette(min(floor(tone) + 1.0, 3.0)), fract(tone));
    vec3 lcd = mix(smoothTone, palette(level), uDither);

    // gaps of the dot matrix
    vec2 inCell = fract(px / size);
    float gap = 1.0 - step(inCell.x, 1.0 - 1.0 / size) * step(inCell.y, 1.0 - 1.0 / size);
    lcd = mix(lcd, uColor3, gap * 0.12);

    // some of the real colours always leak through, the rest fades in softly block by block
    vec3 real = texture2D(uMap, cover(vUv)).rgb;
    float delay = hash(block + 17.0) * 0.35;
    float reveal = smoothstep(delay, delay + 0.65, uReveal);
    vec3 color = mix(lcd, real, mix(uColorLeak, 1.0, reveal));

    gl_FragColor = vec4(color, 1.0);
  }
`
