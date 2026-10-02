// Crazy Games guest layer. The host page never imports this module.
import './guest.css';
import bgmUrl from './audio/chillloopable.mp3';
import { CHARACTER_CATALOG } from '../src/character-library.js';

const PROGRESS_KEY = 'cg-sky-leap-circuit-v2';
const TUTORIAL_KEY = 'cg-sky-leap-tutorial-v1';
const MUTE_KEY = 'cg-sky-leap-user-mute';

const CASES = [
  {
    id: 'land2', title: 'Open the case', detail: 'Land on 2 shelves in one run.',
    test: (s) => s.run.landings >= 2,
    meter: (s) => meter(s.run.landings, 2, 'landings'),
  },
  {
    id: 'second', title: 'Second figure', detail: 'Place Shopkeeper. Any fall pays the 5 tickets.',
    test: (s) => s.owned.owned >= 2,
    meter: (s) => (s.owned.owned >= 2 ? { label: 'Placed', ratio: 1 } : meter(s.owned.tickets, 5, 'tickets')),
  },
  {
    id: 'perfect', title: 'Center seal', detail: 'Stamp one PERFECT in the middle of a shelf.',
    test: (s) => s.progress.perfects >= 1,
    meter: (s) => meter(s.progress.perfects, 1, 'perfect'),
  },
  {
    id: 'combo', title: 'Window combo', detail: 'Chain a ×2 combo.',
    test: (s) => s.run.combo >= 2 || s.progress.bestCombo >= 2,
    meter: (s) => meter(Math.max(s.run.combo, s.progress.bestCombo), 2, 'combo'),
  },
  {
    id: 'three', title: 'Three on the shelf', detail: 'Own 3 figures. The next two are 7 and 9 tickets.',
    test: (s) => s.owned.owned >= 3,
    meter: (s) => meter(s.owned.owned, 3, 'figures'),
  },
  {
    id: 'route', title: 'Long route', detail: 'Reach 8 points in one run.',
    test: (s) => s.run.score >= 8 || s.progress.bestScore >= 8,
    meter: (s) => meter(Math.max(s.run.score, s.progress.bestScore), 8, 'points'),
  },
  {
    id: 'after', title: 'After hours', detail: 'Place a monster or animal. Vampire is 20 tickets, Pig is 24.',
    test: (s) => s.owned.special >= 1,
    meter: (s) => rareMeter(s.owned),
  },
  {
    id: 'five', title: 'Five on the shelf', detail: 'Own 5 figures. Shopkeeper through Blonde are 5 to 11 tickets.',
    test: (s) => s.owned.owned >= 5,
    meter: (s) => meter(s.owned.owned, 5, 'figures'),
  },
];

function meter(value, goal, unit) {
  const current = Math.max(0, Math.min(goal, Number(value) || 0));
  return { label: `${current} / ${goal} ${unit}`, ratio: goal ? current / goal : 1 };
}

function rareMeter(owned) {
  if (owned.special >= 1) return { label: 'Rare figure placed', ratio: 1 };
  const rare = CHARACTER_CATALOG.find((character) => (character.category === '怪物' || character.category === '动物') && !owned.keys.has(character.key));
  if (!rare) return { label: 'Rare figure placed', ratio: 1 };
  const have = Math.min(owned.tickets, rare.cost);
  return { label: `${rare.en} · ${have} / ${rare.cost} tickets`, ratio: rare.cost ? have / rare.cost : 1 };
}

// Guest-only shelf prices. The shared catalog stays at the host costs;
// this mutates the live objects before the game module reads them.
function applyGuestShelf() {
  let people = 0;
  let monsters = 0;
  let animals = 0;
  for (const character of CHARACTER_CATALOG) {
    if (character.name) EXACT.set(character.name, character.en);
    if (character.cost === 0) continue;
    if (character.category === '怪物') character.cost = 20 + monsters++ * 4;
    else if (character.category === '动物') character.cost = 24 + animals++ * 4;
    else character.cost = 5 + people++ * 2;
  }
}

const EXACT = new Map([
  ['角色收藏', 'Toy shelf'],
  ['张车票', 'tickets'],
  ['通勤者衣柜', 'Figurine case'],
  ['每局结束获得车票。先看看他们的样子，再决定带谁跳向下一站。', 'Each fall pays tickets. Preview a figure, then choose who leaps next.'],
  ['继续跳', 'Back to the circuit'],
  ['全部 56', 'All 56'],
  ['人物 37', 'People 37'],
  ['怪物 8', 'Monsters 8'],
  ['动物 11', 'Animals 11'],
  ['使用中', 'Equipped'],
  ['已拥有 · 可装备', 'Owned · ready to place'],
  ['正在使用', 'On the shelf'],
  ['装备这位角色', 'Place this figure'],
  ['角色仓库载入中…', 'Opening the case…'],
  ['角色仓库正在载入 56 个形象…', 'Loading 56 figures…'],
  ['角色仓库暂不可用，请稍后重试', 'The case could not load. Try again in a moment.'],
  ['Hold to charge', 'Hold Space or the mouse'],
  ['hold & release to soar', 'figurine circuit'],
  ['Fell into the clouds', 'Missed the shelf'],
  ['Character collection', 'Figurine case'],
  ['Reached', 'Score'],
  ['SKY LEAP COLLECTION', 'FIGURINE CASE'],
  ['起始', 'Starter'],
  ['通勤者', 'Commuter'],
  ['特殊', 'Special'],
  ['异界', 'Outland'],
  ['动物', 'Animal'],
  ['角色分类', 'Figure groups'],
  ['当前角色 3D 预览', 'Figure preview'],
  ['上一位角色', 'Previous figure'],
  ['下一位角色', 'Next figure'],
]);

const TEXT_RULES = [
  [/^解锁需要 (\d+) 张车票$/, 'Unlock for $1 tickets'],
  [/^还差 (\d+) 张车票$/, '$1 tickets short'],
  [/^解锁角色 · (\d+)$/, 'Unlock figure · $1'],
  [/^收藏 (\d+) \/ (\d+)$/, 'Shelf $1 / $2'],
  [/^本局获得 (\d+) 张车票 · 再跳几步，解锁下一位通勤者$/, 'This fall paid $1 tickets. Keep leaping to open the next figure.'],
  [/^(\d+) 张车票$/, '$1 tickets'],
];
applyGuestShelf();

const params = new URLSearchParams(location.search);
const queryMuted = params.get('muteAudio') === 'true';
const forceTutorial = params.has('tutorial');

const gateList = [];
let routingAudio = false;
installAudioGate();

const frame = installStage();
reshapeShop();
const ui = buildChrome(frame);
const bgm = createBgm();
let userMuted = false;
try { userMuted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* private mode */ }

let progress = loadProgress();
const run = { landings: 0, perfects: 0, score: 0, combo: 0 };
let caseSignature = '';
let toastedBoot = false;

let sdk = null;
let gameReady = false;
let loadingStopSent = false;
let gameplayOn = false;
let audioStarted = false;
applyMute();

const tutorial = createTutorial(frame);
translateTree(frame);
watchHostCopy(frame);
installInput();
watchRun();
checkCases();
toastedBoot = true;
initSdk();
watchGameReady();

function installAudioGate() {
  const origConnect = AudioNode.prototype.connect;
  if (origConnect.__cgGate) return;
  function connect(dest, ...args) {
    if (!routingAudio && dest && dest === this.context.destination) {
      return origConnect.call(this, gateFor(this.context), ...args);
    }
    return origConnect.call(this, dest, ...args);
  }
  connect.__cgGate = true;
  AudioNode.prototype.connect = connect;
}

function gateFor(ctx) {
  const existing = gateList.find((item) => item.ctx === ctx);
  if (existing) return existing.node;
  const node = ctx.createGain();
  node.gain.value = wantMute() ? 0 : 1;
  routingAudio = true;
  AudioNode.prototype.connect.call(node, ctx.destination);
  routingAudio = false;
  gateList.push({ ctx, node });
  return node;
}

function wantMute() {
  return queryMuted || userMuted || sdkMuted();
}

function sdkMuted() {
  try { return !!sdk?.game?.settings?.muteAudio; } catch (e) { return false; }
}

function applyMute() {
  const muted = wantMute();
  for (const gate of gateList) gate.node.gain.value = muted ? 0 : 1;
  bgm.muted = muted;
  if (muted) bgm.pause();
  else if (audioStarted) bgm.play().catch(() => {});
  ui.mute.textContent = muted ? 'Music off' : 'Music on';
  ui.mute.classList.toggle('is-muted', muted);
  ui.mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
  ui.mute.disabled = queryMuted || sdkMuted();
}

function createBgm() {
  const audio = new Audio(bgmUrl);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.34;
  return audio;
}

function startBgm() {
  audioStarted = true;
  applyMute();
}

function installStage() {
  const stage = document.createElement('div');
  stage.id = 'cg-frame';
  document.body.appendChild(stage);
  for (const id of ['wrap', 'shop', 'lbFull', 'over']) {
    const node = document.getElementById(id);
    if (node) stage.appendChild(node);
  }
  const fit = () => {
    const size = logicalSize();
    stage.style.width = size.w + 'px';
    stage.style.height = size.h + 'px';
  };
  fit();
  window.addEventListener('resize', fit);
  try {
    Object.defineProperty(window, 'innerWidth', { configurable: true, get() { return logicalSize().w; } });
    Object.defineProperty(window, 'innerHeight', { configurable: true, get() { return logicalSize().h; } });
  } catch (e) { /* portrait will use the window aspect if the override is blocked */ }
  requestAnimationFrame(() => {
    fit();
    window.dispatchEvent(new Event('resize'));
  });
  return stage;
}

function logicalSize() {
  const w = document.documentElement.clientWidth || 1280;
  const h = document.documentElement.clientHeight || 720;
  const ratio = w / Math.max(1, h);
  if (Math.abs(ratio - 16 / 9) < 0.02) return { w, h };
  if (ratio > 16 / 9) return { w: Math.max(1, Math.round(h * 16 / 9)), h };
  return { w, h: Math.max(1, Math.round(w * 9 / 16)) };
}

function reshapeShop() {
  const sheet = document.querySelector('.shop-sheet');
  const stage = document.getElementById('shopStage');
  const head = sheet && sheet.querySelector('.shop-head');
  if (!sheet || !stage || !head || sheet.querySelector('.cg-shop-side')) return;
  const side = document.createElement('div');
  side.className = 'cg-shop-side';
  for (const node of [...sheet.children]) {
    if (node !== head && node !== stage) side.appendChild(node);
  }
  sheet.appendChild(side);
}

function buildChrome(stage) {
  const panel = document.createElement('aside');
  panel.id = 'cg-case';
  panel.setAttribute('aria-live', 'polite');
  const toast = document.createElement('div');
  toast.id = 'cg-toast';
  const banner = document.createElement('div');
  banner.id = 'cg-banner';
  banner.innerHTML = '<p class="cg-step"></p><h2></h2><p class="cg-banner-detail"></p>';
  const mute = document.createElement('button');
  mute.id = 'cg-mute';
  mute.type = 'button';
  mute.textContent = 'Music on';
  mute.setAttribute('aria-pressed', 'false');
  const creditsBtn = document.createElement('button');
  creditsBtn.id = 'cg-credits-btn';
  creditsBtn.type = 'button';
  creditsBtn.textContent = 'Credits';
  const credits = document.createElement('div');
  credits.id = 'cg-credits-modal';
  credits.innerHTML = `
    <div class="cg-card" role="dialog" aria-modal="true" aria-labelledby="cg-credits-title">
      <p class="cg-step">AUDIO</p>
      <h2 id="cg-credits-title">Music</h2>
      <p><strong>Chill (Loopable)</strong> by Alex McCulloch (Pro Sensory). CC0 1.0, public domain, commercial use allowed. Source: opengameart.org/content/chill-loopable. The track is bundled and looped.</p>
      <p>Figures, shelves, and leap sounds are part of Sky Leap. This guest build adds the figurine-circuit cases on top.</p>
      <div class="cg-actions"><button type="button" class="cg-primary" id="cg-credits-close">Close</button></div>
    </div>`;
  stage.append(panel, toast, banner, mute, creditsBtn, credits);
  for (const node of [panel, mute, creditsBtn, credits, banner]) stopCharge(node);
  banner.addEventListener('click', () => banner.classList.remove('show'));
  mute.addEventListener('click', () => {
    if (queryMuted || sdkMuted()) return;
    userMuted = !userMuted;
    try { localStorage.setItem(MUTE_KEY, userMuted ? '1' : '0'); } catch (e) { /* ignore */ }
    startBgm();
  });
  creditsBtn.addEventListener('click', () => credits.classList.add('show'));
  credits.querySelector('#cg-credits-close').addEventListener('click', () => credits.classList.remove('show'));
  credits.addEventListener('click', (event) => { if (event.target === credits) credits.classList.remove('show'); });
  return { panel, toast, banner, mute, credits };
}

function stopCharge(node) {
  node.addEventListener('pointerdown', (event) => event.stopPropagation());
}

function translate(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lead = value.match(/^\s*/)[0];
  const tail = value.match(/\s*$/)[0];
  if (EXACT.has(trimmed)) return lead + EXACT.get(trimmed) + tail;
  for (const [rule, replacement] of TEXT_RULES) {
    if (rule.test(trimmed)) return lead + trimmed.replace(rule, replacement) + tail;
  }
  return null;
}

function translateTree(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement && node.parentElement.closest('#cg-tutorial, #cg-credits-modal, #cg-case, #cg-toast, #cg-banner, #cg-report')) continue;
    const next = translate(node.nodeValue);
    if (next != null && next !== node.nodeValue) node.nodeValue = next;
  }
  root.querySelectorAll('[aria-label]').forEach((el) => {
    const next = translate(el.getAttribute('aria-label'));
    if (next != null) el.setAttribute('aria-label', next.trim());
  });
}

function watchHostCopy(root) {
  const observer = new MutationObserver(() => translateTree(root));
  observer.observe(root, { subtree: true, childList: true, characterData: true });
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
    if (saved && Array.isArray(saved.cleared)) {
      return {
        cleared: saved.cleared.filter((id) => CASES.some((item) => item.id === id)),
        bestScore: Number(saved.bestScore) || 0,
        bestCombo: Number(saved.bestCombo) || 0,
        perfects: Number(saved.perfects) || 0,
      };
    }
  } catch (e) { /* reset */ }
  return { cleared: [], bestScore: 0, bestCombo: 0, perfects: 0 };
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ }
}

function snapshotOwned() {
  let data = { tickets: 0, unlocked: ['commuter'] };
  try {
    const raw = window.alteruLocalStorage && window.alteruLocalStorage.getItem('sl.collection.v1');
    if (raw) data = JSON.parse(raw);
  } catch (e) { /* keep starter */ }
  const unlocked = new Set(Array.isArray(data.unlocked) ? data.unlocked : ['commuter']);
  if (!unlocked.has('commuter')) unlocked.add('commuter');
  const special = CHARACTER_CATALOG.filter((character) => unlocked.has(character.key) && (character.category === '怪物' || character.category === '动物')).length;
  const next = CHARACTER_CATALOG.find((character) => !unlocked.has(character.key));
  return { tickets: Math.max(0, Number(data.tickets) || 0), owned: unlocked.size, special, next, keys: unlocked };
}

let seenUnlocked = null;
function freshUnlocks(keys) {
  if (!seenUnlocked) {
    seenUnlocked = new Set(keys);
    return [];
  }
  const fresh = [...keys].filter((key) => !seenUnlocked.has(key));
  seenUnlocked = new Set(keys);
  return fresh;
}

function activeCase() {
  return CASES.find((item) => !progress.cleared.includes(item.id)) || null;
}

function checkCases() {
  const owned = snapshotOwned();
  const fresh = freshUnlocks(owned.keys);
  const state = { run, progress, owned };
  let sealed = null;
  for (const item of CASES) {
    if (progress.cleared.includes(item.id)) continue;
    if (item.test(state)) {
      progress.cleared.push(item.id);
      sealed = item;
    }
  }
  if (sealed) saveProgress();
  renderPanel(owned);
  if (document.getElementById('over').classList.contains('show')) renderReport(owned);
  const action = document.getElementById('shopAction');
  if (action) {
    const shown = (document.getElementById('shopName')?.textContent || '').trim();
    const preview = CHARACTER_CATALOG.find((character) => character.en === shown);
    const canBuy = !!(preview && preview.cost > 0 && !owned.keys.has(preview.key) && owned.tickets >= preview.cost);
    action.classList.toggle('cg-can-buy', canBuy);
  }
  if (!toastedBoot) return;
  if (fresh.length) {
    const figure = CHARACTER_CATALOG.find((character) => character.key === fresh[fresh.length - 1]);
    const extra = sealed ? ` Case sealed · ${sealed.title}.` : '';
    banner('ON THE SHELF', figure ? figure.en : 'NEW FIGURE', `Tickets opened this figure.${extra} They stay equipped until you choose another.`);
  } else if (sealed) {
    banner('CASE SEALED', sealed.title, sealed.detail);
  }
}

function renderPanel(owned = snapshotOwned()) {
  const current = activeCase();
  const index = current ? CASES.indexOf(current) + 1 : CASES.length;
  const stamps = CASES.map((item) => {
    const on = progress.cleared.includes(item.id) ? ' on' : '';
    const now = current && current.id === item.id ? ' now' : '';
    return `<i class="${(on + now).trim()}"></i>`;
  }).join('');
  const reading = current && current.meter ? current.meter({ run, progress, owned }) : { label: 'Shelf complete', ratio: 1 };
  const ratio = Math.max(0, Math.min(1, reading.ratio || 0));
  const affordable = owned.next && owned.tickets >= owned.next.cost;
  const next = !owned.next
    ? `Full shelf · ${owned.owned} / ${CHARACTER_CATALOG.length}`
    : `Next figure · ${owned.next.en} · ${owned.tickets} / ${owned.next.cost} tickets`;
  const title = current ? current.title : 'Shelf complete';
  const detail = current ? current.detail : 'All 8 cases are sealed. Keep opening figures.';
  const ready = affordable ? `<span class="cg-ready">Ready — press C to place ${owned.next.en}</span>` : '';
  const html = `<p class="cg-kicker">CASE ${index} / ${CASES.length}</p><strong>${title}</strong><p>${detail}</p><div class="cg-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ratio * 100)}"><i style="width:${Math.round(ratio * 100)}%"></i></div><span class="cg-meter-label">${reading.label}</span><div class="cg-stamps">${stamps}</div><span class="cg-next">${next}</span>${ready}<span class="cg-keys">Space charge · C case · M music</span>`;
  if (html === caseSignature) return;
  caseSignature = html;
  ui.panel.innerHTML = html;
  document.getElementById('collectionEntry')?.classList.toggle('cg-ready-entry', Boolean(affordable));
}

function renderReport(owned = snapshotOwned()) {
  const card = document.querySelector('#over .card');
  if (!card) return;
  let report = document.getElementById('cg-report');
  if (!report) {
    report = document.createElement('div');
    report.id = 'cg-report';
    const buttons = card.querySelector('.btns');
    card.insertBefore(report, buttons);
  }
  const current = activeCase();
  const reading = current && current.meter ? current.meter({ run, progress, owned }) : null;
  const affordable = owned.next && owned.tickets >= owned.next.cost;
  const next = !owned.next
    ? 'Every figure in this circuit is unlocked.'
    : affordable
      ? `You can place ${owned.next.en} now · ${owned.tickets} tickets`
      : `Next · ${owned.next.en} · ${owned.tickets} / ${owned.next.cost} tickets`;
  const bar = reading ? `<span class="cg-meter-label">${reading.label}</span><div class="cg-meter"><i style="width:${Math.round(Math.max(0, Math.min(1, reading.ratio)) * 100)}%"></i></div>` : '';
  report.innerHTML = `<strong>${progress.cleared.length} / ${CASES.length} cases sealed</strong><span>${current ? 'Open case · ' + current.title : 'The exhibition shelf is complete.'}</span>${bar}<span class="${affordable ? 'cg-ready' : ''}">${next}</span>`;
}

function banner(kicker, title, detail) {
  const root = ui.banner;
  root.querySelector('.cg-step').textContent = kicker;
  root.querySelector('h2').textContent = title;
  root.querySelector('.cg-banner-detail').textContent = detail;
  root.classList.add('show');
  clearTimeout(banner._t);
  banner._t = setTimeout(() => root.classList.remove('show'), 3400);
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => ui.toast.classList.remove('show'), 2200);
}

function resetRun() {
  run.landings = 0;
  run.perfects = 0;
  run.score = 0;
  run.combo = 0;
  checkCases();
}

function watchRun() {
  const over = document.getElementById('over');
  const shop = document.getElementById('shop');
  const observer = new MutationObserver(() => {
    if (over.classList.contains('show')) {
      checkCases();
      endGameplay();
    } else if (shop.classList.contains('show')) {
      endGameplay();
      setTimeout(checkCases, 0);
    } else if (!tutorialOpen()) {
      beginGameplay();
    }
  });
  observer.observe(over, { attributes: true, attributeFilter: ['class'] });
  observer.observe(shop, { attributes: true, attributeFilter: ['class'] });
  document.getElementById('shopAction').addEventListener('click', () => setTimeout(checkCases, 40));
  const poll = () => {
    const live = window.__sl;
    if (live) {
      const score = Number(live.score) || 0;
      const combo = Number(live.combo) || 0;
      if (score > run.score) {
        const gained = score - run.score;
        run.landings += 1;
        run.score = score;
        if (gained >= 3) {
          run.perfects += 1;
          progress.perfects += 1;
        }
        progress.bestScore = Math.max(progress.bestScore, score);
        saveProgress();
        checkCases();
      }
      if (combo > run.combo) {
        run.combo = combo;
        progress.bestCombo = Math.max(progress.bestCombo, combo);
        saveProgress();
        checkCases();
      }
      if (score === 0 && run.landings > 0 && live.state === 'idle') resetRun();
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  setInterval(checkCases, 250);
}

function tutorialOpen() {
  return document.documentElement.classList.contains('cg-tut-on');
}

function tutorialDone() {
  if (forceTutorial) return false;
  try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch (e) { return false; }
}

function createTutorial(stage) {
  const root = document.createElement('div');
  root.id = 'cg-tutorial';
  root.innerHTML = `
    <div class="cg-card" role="dialog" aria-modal="true" aria-labelledby="cg-tut-title">
      <p class="cg-step" id="cg-tut-step"></p>
      <h2 id="cg-tut-title"></h2>
      <p id="cg-tut-body"></p>
      <div class="cg-actions" id="cg-tut-actions"></div>
    </div>`;
  stage.appendChild(root);
  stopCharge(root);
  if (tutorialDone()) {
    root.remove();
    return root;
  }
  document.documentElement.classList.add('cg-tut-on');
  const steps = [
    {
      kicker: 'STEP 1 OF 5',
      title: 'The figurine circuit',
      body: 'Sky Leap puts one toy figure on a sky shelf. There are 56 to collect: commuters, monsters, and animals. Falls pay tickets. Tickets open the next figure. Eight exhibition cases give the session a trail.',
      practice: false,
      actions: [
        { label: 'Skip', quiet: true, run: finishTutorial },
        { label: 'Begin', primary: true, run: () => showStep(1) },
      ],
    },
    {
      kicker: 'STEP 2 OF 5',
      title: 'Charge the leap',
      body: 'Hold Space, W, Up, or the left mouse button. A ring grows under the figure. Release to launch toward the next shelf. Try one leap.',
      practice: true,
      actions: [
        { label: 'Skip tutorial', quiet: true, run: finishTutorial },
        { label: 'Next', primary: true, id: 'cg-practice-next', disabled: true, run: () => showStep(2) },
      ],
    },
    {
      kicker: 'STEP 3 OF 5',
      title: 'Center seal',
      body: 'The middle of a shelf stamps PERFECT and builds a combo. A rim landing still counts, and the combo breaks. The case tracker in the top right shows the open goal.',
      practice: false,
      actions: [
        { label: 'Skip', quiet: true, run: finishTutorial },
        { label: 'Next', primary: true, run: () => showStep(3) },
      ],
    },
    {
      kicker: 'STEP 4 OF 5',
      title: 'Fill the case',
      body: 'Toy shelf, top left, opens all 56 figures. Commuter is free. Shopkeeper is 5 tickets — any fall pays it. Vampire is 20 and Pig is 24, so a rare figure fits the first session.',
      practice: false,
      actions: [
        { label: 'Skip', quiet: true, run: finishTutorial },
        { label: 'Open the case', quiet: true, run: openCaseThenContinue },
        { label: 'Next', primary: true, run: () => showStep(4) },
      ],
    },
    {
      kicker: 'STEP 5 OF 5',
      title: 'Eight cases',
      body: 'The tracker leads you: two landings, then Shopkeeper, a perfect, a ×2 combo, three figures, an 8-point run, a monster or animal, then five figures. Space charges. C opens the case. M toggles music.',
      practice: false,
      actions: [
        { label: 'Start the circuit', primary: true, run: finishTutorial },
      ],
    },
  ];

  function showStep(index) {
    const step = steps[index];
    root.classList.toggle('is-practice', step.practice);
    document.documentElement.classList.toggle('cg-practice', step.practice);
    const card = root.querySelector('.cg-card');
    card.className = step.practice ? 'cg-coach' : 'cg-card';
    root.querySelector('#cg-tut-step').textContent = step.kicker;
    root.querySelector('#cg-tut-title').textContent = step.title;
    root.querySelector('#cg-tut-body').textContent = step.body;
    const actions = root.querySelector('#cg-tut-actions');
    actions.innerHTML = '';
    for (const action of step.actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.className = action.primary ? 'cg-primary' : 'cg-quiet';
      if (action.id) button.id = action.id;
      button.disabled = !!action.disabled;
      button.addEventListener('click', action.run);
      actions.appendChild(button);
    }
    if (step.practice) watchPractice();
    else {
      const primary = actions.querySelector('.cg-primary');
      if (primary) primary.focus();
    }
  }

  function watchPractice() {
    const tick = () => {
      if (!root.isConnected || !root.classList.contains('is-practice')) return;
      const state = window.__sl && window.__sl.state;
      const next = document.getElementById('cg-practice-next');
      if (state === 'launch' || state === 'falling' || state === 'dead') {
        if (next) next.disabled = false;
        const body = root.querySelector('#cg-tut-body');
        if (body) body.textContent = 'That launch counts. Land on the shelf, or continue and read the center-seal lesson.';
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function openCaseThenContinue() {
    root.hidden = true;
    document.getElementById('collectionEntry').click();
    const shop = document.getElementById('shop');
    const observer = new MutationObserver(() => {
      if (!shop.classList.contains('show')) {
        observer.disconnect();
        root.hidden = false;
        showStep(4);
      }
    });
    observer.observe(shop, { attributes: true, attributeFilter: ['class'] });
  }

  showStep(0);
  root.finish = finishTutorial;
  return root;

  function finishTutorial() {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) { /* ignore */ }
    document.documentElement.classList.remove('cg-tut-on', 'cg-practice');
    root.remove();
    const over = document.getElementById('over');
    if (over.classList.contains('show')) document.getElementById('again').click();
    beginGameplay();
  }
}

function installInput() {
  const chargeKeys = new Set(['Space', 'ArrowUp', 'KeyW']);
  let charging = false;

  function pressCharge() {
    if (charging) return;
    if (blocked()) return;
    const canvas = document.getElementById('c');
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 8, clientY: 8,
    }));
    charging = true;
    startBgm();
  }

  function releaseCharge() {
    if (!charging) return;
    charging = false;
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    }));
  }

  function blocked() {
    const shop = document.getElementById('shop').classList.contains('show');
    const credits = ui.credits.classList.contains('show');
    const modalTutorial = tutorialOpen() && !document.documentElement.classList.contains('cg-practice');
    return shop || credits || modalTutorial;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Space') event.preventDefault();
    if (event.target instanceof Element && event.target.closest('#cg-tutorial button, #cg-credits-modal button, #shop button')) return;
    const over = document.getElementById('over');
    if ((event.code === 'Space' || event.code === 'Enter') && over.classList.contains('show') && !tutorialOpen()) {
      event.preventDefault();
      document.getElementById('again').click();
      return;
    }
    if (event.code === 'Escape') {
      if (ui.credits.classList.contains('show')) { ui.credits.classList.remove('show'); return; }
      if (document.getElementById('shop').classList.contains('show')) { document.getElementById('shopClose').click(); return; }
      if (tutorialOpen() && tutorial.finish) tutorial.finish();
      return;
    }
    if (event.code === 'KeyC' && !tutorialOpen()) {
      const opener = over.classList.contains('show') ? document.getElementById('overShop') : document.getElementById('collectionEntry');
      opener.click();
      return;
    }
    if (event.code === 'KeyM') { ui.mute.click(); return; }
    if (event.code === 'KeyR' && over.classList.contains('show') && !tutorialOpen()) {
      document.getElementById('again').click();
      return;
    }
    if (chargeKeys.has(event.code)) pressCharge();
  });
  window.addEventListener('keyup', (event) => {
    if (chargeKeys.has(event.code)) releaseCharge();
  });
  window.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('#cg-tutorial, #cg-mute, #cg-credits-btn, #cg-credits-modal, #shop, #over')) return;
    startBgm();
  }, true);
  window.addEventListener('blur', releaseCharge);
}

function cgCall(fn) {
  if (!sdk) return;
  try { fn(sdk); } catch (e) { /* disabled environment throws */ }
}

function beginGameplay() {
  if (!gameReady || gameplayOn || tutorialOpen()) return;
  if (sdk && !loadingStopSent) return;
  if (document.getElementById('over').classList.contains('show')) return;
  if (document.getElementById('shop').classList.contains('show')) return;
  if (!sdk) return;
  gameplayOn = true;
  cgCall((api) => api.game.gameplayStart());
}

function endGameplay() {
  if (!gameplayOn) return;
  gameplayOn = false;
  cgCall((api) => api.game.gameplayStop());
}

function markLoaded() {
  gameReady = true;
  if (sdk && !loadingStopSent) {
    cgCall((api) => api.game.loadingStop());
    loadingStopSent = true;
  }
  beginGameplay();
}

function watchGameReady() {
  const started = performance.now();
  const tick = () => {
    if (window.__sl) {
      markLoaded();
      return;
    }
    if (performance.now() - started > 8000) return;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function initSdk() {
  const attempt = (left) => {
    const api = window.CrazyGames && window.CrazyGames.SDK;
    if (!api) {
      if (left > 0) setTimeout(() => attempt(left - 1), 100);
      return;
    }
    api.init().then(() => {
      if (api.environment === 'disabled') return;
      sdk = api;
      try { sdk.game.loadingStart(); } catch (e) { /* already loading */ }
      try { sdk.game.addSettingsChangeListener(() => applyMute()); } catch (e) { /* older preview */ }
      applyMute();
      if (gameReady) {
        if (!loadingStopSent) {
          cgCall((ready) => ready.game.loadingStop());
          loadingStopSent = true;
        }
        beginGameplay();
      }
    }).catch(() => {});
  };
  attempt(30);
}

window.__cg = {
  get progress() { return progress; },
  get run() { return run; },
  cases: CASES,
  skipTutorial() { if (tutorial.finish) tutorial.finish(); },
  music() { return { paused: bgm.paused, muted: bgm.muted, volume: bgm.volume, src: bgm.currentSrc || bgm.src }; },
};
