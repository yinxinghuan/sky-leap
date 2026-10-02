import fs from 'fs';
import assert from 'assert';
import { transformGuestHtml } from './transform-html.js';

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const guest = transformGuestHtml(source);

assert.equal(guest.includes('guest-shell'), false);
assert.equal(guest.includes('aigram-bridge'), false);
assert.equal(guest.includes('alteru.app'), false);
assert.equal(guest.includes('fonts.googleapis'), false);
assert.equal(guest.includes('aiwaves.tech'), false);
assert.equal(guest.includes('./guest/boot.js'), true);
assert.equal(guest.includes('crazygames-sdk-v3.js'), true);
assert.equal(guest.includes('./storage-scope.js'), true);
assert.equal(guest.includes('data-alteru-storage-scope'), false);
assert.equal(guest.includes("from './game.js'"), true);
assert.equal(guest.includes('class="cg-guest"'), true);
assert.equal(source.includes('guest-shell.js'), true, 'transform must not edit the host file');

console.log('guest transform ok');
