#!/usr/bin/env node
// ============================================================================
//  gen-cartridge.js — one sentence -> Sky Leap cartridge.
//
//  This is intentionally conservative: it generates expression data only.
//  The locked engine still owns charge distance, platform spacing, landing
//  windows, scoring, camera and fail states.
//
//  Usage:
//    node scripts/gen-cartridge.js --sentence "a moon forge over violet clouds"
//    node scripts/gen-cartridge.js --sentence "..." --activate
//    node scripts/gen-cartridge.js --sentence "..." --dry-run
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CARTRIDGE_DIR = path.join(ROOT, 'cartridge');
const INDEX_PATH = path.join(CARTRIDGE_DIR, 'index.js');

function parseArgs(argv) {
  const args = { sentence: '', activate: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sentence' && argv[i + 1]) args.sentence = argv[++i];
    else if (argv[i] === '--activate') args.activate = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  if (!args.sentence) {
    console.error('Usage: node scripts/gen-cartridge.js --sentence "a sky theme" [--activate] [--dry-run]');
    process.exit(1);
  }
  return args;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'generated-sky';
}

function camelFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function titleFromSentence(sentence) {
  const words = sentence
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^(the|and|with|over|under|into|from|for|your|you|its|their|while|through)$/i.test(w))
    .slice(0, 2);
  const picked = words.length ? words : ['Sky', 'Leap'];
  return picked.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function classify(sentence) {
  const s = sentence.toLowerCase();
  if (/(moon|night|void|star|space|lunar|shadow|cosmic)/.test(s)) return 'lunar';
  if (/(fire|lava|forge|ember|volcano|dragon|inferno)/.test(s)) return 'ember';
  if (/(forest|garden|moss|jungle|leaf|tree|frog)/.test(s)) return 'forest';
  if (/(ice|snow|frost|winter|glacier|crystal)/.test(s)) return 'frost';
  if (/(candy|toy|cake|bubble|dream|rainbow)/.test(s)) return 'candy';
  return 'aurora';
}

const THEMES = {
  lunar: {
    sky: ['#090b22', '#1a214d', '#49315f', '#5ff0d0'],
    glowDir: [-0.55, 0.55, 0.35],
    lights: ['#b8c7ff', '#24162e', 0.7, '#d8f6ff', 0.58, '#7df7d4', 0.42],
    fog: ['#151a3a', 26, 44, 20, 34],
    world: ['#71ffe0', '#5b3b85', '#201735', '#2e2448', '#ffcf6a', '#24305f', '#121934'],
    stoneTones: ['#3f3a68', '#4c416f', '#332f57', '#5b496f'],
    fx: ['#71ffe0', '#ffcf6a', '#ffcf6a', '#71ffe0', '#b8c7ff', '#ffffff', '#71ffe0'],
    motes: ['#8ef7ff', 170, 0.62, 0.075],
    audio: [0.82, 82, 123],
    words: ['SPARK!', 'CLEAN!', 'BRIGHT!', 'TRUE!', 'STEADY!'],
  },
  ember: {
    sky: ['#160805', '#4b1609', '#8b3517', '#ff8a22'],
    glowDir: [0.45, 0.05, 0.55],
    lights: ['#ffd0a0', '#2b0d08', 0.68, '#ffe1ba', 0.72, '#ff5530', 0.36],
    fog: ['#24100a', 24, 42, 18, 32],
    world: ['#ffd36a', '#8a2d24', '#2a1010', '#4a1714', '#ffef9a', '#5f1d14', '#210b09'],
    stoneTones: ['#7a332a', '#943d2c', '#6a2928', '#a85232'],
    fx: ['#ffd36a', '#ff6a2a', '#ffcf62', '#ff6a2a', '#ffd0a0', '#fff3d4', '#ff8a22'],
    motes: ['#ffb04a', 190, 0.58, 0.08],
    audio: [0.86, 73, 109],
    words: ['FORGED!', 'HOT!', 'CLEAN!', 'BLAZED!', 'TRUE!'],
  },
  forest: {
    sky: ['#133326', '#2f6f55', '#8fbe8a', '#f0d88a'],
    glowDir: [-0.4, 0.72, 0.45],
    lights: ['#e6ffe8', '#23351f', 0.78, '#fff2c0', 0.5, '#72d88a', 0.35],
    fog: ['#8fc8a8', 25, 43, 20, 34],
    world: ['#e3f5a3', '#4e9a66', '#24593e', '#32744f', '#ffd77a', '#7ab997', '#d2ead8'],
    stoneTones: ['#6fa070', '#8aac70', '#5f8e66', '#9fb978'],
    fx: ['#a8ef80', '#ffd77a', '#ffd77a', '#a8ef80', '#e2f0d0', '#ffffff', '#a8ef80'],
    motes: ['#f4e9a8', 160, 0.7, 0.08],
    audio: [0.78, 98, 147],
    words: ['ROOTED!', 'CLEAN!', 'GREEN!', 'SOFT!', 'TRUE!'],
  },
  frost: {
    sky: ['#dff5ff', '#93c9ef', '#d9e8fb', '#ffffff'],
    glowDir: [-0.35, 0.78, 0.4],
    lights: ['#ffffff', '#c8e6f4', 0.84, '#f9fdff', 0.48, '#8ee8ff', 0.32],
    fog: ['#d9eef8', 24, 40, 18, 31],
    world: ['#ffffff', '#8db8d4', '#d6eef9', '#7faaca', '#73f3ff', '#b8d5e6', '#e4f6ff'],
    stoneTones: ['#b7d8e8', '#d2eaf4', '#a8cfe2', '#c8dce8'],
    fx: ['#73f3ff', '#ffffff', '#ffffff', '#73f3ff', '#eefbff', '#ffffff', '#73f3ff'],
    motes: ['#ffffff', 190, 0.82, 0.07],
    audio: [0.74, 131, 196],
    words: ['CRISP!', 'CLEAN!', 'GLIDE!', 'BRIGHT!', 'TRUE!'],
  },
  candy: {
    sky: ['#ffc8e7', '#a8d9ff', '#fff0b8', '#ffffff'],
    glowDir: [-0.5, 0.65, 0.45],
    lights: ['#ffffff', '#ffd6ec', 0.82, '#fff7c2', 0.55, '#ff8fce', 0.35],
    fog: ['#ffd9ed', 28, 45, 22, 37],
    world: ['#fff3a8', '#ff75bb', '#ffb1d5', '#d9589a', '#7ff4ff', '#a8d9ff', '#fff5c8'],
    stoneTones: ['#ff8fce', '#ffc66d', '#8fdcff', '#cba6ff'],
    fx: ['#7ff4ff', '#fff3a8', '#fff3a8', '#7ff4ff', '#ffffff', '#ffffff', '#ff8fce'],
    motes: ['#ffffff', 180, 0.78, 0.085],
    audio: [0.82, 156, 208],
    words: ['POP!', 'SWEET!', 'CLEAN!', 'BOUNCE!', 'NEAT!'],
  },
  aurora: {
    sky: ['#10203a', '#245d78', '#82b5b0', '#d7f59a'],
    glowDir: [-0.45, 0.7, 0.45],
    lights: ['#e6fff8', '#233048', 0.76, '#f1ffe0', 0.52, '#82ffc8', 0.38],
    fog: ['#7faec4', 27, 44, 21, 35],
    world: ['#d7f59a', '#4f92a8', '#24576a', '#37758b', '#82ffc8', '#6f9eb4', '#d3edf0'],
    stoneTones: ['#6aa6b4', '#79b9a5', '#5a91aa', '#8bc2b6'],
    fx: ['#82ffc8', '#d7f59a', '#d7f59a', '#82ffc8', '#e8fff9', '#ffffff', '#82ffc8'],
    motes: ['#d7f59a', 165, 0.68, 0.08],
    audio: [0.8, 110, 165],
    words: ['SOARED!', 'CLEAN!', 'GLOW!', 'TRUE!', 'SMOOTH!'],
  },
};

function cartridgeFor(sentence) {
  const kind = classify(sentence);
  const theme = THEMES[kind];
  const slug = slugify(sentence);
  const [top, bottom] = titleFromSentence(sentence);
  return {
    id: slug,
    copy: {
      titleHtml: `${top}<br>${bottom || 'Leap'}`,
      subtitle: sentence.toLowerCase(),
      guide: 'Hold to charge',
      leaderboardTitle: `${top} Leapers`,
      leaderboardSub: 'Longest runs',
      deadTitle: kind === 'frost' ? 'Lost in the whiteout' : kind === 'ember' ? 'Fell into the heat' : 'Lost to the sky',
      scoreLabel: 'Reached',
      bestLabel: 'Best',
      againBtn: 'Leap again',
      rankBtn: 'View ranking',
      perfect: theme.words[0].replace('!', ''),
      comboFormat: `${theme.words[0].replace('!', '')} x{combo}`,
      goodWords: theme.words,
      plainWords: ['SAFE!', 'CLOSE!', 'LANDED!'],
      barely: 'EDGE SAVE!',
    },
    sky: {
      top: theme.sky[0],
      mid: theme.sky[1],
      bot: theme.sky[2],
      glow: theme.sky[3],
      glowDir: theme.glowDir,
    },
    lights: {
      hemiSky: theme.lights[0],
      hemiGround: theme.lights[1],
      hemiIntensity: theme.lights[2],
      key: theme.lights[3],
      keyIntensity: theme.lights[4],
      rim: theme.lights[5],
      rimIntensity: theme.lights[6],
    },
    fog: {
      color: theme.fog[0],
      near: theme.fog[1],
      far: theme.fog[2],
      hazeNear: theme.fog[3],
      hazeFar: theme.fog[4],
    },
    bloom: { strength: 0.46, radius: 0.56, threshold: 0.82 },
    world: {
      stoneTones: theme.stoneTones,
      pad: theme.world[0],
      pillarTop: theme.world[1],
      pillarBottom: theme.world[2],
      capLip: theme.world[3],
      runeAccent: theme.world[4],
      bgTop: theme.world[5],
      bgBottom: theme.world[6],
    },
    motes: {
      color: theme.motes[0],
      count: theme.motes[1],
      opacity: theme.motes[2],
      size: theme.motes[3],
    },
    weather: {
      rainColor: theme.lights[5],
      snowColor: '#ffffff',
      rainOpacity: 0.66,
      snowOpacity: 0.86,
      rainSize: 2.8,
      snowSize: 4.5,
    },
    uiFx: {
      ring: theme.fx[0],
      pulseRing: theme.fx[1],
      perfectBurst: theme.fx[2],
      perfectSpark: theme.fx[3],
      puff: theme.fx[4],
      aimA: theme.fx[5],
      aimB: theme.fx[6],
    },
    audio: {
      masterGain: theme.audio[0],
      ambientBase: theme.audio[1],
      ambientOctave: theme.audio[2],
    },
  };
}

function validateCart(cart) {
  const errors = [];
  const requiredTop = ['id', 'copy', 'sky', 'lights', 'fog', 'bloom', 'world', 'motes', 'weather', 'uiFx', 'audio'];
  for (const key of requiredTop) if (!cart[key]) errors.push(`missing ${key}`);
  if (!Array.isArray(cart.world?.stoneTones) || cart.world.stoneTones.length < 2) errors.push('world.stoneTones must contain at least two colours');
  for (const section of ['sky', 'lights', 'fog', 'world', 'motes', 'weather', 'uiFx', 'audio']) {
    for (const [key, val] of Object.entries(cart[section] || {})) {
      if (typeof val === 'string' && key !== 'titleHtml' && key !== 'subtitle' && key !== 'guide' && key !== 'leaderboardTitle') {
        if (key !== 'id' && /^#/.test(val) && !/^#[0-9a-fA-F]{6}$/.test(val)) errors.push(`${section}.${key} must be #rrggbb`);
      }
    }
  }
  return errors;
}

function fileSource(exportName, cart) {
  return `// Generated by scripts/gen-cartridge.js from one sentence.\n` +
    `// Engine-owned mechanics are intentionally absent from this cartridge.\n\n` +
    `export const ${exportName} = ${JSON.stringify(cart, null, 2)};\n`;
}

function indexSource(importName, exportName) {
  return `// ============================================================================\n` +
    `//  cartridge/index.js — single swap point for Sky Leap's theme.\n` +
    `//  To switch themes, change the import below and export another cartridge.\n` +
    `// ============================================================================\n\n` +
    `// import { skyRuinsCartridge } from './sky-ruins.js';\n` +
    `// import { moonForgeCartridge } from './moon-forge.js';\n` +
    `import { ${exportName} } from './${importName}.js';\n\n` +
    `export const CARTRIDGE = ${exportName};\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cart = cartridgeFor(args.sentence);
  const errors = validateCart(cart);
  if (errors.length) {
    console.error('Generated cartridge failed validation:');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  const fileSlug = `gen-${cart.id}`;
  const exportName = `${camelFromSlug(fileSlug)}Cartridge`;
  const outPath = path.join(CARTRIDGE_DIR, `${fileSlug}.js`);
  const source = fileSource(exportName, cart);

  console.log(`Sentence: ${args.sentence}`);
  console.log(`Theme id: ${cart.id}`);
  console.log(`Export:   ${exportName}`);
  console.log(`File:     ${path.relative(ROOT, outPath)}`);
  console.log(`Title:    ${cart.copy.titleHtml.replace('<br>', ' ')}`);

  if (args.dryRun) {
    console.log('\nDry run: file not written.');
    return;
  }

  fs.writeFileSync(outPath, source);
  console.log('\nWritten cartridge file.');

  if (args.activate) {
    fs.writeFileSync(INDEX_PATH, indexSource(fileSlug, exportName));
    console.log('Activated cartridge/index.js.');
  } else {
    console.log('Not activated. To test it, import it from cartridge/index.js or rerun with --activate.');
  }
}

main();
