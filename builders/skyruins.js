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
import { P, box, cone, darken } from '../lib/prims.js';

// Mid warm-pastel pillar-top tones (peach / dusty-rose / cream / mauve).
export const STONE_TONES = [0xe6bcae, 0xd9aeae, 0xe9cbac, 0xceb2bd];
const PAD = 0xf2e6a8;                 // pale yellow glowing landing pad (ref)
const PILLAR_H = 16;                  // pillars run from y=0 down to y=-16
const PILLAR_TOP = 0xdfa3a8;          // rose-pink top (ref)
const PILLAR_BOT = 0xf4e6d2;          // pale cream bottom — body fades to light & dissolves

const clamp01 = v => Math.max(0, Math.min(1, v));

// One shared flat-shaded vertex-colored material for every gradient pillar —
// gives the vertical gradient AND keeps per-face flat-shaded lighting, with no
// per-instance material to leak.
const gradMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });

// A tall box whose vertices are colored top→bottom (top at y=0, extends down).
function gradPillarMesh(w, d, topColor = PILLAR_TOP, h = PILLAR_H, botColor = PILLAR_BOT){
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0);                       // top face at y=0
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cT = new THREE.Color(topColor), cB = new THREE.Color(botColor), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++){
    // fade over the top ~9 units (the visible body) so it reads pink → peach →
    // pale cream within frame, then stays light below
    const t = clamp01(-pos.getY(i) / 9);
    tmp.copy(cT).lerp(cB, t);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = new THREE.Mesh(geo, gradMat);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  return m;
}

// ── Hero — hooded sky-pilgrim. Structure for animation:
//   root  (world position + squash on root.scale, feet-pivoted at y=0)
//    └ flip (rotation pivot at body center → somersault during the leap)
//       └ model (the parts, scaled up so the hero reads bigger on the wide pads)
// game.js sets root.userData.flip.rotation.x for the jump somersault. ──
const HERO_SCALE = 1.5;
export function hero(){
  const root = new THREE.Group();
  const flip = new THREE.Group();
  const model = new THREE.Group();
  model.add(box(0.44, 0.40, 0.40, P.panelD, 0, 0.20, 0));
  model.add(box(0.46, 0.05, 0.42, P.gold, 0, 0.39, 0, { e: P.gold, ei: 0.18 }));
  model.add(box(0.40, 0.34, 0.36, P.cream, 0, 0.57, 0));
  model.add(box(0.11, 0.30, 0.13, P.panelD, 0.255, 0.55, 0));
  model.add(box(0.11, 0.30, 0.13, P.panelD, -0.255, 0.55, 0));
  model.add(box(0.24, 0.28, 0.08, P.accent, 0, 0.60, -0.21, { e: P.accent, ei: 0.95 }));
  model.add(box(0.28, 0.26, 0.28, P.cream, 0, 0.85, 0));
  model.add(cone(0.24, 0.30, 6, P.panelD, 0, 1.02, 0));
  model.add(box(0.08, 0.08, 0.08, P.accent, 0, 1.17, 0, { e: P.accent, ei: 1.0 }));
  model.scale.setScalar(HERO_SCALE);
  const CENTER = 0.55 * HERO_SCALE;     // flip pivots around the body's mid-height
  flip.position.y = CENTER;
  model.position.y = -CENTER;           // keep feet at y=0 when flip.rotation = 0
  flip.add(model);
  root.add(flip);
  root.userData.isHero = true;
  root.userData.flip = flip;
  return root;
}

// Glowing pale landing pad inset on a pillar top. Returns it for landing-pulse.
function padTop(g, half, w, ei = 0.05){
  const pad = box(w * 0.62, 0.05, half * 2 * 0.62, PAD, 0, 0.02, 0, { e: PAD, ei });
  g.add(pad);
  return [pad];
}

// ── Platform: tall rooted pink→peach pillar + glowing pad (the common one). ──
export function platStone(half, w){
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2));
  g.userData.runeMeshes = padTop(g, half, w);
  return g;
}

// ── Platform: pillar with a darker cap lip (variety). ──
export function platPillar(half, w){
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2));
  g.add(box(w * 1.04, 0.12, half * 2 * 1.04, darken(PILLAR_TOP, 0.82), 0, -0.06, 0)); // cap lip
  g.userData.runeMeshes = padTop(g, half, w);
  return g;
}

// ── Platform: pillar with a brighter teal-hearted pad (the every-6th target). ──
export function runeDisk(half, w){
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2));
  const pad = box(w * 0.62, 0.05, half * 2 * 0.62, PAD, 0, 0.02, 0, { e: PAD, ei: 0.28 });
  g.add(pad);
  g.add(box(w * 0.24, 0.06, half * 2 * 0.24, P.accent, 0, 0.03, 0, { e: P.accent, ei: 0.55 })); // teal heart
  g.userData.runeMeshes = [pad];
  return g;
}

// ── Distant skyline — a FLAT backdrop "billboard" the game keeps in front of
// the camera (far away + fogged). A row of faint teal building silhouettes with
// uneven tops; long bodies run off the bottom / fade into the haze, so only the
// tops read near the horizon (no floating, no ortho pop-in). ──
const SKYLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x88c3b7, fog: true });
export function bgSkyline(){
  const g = new THREE.Group();
  const tops = [5, 8, 3.5, 7, 4.5, 9, 5.5, 6.5, 4, 7.5, 3, 8.5, 5, 6, 4.5, 7];
  const H = 26;                 // tall — bodies run far down, off-screen / fogged
  let x = -36;
  for (let i = 0; i < tops.length; i++){
    const w = 2.0 + (i * 37 % 16) / 10;          // deterministic width variety
    const top = tops[i];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, 0.3), SKYLINE_MAT);
    m.position.set(x + w / 2, top - H / 2, 0);    // top edge at local y = `top`
    m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false;
    g.add(m);
    x += w + 0.3 + (i * 53 % 7) / 10;             // small varied gaps
  }
  return g;
}
