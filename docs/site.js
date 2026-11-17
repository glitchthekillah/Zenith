'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v) => Math.min(1, Math.max(0, v)), lerp = (a, b, t) => a + (b - a) * t;

// App windows are 1600x1000; scale each to its box.
const fit = () => $$('.win').forEach((w) => { $('iframe', w).style.transform = `scale(${w.offsetWidth / 1600})`; });
addEventListener('resize', fit); fit();

// Reveal on scroll.
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.rv').forEach((el) => io.observe(el));

// Pause looping motion that is off screen.
const vis = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('off', !e.isIntersecting)));
[$('#hero'), $('#orbit')].forEach((el) => vis.observe(el));

// Sunrise: the orb climbs out of the wordmark, then the app rises over the horizon.
const nav = $('#nav'), orb = $('#sunorb'), word = $('#word'), rise = $('.rise'), rwin = $('#rwin'), riseh = $('#riseh');
let mx = 0, my = 0, ticking = false;
const frame = () => {
  ticking = false;
  const vh = innerHeight, y = scrollY;
  nav.classList.toggle('solid', y > 40);
  const h = reduce ? 0 : clamp(y / vh);
  if (h < 1 || y < vh * 1.2) {
    orb.style.transform = `translate3d(${mx * 14}px,${(-h * vh * .5 + my * 10).toFixed(1)}px,0) scale(${1 + h * .18})`;
    word.style.transform = `translate3d(0,${(h * vh * .16).toFixed(1)}px,0)`;
  }
  const r = rise.getBoundingClientRect();
  const p = reduce ? 1 : clamp((vh - r.top) / (r.height - vh * .2));
  if (r.top < vh && r.bottom > 0) {
    const t = clamp(p * 1.35 - .1), e = 1 - Math.pow(1 - t, 3);
    rwin.style.transform = `translate3d(0,${lerp(22, 0, e).toFixed(2)}vh,0) rotateX(${lerp(42, 6, e).toFixed(2)}deg) rotateY(${(mx * 4).toFixed(2)}deg) scale(${lerp(.66, 1, e).toFixed(3)})`;
    riseh.style.opacity = Math.min(clamp((vh * .5 - r.top) / (vh * .4)), clamp(1.1 - t * 1.4)); riseh.style.transform = `translate3d(0,${(-t * 40).toFixed(1)}px,0)`;
  }
};
const kick = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
addEventListener('scroll', kick, { passive: true }); addEventListener('resize', kick);
if (!reduce && matchMedia('(pointer:fine)').matches) addEventListener('mousemove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; if (scrollY < innerHeight * 2.4) kick(); }, { passive: true });
frame();

// A day in Zenith: the step in the middle of the screen picks the screen, the hour and the light.
const steps = $$('.step'), tframe = $('#tframe'), dot = $('#dot'), tint = $('#tint');
let current = '';
const pick = (i) => {
  const s = steps[i], name = s.dataset.scene; if (name === current) return; current = name;
  steps.forEach((x, k) => x.classList.toggle('on', k === i));
  tframe.contentWindow?.postMessage({ scene: name }, location.origin);
  dot.style.transform = `rotate(${(i / (steps.length - 1)) * 180}deg)`;
  $('#dtime').textContent = $('time', s).textContent;
  $('#dph').textContent = $('.ph', s).textContent.split(' · ')[0];
  tint.style.setProperty('--tc', s.dataset.tc);
};
const sio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) pick(steps.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
steps.forEach((s) => sio.observe(s));
new IntersectionObserver(([e]) => { if (!e.isIntersecting) { tint.style.setProperty('--tc', 'rgba(0,0,0,0)'); current = current && '~' + current; } }).observe($('#day'));
tframe.addEventListener('load', () => { const c = current.replace('~', ''); current = ''; pick(Math.max(0, steps.findIndex((s) => s.dataset.scene === c))); });

// The sky runs a little slower while the page scrolls.
let st = 0; addEventListener('scroll', () => { document.body.classList.add('scrolling'); clearTimeout(st); st = setTimeout(() => document.body.classList.remove('scrolling'), 160); }, { passive: true });

// Direct downloads from the newest release.
fetch('https://api.github.com/repos/glitchthekillah/Zenith/releases/latest').then((r) => r.ok ? r.json() : null).then((rel) => {
  if (!rel) return;
  $$('[data-asset]').forEach((a) => { const f = rel.assets.find((x) => x.name.endsWith(a.dataset.asset)); if (f) a.href = f.browser_download_url; });
  $('#dl-ver').textContent = `Version ${rel.tag_name.replace(/^v/, '')}`;
}).catch(() => {});
