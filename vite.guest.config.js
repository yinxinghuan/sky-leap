import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { transformGuestHtml } from './guest/transform-html.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// Crazy Games guest build. Host `npm run build` uses vite.config.js and never
// loads this file, so dist/ stays the AlterU build.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      'three/addons/': path.resolve(root, 'node_modules/three/examples/jsm/'),
      '@engine-3d': path.resolve(root, 'src/engine-3d'),
    },
  },
  plugins: [
    {
      name: 'crazygames-guest-storage-dev',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && req.url.split('?')[0] === '/storage-scope.js') req.url = '/alteru-storage-scope.js';
          next();
        });
      },
    },
    {
      name: 'crazygames-guest-html',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return transformGuestHtml(html);
        },
      },
    },
    {
      name: 'crazygames-guest-public-files',
      closeBundle() {
        const outDir = path.resolve(root, 'dist-guest');
        const storage = path.join(outDir, 'alteru-storage-scope.js');
        if (fs.existsSync(storage)) {
          const text = fs.readFileSync(storage, 'utf8').replace(
            "    if (location.hostname === 'game.aiwaves.tech' && firstPathSegment) return firstPathSegment\n",
            '',
          );
          fs.writeFileSync(path.join(outDir, 'storage-scope.js'), text);
          fs.unlinkSync(storage);
        }
        const bridge = path.join(outDir, 'aigram-bridge.js');
        if (fs.existsSync(bridge)) fs.unlinkSync(bridge);
        const notices = path.join(outDir, 'THIRD_PARTY_NOTICES.txt');
        if (fs.existsSync(notices) && !fs.readFileSync(notices, 'utf8').includes('Nighttime Solitude')) {
          fs.appendFileSync(notices, [
            '',
            '3. Nighttime Solitude — guest build soundtrack',
            '-----------------------------------------------',
            '',
            'Author: celestialghost8',
            'License: CC0 1.0 Universal (public domain)',
            'Source: https://opengameart.org/content/nighttime-solitude',
            'Bundled as audio/nighttime-solitude.mp3 and looped by the Crazy Games guest build.',
            'Pedestal, case-seal, acquisition, and purchase tones are original synthesis in guest/gallery-sfx.js.',
            '',
          ].join('\n'));
        }
      },
    },
  ],
  build: {
    outDir: 'dist-guest',
    emptyOutDir: true,
  },
  preview: { host: '127.0.0.1', allowedHosts: true },
  server: { host: '127.0.0.1', allowedHosts: true },
});
