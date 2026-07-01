// ============================================================================
//  cartridge/sky-ruins.js — canonical Sky Leap theme.
//  Original Sky Leap values, extracted from game.js and index.html.
// ============================================================================

export const skyRuinsCartridge = {
  id: 'sky-ruins',

  copy: {
    titleHtml: 'Sky<br>Leap',
    subtitle: 'hold & release to soar',
    guide: 'Hold to charge',
    leaderboardTitle: 'Sky Pilgrims',
    leaderboardSub: 'Furthest leapers',
    deadTitle: 'Fell into the clouds',
    scoreLabel: 'Reached',
    bestLabel: 'Best',
    againBtn: 'Leap again',
    rankBtn: 'View ranking',
    perfect: 'PERFECT',
    comboFormat: 'PERFECT x{combo}',
    goodWords: ['NICE!', 'SMOOTH!', 'CLEAN!', 'NEAT!', 'SLICK!'],
    plainWords: ['OKAY!', 'PHEW!', 'CLOSE!'],
    barely: 'BARELY!',
  },

  sky: {
    top: '#5aa3da',
    mid: '#8cc0e8',
    bot: '#c4e0f4',
    glow: '#ccdd8a',
    glowDir: [-0.4, 0.72, 0.45],
  },

  lights: {
    hemiSky: '#eef6f0',
    hemiGround: '#f4e0d6',
    hemiIntensity: 0.82,
    key: '#fff4e8',
    keyIntensity: 0.5,
    rim: '#daf0ea',
    rimIntensity: 0.3,
  },

  fog: {
    color: '#9cc2e6',
    near: 28,
    far: 43,
    hazeNear: 22,
    hazeFar: 36,
  },

  bloom: { strength: 0.4, radius: 0.5, threshold: 0.85 },

  motes: { color: '#ffdca0', count: 150, opacity: 0.75, size: 0.09 },

  weather: {
    rainColor: '#c8d6ee',
    snowColor: '#ffffff',
    rainOpacity: 0.78,
    snowOpacity: 0.95,
    rainSize: 3.0,
    snowSize: 5.0,
  },

  uiFx: {
    ring: '#3fb6ac',
    pulseRing: '#9ff0e6',
    perfectBurst: '#f2c14e',
    perfectSpark: '#9ff0e6',
    puff: '#eee7d6',
    aimA: '#ffffff',
    aimB: '#ffffff',
  },

  audio: {
    masterGain: 0.85,
    ambientBase: 110,
    ambientOctave: 146.8,
  },
};
