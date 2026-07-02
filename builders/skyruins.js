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
import { P, box, darken } from '../lib/prims.js';

// Mid warm-pastel pillar-top tones (peach / dusty-rose / cream / mauve).
export const STONE_TONES = [0xe6bcae, 0xd9aeae, 0xe9cbac, 0xceb2bd];
const PAD = 0xf2e6a8;                 // pale yellow glowing landing pad (ref)
const PILLAR_H = 16;                  // pillars run from y=0 down to y=-16
const PILLAR_TOP = 0xf2649e;          // vivid brand-family candy pink top
const PILLAR_BOT = 0xf5b1c7;          // platform brand pink (#F5B1C7) bottom — whole pillar reads brand-pink
const DEFAULT_THEME = {
  pad: PAD,
  pillarTop: PILLAR_TOP,
  pillarBottom: PILLAR_BOT,
  capLip: darken(PILLAR_TOP, 0.82),
  runeAccent: P.accent,
  bgTop: 0xb2d4ef,
  bgBottom: 0xd0e4f5,
};

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

// The hero is built from the shared convenience-store character roster
// (builders/characters.js) — see game.js buildHeroMesh(). No hero builder lives
// here anymore; this module only makes the pillars + skyline.

// Glowing pale landing pad inset on a pillar top. Returns it for landing-pulse.
function padTop(g, half, w, theme = DEFAULT_THEME, ei = 0.05){
  const pad = box(w * 0.62, 0.045, half * 2 * 0.62, theme.pad, 0, 0.04, 0, { e: theme.pad, ei });
  g.add(pad);
  return [pad];
}

// ── Platform: tall rooted pink→peach pillar + glowing pad (the common one). ──
export function platStone(half, w, theme = DEFAULT_THEME){
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2, theme.pillarTop, PILLAR_H, theme.pillarBottom));
  g.userData.runeMeshes = padTop(g, half, w, theme);
  return g;
}

// ── Platform: pillar with a darker cap lip (variety). ──
export function platPillar(half, w, theme = DEFAULT_THEME){
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2, theme.pillarTop, PILLAR_H, theme.pillarBottom));
  g.add(box(w * 1.04, 0.08, half * 2 * 1.04, theme.capLip, 0, -0.06, 0)); // cap lip
  g.userData.runeMeshes = padTop(g, half, w, theme);
  return g;
}

// ── Platform: pillar with a brighter teal-hearted pad (the every-6th target). ──
export function runeDisk(half, w, theme = DEFAULT_THEME){
  const g = new THREE.Group();
  g.add(gradPillarMesh(w, half * 2, theme.pillarTop, PILLAR_H, theme.pillarBottom));
  const pad = box(w * 0.62, 0.045, half * 2 * 0.62, theme.pad, 0, 0.04, 0, { e: theme.pad, ei: 0.28 });
  g.add(pad);
  g.add(box(w * 0.24, 0.035, half * 2 * 0.24, theme.runeAccent, 0, 0.085, 0, { e: theme.runeAccent, ei: 0.55 })); // teal heart
  g.userData.runeMeshes = [pad];
  return g;
}

// ── Distant skyline — small, LONG, faint 3D pillars living in the WORLD (so
// they parallax as the hero advances — not a glued billboard). Small size fakes
// "far" (ortho has no perspective shrink); the long bodies sink deep into the
// fog so the bottoms dissolve and nothing floats. game.js lays them out +
// recycles them past the hero. ──
export function bgPillars(n = 28, theme = DEFAULT_THEME){
  const g = new THREE.Group();
  for (let i = 0; i < n; i++){
    const w = 0.24 + (i * 17 % 4) / 16;                      // VERY thin (0.24–0.43) → reads small/far
    const h = 18 + (i * 23 % 6) * 3.5;                       // VERY LONG (18–35.5), staggered → long columns sinking far into the fog
    const m = gradPillarMesh(w, w, theme.bgTop, h, theme.bgBottom);   // very faint → dissolves into the haze
    m.castShadow = false; m.receiveShadow = false;
    g.add(m);
  }
  return g;
}
