// ============================================================================
//  cartridge/index.js — single swap point for Sky Leap's theme.
//  To switch themes, change the import below and export another cartridge.
// ============================================================================

import { skyRuinsCartridge } from './sky-ruins.js';
// import { moonForgeCartridge } from './moon-forge.js';

export const CARTRIDGE = skyRuinsCartridge;
