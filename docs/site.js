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
tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
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
  void main(){vec3 c=texture2D(uTex,vU).rgb;float back=smoothstep(.3,-.6,vF);c*=mix(1.,.28,back);
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
const S = { camZ: wide ? 9.4 : 11, camY: 0.9, tilt: 0.42, roll: -0.12, spin: 0, spinV: 0.05, x: wide ? 1.9 : 0, y: wide ? -0.15 : 1.5, spread: 0, scale: 1 };
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


// ---------- Loader ----------
let parts = 0; const need = 2, ldn = $('#ldn'), ldb = $('#ldb'); let shown = 0;
function loaded() { parts++; }
addEventListener('load', () => loaded(1));
const ldTick = () => {
  const target = Math.min(100, (parts / need) * 100);
  shown += (target - shown) * 0.1 + 0.35; shown = Math.min(shown, target);
  ldn.textContent = String(Math.floor(shown)).padStart(2, '0'); ldb.style.setProperty('--p', shown / 100);
  if (shown >= 99.5) { ldn.textContent = '100'; setTimeout(start, 300); } else requestAnimationFrame(ldTick);
};
ldTick(); setTimeout(() => { parts = need; }, 6000);
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

const app = $('#app'), cam = $('#cam'), focus = $('#focus'), stepEls = $$('.step'), dotEls = $$('#dots i');
const KEYS = ['home', 'show', 'player', 'search', 'library', 'servers'];
const REG = { home: [0, 0.72, 0.62, 1], show: [0, 0.08, 0.55, 0.55], player: [0.2, 0.35, 1, 1], search: [0.6, 0, 1, 0.45], library: [0, 0.15, 0.75, 0.65], servers: [0.08, 0.35, 0.6, 0.95] };
const FOC = { home: [0.01, 0.76, 0.6, 0.995], show: [0.045, 0.43, 0.2, 0.5], player: [0.2, 0.9, 1, 0.99], search: [0.63, 0.04, 0.93, 0.4], library: [0.01, 0.2, 0.74, 0.62], servers: [0.12, 0.42, 0.48, 0.92] };
const zoom = (k, axis) => () => {
  const W = app.offsetWidth, H = app.offsetHeight, [x0, y0, x1, y1] = REG[k];
  const sc = Math.min(1 / (x1 - x0), 1 / (y1 - y0), 2.1);
  if (axis === 's') return sc;
  const v = axis === 'x' ? W * 0.5 - sc * ((x0 + x1) / 2) * W : H * 0.5 - sc * ((y0 + y1) / 2) * H;
  return Math.min(0, Math.max((axis === 'x' ? W : H) * (1 - sc), v));
};
const T0 = 7.2, STEP = 2.4;
const story = gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: '#story', start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 1, invalidateOnRefresh: true,
  onUpdate: (self) => { const tt = self.progress * story.duration(); const i = Math.max(-1, Math.min(5, Math.floor((tt - T0) / STEP))); dotEls.forEach((d, k) => d.classList.toggle('on', k <= i)); } } });
gsap.set(cam, { x: 0, y: 0, scale: 1 });
chips.forEach((c, i) => story.to(c, { o: 1, duration: 0.6 }, 0.1 + i * 0.25));
story.to('#pa', { opacity: 0, scale: 0.94, duration: 0.5, ease: 'power2.in' }, 3.6)
  .to('#pb', { opacity: 1, duration: 0.5 }, 4.0)
  .to(canvas, { opacity: 1, duration: 0.6, ease: 'none' }, 4.0)
  .to(S, { scale: 1.25, camZ: 9, spinV: 0.4, duration: 1.4, ease: 'power2.inOut' }, 4.0);
chips.forEach((c, i) => story.to(c, { k: 1, duration: 1.0, ease: 'power3.in' }, 4.3 + i * 0.05));
story.to(S, { scale: 1.6, duration: 0.4, ease: 'power2.in' }, 5.4)
  .to('#pb', { opacity: 0, y: -30, duration: 0.4 }, 5.8)
  .fromTo(app, { scale: 0, rotate: -8 }, { scale: 1, rotate: 0, duration: 1.3, ease: 'expo.out' }, 5.9)
  .to(S, { scale: 0.9, spinV: 0.05, y: 0.4, duration: 1.2 }, 5.9)
  .to(canvas, { opacity: 0.35, duration: 1, ease: 'none' }, 6.2)
  .to('#dots', { opacity: 1, duration: 0.3 }, T0 - 0.3);
if (innerWidth > 900) story.to(app, { left: '62%', duration: 0.8, ease: 'power2.inOut' }, T0 - 0.5);
KEYS.forEach((k, j) => {
  const t0 = T0 + j * STEP, [fx0, fy0, fx1, fy1] = FOC[k];
  if (j) story.to(`.ly[data-k=${k}]`, { opacity: 1, duration: 0.35, ease: 'none' }, t0).set(`.ly:not([data-k=${k}])`, { opacity: 0 }, t0 + 0.36);
  story.set(focus, { left: fx0 * 100 + '%', top: fy0 * 100 + '%', width: (fx1 - fx0) * 100 + '%', height: (fy1 - fy0) * 100 + '%', opacity: 0 }, t0 + 0.01)
    .to(cam, { x: zoom(k, 'x'), y: zoom(k, 'y'), scale: zoom(k, 's'), duration: 1.0, ease: 'power2.inOut' }, t0 + 0.15)
    .to(focus, { opacity: 1, duration: 0.3 }, t0 + 1.0)
    .to(stepEls[j], { opacity: 1, duration: 0.35 }, t0 + 0.2);
  if (k === 'player') story.fromTo('.skipx', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3 }, t0 + 0.9).to('.skipx', { opacity: 0, duration: 0.2 }, t0 + STEP - 0.15);
  if (j < KEYS.length - 1) story.to(focus, { opacity: 0, duration: 0.2 }, t0 + STEP - 0.3).to(stepEls[j], { opacity: 0, duration: 0.3, ease: 'power2.in' }, t0 + STEP - 0.3);
});
story.to({}, { duration: 0.9 }, T0 + KEYS.length * STEP);

// ---------- Chapters ----------
gsap.to(canvas, { opacity: 0, ease: 'none', scrollTrigger: { trigger: '#watch', start: 'top bottom', end: 'top 30%', scrub: true } });
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
