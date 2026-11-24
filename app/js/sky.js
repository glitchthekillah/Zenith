// The moving sky behind the app: the same liquid field as the zenith panel and request site,
// a different patch on every launch, drifting toward the mouse. Falls back to the CSS glow if WebGL is off.
(() => {
  const cv = document.getElementById('sky2'); if (!cv) return;
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { cv.remove(); return; }
  document.body.classList.add('liquid');
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const HEAD = `precision highp float;
uniform vec2 r;uniform float t;uniform vec2 m;uniform vec3 cI;uniform vec3 cB;uniform vec3 cP;uniform vec3 cG;
uniform float lm;uniform vec2 o;uniform float a;uniform float k;uniform vec2 L;uniform vec2 V;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 R=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*n(p);p=R*p*2.02;a*=.5;}return v;}
`;
  // Each style is its own picture of the same four colours. Liquid is the original.
  const MAINS = {
    liquid: `void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
  p=mat2(cos(a),-sin(a),sin(a),cos(a))*p*k+o;                     // a different patch of the field every load
  float T=t*.035;
  vec2 q=vec2(fbm(p*1.4+vec2(0.,T)),fbm(p*1.4+vec2(5.2,-T)));
  vec2 w=vec2(fbm(p*1.6+2.*q+vec2(1.7,9.2)+T*.6),fbm(p*1.6+2.*q+vec2(8.3,2.8)-T*.5));
  float f=fbm(p*1.2+2.4*w);
  vec3 col=cI;
  float b=smoothstep(.35,.95,f);
  vec3 tint=mix(cB,cP,smoothstep(.2,.8,fbm(p*.7+w+vec2(T*.4,0.))));   // purple drifting into pink
  col=mix(col,tint*.85,b*.85);
  float ribbon=smoothstep(.014,.0,abs(f-.62))*smoothstep(.3,.9,length(w));
  col=mix(col,cG,ribbon*.75);
  col+=cG*.10*smoothstep(.75,1.,f)*(1.-lm);
  vec2 lp=L+vec2(m.x*.25,-m.y*.2);
  col+=tint*(.35-.27*lm)*exp(-3.2*length((gl_FragCoord.xy-.5*r)/r.y-lp));
  float v=smoothstep(1.25,.25,length(uv-V));
  col=mix(cI,col,v);
  gl_FragColor=vec4(col,1.);
}`,
    // Northern lights: folded curtains with a bright lower hem and fine rays rising out of it,
    // over a faint starry sky
    aurora: `void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;float T=t*.04;
  vec3 col=cI;
  vec2 g=gl_FragCoord.xy/(r.y*.011);vec2 id=floor(g);float s=h(id);
  col+=vec3(step(.986,s)*smoothstep(.16,.0,length(fract(g)-.5))*(.35+.25*sin(t+s*40.))*(1.-lm));
  col+=mix(cB,cP,.4)*.09*smoothstep(.7,-.5,p.y);
  for(int i=0;i<4;i++){float fi=float(i);
    float xw=p.x+.22*sin(p.x*1.6+T*1.2+fi*1.9+o.x)+.07*sin(p.x*4.3-T*1.8+fi*2.7);
    float y=-.2+fi*.1+.13*sin(xw*1.15+T*.8+fi*2.4+o.y)+.09*(fbm(vec2(xw*1.2+T*.4,fi*3.7+o.x))-.5);
    float d=p.y-y;
    float hem=exp(-max(-d,0.)*55.);
    float rise=exp(-max(d,0.)*(1.5+fi*.45));
    float ray=fbm(vec2(xw*10.+fi*11.,T*.6+fi));ray=.2+1.9*ray*ray;
    vec3 c=mix(cG,mix(cB,cP,.5+.5*sin(fi*1.3+T)),smoothstep(-.01,.32,d));
    col+=c*hem*rise*ray*(.55-.09*fi);
  }
  col+=cG*.05*smoothstep(-.1,-.6,p.y);
  float v=smoothstep(1.35,.2,length(uv-V));col=mix(cI,col,v);
  gl_FragColor=vec4(col,1.);
}`,
    // Deep space: slow nebula clouds with twinkling stars that drift a little with the mouse
    nebula: `void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
  p=mat2(cos(a),-sin(a),sin(a),cos(a))*p*k;float T=t*.018;vec2 q=p*1.15+o;
  float f=fbm(q+1.6*vec2(fbm(q*1.8+T),fbm(q*1.8-T+4.)));
  vec3 col=cI;
  col=mix(col,cB*.85,smoothstep(.38,.9,f)*.9);
  col=mix(col,cP*.9,smoothstep(.55,.95,fbm(q*1.6+3.+T*.6))*.65);
  col+=cG*.22*pow(smoothstep(.62,1.,f),3.);
  for(int l=0;l<2;l++){float fl=float(l);
    vec2 g=(gl_FragCoord.xy+m*r.y*(.02+fl*.03))/(r.y*(.016-fl*.006))+fl*17.;vec2 id=floor(g),fr=fract(g)-.5;
    float s=h(id);vec2 off=(vec2(h(id+3.1),h(id+7.7))-.5)*.6;
    float star=step(.955+fl*.02,s)*smoothstep(.13,.0,length(fr-off));
    star*=.55+.45*sin(t*(.8+s*2.5)+s*60.);
    col+=mix(vec3(1.),cG,.25)*star*(1.-lm*.8)*(.9-fl*.3);
  }
  float v=smoothstep(1.3,.25,length(uv-V));col=mix(cI,col,v);
  gl_FragColor=vec4(col,1.);
}`,
    // Silk: thin ribbons of light that ripple across the screen, each with a soft glow
    silk: `void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
  float T=t*.07;vec3 col=cI;
  for(int i=0;i<6;i++){float fi=float(i);
    float y=-.5+fi*.19+.13*sin(p.x*(1.1+fi*.22)+T*(1.+fi*.25)+fi*1.7+o.x)+.05*sin(p.x*2.9-T*1.4+fi+o.y)+.04*(m.y)*(fi-2.5);
    float d=p.y-y;
    vec3 c=mix(cB,cP,fi/5.);
    col+=c*exp(-abs(d)*7.)*.085+mix(c,cG,.55)*exp(-abs(d)*90.)*.42;
  }
  col+=cG*.06*exp(-3.*length(p-L));
  float v=smoothstep(1.3,.25,length(uv-V));col=mix(cI,col,v);
  gl_FragColor=vec4(col,1.);
}`,
    // Embers: sparks drifting up out of a warm glow at the bottom
    embers: `void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;float T=t;
  vec3 col=cI;
  col=mix(col,cP*.6,smoothstep(.2,-.9,p.y)*(.45+.55*fbm(p*2.+vec2(o.x,-T*.05))));
  col+=cG*.16*exp(-2.2*length(p-vec2(m.x*.3,-.75)));
  for(int l=0;l<3;l++){float fl=float(l);float sc=9.+fl*7.;
    vec2 q=p*sc+o;q.y-=T*(.5+fl*.22);q.x+=sin(q.y*.3+fl*4.+T*.25)*.7;
    vec2 id=floor(q);vec2 fr=fract(q)-.5;float s=h(id+fl*31.);
    vec2 off=(vec2(h(id+1.3),h(id+5.9))-.5)*.7;
    float e=step(.88,s)*smoothstep(.17,.0,length(fr-off));
    float fl2=.55+.45*sin(T*(2.+s*5.)+s*50.);
    col+=mix(cG,cP,fl*.35)*e*fl2*smoothstep(.95,-.5,p.y)*(1.25-fl*.3);
  }
  float v=smoothstep(1.3,.25,length(uv-V));col=mix(cI,col,v);
  gl_FragColor=vec4(col,1.);
}`,
    // Contours: a slowly shifting landscape drawn as glowing elevation lines
    contours: `void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
  p=mat2(cos(a),-sin(a),sin(a),cos(a))*p*k;float T=t*.018;
  float e=n(p*.9+o+vec2(T,-T*.7))*.62+n(p*1.9-o*.5+vec2(-T*.6,T*.4))*.28+n(p*3.6+o+T*.3)*.1;
  float lv=e*30.;float f=fract(lv);float line=smoothstep(.09,.0,min(f,1.-f));
  float major=1.-step(.2,fract(floor(lv+.5)/4.));
  vec3 c=mix(cB,cP,smoothstep(.3,.75,e));
  vec3 col=cI+c*.12*smoothstep(.2,.85,e);
  col+=mix(c,cG,smoothstep(.55,.8,e))*line*(.28+.3*major);
  col+=cG*.1*exp(-3.*length(p*.7-vec2(m.x,-m.y)*.5-L));
  float v=smoothstep(1.3,.25,length(uv-V));col=mix(cI,col,v);
  gl_FragColor=vec4(col,1.);
}`,
    // Rays: shafts of light falling through haze from a corner, slowly turning
    rays: `void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;float T=t*.05;
  vec2 src=vec2(-.75+m.x*.15,.7+m.y*.05);vec2 d=p-src;float an=atan(d.y,d.x);float di=length(d);
  float ry=fbm(vec2(an*8.+o.x,T))*.7+fbm(vec2(an*21.-T*.6,o.y))*.5;ry=pow(ry,2.4)*1.6;
  vec3 c=mix(cG,mix(cB,cP,.5+.5*sin(an*3.+T)),smoothstep(.2,1.5,di));
  vec3 col=cI+c*ry*exp(-di*.85)*.85;
  col+=cG*.22*exp(-di*5.);
  col=mix(col,col+cP*.06,fbm(p*3.+vec2(T*.4,0.)));
  float v=smoothstep(1.35,.25,length(uv-V));col=mix(cI,col,v);
  gl_FragColor=vec4(col,1.);
}`,
  };

  const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
  const progs = {};
  const build = (k) => { if (progs[k]) return progs[k]; const x = gl.createProgram(); gl.attachShader(x, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(x, sh(gl.FRAGMENT_SHADER, HEAD + MAINS[k])); gl.linkProgram(x); if (!gl.getProgramParameter(x, gl.LINK_STATUS)) return null; return (progs[k] = x); };
  let style = 'liquid'; try { const b = JSON.parse(localStorage.getItem('zenith') || '{}').look?.bg; if (MAINS[b]) style = b; } catch {}
  let pr = build(style) || ((style = 'liquid'), build('liquid'));
  if (!pr) { cv.remove(); document.body.classList.remove('liquid'); return; }
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (x) => gl.getUniformLocation(pr, x);
  // ink, purple, pink and an amber thread; the same colours as the rest of the panel
  // The user can pick their own colours in Settings > Look (kept on this device only)
  const hex = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const DEF = ['#07060d', '#4d2bbf', '#9e296b', '#ffa847'];
  // Light mode is its own palette, not a white wash: a pale base tinted by the first cloud,
  // pastel clouds, and a deeper version of the light thread so it still reads on the pale sky
  const mixc = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const W = [1, 1, 1], K = [0, 0, 0];
  const lighten = ([i, b, p, g]) => [mixc(W, b, .13), mixc(W, b, .62), mixc(W, p, .6), mixc(K, g, .7)];
  // The default palette gets its own light look: sky blue with a gold thread
  const LIGHT_DEF = ['#c9e2f6', '#1a99e8', '#4aaeee', '#e81abb'].map(hex);
  let isDef = true;
  const isLight = () => document.documentElement.dataset.theme === 'light';
  let base = null; try { base = JSON.parse(localStorage.getItem('zenith') || '{}').look?.colors; } catch {}
  isDef = !(Array.isArray(base) && base.length === 4) || base.join() === DEF.join();
  base = (Array.isArray(base) && base.length === 4 ? base : DEF).map(hex);
  const target = () => [...(isLight() ? (isDef ? LIGHT_DEF : lighten(base)) : base), [isLight() ? 1 : 0]];
  let cur = target(), from = cur, to = cur, t0 = 0;
  const KEYS = ['cI', 'cB', 'cP', 'cG'];
  const upload = (v) => { KEYS.forEach((k, i) => gl.uniform3f(U(k), ...v[i])); gl.uniform1f(U('lm'), v[4][0]); };
  upload(cur);
  // Colour changes glide: about 1.4 seconds, soft at both ends
  const GLIDE = 1400, ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let gliding = false;
  const glideTo = (instant) => {
    to = target(); from = cur; t0 = performance.now();
    if (instant || reduce) { cur = to; upload(cur); frame(); return; }
    if (gliding) return; gliding = true;
    const step = (now) => {
      const e = ease(Math.min(1, (now - t0) / GLIDE));
      cur = from.map((c, i) => mixc(c, to[i], e)); upload(cur); frame();
      if (now - t0 < GLIDE) requestAnimationFrame(step); else gliding = false;
    };
    requestAnimationFrame(step);
  };
  // Every load starts somewhere new: offset, turn, zoom, where the light sits and where the bright middle is
  const R = (lo, hi) => lo + Math.random() * (hi - lo);
  const seed = { o: [R(-60, 60), R(-60, 60)], a: R(0, Math.PI * 2), k: R(.8, 1.25), L: [R(-.6, .6), R(-.35, .35)], V: [R(.3, .7), R(.35, .7)] };
  const seedUp = () => { gl.uniform2f(U('o'), ...seed.o); gl.uniform1f(U('a'), seed.a); gl.uniform1f(U('k'), seed.k); gl.uniform2f(U('L'), ...seed.L); gl.uniform2f(U('V'), ...seed.V); };
  seedUp();
  let ur = U('r'), ut = U('t'), um = U('m');
  // Switch style (Settings > Appearance) without reloading: same colours, same patch of sky
  const useStyle = (k) => {
    if (!MAINS[k] || k === style) return; const x = build(k); if (!x) return;
    style = k; pr = x; gl.useProgram(pr);
    const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    seedUp(); upload(cur); ur = U('r'); ut = U('t'); um = U('m'); frame(); kick();
  };
  // Match the request site's fixed resolution; redraw cadence is not a GPU timing measurement.
  const want = () => { const d = Math.min(devicePixelRatio || 1, 1.5) * .5; return [Math.round(innerWidth * d), Math.round(innerHeight * d)]; };
  const size = () => { const [w, h] = want(); cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); };
  // On Linux the window can open before it has its real size, which left the sky drawn at 0x0
  // until something else (like leaving the player) resized it. Check every frame and catch up.
  const fixSize = () => { const [w, h] = want(); if (w && h && (cv.width !== w || cv.height !== h)) size(); };
  size(); addEventListener('resize', () => { size(); kick(); });
  addEventListener('load', () => { fixSize(); kick(); }); addEventListener('focus', () => { fixSize(); kick(); });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // How much the sky leans toward the mouse (1 = the original, stronger amount)
  const PAR = 0.35;
  let mx = 0, my = 0, sm = [0, 0], run = false, last = -Infinity;
  // The sky's own clock. It eases down to a crawl when Zenith is in the background
  // (where the system only allows a few frames a second) and back up when you return.
  const isFocused = () => (window.zenithDesktop?.focused ? window.zenithDesktop.focused() : document.hasFocus());
  let simT = R(0, 600), speed = isFocused() ? 1 : 0.04, tick = performance.now();
  const RAMP = 1.4; // seconds to ease most of the way
  const advance = (now) => {
    const dt = Math.min(0.25, Math.max(0, (now - tick) / 1000)); tick = now;
    const want = isFocused() ? 1 : 0.04;
    speed += (want - speed) * (1 - Math.exp(-dt * 3 / RAMP));
    simT += dt * speed;
    return simT;
  };
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  // Native scroll activity gives foreground content more rendering time.
  // Holds still while a video plays or the reader is open, so the GPU is free for them
  const still = () => reduce || document.body.classList.contains('calm') || document.body.classList.contains('playing') || document.body.classList.contains('mini') || !!document.body.dataset.bg;
  function draw(now) {
    run = false;
    if (document.hidden || document.documentElement.dataset.style) return;   // other style presets draw their own background
    // About 30 frames a second. In the background, fewer, but only once the sky has slowed
    // down enough that it doesn't look choppy.
    const gap = !isFocused() && speed < 0.15 ? 150 : document.body.classList.contains('scrolling') ? 50 : 33;
    if (now - last > gap) {
      last = now; fixSize();
      sm[0] += (mx - sm[0]) * .08; sm[1] += (my - sm[1]) * .08;
      gl.uniform2f(ur, cv.width, cv.height); gl.uniform1f(ut, advance(now)); gl.uniform2f(um, sm[0] * PAR, sm[1] * PAR);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (!still()) kick();
  }
  function kick() { if (!run) { run = true; requestAnimationFrame(draw); } }
  // One frame right now (used while colours glide, even when the sky is holding still)
  function frame() { gl.uniform2f(ur, cv.width, cv.height); gl.uniform1f(ut, simT); gl.uniform2f(um, sm[0] * PAR, sm[1] * PAR); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  let first = true;
  new MutationObserver(() => glideTo(false)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); window.zenithGpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch {}
  window.zenithSky = { snapshot() { frame(); const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); return c; }, style: useStyle, styles: Object.keys(MAINS), set(c) { const ok = Array.isArray(c) && c.length === 4; isDef = !ok || c.join() === DEF.join(); base = (ok ? c : DEF).map(hex); glideTo(first); first = false; kick(); } };
  // Live previews in Settings: one small offscreen renderer draws every style into its card
  let pg = null, pbuf = null, prun = false, plast = 0; const pp = {}, PW = 256, PH = 140;
  const pbuild = (k) => { if (k in pp) return pp[k]; const s = (ty, src) => { const x = pg.createShader(ty); pg.shaderSource(x, src); pg.compileShader(x); return x; }; const x = pg.createProgram(); pg.attachShader(x, s(pg.VERTEX_SHADER, vs)); pg.attachShader(x, s(pg.FRAGMENT_SHADER, HEAD + MAINS[k])); pg.linkProgram(x); return (pp[k] = pg.getProgramParameter(x, pg.LINK_STATUS) ? x : null); };
  const ptick = (now) => {
    const live = [...document.querySelectorAll('canvas[data-sky-preview]')];
    if (!live.length) { prun = false; return; }
    requestAnimationFrame(ptick);
    if (document.hidden || now - plast < 50) return; plast = now;
    for (const el of live) {
      const x = MAINS[el.dataset.skyPreview] && pbuild(el.dataset.skyPreview); if (!x) continue;
      pg.useProgram(x); const u = (n) => pg.getUniformLocation(x, n);
      const l = pg.getAttribLocation(x, 'p'); pg.bindBuffer(pg.ARRAY_BUFFER, pbuf); pg.enableVertexAttribArray(l); pg.vertexAttribPointer(l, 2, pg.FLOAT, false, 0, 0);
      pg.uniform2f(u('r'), PW, PH); pg.uniform1f(u('t'), simT + now / 1000 * 1.5); pg.uniform2f(u('m'), 0, 0);
      KEYS.forEach((k, i) => pg.uniform3f(u(k), ...cur[i])); pg.uniform1f(u('lm'), cur[4][0]);
      pg.uniform2f(u('o'), ...seed.o); pg.uniform1f(u('a'), seed.a); pg.uniform1f(u('k'), seed.k); pg.uniform2f(u('L'), ...seed.L); pg.uniform2f(u('V'), ...seed.V);
      pg.drawArrays(pg.TRIANGLES, 0, 3);
      if (el.width !== PW) { el.width = PW; el.height = PH; }
      el.getContext('2d').drawImage(pg.canvas, 0, 0);
    }
  };
  setInterval(() => {
    if (prun || !document.querySelector('canvas[data-sky-preview]')) return;
    if (!pg) { const c = document.createElement('canvas'); c.width = PW; c.height = PH; pg = c.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true }); if (!pg) return; pbuf = pg.createBuffer(); pg.bindBuffer(pg.ARRAY_BUFFER, pbuf); pg.bufferData(pg.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), pg.STATIC_DRAW); }
    prun = true; requestAnimationFrame(ptick);
  }, 500);
  document.addEventListener('visibilitychange', () => { tick = performance.now(); kick(); });
  addEventListener('focus', kick); addEventListener('blur', kick);
  addEventListener('zenith-focus', kick); addEventListener('zenith-blur', kick);
  new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-bg'] });
  kick();
})();
