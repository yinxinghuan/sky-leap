// Rewrites the host index.html into the Crazy Games guest document.
// Used only by vite.guest.config.js. The host Vite build never imports this.

const MARKERS = [
  'https://images.aiwaves.tech/alteru/guest-shell.js',
  './aigram-bridge.js',
  'https://alteru.app',
  'https://fonts.googleapis.com',
];

export function transformGuestHtml(html) {
  for (const marker of MARKERS) {
    if (!html.includes(marker)) {
      throw new Error('Guest transform expected host marker: ' + marker);
    }
  }

  let out = html.replace('<html lang="en">', '<html lang="en" class="cg-guest">');

  out = out.replace(
    '<script src="./alteru-storage-scope.js" data-alteru-storage-scope data-game-storage-id="eefd9179-7b36-4440-8b73-0cb1ea4e153e"></script>',
    '<script src="./storage-scope.js" data-game-storage-id="eefd9179-7b36-4440-8b73-0cb1ea4e153e"></script>',
  );

  out = out.replace('<script src="./aigram-bridge.js"></script>\n', '');

  out = out.replace(
    '<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />\n',
    '',
  );

  out = out.replace(
    '    <script src="https://images.aiwaves.tech/alteru/guest-shell.js" defer></script>\n',
    '',
  );

  out = out.replace(
    "const ALTERU_APP_URL = 'https://alteru.app';\nconst LB_DOWNLOAD_TEXT = (navigator.language || '').toLowerCase().startsWith('zh')\n  ? { hint: '在 AlterU 中打开即可查看排行榜', cta: '下载 AlterU' }\n  : { hint: 'Open in AlterU to view the leaderboard.', cta: 'Get AlterU' };",
    "const ALTERU_APP_URL = '#';\nconst LB_DOWNLOAD_TEXT = { hint: '', cta: '' };",
  );

  out = out.replace(
    'function renderLBDownload(){\n  lbData = { rows: [], meId: \'\' };',
    'function renderLBDownload(){\n  return;\n  lbData = { rows: [], meId: \'\' };',
  );

  out = out.replace(
    "ref_url: 'https://yinxinghuan.github.io/games/posters/sky-leap.png',",
    "ref_url: '',",
  );

  const inject = [
    '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js" async></script>',
    '<script type="module" src="./guest/boot.js"></script>',
    '</head>',
  ].join('\n');
  if (!out.includes('</head>')) throw new Error('Guest transform could not find </head>');
  out = out.replace('</head>', inject);

  const forbidden = [
    'guest-shell.js',
    'aigram-bridge.js',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'alteru.app',
    'aiwaves.tech',
    'github.io',
    'Get AlterU',
    '下载 AlterU',
  ];
  for (const token of forbidden) {
    if (out.includes(token)) throw new Error('Guest HTML still contains ' + token);
  }
  if (!out.includes('./guest/boot.js')) throw new Error('Guest boot script was not injected');
  if (!out.includes('crazygames-sdk-v3.js')) throw new Error('CrazyGames SDK script was not injected');
  if (!out.includes('./storage-scope.js')) throw new Error('Storage scope script was not renamed');
  if (!out.includes("from './game.js'")) throw new Error('Guest HTML lost the game module');
  return out;
}
