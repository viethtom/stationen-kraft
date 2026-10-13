'use strict';
/* =========================================================
   Grundfunktionen
   ========================================================= */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function fmt(n, d = 1) { return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); }
function fmtAuto(n) { return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : fmt(n, Math.abs(n * 10 - Math.round(n * 10)) < 1e-9 ? 1 : 2); }
function parseNum(s) {
  s = String(s).trim().replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  return s === '' || s === '.' || s === '-' ? NaN : parseFloat(s);
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function setRangeFill(input) {
  const p = (input.value - input.min) / (input.max - input.min) * 100;
  input.style.setProperty('--p', p + '%');
}

/* =========================================================
   Speicherstand (bleibt auch nach Neuladen erhalten)
   ========================================================= */
const STORE_KEY = 'kraft-hebel-3d-v1';
const S = (() => {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { d = null; }
  const base = { m1: [], m2: [], l1: [], l2: [], done: {}, tab: 'tab1', alltag: null };
  return Object.assign(base, d || {});
})();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* privat-Modus */ } }

/* =========================================================
   3D-Engine: ein WebGL-Renderer, der zwischen den Stationen wandert
   ========================================================= */
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Engine = {
  ok: false, renderer: null, stage: null, env: null, clock: null, pointers: new Map(), pinch: 0, last: { w: 0, h: 0 },
  init() {
    if (typeof THREE === 'undefined') return;
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 0.92;
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer = r;
      this.ok = true;
    } catch (e) { this.ok = false; return; }
    this.clock = new THREE.Clock();
    this.env = this.makeEnv();
    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => c.addEventListener(t, (e) => this.onUp(e)));
    c.addEventListener('wheel', (e) => { if (!this.stage) return; e.preventDefault(); this.stage.zoom(1 + e.deltaY * 0.0012); }, { passive: false });
    c.addEventListener('dblclick', () => this.stage && this.stage.resetView());
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    const loop = () => { requestAnimationFrame(loop); this.frame(); };
    requestAnimationFrame(loop);
  },
  makeEnv() {
    // kleine "Raum"-Umgebung für schöne Metallreflexe
    const pm = new THREE.PMREMGenerator(this.renderer);
    const sc = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: 0x7c8494, side: THREE.BackSide }));
    room.position.y = 4; sc.add(room);
    const panel = (w, h, x, y, z, ry, rx, s) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(s, s, s), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = ry || 0; m.rotation.x = rx || 0; sc.add(m);
    };
    panel(8, 8, 0, 9.9, 0, 0, Math.PI / 2, 5);
    panel(6, 4, -9.9, 4, 0, Math.PI / 2, 0, 2.5);
    panel(6, 4, 9.9, 3, 3, -Math.PI / 2, 0, 1.6);
    panel(10, 3, 0, 3, -9.9, 0, 0, 1.4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x3b3f47 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9; sc.add(floor);
    const tex = pm.fromScene(sc, 0.04).texture;
    pm.dispose();
    return tex;
  },
  attach(stage) {
    if (!this.ok) {
      if (stage && !stage.container.querySelector('.nogl')) stage.container.appendChild(el('div', 'nogl', '3D-Ansicht ist auf diesem Gerät nicht verfügbar (WebGL fehlt).<br>Die Messwerte und Aufgaben funktionieren trotzdem.'));
      return;
    }
    this.stage = stage;
    if (!stage) return;
    stage.container.insertBefore(this.renderer.domElement, stage.container.firstChild);
    this.last = { w: 0, h: 0 };
    this.pointers.clear();
  },
  frame() {
    const st = this.stage;
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (!st || document.hidden) return;
    const c = st.container;
    if (!c.offsetParent) return;
    const rect = c.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) { st.tick(dt, true); return; }
    const w = c.clientWidth, h = c.clientHeight;
    if (w !== this.last.w || h !== this.last.h) {
      this.renderer.setSize(w, h, true);
      st.camera.aspect = w / Math.max(h, 1);
      st.camera.updateProjectionMatrix();
      this.last = { w, h };
    }
    st.tick(dt, false);
    this.renderer.render(st.scene, st.camera);
  },
  onDown(e) {
    if (!this.stage) return;
    try { this.renderer.domElement.setPointerCapture(e.pointerId); } catch (err) {}
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.pinch = this.pinchDist();
    this.stage.interact();
  },
  onMove(e) {
    if (!this.stage || !this.pointers.has(e.pointerId)) return;
    const p = this.pointers.get(e.pointerId);
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 1) this.stage.rotate(dx, dy);
    else if (this.pointers.size === 2) {
      const d = this.pinchDist();
      if (this.pinch > 0 && d > 0) this.stage.zoom(this.pinch / d);
      this.pinch = d;
    }
  },
  onUp(e) { this.pointers.delete(e.pointerId); this.pinch = this.pointers.size === 2 ? this.pinchDist() : 0; },
  pinchDist() { const a = [...this.pointers.values()]; return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
};

class Stage {
  constructor(containerId, o) {
    this.container = $(containerId);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(o.bg || 0xe6ebf3);
    if (Engine.env) this.scene.environment = Engine.env;
    this.camera = new THREE.PerspectiveCamera(o.fov || 38, 1.4, 0.5, 4000);
    this.home = { theta: o.theta || 0.35, phi: o.phi || 1.25, radius: o.radius || 100, target: (o.target || V3()).clone() };
    this.view = { theta: this.home.theta, phi: this.home.phi, radius: this.home.radius * 1.35, target: this.home.target.clone() };
    this.limits = { minR: o.minR || this.home.radius * 0.35, maxR: o.maxR || this.home.radius * 2.2, minPhi: 0.2, maxPhi: o.maxPhi || 1.62 };
    this.tween = null;
    this.updaters = [];
    this.time = 0;
    this.setView(this.home, 1.4);
    // Licht
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8b95a7, 0.55);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    const sh = o.shadow || 80;
    sun.position.set(sh * 0.6, sh * 1.4, sh * 0.9).add(this.home.target);
    sun.target.position.copy(this.home.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera; sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.near = 1; sc.far = sh * 5;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0xdbeafe, 0.35);
    fill.position.set(-sh, sh * 0.5, -sh * 0.4);
    this.scene.add(fill);
    // Boden
    if (o.floor !== false) {
      const fs = o.floorSize || sh * 6;
      const floor = new THREE.Mesh(new THREE.CircleGeometry(fs, 64), new THREE.MeshStandardMaterial({ color: o.floorColor || 0xcfd6e2, roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = o.floorY || 0; floor.receiveShadow = true;
      this.scene.add(floor);
      this.floor = floor;
    }
    // Reset-Knöpfe
    document.querySelectorAll('[data-reset="' + o.id + '"]').forEach((b) => b.addEventListener('click', () => this.resetView()));
    this.hint = this.container.querySelector('.hint3d');
  }
  setView(v, dur = 0.8) {
    this.tween = { from: { theta: this.view.theta, phi: this.view.phi, radius: this.view.radius, target: this.view.target.clone() }, to: { theta: v.theta, phi: v.phi, radius: v.radius, target: v.target.clone() }, t: 0, dur };
  }
  resetView() { this.setView(this.home, 0.8); }
  setHome(v, apply = true) { this.home = { theta: v.theta, phi: v.phi, radius: v.radius, target: v.target.clone() }; this.limits.minR = v.radius * 0.35; this.limits.maxR = v.radius * 2.2; if (apply) this.setView(this.home, 0.9); }
  interact() { this.tween = null; if (this.hint) this.hint.style.opacity = '0'; }
  rotate(dx, dy) {
    this.view.theta -= dx * 0.008;
    this.view.phi = clamp(this.view.phi - dy * 0.006, this.limits.minPhi, this.limits.maxPhi);
  }
  zoom(f) { this.view.radius = clamp(this.view.radius * f, this.limits.minR, this.limits.maxR); }
  onUpdate(fn) { this.updaters.push(fn); }
  tick(dt, hidden) {
    this.time += dt;
    if (this.tween) {
      const tw = this.tween; tw.t += dt / tw.dur; const k = ease(Math.min(tw.t, 1));
      this.view.theta = lerp(tw.from.theta, tw.to.theta, k);
      this.view.phi = lerp(tw.from.phi, tw.to.phi, k);
      this.view.radius = lerp(tw.from.radius, tw.to.radius, k);
      this.view.target.lerpVectors(tw.from.target, tw.to.target, k);
      if (tw.t >= 1) this.tween = null;
    }
    for (const u of this.updaters) u(dt, this.time);
    if (hidden) return;
    const v = this.view, s = Math.sin(v.phi);
    this.camera.position.set(v.target.x + v.radius * s * Math.sin(v.theta), v.target.y + v.radius * Math.cos(v.phi), v.target.z + v.radius * s * Math.cos(v.theta));
    this.camera.lookAt(v.target);
  }
}

/* ---------- 3D-Bausteine ---------- */
function mat(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.05 }, o || {})); }
const MAT = {};
function initMaterials() {
  Object.assign(MAT, {
    steel: mat(0xc3cad4, { metalness: 0.9, roughness: 0.28 }),
    chrome: mat(0xe5e7eb, { metalness: 1.0, roughness: 0.15 }),
    dark: mat(0x374151, { metalness: 0.6, roughness: 0.4 }),
    black: mat(0x1f2937, { roughness: 0.6 }),
    alu: mat(0xd1d5db, { metalness: 0.75, roughness: 0.35 }),
    brass: mat(0xc8a24a, { metalness: 0.9, roughness: 0.3 }),
    weight: mat(0x52606d, { metalness: 0.7, roughness: 0.35 }),
    weightO: mat(0xf97316, { metalness: 0.35, roughness: 0.4 }),
    weightC: mat(0x06b6d4, { metalness: 0.35, roughness: 0.4 }),
    wood: mat(0xc08a52, { roughness: 0.75 }),
    woodD: mat(0x8b5a2b, { roughness: 0.8 }),
    red: mat(0xef4444, { roughness: 0.4 }),
    blue: mat(0x3b82f6, { roughness: 0.4 }),
    orange: mat(0xf97316, { roughness: 0.4 }),
    green: mat(0x16a34a, { roughness: 0.6 }),
    white: mat(0xf8fafc, { roughness: 0.5 }),
    plasticB: mat(0x2563eb, { roughness: 0.45 }),
    plasticR: mat(0xdc2626, { roughness: 0.45 }),
    plasticY: mat(0xfacc15, { roughness: 0.45 }),
    rubber: mat(0x111827, { roughness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdbeafe, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
    skin: mat(0xf2c09b, { roughness: 0.7 }),
    muscle: mat(0xd9485f, { roughness: 0.5 }),
    bone: mat(0xf1ead8, { roughness: 0.6 })
  });
}
function mesh(geo, m, cast = true, receive = false) { const x = new THREE.Mesh(geo, m); x.castShadow = cast; x.receiveShadow = receive; return x; }
function box(w, h, d, m) { return mesh(new THREE.BoxGeometry(w, h, d), m); }
function cyl(rt, rb, h, m, seg = 24) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); }
function sph(r, m, seg = 24) { return mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), m); }
/** Zylinder zwischen zwei Punkten */
function rod(a, b, r, m, seg = 12) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  const c = cyl(r, r, 1, m, seg); c.scale.y = Math.max(len, 1e-4);
  c.position.copy(a).addScaledVector(d, 0.5);
  c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  return c;
}
function setRod(c, a, b) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  c.scale.y = Math.max(len, 1e-4); c.position.copy(a).addScaledVector(d, 0.5);
  if (len > 1e-6) c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
}

/* Text-Etikett als Sprite. "_{L}" wird tiefgestellt. */
function parseRich(t) {
  const runs = []; const re = /_\{([^}]*)\}/g; let last = 0, m;
  while ((m = re.exec(t))) { if (m.index > last) runs.push({ t: t.slice(last, m.index) }); runs.push({ t: m[1], sub: true }); last = re.lastIndex; }
  if (last < t.length) runs.push({ t: t.slice(last) });
  return runs;
}
function makeLabel(text, o) {
  o = Object.assign({ color: '#0f172a', bg: 'rgba(255,255,255,0.93)', border: null, size: 3, weight: 700 }, o || {});
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, transparent: true }));
  sp.renderOrder = 20;
  sp.userData.o = o;
  sp.userData.set = (t, color, border) => {
    if (t === sp.userData.text && color === undefined && border === undefined) return;
    if (color) o.color = color; if (border !== undefined) o.border = border;
    sp.userData.text = t;
    const fs = 46, sfs = 32, pad = 18, H = 72;
    const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
    const runs = parseRich(t);
    let w = 0;
    runs.forEach((r) => { ctx.font = o.weight + ' ' + (r.sub ? sfs : fs) + 'px -apple-system, Helvetica, Arial, sans-serif'; r.w = ctx.measureText(r.t).width; w += r.w; });
    cv.width = Math.ceil(w + pad * 2); cv.height = H;
    if (o.bg) {
      ctx.fillStyle = o.bg; const rr = 18;
      ctx.beginPath(); ctx.moveTo(rr, 2); ctx.lineTo(cv.width - rr, 2); ctx.quadraticCurveTo(cv.width - 2, 2, cv.width - 2, rr); ctx.lineTo(cv.width - 2, H - rr); ctx.quadraticCurveTo(cv.width - 2, H - 2, cv.width - rr, H - 2); ctx.lineTo(rr, H - 2); ctx.quadraticCurveTo(2, H - 2, 2, H - rr); ctx.lineTo(2, rr); ctx.quadraticCurveTo(2, 2, rr, 2); ctx.closePath(); ctx.fill();
      if (o.border) { ctx.lineWidth = 4; ctx.strokeStyle = o.border; ctx.stroke(); }
    }
    let x = pad; ctx.fillStyle = o.color; ctx.textBaseline = 'alphabetic';
    runs.forEach((r) => { ctx.font = o.weight + ' ' + (r.sub ? sfs : fs) + 'px -apple-system, Helvetica, Arial, sans-serif'; ctx.fillText(r.t, x, r.sub ? 58 : 50); x += r.w; });
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    if (sp.material.map) sp.material.map.dispose();
    sp.material.map = tex; sp.material.needsUpdate = true;
    sp.scale.set(o.size * cv.width / H, o.size, 1);
  };
  sp.userData.set(text);
  return sp;
}

/* Kraftpfeil */
function makeArrow(color, r = 0.35) {
  const g = new THREE.Group();
  const m = mat(color, { roughness: 0.35, emissive: new THREE.Color(color).multiplyScalar(0.25) });
  const shaft = mesh(new THREE.CylinderGeometry(r, r, 1, 14).translate(0, 0.5, 0), m, false);
  const headL = r * 4.2;
  const head = mesh(new THREE.ConeGeometry(r * 2.6, headL, 18).translate(0, headL / 2, 0), m, false);
  g.add(shaft, head);
  g.userData.set = (origin, dir, len) => {
    g.visible = len > 0.01;
    const L = Math.max(len, headL * 1.05);
    g.position.copy(origin);
    g.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
    shaft.scale.y = L - headL; head.position.y = L - headL;
  };
  return g;
}
/* Bemaßung entlang der lokalen x-Achse */
function makeDim(color, size = 2.6) {
  const g = new THREE.Group();
  const m = mat(color, { roughness: 0.5, emissive: new THREE.Color(color).multiplyScalar(0.2) });
  const bar = mesh(new THREE.BoxGeometry(1, 0.35, 0.35).translate(0.5, 0, 0), m, false);
  const t1 = mesh(new THREE.BoxGeometry(0.3, 2, 0.35), m, false);
  const t2 = t1.clone();
  const lab = makeLabel('', { color, size, border: color });
  g.add(bar, t1, t2, lab);
  g.userData.set = (x0, x1, text, labelOff = 2.4) => {
    const a = Math.min(x0, x1), b = Math.max(x0, x1);
    bar.position.x = a; bar.scale.x = Math.max(b - a, 0.01); t1.position.x = a; t2.position.x = b;
    lab.position.set((a + b) / 2, -labelOff, 0); lab.userData.set(text);
  };
  return g;
}
function makePivot(r = 1.4, label = true, size = 2.6) {
  const g = new THREE.Group();
  const s = sph(r, mat(0xef4444, { roughness: 0.3, emissive: new THREE.Color(0x7f1d1d) }));
  g.add(s);
  if (label) { const l = makeLabel('Drehpunkt', { color: '#b91c1c', size, border: '#fca5a5' }); l.position.set(0, -r * 2.6, 0); g.add(l); g.userData.label = l; }
  return g;
}
/* Schraubenfeder als Röhre */
class HelixCurve extends THREE.Curve {
  constructor(len, coils, radius, lead) { super(); this.len = len; this.coils = coils; this.radius = radius; this.lead = lead; }
  getPoint(t, target = new THREE.Vector3()) {
    const lead = this.lead, body = Math.max(this.len - 2 * lead, 0.01);
    const total = this.len;
    const s = t * (body + 2 * lead + 2 * this.radius);
    // Abschnitte: Zuleitung oben (gerade), Übergang, Helix, Übergang, Zuleitung unten
    const segA = lead, segB = this.radius, segC = body, segD = this.radius;
    if (s <= segA) return target.set(0, -s, 0);
    if (s <= segA + segB) { const k = (s - segA) / segB; return target.set(this.radius * k, -lead, 0); }
    if (s <= segA + segB + segC) {
      const k = (s - segA - segB) / segC; const a = k * this.coils * Math.PI * 2;
      return target.set(this.radius * Math.cos(a), -lead - k * body, this.radius * Math.sin(a));
    }
    if (s <= segA + segB + segC + segD) { const k = (s - segA - segB - segC) / segD; return target.set(this.radius * (1 - k), -lead - body, 0); }
    const k = (s - segA - segB - segC - segD) / segA; return target.set(0, -lead - body - k * lead, 0);
  }
}
function springGeometry(len, coils = 14, radius = 1.5, wire = 0.17, lead = 1) {
  return new THREE.TubeGeometry(new HelixCurve(len, coils, radius, lead), coils * 22 + 20, wire, 7, false);
}
function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}

/* =========================================================
   Aufgaben-System (Multiple Choice, Zahl, Formel)
   ========================================================= */
function normFormula(s) {
  return String(s).toLowerCase().replace(/\s+/g, '').replace(/[·×∙⋅]/g, '*').replace(/[:÷]/g, '/').replace(/[_{}()]/g, '');
}
/**
 * Baut eine Liste von Fragen, die nacheinander freigeschaltet werden.
 * q: {id, type:'mc'|'num'|'formula', tag, text, fig, options:[{t, ok, fb}], answer, tol, unit, accept:[], special:{}, chips:[], prefix, hints:[], solution, ok, onSolved(restore)}
 */
function QuestionList(container, title, questions, opts) {
  opts = opts || {};
  container.innerHTML = '';
  const head = el('div', 'qhead', '<h3>' + title + '</h3><span class="qprog"></span>');
  container.appendChild(head);
  const prog = head.querySelector('.qprog');
  const items = [];
  const api = { items, done: () => questions.every((q) => S.done[q.id]) };
  const refresh = () => {
    let open = true; let n = 0;
    items.forEach((it, i) => {
      const solved = !!S.done[it.q.id];
      if (solved) n++;
      it.node.classList.toggle('hidden', !open);
      if (!solved) open = false;
    });
    prog.textContent = n + ' / ' + questions.length;
    if (api.done() && opts.onComplete) opts.onComplete();
  };
  api.refresh = refresh;
  questions.forEach((q, i) => {
    const node = el('div', 'q');
    node.innerHTML = '<div class="q-title"><span class="q-n">' + (i + 1) + '</span><div class="q-text">' + (q.tag ? '<span class="q-tag">' + q.tag + '</span><br>' : '') + q.text + '</div></div>' + (q.fig ? '<div class="q-fig">' + q.fig + '</div>' : '');
    container.appendChild(node);
    const it = { q, node };
    items.push(it);
    const fb = el('div', 'fb hidden');
    let fails = 0, hintIdx = 0;
    const show = (cls, html) => { fb.className = 'fb ' + cls; fb.innerHTML = html; fb.classList.remove('hidden'); };
    const solve = (restore) => {
      if (!restore) { S.done[q.id] = true; save(); node.classList.add('pop'); }
      node.classList.add('solved');
      show('ok', '✅ ' + (q.ok || 'Richtig!'));
      node.querySelectorAll('input, .chip, .ansbtn').forEach((x) => { x.disabled = true; });
      tools.classList.add('hidden');
      if (q.onSolved) q.onSolved(!!restore);
      refresh();
      if (!restore) { const nx = items[i + 1]; if (nx) setTimeout(() => nx.node.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 250); }
    };
    const tools = el('div', 'q-tools');
    const wrong = (html) => {
      fails++;
      show('bad', '❌ ' + html);
      if (q.hints && q.hints.length && !tools.querySelector('.hintbtn')) addHintBtn();
      if (q.solution && fails >= 2 && !tools.querySelector('.solbtn')) {
        const b = el('button', 'mini solbtn', '📖 Lösungsweg zeigen');
        b.onclick = () => { const s = el('div', 'fb sol', '<b>Lösungsweg:</b> ' + q.solution); node.insertBefore(s, tools); b.remove(); };
        tools.appendChild(b);
      }
    };
    const addHintBtn = () => {
      const b = el('button', 'mini hintbtn', '💡 Tipp');
      b.onclick = () => {
        if (hintIdx < q.hints.length) {
          const h = el('div', 'fb hint', '💡 <b>Tipp ' + (hintIdx + 1) + ':</b> ' + q.hints[hintIdx]);
          node.insertBefore(h, tools); hintIdx++;
          if (hintIdx >= q.hints.length) b.remove();
        }
      };
      tools.insertBefore(b, tools.firstChild);
    };

    if (q.type === 'mc') {
      const box = el('div', 'opts');
      q.options.forEach((o) => {
        const b = el('button', 'opt ansbtn', o.t);
        b.onclick = () => {
          if (S.done[q.id]) return;
          box.querySelectorAll('.opt').forEach((x) => x.classList.remove('bad'));
          if (o.ok) { b.classList.add('ok'); solve(false); }
          else { void b.offsetWidth; b.classList.add('bad'); wrong(o.fb || q.wrong || 'Leider nicht richtig. Überlege noch einmal.'); }
        };
        o.btn = b;
        box.appendChild(b);
      });
      node.appendChild(box);
      it.restore = () => { q.options.forEach((o) => { if (o.ok) o.btn.classList.add('ok'); }); solve(true); };
    } else {
      const row = el('div', 'ans-row');
      if (q.prefix) row.appendChild(el('span', 'pre', q.prefix));
      const inp = el('input');
      inp.type = 'text';
      inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
      inp.setAttribute('autocorrect', 'off');
      if (q.type === 'num') inp.setAttribute('inputmode', 'decimal');
      inp.placeholder = q.placeholder || (q.type === 'num' ? 'Zahl eingeben' : 'Formel eingeben oder antippen');
      row.appendChild(inp);
      if (q.unit) row.appendChild(el('span', 'unit', q.unit));
      const go = el('button', 'btn ansbtn', 'Prüfen');
      row.appendChild(go);
      node.appendChild(row);
      if (q.type === 'formula' && q.chips) {
        const chips = el('div', 'chips');
        q.chips.forEach((c) => {
          const b = el('button', 'chip' + (c.op ? ' op' : ''), c.l);
          b.onclick = () => { inp.value += c.v; };
          chips.appendChild(b);
        });
        const del = el('button', 'chip del', '⌫');
        del.onclick = () => { inp.value = inp.value.slice(0, -1); };
        const clr = el('button', 'chip del', 'C');
        clr.onclick = () => { inp.value = ''; };
        chips.appendChild(del); chips.appendChild(clr);
        node.appendChild(chips);
      }
      const check = () => {
        if (S.done[q.id]) return;
        if (q.type === 'num') {
          const v = parseNum(inp.value);
          if (isNaN(v)) { show('hint', 'Bitte gib eine Zahl ein (Komma oder Punkt sind erlaubt).'); return; }
          const tol = q.tol != null ? q.tol : Math.max(Math.abs(q.answer) * 0.011, 1e-6);
          if (Math.abs(v - q.answer) <= tol) solve(false);
          else {
            let msg = null;
            if (q.special) for (const k in q.special) if (Math.abs(v - parseFloat(k)) <= Math.max(Math.abs(parseFloat(k)) * 0.011, 1e-6)) msg = q.special[k];
            wrong(msg || q.wrong || 'Das stimmt noch nicht. Rechne noch einmal nach.');
          }
        } else {
          const v = normFormula(inp.value);
          if (!v) { show('hint', 'Tippe die Formel ein oder nutze die Bausteine darunter.'); return; }
          if (q.accept.map(normFormula).includes(v)) solve(false);
          else wrong((q.special && q.special[v]) || q.wrong || 'Die Formel stimmt noch nicht.');
        }
      };
      go.onclick = check;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); check(); } });
      it.restore = () => { inp.value = q.type === 'num' ? String(q.answer).replace('.', ',') : (q.show || q.accept[0]); solve(true); };
    }
    if (q.hints && q.hints.length && q.hintsVisible) addHintBtn();
    node.appendChild(tools);
    node.appendChild(fb);
  });
  // Wiederherstellen
  items.forEach((it) => { if (S.done[it.q.id]) it.restore(); });
  refresh();
  return api;
}

/* =========================================================
   Diagramm (SVG)
   ========================================================= */
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function makeGraph(svg, cfg) {
  // cfg: xMax, xStep, yMax, yStep, xLabel, yLabel, color
  const X0 = 60, Y0 = 312, W = 420, H = 258;
  const sx = (x) => X0 + x / cfg.xMax * W, sy = (y) => Y0 - y / cfg.yMax * H;
  svg.innerHTML = '';
  const grid = svgEl('g', { stroke: '#e2e8f0', 'stroke-width': 1 }, svg);
  for (let x = cfg.xStep; x <= cfg.xMax + 1e-9; x += cfg.xStep) svgEl('line', { x1: sx(x), y1: Y0, x2: sx(x), y2: Y0 - H, 'stroke-dasharray': '4 4' }, grid);
  for (let y = cfg.yStep; y <= cfg.yMax + 1e-9; y += cfg.yStep) svgEl('line', { x1: X0, y1: sy(y), x2: X0 + W, y2: sy(y), 'stroke-dasharray': '4 4' }, grid);
  svgEl('line', { x1: X0, y1: Y0, x2: X0 + W + 18, y2: Y0, stroke: '#475569', 'stroke-width': 2 }, svg);
  svgEl('line', { x1: X0, y1: Y0, x2: X0, y2: Y0 - H - 18, stroke: '#475569', 'stroke-width': 2 }, svg);
  svgEl('polygon', { points: `${X0 + W + 18},${Y0 - 5} ${X0 + W + 28},${Y0} ${X0 + W + 18},${Y0 + 5}`, fill: '#475569' }, svg);
  svgEl('polygon', { points: `${X0 - 5},${Y0 - H - 18} ${X0},${Y0 - H - 28} ${X0 + 5},${Y0 - H - 18}`, fill: '#475569' }, svg);
  const t = (x, y, s, a) => { const e = svgEl('text', Object.assign({ x, y, 'font-size': 13, fill: '#64748b', 'text-anchor': 'middle', 'font-family': 'inherit' }, a || {}), svg); e.textContent = s; return e; };
  t(X0 - 10, Y0 + 18, '0');
  for (let x = cfg.xStep; x <= cfg.xMax + 1e-9; x += cfg.xStep) { svgEl('line', { x1: sx(x), y1: Y0, x2: sx(x), y2: Y0 + 6, stroke: '#475569', 'stroke-width': 1.5 }, svg); t(sx(x), Y0 + 22, fmt(x, 1)); }
  for (let y = cfg.yStep; y <= cfg.yMax + 1e-9; y += cfg.yStep) { svgEl('line', { x1: X0 - 6, y1: sy(y), x2: X0, y2: sy(y), stroke: '#475569', 'stroke-width': 1.5 }, svg); t(X0 - 12, sy(y) + 4, fmtAuto(y), { 'text-anchor': 'end' }); }
  t(X0 + W + 24, Y0 + 42, cfg.xLabel, { 'font-weight': 700, fill: '#334155', 'text-anchor': 'end' });
  t(X0 + 12, Y0 - H - 14, cfg.yLabel, { 'font-weight': 700, fill: '#334155', 'text-anchor': 'start' });
  const g = {
    sx, sy,
    cmp: svgEl('line', { stroke: '#6366f1', 'stroke-width': 3, 'stroke-dasharray': '8 6', opacity: 0 }, svg),
    fit: svgEl('line', { stroke: cfg.color, 'stroke-width': 3.5, 'stroke-linecap': 'round', class: 'fit', opacity: 0 }, svg),
    tri: svgEl('g', { opacity: 0 }, svg),
    pts: svgEl('g', {}, svg),
    extra: svgEl('g', {}, svg)
  };
  g.poly = svgEl('polygon', { fill: cfg.color, 'fill-opacity': 0.14 }, g.tri);
  g.lh = svgEl('line', { stroke: cfg.color, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g.tri);
  g.lv = svgEl('line', { stroke: cfg.color, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g.tri);
  g.tdx = svgEl('text', { 'font-size': 14, 'font-weight': 700, fill: cfg.color, 'text-anchor': 'middle' }, g.tri);
  g.tdy = svgEl('text', { 'font-size': 14, 'font-weight': 700, fill: cfg.color }, g.tri);
  g.setPoints = (pts, newKey) => {
    g.pts.innerHTML = '';
    pts.forEach((p) => {
      const gg = svgEl('g', {}, g.pts);
      const c = svgEl('circle', { cx: sx(p.x), cy: sy(p.y), r: 7, fill: cfg.color, stroke: '#fff', 'stroke-width': 2.5 }, gg);
      if (p.key === newKey) c.setAttribute('class', 'pt');
      const tx = svgEl('text', { x: sx(p.x) - 8, y: sy(p.y) - 12, 'font-size': 12, 'font-weight': 700, fill: cfg.color, 'text-anchor': 'end' }, gg);
      tx.textContent = '(' + fmt(p.x, 1) + ' | ' + fmtAuto(p.y) + ')';
    });
  };
  g.setFit = (on, f) => {
    const x2 = cfg.xMax;
    g.fit.setAttribute('x1', sx(0)); g.fit.setAttribute('y1', sy(f(0)));
    g.fit.setAttribute('x2', sx(x2)); g.fit.setAttribute('y2', sy(f(x2)));
    g.fit.setAttribute('opacity', on ? 1 : 0);
    requestAnimationFrame(() => g.fit.classList.toggle('on', on));
  };
  g.setCompare = (on, f) => {
    g.cmp.setAttribute('x1', sx(0)); g.cmp.setAttribute('y1', sy(f(0)));
    g.cmp.setAttribute('x2', sx(cfg.xMax)); g.cmp.setAttribute('y2', sy(f(cfg.xMax)));
    g.cmp.setAttribute('opacity', on ? 0.8 : 0);
  };
  g.setTri = (on, f, x1, x2, yName, yUnit) => {
    g.tri.setAttribute('opacity', on ? 1 : 0);
    const X1 = sx(x1), X2 = sx(x2), Y1 = sy(f(x1)), Y2 = sy(f(x2));
    g.poly.setAttribute('points', `${X1},${Y1} ${X2},${Y1} ${X2},${Y2}`);
    Object.entries({ x1: X1, y1: Y1, x2: X2, y2: Y1 }).forEach(([k, v]) => g.lh.setAttribute(k, v));
    Object.entries({ x1: X2, y1: Y1, x2: X2, y2: Y2 }).forEach(([k, v]) => g.lv.setAttribute(k, v));
    g.tdx.setAttribute('x', (X1 + X2) / 2); g.tdx.setAttribute('y', Y1 + 20); g.tdx.textContent = 'ΔF = ' + fmt(x2 - x1, 1) + ' N';
    g.tdy.setAttribute('x', X2 + 8); g.tdy.setAttribute('y', (Y1 + Y2) / 2 + 5); g.tdy.textContent = 'Δ' + yName + ' = ' + fmtAuto(f(x2) - f(x1)) + ' ' + yUnit;
  };
  return g;
}
