// Picture backgrounds (Settings > Appearance): a slideshow of what's on your servers, your own
// image, or one title you searched for. Drawn as two stacked pictures that crossfade, dimmed so
// the app stays readable. The moving skies live in sky.js.
import { settings, groups } from './core.js';
import * as jf from './jellyfin.js';
import * as kv from './kavita.js';
import * as rq from './requests.js';

const IMG_KEY = 'zenith-bg-image';
const CYCLE = 20000;
let layer = null, front = 0, timer = 0, pool = [], at = 0, mode = '';

const ensure = () => {
  if (layer?.isConnected) return layer;
  const sky = document.querySelector('.sky'); if (!sky) return null;
  layer = document.createElement('div'); layer.className = 'sky-img';
  layer.innerHTML = '<img alt=""><img alt="">';
  sky.prepend(layer);
  return layer;
};

// Load first, then fade in, so a half-loaded picture never shows
const show = (url, soft) => {
  const l = ensure(); if (!l || !url) return;
  const next = l.children[1 - front], cur = l.children[front];
  const im = new Image();
  im.onload = () => { next.src = url; next.classList.toggle('soft', !!soft); next.classList.add('on'); cur.classList.remove('on'); front = 1 - front; };
  im.src = url;
};

async function loadPool() {
  const out = [];
  await Promise.all(groups.with('jellyfin').map(async (g) => {
    try {
      const r = await groups.run(g, () => jf.items({ types: 'Movie,Series', sort: 'Random', limit: 40 }));
      for (const it of groups.tag(g, r?.Items || [])) if (it.BackdropImageTags?.length) out.push(jf.img(it, 'Backdrop', 1920));
    } catch {}
  }));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.filter(Boolean);
}

const step = () => {
  if (document.hidden || document.body.classList.contains('playing') || !pool.length) return;
  show(pool[at++ % pool.length]);
};

export async function applyPictureBg(m) {
  clearInterval(timer); timer = 0; mode = m;
  if (!['showcase', 'image', 'title'].includes(m)) { layer?.remove(); layer = null; return; }
  ensure();
  if (m === 'image') { let u = ''; try { u = localStorage.getItem(IMG_KEY) || ''; } catch {} show(u); return; }
  if (m === 'title') { const p = settings.look.pick; if (p?.url) show(p.url, p.soft); return; }
  if (!pool.length) pool = await loadPool();
  if (mode !== 'showcase') return;
  if (!pool.length) { setTimeout(() => { if (mode === 'showcase' && !timer) applyPictureBg('showcase'); }, 15000); return; }
  step(); timer = setInterval(step, CYCLE);
}

// Your own picture: scaled down to screen size and kept on this device only
export function saveImage(file) {
  return new Promise((ok, bad) => {
    const fr = new FileReader();
    fr.onerror = () => bad(new Error('Could not read that file.'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => bad(new Error("That file isn't a picture Zenith can open."));
      im.onload = () => {
        const s = Math.min(1, 2560 / im.width), c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.86);
        try { localStorage.setItem(IMG_KEY, url); } catch { return bad(new Error('That picture is too big to keep. Try a smaller one.')); }
        ok(url);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
export const savedImage = () => { try { return localStorage.getItem(IMG_KEY) || ''; } catch { return ''; } };

// Search your servers (and your request site, for things you don't have) for a title to use
export async function findTitles(q) {
  const out = [];
  await Promise.all([
    ...groups.with('jellyfin').map(async (g) => {
      try {
        const r = await groups.run(g, () => jf.search(q, 'Movie,Series'));
        for (const it of groups.tag(g, r?.Items || []).slice(0, 8)) if (it.BackdropImageTags?.length) out.push({ title: it.Name, year: it.ProductionYear || '', url: jf.img(it, 'Backdrop', 1920), thumb: jf.img(it, 'Backdrop', 400) });
      } catch {}
    }),
    ...groups.with('kavita').map(async (g) => {
      try {
        const r = await groups.run(g, () => kv.search(q));
        for (const s of (r?.series || []).slice(0, 6)) { const u = kv.cover(s.seriesId, g); out.push({ title: s.name, year: 'Book', url: u, thumb: u, soft: true }); }
      } catch {}
    }),
    (async () => {
      if (!rq.provider()) return;
      try { const r = await rq.search(q); for (const x of (r?.reading || []).slice(0, 4)) if (x.poster) out.push({ title: x.title, year: x.year || 'Book', url: x.poster, thumb: x.poster, soft: true }); for (const x of (r?.video || []).slice(0, 8)) if (x.backdrop) out.push({ title: x.title, year: x.year, url: x.backdrop.replace('/w1280/', '/original/'), thumb: x.backdrop.replace('/w1280/', '/w300/') }); } catch {}
    })(),
  ]);
  const seen = new Set();
  return out.filter((x) => { const k = (x.title + x.year).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 18);
}
