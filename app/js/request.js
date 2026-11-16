// Request pages: browse, search, a title's request page, and "My requests".
import { $, $$, esc, icon, route, go, defer, toast, settings, save, desktop, modal, loading, groups, render } from './core.js';
import * as jf from './jellyfin.js';
import { categoryTabs, groupedResults, kindOf, validCategory } from './categories.js';
import * as rq from './requests.js';
import { requestCard, needServer } from './watch.js';


const seen = rq.seen;

route('request', async (kind = 'trending') => {
  kind = ['trending', 'upcoming'].includes(kind) ? kind : validCategory(kind);
  if (kind === 'all') kind = 'trending';
  if (!rq.provider()) return needServer('a request server (Seerr or an ask site)');
  setTimeout(() => more(kind, 1), 0);
  return `<div class="page-head"><div><span class="kicker">Request</span><h1>Ask for something new</h1><p>Movies, shows and anime${rq.canRead() ? ', plus books, manga and comics' : ''}. It shows up on the server once it's approved.</p></div><a class="btn" href="#/requests">${icon('inbox')} My requests</a></div>
    <form class="field" id="rq-search" data-kind="${kind === 'trending' || kind === 'upcoming' ? 'all' : kind}" style="max-width:560px;margin-bottom:14px">${icon('search')}<input name="q" placeholder="Search for something to request" autocomplete="off"></form>
    ${categoryTabs(kind === 'trending' ? 'all' : kind, 'data-browse-category', (k) => `#/request/${k === 'all' ? 'trending' : k}`)}<a class="btn small" href="#/request/upcoming" style="margin-bottom:20px">Coming soon</a>
    <div id="rq-grid" data-kind="${kind}">${loading(18)}</div><div class="acts" style="justify-content:center;margin-top:20px"><button class="btn" id="rq-more" hidden>Load more</button></div>`;
});
async function more(kind, page) {
  const grid = $('#rq-grid'); if (!grid) return;
  try {
    const d = await rq.discover(kind, page);
    if (!grid.isConnected || grid !== $('#rq-grid')) return;
    grid.requestItems = page === 1 ? (d.items || []) : [...(grid.requestItems || []), ...(d.items || [])];
    const html = groupedResults(grid.requestItems.map((x) => ({kind: kindOf(x), html: requestCard(x)})), kind === 'trending' || kind === 'upcoming' ? 'all' : validCategory(kind));
    grid.innerHTML = html || '<div class="empty"><h2>Nothing here</h2></div>';
    const b = $('#rq-more'); if (b) { b.hidden = !d.more; b.onclick = () => more(kind, page + 1); }
  } catch (e) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Couldn't load this list</h2><p>${esc(e.message)}</p></div>`; }
}
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'rq-search') return;
  e.preventDefault();
  const q = e.target.q.value.trim(); if (q.length < 2) return;
  go(`/request-search/${encodeURIComponent(q)}/${validCategory(e.target.dataset.kind)}`);
});

let requestSearchFilter = null;
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-request-category]');
  if (!tab || !requestSearchFilter?.alive()) return;
  e.preventDefault(); requestSearchFilter.select(tab.dataset.requestCategory);
});
route('request-search', (q = '', category = 'all') => {
  if (!rq.provider()) return needServer('a request server');
  category = validCategory(category);
  return `<div class="page-head"><div><span class="kicker">Request</span><h1>Results for “${esc(q)}”</h1></div><a class="btn" href="#/requests">${icon('inbox')} My requests</a></div>
    <form class="field" id="rq-search" data-kind="${category}" style="max-width:680px;margin-bottom:18px">${icon('search')}<input name="q" value="${esc(q)}" placeholder="Search movies, shows, anime, books, manga" autocomplete="off" aria-label="Search requests"></form>`
    + categoryTabs(category, 'data-request-category', (k) => `#/request-search/${encodeURIComponent(q)}/${k}`)
    + defer(async (publish, alive) => {
      let entries = null;
      const paint = () => {
        if (!alive() || !entries) return;
        const html = groupedResults(entries, category);
        const needsReading = ['book', 'manga', 'comic'].includes(category) && !rq.canRead();
        publish(html || `<div class="empty"><h2>No matching results</h2><p>${needsReading ? 'Connect a request site in Settings to search books, manga and comics.' : 'Try another category or search term.'}</p></div>`);
      };
      requestSearchFilter = { alive, select(k) {
        category = validCategory(k);
        $('#rq-search').dataset.kind = category;
        $$('[data-request-category]').forEach((tab) => { const on = tab.dataset.requestCategory === category; tab.classList.toggle('on', on); if (on) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current'); });
        history.replaceState(null, '', `#/request-search/${encodeURIComponent(q)}/${category}`); paint();
      } };
      const d = await rq.search(q);
      if (!alive()) return;
      entries = [...(d.video || []), ...(d.reading || [])].map((x) => ({ kind: kindOf(x), html: requestCard(x) }));
      paint();
    }, loading(12));
});

// A title's request page
route('request-item', async (type, id) => {
  if (!rq.provider()) return needServer('a request server');
  if (['book', 'manga', 'comic'].includes(type)) return readingItem(type, id);
  // Which request server: every server group that has one; the choice is remembered while browsing
  const reqGroups = settings.groups.filter((g) => g.servers?.ask?.name || g.servers?.seerr);
  const reqG = reqGroups.find((g) => g.id === reqTo) || reqGroups.find((g) => g.id === groups.active().id) || reqGroups[0] || groups.active();
  const d = await groups.run(reqG, () => rq.title(type, id));
  const tv = type === 'tv';
  const open = (d.seasons || []).filter((s) => !s.status || s.status === 'none');
  const html = `<div class="detail">${d.backdrop ? `<div class="backdrop"><img src="${esc(d.backdrop)}" alt=""></div>` : ''}<div class="detail-in"><div class="art">${d.poster ? `<img src="${esc(d.poster)}" alt="">` : ''}</div><div>
    <span class="kicker">${tv ? (d.anime ? 'Anime' : 'Show') : 'Movie'}</span><h1>${esc(d.title)}</h1>${d.tagline ? `<p class="tagline">${esc(d.tagline)}</p>` : ''}
    <div class="facts">${[d.year, d.runtime ? `${d.runtime} min` : '', d.rating ? `<span class="star">${icon('star')} ${d.rating}</span>` : '', (d.genres || []).join(', ')].filter(Boolean).join('<span>·</span>')}</div>
    <p class="overview">${esc(d.overview || '')}</p>
    ${tv && d.seasons?.length ? `<div class="row-head"><h3 style="font-size:17px">Seasons</h3><button class="btn small" data-pickall>Pick all</button></div><div class="sgrid">${d.seasons.map((s) => `<button class="season ${!s.status || s.status === 'none' ? 'on' : ''}" data-season="${s.n}" ${s.status && s.status !== 'none' ? 'disabled' : ''}><b>${esc(s.name || `Season ${s.n}`)}</b><small>${s.status && s.status !== 'none' ? esc(rq.STATUS[s.status] || s.status) : `${s.episodes} episodes`}</small></button>`).join('')}</div>` : ''}
    ${d.quality?.list?.length ? `<label class="lab" style="max-width:280px;margin:10px 0">Quality<select data-quality>${d.quality.list.map((q) => `<option value="${q.id}" ${q.id === d.quality.def ? 'selected' : ''}>${esc(q.name)}</option>`).join('')}</select></label>` : ''}
    ${reqGroups.length > 1 ? `<div class="req-to"><span>Request on</span>${reqGroups.map((g) => `<button class="${g.id === reqG.id ? 'on' : ''}" data-req-to="${esc(g.id)}">${esc(groups.nameOf(g))}</button>`).join('')}<small>Each server has its own quality options and status</small></div>` : ''}
    ${defer(() => watchOn(type, id, d))}
    <div class="acts" data-req-g="${esc(reqG.id)}" style="margin-top:12px">${d.status === 'available' ? `<span class="state available">Already on the server</span><a class="btn" href="#/search/${encodeURIComponent(d.title)}">Find it to watch</a>` : (tv && !open.length) || (!tv && d.status !== 'none') ? `<span class="state ${esc(d.status)}">${esc(rq.STATUS[d.status] || 'Requested')}</span>` : `<button class="btn gold big" data-send='${esc(JSON.stringify({ type, id: d.id }))}'>${icon('plus')} Request</button>`}</div>
  </div></div></div>${extraHtml(d.extra, tv)}`;
  return html;
});
async function readingItem(type, id) {
  const x = seen.get(decodeURIComponent(id)) || seen.get(`${type}:${decodeURIComponent(id)}`) || { type, key: decodeURIComponent(id), title: decodeURIComponent(id).split(':').pop() };
  const head = `<div class="detail-in" style="padding:20px 0;grid-template-columns:200px minmax(0,1fr)"><div class="art">${x.poster ? `<img src="${esc(x.poster)}" alt="">` : `<div class="ph">${esc(x.title)}</div>`}</div><div><span class="kicker">${esc(type === 'book' ? 'Book' : type === 'manga' ? 'Manga' : 'Comic')}</span><h1 style="font:700 38px var(--disp);margin:6px 0">${esc(x.title)}</h1><div class="facts">${[x.author, x.year].filter(Boolean).map(esc).join('<span>·</span>')}</div><p class="overview">${esc(x.overview || x.description || '')}</p>`;
  if (type === 'book') return head + `<div class="acts">${x.status && x.status !== 'none' ? `<span class="state ${esc(x.status)}">${esc(rq.STATUS[x.status] || x.status)}</span>` : `<button class="btn gold big" data-send='${esc(JSON.stringify({ type: 'book', title: x.title, author: x.author, year: x.year, series: x.series, poster: x.poster, workId: x.workId, label: x.label }))}'>${icon('plus')} Request</button>`}</div><small class="hint">The owner approves book requests first.</small></div></div>`;
  const r = await rq.readingTitle(x);
  const d = { ...x, ...r };
  const vols = d.volumes || [];
  const unit = d.unitLabel || 'volume', units = d.unitPlural || unit + 's';
  const open = vols.filter((v) => !v.status || v.status === 'none');
  const payload = { type: d.type, title: d.title, key: d.key || x.key, workId: d.workId, catalogToken: d.catalogToken };
  return head + (vols.length ? `<div class="row-head"><h3 style="font-size:17px">${esc(units[0].toUpperCase() + units.slice(1))} (${vols.length})</h3><button class="btn small" data-pickall>Pick all</button></div><div class="sgrid">${vols.map((v) => `<button class="season ${!v.status || v.status === 'none' ? 'on' : ''}" data-unit="${esc(v.id)}" ${v.status && v.status !== 'none' ? 'disabled' : ''}><b>${esc(v.name || `${unit} ${v.n}`)}</b><small>${v.status && v.status !== 'none' ? esc(rq.STATUS[v.status] || v.status) : `Select ${esc(unit)}`}</small></button>`).join('')}</div>` : '')
    + `<div class="acts">${vols.length && !open.length ? '<span class="state available">Already available or requested</span>' : `<button class="btn gold big" data-send='${esc(JSON.stringify(payload))}' data-reading>${icon('plus')} Request</button>`}</div>${d.catalogNote ? `<small class="hint">${esc(d.catalogNote)}</small>` : ''}<small class="hint">The owner reviews your exact selection.</small></div></div>`;
}
document.addEventListener('click', async (e) => {
  const s = e.target.closest('.season'); if (s && !s.disabled) { s.classList.toggle('on'); return; }
  if (e.target.closest('[data-pickall]')) { const all = $$('.season:not(:disabled)'); const on = all.some((b) => !b.classList.contains('on')); all.forEach((b) => b.classList.toggle('on', on)); return; }
  const b = e.target.closest('[data-send]'); if (!b) return;
  const payload = JSON.parse(b.dataset.send);
  if (payload.type === 'tv') { payload.seasons = $$('.season.on').map((x) => Number(x.dataset.season)); if (!payload.seasons.length) return toast('Pick at least one season.', 'bad'); }
  if (b.hasAttribute('data-reading')) {
    const all = $$('[data-unit]:not(:disabled)'), on = $$('[data-unit].on');
    if (all.length && !on.length) return toast('Pick at least one.', 'bad');
    payload.volumeSelection = on.length === all.length ? { mode: 'all' } : { mode: 'selected', ids: on.map((x) => x.dataset.unit) };
  }
  const q = $('[data-quality]'); if (q) payload.profile = Number(q.value);
  b.disabled = true; const was = b.innerHTML; b.textContent = 'Requesting...';
  const rg = groups.byId(b.closest('[data-req-g]')?.dataset.reqG) || groups.active();
  try { const r = await groups.run(rg, () => rq.request(payload)); toast(r.msg || 'Requested', 'ok'); b.outerHTML = `<span class="state pending">${esc(rq.STATUS[r.status] || 'Requested')}</span>`; }
  catch (err) { toast(err.message, 'bad'); b.disabled = false; b.innerHTML = was; }
});

// My requests
route('requests', async () => {
  if (!rq.provider()) return needServer('a request server');
  const d = await rq.mine();
  const items = d.items || [];
  remember(items);
  return `<div class="page-head"><div><span class="kicker">Request</span><h1>My requests</h1></div><a class="btn" href="#/request">${icon('plus')} Request more</a></div>
    <div class="stack">${items.map((x) => `<div class="list-row"><div class="art">${x.poster ? `<img src="${esc(x.poster)}" alt="">` : ''}</div><div><b>${esc(x.title)}</b><small>${esc([x.year, x.type === 'tv' ? `Show${x.seasons?.length ? ` · seasons ${x.seasons.join(', ')}` : ''}` : x.type, x.created ? new Date(x.created).toLocaleDateString() : ''].filter(Boolean).join(' · '))}</small></div><span class="state ${esc(x.state || x.status)}">${esc(rq.STATUS[x.state || x.status] || x.state || x.status)}</span></div>`).join('') || '<div class="empty"><h2>No requests yet</h2><a class="btn gold" href="#/request">Request something</a></div>'}</div>`;
});
// Tell the user when something they asked for arrives
function remember(items) { for (const x of items) if (!(x.key in settings.seen)) settings.seen[x.key] = x.state || x.status; save(); }
async function checkArrivals() {
  if (!rq.provider() || !settings.app.notify) return;
  try {
    const items = (await rq.mine()).items || [];
    for (const x of items) {
      const st = x.state || x.status, was = settings.seen[x.key];
      if (was && was !== st && st === 'available') { desktop ? desktop.notify('Ready to watch', `${x.title} is on the server now.`) : toast(`${x.title} is ready.`, 'ok'); }
      settings.seen[x.key] = st;
    }
    save();
  } catch {}
}
setTimeout(checkArrivals, 15000);
setInterval(checkArrivals, 10 * 60 * 1000);
export { go, modal };

// ── Request page extras ──
let reqTo = null;
document.addEventListener('click', (e) => { const b = e.target.closest?.('[data-req-to]'); if (!b) return; reqTo = b.dataset.reqTo; render(); });
// "Watch on …": the title is already on one of your servers
async function watchOn(type, id, d) {
  const found = (await Promise.all(groups.with('jellyfin').map((g) => groups.run(g, () => jf.findTmdb(type, id, d.title, d.year)).then((it) => (it ? { g, it } : null)).catch(() => null)))).filter(Boolean);
  if (!found.length) return '';
  return `<div class="watch-on"><span class="state available">${icon('check')} On your servers</span>${found.map(({ g, it }) => `<a class="btn gold" href="#/item/${it.Id}${settings.groups.length > 1 ? '@' + g.id : ''}">${icon('play')} Watch on ${esc(groups.nameOf(g))}</a>`).join('')}</div>`;
}
const money = (n) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : n ? `$${n.toLocaleString()}` : '';
const langName = (c) => { try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(c); } catch { return c; } };
function extraHtml(x, tv) {
  if (!x) return '';
  const date = (s) => s ? new Date(s + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const facts = [
    ['Status', x.status], [tv ? 'First aired' : 'Released', date(x.released)], tv && x.lastAired ? ['Last aired', date(x.lastAired)] : null,
    tv && x.seasonsCount ? ['Seasons', `${x.seasonsCount} (${x.episodesCount} episodes)`] : null,
    [tv ? 'Created by' : 'Directed by', (tv ? x.creators : x.directors).join(', ')], ['Written by', (x.writers || []).join(', ')],
    ['Original language', x.language ? langName(x.language) : ''], [tv ? 'Network' : 'Studio', (tv && x.networks.length ? x.networks : x.studios).join(', ')],
    ['Country', (x.countries || []).join(', ')], ['Budget', money(x.budget)], ['Box office', money(x.revenue)], ['Collection', x.collection],
  ].filter((f) => f && f[1]);
  const r = x.ratings || {};
  const chips = [r.rt ? `<span class="rating-chip rt"><b>${r.rt.critics}%</b><small>Rotten Tomatoes</small></span>` : '', r.rt?.audience != null ? `<span class="rating-chip"><b>${r.rt.audience}%</b><small>Audience</small></span>` : '', r.imdb != null ? `<span class="rating-chip imdb"><b>${Number(r.imdb).toFixed(1)}</b><small>IMDb</small></span>` : ''].join('');
  const links = [x.trailer ? `<button class="btn" data-open="${esc(x.trailer)}">${icon('film')} Trailer</button>` : '', x.imdbId ? `<button class="btn" data-open="https://www.imdb.com/title/${esc(x.imdbId)}">IMDb</button>` : '', x.homepage ? `<button class="btn" data-open="${esc(x.homepage)}">Website</button>` : ''].join('');
  const cast = (x.cast || []).map((c) => `<div class="person"><div class="face">${c.photo ? `<img loading="lazy" src="${esc(c.photo)}" alt="">` : ''}</div><b>${esc(c.name)}</b><small>${esc(c.role)}</small></div>`).join('');
  return `<section class="req-more">
    ${chips || links ? `<div class="req-links">${chips}${links}</div>` : ''}
    ${facts.length ? `<dl class="req-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${cast ? `<section class="row"><div class="row-head"><h3>Cast</h3></div><div class="shelf"><button class="arrow l" data-scroll="-1" aria-label="Scroll left">${icon('back')}</button><div class="strip people">${cast}</div><button class="arrow r" data-scroll="1" aria-label="Scroll right">${icon('next')}</button></div></section>` : ''}
    ${x.keywords?.length ? `<div class="req-tags">${x.keywords.map((k) => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
  </section>`;
}
