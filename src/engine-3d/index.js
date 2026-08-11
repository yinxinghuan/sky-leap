// ============================================================================
//  engine-3d/index.js — re-export all shared engine modules.
// ============================================================================

export { P, box, cyl, ball, cone, wedge, darken } from './prims.js';
export { character, BASE_CHARACTERS } from './characters-base.js';
export * from './archetypes.js';
export * from './monsters.js';
export * from './office.js';
export { audioUnlock, getAudioCtx, getMaster, tone, noiseBurst } from './audio.js';
export { createParticles } from './particles.js';
export { buildHeroMesh, setHero, restPose } from './hero.js';
export { setupRenderer, createBloom } from './camera.js';
