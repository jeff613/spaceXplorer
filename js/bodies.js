import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import {
  PLANETS, SUN, MOONS, COMETS, scaleDistance, scaleRadius, SUN_DISPLAY_RADIUS, TRUE_SCALE, mulberry32,
} from './data.js';

const texLoader = new THREE.TextureLoader();
const rand = mulberry32(20260610);
function randDir(target) {
  const u = rand() * 2 - 1;
  const t = rand() * Math.PI * 2;
  const sxy = Math.sqrt(1 - u * u);
  return target.set(sxy * Math.cos(t), u, sxy * Math.sin(t));
}
const DEG = Math.PI / 180;

function loadTex(file) {
  const t = texLoader.load(`textures/${file}`);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ─── Kepler orbit solver ──────────────────────────────────────────────────
// Heliocentric position from J2000 elements at t days past J2000, returned
// already display-scaled. Three.js convention: ecliptic north = +Y.

export function keplerPosition(el, days, target = new THREE.Vector3()) {
  const n = 360 / el.period;
  let M = ((el.L0 - el.varpi + n * days) % 360) * DEG;
  if (M > Math.PI) M -= Math.PI * 2;
  if (M < -Math.PI) M += Math.PI * 2;
  const e = el.e;
  // Newton-Raphson: fixed-point iteration diverges for near-parabolic
  // orbits (Halley e=0.967, NEOWISE e=0.999)
  let E = e > 0.8 ? Math.PI * Math.sign(M || 1) : M;
  for (let k = 0; k < 20; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-9) break;
  }

  const xv = el.a * (Math.cos(E) - e);
  const yv = el.a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);

  const w = (el.varpi - el.Om) * DEG;
  const Om = el.Om * DEG;
  const i = el.i * DEG;
  const wv = w + v;

  const x = r * (Math.cos(Om) * Math.cos(wv) - Math.sin(Om) * Math.sin(wv) * Math.cos(i));
  const y = r * (Math.sin(Om) * Math.cos(wv) + Math.cos(Om) * Math.sin(wv) * Math.cos(i));
  const z = r * Math.sin(wv) * Math.sin(i);

  const s = scaleDistance(r) / r;
  return target.set(x * s, z * s, -y * s);
}

function makeOrbitLine(el, color = 0x3a4a5a, opacity = 0.45) {
  const pts = [];
  const tmp = new THREE.Vector3();
  const N = 256;
  for (let k = 0; k <= N; k++) {
    // sweep mean anomaly through one full period
    keplerPosition(el, (k / N) * el.period, tmp);
    pts.push(tmp.clone());
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(geo, mat);
  line.userData.isOrbit = true;
  return line;
}

// ─── Builders ─────────────────────────────────────────────────────────────

export function createSun(scene) {
  const geo = new THREE.SphereGeometry(SUN_DISPLAY_RADIUS, 64, 32);
  // animated photosphere: texture warped and brightened by drifting fbm
  // noise, output deliberately >1.0 so the bloom pass picks it up
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: loadTex(SUN.texture) }, time: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float time;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int k = 0; k < 4; k++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        float warp = fbm(vUv * 10.0 + vec2(time * 0.015, -time * 0.010));
        vec3 c = texture2D(map, vUv + (warp - 0.5) * 0.008).rgb;
        float granule = 0.82 + 0.5 * fbm(vUv * 16.0 + vec2(-time * 0.022, time * 0.014));
        c *= granule;
        c = mix(c, vec3(1.0, 0.86, 0.55), 0.15);
        // photospheric limb darkening: the disc center looks deeper (hotter)
        // into the sun than the grazing limb, so the edge dims and reddens
        float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float ld = 0.30 + 0.70 * pow(mu, 0.62);
        c = mix(c * vec3(1.0, 0.52, 0.26), c, smoothstep(0.0, 0.5, mu));
        gl_FragColor = vec4(c * ld * 1.45, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sun';
  scene.add(mesh);

  // chromosphere rim: a slightly larger additive shell, fresnel-gated so it
  // only lives at the limb, with fbm flame licks crawling along the edge
  const rimMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float time;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int k = 0; k < 3; k++) { v += a * noise(p); p *= 2.11; a *= 0.5; }
        return v;
      }
      void main() {
        float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float rim = pow(1.0 - mu, 3.5);
        float lick = fbm(vUv * vec2(28.0, 9.0) + vec2(time * 0.05, -time * 0.03));
        vec3 col = mix(vec3(1.0, 0.30, 0.10), vec3(1.0, 0.62, 0.22), lick);
        gl_FragColor = vec4(col, 1.0) * rim * (0.45 + 0.9 * lick);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rim = new THREE.Mesh(new THREE.SphereGeometry(SUN_DISPLAY_RADIUS * 1.04, 64, 32), rimMat);
  rim.name = 'chromosphere';
  rim.raycast = () => {}; // never intercept clicks meant for the sun
  mesh.add(rim);

  // radial-gradient glow sprite
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,190,80,0.85)');
  g.addColorStop(0.25, 'rgba(255,140,40,0.35)');
  g.addColorStop(0.6, 'rgba(255,90,20,0.08)');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(c);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    opacity: 0.65,
  }));
  glow.scale.setScalar(SUN_DISPLAY_RADIUS * 4.2);
  glow.raycast = () => {}; // the glow billboard must not swallow clicks
  mesh.add(glow);

  const light = new THREE.PointLight(0xffffff, 3.0, 0, 0);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x46506a, 0.85));

  // lens flare ghosts along the view axis (textures drawn on canvases)
  const flareTex = (stops, size = 128) => {
    const fc = document.createElement('canvas');
    fc.width = fc.height = size;
    const fctx = fc.getContext('2d');
    const fg = fctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) fg.addColorStop(o, col);
    fctx.fillStyle = fg;
    fctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(fc);
  };
  const ghost = flareTex([[0, 'rgba(255,220,160,0.55)'], [0.5, 'rgba(255,180,90,0.12)'], [1, 'rgba(255,180,90,0)']]);
  const halo = flareTex([[0, 'rgba(255,200,120,0)'], [0.78, 'rgba(255,190,110,0)'], [0.86, 'rgba(255,205,140,0.28)'], [1, 'rgba(255,190,110,0)']], 256);
  const flare = new Lensflare();
  flare.addElement(new LensflareElement(ghost, 56, 0.45));
  flare.addElement(new LensflareElement(ghost, 30, 0.7));
  flare.addElement(new LensflareElement(halo, 130, 1.0));
  flare.addElement(new LensflareElement(ghost, 80, 1.35));
  flare.raycast = () => {}; // never intercept clicks
  light.add(flare);

  return {
    data: SUN, mesh, displayRadius: SUN_DISPLAY_RADIUS,
    update(days) {
      mesh.rotation.y = (days / 25.4) * Math.PI * 2;
      // granulation churns in real time, even when the sim is paused
      mat.uniforms.time.value = performance.now() / 1000;
      rimMat.uniforms.time.value = mat.uniforms.time.value;
    },
  };
}

const SHADER_VERT = `
  varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

// City lights, visible only where the Sun (at the origin) doesn't shine
function makeNightLights(radius, file) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { lightsMap: { value: loadTex(file) } },
    vertexShader: SHADER_VERT,
    fragmentShader: `
      uniform sampler2D lightsMap;
      varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPos;
      void main() {
        float day = dot(normalize(vWorldNormal), normalize(-vWorldPos));
        float night = smoothstep(0.05, -0.18, day);
        vec3 c = texture2D(lightsMap, vUv).rgb;
        gl_FragColor = vec4(c * night * 1.5, 1.0);
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.002, 48, 24), mat);
}

// Rim glow with crude scattering: bright on the day side, fading into
// night, warming to sunset hues along the terminator (sun at origin)
function makeAtmosphere(radius, color) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { atmColor: { value: new THREE.Color(color) } },
    vertexShader: SHADER_VERT,
    fragmentShader: `
      uniform vec3 atmColor;
      varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPos;
      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 sunDir = normalize(-vWorldPos);
        float rim = pow(1.0 - abs(dot(viewDir, n)), 3.0);
        float sunDot = dot(n, sunDir);
        float day = smoothstep(-0.22, 0.25, sunDot);
        float term = 1.0 - smoothstep(0.0, 0.38, abs(sunDot));
        vec3 sunset = mix(atmColor, vec3(1.0, 0.42, 0.22), 0.65);
        vec3 col = mix(atmColor, sunset, term * 0.85);
        gl_FragColor = vec4(col, rim * (0.18 + 0.72 * day));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.03, 48, 24), mat);
}

// Rings: RingGeometry with UVs remapped radially so a strip texture reads
// as concentric bands, plus a shader that casts the planet's shadow across
// the ring plane (sun is always at the world origin).
function makeRing(planetR, map, { inner, outer, gain = 1.0 }) {
  const r0 = planetR * inner;
  const r1 = planetR * outer;
  const geo = new THREE.RingGeometry(r0, r1, 128, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - r0) / (r1 - r0), 0.5);
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      planetR: { value: planetR },
      planetPos: { value: new THREE.Vector3() },
      gain: { value: gain },
    },
    vertexShader: `
      varying vec2 vUv; varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float planetR; uniform vec3 planetPos; uniform float gain;
      varying vec2 vUv; varying vec3 vWorldPos;
      void main() {
        vec4 c = texture2D(map, vUv);
        float alpha = c.a * gain;
        // shadow cylinder cast by the planet, pointing away from the sun
        vec3 d = normalize(planetPos);
        vec3 rel = vWorldPos - planetPos;
        float along = dot(rel, d);
        float radial = length(rel - d * along);
        float lit = along < 0.0 ? 1.0
          : mix(0.18, 1.0, smoothstep(planetR * 0.96, planetR * 1.12, radial));
        gl_FragColor = vec4(c.rgb * lit, alpha);
      }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.userData.shadowMat = mat;
  return ring;
}

// Procedural ring strips for Uranus (bright narrow ε ring) and Neptune
// (faint Adams + Le Verrier rings)
function makeProcRingTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 4;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 4);
  const band = (x0, x1, rgba) => { ctx.fillStyle = rgba; ctx.fillRect(x0 * 256, 0, (x1 - x0) * 256, 4); };
  if (kind === 'uranus') {
    band(0.10, 0.14, 'rgba(150,170,190,0.20)');
    band(0.38, 0.41, 'rgba(160,180,200,0.25)');
    band(0.84, 0.92, 'rgba(200,220,240,0.85)'); // ε ring
  } else {
    band(0.30, 0.36, 'rgba(170,180,200,0.22)'); // Le Verrier
    band(0.78, 0.86, 'rgba(190,200,220,0.40)'); // Adams
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}


export function createPlanet(scene, data) {
  const displayRadius = scaleRadius(data.radiusKm);

  // anchor (orbital position) → tiltGroup (axial tilt) → mesh (spin)
  const anchor = new THREE.Group();
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = -data.tilt * DEG;
  anchor.add(tiltGroup);

  const geo = data.lumpy
    ? makeLumpyGeometry(displayRadius, data.id)
    : new THREE.SphereGeometry(displayRadius, 48, 24);
  const mat = data.texture
    ? new THREE.MeshStandardMaterial({ map: loadTex(data.texture), roughness: 0.92, metalness: 0, envMapIntensity: 0.25 })
    : new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 });
  if (data.bump) {
    const b = texLoader.load(`textures/${data.bump}`);
    mat.bumpMap = b;
    mat.bumpScale = data.bumpScale ?? 1.6;
  } else if (!data.texture && !data.lumpy) {
    // textureless round dwarfs get a seeded crater field
    mat.bumpMap = makeCraterBump(data.id);
    mat.bumpScale = data.bumpScale ?? 1.4;
  }
  if (data.water) {
    // water mask (white = ocean) inverted into a roughness map: smooth
    // glinting seas, matte land
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.filter = 'invert(1)';
      ctx.drawImage(img, 0, 0);
      const rough = new THREE.CanvasTexture(c);
      mat.roughnessMap = rough;
      mat.roughness = 1.0;
      mat.envMapIntensity = 0.5;
      mat.needsUpdate = true;
    };
    img.src = `textures/${data.water}`;
  }
  const mesh = new THREE.Mesh(geo, mat);
  if (data.stretch) mesh.scale.set(...data.stretch); // e.g. Haumea's egg shape
  mesh.name = data.id;
  tiltGroup.add(mesh);

  if (data.nightLights) mesh.add(makeNightLights(displayRadius, data.nightLights));
  let atmosphere = null;
  if (data.atmosphere) {
    atmosphere = makeAtmosphere(displayRadius, data.atmosphere);
    tiltGroup.add(atmosphere);
  }

  let clouds = null;
  if (data.clouds) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(displayRadius * 1.015, 48, 24),
      new THREE.MeshPhongMaterial({
        map: loadTex(data.clouds), blending: THREE.AdditiveBlending,
        transparent: true, opacity: 0.55, depthWrite: false,
      }),
    );
    tiltGroup.add(clouds);
  }
  const rings = [];
  if (data.ring) {
    rings.push(makeRing(displayRadius, loadTex(data.ring), { inner: 1.25, outer: 2.35 }));
  }
  if (data.ringProc) {
    rings.push(makeRing(displayRadius, makeProcRingTexture(data.ringProc),
      { inner: 1.55, outer: 2.0, gain: 0.85 }));
  }
  for (const ring of rings) tiltGroup.add(ring);

  // One shader hook per planet (bands drift and/or ring shadow). A unique
  // program cache key is essential: three keys programs by onBeforeCompile
  // source, and identical wrappers made Saturn reuse Jupiter's program.
  if (data.bands || (data.ring && rings.length) || data.moonShadows) {
    const bandRate = data.bands ? (24 / Math.abs(data.rotationHours)) * 0.04 : 0;
    const inner = displayRadius * 1.25;
    const outer = displayRadius * 2.35;
    const ringTex = data.ring && rings.length ? rings[0].userData.shadowMat.uniforms.map.value : null;
    if (data.bands) mat.map.wrapS = THREE.RepeatWrapping;
    mat.customProgramCacheKey = () => `planetfx-${data.id}`;
    mat.onBeforeCompile = (shader) => {
      let frag = shader.fragmentShader;
      let decls = '';
      let mapCode = '#include <map_fragment>';
      if (data.bands) {
        shader.uniforms.uDays = { value: 0 };
        decls += '\nuniform float uDays;';
        mapCode = `
          vec2 buv = vMapUv;
          float bandLat = (buv.y - 0.5) * 3.14159265;
          buv.x += uDays * ${bandRate.toFixed(6)} * cos(bandLat * 3.0);
          vec4 sampledDiffuseColor = textureGrad( map, buv, dFdx(vMapUv), dFdy(vMapUv) );
          diffuseColor *= sampledDiffuseColor;`;
      }
      if (ringTex || data.moonShadows) {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vRingWorld;')
          .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
            vec4 wpR = modelMatrix * vec4( transformed, 1.0 );
            vRingWorld = wpR.xyz;`);
        decls += '\nvarying vec3 vRingWorld;';
      }
      if (data.moonShadows) {
        shader.uniforms.uMoonPos = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
        shader.uniforms.uMoonR = { value: [0, 0, 0, 0] };
        decls += '\nuniform vec3 uMoonPos[4];\nuniform float uMoonR[4];';
        mapCode += `
          for (int mi = 0; mi < 4; mi++) {
            if (uMoonR[mi] > 0.0) {
              vec3 msd = normalize(uMoonPos[mi]);
              vec3 mrel = vRingWorld - uMoonPos[mi];
              float malong = dot(mrel, msd);
              float mperp = length(mrel - msd * malong);
              float mlit = malong < 0.0 ? 1.0
                : mix(0.25, 1.0, smoothstep(uMoonR[mi] * 0.7, uMoonR[mi] * 1.5, mperp));
              diffuseColor.rgb *= mlit;
            }
          }`;
      }
      if (ringTex) {
        shader.uniforms.uRingMap = { value: ringTex };
        shader.uniforms.uRingInner = { value: inner };
        shader.uniforms.uRingOuter = { value: outer };
        shader.uniforms.uRingNormal = { value: new THREE.Vector3(0, 1, 0) };
        shader.uniforms.uPlanetPos = { value: new THREE.Vector3() };
        decls += `
          uniform sampler2D uRingMap; uniform float uRingInner; uniform float uRingOuter;
          uniform vec3 uRingNormal; uniform vec3 uPlanetPos;`;
        mapCode += `
          {
            vec3 toSun = normalize(-vRingWorld);
            float denom = dot(toSun, uRingNormal);
            if (abs(denom) > 1e-4) {
              float tHit = dot(uPlanetPos - vRingWorld, uRingNormal) / denom;
              if (tHit > 0.0) {
                float rr = length(vRingWorld + toSun * tHit - uPlanetPos);
                float ru = (rr - uRingInner) / (uRingOuter - uRingInner);
                if (ru > 0.0 && ru < 1.0) {
                  float aR = texture2D(uRingMap, vec2(ru, 0.5)).a;
                  diffuseColor.rgb *= mix(1.0, 0.28, aR * 0.85);
                }
              }
            }
          }`;
      }
      frag = frag
        .replace('#include <common>', '#include <common>' + decls)
        .replace('#include <map_fragment>', mapCode);
      shader.fragmentShader = frag;
      mat.userData.shader = shader;
    };
  }

  scene.add(anchor);
  const orbitLine = makeOrbitLine(data.elements);
  scene.add(orbitLine);

  const body = {
    data, mesh, anchor, tiltGroup, orbitLine, displayRadius, rings, atmosphere,
    update(days) {
      keplerPosition(data.elements, days, anchor.position);
      mesh.rotation.y = (days * 24 / data.rotationHours) * Math.PI * 2;
      const sh = mat.userData.shader;
      if (sh) {
        if (sh.uniforms.uDays) sh.uniforms.uDays.value = days % 10000;
        if (sh.uniforms.uPlanetPos) {
          sh.uniforms.uPlanetPos.value.copy(anchor.position);
          sh.uniforms.uRingNormal.value.set(0, 1, 0).applyQuaternion(tiltGroup.quaternion);
        }
        if (sh.uniforms.uMoonPos && body.shadowMoons) {
          body.shadowMoons.forEach((m, i) => {
            m.mesh.getWorldPosition(sh.uniforms.uMoonPos.value[i]);
            sh.uniforms.uMoonR.value[i] = m.displayRadius;
          });
        }
      }
      if (clouds) clouds.rotation.y = mesh.rotation.y * 0.85;
      for (const ring of rings) ring.userData.shadowMat.uniforms.planetPos.value.copy(anchor.position);
    },
  };
  return body;
}

export function createMoon(scene, data, parentBody) {
  const displayRadius = TRUE_SCALE ? scaleRadius(data.radiusKm) : Math.max(0.3, scaleRadius(data.radiusKm) * 0.55);
  const radiiMult = TRUE_SCALE ? (data.trueOrbitRadii ?? data.orbitRadii) : data.orbitRadii;
  const orbitR = parentBody.displayRadius * radiiMult + displayRadius;

  const geo = new THREE.SphereGeometry(displayRadius, 32, 16);
  const mat = data.texture
    ? new THREE.MeshStandardMaterial({ map: loadTex(data.texture), roughness: 0.96, metalness: 0, envMapIntensity: 0.25 })
    : new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.96, metalness: 0, envMapIntensity: 0.25 });
  if (data.bump) {
    mat.bumpMap = texLoader.load(`textures/${data.bump}`);
    mat.bumpScale = data.bumpScale ?? 1.6;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = data.id;
  // most moons orbit their planet's equator; Earth's Moon hugs the ecliptic
  const orbitGroup = data.ecliptic ? parentBody.anchor : parentBody.tiltGroup;
  orbitGroup.add(mesh);

  // local circular orbit ring around the parent
  const ringGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 129 }, (_, k) => {
      const a = (k / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
    }),
  );
  const orbitLine = new THREE.Line(
    ringGeo,
    new THREE.LineBasicMaterial({ color: 0x2e3c48, transparent: true, opacity: 0.5 }),
  );
  orbitLine.userData.isOrbit = true;
  orbitGroup.add(orbitLine);

  let seed = 0;
  for (const ch of data.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const phase = (seed % 360) * DEG;
  return {
    data, mesh, anchor: mesh, orbitLine, displayRadius, parent: parentBody,
    update(days) {
      // ecliptic longitude maps to scene angle as a = -lambda (z = -y_ecl)
      const a = data.meanLongitude0 !== undefined
        ? -(data.meanLongitude0 + (360 / data.period) * days) * DEG
        : phase + (days / data.period) * Math.PI * 2;
      const inc = (data.orbitInclination || 0) * DEG;
      mesh.position.set(
        Math.cos(a) * orbitR,
        Math.sin(a) * Math.sin(inc) * orbitR,
        Math.sin(a) * Math.cos(inc) * orbitR,
      );
      mesh.rotation.y = -a; // tidally locked
    },
  };
}

// ─── Comets ───────────────────────────────────────────────────────────────

// Seeded irregular rock: an icosahedron with per-vertex radial displacement.
// Deterministic per body id so visual-regression snapshots stay stable.
function makeLumpyGeometry(radius, id, detail = 2) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const nrand = mulberry32(seed);
  const bump = new Map();
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    if (!bump.has(key)) bump.set(key, 0.72 + nrand() * 0.55);
    v.multiplyScalar(bump.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Seeded crater field drawn to a canvas, used as a bump map so textureless
// dwarf planets read as battered ice/rock instead of smooth billiard balls
function makeCraterBump(id) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const nrand = mulberry32(seed ^ 0x9e3779b9);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let k = 0; k < 110; k++) {
    const r = 2 + nrand() * 13;
    const x = nrand() * size;
    const y = nrand() * size;
    const depth = Math.round(26 + nrand() * 44);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgb(${128 - depth},${128 - depth},${128 - depth})`);
    g.addColorStop(0.62, `rgb(${128 - (depth >> 2)},${128 - (depth >> 2)},${128 - (depth >> 2)})`);
    g.addColorStop(0.8, `rgb(${128 + (depth >> 1)},${128 + (depth >> 1)},${128 + (depth >> 1)})`);
    g.addColorStop(1, 'rgb(128,128,128)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createComet(scene, data) {
  const displayRadius = 0.45;
  // real comet nuclei are blacker than coal (albedo ~0.04): a dark, seeded
  // lumpy potato — never a bright sphere, which bloom turns into a white egg
  const mesh = new THREE.Mesh(
    makeLumpyGeometry(displayRadius, data.id),
    new THREE.MeshStandardMaterial({ color: 0x4a443c, roughness: 1.0, metalness: 0, envMapIntensity: 0.15 }),
  );
  mesh.scale.set(1.25, 0.8, 0.95); // lumpy nucleus, not a billiard ball
  mesh.rotation.set(0.4, 0.9, 0.2);
  mesh.name = data.id;
  scene.add(mesh);

  // coma: soft additive halo that swells as the comet nears the sun
  const cc = document.createElement('canvas');
  cc.width = cc.height = 128;
  const cctx = cc.getContext('2d');
  const cg = cctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  cg.addColorStop(0, 'rgba(210,228,255,0.5)');
  cg.addColorStop(0.35, 'rgba(180,205,245,0.16)');
  cg.addColorStop(1, 'rgba(160,190,240,0)');
  cctx.fillStyle = cg;
  cctx.fillRect(0, 0, 128, 128);
  const coma = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cc), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0,
  }));
  coma.name = 'coma';
  coma.raycast = () => {};
  mesh.add(coma);

  // oversized invisible pick target — the nucleus is tiny
  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 4),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  mesh.add(proxy);

  const orbitLine = makeOrbitLine(data.elements, 0x8a7a4a, 0.4);
  scene.add(orbitLine);

  // tail: a fixed pool of points stretched anti-sunward, growing near perihelion
  const N = 240;
  const positions = new Float32Array(N * 3);
  const jitter = [];
  for (let i = 0; i < N; i++) jitter.push(randDir(new THREE.Vector3()));
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const tail = new THREE.Points(tailGeo, new THREE.PointsMaterial({
    color: data.color, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.55, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  scene.add(tail);

  const dir = new THREE.Vector3();
  const tailStart = scaleDistance(6); // tail only inside ~6 AU

  return {
    data, mesh, orbitLine, displayRadius,
    update(days) {
      keplerPosition(data.elements, days, mesh.position);
      const d = mesh.position.length();
      const activity = Math.max(0, Math.min(1, (tailStart - d) / tailStart));
      coma.material.opacity = activity * 0.85;
      coma.scale.setScalar(2 + activity * 14);
      tail.visible = d < tailStart;
      if (!tail.visible) return;
      dir.copy(mesh.position).normalize();
      const len = (tailStart - d) * 0.55 + 4;
      for (let i = 0; i < N; i++) {
        const f = (i / N) ** 1.4; // denser near the nucleus
        const spread = f * len * 0.10;
        positions[i * 3] = mesh.position.x + dir.x * f * len + jitter[i].x * spread;
        positions[i * 3 + 1] = mesh.position.y + dir.y * f * len + jitter[i].y * spread;
        positions[i * 3 + 2] = mesh.position.z + dir.z * f * len + jitter[i].z * spread;
      }
      tailGeo.attributes.position.needsUpdate = true;
    },
  };
}

// ─── Eclipse shadows ──────────────────────────────────────────────────────
// Patch a body's material so an occluder (sun at the origin) casts a soft
// shadow cylinder on it — Moon on Earth (solar eclipse), Earth on Moon
// (lunar eclipse).

function attachEclipse(target, getOccluder) {
  const mat = target.mesh.material;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uOccPos = { value: new THREE.Vector3(1e9, 0, 0) };
    shader.uniforms.uOccR = { value: 1 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEclipseWorld;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wpE = modelMatrix * vec4( transformed, 1.0 );
        vEclipseWorld = wpE.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uOccPos;\nuniform float uOccR;\nvarying vec3 vEclipseWorld;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 sd = normalize(uOccPos);
          vec3 relE = vEclipseWorld - uOccPos;
          float alongE = dot(relE, sd);
          float perpE = length(relE - sd * alongE);
          float litE = alongE < 0.0 ? 1.0
            : mix(0.12, 1.0, smoothstep(uOccR * 0.9, uOccR * 1.7, perpE));
          diffuseColor.rgb *= litE;
        }`);
    mat.userData.eclipseShader = shader;
  };
  const baseUpdate = target.update;
  target.update = (days) => {
    baseUpdate(days);
    const sh = mat.userData.eclipseShader;
    if (sh) {
      const occ = getOccluder();
      occ.mesh.getWorldPosition(sh.uniforms.uOccPos.value);
      sh.uniforms.uOccR.value = occ.displayRadius;
    }
  };
}

// ─── Asteroid belt ────────────────────────────────────────────────────────

export function createAsteroidBelt(scene) {
  const COUNT = 2200;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const au = 2.1 + rand() * 1.2 + (rand() - 0.5) * 0.15;
    const r = scaleDistance(au);
    const a = rand() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (rand() - 0.5) * 3.5;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x8a7f6e, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.75,
  });
  const belt = new THREE.Points(geo, mat);
  scene.add(belt);
  const kuiper = createKuiperBelt(scene);
  return {
    setVisible(v) { belt.visible = v; kuiper.visible = v; },
    update(days) {
      belt.rotation.y = (days / 1680) * Math.PI * 2; // ~4.6 yr mean period
      kuiper.rotation.y = (days / 90000) * Math.PI * 2; // ~250 yr mean period
    },
  };
}

function createKuiperBelt(scene) {
  const COUNT = 3000;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const au = 30 + rand() * 20;
    const r = scaleDistance(au);
    const a = rand() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (rand() - 0.5) * r * 0.12; // thicker, scattered disc
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const kuiper = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x6e7d8c, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.5,
  }));
  scene.add(kuiper);
  return kuiper;
}

// ─── Starfield ────────────────────────────────────────────────────────────

export function createStarfield(scene) {
  // real Milky Way panorama (ESO-style survey photo) as the deep backdrop
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4600, 64, 32),
    new THREE.MeshBasicMaterial({
      map: loadTex('8k_stars_milky_way.jpg'), side: THREE.BackSide,
      color: 0xf4f6fa, depthWrite: false,
    }),
  );
  // the galactic plane is inclined ~60° to the ecliptic — tilt the panorama
  // so the Milky Way band sweeps diagonally across the sky like the real one
  sky.rotation.set(60 * DEG, 0, 12 * DEG);
  scene.add(sky);

  // procedural foreground stars: soft gaussian discs (not square points),
  // blackbody-ish color mix and per-star twinkle
  const COUNT = 7000;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  const speeds = new Float32Array(COUNT);

  // approximate stellar population: white/yellow common, blue + orange rarer
  const TINTS = [
    [0.62, [1.0, 1.0, 1.0]], // white
    [0.80, [1.0, 0.96, 0.88]], // yellow-white
    [0.92, [0.78, 0.86, 1.0]], // blue-white
    [1.00, [1.0, 0.80, 0.62]], // orange-red
  ];
  const v = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    v.randomDirection().multiplyScalar(4200);
    positions.set([v.x, v.y, v.z], i * 3);

    const t = rand();
    const tint = TINTS.find(([p]) => t <= p)[1];
    const j = 0.92 + rand() * 0.08; // slight per-star tint jitter
    colors.set([tint[0] * j, tint[1] * j, tint[2] * j], i * 3);

    // power-law magnitudes: lots of faint stars, a handful of bright ones
    sizes[i] = 0.9 + 5.5 * Math.pow(rand(), 7);
    phases[i] = rand() * Math.PI * 2;
    speeds[i] = 0.6 + rand() * 2.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */`
      attribute vec3 aColor;
      attribute float aSize, aPhase, aSpeed;
      uniform float uTime, uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle, vSize;
      void main() {
        vColor = aColor;
        // subtle atmospheric-style scintillation, stronger on faint stars
        float amp = mix(0.45, 0.15, smoothstep(1.5, 5.0, aSize));
        vTwinkle = 1.0 - amp * (0.5 + 0.5 * sin(uTime * aSpeed + aPhase));
        vSize = aSize;
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      varying float vTwinkle, vSize;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d2 = dot(p, p);
        // gaussian core with a faint wide halo
        float i = exp(-d2 * 5.0) + 0.18 * exp(-d2 * 1.6);
        // gentle diffraction spikes on the brightest stars only
        float spikes = exp(-abs(p.x) * 14.0) + exp(-abs(p.y) * 14.0);
        i += spikes * 0.25 * smoothstep(4.0, 6.4, vSize) * (1.0 - d2 * 0.5);
        gl_FragColor = vec4(vColor, 1.0) * i * vTwinkle;
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const stars = new THREE.Points(geo, mat);
  // drive the twinkle clock here so the render loop needs no extra wiring
  stars.onBeforeRender = () => { mat.uniforms.uTime.value = performance.now() / 1000; };
  scene.add(stars);
}

// ─── Assemble all natural bodies ──────────────────────────────────────────

export function buildSolarSystem(scene) {
  const bodies = new Map();

  const sun = createSun(scene);
  bodies.set('sun', sun);

  for (const p of PLANETS) bodies.set(p.id, createPlanet(scene, p));
  for (const m of MOONS) bodies.set(m.id, createMoon(scene, m, bodies.get(m.parent)));
  for (const c of COMETS) bodies.set(c.id, createComet(scene, c));

  // Galilean moons cast transit shadows on Jupiter; Saturn's big four likewise
  bodies.get('jupiter').shadowMoons = ['io', 'europa', 'ganymede', 'callisto']
    .map((id) => bodies.get(id));
  bodies.get('saturn').shadowMoons = ['titan', 'enceladus', 'rhea', 'iapetus']
    .map((id) => bodies.get(id));

  // Earth and Moon eclipse each other
  attachEclipse(bodies.get('earth'), () => bodies.get('moon'));
  attachEclipse(bodies.get('moon'), () => bodies.get('earth'));

  createStarfield(scene);
  const belt = createAsteroidBelt(scene);

  return { bodies, belt };
}
