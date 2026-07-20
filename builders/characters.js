// ============================================================================
//  sky-leap/builders/characters.js — roster merge point.
//  Imports the shared character() factory + base characters from @engine-3d,
//  then merges in archetypes and monsters (no office — Sky Leap is outdoors).
// ============================================================================

import { BASE_CHARACTERS } from '@engine-3d';
import { ARCHETYPES } from '@engine-3d';
import { MONSTERS } from '@engine-3d';

// Re-export character() factory for direct use in game.js
export { character } from '@engine-3d';

export const CHARACTERS = {
  ...BASE_CHARACTERS,
  ...ARCHETYPES,
  ...MONSTERS,
};

// A deliberately small, curated collection rather than the full builder
// library. Sky Leap is a commuter's journey: every silhouette has a distinct
// read at game scale and a clear reason to collect it.
export const CHARACTER_CATALOG = [
  { key: 'shopkeeper', name: '早班店长', en: 'Corner Clerk', cost: 0, tier: '起始', tone: '#75b8dd' },
  { key: 'student', name: '赶课学生', en: 'Campus Dash', cost: 10, tier: '常见', tone: '#ffd166' },
  { key: 'chef', name: '夜班主厨', en: 'Night Chef', cost: 25, tier: '少见', tone: '#f28e7f' },
  { key: 'delivery', name: '闪送骑手', en: 'Rush Rider', cost: 45, tier: '稀有', tone: '#6fd5bf' },
  { key: 'firefighter', name: '消防英雄', en: 'Fire Runner', cost: 70, tier: '史诗', tone: '#ff735c' },
  { key: 'ghost', name: '末班幽灵', en: 'Last Train Ghost', cost: 100, tier: '传说', tone: '#b7b6ff' },
];
