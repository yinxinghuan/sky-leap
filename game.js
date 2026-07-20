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
import { platStone, platPillar, runeDisk, bgPillars } from './builders/skyruins.js?v=33';
import { CHARACTERS } from './builders/characters.js?v=3';
import { CHARACTER_CATALOG, CHARACTER_KEYS, ANIMAL_KEYS, cloneCharacterAsset, preloadCharacterLibrary } from './src/character-library.js';
import { P, box, cyl, ball, darken } from '@engine-3d';
import { CARTRIDGE } from './cartridge/index.js?v=1';

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
const WARMUP = 3;                 // first N platforms use easy geometry, gap eased up gradually
const WARMUP_GAP = 4.5;           // the very first gap — short + wide so a light tap clears (no teleport assist)

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

export function startGame({ canvas, hud, selectedCharacter = 'commuter' }){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CARTRIDGE.fog.color, CARTRIDGE.fog.near, CARTRIDGE.fog.far);   // heavy haze (no cloud layer): pillar bottoms dissolve into the background

  // Orthographic 45° oblique (axonometric) — parallel lines, no vanishing point,
  // low elevation so the tall pillar front faces read (matches the reference).
  const ISO_DIR = new THREE.Vector3(-1, 0.62, -1).normalize();
  const camera = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, 0.1, 200);
  const camFocus = new THREE.Vector3();
  const WORLD_THEME = CARTRIDGE.world;

  // ── Sky dome: soft teal-cyan vertical gradient + a lime-yellow corner glow
  // (matches the reference: lime top-left → teal-cyan body → pale mint). ──
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 24, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(CARTRIDGE.sky.top) },
        mid: { value: new THREE.Color(CARTRIDGE.sky.mid) },
        bot: { value: new THREE.Color(CARTRIDGE.sky.bot) },
        glow: { value: new THREE.Color(CARTRIDGE.sky.glow) },
        glowDir: { value: new THREE.Vector3(...CARTRIDGE.sky.glowDir).normalize() },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 glow; uniform vec3 glowDir; void main(){ vec3 n = normalize(vP); float h = n.y; vec3 c = h > 0.0 ? mix(mid, top, clamp(h*1.25,0.0,1.0)) : mix(mid, bot, clamp(-h*1.8,0.0,1.0)); float g = clamp(dot(n, glowDir), 0.0, 1.0); c = mix(c, glow, g*g*0.6); gl_FragColor = vec4(c,1.0); }',
    })
  );
  scene.add(sky);

  // ── Soft, even pastel lighting (low contrast, airy — no hard sun) ──
  scene.add(new THREE.HemisphereLight(CARTRIDGE.lights.hemiSky, CARTRIDGE.lights.hemiGround, CARTRIDGE.lights.hemiIntensity));  // strong flat fill (ref is near-shadowless)
  const key = new THREE.DirectionalLight(CARTRIDGE.lights.key, CARTRIDGE.lights.keyIntensity);
  key.position.set(-7, 13, 6);     // higher + softer → gentle short shadows
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 80;
  key.shadow.camera.left = -18; key.shadow.camera.right = 18;
  key.shadow.camera.top = 18; key.shadow.camera.bottom = -18;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(CARTRIDGE.lights.rim, CARTRIDGE.lights.rimIntensity);
  rim.position.set(6, 5, -12);     // cool mint back-rim
  scene.add(rim);

  // ── Floating dust motes — warm, additive, catch the light (golden-hour life) ──
  const MOTES = CARTRIDGE.motes.count;
  const mGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++){
    mPos[i * 3] = (Math.random() * 2 - 1) * 15;
    mPos[i * 3 + 1] = Math.random() * 11 - 1.5;
    mPos[i * 3 + 2] = (Math.random() * 2 - 1) * 20;
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const motes = new THREE.Points(mGeo, new THREE.PointsMaterial({
    color: CARTRIDGE.motes.color, size: CARTRIDGE.motes.size, transparent: true, opacity: CARTRIDGE.motes.opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false,
  }));
  scene.add(motes);

  // ── Random weather — every run rolls one of: clear, rain (cool blue
  //    streaks falling fast), snow (white flakes drifting), or haze (the same
  //    distance fog pulled in closer so the world feels socked-in). One
  //    Points cloud is reused across rain/snow; the material is swapped on
  //    roll. We keep it lightweight (~240 particles) so feed scrolling stays
  //    smooth on mobile. ──
  const WEATHERS = ['clear', 'rain', 'snow', 'haze'];
  const RAIN_OP = CARTRIDGE.weather.rainOpacity, SNOW_OP = CARTRIDGE.weather.snowOpacity;
  const targetOp = (w) => w === 'rain' ? RAIN_OP : (w === 'snow' ? SNOW_OP : 0);
  let weather = 'clear';
  // Dynamic weather: between stable spells of WEATHER_STAY seconds, crossfade
  // (WEATHER_FADE×2 seconds: dim current particles, swap material/visibility,
  // bring new particles up; fog near/far lerp across the whole window).
  const WEATHER_STAY_MIN = 18, WEATHER_STAY_MAX = 34;
  const WEATHER_FADE = 2.0;
  let weatherPhase = 'stable', weatherPhaseT = 0, weatherTimer = 0, weatherNext = null;
  let weatherFromFog = [CARTRIDGE.fog.near, CARTRIDGE.fog.far], weatherToFog = [CARTRIDGE.fog.near, CARTRIDGE.fog.far];
  const weatherFogFor = (w) => w === 'haze' ? [CARTRIDGE.fog.hazeNear, CARTRIDGE.fog.hazeFar] : [CARTRIDGE.fog.near, CARTRIDGE.fog.far];
  // Tight box around the hero — particles spread thin if they cover the whole
  // far-haze zone, so keep them in the foreground bubble where they'll read.
  const WX = 10, WZ = 14, WY_BOT = -2, WY_TOP = 13;
  const WCOUNT = 700;       // dense enough to read as actual weather
  const wGeo = new THREE.BufferGeometry();
  const wPos = new Float32Array(WCOUNT * 3);
  for (let i = 0; i < WCOUNT; i++){
    wPos[i * 3]     = (Math.random() * 2 - 1) * WX;
    wPos[i * 3 + 1] = Math.random() * (WY_TOP - WY_BOT) + WY_BOT;
    wPos[i * 3 + 2] = (Math.random() * 2 - 1) * WZ;
  }
  wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  // sizeAttenuation:false keeps the dot a fixed screen size, so rain/snow
  // doesn't shrink to invisible specks behind the camera distance.
  const rainMat = new THREE.PointsMaterial({
    color: CARTRIDGE.weather.rainColor, size: CARTRIDGE.weather.rainSize, transparent: true, opacity: CARTRIDGE.weather.rainOpacity,
    blending: THREE.NormalBlending, depthWrite: false, sizeAttenuation: false, fog: false,
  });
  const snowMat = new THREE.PointsMaterial({
    color: CARTRIDGE.weather.snowColor, size: CARTRIDGE.weather.snowSize, transparent: true, opacity: CARTRIDGE.weather.snowOpacity,
    blending: THREE.NormalBlending, depthWrite: false, sizeAttenuation: false, fog: false,
  });
  const weatherP = new THREE.Points(wGeo, snowMat);
  weatherP.visible = false;
  scene.add(weatherP);
  function setWeather(w){
    weather = w;
    const hasParticles = (w === 'rain' || w === 'snow');
    weatherP.visible = hasParticles;
    weatherP.material = (w === 'rain') ? rainMat : snowMat;
    // a transition may have left mat.opacity at 0/partial — restore.
    weatherP.material.opacity = targetOp(w);
    // Haze pulls the existing distance fog tighter — no extra cloud plane
    // (the project history shows plane cloud layers always read worse than
    // heavy distance fog).
    const [n, f] = weatherFogFor(w);
    scene.fog.near = n; scene.fog.far = f;
  }

  // Dynamic switcher: drives the crossfade state machine each frame.
  function tickWeather(dt){
    if (weatherPhase === 'stable'){
      weatherTimer -= dt;
      if (weatherTimer <= 0){
        const opts = WEATHERS.filter(x => x !== weather);
        weatherNext = opts[Math.floor(Math.random() * opts.length)];
        weatherFromFog = [scene.fog.near, scene.fog.far];
        weatherToFog = weatherFogFor(weatherNext);
        weatherPhase = 'fadeout';
        weatherPhaseT = 0;
      }
      return;
    }
    weatherPhaseT += dt;
    const total = WEATHER_FADE * 2;
    const totalP = clamp(((weatherPhase === 'fadeout' ? weatherPhaseT : WEATHER_FADE + weatherPhaseT) / total), 0, 1);
    scene.fog.near = lerp(weatherFromFog[0], weatherToFog[0], totalP);
    scene.fog.far  = lerp(weatherFromFog[1], weatherToFog[1], totalP);
    if (weatherPhase === 'fadeout'){
      const t = clamp(weatherPhaseT / WEATHER_FADE, 0, 1);
      if (weatherP.material) weatherP.material.opacity = targetOp(weather) * (1 - t);
      if (weatherPhaseT >= WEATHER_FADE){
        // swap to the new weather's particles/material
        weather = weatherNext;
        const hasParticles = (weather === 'rain' || weather === 'snow');
        weatherP.visible = hasParticles;
        if (hasParticles){
          weatherP.material = (weather === 'rain') ? rainMat : snowMat;
          weatherP.material.opacity = 0;
        }
        weatherPhase = 'fadein';
        weatherPhaseT = 0;
      }
    } else { // fadein
      const t = clamp(weatherPhaseT / WEATHER_FADE, 0, 1);
      if (weatherP.visible && weatherP.material) weatherP.material.opacity = targetOp(weather) * t;
      if (weatherPhaseT >= WEATHER_FADE){
        if (weatherP.visible) weatherP.material.opacity = targetOp(weather);
        weatherPhase = 'stable';
        weatherPhaseT = 0;
        weatherTimer = WEATHER_STAY_MIN + Math.random() * (WEATHER_STAY_MAX - WEATHER_STAY_MIN);
        weatherNext = null;
      }
    }
  }

  // ── Bloom post-processing — the core "lavish" lever (emissives + sun glow) ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), CARTRIDGE.bloom.strength, CARTRIDGE.bloom.radius, CARTRIDGE.bloom.threshold);
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

  // ── Multi-character hero — the player equips a collected commuter. Unlike
  // carries a legL/legR/armL/armR rig). The character is wrapped in
  //   root (world pos + squash) → flip (somersault pivot) → model (the person)
  // so the existing jump code drives root.scale / flip.rotation unchanged, and
  // the rig limbs animate through the leap. The shop owns progression; this
  // renderer only receives a valid equipped key and never randomizes it. ──
  const COLLECTIBLE_KEYS = CHARACTER_KEYS;
  const HERO_SCALE = 0.76;
  let activeCharKey = COLLECTIBLE_KEYS.has(selectedCharacter) ? selectedCharacter : 'commuter';
  let libraryReady = false;

  let hero = null, rig = null, rigBase = null;
  function buildHeroMesh(charKey){
    const libraryModel = cloneCharacterAsset(charKey);
    const model = libraryModel || (CHARACTERS[charKey] || CHARACTERS.shopkeeper)();
    // The shared animal GLBs vary much more in raw height and width than the
    // biped library. Fit both dimensions before the game-wide scale so a bear
    // or cow reads as a different silhouette without swallowing a whole pad.
    if (libraryModel && ANIMAL_KEYS.has(charKey)) {
      const raw = new THREE.Box3().setFromObject(model);
      const rawSize = raw.getSize(new THREE.Vector3());
      const horizontal = Math.max(.01, rawSize.x, rawSize.z);
      const bulky = ['pig', 'cow', 'bear'].includes(charKey);
      const fit = Math.min(2.46 / Math.max(.01, rawSize.y), (bulky ? 2.16 : 1.98) / horizontal);
      model.scale.setScalar(HERO_SCALE * fit);
    } else {
      model.scale.setScalar(HERO_SCALE);
    }
    model.rotation.y = 0;                    // face squarely down the rail (+z) at the next pillar
    const bb = new THREE.Box3().setFromObject(model);
    const CENTER = (bb.max.y - bb.min.y) / 2;
    const flip = new THREE.Group();
    flip.position.y = CENTER;
    model.position.y = -bb.min.y - CENTER;  // feet at root y=0, pivot at body centre
    flip.add(model);
    const root = new THREE.Group();
    root.add(flip);
    root.userData.isHero = true;
    root.userData.flip = flip;
    root.userData.rig = model.userData.rig || {
      legL: model.getObjectByName('rig_legL'), legR: model.getObjectByName('rig_legR'),
      armL: model.getObjectByName('rig_armL'), armR: model.getObjectByName('rig_armR'),
    };
    root.userData.isAnimal = ANIMAL_KEYS.has(charKey);
    root.userData.characterKey = charKey;
    root.userData.heroBounds = bb.getSize(new THREE.Vector3());
    return root;
  }
  function setHero(charKey){
    if (hero) scene.remove(hero);
    hero = buildHeroMesh(charKey);
    scene.add(hero);
    rig = hero.userData.rig;
    rigBase = rig?.legL && rig?.legR && rig?.armL && rig?.armR ? {
      legL: rig.legL.rotation.x, legR: rig.legR.rotation.x,
      armL: rig.armL.rotation.x, armR: rig.armR.rotation.x,
    } : null;
  }
  setHero(activeCharKey);
  preloadCharacterLibrary().then(() => {
    libraryReady = true;
    if (state === IDLE || state === DEAD) setHero(activeCharKey);
  }).catch(() => { /* Keep the compact fallback roster playable if assets fail. */ });
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
  // All limb poses are added ON TOP of the character's rest pose (rigBase) so a
  // figure that holds a prop keeps its offset. Negative X swings forward/up.
  function restPose(){
    if (!rig || !rigBase) return;
    rig.legL.rotation.set(rigBase.legL, 0, 0); rig.legR.rotation.set(rigBase.legR, 0, 0);
    rig.armL.rotation.set(rigBase.armL, 0, 0); rig.armR.rotation.set(rigBase.armR, 0, 0);
  }
  // coiled wind-up while charging (c: 0→1) — arms drawn back, legs splay back.
  function poseCharge(c){
    if (hero?.userData.isAnimal) {
      const key = hero.userData.characterKey;
      const heavy = ['pig', 'cow', 'sheep', 'bear'].includes(key);
      hero.scale.set(1 + .08 * c, 1 - (heavy ? .18 : .28) * c, 1 + .08 * c);
      hero.userData.flip.rotation.x = (key === 'frog' ? .18 : .09) * c;
      return;
    }
    if (!rig || !rigBase) return;
    rig.armL.rotation.set(rigBase.armL + 0.85 * c, 0, -0.12 * c);
    rig.armR.rotation.set(rigBase.armR + 0.85 * c, 0,  0.12 * c);
    rig.legL.rotation.x = rigBase.legL + 0.22 * c; rig.legR.rotation.x = rigBase.legR + 0.22 * c;
  }
  // airborne sequence (t: 0→1) — push-off, tuck knees to chest + arms in, then
  // open out for the landing. A small L/R offset keeps it from reading robotic.
  const LEG_TRACK = [[0, 0.22], [0.16, 0.55], [0.42, -1.55], [0.66, -1.5], [0.9, 0.15], [1, 0]];
  const ARM_TRACK = [[0, 0.85], [0.13, -1.35], [0.45, -0.55], [0.78, -0.15], [1, 0]];
  function poseFlight(t){
    if (hero?.userData.isAnimal) {
      const key = hero.userData.characterKey;
      const hop = Math.sin(t * Math.PI);
      const bird = ['chicken', 'duck'].includes(key);
      const bounder = ['cat', 'dog', 'fox', 'rabbit'].includes(key);
      const heavy = ['pig', 'cow', 'sheep', 'bear'].includes(key);
      hero.userData.flip.rotation.x = bird ? Math.sin(t * Math.PI * 2) * .25 : bounder ? Math.sin(t * Math.PI) * .36 : key === 'frog' ? Math.sin(t * Math.PI) * .22 : heavy ? Math.sin(t * Math.PI) * .12 : .18 * hop;
      hero.scale.set(1 + (bounder ? .18 : .10) * hop, 1 - (key === 'frog' ? .22 : .11) * hop, 1 + (bird ? .14 : .08) * hop);
      if (rig?.legL && rig?.legR) { const leg = bird ? Math.sin(t * Math.PI * 3) * .65 : bounder ? Math.sin(t * Math.PI * 2) * .78 : heavy ? Math.sin(t * Math.PI) * .28 : .45 * hop; rig.legL.rotation.x = leg; rig.legR.rotation.x = -leg; }
      return;
    }
    if (!rig || !rigBase) return;
    const leg = track(t, LEG_TRACK), arm = track(t, ARM_TRACK);
    const wobble = Math.sin(t * Math.PI) * 0.16;     // cycling life
    rig.legL.rotation.x = rigBase.legL + leg + wobble; rig.legR.rotation.x = rigBase.legR + leg - wobble;
    const splay = track(t, [[0.6, 0], [0.82, 0.5], [1, 0.12]]); // arms out to balance the landing
    rig.armL.rotation.set(rigBase.armL + arm - wobble, 0, -splay);
    rig.armR.rotation.set(rigBase.armR + arm + wobble, 0,  splay);
  }

  // distant skyline — a PARALLAX LAYER of many tiny faint towers. The whole
  // group drifts at 0.7× the camera (slower than the foreground → parallax), and
  // each tower wraps around so the band is always populated.
  const bg = bgPillars(28, WORLD_THEME);
  scene.add(bg);
  const bgItems = bg.children;
  const BG_STEP = 2.6, BG_SPAN = bgItems.length * BG_STEP;   // spread for a staggered skyline
  const BG_PARALLAX = 0.7;          // <1 → drifts slower than the camera
  function layoutBg(){
    for (let i = 0; i < bgItems.length; i++){
      const m = bgItems[i];
      // Keep the skyline on the FAR side of the rail (the -x side is the
      // camera-near foreground — putting towers there made them crowd the play
      // column). Bias to +x/+z (deep) and drop the TOPS well below the play line
      // (y≈0) so they read as a low, distant band, never towering pillars.
      const side = i % 4 === 0 ? -1 : 1;                 // a few on the near side, far out; most deep
      const farX = side === 1 ? 13 + (i * 13 % 20) : -(20 + (i * 11 % 12));
      // tops pushed VERY far down + staggered → long thin columns hang low and
      // sink into the fog, their tops scattered well below the play line.
      m.position.set(farX, -12 - (i * 7 % 5) * 2.4, (i * BG_STEP) % BG_SPAN);
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
    new THREE.MeshBasicMaterial({ color: CARTRIDGE.uiFx.ring, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  // release pulse ring (expands outward on launch)
  const pulseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.66, 32),
    new THREE.MeshBasicMaterial({ color: CARTRIDGE.uiFx.pulseRing, transparent: true, opacity: 0, side: THREE.DoubleSide })
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
      cA: { value: new THREE.Color(CARTRIDGE.uiFx.aimA) },
      cB: { value: new THREE.Color(CARTRIDGE.uiFx.aimB) },
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
  function puffFx(x, y, z, { count = 4, color = new THREE.Color(CARTRIDGE.uiFx.puff).getHex(), size = 0.2, life = 0.5 } = {}){
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
    master = AC.createGain(); master.gain.value = CARTRIDGE.audio.masterGain;
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
    const o1 = AC.createOscillator(); o1.type = 'sine'; o1.frequency.value = CARTRIDGE.audio.ambientBase;
    const o2 = AC.createOscillator(); o2.type = 'sine'; o2.frequency.value = CARTRIDGE.audio.ambientOctave;
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
    // Generated themes may opt into a color motif, but canonical Sky Leap keeps
    // the original unified pillar color.
    const tones = WORLD_THEME.stoneTones || [];
    const tone = WORLD_THEME.varyPillarTones && tones.length
      ? tones[idx % tones.length]
      : WORLD_THEME.pillarTop;
    let grp;
    if (idx <= WARMUP){
      grp = platStone(half, RAIL_W, { ...WORLD_THEME, pillarTop: tone });
    } else {
      const v = VARIANT_CYCLE[idx % VARIANT_CYCLE.length];
      grp = v === 2 ? runeDisk(half, RAIL_W, { ...WORLD_THEME, pillarTop: tone })
          : v === 1 ? platPillar(half, RAIL_W, { ...WORLD_THEME, pillarTop: tone })
          : platStone(half, RAIL_W, { ...WORLD_THEME, pillarTop: tone });
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
      // ease the gap UP from WARMUP_GAP toward GAP_NEAR across the warm-up so the
      // first normal pillar isn't a sudden distance jump (was 4.5 → 6.5 cliff).
      const r = clamp((idx - 1) / WARMUP, 0, 1);
      along = prev ? prev.along + lerp(WARMUP_GAP, GAP_NEAR, r) : 0;
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
  // Per-jump rating banter — every landing pops a one-word call. Pull from a
  // rotating bank so consecutive jumps don't repeat the same word, and reserve
  // BARELY! for foot-on-the-edge close calls (>=85% of the footprint margin
  // hanging off the pad). PERFECT keeps its own branded shout below.
  const GOOD_WORDS  = CARTRIDGE.copy.goodWords;
  const PLAIN_WORDS = CARTRIDGE.copy.plainWords;
  let popI = 0;
  const pickWord = (arr) => arr[(popI++) % arr.length];
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
    setHero(activeCharKey);                // keep the player's equipped character across runs
    // Always open on a calm clear sky; the ticker rolls in weather over time.
    setWeather('clear');
    weatherPhase = 'stable'; weatherPhaseT = 0; weatherNext = null;
    weatherTimer = 12 + Math.random() * 14;   // first change in 12–26s
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
    hero.position.y = PLAT_TOP;   // clear any idle-hop offset before the squash
    sfxChargeStart();
  }
  function chargeRelease(){
    if (state !== CHARGING) return;
    const c = clamp(charge / CHARGE_MAX, 0, 1);
    dist = jumpDist(c);
    apex = arcHeight(c);
    airTime = AIR_BASE + c * AIR_EXTRA;
    startAlong = hero.position.z;   // launch from where the hero actually STANDS (edge or centre), not the pad centre
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
    // Success as long as the hero's foot still catches the pillar top — i.e. its
    // footprint overlaps the top (|offset| ≤ half + HERO_HALF). Only a complete
    // whiff (foot entirely past the edge) misses. The hero then rests where it
    // came down (no centre-snap), so an edge landing visibly stays on the edge.
    let landed = null;
    for (const p of plats){
      if (p.idx <= current.idx) continue;
      if (Math.abs(landAlong - p.along) <= p.half + HERO_HALF){ landed = p; break; }  // any foot-on-pillar = landed; only a complete whiff misses
    }
    if (!landed){ die(); return; }   // every jump (incl. the first) is judged honestly — no teleport-to-safety
    current = landed;
    const eh = Math.max(0.12, landed.half - HERO_HALF);   // central zone for PERFECT/GOOD scoring
    const d = Math.abs(landAlong - landed.along);
    // Rest where the hero actually came down — do NOT snap to centre. An edge
    // landing stays on the edge; the next jump starts from here (see chargeRelease).
    hero.position.set(0, PLAT_TOP, landAlong);
    if (d <= eh * 0.3){
      // PERFECT — gold burst + screen bounce + slow-mo + chime, combo escalates
      combo += 1;
      score += 3;   // 1 platform + 2 perfect bonus (monotonic)
      flashPlatform(landed, true);
      const n = 10 + Math.min(combo, 8) * 2;
      burst(0, PLAT_TOP + 0.2, landAlong, { count: n, color: new THREE.Color(CARTRIDGE.uiFx.perfectBurst).getHex(), speed: 3.2, up: 3.4, size: 0.15, life: 0.7, emissive: 1.2 });
      burst(0, PLAT_TOP + 0.2, landAlong, { count: Math.floor(n * 0.5), color: new THREE.Color(CARTRIDGE.uiFx.perfectSpark).getHex(), speed: 2.4, up: 2.8, size: 0.12, life: 0.6, emissive: 1.0 });
      camKick = 0.55;
      doSlow(0.42, 0.18);
      sfxPerfect(combo);
      hud.pop(combo >= 2 ? CARTRIDGE.copy.comboFormat.replace('{combo}', String(combo)) : CARTRIDGE.copy.perfect, 'perfect');
    } else if (d <= eh * 0.7){
      // GOOD — keep combo, soft dust, rotating shout
      score += 1;
      flashPlatform(landed, false);
      puffFx(0, PLAT_TOP, landAlong, { count: 4 });
      sfxLand();
      hud.pop(pickWord(GOOD_WORDS), 'good');
    } else {
      // plain landing — combo resets. A foot-on-the-very-edge save shouts
      // BARELY! so the player feels the close call; otherwise rotate phew/okay.
      combo = 0;
      score += 1;
      puffFx(0, PLAT_TOP, landAlong, { count: 5 });
      sfxLand();
      const edgeMargin = landed.half + HERO_HALF;
      const isClose = d >= edgeMargin * 0.85;
      hud.pop(isClose ? CARTRIDGE.copy.barely : pickWord(PLAIN_WORDS), isClose ? 'barely' : 'plain');
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

    // weather state machine — random crossfades over time, not per-run snap
    tickWeather(dt);

    // weather particles — rain falls fast and straight, snow drifts slow and sways
    if (weatherP.visible){
      weatherP.position.z = hz;
      const wp = weatherP.geometry.attributes.position;
      const fallSpeed = weather === 'rain' ? 14 : 1.2;
      for (let i = 0; i < wp.count; i++){
        let y = wp.getY(i) - dt * fallSpeed;
        if (y < WY_BOT) y = WY_TOP;
        wp.setY(i, y);
        if (weather === 'snow') wp.setX(i, wp.getX(i) + Math.sin(now / 1000 * 0.5 + i) * dt * 0.18);
      }
      wp.needsUpdate = true;
    }

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
      hero.userData.flip.rotation.x = spin * Math.PI * 2;   // FORWARD roll (toward +z travel dir), not a backflip
      poseFlight(t);     // arms + legs articulate the tuck-and-open through the flip
      // trace the ACTUAL flight path into a continuous gradient curve (not predictive)
      flightPath.push(new THREE.Vector3(0, hero.position.y + 0.4, hero.position.z));
      buildTrail();
      if (t >= 1){ hero.scale.set(1, 1, 1); hero.userData.flip.rotation.set(0, 0, 0); restPose(); judgeLanding(); }
    } else if (state === FALLING){
      deadTimer += dt;   // hero is shattered into particles; just count down to the card
      if (deadTimer > 0.95) finalizeDeath();
    } else if (state === IDLE){
      // Crossy-Road perky idle: a little hop-in-place breath — stretch up at the
      // apex (never compress below rest, so feet stay planted), arms lift on the
      // way up, a small hop that never dips below the pad.
      idleClock += gdt;
      const air = Math.abs(Math.sin(idleClock * 3.2));     // 0 = grounded, 1 = apex (~1s bounces)
      if (hero.userData.isAnimal){
        const key = hero.userData.characterKey;
        const bird = ['chicken', 'duck'].includes(key), heavy = ['pig', 'cow', 'sheep', 'bear'].includes(key);
        const bounce = key === 'frog' ? air : heavy ? air * .32 : bird ? air * .65 : air * .78;
        hero.position.y = PLAT_TOP + .10 * bounce;
        hero.scale.set(1 + (heavy ? .025 : .05) * air, 1 + (bird ? .09 : .045) * air, 1 + .025 * air);
        hero.userData.flip.rotation.x = bird ? Math.sin(idleClock * 5.6) * .09 : key === 'frog' ? Math.sin(idleClock * 3.2) * .11 : 0;
        if (rig?.legL && rig?.legR) { const step = heavy ? Math.sin(idleClock * 3.2) * .12 : Math.sin(idleClock * 4.4) * .24; rig.legL.rotation.x = step; rig.legR.rotation.x = -step; }
      } else {
        hero.position.y = PLAT_TOP + 0.07 * air;
        hero.scale.set(1, 1 + 0.055 * air, 1);
      }
      if (!hero.userData.isAnimal && rig && rigBase){
        rig.armL.rotation.x = rigBase.armL - 0.16 * air;
        rig.armR.rotation.x = rigBase.armR - 0.16 * air;
        rig.legL.rotation.x = rigBase.legL; rig.legR.rotation.x = rigBase.legR;
      }
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

  function setCharacter(charKey){
    if (!COLLECTIBLE_KEYS.has(charKey)) return false;
    activeCharKey = charKey;
    if (state === IDLE || state === DEAD) {
      setHero(activeCharKey);
      hero.position.set(0, PLAT_TOP, current.along);
      restPose();
    }
    return true;
  }

  return { chargeStart, chargeRelease, restart, setCharacter, get libraryReady(){ return libraryReady; } };
}
