// Starts the app: title bar, top bar, routes and global shortcuts.
import { $, $$, esc, icon, render, go, current, settings, save, desktop, on, toast, serverLoading } from './core.js';
import * as jf from './jellyfin.js';
import * as kv from './kavita.js';
import * as rq from './requests.js';
import './watch.js';
import './read.js';
import './request.js';
import { applyTheme, applySky, applyAccent } from './settings.js';
import { loadAvatar, avatarHtml } from './avatar.js';
import { migrate, migrateStyle } from './tracks.js';
import * as player from './player.js';
import { watch as watchBlurhash } from './blurhash.js';

applyTheme(); applySky(); applyAccent();
watchBlurhash();
document.body.classList.toggle('calm', settings.app.liveSky === false);
migrate(save); migrateStyle(save);
loadAvatar().then(() => { if (!$('#top').hidden) topBar(); });

// Desktop: our own title bar and window buttons
if (desktop) {
  document.body.classList.add('desktop');
  $('#titlebar').hidden = false;
  const paint = (s) => { $('[data-win=maximize]').innerHTML = `<svg viewBox="0 0 24 24"><path d="${s.maximized ? 'M8 8h11v11H8z M5 16V5h11' : 'M5 5h14v14H5z'}"/></svg>`; $('[data-win=pin]').classList.toggle('on', !!s.pinned); };
  $('#titlebar').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-win]'); if (!b) return;
    const a = b.dataset.win;
    if (a === 'pin') { const on = !b.classList.contains('on'); paint(await desktop.win('pin', on)); toast(on ? 'Zenith stays on top of other windows' : 'Back to normal'); return; }
    paint((await desktop.win(a)) || {});
  });
  $('#titlebar').addEventListener('dblclick', async (e) => { if (!e.target.closest('.tb-buttons')) paint(await desktop.win('maximize')); });
  desktop.on((ch, d) => { if (ch === 'window' && 'maximized' in d) paint(d); });
  desktop.win('state').then((s) => s && paint(s));
}

// Pending server work lives outside the top bar, so updates never recreate navigation.
let serverLoadingTimer;
function paintServerLoading() {
  const pill = $('#server-loading');
  if (!pill) return;
  const state = serverLoading.current();
  const multiple = settings.groups.filter(g => Object.values(g.servers || {}).some(s => s?.url)).length > 1;
  const show = multiple && state.count && !$('#top').hidden;
  if (show) {
    pill.hidden = false;
    const names = state.names.filter(Boolean);
    $('[data-server-loading-text]', pill).textContent = names.length && names.length <= 2 ? `Loading ${names.join(' and ')}` : `Loading ${state.count} servers`;
    requestAnimationFrame(() => pill.classList.add('show'));
  } else pill.classList.remove('show');
  pill.title = state.names.join(', ');
}
on('server-loading', () => { clearTimeout(serverLoadingTimer); serverLoadingTimer = setTimeout(paintServerLoading, 150); });

// Top bar
const NAV = [['home', 'home', 'Home'], ['movies', 'film', 'Movies'], ['shows', 'tv', 'Shows'], ['read', 'book', 'Read'], ['request', 'plus', 'Request']];
function topBar() {
  const name = settings.profile?.name || settings.servers.jellyfin?.name || settings.servers.kavita?.name || settings.servers.ask?.name || '?';
  const show = { movies: jf.ready(), shows: jf.ready(), read: kv.ready(), request: !!rq.provider(), home: true };
  $('#top').hidden = false;
  $('#top').innerHTML = `<a class="brand" href="#/home"><span class="orb"></span><b>zenith</b></a>
    <nav>${NAV.filter(([k]) => show[k]).map(([k, ic, l]) => `<a class="navlink" data-nav="${k}" href="#/${k}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <form class="search" id="top-search" role="search"><div class="field">${icon('search')}<input name="q" placeholder="Search everything" autocomplete="off" aria-label="Search"></div></form>
    <div class="tools">${desktop ? `<a class="icon-btn dl-count" data-dl-badge href="#/downloads" title="Downloads">${icon('download')}</a>` : ''}
      <a class="icon-btn" href="#/settings" title="Settings">${icon('settings')}</a>
      <a class="me" href="#/settings" title="${esc(name)}" style="display:grid;place-items:center;text-decoration:none;overflow:hidden">${avatarHtml(name)}</a></div>`;
  paintNav();
  paintServerLoading();
}
function paintNav() {
  const { name } = current();
  const group = { item: 'home', library: 'home', series: 'read', 'request-item': 'request', 'request-search': 'request', requests: 'request' }[name] || name;
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === group));
}
on('route', paintNav);
on('servers', topBar);

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'top-search') return;
  e.preventDefault();
  const q = e.target.q.value.trim();
  if (q) { rememberSearch(q); hideRecent(); go(`/search/${encodeURIComponent(q)}`); }
});
document.addEventListener('keydown', (e) => {
  if (player.isOpen() || $('#reader:not([hidden])')) return;
  if (e.key === '/' && !/input|textarea|select/i.test(e.target.tagName)) { e.preventDefault(); $('#top-search input')?.focus(); }
  if (e.key === 'Escape' && document.activeElement?.closest('#top-search')) document.activeElement.blur();
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-act=reload]')) render(); });
// Keep the scrolling container in view on page change
on('route', () => { $('#app').scrollTop = 0; });

// Start
const anyServer = jf.ready() || kv.ready() || rq.provider();
if (!anyServer && !/^#\/(settings|welcome)/.test(location.hash)) location.hash = '#/welcome';
if (anyServer || /^#\/settings/.test(location.hash)) topBar();
on('route', ({ name }) => { if (name !== 'welcome' && $('#top').hidden) topBar(); if (name === 'welcome') $('#top').hidden = true; });
render();

// Seerr and ask-site sign-ins are cookies that end when the app closes; check and ask again if needed
setTimeout(async () => {
  try {
    if (settings.servers.ask?.name) await (await import('./core.js')).http(settings.servers.ask.url + '/api/me');
  } catch (e) { if (e.status === 401) toast('Sign in to the request site again in settings.'); }
  try { if (settings.servers.seerr?.userId) await (await import('./seerr.js')).me(); } catch (e) { if (e.status === 401 || e.status === 403) toast('Sign in to Seerr again in settings.'); }
}, 4000);

// Our own tooltips instead of the system ones: any element with a title gets a glass tooltip.
// The title moves to data-tip on first hover (that's what stops the native one from showing).
(() => {
  let tip, timer, cur;
  const hide = () => { clearTimeout(timer); cur = null; tip?.classList.remove('show'); };
  const place = (el) => {
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), pad = 8;
    let x = r.left + r.width / 2 - t.width / 2, y = r.top - t.height - 10, below = false;
    if (y < pad) { y = r.bottom + 10; below = true; }
    x = Math.max(pad, Math.min(x, innerWidth - t.width - pad));
    tip.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    tip.classList.toggle('below', below);
  };
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('[title],[data-tip]');
    if (!el || el === cur) return;
    if (el.hasAttribute('title')) {
      const t = el.getAttribute('title'); el.removeAttribute('title');
      if (t) { el.dataset.tip = t; if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t); }
    }
    const text = el.dataset.tip; if (!text) return;
    hide(); cur = el;
    timer = setTimeout(() => {
      if (cur !== el || !el.isConnected) return;
      if (!tip) { tip = document.createElement('div'); tip.className = 'ztip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
      tip.textContent = text; place(el); tip.classList.add('show');
    }, 380);
  }, true);
  document.addEventListener('pointerout', (e) => { if (cur && !cur.contains(e.relatedTarget)) hide(); }, true);
  for (const ev of ['pointerdown', 'scroll', 'keydown', 'blur']) addEventListener(ev, hide, true);
})();

// Linux's web engine blurs in software, which makes every glass panel slow to draw: use solid glass there
if (globalThis.zenithDesktop?.linuxStream) document.documentElement.classList.add('linux');

// Recent searches under the search box
function rememberSearch(q) {
  const list = (settings.app.recentSearches || []).filter((x) => x.toLowerCase() !== q.toLowerCase());
  settings.app.recentSearches = [q, ...list].slice(0, 8); save();
}
const hideRecent = () => $('#recent-searches')?.remove();
function showRecent(input) {
  hideRecent();
  const list = settings.app.recentSearches || []; if (!list.length || input.value.trim()) return;
  const form = input.closest('form');
  form.insertAdjacentHTML('beforeend', `<div id="recent-searches" class="recent-searches" role="listbox"><div class="rs-head"><span>Recent searches</span><button type="button" data-rs-clear>Clear</button></div>${list.map((q) => `<button type="button" class="rs-item" data-rs="${esc(q)}">${icon('search')}<span>${esc(q)}</span></button>`).join('')}</div>`);
}
document.addEventListener('focusin', (e) => { if (e.target.matches?.('#top-search input')) showRecent(e.target); });
document.addEventListener('input', (e) => { if (e.target.matches?.('#top-search input')) { if (e.target.value.trim()) hideRecent(); else showRecent(e.target); } });
document.addEventListener('mousedown', (e) => {
  const item = e.target.closest?.('[data-rs]');
  if (item) { e.preventDefault(); const q = item.dataset.rs; const inp = $('#top-search input'); if (inp) inp.value = q; rememberSearch(q); hideRecent(); inp?.blur(); go(`/search/${encodeURIComponent(q)}`); return; }
  if (e.target.closest?.('[data-rs-clear]')) { e.preventDefault(); settings.app.recentSearches = []; save(); hideRecent(); return; }
  if (!e.target.closest?.('#top-search')) hideRecent();
});
document.addEventListener('focusout', (e) => { if (e.target.matches?.('#top-search input')) setTimeout(() => { if (!document.activeElement?.closest('#top-search')) hideRecent(); }, 120); });

// Back to top on long pages
(() => {
  const app = document.getElementById('app'); if (!app) return;
  const btn = document.createElement('button'); btn.className = 'to-top'; btn.title = 'Back to top'; btn.innerHTML = icon('up');
  btn.onclick = () => app.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(btn);
  let raf = 0;
  app.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; btn.classList.toggle('show', app.scrollTop > 1400); }); }, { passive: true });
})();

// Mark rows that continue past an edge, so that edge dissolves instead of cutting cards off
(() => {
  const app = document.getElementById('app'); if (!app) return;
  const edge = (strip) => { const sh = strip.parentElement; if (!sh?.classList.contains('shelf')) return; const max = strip.scrollWidth - strip.clientWidth; sh.classList.toggle('more-l', strip.scrollLeft > 4); sh.classList.toggle('more-r', strip.scrollLeft < max - 4); };
  let raf = 0;
  const all = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; app.querySelectorAll('.shelf>.strip').forEach(edge); }); };
  app.addEventListener('scroll', (e) => { if (e.target.classList?.contains('strip')) edge(e.target); }, { passive: true, capture: true });
  new MutationObserver(all).observe(app, { childList: true, subtree: true });
  addEventListener('resize', all); all();
})();
