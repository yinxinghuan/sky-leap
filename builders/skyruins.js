// skyruins.js — Sky Leap asset builders (low-poly, prims.js style).
//
// Reference look ("Leap On!"): tall ROOTED pillars rising from the haze, with a
// vertical gradient (warm pastel top → pale mint bottom that dissolves into the
// fog) and a glowing pale pad on top. Distant faint pillars form a skyline.
// Seen from a trailing 45° oblique camera.
//
// All builders return a THREE.Group. Pillar TOPS sit at y=0 (hero lands there);
// the body extends far down. Pulse-on-landing pad meshes are in
// group.userData.runeMeshes.

import * as THREE from 'three';
import { P, box, cyl, cone, darken } from '../lib/prims.js';

// Mid warm-pastel pillar-top tones (peach / dusty-rose / cream / mauve).
export const STONE_TONES = [0xe6bcae, 0xd9aeae, 0xe9cbac, 0xceb2bd];
const PAD = 0xebcf8c;                 // soft warm glowing landing pad
const PILLAR_H = 16;                  // pillars run from y=0 down to y=-16
const PILLAR_BOT = 0xdfece4;          // pale mint the body fades to (≈ fog) at the bottom

const clamp01 = v => Math.max(0, Math.min(1, v));

// One shared flat-shaded vertex-colored material for every gradient pillar —
// gives the vertical gradient AND keeps per-face flat-shaded lighting, with no
// per-instance material to leak.
const gradMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });

// A tall box whose vertices are colored top→bottom (top at y=0, extends down).
function gradPillarMesh(w, d, topColor, h = PILLAR_H, botColor = PILLAR_BOT){
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0);                       // top face at y=0
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cT = new THREE.Color(topColor), cB = new THREE.Color(botColor), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++){
    // transition over the top ~10 units so the gradient is visible on the
    // exposed part of the pillar (not stretched across its full buried length)
    const t = clamp01(-pos.getY(i) / Math.min(h, 10));
    tmp.copy(cT).lerp(cB, t);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = new THREE.Mesh(geo, gradMat);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  return m;
}

// ── Hero — hooded sky-pilgrim (unchanged; polished later). Feet at y=0. ──
export function hero(){
  const g = new THREE.Group();
  g.add(box(0.44, 0.40, 0.40, P.panelD, 0, 0.20, 0));
  g.add(box(0.46, 0.05, 0.42, P.gold, 0, 0.39, 0, { e: P.gold, ei: 0.18 }));
  g.add(box(0.40, 0.34, 0.36, P.cream, 0, 0.57, 0));
  g.add(box(0.11, 0.30, 0.13, P.panelD, 0.255, 0.55, 0));
  g.add(box(0.11, 0.30, 0.13, P.panelD, -0.255, 0.55, 0));
  g.add(box(0.24, 0.28, 0.08, P.accent, 0, 0.60, -0.21, { e: P.accent, ei: 0.95 }));
  g.add(box(0.28, 0.26, 0.28, P.cream, 0, 0.85, 0));
  g.add(cone(0.24, 0.30, 6, P.panelD, 0, 1.02, 0));
  g.add(box(0.08, 0.08, 0.08, P.accent, 0, 1.17, 0, { e: P.accent, ei: 1.0 }));
  g.userData.isHero = true;
  return g;
}

// Glowing pale landing pad inset on a pillar top. Returns it for landing-pulse.
function padTop(g, half, w, ei = 0.05){
  const pad = box(w * 0.62, 0.05, half * 2 * 0.62, PAD, 0, 0.02, 0, { e: PAD, ei });
  g.add(pad);
  return [pad];
}

// ── Platform: tall rooted gradient pillar + glowing pad (the common one). ──
export function platStone(half, w, tone){
  tone = tone || STONE_TONES[0];
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2, tone));
  g.userData.runeMeshes = padTop(g, half, w);
  return g;
}

// ── Platform: pillar with a darker cap lip (variety). ──
export function platPillar(half, w, tone){
  tone = tone || STONE_TONES[0];
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2, tone));
  g.add(box(w * 1.04, 0.12, half * 2 * 1.04, darken(tone, 0.8), 0, -0.06, 0)); // cap lip
  g.userData.runeMeshes = padTop(g, half, w);
  return g;
}

// ── Platform: pillar with a brighter teal-hearted pad (the every-6th target). ──
export function runeDisk(half, w, tone){
  tone = tone || STONE_TONES[2];
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2, tone));
  const pad = box(w * 0.62, 0.05, half * 2 * 0.62, PAD, 0, 0.02, 0, { e: PAD, ei: 0.28 });
  g.add(pad);
  g.add(box(w * 0.24, 0.06, half * 2 * 0.24, P.accent, 0, 0.03, 0, { e: P.accent, ei: 0.55 })); // teal heart
  g.userData.runeMeshes = [pad];
  return g;
}

// ── Distant skyline — faint tall pillars far back/aside, dissolving into haze.
// Replaces the cloud sea: gives the "far city of pillars" depth from the ref. ──
export function bgPillars(){
  const g = new THREE.Group();
  // varied positions (far z, wide x), varied top heights → a skyline silhouette
  const specs = [
    { x: -16, z: 22, top: 3.5, w: 2.2 },
    { x: 14, z: 30, top: 5.0, w: 2.6 },
    { x: 22, z: 20, top: 1.5, w: 2.0 },
    { x: -22, z: 38, top: 6.0, w: 2.4 },
    { x: -9, z: 46, top: 2.5, w: 2.0 },
    { x: 18, z: 44, top: 4.0, w: 2.3 },
    { x: -28, z: 30, top: 3.0, w: 2.2 },
    { x: 28, z: 34, top: 2.0, w: 2.1 },
    { x: 6, z: 56, top: 4.5, w: 2.4 },
    { x: -14, z: 58, top: 3.0, w: 2.2 },
  ];
  for (const s of specs){
    // pale, low-contrast top→bottom so they read as fogged silhouettes
    const m = gradPillarMesh(s.w, s.w, 0xc8ddd5, 22, 0xdfece4);
    m.position.set(s.x, s.top, s.z);
    m.castShadow = false; m.receiveShadow = false;
    g.add(m);
  }
  return g;
}
