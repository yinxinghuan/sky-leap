// ============================================================================
//  engine-3d/camera.js — shared camera helpers for orthographic 3D timing
//  games. resize() logic is byte-identical; bloom setup is shared.
// ============================================================================

/**
 * Set up ACES filmic tone mapping + shadow map on a WebGLRenderer.
 * @param {import('three').WebGLRenderer} renderer
 */
export function setupRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/**
 * Create a bloom post-processing composer for the scene.
 * @param {import('three').WebGLRenderer} renderer
 * @param {import('three').Scene} scene
 * @param {import('three').Camera} camera
 * @param {object} THREE_ — the THREE module (for addons imports)
 * @param {object} [opts]
 * @returns {{ composer: object, bloom: object, resize: function }}
 */
export function createBloom(renderer, scene, camera, THREE_, opts = {}) {
  const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = THREE_;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE_.Vector2(1, 1),
    opts.strength ?? 0.4,
    opts.radius ?? 0.6,
    opts.threshold ?? 0.84,
  );
  composer.addPass(bloom);
  if (OutputPass) composer.addPass(new OutputPass());

  function resize(w, h, camera_, VIEW) {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const aspect = w / h;
    camera_.left = -VIEW * aspect;
    camera_.right = VIEW * aspect;
    camera_.top = VIEW;
    camera_.bottom = -VIEW;
    camera_.updateProjectionMatrix();
  }

  return { composer, bloom, resize };
}
