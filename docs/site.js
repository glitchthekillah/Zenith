const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = !matchMedia('(pointer:fine)').matches;
const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const t = $(a.getAttribute('href')); if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.6 }); } }));
}
const fit = () => {};

let vis = true;

// ---------- Loader (same as ZenithClipper's) ----------
let parts = 0; const need = 1;
function loaded() { parts++; }
addEventListener('load', () => loaded(1));
const lbar = $('#ld-bar'); for (let i = 0; i < 20; i++) lbar.appendChild(document.createElement('i'));
const lbi = $$('i', lbar); let shown = 0; const lt0 = performance.now();
(function ldTick() {
  const target = Math.min(1, parts / need), minT = performance.now() - lt0 > (reduce ? 200 : 1500);
  const now = performance.now(), dt = Math.min(0.1, (now - (ldTick.t || now)) / 1000); ldTick.t = now;
  shown += ((minT ? target : Math.min(target, 0.9)) - shown) * (1 - Math.exp(-dt * 5.5)); if (target >= 1 && minT && shown > 0.985) shown = 1;
  const k = Math.round(shown * 20); lbi.forEach((b, i) => { b.classList.toggle('on', i < k); b.classList.toggle('head', i === k - 1); });
  $('#ld-n').textContent = String(Math.round(shown * 100)).padStart(3, '0') + '%';
  if (shown < 1) return requestAnimationFrame(ldTick);
  setTimeout(start, 200);
})();
setTimeout(() => { parts = need; }, 3500);
let started = false;
function start() {
  if (started) return; started = true;
  $('#ld').classList.add('out'); document.body.classList.add('ready');
  reel();
}
document.addEventListener('visibilitychange', () => { vis = !document.hidden; });

// ---------- Hero: a reel of scenes behind the real app ----------
const reelV = $$('.reel video'); let ri = 0;
function reel() { reelV[0]?.play().catch(() => {}); if (!reduce) setInterval(() => { if (scrollY > innerHeight * 1.2) return; const a = reelV[ri]; ri = (ri + 1) % reelV.length; const b = reelV[ri]; b.currentTime = 0; b.play().catch(() => {}); b.classList.add('on'); a.classList.remove('on'); setTimeout(() => a.pause(), 1200); }, 4200); }
const hwin = $('#hwin'), hfr = $('#hwin iframe');
const fitH = () => gsap.set(hfr, { scale: hwin.offsetWidth / 1600 }); addEventListener('resize', fitH); fitH();
const noBlur = (fr) => { try { const d = fr.contentDocument; const st = d.createElement('style'); st.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; d.head.appendChild(st); } catch (e) {} };
if (hfr.contentDocument?.readyState === 'complete') noBlur(hfr); hfr.addEventListener('load', () => noBlur(hfr));
ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onToggle: (s) => { hwin.style.visibility = s.isActive ? '' : 'hidden'; } });
if (!touch && !reduce) { const rx = gsap.quickTo(hwin, 'rotateY', { duration: 1, ease: 'power3.out' }), ry = gsap.quickTo(hwin, 'rotateX', { duration: 1, ease: 'power3.out' });
  addEventListener('pointermove', (e) => { if (scrollY > innerHeight) return; rx(-14 + (e.clientX / innerWidth - 0.5) * 10); ry(6 - (e.clientY / innerHeight - 0.5) * 8); }, { passive: true }); }
gsap.set(hwin, { rotateY: -14, rotateX: 6, transformPerspective: 1600 });
gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: reduce ? true : 1 } })
  .to('.hero .in, .corner', { opacity: 0, y: -60, ease: 'none' }, 0).to(hwin, { y: -120, opacity: 0, scale: 0.9, ease: 'none' }, 0).to('.reel', { scale: 1.1, opacity: 0.3, ease: 'none' }, 0);

// ---------- Story: the mess, the turn, the walkthrough ----------
const chipEls = $$('.chip'), chips = chipEls.map((el) => ({ el, bx: 0, by: 0, o: 0, k: 0, ph: Math.random() * 6.28 }));
const layout = () => {
  const W = innerWidth, H = innerHeight, n = chips.length, small = W < 900;
  chips.forEach((c, i) => {
    const a = (i / n) * Math.PI * 2 + 0.3, rx = W * (small ? 0.3 : 0.36), ry = H * (small ? 0.36 : 0.33);
    const jit = 0.82 + ((i * 37) % 10) / 40;
    c.w = c.el.offsetWidth; c.h = c.el.offsetHeight;
    c.bx = W / 2 + Math.cos(a) * rx * jit - c.w / 2; c.by = H / 2 + Math.sin(a) * ry * jit - c.h / 2;
  });
};
layout(); addEventListener('resize', layout);
let cmx = -9999, cmy = -9999, storyOn = false;
addEventListener('pointermove', (e) => { cmx = e.clientX; cmy = e.clientY; }, { passive: true });
const chipTick = (time) => {
  if (!storyOn) return;
  const W = innerWidth, H = innerHeight, t = time;
  chips.forEach((c) => {
    if (c.o <= 0.001 && c.k <= 0.001) { c.el.style.opacity = 0; return; }
    let x = c.bx + Math.sin(t * 0.6 + c.ph) * 14, y = c.by + Math.cos(t * 0.5 + c.ph) * 10;
    const dx = x + c.w / 2 - cmx, dy = y + c.h / 2 - cmy, d = Math.hypot(dx, dy);
    if (d < 240 && !touch) { const f = (240 - d) / 240 * 70; x += dx / d * f; y += dy / d * f; }
    x = Math.min(Math.max(x, 8), W - c.w - 8); y = Math.min(Math.max(y, 70), H - c.h - 8);
    const e = c.k * c.k;
    x += (W / 2 - c.w / 2 - x) * e; y += (H / 2 - c.h / 2 - y) * e;
    c.el.style.opacity = (c.o * (1 - Math.pow(c.k, 3))).toFixed(3);
    c.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(1 - 0.92 * c.k).toFixed(3)}) rotate(${(c.k * 300).toFixed(1)}deg)`;
  });
};
gsap.ticker.add(chipTick);
ScrollTrigger.create({ trigger: '#story', start: 'top bottom', end: 'bottom top', onToggle: (s) => { storyOn = s.isActive; } });

const story = gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: '#story', start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 1 } });
chips.forEach((c, i) => story.to(c, { o: 1, duration: 0.6 }, 0.1 + i * 0.25));
story.to('#pa', { opacity: 0, scale: 0.94, duration: 0.5, ease: 'power2.in' }, 3.6)
  .to('#pb', { opacity: 1, duration: 0.5 }, 4.0)
  .fromTo('#sorb', { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 1.2, ease: 'back.out(1.4)' }, 3.8);
chips.forEach((c, i) => story.to(c, { k: 1, duration: 1.0, ease: 'power3.in' }, 4.3 + i * 0.05));
story.to('#sorb', { scale: 1.35, duration: 0.5, ease: 'power2.in' }, 5.2).to('#sorb', { scale: 14, opacity: 0, duration: 1.1, ease: 'power3.in' }, 5.7)
  .to('#pb', { opacity: 0, scale: 1.2, duration: 0.6, ease: 'power2.in' }, 6.0)
  .to({}, { duration: 0.3 }, 6.9);

// ---------- Moments: the real app, driven by a cursor ----------
const CUR = '<svg viewBox="0 0 26 26"><path d="M3 2.5v18l4.6-4.1 3 6.8 3.2-1.4-2.9-6.7H17z" fill="#fff" stroke="#14101a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const CSS = '.cx{position:absolute;left:0;top:0;z-index:9999;pointer-events:none;opacity:0;will-change:transform}.cx svg{display:block;width:30px;height:30px;margin:-3px 0 0 -3.5px;overflow:visible;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45)) drop-shadow(0 8px 16px rgba(0,0,0,.35))}.cx .lb{position:absolute;left:20px;top:24px;padding:5px 11px 6px;border-radius:999px;font:600 14px/1.2 Inter,sans-serif;color:#fff;background:var(--cc);white-space:nowrap;box-shadow:0 4px 14px -4px rgba(0,0,0,.6)}.cx .rp{position:absolute;left:-18px;top:-18px;width:36px;height:36px;border-radius:50%;border:2.5px solid var(--cc);opacity:0}html,body{overflow:hidden!important}';
const states = [];
const when = (tl, t, on, off) => states.push({ tl, t, on, off, s: null });
gsap.ticker.add(() => states.forEach((w) => { const now = w.tl.time() >= w.t; if (now !== w.s) { w.s = now; (now ? w.on : w.off)?.(); } }));
const cover = () => Math.min(innerWidth / 1920, (innerHeight - 70) / 1200) * 0.97;

function moment(id, dur, build) {
  const sec = $(id), st = $('.mst', sec), scene = sec.dataset.scene, cap = $('.cap', st);
  const f = document.createElement('iframe'); f.className = 'scr'; f.title = 'Zenith ' + scene; f.tabIndex = -1; f.setAttribute('aria-hidden', 'true');
  st.prepend(f);
  const mount = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { f.src = `app/tour2.html?s=${scene}&calm`; mount.disconnect(); } }, { rootMargin: '150% 0px' }); mount.observe(sec);
  const vids = () => [...(f.contentDocument?.querySelectorAll('video') || [])];
  gsap.set(f, { scale: cover() }); addEventListener('resize', () => gsap.set(f, { scale: cover() }));
  ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: (s) => { f.style.visibility = s.isActive ? '' : 'hidden'; vids().forEach((v) => (s.isActive ? v.play().catch(() => {}) : v.pause())); } });
  f.addEventListener('load', () => {
    const doc = f.contentDocument; const style = doc.createElement('style'); style.textContent = CSS + '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; doc.head.appendChild(style);
    const S = doc.querySelector(`.scene[data-s="${scene}"]`) || doc;
    const q = (sel) => S.querySelector(sel), qa = (sel) => [...S.querySelectorAll(sel)];
    const byText = (sel, txt) => qa(sel).find((e) => e.textContent.includes(txt));
    const cursor = (name, color) => { const c = doc.createElement('div'); c.className = 'cx'; c.style.setProperty('--cc', color); c.innerHTML = CUR + `<span class="lb">${name}</span><i class="rp"></i>`; doc.body.appendChild(c); return c; };
    const at = (el, fx = 0.5, fy = 0.5) => { if (!el) return { x: 800, y: 500 }; const r = el.getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + r.height * fy }; };
    const go = (tl, c, el, t, d = 0.9, fx, fy) => tl.to(c, { x: () => at(el(), fx, fy).x, y: () => at(el(), fx, fy).y, duration: d, ease: 'power3.inOut' }, t);
    const tap = (tl, c, t) => tl.to(c, { scale: 0.82, duration: 0.1 }, t).to(c, { scale: 1, duration: 0.2 }, t + 0.1).fromTo(c.querySelector('.rp'), { scale: 0.4, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.55, ease: 'power2.out', immediateRender: false }, t);
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 0.7, invalidateOnRefresh: true } });
    tl.fromTo(cap, { opacity: 1 }, { opacity: 0, duration: 0.7 }, 2.2).fromTo([...cap.children], { y: 0 }, { y: -40, duration: 0.7, stagger: 0.05 }, 2.2);
    build({ tl, doc, S, q, qa, byText, cursor, at, go, tap, f, sec });
    tl.to({}, { duration: Math.max(0, dur - tl.duration()) });
    if (ScrollTrigger.isInViewport?.(sec)) vids().forEach((v) => v.play().catch(() => {}));
    ScrollTrigger.refresh();
  });
}
// Zoom toward a point without moving transform-origin, so zooming back always re-centres the window.
// Only part of the way (0.55), and clamped so the window edge never pulls into view.
const focusX = (p, k, dx = 0) => { const S = cover() * k, v = -(p.x + dx - 960) * S * 0.55, lim = Math.max(0, (1920 * S - innerWidth) / 2); return Math.max(-lim, Math.min(lim, v)); };
const focusY = (p, k, dy = 0) => { const S = cover() * k, v = -(p.y + dy - 600) * S * 0.55, lim = Math.max(0, (1200 * S - innerHeight) / 2); return Math.max(-lim, Math.min(lim, v)); };
const swapScene = (doc, n) => doc.querySelectorAll('.scene').forEach((s) => s.classList.toggle('on', s.dataset.s === n));
const videoize = (doc, img, src) => { if (!img) return null; const v = doc.createElement('video'); v.src = src; v.poster = src.replace('.mp4', '.jpg'); v.muted = true; v.loop = true; v.playsInline = true; v.className = img.className; v.setAttribute('style', (img.getAttribute('style') || '').replace(/background-image:[^;]*;?/, '') + ';width:100%;height:100%;object-fit:cover'); img.replaceWith(v); return v; };

// 01 Home: the camera pulls back, you browse what's waiting.
moment('#m-home', 11, ({ tl, doc, q, qa, cursor, go, tap, f }) => {
  videoize(doc, q('.hero-art img'), '../vid/sintel.mp4');
  const you = cursor('You', '#ff8a4c');
  tl.fromTo(f, { scale: () => cover() * 1.3, y: 120 }, { scale: () => cover(), y: 0, duration: 3.2, ease: 'power2.inOut' }, 0)
    .set(you, { x: 1500, y: 980 }, 0).to(you, { opacity: 1, duration: 0.2 }, 3);
  go(tl, you, () => q('.hello-resume'), 3.2, 1);
  if (q('.hello-resume')) tl.to(q('.hello-resume'), { scale: 1.04, duration: 0.3 }, 4).to(q('.hello-resume'), { scale: 1, duration: 0.3 }, 5);
  const cards = () => qa('.row')[0]?.querySelectorAll('.card') || [];
  [0, 1, 2].forEach((i) => { const t = 5 + i * 1.4; go(tl, you, () => cards()[i], t, 0.8, 0.5, 0.35); if (cards()[i]) tl.to(cards()[i], { y: -10, scale: 1.05, duration: 0.35 }, t + 0.6).to(cards()[i], { y: 0, scale: 1, duration: 0.35 }, t + 1.3); });
  tl.to(you, { opacity: 0, duration: 0.3 }, 10.2);
});

// 02 Shows: press Play, dive into the episode.
moment('#m-resume', 11, ({ tl, doc, byText, cursor, go, tap, at, f }) => {
  const you = cursor('You', '#ff8a4c'), btn = () => byText('button', 'Play S1');
  tl.fromTo(f, { scale: () => cover() * 1.12 }, { scale: () => cover(), duration: 3, ease: 'power2.out' }, 0).set(you, { x: 1100, y: 980 }, 0).to(you, { opacity: 1, duration: 0.2 }, 3);
  go(tl, you, btn, 3.2, 1.2); if (btn()) tl.to(btn(), { scale: 1.06, duration: 0.3 }, 4.2); tap(tl, you, 5); if (btn()) tl.to(btn(), { scale: 1, duration: 0.2 }, 5.1);
  tl.to(f, { scale: () => cover() * 4, transformOrigin: () => { const p = at(btn()); return `${p.x}px ${p.y}px`; }, opacity: 0, duration: 1.1, ease: 'power3.in' }, 5.6).to(you, { opacity: 0, duration: 0.2 }, 5.6);
  when(tl, 6.7, () => swapScene(doc, 'player'), () => swapScene(doc, 'show'));
  tl.fromTo(f, { scale: () => cover() * 0.9, opacity: 0, transformOrigin: '50% 50%' }, { scale: () => cover(), opacity: 1, transformOrigin: '50% 50%', duration: 1.2, ease: 'expo.out', immediateRender: false }, 6.8);
});

// 03 Player: the intro rolls, you skip it.
moment('#m-skip', 11, ({ tl, doc, q, cursor, go, tap, f }) => {
  const player = q('#player'); player?.querySelectorAll('video:not(.pv)').forEach((x) => x.remove()); const v = player?.querySelector('video.pv'); if (v) { v.src = '../vid/intro.mp4'; v.poster = '../vid/intro.jpg'; }
  const skip = doc.createElement('button'); skip.className = 'btn gold pl-skip'; skip.textContent = 'Skip intro'; skip.style.opacity = 0; player?.appendChild(skip);
  const you = cursor('You', '#ff8a4c'), done = () => q('.pl-seek .done'), knob = () => q('.pl-seek .knob');
  tl.fromTo(f, { scale: () => cover() * 1.15, rotate: -2 }, { scale: () => cover(), rotate: 0, duration: 3, ease: 'power2.out' }, 0)
    .fromTo(skip, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, ease: 'back.out(2)' }, 3).set(you, { x: 900, y: 980 }, 0).to(you, { opacity: 1, duration: 0.2 }, 3.4);
  go(tl, you, () => skip, 3.6, 1.4); tap(tl, you, 5.4);
  tl.to(skip, { opacity: 0, scale: 0.9, duration: 0.3 }, 5.5).to(you, { opacity: 0, duration: 0.3 }, 7);
  when(tl, 5.5, () => { if (v) { v.src = '../vid/fire.mp4'; v.play().catch(() => {}); } done() && (done().style.width = '9%'); knob() && (knob().style.left = '9%'); },
    () => { if (v) { v.src = '../vid/intro.mp4'; v.play().catch(() => {}); } done() && (done().style.width = '0.4%'); knob() && (knob().style.left = '0.4%'); });
});

// 04 Search: the camera flies to the search bar, three letters, every server answers.
moment('#m-search', 11, ({ tl, q, qa, cursor, go, tap, at, f }) => {
  const field = () => q('input[name=q]'), list = q('#live-search'), rows = qa('.ls-row');
  gsap.set(list, { opacity: 0 }); gsap.set(rows, { opacity: 0, y: -10 }); if (field()) field().value = '';
  const you = cursor('You', '#ff8a4c'), word = 'the';
  tl.to(f, { scale: () => cover() * 1.25, x: () => focusX(at(field()), 1.25), y: () => focusY(at(field(), 0.5, 0.5), 1.25, 200), duration: 1.4, ease: 'power3.inOut' }, 2.4)
    .set(you, { x: 900, y: 500 }, 0).to(you, { opacity: 1, duration: 0.2 }, 3.4);
  go(tl, you, field, 3.6, 0.9, 0.3); tap(tl, you, 4.6);
  for (let k = 1; k <= word.length; k++) when(tl, 4.8 + k * 0.35, () => { if (field()) field().value = word.slice(0, k); }, () => { if (field()) field().value = word.slice(0, k - 1); });
  tl.to(list, { opacity: 1, duration: 0.2 }, 6).to(rows, { opacity: 1, y: 0, stagger: 0.15, duration: 0.5, ease: 'back.out(1.6)' }, 6.1);
  go(tl, you, () => rows[2], 7.2, 0.9); tl.to(f, { scale: () => cover(), x: 0, y: 0, duration: 1.4, ease: 'power3.inOut' }, 8.6).to(you, { opacity: 0, duration: 0.3 }, 9.8);
});

// 05 Library: the wall tilts flat, one filter, what you've seen falls away.
moment('#m-library', 11, ({ tl, q, qa, byText, cursor, go, tap, f }) => {
  const you = cursor('You', '#ff8a4c'), chip = () => byText('button.chip', 'Not watched'), all = () => byText('button.chip', 'All');
  const seen = () => qa('.card').filter((c) => c.querySelector('.check svg'));
  tl.fromTo(f, { scale: () => cover() * 0.92, rotateX: 38, rotateZ: -8, y: 120 }, { scale: () => cover(), rotateX: 0, rotateZ: 0, y: 0, duration: 3.4, ease: 'power3.inOut' }, 0)
    .set(you, { x: 1200, y: 900 }, 0).to(you, { opacity: 1, duration: 0.2 }, 3.4);
  go(tl, you, chip, 3.6, 1.1); tap(tl, you, 4.9);
  when(tl, 5, () => { all()?.classList.remove('on'); chip()?.classList.add('on'); }, () => { chip()?.classList.remove('on'); all()?.classList.add('on'); });
  tl.to(seen(), { y: (i) => 900 + (i % 3) * 140, rotation: (i) => (i % 2 ? 1 : -1) * (18 + i * 6), opacity: 0, duration: 1.8, ease: 'power2.in', stagger: 0.1 }, 5.2)
    .to(you, { opacity: 0, duration: 0.3 }, 9.6);
});

// 06 Servers: Alex adds their server, Sam drops in to look.
moment('#m-friends', 11, ({ tl, doc, S, q, qa, cursor, go, tap, at, f }) => {
  S.querySelectorAll('.set-pane').forEach((p) => { p.hidden = p.dataset.pane !== 'servers'; });
  S.querySelectorAll('[data-set-nav],[data-pane-link]').forEach((n) => n.classList.toggle('on', (n.dataset.setNav || n.dataset.paneLink) === 'servers'));
  const add = () => q('.srv-add'), card = q('.srv-card');
  const fresh = card?.cloneNode(true); if (fresh) { const nm = fresh.querySelector('.srv-name'); if (nm) { nm.value = "Alex's server"; nm.setAttribute('value', "Alex's server"); } const o = fresh.querySelector('.srv-orb'); if (o) o.textContent = 'A'; const sm = fresh.querySelector('.srv-title small'); if (sm) sm.textContent = '2 of 4 connected'; fresh.style.display = 'none'; add()?.parentNode.insertBefore(fresh, add()); }
  const alex = cursor('Alex', '#8c6bff'), sam = cursor('Sam', '#1fbf8f'), you = cursor('You', '#ff8a4c');
  tl.to(f, { scale: () => cover() * 1.25, x: () => focusX(at(add()), 1.25, -200), y: () => focusY(at(add()), 1.25), duration: 1.6, ease: 'power3.inOut' }, 2.2)
    .set(alex, { x: 1700, y: 600 }, 0).to(alex, { opacity: 1, duration: 0.2 }, 3.2).set(you, { x: 200, y: 1000 }, 0).to(you, { opacity: 1, duration: 0.2 }, 3.4);
  go(tl, alex, add, 3.4, 1.4); go(tl, you, () => card, 3.6, 1.6, 0.3, 0.2); tap(tl, alex, 5);
  when(tl, 5.1, () => { if (fresh) { fresh.style.display = ''; gsap.fromTo(fresh, { opacity: 0, scale: 0.85, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.6)' }); gsap.fromTo(fresh, { boxShadow: '0 0 0 3px #8c6bff, 0 0 60px rgba(140,107,255,.6)' }, { boxShadow: '0 0 0 0 rgba(140,107,255,0)', duration: 1.8, delay: 0.5 }); } }, () => { if (fresh) fresh.style.display = 'none'; });
  go(tl, alex, () => fresh, 6, 1, 0.5, 0.25);
  tl.set(sam, { x: 800, y: 1050 }, 0).to(sam, { opacity: 1, duration: 0.2 }, 6.4); go(tl, sam, () => fresh, 6.5, 1.4, 0.7, 0.6);
  tl.to(f, { scale: () => cover(), x: 0, y: 0, duration: 1.4, ease: 'power3.inOut' }, 8.4).to([alex, sam, you], { opacity: 0, duration: 0.3 }, 10);
});

// Hide the site's bar while the app's own bar is on screen.
ScrollTrigger.create({ trigger: '#m-home', start: 'top 80px', endTrigger: '#m-friends', end: 'bottom top', onToggle: (s) => gsap.to('.nav', { autoAlpha: s.isActive ? 0 : 1, y: s.isActive ? -20 : 0, duration: 0.35 }) });

// ---------- Chapters ----------
const fan = $$('#fan img');
gsap.fromTo(fan, { x: 0, rotation: (i) => (i - 3) * 2, y: 40 }, { x: (i) => (i - 3) * innerWidth * (innerWidth < 900 ? 0.09 : 0.042), rotation: (i) => (i - 3) * 9, y: (i) => Math.abs(i - 3) * 22, ease: 'none',
  scrollTrigger: { trigger: '#watch', start: 'top 80%', end: 'center center', scrub: 1, invalidateOnRefresh: true } });
gsap.fromTo('#reader', { rotateX: 32, y: 80, scale: 0.9 }, { rotateX: 0, y: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '#read', start: 'top 85%', end: 'center center', scrub: 1 } });
gsap.fromTo('#shelfx', { x: 200 }, { x: -260, ease: 'none', scrollTrigger: { trigger: '#read', start: 'top bottom', end: 'bottom top', scrub: 1 } });
gsap.fromTo('.rprog i', { width: '4%' }, { width: '40%', ease: 'none', scrollTrigger: { trigger: '#read', start: 'top 70%', end: 'bottom 40%', scrub: true } });
ScrollTrigger.create({ trigger: '#get', start: 'top bottom', end: 'bottom top', onToggle: (s) => { const v = $('.getbg'); if (s.isActive) v.play().catch(() => {}); else v.pause(); } });
gsap.fromTo('.req', { x: 120, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.15, ease: 'power2.out', scrollTrigger: { trigger: '#request', start: 'top 75%', end: 'center center', scrub: 1 } });
$$('.ch h2').forEach((h) => gsap.fromTo(h, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 95%', end: 'top 55%', scrub: 1 } }));

// ---------- Giant type ----------
const ga = $('#ga'), gb = $('#gb');
gsap.timeline({ scrollTrigger: { trigger: '#giant', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true } })
  .fromTo(ga, { x: () => innerWidth * 0.3 }, { x: () => innerWidth - ga.scrollWidth, ease: 'none' }, 0)
  .fromTo(gb, { x: () => innerWidth - gb.scrollWidth }, { x: () => innerWidth * 0.1, ease: 'none' }, 0);

// ---------- Outro: word by word ----------
const ow = $('#ow'); ow.innerHTML = ow.textContent.split(' ').map((w) => `<span>${w}</span>`).join(' ');
gsap.to('#ow span', { opacity: 1, stagger: 0.3, ease: 'none', scrollTrigger: { trigger: '#outro', start: 'top top', end: 'bottom bottom', scrub: true } });

// ---------- Direct downloads from the newest release ----------
fetch('https://api.github.com/repos/glitchthekillah/Zenith/releases/latest').then((r) => r.ok ? r.json() : null).then((rel) => {
  if (!rel) return;
  $$('[data-asset]').forEach((a) => { const f = rel.assets.find((x) => x.name.endsWith(a.dataset.asset)); if (f) a.href = f.browser_download_url; });
  const v = rel.tag_name.replace(/^v/, ''); $('#dl-ver').textContent = `Version ${v}`; $$('.vv').forEach((e) => { e.textContent = v; });
}).catch(() => {});
addEventListener('load', () => ScrollTrigger.refresh());
