// Sky Leap — charge-jump engine. Three.js v0.160 ES module.
//
// Single input: HOLD to charge (hero compresses, a power ring grows), RELEASE
// to launch on a parabolic arc to the next floating platform along a single
// forward rail. Landing near a platform's center scores PERFECT (combo + gold
// flourish); missing the platform drops the hero into the cloud sea -> restart.
//
// Phase 1: placeholder boxes. The feel, the reachability invariant, the
// trailing follow camera and the landing judge are proven here before the real
// sky-ruin assets are built.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { hero as buildHero, platStone, platPillar, runeDisk, bgPillars, STONE_TONES } from './builders/skyruins.js?v=28';

// --- tunables ---------------------------------------------------------------
const CHARGE_MAX = 1.05;          // seconds to full charge
const MIN_DIST = 2.5;             // jump distance at zero charge
const MAX_DIST = 11.5;            // jump distance at full charge (bigger gaps)
const BASE_H = 1.2;               // arc apex height at zero charge
const PEAK_H = 2.1;               // extra apex height at full charge
const AIR_BASE = 0.42;            // flight time at zero charge
const AIR_EXTRA = 0.30;           // extra flight time at full charge

const RAIL_W = 2.0;               // platform lateral width (x) -- single rail
const PLAT_H = 0.7;               // platform block height (top sits at y=0)
const PLAT_TOP = 0;               // hero stands on y=0
const HERO_HALF = 0.32;           // hero body half-depth — must be fully on the pad to land (no floating-edge)

// world generation -- the reachability invariant lives here.
// KEY: gap (center-to-center) must exceed platform LENGTH (2*half) so there's
// visible void between pads — otherwise platforms merge into a continuous road.
const REACH_SAFETY = 0.86;
const GAP_NEAR = 6.5, GAP_FAR = 9.5;       // gaps spread further (harder)
const GAP_JITTER = 0.3;
const GAP_MAX = MAX_DIST * REACH_SAFETY;   // = 5.33, hard cap so full charge always reaches
const SIZE_BASE = 0.95, SIZE_MIN = 0.62;   // smaller pads (harder landing)
const SIZE_JITTER = 0.18;
const DIFF_OVER = 42;             // platform index at which difficulty saturates
const WARMUP = 3;                 // first N platforms forced wide + near, no death

const AHEAD = 6;                  // platforms to keep spawned ahead
const BEHIND = 2;                 // recycle platforms more than this behind

const ISO_DIST = 30;              // ortho camera distance (no perspective scaling)
const VIEW = 10.0;               // ortho half-height (zoom — show the row, not a close-up)
const CAM_LERP = 5;               // follow responsiveness (per second)
const CAM_LOOK_AHEAD = 0.42;      // how far toward the next platform the focus sits

// --- helpers ----------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const easeInQuad = c => c * c;
const easeInOutQuad = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

function jumpDist(c){ return MIN_DIST + (MAX_DIST - MIN_DIST) * easeInQuad(c); }
function arcHeight(c){ return BASE_H + c * PEAK_H; }

export function startGame({ canvas, hud }){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xa6d8de, 36, 74);   // cleaner cyan-blue haze (was muddy); matches sky

  // Orthographic 45° oblique (axonometric) — parallel lines, no vanishing point,
  // low elevation so the tall pillar front faces read (matches the reference).
  const ISO_DIR = new THREE.Vector3(-1, 0.62, -1).normalize();
  const camera = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, 0.1, 200);
  const camFocus = new THREE.Vector3();

  // ── Sky dome: soft teal-cyan vertical gradient + a lime-yellow corner glow
  // (matches the reference: lime top-left → teal-cyan body → pale mint). ──
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 24, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x6cbecb) },   // cleaner cyan-blue
        mid: { value: new THREE.Color(0x9bd2d6) },   // bright cyan-mint
        bot: { value: new THREE.Color(0xcae8e8) },   // pale cyan horizon
        glow: { value: new THREE.Color(0xccdd8a) },  // lime-yellow corner
        glowDir: { value: new THREE.Vector3(-0.4, 0.72, 0.45).normalize() },   // upper-LEFT in screen space
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 glow; uniform vec3 glowDir; void main(){ vec3 n = normalize(vP); float h = n.y; vec3 c = h > 0.0 ? mix(mid, top, clamp(h*1.25,0.0,1.0)) : mix(mid, bot, clamp(-h*1.8,0.0,1.0)); float g = clamp(dot(n, glowDir), 0.0, 1.0); c = mix(c, glow, g*g*0.6); gl_FragColor = vec4(c,1.0); }',
    })
  );
  scene.add(sky);

  // ── Soft, even pastel lighting (low contrast, airy — no hard sun) ──
  scene.add(new THREE.HemisphereLight(0xeef6f0, 0xf4e0d6, 0.82));  // strong flat fill (ref is near-shadowless)
  const key = new THREE.DirectionalLight(0xfff4e8, 0.5);
  key.position.set(-7, 13, 6);     // higher + softer → gentle short shadows
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 80;
  key.shadow.camera.left = -18; key.shadow.camera.right = 18;
  key.shadow.camera.top = 18; key.shadow.camera.bottom = -18;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdaf0ea, 0.3);
  rim.position.set(6, 5, -12);     // cool mint back-rim
  scene.add(rim);

  // ── Floating dust motes — warm, additive, catch the light (golden-hour life) ──
  const MOTES = 150;
  const mGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++){
    mPos[i * 3] = (Math.random() * 2 - 1) * 15;
    mPos[i * 3 + 1] = Math.random() * 11 - 1.5;
    mPos[i * 3 + 2] = (Math.random() * 2 - 1) * 20;
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const motes = new THREE.Points(mGeo, new THREE.PointsMaterial({
    color: 0xffdca0, size: 0.09, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false,
  }));
  scene.add(motes);

  // ── Bloom post-processing — the core "lavish" lever (emissives + sun glow) ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.5, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize(){
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const aspect = w / h;
    camera.left = -VIEW * aspect; camera.right = VIEW * aspect;
    camera.top = VIEW; camera.bottom = -VIEW;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const hero = buildHero();
  scene.add(hero);

  // ── limb animation rig — drive the hooded pilgrim's arms/legs through the
  // jump (wind-up → push-off → airborne tuck → landing balance). Single-segment
  // limbs rotated at the hip/shoulder; negative X swings forward/up. ──
  const rig = hero.userData.rig;
  const smooth = u => u * u * (3 - 2 * u);
  // piecewise track: keys = [[t,val],...] ascending, smooth-stepped between.
  function track(t, keys){
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++){
      if (t <= keys[i][0]){
        const a = keys[i - 1], b = keys[i];
        return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / (b[0] - a[0]));
      }
    }
    return keys[keys.length - 1][1];
  }
  function restPose(){
    if (!rig) return;
    rig.legL.rotation.set(0, 0, 0); rig.legR.rotation.set(0, 0, 0);
    rig.armL.rotation.set(0, 0, 0); rig.armR.rotation.set(0, 0, 0);
  }
  // coiled wind-up while charging (c: 0→1) — arms drawn back, legs splay back.
  function poseCharge(c){
    if (!rig) return;
    rig.armL.rotation.set(0.85 * c, 0, -0.12 * c);
    rig.armR.rotation.set(0.85 * c, 0,  0.12 * c);
    rig.legL.rotation.x = 0.22 * c; rig.legR.rotation.x = 0.22 * c;
  }
  // airborne sequence (t: 0→1) — push-off, tuck knees to chest + arms in, then
  // open out for the landing. A small L/R offset keeps it from reading robotic.
  const LEG_TRACK = [[0, 0.22], [0.16, 0.55], [0.42, -1.55], [0.66, -1.5], [0.9, 0.15], [1, 0]];
  const ARM_TRACK = [[0, 0.85], [0.13, -1.35], [0.45, -0.55], [0.78, -0.15], [1, 0]];
  function poseFlight(t){
    if (!rig) return;
    const leg = track(t, LEG_TRACK), arm = track(t, ARM_TRACK);
    const wobble = Math.sin(t * Math.PI) * 0.16;     // cycling life
    rig.legL.rotation.x = leg + wobble; rig.legR.rotation.x = leg - wobble;
    const splay = track(t, [[0.6, 0], [0.82, 0.5], [1, 0.12]]); // arms out to balance the landing
    rig.armL.rotation.set(arm - wobble, 0, -splay);
    rig.armR.rotation.set(arm + wobble, 0,  splay);
  }

  // distant skyline — a PARALLAX LAYER of many tiny faint towers. The whole
  // group drifts at 0.7× the camera (slower than the foreground → parallax), and
  // each tower wraps around so the band is always populated.
  const bg = bgPillars(28);
  scene.add(bg);
  const bgItems = bg.children;
  const BG_STEP = 3.2, BG_SPAN = bgItems.length * BG_STEP;
  const BG_PARALLAX = 0.7;          // <1 → drifts slower than the camera
  function layoutBg(){
    for (let i = 0; i < bgItems.length; i++){
      const m = bgItems[i];
      const side = i % 2 ? 1 : -1;
      m.position.set(side * (5 + (i * 13 % 26)), -1.5 + (i * 7 % 5) * 0.5, (i * BG_STEP) % BG_SPAN);
    }
  }
  function updateBg(){
    bg.position.z = camFocus.z * BG_PARALLAX;
    for (const m of bgItems){
      const worldZ = bg.position.z + m.position.z;
      if (worldZ < camFocus.z - 14) m.position.z += BG_SPAN;          // wrapped behind → ahead
      else if (worldZ > camFocus.z + BG_SPAN) m.position.z -= BG_SPAN; // (safety) wrap back
    }
  }

  // charge ring (ground, grows with charge)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 32),
    new THREE.MeshBasicMaterial({ color: 0x3fb6ac, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  // release pulse ring (expands outward on launch)
  const pulseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.66, 32),
    new THREE.MeshBasicMaterial({ color: 0x9ff0e6, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  pulseRing.rotation.x = -Math.PI / 2; pulseRing.position.y = 0.03; pulseRing.visible = false;
  scene.add(pulseRing);
  let pulseT = 0;

  // ── predictive trajectory arc — a continuous gradient tube from the hero to
  // the predicted landing, shown while charging + through the flight, so the
  // player can read the curve and judge whether their charge was right. ──
  const aimMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {
      uOpacity: { value: 1 },
      cA: { value: new THREE.Color(0xffffff) },   // white arc (ref)
      cB: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uOpacity; uniform vec3 cA; uniform vec3 cB; void main(){ vec3 c = mix(cA, cB, vUv.x); float a = (0.45 + 0.55 * vUv.x) * uOpacity; gl_FragColor = vec4(c, a); }',
  });
  const aimArc = new THREE.Mesh(new THREE.BufferGeometry(), aimMat);
  aimArc.visible = false; aimArc.frustumCulled = false;
  scene.add(aimArc);
  let arcFade = 0;
  // NOT predictive — the arc is traced from the hero's ACTUAL flight positions
  // (so the landing isn't revealed while charging, which would make it too easy)
  // and lingers after landing so the player can read the curve they flew.
  let flightPath = [];
  function buildTrail(){
    if (flightPath.length < 2){ aimArc.visible = false; return; }
    const curve = new THREE.CatmullRomCurve3(flightPath);
    aimArc.geometry.dispose();
    aimArc.geometry = new THREE.TubeGeometry(curve, Math.min(flightPath.length * 2, 44), 0.06, 6, false);
    aimArc.visible = true;
  }

  // ── particle pool (burst + soft puff + voxel shatter) ──
  const PCOUNT = 150;
  const pGeo = new THREE.BoxGeometry(1, 1, 1);
  const pPool = [];
  for (let i = 0; i < PCOUNT; i++){
    const m = new THREE.Mesh(pGeo, new THREE.MeshStandardMaterial({ flatShading: true, transparent: true }));
    m.visible = false; m.frustumCulled = false; m.castShadow = false; scene.add(m);
    pPool.push({ m, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0.1, grav: 9, soft: false, spin: 0 });
  }
  let pCur = 0;
  function spawnP(x, y, z, color, o){
    const p = pPool[pCur]; pCur = (pCur + 1) % PCOUNT;
    const m = p.m; m.visible = true; m.position.set(x, y, z);
    const s = o.size || 0.12; m.scale.set(s, s, s);
    m.material.color.setHex(color);
    if (o.emissive){ m.material.emissive.setHex(color); m.material.emissiveIntensity = o.emissive; }
    else { m.material.emissive.setHex(0x000000); m.material.emissiveIntensity = 0; }
    m.material.opacity = 1;
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.grav = o.grav != null ? o.grav : 9; p.soft = !!o.soft;
    p.life = p.maxLife = o.life || 0.6; p.size = s; p.spin = o.spin || 0;
  }
  function burst(x, y, z, { count = 12, color = 0xf2c14e, speed = 3, up = 3, size = 0.13, life = 0.6, emissive = 0 } = {}){
    for (let i = 0; i < count; i++){
      const a = Math.random() * Math.PI * 2, r = Math.random();
      spawnP(x, y, z, color, { vx: Math.cos(a) * speed * r, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * speed * r,
        size: size * (0.7 + Math.random() * 0.6), life: life * (0.7 + Math.random() * 0.6), grav: 9, emissive, spin: 6 });
    }
  }
  function puffFx(x, y, z, { count = 4, color = 0xeee7d6, size = 0.2, life = 0.5 } = {}){
    for (let i = 0; i < count; i++)
      spawnP(x, y, z, color, { vx: (Math.random() * 2 - 1) * 0.6, vy: 0.4 + Math.random() * 0.4, vz: (Math.random() * 2 - 1) * 0.6,
        size: size * (0.6 + Math.random() * 0.6), life, grav: 0.5, soft: true });
  }
  function updateParticles(dt){
    for (const p of pPool){
      if (!p.m.visible) continue;
      p.life -= dt;
      if (p.life <= 0){ p.m.visible = false; continue; }
      const m = p.m;
      m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
      p.vy -= p.grav * dt;
      const t = p.life / p.maxLife;
      if (p.soft){ m.scale.setScalar(p.size * (1.4 - 0.6 * t)); m.material.opacity = t; }
      else { m.scale.setScalar(p.size * Math.max(0.2, t)); m.material.opacity = Math.min(1, t * 1.6); }
      m.rotation.x += p.spin * dt; m.rotation.y += p.spin * dt;
    }
  }
  function shatterHero(){
    hero.updateWorldMatrix(true, true);
    const wp = new THREE.Vector3();
    hero.traverse(o => {
      if (!o.isMesh) return;
      o.getWorldPosition(wp);
      const col = (o.material && o.material.color) ? o.material.color.getHex() : 0xcccccc;
      const em = (o.material && o.material.emissiveIntensity) ? 0.9 : 0;
      for (let k = 0; k < 2; k++)
        spawnP(wp.x, wp.y, wp.z, col, { vx: (Math.random() * 2 - 1) * 2.4, vy: 1.4 + Math.random() * 2.6, vz: (Math.random() * 2 - 1) * 2.4,
          size: 0.15, life: 1.1, grav: 8, emissive: em, spin: 7 });
    });
    hero.visible = false;
  }

  // ── slow-mo + camera kick ──
  let slow = 0, slowAmt = 1, timeScale = 1, camKick = 0;
  function doSlow(amt, dur){ if (slow > 0) return; slow = dur; slowAmt = amt; }

  // ── WebAudio kit (lazy; init on first touch only — preload-safe) ──
  let AC = null, master = null, ambGain = null, chargeOsc = null, chargeGain = null;
  function audioUnlock(){
    if (AC){ if (AC.state !== 'running') AC.resume(); return; }
    const ACtor = window.AudioContext || window.webkitAudioContext; if (!ACtor) return;
    AC = new ACtor();
    master = AC.createGain(); master.gain.value = 0.85;
    const comp = AC.createDynamicsCompressor();
    master.connect(comp); comp.connect(AC.destination);
    // no background-music pad — SFX only
  }
  function tone(freq, dur, o = {}){
    if (!AC) return;
    const t0 = AC.currentTime + (o.delay || 0);
    const osc = AC.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp || 3200;
    osc.connect(g); g.connect(lp); lp.connect(master); osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function noiseBurst(dur, o = {}){
    if (!AC) return;
    const t0 = AC.currentTime + (o.delay || 0);
    const n = Math.max(1, Math.floor(AC.sampleRate * dur)); const buf = AC.createBuffer(1, n, AC.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = AC.createBufferSource(); src.buffer = buf;
    const g = AC.createGain(); g.gain.value = o.gain || 0.15;
    const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp || 500;
    src.connect(f); f.connect(g); g.connect(master); src.start(t0);
  }
  function sfxChargeStart(){
    if (!AC) return;
    chargeOsc = AC.createOscillator(); chargeOsc.type = 'triangle'; chargeOsc.frequency.setValueAtTime(170, AC.currentTime);
    chargeGain = AC.createGain(); chargeGain.gain.setValueAtTime(0.0001, AC.currentTime);
    chargeGain.gain.exponentialRampToValueAtTime(0.11, AC.currentTime + 0.05);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    chargeOsc.connect(chargeGain); chargeGain.connect(lp); lp.connect(master); chargeOsc.start();
  }
  function sfxChargeUpdate(c){ if (chargeOsc && AC) chargeOsc.frequency.setTargetAtTime(170 + c * 560, AC.currentTime, 0.05); }
  function sfxChargeEnd(){
    if (chargeGain && AC) chargeGain.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.06);
    if (chargeOsc && AC) chargeOsc.stop(AC.currentTime + 0.09);
    chargeOsc = null; chargeGain = null;
  }
  function sfxWhoosh(){ noiseBurst(0.22, { gain: 0.16, hp: 520 }); tone(440, 0.18, { gain: 0.1, slideTo: 150 }); }
  function sfxLand(){ tone(300, 0.12, { gain: 0.1, slideTo: 190 }); }
  function sfxPerfect(combo){ const b = 540 + Math.min(combo, 8) * 36; tone(b, 0.15, { gain: 0.16 }); tone(b * 1.5, 0.22, { gain: 0.12, delay: 0.05 }); }
  function sfxCrash(){ noiseBurst(0.5, { gain: 0.24, hp: 220 }); tone(150, 0.42, { type: 'sawtooth', gain: 0.1, slideTo: 60 }); }
  function startAmbient(){
    if (!AC) return;
    ambGain = AC.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
    const o1 = AC.createOscillator(); o1.type = 'sine'; o1.frequency.value = 110;
    const o2 = AC.createOscillator(); o2.type = 'sine'; o2.frequency.value = 146.8;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 640;
    o1.connect(lp); o2.connect(lp); lp.connect(ambGain); o1.start(); o2.start();
    breathe();
  }
  function breathe(){
    if (!AC || !ambGain) return;
    const now = AC.currentTime;
    const rise = 5 + Math.random() * 3, hold = 8 + Math.random() * 8, fall = 6 + Math.random() * 4, sil = 7 + Math.random() * 9, peak = 0.05;
    ambGain.gain.cancelScheduledValues(now);
    ambGain.gain.setValueAtTime(Math.max(0.0001, ambGain.gain.value), now);
    ambGain.gain.linearRampToValueAtTime(peak, now + rise);
    ambGain.gain.setValueAtTime(peak, now + rise + hold);
    ambGain.gain.linearRampToValueAtTime(0.0001, now + rise + hold + fall);
    setTimeout(breathe, (rise + hold + fall + sil) * 1000);
  }

  // platform pool
  let plats = [];
  let nextIdx = 0;

  function difficultyAt(idx){ return clamp(idx / DIFF_OVER, 0, 1); }

  function disposeGroup(grp){
    grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    scene.remove(grp);
  }

  // Variant cadence — a repeating 6-beat phrase so the rare rune-disk lands as
  // an anticipated downbeat (0 stone tile, 1 pillar, 2 rune-disk).
  const VARIANT_CYCLE = [0, 0, 1, 0, 0, 2];

  function makePlatform(idx, along, half){
    // 4-beat color motif marching toward camera
    const tone = STONE_TONES[idx % STONE_TONES.length];
    let grp;
    if (idx <= WARMUP){
      grp = platStone(half, RAIL_W, tone, idx);
    } else {
      const v = VARIANT_CYCLE[idx % VARIANT_CYCLE.length];
      grp = v === 2 ? runeDisk(half, RAIL_W, tone)
          : v === 1 ? platPillar(half, RAIL_W, tone, idx)
          : platStone(half, RAIL_W, tone, idx);
    }
    grp.position.set(0, PLAT_TOP, along);
    // deterministic alternating sway (a readable zigzag, not random wonkiness)
    grp.rotation.y = (idx % 2 ? 1 : -1) * 0.05;
    // Clone the rune material once and share it across this platform's rune
    // meshes, so a per-platform landing flash doesn't bleed into every other
    // platform via the shared prims material cache.
    const rm = grp.userData.runeMeshes;
    if (rm && rm.length){
      const m = rm[0].material.clone();
      for (const mesh of rm) mesh.material = m;
      grp.userData.runeMat = m;
      grp.userData.runeBase = m.emissiveIntensity;
    }
    scene.add(grp);
    return { idx, along, half, mesh: grp };
  }

  function spawnNext(){
    const prev = plats[plats.length - 1];
    const idx = nextIdx++;
    let along, half;
    if (idx <= WARMUP){
      along = prev ? prev.along + GAP_NEAR : 0;
      half = SIZE_BASE;
    } else {
      const d = difficultyAt(idx);
      let gap = lerp(GAP_NEAR, GAP_FAR, d) + rand(-GAP_JITTER, GAP_JITTER);
      gap = clamp(gap, GAP_NEAR, GAP_MAX);
      half = clamp(lerp(SIZE_BASE, SIZE_MIN, d) + rand(-SIZE_JITTER, SIZE_JITTER), SIZE_MIN, SIZE_BASE + 0.1);
      const minReach = gap - half, maxReach = gap + half;
      if (maxReach < MIN_DIST || minReach > MAX_DIST){
        gap = clamp(gap, MIN_DIST + half * 0.5, GAP_MAX);
      }
      along = prev.along + gap;
    }
    plats.push(makePlatform(idx, along, half));
  }

  function ensureAhead(){
    while (plats[plats.length - 1].idx < current.idx + AHEAD) spawnNext();
  }

  function recycleBehind(){
    while (plats.length && plats[0].idx < current.idx - BEHIND){
      const p = plats.shift();
      disposeGroup(p.mesh);
    }
  }

  const IDLE = 'idle', CHARGING = 'charging', LAUNCH = 'launch', FALLING = 'falling', DEAD = 'dead';
  let state = IDLE;
  let charge = 0;
  let current = null;
  let score = 0, combo = 0, best = readBest();
  let deadTimer = 0;
  let launchT = 0, airTime = 0, startAlong = 0, dist = 0, apex = 0, trailT = 0;

  function readBest(){ try { return Number(localStorage.getItem('sl.best')) || 0; } catch(e){ return 0; } }
  function writeBest(v){ try { localStorage.setItem('sl.best', String(v)); } catch(e){} }

  function reset(){
    for (const p of plats) disposeGroup(p.mesh);
    plats = []; nextIdx = 0;
    spawnNext();
    current = plats[0];
    while (plats[plats.length - 1].idx < AHEAD) spawnNext();
    score = 0; combo = 0; charge = 0; state = IDLE;
    hero.position.set(0, PLAT_TOP, current.along);
    hero.scale.set(1, 1, 1);
    hero.rotation.set(0, 0, 0);
    hero.userData.flip.rotation.set(0, 0, 0);
    restPose();
    hero.visible = true;
    ring.material.opacity = 0;
    pulseRing.visible = false; pulseT = 0;
    aimArc.visible = false; flightPath = []; arcFade = 0;
    slow = 0; timeScale = 1; camKick = 0;
    camFocus.set(-1, 0.6, current.along);
    camera.position.set(camFocus.x + ISO_DIR.x * ISO_DIST, camFocus.y + ISO_DIR.y * ISO_DIST, camFocus.z + ISO_DIR.z * ISO_DIST);
    camera.lookAt(camFocus);
    layoutBg();
    hud.setScore(0); hud.setCombo(0); hud.setReady(true); hud.setDead(null);
  }

  function chargeStart(){
    audioUnlock();
    if (state !== IDLE) return;
    state = CHARGING;
    charge = 0;
    sfxChargeStart();
  }
  function chargeRelease(){
    if (state !== CHARGING) return;
    const c = clamp(charge / CHARGE_MAX, 0, 1);
    dist = jumpDist(c);
    apex = arcHeight(c);
    airTime = AIR_BASE + c * AIR_EXTRA;
    startAlong = current.along;
    launchT = 0; trailT = 0;
    state = LAUNCH;
    ring.material.opacity = 0;
    hero.scale.set(1, 1, 1);
    flightPath = [];         // start tracing the actual flight path from here
    aimMat.uniforms.uOpacity.value = 1; arcFade = 0;
    sfxChargeEnd(); sfxWhoosh();
    // expanding release pulse on the launch platform
    pulseRing.position.set(hero.position.x, 0.03, hero.position.z);
    pulseRing.visible = true; pulseT = 0.5;
  }

  function judgeLanding(){
    const landAlong = startAlong + dist;
    // The hero must be FULLY on the pad — its body half-depth has to clear the
    // edge, else it's "standing in the air" → a miss (matches the visuals).
    let landed = null;
    for (const p of plats){
      if (p.idx <= current.idx) continue;
      if (Math.abs(landAlong - p.along) <= p.half - HERO_HALF){ landed = p; break; }
    }
    if (!landed && current.idx < WARMUP){
      landed = plats.find(p => p.idx === current.idx + 1) || null;
    }
    if (!landed){ die(); return; }
    current = landed;
    hero.position.set(0, PLAT_TOP, landAlong);
    const eh = Math.max(0.12, landed.half - HERO_HALF);   // effective landing half
    const d = Math.abs(landAlong - landed.along);
    if (d <= eh * 0.3){
      // PERFECT — gold burst + screen bounce + slow-mo + chime, combo escalates
      combo += 1;
      score += 3;   // 1 platform + 2 perfect bonus (monotonic)
      flashPlatform(landed, true);
      const n = 10 + Math.min(combo, 8) * 2;
      burst(0, PLAT_TOP + 0.2, landAlong, { count: n, color: 0xf2c14e, speed: 3.2, up: 3.4, size: 0.15, life: 0.7, emissive: 1.2 });
      burst(0, PLAT_TOP + 0.2, landAlong, { count: Math.floor(n * 0.5), color: 0x9ff0e6, speed: 2.4, up: 2.8, size: 0.12, life: 0.6, emissive: 1.0 });
      camKick = 0.55;
      doSlow(0.42, 0.18);
      sfxPerfect(combo);
      hud.pop(combo >= 2 ? 'PERFECT ×' + combo : 'PERFECT');
    } else if (d <= eh * 0.7){
      // GOOD — keep combo, soft dust
      score += 1;
      flashPlatform(landed, false);
      puffFx(0, PLAT_TOP, landAlong, { count: 4 });
      sfxLand();
    } else {
      // plain landing — combo resets
      combo = 0;
      score += 1;
      puffFx(0, PLAT_TOP, landAlong, { count: 5 });
      sfxLand();
    }
    hud.setScore(score);
    hud.setCombo(combo);
    state = IDLE;
    arcFade = 0.32;          // fade the arc out so the player still sees the curve they took
    ensureAhead();
    recycleBehind();
  }

  function flashPlatform(p, perfect){
    const m = p.mesh.userData.runeMat;
    if (m) m.emissiveIntensity = perfect ? 1.0 : 0.5;
  }

  function die(){
    state = FALLING;
    deadTimer = 0;
    combo = 0;
    hud.setCombo(0);
    arcFade = 0.45;         // let the (failed) arc linger so the miss is legible, then fade
    shatterHero();          // burst the hero into its own voxels
    sfxCrash();
    doSlow(0.35, 0.45);
  }

  function finalizeDeath(){
    state = DEAD;
    if (score > best){ best = score; writeBest(best); }
    submitScore(score);
    hud.setDead({ score, best });
  }

  function restart(){ reset(); }

  function updateCamera(dt){
    if (state === DEAD) return;
    if (state !== FALLING){   // FALLING freezes the camera to watch the shatter
      const next = plats.find(p => p.idx === current.idx + 1);
      const aheadZ = next ? next.along : hero.position.z + 3;
      const fz = lerp(hero.position.z, aheadZ, CAM_LOOK_AHEAD);
      camFocus.x = lerp(camFocus.x, -1, CAM_LERP * dt);
      camFocus.y = lerp(camFocus.y, 0.6 + camKick, CAM_LERP * dt);
      camFocus.z = lerp(camFocus.z, fz, CAM_LERP * dt);
    }
    camera.position.set(camFocus.x + ISO_DIR.x * ISO_DIST, camFocus.y + ISO_DIR.y * ISO_DIST, camFocus.z + ISO_DIR.z * ISO_DIST);
    camera.lookAt(camFocus);
  }

  let last = performance.now();
  let idleClock = 0;
  function tick(now){
    requestAnimationFrame(tick);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    // slow-mo: scale the dt that drives gameplay tweens/particles/camera, but
    // keep RAF + backdrop on real time so the loop never stalls.
    if (slow > 0){ slow -= dt; timeScale = slow > 0 ? slowAmt : 1; } else timeScale = 1;
    const gdt = dt * timeScale;
    camKick = lerp(camKick, 0, 9 * dt);

    // backdrop trails the hero so it's always present
    const hz = hero.position.z;
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);
    // dust motes: drift up + slow sideways, wrap within a box around the hero
    motes.position.z = hz;
    const mp = motes.geometry.attributes.position;
    for (let i = 0; i < mp.count; i++){
      let y = mp.getY(i) + dt * 0.35;
      if (y > 9.5) y = -1.5;
      mp.setY(i, y);
      mp.setX(i, mp.getX(i) + Math.sin(now / 1000 * 0.3 + i) * dt * 0.12);
    }
    mp.needsUpdate = true;

    if (state === CHARGING){
      charge = Math.min(charge + gdt, CHARGE_MAX);
      const c = clamp(charge / CHARGE_MAX, 0, 1);
      hero.scale.set(1 + 0.18 * c, 1 - 0.34 * c, 1 + 0.18 * c);
      poseCharge(c);
      ring.position.set(hero.position.x, 0.02, hero.position.z);
      ring.scale.setScalar(0.5 + 1.3 * c);
      ring.material.opacity = 0.35 + 0.55 * c;
      sfxChargeUpdate(c);
    } else if (state === LAUNCH){
      launchT += gdt;
      const t = clamp(launchT / airTime, 0, 1);
      hero.position.z = startAlong + dist * t;
      hero.position.y = PLAT_TOP + 4 * apex * t * (1 - t);
      // takeoff stretch early, ease off after the apex
      const stretch = 1 + 0.26 * Math.sin(Math.PI * t) * (1 - 0.5 * t);
      hero.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
      // lively forward somersault — eased so it tucks fast then lands upright
      const spin = easeInOutQuad(t);
      hero.userData.flip.rotation.x = -spin * Math.PI * 2;
      poseFlight(t);     // arms + legs articulate the tuck-and-open through the flip
      // trace the ACTUAL flight path into a continuous gradient curve (not predictive)
      flightPath.push(new THREE.Vector3(0, hero.position.y + 0.4, hero.position.z));
      buildTrail();
      if (t >= 1){ hero.scale.set(1, 1, 1); hero.userData.flip.rotation.set(0, 0, 0); restPose(); judgeLanding(); }
    } else if (state === FALLING){
      deadTimer += dt;   // hero is shattered into particles; just count down to the card
      if (deadTimer > 0.95) finalizeDeath();
    } else if (state === IDLE){
      idleClock += gdt;
      const b = Math.sin(idleClock * 2.2) * 0.012;
      hero.scale.set(1, 1 + b, 1);
      if (rig){ const sway = Math.sin(idleClock * 2.2) * 0.05; rig.armL.rotation.x = sway; rig.armR.rotation.x = sway; }
    }

    // expanding release pulse
    if (pulseT > 0){
      pulseT -= dt;
      const k = 1 - pulseT / 0.5;
      pulseRing.scale.setScalar(0.6 + k * 2.4);
      pulseRing.material.opacity = (1 - k) * 0.7;
      if (pulseT <= 0) pulseRing.visible = false;
    }

    // trajectory arc fade-out after landing (player still sees the curve flown)
    if (arcFade > 0 && state !== CHARGING && state !== LAUNCH){
      arcFade -= dt;
      aimMat.uniforms.uOpacity.value = clamp(arcFade / 0.32, 0, 1);
      if (arcFade <= 0) aimArc.visible = false;
    }

    updateParticles(gdt);
    updateCamera(gdt);
    updateBg();
    composer.render();
  }

  reset();
  requestAnimationFrame(tick);

  function submitScore(s){
    try {
      const A = window.Aigram;
      if (!A || !A.canRank) return;
      A.callAigramAPI('/note/aigram/ai/game/rank/score/save', 'POST', {
        session_id: A.gameUuid, score: Math.round(s),
      }).catch(()=>{});
    } catch(e){}
  }

  window.__sl = {
    get state(){ return state; },
    get score(){ return score; },
    get combo(){ return combo; },
    plats: () => plats,
    hero,
    testLeap(ms){ chargeStart(); charge = (ms / 1000); chargeRelease(); },
  };

  return { chargeStart, chargeRelease, restart };
}
