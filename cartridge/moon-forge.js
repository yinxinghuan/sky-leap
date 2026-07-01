// ============================================================================
//  cartridge/moon-forge.js — second Sky Leap cartridge.
//  Same charge-jump engine, different expression: obsidian platforms suspended
//  above a lunar forge with violet haze, molten cyan pads and cold star motes.
// ============================================================================

export const moonForgeCartridge = {
  id: 'moon-forge',

  copy: {
    titleHtml: 'Moon<br>Forge',
    subtitle: 'charge across the night foundry',
    guide: 'Hold for launch',
    leaderboardTitle: 'Moon Forgers',
    leaderboardSub: 'Longest lunar runs',
    deadTitle: 'Lost to the void',
    scoreLabel: 'Forges',
    bestLabel: 'Best',
    againBtn: 'Reignite',
    rankBtn: 'View ranking',
    perfect: 'IGNITED',
    comboFormat: 'IGNITED x{combo}',
    goodWords: ['SPARK!', 'CLEAN!', 'BRIGHT!', 'TRUE!', 'STEADY!'],
    plainWords: ['SAFE!', 'CLOSE!', 'LANDED!'],
    barely: 'EDGE SAVE!',
  },

  sky: {
    top: '#090b22',
    mid: '#1a214d',
    bot: '#49315f',
    glow: '#5ff0d0',
    glowDir: [-0.55, 0.55, 0.35],
  },

  lights: {
    hemiSky: '#b8c7ff',
    hemiGround: '#24162e',
    hemiIntensity: 0.7,
    key: '#d8f6ff',
    keyIntensity: 0.58,
    rim: '#7df7d4',
    rimIntensity: 0.42,
  },

  fog: {
    color: '#151a3a',
    near: 26,
    far: 44,
    hazeNear: 20,
    hazeFar: 34,
  },

  bloom: { strength: 0.48, radius: 0.58, threshold: 0.8 },

  world: {
    stoneTones: ['#3f3a68', '#4c416f', '#332f57', '#5b496f'],
    pad: '#71ffe0',
    pillarTop: '#5b3b85',
    pillarBottom: '#201735',
    capLip: '#2e2448',
    runeAccent: '#ffcf6a',
    bgTop: '#24305f',
    bgBottom: '#121934',
  },

  motes: { color: '#8ef7ff', count: 170, opacity: 0.62, size: 0.075 },

  weather: {
    rainColor: '#9eb8ff',
    snowColor: '#dffcff',
    rainOpacity: 0.64,
    snowOpacity: 0.82,
    rainSize: 2.6,
    snowSize: 4.2,
  },

  uiFx: {
    ring: '#71ffe0',
    pulseRing: '#ffcf6a',
    perfectBurst: '#ffcf6a',
    perfectSpark: '#71ffe0',
    puff: '#b8c7ff',
    aimA: '#ffffff',
    aimB: '#71ffe0',
  },

  audio: {
    masterGain: 0.82,
    ambientBase: 82,
    ambientOctave: 123,
  },
};
