// ============================================================================
//  cartridge/types.js — CartridgeSpec for the Sky Leap 3D timing engine.
//  Engine (game.js) owns gameplay: charge physics, landing judge, platform
//  spacing, camera, scoring, leaderboard and fail state. Cartridge owns theme:
//  colours, copy, feedback words, particles, fog, weather and audio mood.
// ============================================================================

/**
 * @typedef {{
 *   id: string,
 *   copy: SkyLeapCopy,
 *   sky: SkyColors,
 *   lights: LightColors,
 *   fog: FogColors,
 *   bloom: BloomOpts,
 *   world: WorldTheme,
 *   motes: MotesColors,
 *   weather: WeatherTheme,
 *   uiFx: UIFxTheme,
 *   audio: AudioMood,
 * }} SkyLeapCartridge
 *
 * @typedef {{
 *   titleHtml: string,
 *   subtitle: string,
 *   guide: string,
 *   leaderboardTitle: string,
 *   leaderboardSub: string,
 *   deadTitle: string,
 *   scoreLabel: string,
 *   bestLabel: string,
 *   againBtn: string,
 *   rankBtn: string,
 *   perfect: string,
 *   comboFormat: string,
 *   goodWords: string[],
 *   plainWords: string[],
 *   barely: string,
 * }} SkyLeapCopy
 *
 * @typedef {{ top: string, mid: string, bot: string, glow: string, glowDir: number[] }} SkyColors
 * @typedef {{ hemiSky: string, hemiGround: string, hemiIntensity: number, key: string, keyIntensity: number, rim: string, rimIntensity: number }} LightColors
 * @typedef {{ color: string, near: number, far: number, hazeNear: number, hazeFar: number }} FogColors
 * @typedef {{ strength: number, radius: number, threshold: number }} BloomOpts
 * @typedef {{ stoneTones: string[], varyPillarTones?: boolean, pad: string, pillarTop: string, pillarBottom: string, capLip: string, runeAccent: string, bgTop: string, bgBottom: string }} WorldTheme
 * @typedef {{ color: string, count: number, opacity: number, size: number }} MotesColors
 * @typedef {{ rainColor: string, snowColor: string, rainOpacity: number, snowOpacity: number, rainSize: number, snowSize: number }} WeatherTheme
 * @typedef {{ ring: string, pulseRing: string, perfectBurst: string, perfectSpark: string, puff: string, aimA: string, aimB: string }} UIFxTheme
 * @typedef {{ masterGain: number, ambientBase: number, ambientOctave: number }} AudioMood
 */
