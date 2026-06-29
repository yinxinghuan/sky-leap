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
