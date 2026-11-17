'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Loader: out as soon as the page and the first frame are ready (never longer than 2s).
const hide = () => $('#ld').classList.add('out');
addEventListener('load', () => setTimeout(hide, 250)); setTimeout(hide, 2000);

// Every app window is 1600x1000; scale it to its box without blurring text.
const fit = () => $$('.win').forEach((w) => { const f = $('iframe', w); f.style.transform = `scale(${w.clientWidth / 1600})`; });
addEventListener('resize', fit); fit();

// Reveal on scroll.
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.rv').forEach((el) => io.observe(el));

// Tour: the step in the middle of the screen picks the screen shown in the sticky window.
const steps = $$('.step'), frame = $('#tframe'), bar = $('#bar');
bar.innerHTML = steps.map(() => '<i></i>').join('');
let current = '';
const pick = (i) => {
  const name = steps[i].dataset.scene; if (name === current) return; current = name;
  steps.forEach((s, k) => s.classList.toggle('on', k === i)); $$('i', bar).forEach((b, k) => b.classList.toggle('on', k === i));
  frame.contentWindow?.postMessage({ scene: name }, location.origin);
};
const sio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) pick(steps.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
steps.forEach((s) => sio.observe(s));
frame.addEventListener('load', () => { const c = current; current = ''; pick(Math.max(0, steps.findIndex((s) => s.dataset.scene === c))); });

// Hero window drifts a little with the mouse.
if (!reduce && matchMedia('(pointer:fine)').matches) {
  const el = $('#hero-par'); let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const tick = () => { x += (tx - x) * .08; y += (ty - y) * .08; el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; raf = Math.abs(tx - x) + Math.abs(ty - y) > .1 ? requestAnimationFrame(tick) : 0; };
  addEventListener('mousemove', (e) => { if (scrollY > innerHeight) return; tx = (e.clientX / innerWidth - .5) * 26; ty = (e.clientY / innerHeight - .5) * 18; if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
}

// Direct downloads from the newest release; the release page stays as the fallback.
fetch('https://api.github.com/repos/glitchthekillah/Zenith/releases/latest').then((r) => r.ok ? r.json() : null).then((rel) => {
  if (!rel) return;
  $$('[data-asset]').forEach((a) => { const f = rel.assets.find((x) => x.name.endsWith(a.dataset.asset)); if (f) a.href = f.browser_download_url; });
  $('#dl-ver').textContent = `Version ${rel.tag_name.replace(/^v/, '')}`;
}).catch(() => {});
