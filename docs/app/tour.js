// Shows one captured screen at a time; the page around it picks which.
(() => {
  if (new URLSearchParams(location.search).has('calm')) document.body.classList.add('calm');
  const scenes = [...document.querySelectorAll('.scene')];
  const show = (name) => scenes.forEach((s) => s.classList.toggle('on', s.dataset.s === name));
  show(new URLSearchParams(location.search).get('s') || 'home');
  addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.scene) show(e.data.scene); });
})();
