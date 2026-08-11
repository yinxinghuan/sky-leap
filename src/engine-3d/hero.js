// ============================================================================
//  engine-3d/hero.js — shared hero mesh builder and basic pose for 3D timing
//  games. buildHeroMesh / setHero / restPose are structurally identical between
//  Sky Leap and Corporate Climb. Game-specific poses (poseCharge, poseFlight,
//  poseHop) stay in each game.
// ============================================================================

/**
 * Build a hero root group: root → flip → model.
 * The flip group is used for somersault rotation; the model is a character
 * from the roster, scaled and centred so feet sit at y=0.
 *
 * @param {object} CHARACTERS - roster map { key: () => THREE.Group }
 * @param {string} charKey - which character to build
 * @param {number} heroScale - per-game HERO_SCALE constant
 * @param {string} [defaultKey] - fallback character key (default: first in roster)
 * @returns {import('three').Group} root group with userData.flip + userData.rig
 */
export function buildHeroMesh(CHARACTERS, charKey, heroScale, defaultKey) {
  const model = (CHARACTERS[charKey] || CHARACTERS[defaultKey])();
  model.scale.setScalar(heroScale);
  const bb = new THREE.Box3().setFromObject(model);
  const CENTER = (bb.max.y - bb.min.y) / 2;
  const flip = new THREE.Group();
  flip.position.y = CENTER;
  model.position.y = -bb.min.y - CENTER; // feet at root y=0, pivot at body centre
  flip.add(model);
  const root = new THREE.Group();
  root.add(flip);
  root.userData.flip = flip;
  root.userData.rig = model.userData.rig || null;
  return root;
}

/**
 * Replace the current hero with a new character.
 * Mutates the external `hero`, `rig`, and `rigBase` variables.
 *
 * @param {import('three').Scene} scene
 * @param {string} charKey
 * @param {object} refs — mutable refs { hero, rig, rigBase }
 * @param {object} CHARACTERS
 * @param {number} heroScale
 * @param {string} defaultKey
 */
export function setHero(scene, charKey, refs, CHARACTERS, heroScale, defaultKey) {
  if (refs.hero) scene.remove(refs.hero);
  refs.hero = buildHeroMesh(CHARACTERS, charKey, heroScale, defaultKey);
  scene.add(refs.hero);
  refs.rig = refs.hero.userData.rig;
  refs.rigBase = refs.rig
    ? {
        legL: refs.rig.legL.rotation.x,
        legR: refs.rig.legR.rotation.x,
        armL: refs.rig.armL.rotation.x,
        armR: refs.rig.armR.rotation.x,
      }
    : null;
}

/**
 * Reset limbs to their base rotations (neutral standing pose).
 * @param {object|null} rig
 * @param {object|null} rigBase
 */
export function restPose(rig, rigBase) {
  if (!rig || !rigBase) return;
  rig.legL.rotation.set(rigBase.legL, 0, 0);
  rig.legR.rotation.set(rigBase.legR, 0, 0);
  rig.armL.rotation.set(rigBase.armL, 0, 0);
  rig.armR.rotation.set(rigBase.armR, 0, 0);
}
