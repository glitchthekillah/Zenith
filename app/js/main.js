// Starts the app: title bar, top bar, routes and global shortcuts.
import { $, $$, esc, icon, render, go, current, settings, save, desktop, on, toast, serverLoading, groups, gsuf } from './core.js';
import * as jf from './jellyfin.js';
import * as kv from './kavita.js';
import * as rq from './requests.js';
import './watch.js';
import './read.js';
import './request.js';
import { applyTheme, applySky, applyAccent, applyStyle } from './settings.js';
import { loadAvatar, avatarHtml } from './avatar.js';
import { migrate, migrateStyle } from './tracks.js';
import * as player from './player.js';
import { watch as watchBlurhash } from './blurhash.js';

applyStyle(); applyTheme(); applySky(); applyAccent();
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
    <div class="hist"><button class="icon-btn" data-hist="-1" title="Back (Alt+Left)" aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button><button class="icon-btn" data-hist="1" title="Forward (Alt+Right)" aria-label="Forward"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button></div>
    <nav>${NAV.filter(([k]) => show[k]).map(([k, ic, l]) => `<a class="navlink" data-nav="${k}" href="#/${k}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <form class="search" id="top-search" role="search"><div class="field">${icon('search')}<input name="q" placeholder="Search everything" autocomplete="off" aria-label="Search"></div></form>
    <div class="tools">${desktop ? `<a class="icon-btn dl-count" data-dl-badge href="#/downloads" title="Downloads">${icon('download')}</a>` : ''}
      <a class="icon-btn" href="#/settings" title="Settings">${icon('settings')}</a>
      <a class="me" href="#/settings" title="${esc(name)}" style="display:grid;place-items:center;text-decoration:none;overflow:hidden">${avatarHtml(name)}</a></div>`;
  paintNav(); paintHist();
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

// Rows run to the window edge with the last card peeking about a third, a soft gutter with the arrow
// on whichever side has more, and page dots in the row header
(() => {
  const app = document.getElementById('app'); if (!app) return;
  const PEEK = 0.35;
  const size = (strip) => {
    if (strip.classList.contains('people')) return;
    const cs = getComputedStyle(strip), gap = parseFloat(cs.columnGap) || 16;
    const avail = strip.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const vw = innerWidth / 100, base = strip.classList.contains('wide') ? Math.min(320, Math.max(230, 24 * vw)) : Math.min(172, Math.max(132, 14 * vw));
    const fit = (k) => Math.floor((avail - gap * k) / (k + PEEK));
    const f = Math.max(1, Math.floor((avail - PEEK * base) / (base + gap)));
    const n = Math.abs(fit(f + 1) - base) < Math.abs(fit(f) - base) ? f + 1 : f;
    const w = fit(n);
    strip.dataset.step = String(n * (w + gap));
    if (strip.children.length <= n) { strip.style.removeProperty('--colw'); return; }
    if (strip.style.getPropertyValue('--colw') !== w + 'px') strip.style.setProperty('--colw', w + 'px');
  };
  const dots = (strip, sh) => {
    const head = sh.parentElement?.querySelector(':scope>.row-head'); if (!head) return;
    const step = Number(strip.dataset.step) || strip.clientWidth * 0.8, max = strip.scrollWidth - strip.clientWidth;
    const pages = max > 4 ? Math.ceil(max / step) + 1 : 0;
    let d = head.querySelector(':scope>.pdots');
    if (!pages) { d?.remove(); return; }
    if (!d) { d = document.createElement('span'); d.className = 'pdots'; head.insertBefore(d, head.querySelector(':scope>a')); }
    if (d.childElementCount !== pages) d.innerHTML = '<i></i>'.repeat(pages);
    const cur = strip.scrollLeft >= max - 4 ? pages - 1 : Math.min(pages - 1, Math.round(strip.scrollLeft / step));
    [...d.children].forEach((x, i) => x.classList.toggle('on', i === cur));
  };
  const edge = (strip, resize) => {
    const sh = strip.parentElement; if (!sh?.classList.contains('shelf')) return;
    if (resize) size(strip);
    const max = strip.scrollWidth - strip.clientWidth; sh.classList.toggle('more-l', strip.scrollLeft > 4); sh.classList.toggle('more-r', strip.scrollLeft < max - 4);
    dots(strip, sh);
  };
  let raf = 0;
  const all = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; app.querySelectorAll('.shelf>.strip').forEach((x) => edge(x, true)); }); };
  app.addEventListener('scroll', (e) => { if (e.target.classList?.contains('strip')) edge(e.target, false); }, { passive: true, capture: true });
  new MutationObserver(all).observe(app, { childList: true, subtree: true });
  addEventListener('resize', all); all();
})();


// Our own dropdown for the audio and subtitle pickers: styled like the app, never wider than the
// screen, long names cut with an ellipsis (full name on hover)
(() => {
  let menu = null, owner = null, openedAt = 0;
  const close = () => { menu?.remove(); menu = null; owner?.closest('.pp')?.classList.remove('open'); owner = null; };
  const open = (sel) => {
    close(); owner = sel; openedAt = performance.now(); sel.closest('.pp')?.classList.add('open');
    menu = document.createElement('div'); menu.className = 'zmenu'; menu.setAttribute('role', 'listbox');
    menu.innerHTML = [...sel.options].map((o, i) => `<button type="button" role="option" class="${o.selected ? 'on' : ''}" data-i="${i}" title="${o.text.replace(/"/g, '&quot;')}">${o.text.replace(/</g, '&lt;')}</button>`).join('');
    document.body.appendChild(menu);
    const r = (sel.closest('.pp') || sel).getBoundingClientRect(), m = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, innerWidth - m.width - 8));
    const below = r.bottom + 6 + m.height < innerHeight - 8;
    menu.style.left = left + 'px';
    menu.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - 6 - m.height)) + 'px';
    const on = menu.querySelector('.on'); if (on) menu.scrollTop = Math.max(0, on.offsetTop - 6);
  };
  document.addEventListener('mousedown', (e) => {
    const sel = e.target.closest('.pp select');
    if (sel) { e.preventDefault(); sel.focus({ preventScroll: true }); return menu && owner === sel ? close() : open(sel); }
    if (menu && !menu.contains(e.target)) close();
  }, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.zmenu [data-i]'); if (!b || !owner) return;
    const sel = owner; sel.selectedIndex = Number(b.dataset.i); close();
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu) { e.stopPropagation(); close(); } }, true);
  addEventListener('resize', close); addEventListener('hashchange', close);
  document.addEventListener('scroll', (e) => { if (menu && !menu.contains(e.target) && performance.now() - openedAt > 200) close(); }, true);
})();


// Back and forward buttons in the top bar. Each page we open gets a number, so we know whether
// there is somewhere to go back or forward to (works the same on Windows and Linux)
var histCur = 0, histMax = 0;
try { histMax = Number(sessionStorage.getItem('zhmax')) || 0; } catch {}
const numbered = () => history.state && typeof history.state.zi === 'number';
{ const rs = history.replaceState.bind(history); history.replaceState = (st, t, u) => rs({ ...(st || {}), zi: histCur }, t, u); }
if (numbered()) histCur = history.state.zi; else history.replaceState(null, '', location.href);
// Scroll memory: every history entry remembers how far down the page was scrolled, so Back, Forward
// and reloading land where you were. Opening a page fresh still starts at the top.
const scrollMemory = (() => {
  const app = document.getElementById('app'), KEY = 'zscroll';
  let saved = {}; try { saved = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch {}
  let busy = true, target = null, until = 0, timer = 0;
  // The page can finish rendering before the history counter below updates, so read the entry's own number.
  const key = () => (numbered() ? history.state.zi : histCur + 1) + '|' + location.hash;
  const store = () => { try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
  const persist = () => { clearTimeout(timer); timer = setTimeout(store, 150); };
  // Pages stream in (shelves, posters), so keep nudging toward the saved spot until it fits, the user
  // scrolls themselves, or a few seconds pass.
  const restore = () => {
    if (target === null || !app) return;
    if (performance.now() > until) { target = null; return; }
    // Keep holding the spot for the whole window: late content can shrink the page for a moment and
    // knock it back to the top. Any wheel, touch, click or key from the user ends it straight away.
    if (Math.abs(app.scrollTop - target) >= 2) app.scrollTop = target;
  };
  on('route', () => { busy = true; target = null; });
  on('rendered', () => { busy = false; const y = saved[key()]; if (y > 0) { target = y; until = performance.now() + 2500; restore(); } });
  on('patched', () => requestAnimationFrame(restore));
  // Grids and shelves can fill in without a 'patched' event, so also retry whenever the page grows.
  if (app && 'ResizeObserver' in window) new ResizeObserver(() => restore()).observe(document.getElementById('view') || app);
  setInterval(() => { if (target !== null) restore(); }, 120);
  if (app) {
    app.addEventListener('scroll', () => { if (busy || target !== null) return; saved[key()] = Math.round(app.scrollTop); persist(); }, { passive: true });
    for (const t of ['wheel', 'touchstart', 'pointerdown', 'keydown']) app.addEventListener(t, () => { target = null; }, { passive: true });
  }
  addEventListener('pagehide', store);
  // A brand new page replaces any forward history, and its old scroll spots with it.
  return { fresh(next) { for (const k of Object.keys(saved)) if (Number(k.split('|')[0]) >= next) delete saved[k]; persist(); } };
})();
addEventListener('hashchange', () => { if (!numbered()) scrollMemory.fresh(histCur + 1); });
addEventListener('hashchange', () => {
  if (numbered()) histCur = history.state.zi; // back or forward
  else { histCur += 1; histMax = histCur; history.replaceState(null, '', location.href); } // a new page
  try { sessionStorage.setItem('zhmax', String(histMax)); } catch {}
  paintHist();
});
function paintHist() {
  $$('[data-hist="-1"]').forEach((b) => { b.disabled = histCur <= 0; });
  $$('[data-hist="1"]').forEach((b) => { b.disabled = histCur >= histMax; });
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-hist]'); if (b && !b.disabled) history.go(Number(b.dataset.hist)); });
document.addEventListener('keydown', (e) => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input,textarea')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); history.back(); } else if (e.key === 'ArrowRight') { e.preventDefault(); history.forward(); }
});


// Live results under the search bar: what's already on your servers, as you type.
// Up and down to move, Enter opens the highlighted one (or the full results if none is), Esc closes.
(() => {
  let n = 0, timer = 0, hits = [], sel = -1;
  const box = () => $('#live-search');
  const close = () => { box()?.remove(); hits = []; sel = -1; };
  const kindOf = (t) => (t === 'Movie' ? 'Movie' : t === 'Series' ? 'Show' : 'Book');
  async function find(q) {
    const out = [];
    await Promise.all([
      ...groups.with('jellyfin').map(async (g) => {
        try {
          const r = await groups.run(g, () => jf.search(q, 'Movie,Series'));
          for (const it of groups.tag(g, r?.Items || []).slice(0, 8)) out.push({ key: `${it.Type}|${it.Name}|${it.ProductionYear || ''}`.toLowerCase(), title: it.Name, year: it.ProductionYear || '', kind: kindOf(it.Type), rating: it.CommunityRating ? Math.round(it.CommunityRating * 10) / 10 : null, count: it.Type === 'Series' ? it.ChildCount : null, pic: jf.img(it, 'Primary', 120), href: `#/item/${it.Id}${gsuf(it)}`, from: [groups.nameOf(g)], played: !!it.UserData?.Played });
        } catch {}
      }),
      ...groups.with('kavita').map(async (g) => {
        try {
          const r = await groups.run(g, () => kv.search(q));
          for (const x of (r?.series || []).slice(0, 6)) { const sx = groups.tag(g, [{ id: x.seriesId }])[0]; out.push({ key: `book|${x.name}`.toLowerCase(), title: x.name, year: '', kind: 'Book', rating: null, count: null, pic: kv.cover(x.seriesId, g.id), href: `#/series/${x.seriesId}${gsuf(sx)}`, from: [groups.nameOf(g)], played: false }); }
        } catch {}
      }),
    ]);
    // One row per title, listing every server that has it
    const by = new Map();
    for (const h of out) { const o = by.get(h.key); if (o) { for (const f of h.from) if (!o.from.includes(f)) o.from.push(f); } else by.set(h.key, h); }
    const ql = q.toLowerCase();
    return [...by.values()].sort((a, b) => (b.title.toLowerCase().startsWith(ql) - a.title.toLowerCase().startsWith(ql))).slice(0, 8);
  }
  const paint = (q) => {
    const form = $('#top-search'); if (!form) return;
    $('#recent-searches')?.remove();
    let el = box(); if (!el) { form.insertAdjacentHTML('beforeend', '<div id="live-search" class="live-search" role="listbox"></div>'); el = box(); }
    el.innerHTML = hits.length ? hits.map((h, i) => `<a class="ls-row${i === sel ? ' on' : ''}" href="${esc(h.href)}" data-ls="${i}" role="option"><span class="ls-pic">${h.pic ? `<img src="${esc(h.pic)}" alt="" loading="lazy">` : ''}</span><span class="ls-txt"><b>${esc(h.title)}</b><span class="ls-chips">${h.year ? `<i>${esc(String(h.year))}</i>` : ''}<i>${h.kind}</i>${h.count ? `<i>${h.count} season${h.count > 1 ? 's' : ''}</i>` : ''}${h.rating ? `<i>${icon('star')}${h.rating}</i>` : ''}${h.played ? '<i class="ok">Watched</i>' : ''}<i class="from">on ${esc(h.from.join(' + '))}</i></span></span></a>`).join('')
      + '<div class="ls-foot"><span>↑ ↓ to move</span><span>Enter to open</span><span>Esc to close</span></div>'
      : `<div class="ls-empty">Nothing on your servers matches “${esc(q)}”. Press Enter to search everywhere.</div>`;
  };
  document.addEventListener('input', (e) => {
    if (!e.target.matches?.('#top-search input')) return;
    const q = e.target.value.trim(); clearTimeout(timer);
    if (q.length < 2) { close(); return; }
    timer = setTimeout(async () => { const k = ++n; const r = await find(q); if (k !== n || e.target.value.trim() !== q) return; hits = r; sel = -1; paint(q); }, 220);
  });
  document.addEventListener('keydown', (e) => {
    if (!e.target.matches?.('#top-search input') || !box()) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!hits.length) return;
      sel = e.key === 'ArrowDown' ? (sel + 1) % hits.length : (sel <= 0 ? hits.length - 1 : sel - 1);
      $$('#live-search .ls-row').forEach((r, i) => r.classList.toggle('on', i === sel));
      $$('#live-search .ls-row')[sel]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && sel >= 0 && hits[sel]) {
      e.preventDefault(); const h = hits[sel]; rememberSearch(e.target.value.trim()); close(); e.target.blur(); location.hash = h.href;
    } else if (e.key === 'Escape') close();
  }, true);
  document.addEventListener('mousedown', (e) => {
    const r = e.target.closest?.('#live-search [data-ls]');
    if (r) { e.preventDefault(); const h = hits[Number(r.dataset.ls)]; const inp = $('#top-search input'); if (inp) { rememberSearch(inp.value.trim()); inp.blur(); } close(); if (h) location.hash = h.href; return; }
    if (!e.target.closest?.('#top-search')) close();
  });
  document.addEventListener('submit', (e) => { if (e.target.id === 'top-search') close(); }, true);
  addEventListener('hashchange', close);
})();
