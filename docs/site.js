import * as THREE from 'three';
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

// ---------- WebGL: a living sun with your library in orbit ----------
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 1.75));
renderer.setClearColor(0x07070d, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
const rig = new THREE.Group(); scene.add(rig);

const NOISE = `
vec3 hash3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return -1.0+2.0*fract(sin(p)*43758.5453123);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
return mix(mix(mix(dot(hash3(i),f),dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p*=2.02;a*=.5;}return s;}`;

// The sun: the Zenith orb, alive.
const sunMat = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 } },
  vertexShader: `varying vec3 vP;varying vec3 vN;varying vec3 vV;void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
  fragmentShader: `uniform float uT;varying vec3 vP;varying vec3 vN;varying vec3 vV;${NOISE}
  void main(){
    vec3 p=vP*1.6;float n=fbm(p+vec3(0.,uT*.06,uT*.04)+fbm(p*1.7-uT*.05)*1.4);
    float l=dot(vN,normalize(vec3(-.55,.7,.6)))*.5+.5;
    float k=clamp(l*1.05+n*.55,0.,1.);
    vec3 c=mix(vec3(.16,.11,.37),vec3(.48,.30,1.),smoothstep(.0,.35,k));
    c=mix(c,vec3(1.,.44,.56),smoothstep(.3,.62,k));c=mix(c,vec3(1.,.71,.28),smoothstep(.58,.85,k));c=mix(c,vec3(1.,.96,.86),smoothstep(.86,1.,k));
    float f=pow(1.-max(dot(vN,vV),0.),2.6);c+=vec3(1.,.55,.45)*f*.9;
    gl_FragColor=vec4(c,1.);}`,
});
const sun = new THREE.Mesh(new THREE.SphereGeometry(1.25, 96, 96), sunMat); rig.add(sun);

// Soft glow behind the sun.
const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 vU;void main(){float d=length(vU-.5)*2.;float a=pow(max(1.-d,0.),2.4);gl_FragColor=vec4(mix(vec3(.55,.3,1.),vec3(1.,.5,.4),pow(a,.6))*a*.75,1.);}`,
}));
glow.position.z = -0.6; rig.add(glow);

// The ring: posters from the library orbiting the sun, one draw call.
const COLS = 7, ROWS = 4, COUNT = touch ? 40 : 56;
const tex = new THREE.TextureLoader().load('posters.jpg', () => loaded(1));
tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const pGeo = new THREE.PlaneGeometry(0.62, 0.93, 8, 1);
const idx = new Float32Array(COUNT), ang = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) { idx[i] = i % 28; ang[i] = i / COUNT * Math.PI * 2; }
pGeo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
pGeo.setAttribute('aAng', new THREE.InstancedBufferAttribute(ang, 1));
const ringMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide, transparent: true,
  uniforms: { uTex: { value: tex }, uSpin: { value: 0 }, uR: { value: 3.1 }, uSpread: { value: 0 } },
  vertexShader: `attribute float aIdx;attribute float aAng;uniform float uSpin;uniform float uR;uniform float uSpread;varying vec2 vU;varying float vD;varying float vF;
  void main(){
    float a=aAng+uSpin;float r=uR+sin(aIdx*12.9)*.12+uSpread*(fract(aIdx*.37)-.5)*2.;
    vec3 p=position;p.z-=p.x*p.x*.25;
    float y=sin(aIdx*7.3)*.06;
    vec3 c=vec3(cos(a)*r,y,sin(a)*r);
    float ry=-a+1.5708;mat3 R=mat3(cos(ry),0.,-sin(ry),0.,1.,0.,sin(ry),0.,cos(ry));
    vec4 w=modelMatrix*vec4(c+R*p,1.);vec4 mv=viewMatrix*w;
    vD=-mv.z;vF=sin(a);
    float col=mod(aIdx,7.),row=floor(aIdx/7.);vU=vec2((uv.x+col)/7.,(uv.y+(3.-row))/4.);
    gl_Position=projectionMatrix*mv;}`,
  fragmentShader: `uniform sampler2D uTex;varying vec2 vU;varying float vD;varying float vF;
  void main(){vec3 c=texture2D(uTex,vU).rgb;float back=smoothstep(.3,-.6,vF);c*=mix(1.,.45,back);
  c=mix(c,vec3(.03,.03,.06),clamp((vD-9.)/8.,0.,.85));gl_FragColor=vec4(c,1.);}`,
});

const ringG = new THREE.Group(); rig.add(ringG);
const ringMesh = new THREE.InstancedMesh(pGeo, ringMat, COUNT);
ringG.add(ringMesh);
const dummy = new THREE.Matrix4(); for (let i = 0; i < COUNT; i++) ringMesh.setMatrixAt(i, dummy);
ringMesh.frustumCulled = false;

// Stars.
const SN = 900, sp = new Float32Array(SN * 3);
for (let i = 0; i < SN; i++) { const r = 18 + Math.random() * 20, t = Math.random() * 6.283, u = Math.acos(2 * Math.random() - 1); sp.set([r * Math.sin(u) * Math.cos(t), r * Math.cos(u), r * Math.sin(u) * Math.sin(t)], i * 3); }
const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.06, color: 0xd9d2ff, transparent: true, opacity: 0.7, depthWrite: false }));
scene.add(stars);

// State driven by scroll.
const wide = innerWidth > 900;
const S = { camZ: wide ? 9.4 : 11, camY: 0.9, tilt: 0.42, roll: -0.12, spin: 0, spinV: 0.05, x: wide ? 2.5 : 0, y: wide ? -0.15 : 1.5, spread: 0, scale: 1 };
const size = () => {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w < h ? 58 : 38; camera.updateProjectionMatrix(); fit();
};
addEventListener('resize', size); size();

let getP = 0, mx = 0, my = 0, sx = 0, sy = 0, last = 0, running = true, vis = true;
if (!touch) addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
const clock = new THREE.Clock();
function draw() {
  const t = clock.getElapsedTime(), dt = Math.min(t - last, 0.05); last = t;
  sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05;
  if (getP > 0) Object.assign(S, { x: 0, y: -3.4 + getP * 0.5, camY: 1.2, camZ: 9, tilt: 0.3, roll: 0, scale: 1.15, spinV: 0.05, spread: 0 });
  if (!reduce) S.spin += dt * S.spinV;
  sunMat.uniforms.uT.value = reduce ? 4 : t;
  ringMat.uniforms.uSpin.value = S.spin; ringMat.uniforms.uSpread.value = S.spread;
  ringG.rotation.set(S.tilt, 0, S.roll);
  rig.position.set(S.x, S.y, 0); rig.scale.setScalar(S.scale);
  camera.position.set(sx * 0.8, S.camY - sy * 0.5, S.camZ); camera.lookAt(S.x * 0.15, S.y * 0.3, 0);
  stars.rotation.y = t * 0.004 + S.spin * 0.05;
  renderer.render(scene, camera);
}


// ---------- Loader (same as ZenithClipper's) ----------
let parts = 0; const need = 2;
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
  if (!reduce) gsap.from(S, { camZ: 17, camY: 5, spin: -1.4, duration: 2.8, ease: 'expo.out' });
}
const glOn = () => parseFloat(canvas.style.opacity || '1') > 0.01;
const loop2 = () => { if (vis && glOn()) draw(); requestAnimationFrame(loop2); };
draw(); loop2();
document.addEventListener('visibilitychange', () => { vis = !document.hidden; });

// ---------- Hero out: the camera pulls back and the sun waits behind the story ----------
gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: reduce ? true : 1 } })
  .to(S, { x: 0, y: 0, camZ: 11, camY: 0.6, tilt: 0.25, scale: 0.7, spinV: 0.03, ease: 'none' }, 0)
  .to(canvas, { opacity: 0.5, ease: 'none' }, 0)
  .to('.hero .in, .corner', { opacity: 0, y: -60, ease: 'none' }, 0);

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
  .to(canvas, { opacity: 1, duration: 0.6, ease: 'none' }, 4.0)
  .to(S, { scale: 1.25, camZ: 9, spinV: 0.4, duration: 1.4, ease: 'power2.inOut' }, 4.0);
chips.forEach((c, i) => story.to(c, { k: 1, duration: 1.0, ease: 'power3.in' }, 4.3 + i * 0.05));
story.to(S, { scale: 2.6, camZ: 6, duration: 1.2, ease: 'power3.in' }, 5.4)
  .to('#pb', { opacity: 0, scale: 1.2, duration: 0.6, ease: 'power2.in' }, 6.0)
  .to(canvas, { opacity: 0, duration: 0.5, ease: 'none' }, 6.4)
  .to({}, { duration: 0.3 }, 6.9);

// ---------- Moments: a cursor drives the app ----------
const CUR = '<svg viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16.8 21l-3 1.4-3.6-6.6L5 20z" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const mkCursor = (stage, name, color) => { const c = document.createElement('div'); c.className = 'cx'; c.style.setProperty('--cc', color); c.innerHTML = CUR + `<span>${name}</span>`; stage.appendChild(c); return c; };
const mkRipple = (stage) => { const r = document.createElement('div'); r.className = 'rpl'; stage.appendChild(r); return r; };
const rel = (stage, el, fx = 0.5, fy = 0.5) => { const a = stage.getBoundingClientRect(), b = el.getBoundingClientRect(); return { x: b.left - a.left + b.width * fx, y: b.top - a.top + b.height * fy }; };
const goTo = (tl, c, stage, el, t, d = 0.9, fx, fy) => tl.to(c, { x: () => rel(stage, el, fx, fy).x, y: () => rel(stage, el, fx, fy).y, duration: d, ease: 'power3.inOut' }, t);
const tap = (tl, c, r, stage, el, t) => tl.to(c, { scale: 0.8, duration: 0.12 }, t).to(c, { scale: 1, duration: 0.2 }, t + 0.12)
  .fromTo(r, { left: () => rel(stage, el).x, top: () => rel(stage, el).y, scale: 0.3, opacity: 1 }, { scale: 3.5, opacity: 0, duration: 0.6, ease: 'power2.out', immediateRender: false }, t);
const moment = (id, build, dur = 10) => {
  const sec = $(id), stage = $('.mst', sec), vids = $$('video', sec);
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 0.8, invalidateOnRefresh: true,
    onToggle: (s) => vids.forEach((v) => { if (s.isActive && !v.dataset.hold) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); }) } });
  ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onEnter: () => vids.forEach((v) => { v.preload = 'auto'; }) });
  build(tl, stage, sec); tl.to({}, { duration: Math.max(0, dur - tl.duration()) });
  return tl;
};
const states = []; // threshold switches driven by timeline time
const when = (tl, t, on, off) => { states.push({ tl, t, on, off, s: null }); };
gsap.ticker.add(() => states.forEach((w) => { const now = w.tl.time() >= w.t; if (now !== w.s) { w.s = now; (now ? w.on : w.off)?.(); } }));

// 01 Home: browse Continue watching, the spotlight follows your pick.
moment('#m-home', (tl, st) => {
  const c = mkCursor(st, 'You', '#ffb547'), r = mkRipple(st), cards = $$('.cw', st), v = $('#m1v');
  const pick = (el) => { cards.forEach((x) => x.classList.toggle('sel', x === el)); const src = el ? `vid/${el.dataset.v}.mp4` : 'vid/sintel.mp4';
    $('#m1t').textContent = el ? el.dataset.t : 'Sintel'; $('#m1m').textContent = el ? el.dataset.m : '2010 · 15m · Fantasy, Animation';
    if (!v.src.endsWith(src)) { v.src = src; v.poster = src.replace('.mp4', '.jpg'); v.play().catch(() => {}); }
    gsap.fromTo(['#m1t', '#m1m'], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'expo.out' }); };
  tl.fromTo('.m1 .mcap', { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.8 }, 0)
    .fromTo(cards, { y: 120, opacity: 0, rotateX: -30 }, { y: 0, opacity: 1, rotateX: 0, stagger: 0.12, duration: 0.8, ease: 'expo.out' }, 0.2)
    .set(c, { x: () => st.offsetWidth * 0.9, y: () => st.offsetHeight * 1.05 }, 0).to(c, { opacity: 1, duration: 0.2 }, 0.9);
  cards.forEach((el, i) => { const t = 1.2 + i * 2;
    goTo(tl, c, st, el, t, 0.8); tl.to(el, { y: -14, scale: 1.06, duration: 0.4 }, t + 0.5); tap(tl, c, r, st, el, t + 1.2); tl.to(el, { y: 0, scale: 1, duration: 0.4 }, t + 1.7);
    when(tl, t + 1.2, () => pick(el), () => pick(i ? cards[i - 1] : null)); });
  tl.to(c, { opacity: 0, duration: 0.3 }, 9.4);
});

// 02 Resume: the clock runs to where you stopped, then you press play.
moment('#m-resume', (tl, st) => {
  const c = mkCursor(st, 'You', '#ffb547'), r = mkRipple(st), btn = $('#m2b'), clock = { s: 0 };
  tl.fromTo('.m2-in > *', { y: 50, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.15, duration: 0.8 }, 0)
    .to(clock, { s: 298, duration: 5, ease: 'power1.inOut', onUpdate: () => { const s = Math.round(clock.s); $('#m2c').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; } }, 0.8)
    .fromTo('#m2f', { width: '0%' }, { width: '33.6%', duration: 5, ease: 'power1.inOut' }, 0.8).fromTo('#m2k', { left: '0%' }, { left: '33.6%', duration: 5, ease: 'power1.inOut' }, 0.8)
    .set(c, { x: () => st.offsetWidth * 0.15, y: () => st.offsetHeight * 1.05 }, 0).to(c, { opacity: 1, duration: 0.2 }, 5.6);
  goTo(tl, c, st, btn, 5.8, 1.1); tl.to(btn, { scale: 1.06, duration: 0.3 }, 6.7); tap(tl, c, r, st, btn, 7.2);
  tl.to(btn, { scale: 0.94, duration: 0.12 }, 7.2).to(btn, { scale: 1, duration: 0.3 }, 7.32)
    .to('.m2-in', { scale: 1.6, opacity: 0, duration: 1.4, ease: 'power3.in' }, 8.2).to(c, { opacity: 0, duration: 0.3 }, 8.2)
    .to('.m2-bg', { filter: 'blur(0px) brightness(1) saturate(1)', scale: 1, duration: 1.4, ease: 'power3.in' }, 8.2);
});

// 03 Player: the intro rolls, you skip it.
moment('#m-skip', (tl, st) => {
  const c = mkCursor(st, 'You', '#ffb547'), r = mkRipple(st), skip = $('#m3k'), sp = { p: 0 };
  tl.fromTo('#m3s', { scale: 0.7, borderRadius: 30 }, { scale: 1, borderRadius: 0, duration: 1.2, ease: 'expo.out' }, 0)
    .to('.m3cap', { opacity: 1, duration: 0.6 }, 0.6)
    .fromTo(skip, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.5, ease: 'back.out(2)' }, 1.8)
    .to(sp, { p: 100, duration: 4, ease: 'none', onUpdate: () => skip.style.setProperty('--sp', sp.p + '%') }, 1.8)
    .set(c, { x: () => st.offsetWidth * 0.5, y: () => st.offsetHeight * 1.05 }, 0).to(c, { opacity: 1, duration: 0.2 }, 3);
  goTo(tl, c, st, skip, 3.2, 1.4); tap(tl, c, r, st, skip, 5);
  tl.to(skip, { opacity: 0, scale: 0.9, duration: 0.3 }, 5.1).to('#m3d', { width: '9%', duration: 0.6, ease: 'expo.out' }, 5.1).to('#m3n', { left: '9%', duration: 0.6, ease: 'expo.out' }, 5.1)
    .to(c, { opacity: 0, duration: 0.4 }, 6.5).to('.m3cap', { opacity: 0, duration: 0.5 }, 8.6);
  when(tl, 5.1, () => { $('#m3a').style.opacity = 0; $('#m3b').style.opacity = 1; $('#m3b').play().catch(() => {}); $('#m3t').textContent = '1:20 / 14:48'; },
    () => { $('#m3a').style.opacity = 1; $('#m3b').style.opacity = 0; $('#m3t').textContent = '0:12 / 14:48'; });
}, 10);
$('#m3b').dataset.hold = '1';

// 04 Search: type three letters, two servers answer.
moment('#m-search', (tl, st) => {
  const c = mkCursor(st, 'You', '#ffb547'), r = mkRipple(st), field = $('.m4-field', st), res = $$('.rs', st), word = 'the';
  tl.fromTo(field, { y: 60, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' }, 0)
    .set(c, { x: () => st.offsetWidth * 0.8, y: () => st.offsetHeight * 1.05 }, 0).to(c, { opacity: 1, duration: 0.2 }, 0.6);
  goTo(tl, c, st, field, 0.8, 1, 0.3, 0.5); tap(tl, c, r, st, field, 1.8);
  tl.to(field, { boxShadow: '0 30px 80px -20px #000, 0 0 0 6px rgba(255,181,71,.35)', duration: 0.3 }, 1.8);
  for (let k = 0; k <= word.length; k++) when(tl, 2.2 + k * 0.45, () => { $('#m4i').textContent = word.slice(0, k); }, () => { $('#m4i').textContent = word.slice(0, Math.max(0, k - 1)); });
  res.forEach((el, i) => tl.fromTo(el, { opacity: 0, x: el.dataset.s === 'you' ? -260 : 260, y: 80, rotate: el.dataset.s === 'you' ? -12 : 12 }, { opacity: 1, x: 0, y: 0, rotate: 0, duration: 0.9, ease: 'expo.out' }, 3.8 + i * 0.22));
  tl.to(c, { x: () => rel(st, res[3]).x, y: () => rel(st, res[3]).y, duration: 1, ease: 'power3.inOut' }, 6.6).to(res[3], { y: -16, scale: 1.06, duration: 0.4 }, 7.3)
    .to(c, { opacity: 0, duration: 0.3 }, 9.2);
});

// 05 Library: one filter, everything you've seen falls away.
moment('#m-library', (tl, st) => {
  const c = mkCursor(st, 'You', '#ffb547'), r = mkRipple(st), chip = $('#c-new'), seen = $$('.pc.w', st), grid = $('#m5g');
  tl.fromTo(grid, { yPercent: -40, opacity: 0 }, { yPercent: -50, opacity: 1, duration: 1.4, ease: 'expo.out' }, 0).to(grid, { yPercent: -56, duration: 8.6, ease: 'none' }, 1.4)
    .fromTo('.m5-head > *', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.7 }, 0.2)
    .set(c, { x: () => st.offsetWidth * 0.6, y: () => st.offsetHeight * 1.05 }, 0).to(c, { opacity: 1, duration: 0.2 }, 1.2);
  goTo(tl, c, st, chip, 1.4, 1.1); tap(tl, c, r, st, chip, 2.8);
  when(tl, 2.8, () => { $('#c-all').classList.remove('on'); chip.classList.add('on'); }, () => { chip.classList.remove('on'); $('#c-all').classList.add('on'); });
  seen.forEach((el, i) => tl.to(el, { y: 900 + (i % 3) * 200, z: -200, rotation: (i % 2 ? 1 : -1) * (25 + (i * 7) % 30), opacity: 0, duration: 1.6, ease: 'power2.in' }, 3 + (i % 6) * 0.12));
  tl.to(c, { opacity: 0, duration: 0.3 }, 6);
});

// 06 Servers: Alex drags their server in, both libraries land together.
moment('#m-friends', (tl, st) => {
  const you = mkCursor(st, 'You', '#ffb547'), alex = mkCursor(st, 'Alex', '#a88bff'), sam = mkCursor(st, 'Sam', '#7ef0c0'), card = $('#sv-alex'), mine = $('#sv-you'), merged = $$('.mc', st);
  tl.fromTo('.m6cap > *', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.7 }, 0)
    .fromTo(mine, { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, 0.2)
    .set(you, { x: () => rel(st, mine, 0.7, 0.2).x, y: () => rel(st, mine, 0.7, 0.2).y + 300 }, 0).to(you, { opacity: 1, y: '-=300', duration: 1 }, 0.6)
    .fromTo(card, { x: () => innerWidth * 0.6, rotate: 8 }, { x: 0, rotate: 0, duration: 2.4, ease: 'power3.out' }, 1.4)
    .set(alex, { x: () => rel(st, card, 0.2, 0.15).x + innerWidth * 0.6, y: () => rel(st, card, 0.2, 0.15).y }, 0)
    .to(alex, { opacity: 1, duration: 0.2 }, 1.3).to(alex, { x: () => rel(st, card, 0.2, 0.15).x, duration: 2.4, ease: 'power3.out' }, 1.4)
    .set(sam, { x: () => st.offsetWidth * 0.5, y: () => st.offsetHeight * 1.05 }, 0).to(sam, { opacity: 1, duration: 0.2 }, 3.8).to(sam, { y: () => st.offsetHeight * 0.62, duration: 1.2, ease: 'power3.out' }, 3.8)
    .to('#m6r', { opacity: 1, duration: 0.4 }, 4.6)
    .to([mine, card], { scale: 0.86, y: -20, opacity: 0.45, duration: 1.2 }, 4.6);
  merged.forEach((el, i) => tl.fromTo(el, { opacity: 0, x: () => (el.dataset.s === 'you' ? -1 : 1) * innerWidth * 0.3, y: -innerHeight * 0.35, scale: 0.5, rotate: (el.dataset.s === 'you' ? -1 : 1) * 20 },
    { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, duration: 1, ease: 'expo.out' }, 4.9 + i * 0.18));
  tl.to([you, alex, sam], { x: (i) => `+=${[60, -80, 30][i]}`, y: (i) => `+=${[40, 70, -50][i]}`, duration: 1.5, ease: 'sine.inOut' }, 6.8).to([you, alex, sam], { opacity: 0, duration: 0.4 }, 9.3);
});

// ---------- Chapters ----------
const fan = $$('#fan img');
gsap.fromTo(fan, { x: 0, rotation: (i) => (i - 3) * 2, y: 40 }, { x: (i) => (i - 3) * innerWidth * (innerWidth < 900 ? 0.09 : 0.042), rotation: (i) => (i - 3) * 9, y: (i) => Math.abs(i - 3) * 22, ease: 'none',
  scrollTrigger: { trigger: '#watch', start: 'top 80%', end: 'center center', scrub: 1, invalidateOnRefresh: true } });
gsap.fromTo('#spread', { rotateX: 58, rotateZ: -14, scale: 0.8 }, { rotateX: 14, rotateZ: -3, scale: 1, ease: 'none', scrollTrigger: { trigger: '#read', start: 'top 85%', end: 'center center', scrub: 1 } });
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

// ---------- Download sunset ----------
ScrollTrigger.create({ trigger: '#get', start: 'top 85%', end: 'top 10%', scrub: true,
  onUpdate: (s) => { canvas.style.opacity = s.progress; getP = Math.max(s.progress, 0.001); },
  onLeaveBack: () => { canvas.style.opacity = 0; getP = 0; } });

// ---------- Direct downloads from the newest release ----------
fetch('https://api.github.com/repos/glitchthekillah/Zenith/releases/latest').then((r) => r.ok ? r.json() : null).then((rel) => {
  if (!rel) return;
  $$('[data-asset]').forEach((a) => { const f = rel.assets.find((x) => x.name.endsWith(a.dataset.asset)); if (f) a.href = f.browser_download_url; });
  const v = rel.tag_name.replace(/^v/, ''); $('#dl-ver').textContent = `Version ${v}`; $$('.vv').forEach((e) => { e.textContent = v; });
}).catch(() => {});
addEventListener('load', () => ScrollTrigger.refresh());
