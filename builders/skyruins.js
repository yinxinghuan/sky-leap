// skyruins.js — Sky Leap asset builders (low-poly, prims.js style).
//
// Built for the trailing 3/4 perspective follow camera, NOT the iso review rig.
// CRITICAL: the camera sees the hero's BACK, so the hero's one exaggerated
// feature (a glowing teal rune-stone) lives on the BACK, not the chest.
//
// UNIFIED RHYTHM (review round 4): the rail must read as a COMPOSED path, not a
// random pile. Per-platform choices are driven by the platform INDEX on fixed
// cadences (color 4-beat, variant 6-beat, decoration beat, parity sway + hang
// wave) instead of Math.random(). Micro-texture inside a cluster may stay
// random; the macro layout is metered.
//
// FIGURE-GROUND: warm stone + the only teal in the world (besides hero) + high
// contrast = focal rail; cool desaturated clouds + low-contrast distant ruins
// = background.
//
// All builders return a THREE.Group. Platform tops sit at y=0; mass hangs below.
// Pulse-on-landing rune meshes are listed in group.userData.runeMeshes.

import * as THREE from 'three';
import { P, box, cyl, ball, cone } from '../lib/prims.js';

// 4-beat warm-coherent stone motif (light → warm → deep → clay). No cold
// outlier, so the rail reads as one chord marching toward camera.
export const STONE_TONES = [0xc7b8a4, 0xb09a82, 0x8a7a72, 0xd0b491];

// ── Hero — v1 hooded sky-pilgrim (the preferred design). Feet at y=0, faces
// +z, glowing teal rune on the BACK. (Multi-character game; swappable later.) ──
export function hero(){
  const g = new THREE.Group();
  g.add(box(0.44, 0.40, 0.40, P.panelD, 0, 0.20, 0));                          // lower robe
  g.add(box(0.46, 0.05, 0.42, P.gold, 0, 0.39, 0, { e: P.gold, ei: 0.18 }));   // gold waist trim
  g.add(box(0.40, 0.34, 0.36, P.cream, 0, 0.57, 0));                           // torso
  g.add(box(0.11, 0.30, 0.13, P.panelD, 0.255, 0.55, 0));                      // sleeves
  g.add(box(0.11, 0.30, 0.13, P.panelD, -0.255, 0.55, 0));
  g.add(box(0.24, 0.28, 0.08, P.accent, 0, 0.60, -0.21, { e: P.accent, ei: 0.95 })); // HERO FEATURE: back rune
  g.add(box(0.28, 0.26, 0.28, P.cream, 0, 0.85, 0));                           // head
  g.add(cone(0.24, 0.30, 6, P.panelD, 0, 1.02, 0));                            // pointed hood
  g.add(box(0.08, 0.08, 0.08, P.accent, 0, 1.17, 0, { e: P.accent, ei: 1.0 })); // hood rune light
  g.userData.isHero = true;
  return g;
}

// Edge decoration on a DELIBERATE BEAT (index-driven, not random):
//  - broken-pillar stub punctuation every 3rd platform (alternating side)
//  - a gold fleck on every odd platform
function addEdgeDecor(g, w, half, tone, idx){
  if (idx % 3 === 0){
    const sx = (idx % 6 === 0 ? 1 : -1) * w * 0.34;
    g.add(cyl(0.10, 0.13, 0.22, 8, tone, sx, 0.11, -half * 0.55)); // broken pillar stub
    g.add(box(0.17, 0.05, 0.17, P.stoneD, sx, 0.24, -half * 0.55)); // snapped cap
  }
  if (idx % 2 === 1){
    g.add(box(0.10, 0.09, 0.10, P.gold, (idx % 4 < 2 ? -1 : 1) * w * 0.36, 0.045, half * 0.5,
      { e: P.gold, ei: 0.15 }));
  }
}

// Teal etched ring glyph (4 thin line boxes) on a tile top. Dim — the hero's
// back-rune stays the brightest teal. Returns meshes for landing-pulse.
function ringGlyph(g, half, w){
  const t = 0.04, L = Math.min(w * 0.5, half * 1.0), ei = 0.18, y = 0.005;
  const a = box(L, 0.04, t, P.accent, 0, y, half * 0.30, { e: P.accent, ei });
  const b = box(L, 0.04, t, P.accent, 0, y, -half * 0.30, { e: P.accent, ei });
  const c = box(t, 0.04, half * 0.60, P.accent, L * 0.5, y, 0, { e: P.accent, ei });
  const d = box(t, 0.04, half * 0.60, P.accent, -L * 0.5, y, 0, { e: P.accent, ei });
  g.add(a); g.add(b); g.add(c); g.add(d);
  return [a, b, c, d];
}

// ── Platform: thin floating stone tile (the common one). Top at y=0. ──
export function platStone(half, w, tone, idx = 0){
  tone = tone || STONE_TONES[0];
  const g = new THREE.Group();
  g.add(box(w, 0.16, half * 2, tone, 0, -0.08, 0));                  // tone top slab
  const hang = 0.22 + (idx % 2) * 0.10;                              // alternating understructure depth (rhythm)
  g.add(box(w * 0.86, 0.12, half * 2 * 0.86, P.stoneD, 0, -hang, 0)); // inset dark reveal (two-tier edge)
  g.userData.runeMeshes = ringGlyph(g, half, w);
  addEdgeDecor(g, w, half, tone, idx);
  return g;
}

// ── Platform: temple-pillar capital (the every-3rd punctuation variant). ──
export function platPillar(half, w, tone, idx = 0){
  tone = tone || STONE_TONES[0];
  const g = new THREE.Group();
  g.add(box(w, 0.16, half * 2, tone, 0, -0.08, 0));                   // thin cap
  g.add(box(w * 0.70, 0.10, half * 2 * 0.70, P.panelD, 0, -0.20, 0)); // abacus
  g.add(cyl(w * 0.26, w * 0.32, 0.5, 8, tone, 0, -0.5, 0));           // shaft
  const rune = cyl(w * 0.29, w * 0.29, 0.09, 8, P.accent, 0, -0.38, 0, { e: P.accent, ei: 0.25 });
  g.add(rune);                                                         // teal rune band (dim)
  g.add(cyl(w * 0.36, w * 0.26, 0.10, 8, P.stoneD, 0, -0.78, 0));     // base flare
  g.userData.runeMeshes = [rune];
  addEdgeDecor(g, w, half, tone, idx);
  return g;
}

// ── Platform: small glowing rune disk (the every-6th "downbeat" target). ──
export function runeDisk(half, w, tone){
  const g = new THREE.Group();
  g.add(cyl(half * 0.98, half * 0.86, 0.18, 12, P.stoneD, 0, -0.09, 0));
  const rune = cyl(half * 0.82, half * 0.82, 0.05, 12, P.accent, 0, 0.005, 0, { e: P.accent, ei: 0.75 });
  g.add(rune);                                                         // glowing teal top ring
  g.add(cyl(half * 0.34, half * 0.34, 0.06, 8, P.gold, 0, 0.02, 0, { e: P.gold, ei: 0.6 })); // gold core
  g.userData.runeMeshes = [rune];
  return g;
}

// One soft cloud = a cluster of flattened, overlapping faceted balls.
function puff(g, cx, cy, cz, r, tone){
  for (let k = 0; k < 3; k++){
    const dx = (Math.random() * 2 - 1) * 0.9 * r;   // micro-texture stays random
    const dz = (Math.random() * 2 - 1) * 0.5 * r;
    const rr = r * (0.55 + Math.random() * 0.3);
    const c = ball(rr, tone, cx + dx, cy, cz + dz, 0);
    c.scale.set(1.6, 0.14, 1.3);
    c.castShadow = false; c.receiveShadow = false;
    c.userData.bob = Math.random() * Math.PI * 2;
    c.userData.baseY = cy;
    g.add(c);
  }
}

// ── Cloud sea — clusters laid on a SINE swell (metered, not scattered). Cool &
// desaturated so it recedes behind the warm rail. ──
export function cloudField(){
  const g = new THREE.Group();
  const FAR = 0xd9cdd6;   // cool dusty lavender-grey
  const NEAR = 0xeae2e6;  // slightly brighter cool white
  for (let i = 0; i < 14; i++){
    const x = Math.sin(i * 1.1) * 11;
    const z = -10 + i * 3.0;
    const y = -5.2 + Math.sin(i * 0.8) * 0.5;
    puff(g, x, y, z, 1.9 + 0.4 * Math.sin(i * 0.6), FAR);
  }
  for (let i = 0; i < 4; i++){
    const x = Math.sin(i * 1.7 + 0.5) * 4;
    const z = -6 + i * 7;
    const y = -2.9 + Math.sin(i * 0.9) * 0.3;
    puff(g, x, y, z, 1.1 + 0.3 * Math.sin(i), NEAR);
  }
  return g;
}

// ── Distant ruin silhouettes — huge, far, low-contrast, warmed into the
// palette with a faint teal motif band. Pure background depth. ──
export function bgRuins(){
  const g = new THREE.Group();
  const TONE = 0x9a7e80;   // warm mauve-grey, harmonizes with dusk + fog
  const specs = [
    { x: -17, z: 30, h: 14, w: 2.3 },
    { x: 15, z: 42, h: 17, w: 2.6 },
    { x: 21, z: 26, h: 10, w: 2.0 },
    { x: -22, z: 48, h: 19, w: 2.5 },
    { x: -10, z: 55, h: 12, w: 2.1 },
  ];
  for (const s of specs){
    const y = -6 + s.h / 2;
    const ob = box(s.w, s.h, s.w, TONE, s.x, y, s.z);
    ob.castShadow = false; ob.receiveShadow = false;
    g.add(ob);
    const cap = box(s.w * 1.25, 0.7, s.w * 1.25, TONE, s.x, y + s.h / 2, s.z);
    cap.castShadow = false; cap.receiveShadow = false;
    g.add(cap);
    // faint teal motif band — echoes the rail's rune family across scale
    const band = box(s.w * 1.04, 0.5, s.w * 1.04, P.accent, s.x, y + s.h * 0.30, s.z,
      { e: P.accent, ei: 0.08 });
    band.castShadow = false; band.receiveShadow = false;
    g.add(band);
  }
  const c1 = cyl(1.8, 2.0, 11, 8, TONE, 9, -0.5, 38); c1.castShadow = false; g.add(c1);
  const c2 = cyl(1.5, 1.7, 8, 8, TONE, -13, -2, 33); c2.castShadow = false; g.add(c2);
  return g;
}
