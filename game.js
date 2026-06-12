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
import { hero as buildHero, platStone, platPillar, runeDisk, cloudField, bgRuins, STONE_TONES } from './builders/skyruins.js?v=7';

// --- tunables ---------------------------------------------------------------
const CHARGE_MAX = 1.05;          // seconds to full charge
const MIN_DIST = 2.0;             // jump distance at zero charge (world units along)
const MAX_DIST = 6.2;             // jump distance at full charge
const BASE_H = 1.2;               // arc apex height at zero charge
const PEAK_H = 2.1;               // extra apex height at full charge
const AIR_BASE = 0.42;            // flight time at zero charge
const AIR_EXTRA = 0.30;           // extra flight time at full charge

const RAIL_W = 2.0;               // platform lateral width (x) -- single rail
const PLAT_H = 0.7;               // platform block height (top sits at y=0)
const PLAT_TOP = 0;               // hero stands on y=0

// world generation -- the reachability invariant lives here.
// KEY: gap (center-to-center) must exceed platform LENGTH (2*half) so there's
// visible void between pads — otherwise platforms merge into a continuous road.
const REACH_SAFETY = 0.86;
const GAP_NEAR = 3.4, GAP_FAR = 5.2;       // gap (center-to-center) easy->hard
const GAP_JITTER = 0.3;
const GAP_MAX = MAX_DIST * REACH_SAFETY;   // = 5.33, hard cap so full charge always reaches
const SIZE_BASE = 1.1, SIZE_MIN = 0.7;     // platform half-length (along) easy->hard
const SIZE_JITTER = 0.18;
const DIFF_OVER = 42;             // platform index at which difficulty saturates
const WARMUP = 3;                 // first N platforms forced wide + near, no death

const AHEAD = 6;                  // platforms to keep spawned ahead
const BEHIND = 2;                 // recycle platforms more than this behind

const CAM_BACK = 6.6;             // camera distance behind hero (smaller z)
const CAM_UP = 4.8;               // camera height (raised to see more of the rail)
const CAM_LERP = 5;               // follow responsiveness (per second)
const CAM_LOOK_AHEAD = 0.42;      // how far toward the next platform the look-target sits

// --- helpers ----------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const easeInQuad = c => c * c;
const rand = (a, b) => a + Math.random() * (b - a);

function jumpDist(c){ return MIN_DIST + (MAX_DIST - MIN_DIST) * easeInQuad(c); }
function arcHeight(c){ return BASE_H + c * PEAK_H; }

export function startGame({ canvas, hud }){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc78a86, 22, 52);   // warm-mauve horizon haze (harmonizes with ruins)

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const camLook = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x4a3a5a, 0.7));
  const key = new THREE.DirectionalLight(0xfff4d6, 1.5);
  key.position.set(6, 13, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 60;
  key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.35);
  fill.position.set(-7, 5, -3);
  scene.add(fill);

  function resize(){
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const hero = buildHero();
  scene.add(hero);

  // cloud sea — follows the hero so the void below is always filled
  const clouds = cloudField();
  scene.add(clouds);

  // distant ruin silhouettes — far-background depth, trails the hero on the horizon
  const bgr = bgRuins();
  scene.add(bgr);

  // charge ring (ground, grows with charge)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 32),
    new THREE.MeshBasicMaterial({ color: 0x3fb6ac, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

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
  let launchT = 0, airTime = 0, startAlong = 0, dist = 0, apex = 0;

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
    hero.visible = true;
    ring.material.opacity = 0;
    camera.position.set(0, CAM_UP, current.along - CAM_BACK);
    camLook.set(0, 0.5, current.along);
    camera.lookAt(camLook);
    hud.setScore(0); hud.setCombo(0); hud.setReady(true); hud.setDead(null);
  }

  function chargeStart(){
    if (state !== IDLE) return;
    state = CHARGING;
    charge = 0;
  }
  function chargeRelease(){
    if (state !== CHARGING) return;
    const c = clamp(charge / CHARGE_MAX, 0, 1);
    dist = jumpDist(c);
    apex = arcHeight(c);
    airTime = AIR_BASE + c * AIR_EXTRA;
    startAlong = current.along;
    launchT = 0;
    state = LAUNCH;
    ring.material.opacity = 0;
    hero.scale.set(1, 1, 1);
  }

  function judgeLanding(){
    const landAlong = startAlong + dist;
    let landed = null;
    for (const p of plats){
      if (p.idx <= current.idx) continue;
      if (Math.abs(landAlong - p.along) <= p.half){ landed = p; break; }
    }
    if (!landed && current.idx < WARMUP){
      landed = plats.find(p => p.idx === current.idx + 1) || null;
    }
    if (!landed){ die(); return; }
    current = landed;
    score = landed.idx;
    const d = Math.abs(landAlong - landed.along);
    if (d <= landed.half * 0.22){ combo += 1; flashPlatform(landed, true); }
    else if (d <= landed.half * 0.70){ flashPlatform(landed, false); }
    else { combo = 0; }
    hud.setScore(score);
    hud.setCombo(combo);
    hero.position.set(0, PLAT_TOP, landAlong);
    state = IDLE;
    ensureAhead();
    recycleBehind();
  }

  function flashPlatform(p, perfect){
    const m = p.mesh.userData.runeMat;
    if (m) m.emissiveIntensity = perfect ? 1.3 : 0.55;
  }

  function die(){
    state = FALLING;
    deadTimer = 0;
    combo = 0;
    hud.setCombo(0);
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
    const tz = hero.position.z - CAM_BACK;
    let ty = CAM_UP;
    if (state === LAUNCH){
      const t = clamp(launchT / airTime, 0, 1);
      ty += 0.8 * apex * Math.sin(Math.PI * t) * 0.25;
    }
    if (state !== FALLING){
      camera.position.x = lerp(camera.position.x, 0, CAM_LERP * dt);
      camera.position.y = lerp(camera.position.y, ty, CAM_LERP * dt);
      camera.position.z = lerp(camera.position.z, tz, CAM_LERP * dt);
    }
    const next = plats.find(p => p.idx === current.idx + 1);
    const aheadZ = next ? next.along : hero.position.z + 3;
    const lookZ = lerp(hero.position.z, aheadZ, CAM_LOOK_AHEAD);
    camLook.x = lerp(camLook.x, 0, CAM_LERP * dt);
    camLook.y = lerp(camLook.y, 0.4, CAM_LERP * dt);
    camLook.z = lerp(camLook.z, lookZ, CAM_LERP * dt);
    camera.lookAt(camLook);
  }

  let last = performance.now();
  let idleClock = 0;
  function tick(now){
    requestAnimationFrame(tick);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    // cloud sea + distant ruins trail the hero so the backdrop is always present
    clouds.position.z = hero.position.z;
    bgr.position.z = hero.position.z;
    for (const c of clouds.children){
      c.position.y = c.userData.baseY + Math.sin(now / 1000 * 0.5 + c.userData.bob) * 0.12;
    }

    if (state === CHARGING){
      charge = Math.min(charge + dt, CHARGE_MAX);
      const c = clamp(charge / CHARGE_MAX, 0, 1);
      hero.scale.set(1 + 0.18 * c, 1 - 0.34 * c, 1 + 0.18 * c);
      ring.position.set(hero.position.x, 0.02, hero.position.z);
      ring.scale.setScalar(0.5 + 1.3 * c);
      ring.material.opacity = 0.25 + 0.5 * c;
    } else if (state === LAUNCH){
      launchT += dt;
      const t = clamp(launchT / airTime, 0, 1);
      hero.position.z = startAlong + dist * t;
      hero.position.y = PLAT_TOP + 4 * apex * t * (1 - t);
      const stretch = 1 + 0.22 * Math.sin(Math.PI * t) * (1 - 0.5 * t);
      hero.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
      if (t >= 1){ hero.scale.set(1, 1, 1); judgeLanding(); }
    } else if (state === FALLING){
      deadTimer += dt;
      hero.position.y -= (3 + deadTimer * 9) * dt;
      hero.position.z += dist * 0.15 * dt;
      hero.rotation.x += dt * 3;
      if (deadTimer > 0.85) finalizeDeath();
    } else if (state === IDLE){
      idleClock += dt;
      const b = Math.sin(idleClock * 2.2) * 0.012;
      hero.scale.set(1, 1 + b, 1);
    }

    updateCamera(dt);
    renderer.render(scene, camera);
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
