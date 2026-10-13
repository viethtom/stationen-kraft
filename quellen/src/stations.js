/* =========================================================
   Gemeinsame Bauteile für die Labor-Stationen
   ========================================================= */
function discGeo(r, h) { return new THREE.CylinderGeometry(r, r, h * 0.95, 30, 1, false, 0.45, Math.PI * 2 - 0.9); }
function makeHanger(o) {
  // Gewichtsteller mit Schlitzgewichten. Ursprung = oberer Rand der Öse.
  o = Object.assign({ r: 2.3, h: 1.15, maxDiscs: 5, rodLen: 7.5, mat: null }, o);
  const dm = (o.mat || MAT.weight).clone(); dm.side = THREE.DoubleSide;
  const g = new THREE.Group();
  const eye = mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 20), MAT.steel); eye.position.y = -0.6; eye.rotation.y = Math.PI / 2; g.add(eye);
  const rodBottom = -(1.2 + o.rodLen);
  g.add(rod(V3(0, -1.15, 0), V3(0, rodBottom, 0), 0.2, MAT.steel));
  const base = cyl(o.r, o.r, o.h * 0.95, o.mat || MAT.weight, 30); base.position.y = rodBottom + o.h / 2 - 0.25; g.add(base);
  const discs = [];
  for (let k = 1; k < o.maxDiscs; k++) {
    const d = mesh(discGeo(o.r, o.h), dm); d.position.y = base.position.y + k * o.h; d.rotation.y = k * 0.6; d.visible = false; g.add(d); discs.push(d);
  }
  g.userData.slotY = (k) => base.position.y + k * o.h;
  g.userData.setCount = (n) => { g.visible = n >= 1; discs.forEach((d, i) => { d.visible = i < n - 1; }); };
  g.userData.bottom = rodBottom - 0.4;
  g.userData.discGeo = discGeo(o.r, o.h);
  g.userData.discMat = dm;
  return g;
}
function beamTexture(xMin, xMax, labelFn) {
  return canvasTexture(2048, 96, (ctx, W, H) => {
    const grd = ctx.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#f1f5f9'); grd.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    const px = (x) => (x - xMin) / (xMax - xMin) * W;
    for (let v = Math.ceil(xMin / 5) * 5; v <= xMax; v += 5) {
      const x = px(v);
      const big = v % 10 === 0;
      ctx.fillStyle = v === 0 ? '#dc2626' : '#1e293b';
      ctx.fillRect(x - (big ? 2.5 : 1.5), 0, big ? 5 : 3, big ? 40 : 24);
      if (big) { const s = labelFn(v); if (s !== '') { ctx.font = 'bold 34px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s, x, 82); } }
    }
  });
}
function rangeVal(id) { return parseFloat($(id).value); }
function bindRange(id, fn) {
  const i = $(id); setRangeFill(i);
  i.addEventListener('input', () => { setRangeFill(i); fn(); });
}
function fineButtons(id, step) {
  const inp = $(id);
  const wrap = el('div', 'fine');
  inp.parentNode.insertBefore(wrap, inp);
  const mk = (t, d) => { const b = el('button', '', t); b.type = 'button'; b.onclick = (e) => { e.preventDefault(); inp.value = (Math.round((parseFloat(inp.value) + d) / step) * step).toFixed(2); inp.dispatchEvent(new Event('input')); }; return b; };
  wrap.appendChild(mk('−', -step)); wrap.appendChild(inp); wrap.appendChild(mk('+', step));
}
function markStationDone(tab) {
  S.done[tab] = true; save();
  const t = document.querySelector('.tab[data-tab="' + tab + '"]'); if (t) t.classList.add('done');
}

/* =========================================================
   STATION 1 + 2: Feder (Hookesches Gesetz)
   ========================================================= */
function SpringStation(o) {
  // o: {num, mode:'A'|'B', key:'m1'|'m2', color}
  const P = 's' + o.num;
  const TOP = 52, L0 = 10, PER = 5, MAXN = 5;
  const st = { stage: null, n: 0, x: 0, v: 0, busy: false, anim: null, readMode: false, lastCalm: null, graph: null, q: null };
  let hanger, flyHanger, flyDisc, springMesh, springLen = -1, endRing, pointer, massLabel;
  const eqExt = () => st.n * PER;
  const isCalm = () => !st.busy && Math.abs(st.x - eqExt()) < 0.15 && Math.abs(st.v) < 1.2;
  const reading = (ext) => o.mode === 'A' ? ext : L0 + ext;

  function build() {
    const stage = st.stage = new Stage('stage' + o.num, { id: o.num, target: V3(1, 32, 0), radius: 100, theta: 0.38, phi: 1.4, shadow: 45, floorColor: 0xd8c4a6 });
    const sc = stage.scene;
    // Stativ
    const base = box(32, 2.4, 18, MAT.dark); base.position.set(-12, 1.2, 0); sc.add(base);
    const pole = cyl(0.9, 0.9, 64, MAT.steel); pole.position.set(-21, 33, 0); sc.add(pole);
    sc.add(rod(V3(-21, 56, 0), V3(1.6, 56, 0), 0.7, MAT.steel));
    const cl = box(3.4, 3.4, 3.4, MAT.dark); cl.position.set(-21, 56, 0); sc.add(cl);
    sc.add(rod(V3(0, 56, 0), V3(0, TOP + 0.9, 0), 0.25, MAT.steel));
    const ring = mesh(new THREE.TorusGeometry(0.7, 0.17, 8, 20), MAT.steel); ring.position.set(0, TOP + 0.3, 0); ring.rotation.y = Math.PI / 2; sc.add(ring);
    // Lineal
    const vStart = -1, vEnd = o.mode === 'A' ? 31 : 41;
    const zeroY = o.mode === 'A' ? TOP - L0 : TOP;
    const len = vEnd - vStart, top = zeroY - vStart;
    const tex = canvasTexture(128, len * 32, (ctx, w, h) => {
      ctx.fillStyle = '#fde68a'; ctx.fillRect(0, 0, w, h);
      for (let v = vStart; v <= vEnd; v += 1) {
        const y = (v - vStart) * 32;
        const L = v % 10 === 0 ? 58 : v % 5 === 0 ? 42 : 24;
        ctx.fillStyle = v === 0 ? '#dc2626' : '#713f12';
        ctx.fillRect(0, y - (v % 5 === 0 ? 2 : 1), L, v % 5 === 0 ? 4 : 2);
        if (v >= 0 && v % 5 === 0) { ctx.font = 'bold 30px Helvetica, Arial, sans-serif'; ctx.fillText(String(v), 64, y + 11); }
      }
      for (let v = vStart + 0.5; v < vEnd; v += 1) { const y = (v - vStart) * 32; ctx.fillStyle = '#92400e'; ctx.fillRect(0, y - 0.5, 14, 1.5); }
    });
    const side = mat(0xfbbf24, { roughness: 0.6 });
    const ruler = mesh(new THREE.BoxGeometry(4, len, 0.5), [side, side, side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), side]);
    ruler.position.set(5.7, top - len / 2, 0); sc.add(ruler);
    sc.add(rod(V3(-21, top + 1.2, -0.6), V3(6, top + 1.2, -0.6), 0.45, MAT.steel));
    const cl2 = box(3, 3, 3, MAT.dark); cl2.position.set(-21, top + 1.2, 0); sc.add(cl2);
    const rl = makeLabel(o.mode === 'A' ? 'Ausdehnung s in cm' : 'Gesamtlänge L in cm', { size: 3, color: o.mode === 'A' ? '#4338ca' : '#047857' });
    rl.position.set(9, top + 4.5, 0); sc.add(rl);
    if (o.mode === 'A') { const z = makeLabel('0 = Federende ohne Last', { size: 2.6, color: '#b91c1c', border: '#fca5a5' }); z.position.set(20, zeroY, 0); sc.add(z); }
    else { const z = makeLabel('0 = Aufhängepunkt', { size: 2.6, color: '#b91c1c', border: '#fca5a5' }); z.position.set(18, TOP, 0); sc.add(z); }
    // Feder
    springMesh = mesh(springGeometry(L0), mat(0x8e98a5, { metalness: 0.9, roughness: 0.25 })); springMesh.position.set(0, TOP, 0); sc.add(springMesh);
    endRing = mesh(new THREE.TorusGeometry(0.65, 0.17, 8, 20), MAT.steel); sc.add(endRing);
    // Zeiger
    pointer = new THREE.Group();
    const pm = mat(0xdc2626, { emissive: new THREE.Color(0x450a0a) });
    pointer.add(rod(V3(1.7, 0, 0), V3(3.1, 0, 0), 0.12, pm));
    const tip = mesh(new THREE.ConeGeometry(0.32, 0.8, 12), pm); tip.rotation.z = -Math.PI / 2; tip.position.x = 3.35; pointer.add(tip);
    sc.add(pointer);
    // Gewichte
    hanger = makeHanger({ maxDiscs: MAXN }); sc.add(hanger); hanger.userData.setCount(0);
    massLabel = makeLabel('', { size: 3, border: '#cbd5e1' }); massLabel.position.set(-10, -5, 0); hanger.add(massLabel);
    flyHanger = makeHanger({ maxDiscs: 1 }); flyHanger.userData.setCount(1); flyHanger.visible = false; sc.add(flyHanger);
    flyDisc = mesh(hanger.userData.discGeo, hanger.userData.discMat); flyDisc.visible = false; sc.add(flyDisc);
    stage.onUpdate(tick);
  }

  function tick(dt) {
    // Feder-Masse-Schwinger (k = 10 N/m, gedämpft)
    const k = 10, m = 0.02 + st.n * 0.05, c = 2 * 0.18 * Math.sqrt(k * m), T = eqExt();
    const sub = 6, h = dt / sub;
    for (let i = 0; i < sub; i++) { const a = (k * (T - st.x) - c * st.v) / m; st.v += a * h; st.x += st.v * h; }
    const len = L0 + st.x;
    if (springMesh) {
      if (Math.abs(len - springLen) > 0.02) { springLen = len; springMesh.geometry.dispose(); springMesh.geometry = springGeometry(len); }
      const yEnd = TOP - len;
      endRing.position.set(0, yEnd - 0.4, 0);
      pointer.position.set(0, yEnd, 0);
      hanger.position.set(0, yEnd - 0.75, 0);
      if (st.anim) stepAnim(dt);
      if (st.readMode && !st.stage.tween) st.stage.view.target.y += (TOP - L0 - eqExt() - st.stage.view.target.y) * Math.min(1, dt * 3);
    }
    // Live-Anzeige
    const r = reading(st.x);
    const txt = (o.mode === 'A' ? 's = ' : 'L = ') + fmt(Math.max(r, 0), 1) + ' cm';
    if (txt !== st.lastTxt) { st.lastTxt = txt; $(P + '-live').textContent = txt; }
    const calm = isCalm();
    if (calm !== st.lastCalm) { st.lastCalm = calm; updateCalm(calm); }
  }
  function stepAnim(dt) {
    const a = st.anim; a.t = Math.min(1, a.t + dt / a.dur);
    const k = ease(a.t);
    const to = a.to();
    a.obj.position.lerpVectors(a.from, to, k);
    a.obj.position.y += Math.sin(Math.PI * a.t) * a.arc;
    if (a.t >= 1) { const f = a.done; st.anim = null; f(); }
  }
  function pieceWorld(k) { return V3(0, hanger.position.y + hanger.userData.slotY(k), 0); }

  function add() {
    if (st.busy || st.n >= MAXN) return;
    if (!st.stage) { st.n++; st.x = eqExt(); afterChange(); return; }
    st.busy = true; updateUI();
    const k = st.n, first = k === 0;
    const obj = first ? flyHanger : flyDisc;
    obj.visible = true; obj.rotation.y = k * 0.6;
    st.anim = {
      obj, t: 0, dur: 0.65, arc: 6,
      from: V3(17, TOP - L0 - st.x - 4, 9),
      to: () => first ? V3(0, hanger.position.y, 0) : pieceWorld(k),
      done: () => { obj.visible = false; st.n++; hanger.userData.setCount(st.n); st.busy = false; afterChange(); }
    };
  }
  function remove() {
    if (st.busy || st.n <= 0) return;
    if (!st.stage) { st.n--; st.x = eqExt(); afterChange(); return; }
    st.busy = true;
    const k = st.n - 1, first = k === 0;
    const obj = first ? flyHanger : flyDisc;
    const from = first ? hanger.position.clone() : pieceWorld(k);
    st.n--; hanger.userData.setCount(st.n);
    obj.visible = true; obj.position.copy(from); obj.rotation.y = k * 0.6;
    st.anim = { obj, t: 0, dur: 0.55, arc: 4, from, to: () => V3(17, from.y + 2, 9), done: () => { obj.visible = false; st.busy = false; updateUI(); } };
    afterChange();
  }
  function afterChange() {
    const g = st.n * 50;
    if (massLabel) massLabel.userData.set(g + ' g → ' + fmt(st.n * 0.5, 1) + ' N');
    updateUI();
  }
  function updateUI() {
    $(P + '-n').textContent = st.n;
    if ($(P + '-m')) $(P + '-m').textContent = (st.n * 50) + ' g';
    $(P + '-f').textContent = fmt(st.n * 0.5, 1) + ' N';
    $(P + '-s').textContent = reading(eqExt());
    $(P + '-add').disabled = st.busy || st.n >= MAXN;
    $(P + '-rem').disabled = st.busy || st.n <= 0;
    updateCalm(isCalm());
  }
  function updateCalm(calm) {
    const p = $(P + '-calm');
    p.textContent = calm ? 'in Ruhe ✓' : 'schwingt … warten';
    p.className = 'pill ' + (calm ? 'ok' : 'warn');
    const b = $(P + '-save');
    if (b.dataset.flash) return;
    b.disabled = !calm;
    b.textContent = calm ? '💾 Messwert speichern' : '⏳ Warten, bis die Feder ruhig hängt …';
  }
  function flash(msg) {
    const b = $(P + '-save'); b.dataset.flash = '1'; b.textContent = msg; b.disabled = true;
    setTimeout(() => { delete b.dataset.flash; st.lastCalm = null; updateCalm(isCalm()); }, 1600);
  }
  function record() {
    if (!isCalm()) return;
    const arr = S[o.key];
    if (arr.some((m) => m.n === st.n)) { flash('Diesen Messwert hast du schon ✓'); return; }
    const rec = { n: st.n, F: st.n * 0.5, v: reading(eqExt()) };
    arr.push(rec); arr.sort((a, b) => a.n - b.n); save();
    renderTable(rec.n); renderGraph(rec.n); checkUnlock();
    flash('Gespeichert ✓');
  }
  function renderTable(newN) {
    const tb = $(P + '-tbody'); const arr = S[o.key];
    const showQ = o.mode === 'A' ? !!S.done['s1-q2'] : !!S.done['s2-q2'];
    $(P + '-colq').classList.toggle('hidden', !showQ);
    if (!arr.length) { tb.innerHTML = '<tr class="empty"><td colspan="6">Noch keine Messwerte. Hänge Gewichte an und speichere, sobald die Feder ruhig hängt.</td></tr>'; return; }
    tb.innerHTML = '';
    arr.forEach((m, i) => {
      const tr = el('tr', m.n === newN ? 'new' : '');
      let h;
      if (o.mode === 'A') {
        h = '<td>' + m.n + '×</td><td>' + (m.n * 50) + ' g</td><td><b>' + fmt(m.F, 1) + ' N</b></td><td style="color:var(--indigo);font-weight:800">' + m.v + ' cm</td>';
        if (showQ) h += '<td class="calc">' + (m.F === 0 ? '–' : fmtAuto(m.v / m.F) + ' cm/N') + '</td>';
      } else {
        h = '<td>' + m.n + '×</td><td><b>' + fmt(m.F, 1) + ' N</b></td><td style="color:var(--emerald);font-weight:800">' + m.v + ' cm</td>';
        if (showQ) h += '<td class="calc">' + (m.v - L0) + ' cm</td>';
      }
      h += '<td><button class="del" title="Messwert löschen">✕</button></td>';
      tr.innerHTML = h;
      tr.querySelector('.del').onclick = () => { arr.splice(i, 1); save(); renderTable(); renderGraph(); };
      tb.appendChild(tr);
    });
  }
  const fLine = (x) => o.mode === 'A' ? x * 10 : L0 + x * 10;
  function renderGraph(newN) {
    const g = st.graph;
    g.setPoints(S[o.key].map((m) => ({ x: m.F, y: m.v, key: m.n })), newN);
  }
  function unlocked() { return S.done[P + '-unlocked'] || S[o.key].length >= 3; }
  function checkUnlock() {
    if (!unlocked()) return;
    if (!S.done[P + '-unlocked']) { S.done[P + '-unlocked'] = true; save(); }
    $(P + '-graphcard').classList.remove('locked-card');
    $(P + '-graphnote').textContent = o.mode === 'A' ? 'Die Ausgleichsgerade verbindet deine Messpunkte. Verschiebe das Steigungsdreieck mit den Reglern.' : 'Achte darauf, wo die Gerade die L-Achse schneidet (roter Punkt)!';
    st.graph.setFit(true, fLine);
    $(P + '-slope').classList.remove('hidden');
    if (o.mode === 'B') {
      st.graph.extra.innerHTML = '';
      svgEl('circle', { cx: st.graph.sx(0), cy: st.graph.sy(L0), r: 8, fill: '#ef4444', stroke: '#fff', 'stroke-width': 2.5 }, st.graph.extra);
      const t = svgEl('text', { x: st.graph.sx(0) + 12, y: st.graph.sy(L0) + 22, 'font-size': 13, 'font-weight': 700, fill: '#dc2626' }, st.graph.extra); t.textContent = 'y-Achsenabschnitt';
    }
    updateSlope();
    if (!st.q) buildQuestions();
    $(P + '-q').classList.remove('hidden');
  }
  function updateSlope() {
    const a = $(P + '-p1'), b = $(P + '-p2');
    let x1 = parseFloat(a.value), x2 = parseFloat(b.value);
    if (x1 >= x2) { x1 = x2 - 0.5; a.value = x1; }
    setRangeFill(a); setRangeFill(b);
    $(P + '-p1v').textContent = fmt(x1, 1) + ' N'; $(P + '-p2v').textContent = fmt(x2, 1) + ' N';
    const yN = o.mode === 'A' ? 's' : 'L';
    st.graph.setTri(unlocked(), fLine, x1, x2, yN, 'cm');
    const dy = fLine(x2) - fLine(x1), dx = x2 - x1;
    $(P + '-ratio').textContent = fmtAuto(dy) + ' cm / ' + fmt(dx, 1) + ' N';
    $(P + '-slopev').textContent = fmt(dy / dx, 1) + ' cm/N';
  }
  function buildQuestions() {
    st.q = QuestionList($(P + '-q'), o.mode === 'A' ? 'Auswertung &amp; Aufgaben' : 'Auswertung &amp; Vergleich', o.questions(api), {
      onComplete: () => { $(P + '-merke').classList.remove('hidden'); markStationDone('tab' + o.num); }
    });
  }
  const api = { renderTable: () => renderTable() };
  function init() {
    if (Engine.ok) build();
    st.graph = makeGraph($('graph' + o.num), o.mode === 'A'
      ? { xMax: 2.5, xStep: 0.5, yMax: 25, yStep: 5, xLabel: 'F in N', yLabel: 's in cm', color: '#4f46e5' }
      : { xMax: 2.5, xStep: 0.5, yMax: 40, yStep: 10, xLabel: 'F in N', yLabel: 'L in cm', color: '#059669' });
    $(P + '-add').onclick = add; $(P + '-rem').onclick = remove; $(P + '-save').onclick = record;
    [P + '-p1', P + '-p2'].forEach((id) => { $(id).addEventListener('input', updateSlope); setRangeFill($(id)); });
    if (o.mode === 'B') $('s2-compare').addEventListener('change', (e) => st.graph.setCompare(e.target.checked, (x) => x * 10));
    $(P + '-read').onclick = () => {
      if (!st.stage) return;
      st.readMode = !st.readMode;
      $(P + '-read').classList.toggle('on', st.readMode);
      if (st.readMode) st.stage.setView({ theta: 0.04, phi: 1.55, radius: 30, target: V3(3, TOP - L0 - eqExt(), 0) }, 0.9);
      else st.stage.resetView();
    };
    renderTable(); renderGraph();
    afterChange();
    checkUnlock();
    if (S.done['tab' + o.num]) { $(P + '-merke').classList.remove('hidden'); }
  }
  return { init, get stage() { return st.stage; } };
}

/* ---------- Fragen Station 1 ---------- */
const springCompareFig = `<svg viewBox="0 0 300 200"><g stroke="#e2e8f0">${[1, 2, 3, 4].map((i) => `<line x1="${40 + i * 55}" y1="170" x2="${40 + i * 55}" y2="20" stroke-dasharray="3 3"/>`).join('')}${[1, 2, 3, 4].map((i) => `<line x1="40" y1="${170 - i * 35}" x2="270" y2="${170 - i * 35}" stroke-dasharray="3 3"/>`).join('')}</g>
<line x1="40" y1="170" x2="280" y2="170" stroke="#475569" stroke-width="2"/><line x1="40" y1="170" x2="40" y2="12" stroke="#475569" stroke-width="2"/>
<text x="275" y="190" font-size="12" text-anchor="end" fill="#334155" font-weight="700">F in N</text><text x="46" y="16" font-size="12" fill="#334155" font-weight="700">s in cm</text>
${[1, 2, 3, 4].map((i) => `<text x="${40 + i * 55}" y="186" font-size="11" text-anchor="middle" fill="#64748b">${fmt(i * 0.5, 1)}</text>`).join('')}${[1, 2, 3, 4].map((i) => `<text x="34" y="${174 - i * 35}" font-size="11" text-anchor="end" fill="#64748b">${i * 10}</text>`).join('')}
<line x1="40" y1="170" x2="150" y2="30" stroke="#dc2626" stroke-width="3.5" stroke-linecap="round"/><text x="154" y="34" font-size="13" font-weight="800" fill="#dc2626">Feder Rot</text>
<line x1="40" y1="170" x2="260" y2="100" stroke="#2563eb" stroke-width="3.5" stroke-linecap="round"/><text x="262" y="94" font-size="13" font-weight="800" fill="#2563eb" text-anchor="end">Feder Blau</text></svg>`;

const QUESTIONS_1 = (api) => [
  { id: 's1-q1', type: 'mc', text: 'Welcher mathematische Zusammenhang besteht zwischen der Kraft <i>F</i> und der Ausdehnung <i>s</i>?',
    options: [
      { t: 'Antiproportional', fb: '<b>Nicht ganz.</b> Antiproportional hieße: doppelte Kraft → halbe Ausdehnung. Schau in deine Tabelle: Was passiert mit <i>s</i>, wenn sich <i>F</i> verdoppelt?' },
      { t: 'Proportional', ok: true },
      { t: 'Quadratisch', fb: '<b>Nein.</b> Bei einem quadratischen Zusammenhang wäre der Graph gekrümmt (Parabel). Deine Messpunkte liegen aber auf einer Geraden.' },
      { t: 'Es gibt keinen Zusammenhang', fb: '<b>Doch!</b> Je mehr Gewicht du anhängst, desto länger wird die Feder – und zwar ganz regelmäßig.' }
    ],
    ok: '<b>Richtig!</b> Die Messpunkte liegen auf einer <b>Ursprungsgeraden</b>: doppelte Kraft → doppelte Ausdehnung, dreifache Kraft → dreifache Ausdehnung. Man schreibt <i>s</i> ~ <i>F</i>.' },
  { id: 's1-q2', type: 'formula', text: 'Bei proportionalen Größen ist der <b>Quotient</b> immer gleich. Gib die Formel für diesen Proportionalitätsfaktor aus <i>s</i> und <i>F</i> ein.<div class="sub">Der Faktor beschreibt die „Dehnbarkeit“ der Feder.</div>',
    prefix: 'Faktor =', accept: ['s/f'], show: 's / F',
    chips: [{ l: 's', v: 's' }, { l: 'F', v: 'F' }, { l: 'm', v: 'm' }, { l: '/', v: '/', op: true }, { l: '·', v: '·', op: true }],
    special: { 'f/s': '<b>Fast!</b> F/s ist der Kehrwert. Gesucht ist hier: Ausdehnung <i>pro</i> Kraft – also y-Wert durch x-Wert.', 's*f': 'Bei proportionalen Größen ist der <b>Quotient</b> konstant, nicht das Produkt. Teile!', 'f*s': 'Bei proportionalen Größen ist der <b>Quotient</b> konstant, nicht das Produkt. Teile!' },
    wrong: 'Verwende <b>s</b> und <b>F</b> mit einem Geteilt-Zeichen. Denk an „Ausdehnung (y-Achse) durch Kraft (x-Achse)“.',
    ok: '<b>Perfekt!</b> In der Tabelle siehst du jetzt die neue Spalte: <i>s</i>/<i>F</i> ist bei jeder Messung gleich – <b>10 cm/N</b>.',
    onSolved: () => api.renderTable() },
  { id: 's1-q3', type: 'mc', text: 'Welche Bedeutung hat die <b>Steigung</b> der Geraden, die du mit dem Steigungsdreieck bestimmt hast (10,0 cm/N)?',
    options: [
      { t: 'Sie gibt die Masse der Gewichtsstücke an.', fb: 'Die Masse steht in der Tabelle, aber die Steigung ist ein <b>Verhältnis</b> aus zwei Größen: Δs/ΔF.' },
      { t: 'Sie ist die Gesamtlänge der Feder.', fb: 'Die Gesamtlänge wird in cm gemessen. Die Steigung hat aber die Einheit cm/N.' },
      { t: 'Sie ist der Proportionalitätsfaktor s/F: so viele cm dehnt sich die Feder pro Newton.', ok: true },
      { t: 'Sie gibt an, bei welcher Kraft die Feder reißt.', fb: 'Davon verrät der Graph nichts. Achte auf die Einheit cm/N.' }
    ],
    ok: '<b>Genau!</b> Steigung = Δs/ΔF = Quotient s/F. Unsere Feder dehnt sich um 10 cm pro Newton.' },
  { id: 's1-q4', type: 'formula', text: 'Physiker beschreiben eine Feder lieber über ihre <b>Härte</b>, die <b>Federkonstante D</b>. Sie ist der Kehrwert der Steigung: <i>D</i> = <i>F</i> / <i>s</i>. Für unsere Feder gilt also <i>D</i> = 0,1 N/cm.<div class="sub">Stelle die Formel nach der Kraft <i>F</i> um.</div>',
    prefix: 'F =', accept: ['d*s', 's*d', 'ds', 'sd'], show: 'D · s',
    chips: [{ l: 'D', v: 'D' }, { l: 's', v: 's' }, { l: 'F', v: 'F' }, { l: '·', v: '·', op: true }, { l: '/', v: '/', op: true }],
    special: { 'd/s': 'Prüfe: Aus <i>D</i> = <i>F</i>/<i>s</i> folgt durch <b>Multiplizieren</b> beider Seiten mit <i>s</i> …', 's/d': 'Das wäre die Ausdehnung <i>s</i> = <i>F</i>/<i>D</i> – aber umgekehrt. Gesucht ist <i>F</i>. Multipliziere <i>D</i> = <i>F</i>/<i>s</i> mit <i>s</i>.' },
    hints: ['Starte mit D = F / s.', 'Multipliziere beide Seiten mit s: D · s = F.'],
    wrong: 'Noch nicht richtig. Nutze <b>D</b> und <b>s</b> mit einem Malzeichen.',
    ok: '<b>Genau!</b> <i>F</i> = <i>D</i> · <i>s</i> – das ist das <b>Hookesche Gesetz</b> (Robert Hooke, 1678).' },
  { id: 's1-q5', type: 'num', tag: 'Anwenden', text: 'Mit welcher Kraft musst du an unserer Feder (<i>D</i> = 0,1 N/cm) ziehen, damit sie sich um <b>12 cm</b> dehnt?',
    answer: 1.2, unit: 'N', hints: ['Nutze F = D · s.', 'F = 0,1 N/cm · 12 cm'],
    special: { '120': 'Achte auf die Einheiten: 0,1 N/cm · 12 cm. Das ergibt keine 120.', '0.12': 'Fast – das Komma ist verrutscht. 0,1 · 12 = ?' },
    solution: 'F = D · s = 0,1 N/cm · 12 cm = <b>1,2 N</b> (die cm kürzen sich weg).',
    ok: '<i>F</i> = 0,1 N/cm · 12 cm = <b>1,2 N</b>. Das entspricht etwa 120 g.' },
  { id: 's1-q6', type: 'mc', tag: 'Diagramme lesen', text: 'Das Diagramm zeigt Messungen an <b>zwei verschiedenen Federn</b>. Welche Feder ist <b>härter</b> (größere Federkonstante <i>D</i>)?', fig: springCompareFig,
    options: [
      { t: 'Die rote Feder (steilere Gerade)', fb: '<b>Vorsicht!</b> Steil heißt hier: viel Ausdehnung pro Newton. Die Feder gibt also leicht nach – sie ist <b>weich</b>.' },
      { t: 'Die blaue Feder (flachere Gerade)', ok: true },
      { t: 'Beide sind gleich hart', fb: 'Dann müssten beide Geraden gleich steil sein.' },
      { t: 'Das kann man nicht ablesen', fb: 'Doch – lies ab, wie weit sich jede Feder z. B. bei 1 N dehnt.' }
    ],
    ok: '<b>Richtig!</b> Blau: 20 cm bei 2 N → 10 cm/N → <i>D</i> = 0,1 N/cm. Rot: 40 cm schon bei 1 N → <i>D</i> = 0,025 N/cm. Im <i>s-F</i>-Diagramm gilt: <b>je flacher die Gerade, desto härter die Feder</b>.' },
  { id: 's1-q7', type: 'mc', tag: 'Grenzen des Gesetzes', text: 'Du hängst immer mehr Gewichte an eine Feder. Was passiert irgendwann?',
    options: [
      { t: 'Sie dehnt sich unbegrenzt weiter, immer proportional.', fb: 'Leider nein – jede Feder hat eine Grenze. Denk an eine ausgeleierte Kugelschreiber-Feder.' },
      { t: 'Ab der Elastizitätsgrenze bleibt sie dauerhaft verformt – dann gilt das Hookesche Gesetz nicht mehr.', ok: true },
      { t: 'Sie wird automatisch härter und dehnt sich gar nicht mehr.', fb: 'Nein. Überlastet man eine Feder, wird sie eher <b>überdehnt</b> und kehrt nicht mehr in ihre Form zurück.' }
    ],
    ok: '<b>Genau.</b> Das Hookesche Gesetz gilt nur im <b>elastischen Bereich</b>. Überdehnte Federn bleiben lang gezogen – deshalb haben Kraftmesser einen Anschlag.' }
];

/* ---------- Fragen Station 2 ---------- */
const QUESTIONS_2 = (api) => [
  { id: 's2-q1', type: 'mc', text: 'Welche Art von Funktion liegt vor, wenn man die <b>Gesamtlänge</b> <i>L</i> gegen die Kraft <i>F</i> aufträgt?',
    options: [
      { t: 'Proportional (Ursprungsgerade)', fb: '<b>Nicht richtig.</b> Eine Ursprungsgerade geht durch (0|0). Wo schneidet deine Gerade die L-Achse?' },
      { t: 'Linear, aber nicht proportional (mit y-Achsenabschnitt)', ok: true },
      { t: 'Antiproportional', fb: 'Dann würde <i>L</i> kleiner, wenn <i>F</i> größer wird. Das Gegenteil ist der Fall.' }
    ],
    ok: '<b>Richtig!</b> Der Graph ist eine Gerade, schneidet die L-Achse aber nicht bei 0. Es ist eine <b>lineare Funktion mit y-Achsenabschnitt</b>.' },
  { id: 's2-q2', type: 'mc', text: 'Der rote Punkt markiert den <b>y-Achsenabschnitt</b> (bei <i>F</i> = 0 N). Welche physikalische Bedeutung hat er?',
    options: [
      { t: 'Die Federhärte D', fb: 'Die Federhärte steckt in der <b>Steigung</b>, nicht im Achsenabschnitt.' },
      { t: 'Die Ausgangslänge der Feder ohne Last: L₀ = 10 cm', ok: true },
      { t: 'Die maximale Belastungsgrenze', fb: 'Bei <i>F</i> = 0 N hängt ja noch gar keine Last daran.' }
    ],
    ok: '<b>Hervorragend!</b> Auch ohne Kraft hat die Feder eine Länge: <i>L</i><sub>0</sub> = 10 cm. In der Tabelle siehst du jetzt zusätzlich <i>s</i> = <i>L</i> − <i>L</i><sub>0</sub> – genau die Werte aus Station 1!',
    onSolved: () => api.renderTable() },
  { id: 's2-q3', type: 'mc', text: 'Die Gesamtlänge setzt sich aus <i>L</i><sub>0</sub> und der Ausdehnung <i>s</i> = <i>F</i>/<i>D</i> zusammen. Welche Funktionsgleichung ist richtig?',
    options: [
      { t: 'L(F) = D · F + L₀', fb: 'Teste mit Zahlen: D · F = 0,1 N/cm · 1 N = 0,1 – das wäre viel zu wenig Dehnung. Die Steigung ist 10 cm/N = 1/D.' },
      { t: 'L(F) = (1/D) · F + L₀', ok: true },
      { t: 'L(F) = D/F + L₀', fb: 'Dann würde die Feder bei mehr Kraft <b>kürzer</b> werden!' },
      { t: 'L(F) = (1/D) · F', fb: 'Hier fehlt die Ausgangslänge – bei F = 0 wäre die Feder 0 cm lang.' }
    ],
    ok: '<b>Super!</b> <i>L</i>(<i>F</i>) = (1/<i>D</i>) · <i>F</i> + <i>L</i><sub>0</sub>. Steigung 1/<i>D</i> = 10 cm/N, y-Achsenabschnitt <i>L</i><sub>0</sub> = 10 cm.' },
  { id: 's2-q4', type: 'mc', text: 'In beiden Experimenten (Ausdehnung <i>s</i> und Gesamtlänge <i>L</i>) beträgt die Steigung genau <b>10,0 cm/N</b>. Warum? <div class="sub">Tipp: Blende im Diagramm die Gerade aus Station 1 ein.</div>',
    options: [
      { t: 'Reiner Zufall, weil wir die gleichen 50-g-Stücke verwendet haben.', fb: 'Die Gewichtsstücke bestimmen nur, welche Punkte gemessen werden – nicht die Steigung.' },
      { t: 'Es ist dieselbe Feder mit demselben Dehnungsverhalten. L₀ verschiebt die Gerade nur parallel nach oben.', ok: true },
      { t: 'Weil die Ausgangslänge L₀ die Feder dehnbarer macht.', fb: 'Hat sich die Feder im zweiten Experiment verändert? Nein – es ist dieselbe Feder.' }
    ],
    ok: '<b>Perfekte Begründung!</b> Die Feder dehnt sich pro Newton immer um 10 cm, egal wie lang sie anfangs war. <i>L</i><sub>0</sub> bewirkt nur eine <b>Parallelverschiebung</b> des Graphen.' },
  { id: 's2-q5', type: 'num', tag: 'Anwenden', text: 'Eine andere Feder ist ohne Last <b>8 cm</b> lang. Mit <b>2 N</b> belastet ist sie <b>18 cm</b> lang. Berechne ihre Federkonstante <i>D</i>.',
    answer: 0.2, unit: 'N/cm', hints: ['Berechne zuerst die Ausdehnung: s = L − L₀.', 's = 18 cm − 8 cm = 10 cm. Jetzt D = F / s.'],
    special: { '0.111': 'Du hast mit der Gesamtlänge (18 cm) gerechnet. Das Hookesche Gesetz braucht aber die <b>Ausdehnung</b> s.', '0.11': 'Du hast mit der Gesamtlänge (18 cm) gerechnet. Das Hookesche Gesetz braucht aber die <b>Ausdehnung</b> s.', '5': 'Das ist s/F = 5 cm/N. Gesucht ist D = F/s.' },
    solution: 's = L − L₀ = 18 cm − 8 cm = 10 cm. D = F / s = 2 N / 10 cm = <b>0,2 N/cm</b>.',
    ok: '<i>s</i> = 10 cm, also <i>D</i> = 2 N / 10 cm = <b>0,2 N/cm</b>. Diese Feder ist doppelt so hart wie unsere.' },
  { id: 's2-q6', type: 'mc', tag: 'Fehler finden', text: 'Lea rechnet bei der Feder aus Aufgabe 5: <i>D</i> = <i>F</i> / <i>L</i> = 2 N / 18 cm ≈ 0,11 N/cm. Was hat sie falsch gemacht?',
    options: [
      { t: 'Sie hat die Gesamtlänge L statt der Ausdehnung s verwendet.', ok: true },
      { t: 'Sie hätte F · L rechnen müssen.', fb: 'Nein, D = F/s ist richtig als Quotient. Das Problem liegt bei der Länge.' },
      { t: 'Nichts – ihre Rechnung ist richtig.', fb: 'Vergleiche mit deinem Ergebnis aus Aufgabe 5.' }
    ],
    ok: '<b>Richtig erkannt!</b> Das Hookesche Gesetz verknüpft <i>F</i> mit der <b>Längenänderung</b> <i>s</i>, nicht mit der Gesamtlänge <i>L</i>.' }
];

/* =========================================================
   STATION 3: einseitiger Hebel
   ========================================================= */
function makeForceMeter() {
  const g = new THREE.Group();
  const eye = mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 20), MAT.steel); eye.position.y = 0.6; g.add(eye);
  const scaleTex = canvasTexture(64, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, w, h);
    for (let N = 0; N <= 6.001; N += 0.5) {
      const hh = 1 + N * 2.4; const y = (16 - hh) / 16 * h;
      const big = Math.abs(N - Math.round(N)) < 1e-6;
      ctx.fillStyle = big ? '#b91c1c' : '#334155'; ctx.fillRect(0, y - (big ? 2 : 1), w, big ? 4 : 2);
      if (big) { ctx.font = 'bold 22px Helvetica, Arial'; ctx.fillStyle = '#0f172a'; ctx.fillText(String(Math.round(N)), 22, y - 6); }
    }
  });
  const inner = mesh(new THREE.CylinderGeometry(0.5, 0.5, 16, 16), new THREE.MeshStandardMaterial({ map: scaleTex, roughness: 0.5 }));
  inner.position.y = 1.2 + 8; g.add(inner);
  const tube = new THREE.Group(); g.add(tube);
  const glass = mesh(new THREE.CylinderGeometry(1.15, 1.15, 20, 24, 1, true), MAT.glass, false); glass.position.y = 10; tube.add(glass);
  const capB = mesh(new THREE.TorusGeometry(1.15, 0.28, 8, 24), MAT.plasticR); capB.rotation.x = Math.PI / 2; tube.add(capB);
  const capT = cyl(1.3, 1.3, 1.4, MAT.plasticR); capT.position.y = 20.4; tube.add(capT);
  const sp = mesh(springGeometry(12, 16, 0.75, 0.1, 0.5), MAT.steel, false); sp.position.y = 20; tube.add(sp);
  const topEye = mesh(new THREE.TorusGeometry(0.7, 0.18, 8, 20), MAT.steel); topEye.position.y = 21.8; tube.add(topEye);
  const grip = cyl(0.7, 0.7, 7, MAT.plasticB); grip.rotation.z = Math.PI / 2; grip.position.y = 23; tube.add(grip);
  g.userData.set = (F) => { tube.position.y = 1.2 + 1 + clamp(F, 0, 6.2) * 2.4; };
  g.userData.top = () => tube.position.y + 23;
  return g;
}

function LeverOne() {
  const st = { stage: null, th: 0, w: 0, q: null };
  const P = V3(-48, 46, 0);
  let beam, riderL, riderZ, loadHang, loadString, fm, arrL, arrZ, labL, labZ, dimL, dimZ;
  const vals = () => ({ fl: rangeVal('s3-fl'), al: rangeVal('s3-al'), az: rangeVal('s3-az'), fz: rangeVal('s3-fz') });
  const balanced = (v) => Math.abs(v.fz * v.az - v.fl * v.al) <= Math.max(0.6, 0.02 * v.fl * v.al) + 1e-9;
  function build() {
    const stage = st.stage = new Stage('stage3', { id: 3, target: V3(10, 44, 0), radius: 142, theta: 0.2, phi: 1.36, shadow: 80, floorColor: 0xd8c4a6 });
    const sc = stage.scene;
    const base = box(26, 2.4, 22, MAT.dark); base.position.set(P.x, 1.2, 0); sc.add(base);
    const col = box(3.4, P.y, 3.4, MAT.steel); col.position.set(P.x, P.y / 2, -3.4); sc.add(col);
    sc.add(rod(V3(P.x, P.y, -5.5), V3(P.x, P.y, 1.8), 0.7, MAT.chrome));
    const pv = makePivot(1.2, true, 3.6); pv.position.set(P.x, P.y, 2.2); pv.userData.label.position.set(-2, -7, 0); sc.add(pv);
    beam = new THREE.Group(); beam.position.copy(P); sc.add(beam);
    const tex = beamTexture(-4, 106, (v) => v >= 0 ? String(v) : '');
    const alu = mat(0xcbd5e1, { metalness: 0.6, roughness: 0.35 });
    const bm = mesh(new THREE.BoxGeometry(110, 3, 1.6), [alu, alu, alu, alu, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.3, roughness: 0.45 }), alu]);
    bm.position.x = 51; beam.add(bm);
    riderL = new THREE.Group(); riderL.add(box(2.2, 4.0, 2.6, MAT.dark)); const rl = mesh(new THREE.TorusGeometry(0.6, 0.16, 8, 16), MAT.steel); rl.position.y = -2.6; riderL.add(rl); beam.add(riderL);
    riderZ = new THREE.Group(); riderZ.add(box(2.2, 4.0, 2.6, MAT.plasticB)); const rz = mesh(new THREE.TorusGeometry(0.6, 0.16, 8, 16), MAT.steel); rz.position.y = 2.6; riderZ.add(rz); beam.add(riderZ);
    loadHang = makeHanger({ r: 3.2, h: 1.3, maxDiscs: 10, rodLen: 14.5 }); sc.add(loadHang);
    loadString = rod(V3(), V3(0, 1, 0), 0.08, MAT.black); sc.add(loadString);
    fm = makeForceMeter(); fm.scale.setScalar(1.4); sc.add(fm);
    arrL = makeArrow(0xf97316, 0.55); arrZ = makeArrow(0x3b82f6, 0.55); sc.add(arrL, arrZ);
    labL = makeLabel('', { color: '#c2410c', size: 4, border: '#fdba74' }); labZ = makeLabel('', { color: '#1d4ed8', size: 4, border: '#93c5fd' }); sc.add(labL, labZ);
    dimL = makeDim('#ea580c', 3.4); dimL.position.set(0, -5.5, 1.4); beam.add(dimL);
    dimZ = makeDim('#2563eb', 3.4); dimZ.position.set(0, 5.2, 1.4); beam.add(dimZ);
    stage.onUpdate(tick);
  }
  function tick(dt) {
    const v = vals();
    const Ml = v.fl * v.al, Mz = v.fz * v.az;
    const target = balanced(v) ? 0 : clamp((Mz - Ml) * 0.0022, -0.17, 0.17);
    st.w += (45 * (target - st.th) - 7.5 * st.w) * dt; st.th += st.w * dt;
    $('s3-bub').style.left = 'calc(50% - 11px + ' + (st.th / 0.17 * 40).toFixed(1) + 'px)';
    if (!beam) return;
    beam.rotation.z = st.th;
    riderL.position.x = v.al; riderZ.position.x = v.az;
    beam.updateMatrixWorld();
    const pL = beam.localToWorld(V3(v.al, -3.2, 0));
    const hangTop = pL.clone().add(V3(0, -5, 0));
    setRod(loadString, pL, hangTop.clone().add(V3(0, -0.1, 0)));
    loadHang.position.copy(hangTop); loadHang.userData.setCount(Math.round(v.fl / 0.5));
    const pZ = beam.localToWorld(V3(v.az, 3.2, 0));
    fm.position.copy(pZ); fm.userData.set(v.fz);
    arrL.userData.set(pL.clone().add(V3(0, -1, 3.4)), V3(0, -1, 0), v.fl * 5);
    arrZ.userData.set(pZ.clone().add(V3(0, 1, 3.4)), V3(0, 1, 0), v.fz * 5);
    labL.position.copy(pL).add(V3(-11, -12, 3.4));
    labZ.position.copy(pZ).add(V3(12, 13, 3.4));
    dimL.userData.set(0, v.al, 'a_{L} = ' + v.al + ' cm', 3.2);
    dimZ.userData.set(0, v.az, 'a_{Z} = ' + v.az + ' cm', -3.2);
  }
  function ui() {
    const v = vals();
    $('s3-flv').textContent = fmt(v.fl, 1) + ' N'; $('s3-alv').textContent = v.al + ' cm'; $('s3-azv').textContent = v.az + ' cm'; $('s3-fzv').textContent = fmt(v.fz, 2) + ' N';
    if (labL) { labL.userData.set('F_{L} = ' + fmt(v.fl, 1) + ' N'); labZ.userData.set('F_{Z} = ' + fmt(v.fz, 2) + ' N'); }
    const bal = balanced(v);
    $('s3-level').classList.toggle('bal', bal);
    const b = $('s3-save');
    if (!b.dataset.flash) { b.disabled = !bal; b.className = 'btn block' + (bal ? ' success' : ''); b.textContent = bal ? '✅ Gleichgewicht! Messwert speichern' : 'Hebel ausbalancieren zum Speichern'; }
    const Ml = v.fl * v.al, Mz = v.fz * v.az, mx = Math.max(Ml, Mz, 1);
    $('s3-tql').style.width = (Ml / mx * 100) + '%'; $('s3-tqz').style.width = (Mz / mx * 100) + '%';
    $('s3-tqlv').textContent = fmtAuto(Math.round(Ml * 10) / 10); $('s3-tqzv').textContent = fmtAuto(Math.round(Mz * 10) / 10);
  }
  function flash(msg) { const b = $('s3-save'); b.dataset.flash = '1'; b.textContent = msg; b.disabled = true; setTimeout(() => { delete b.dataset.flash; ui(); }, 1500); }
  function record() {
    const v = vals(); if (!balanced(v)) return;
    if (S.l1.some((m) => m.fl === v.fl && m.al === v.al && m.az === v.az)) { flash('Diese Messung hast du schon ✓'); return; }
    S.l1.push(v); save(); renderTable(true); flash('Gespeichert ✓'); checkUnlock();
  }
  function renderTable(isNew) {
    const tb = $('s3-tbody'); const calc = !!S.done['s3-q1'];
    document.querySelectorAll('.s3-calc').forEach((x) => x.classList.toggle('hidden', !calc));
    $('s3-tq').classList.toggle('hidden', !calc);
    if (!S.l1.length) { tb.innerHTML = '<tr class="empty"><td colspan="8">Bringe den Hebel ins Gleichgewicht und speichere 3 unterschiedliche Messungen.</td></tr>'; return; }
    tb.innerHTML = '';
    S.l1.forEach((m, i) => {
      const tr = el('tr', isNew && i === S.l1.length - 1 ? 'new' : '');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + fmt(m.fl, 1) + ' N</td><td>' + m.al + ' cm</td><td style="color:var(--blue);font-weight:800">' + fmt(m.fz, 2) + ' N</td><td>' + m.az + ' cm</td>' +
        (calc ? '<td class="calc">' + fmtAuto(Math.round(m.fl * m.al * 10) / 10) + ' N·cm</td><td class="calc">' + fmtAuto(Math.round(m.fz * m.az * 10) / 10) + ' N·cm</td>' : '') + '<td><button class="del">✕</button></td>';
      tr.querySelector('.del').onclick = () => { S.l1.splice(i, 1); save(); renderTable(); };
      tb.appendChild(tr);
    });
  }
  function checkUnlock() {
    if (!(S.done['s3-unlocked'] || S.l1.length >= 3)) return;
    if (!S.done['s3-unlocked']) { S.done['s3-unlocked'] = true; save(); }
    $('s3-q').classList.remove('hidden');
    if (!st.q) st.q = QuestionList($('s3-q'), 'Entdecke den Zusammenhang', QUESTIONS_3(), { onComplete: () => { $('s3-merke').classList.remove('hidden'); markStationDone('tab3'); } });
  }
  function init() {
    fineButtons('s3-fz', 0.05);
    if (Engine.ok) build();
    ['s3-fl', 's3-al', 's3-az', 's3-fz'].forEach((id) => bindRange(id, ui));
    $('s3-save').onclick = record;
    ui(); renderTable(); checkUnlock();
    if (S.done.tab3) $('s3-merke').classList.remove('hidden');
  }
  return { init, get stage() { return st.stage; }, renderTable };
}
let LEVER1 = null, LEVER2 = null;
const QUESTIONS_3 = () => [
  { id: 's3-q1', type: 'formula', text: 'Super, du hast drei Gleichgewichte gefunden! Vergleiche die Zahlen. Multipliziere die Lastkraft <i>F</i><sub>L</sub> mit dem Lastarm <i>a</i><sub>L</sub>. Gib die Formel für diese „Drehwirkung der Last“ ein.',
    prefix: 'Drehwirkung =', accept: ['fl*al', 'al*fl', 'flal', 'alfl'], show: 'F_L · a_L',
    chips: [{ l: 'F<sub>L</sub>', v: 'FL' }, { l: 'a<sub>L</sub>', v: 'aL' }, { l: 'F<sub>Z</sub>', v: 'FZ' }, { l: 'a<sub>Z</sub>', v: 'aZ' }, { l: '·', v: '·', op: true }, { l: '/', v: '/', op: true }, { l: '+', v: '+', op: true }],
    special: { 'fz*az': 'Das ist die Drehwirkung der <b>Zugkraft</b>. Gesucht ist die der <b>Last</b>.', 'fl/al': 'Nicht teilen – <b>multiplizieren</b>!', 'fl+al': 'Nicht addieren – <b>multiplizieren</b>!' },
    wrong: 'Benutze <b>F<sub>L</sub></b> und <b>a<sub>L</sub></b> mit einem Malzeichen.',
    ok: '<b>Fantastisch!</b> Die Tabelle zeigt jetzt <i>F</i><sub>L</sub> · <i>a</i><sub>L</sub> und <i>F</i><sub>Z</sub> · <i>a</i><sub>Z</sub>. Oben im 3D-Fenster siehst du beide Drehwirkungen als Balken.',
    onSolved: () => LEVER1.renderTable() },
  { id: 's3-q2', type: 'mc', text: 'Was fällt dir an den beiden neuen Tabellenspalten auf?',
    options: [
      { t: 'Die Werte sind in jeder Zeile (fast) gleich groß.', ok: true },
      { t: 'Die Zug-Wirkung ist immer doppelt so groß.', fb: 'Schau genau hin – vergleiche Zeile für Zeile.' },
      { t: 'Die Werte haben nichts miteinander zu tun.', fb: 'Vergleiche die beiden grünen Spalten in jeder Zeile.' }
    ],
    ok: '<b>Richtig!</b> Im Gleichgewicht gilt: <b><i>F</i><sub>L</sub> · <i>a</i><sub>L</sub> = <i>F</i><sub>Z</sub> · <i>a</i><sub>Z</sub></b>. Kleine Abweichungen entstehen nur durch die Ablesegenauigkeit des Kraftmessers.' },
  { id: 's3-q3', type: 'mc', text: 'Die Last bleibt gleich. Du hängst den Kraftmesser <b>doppelt so weit</b> vom Drehpunkt weg. Wie ändert sich die nötige Zugkraft?',
    options: [
      { t: 'Sie verdoppelt sich.', fb: 'Probiere es im Simulator aus: a<sub>Z</sub> von 40 cm auf 80 cm.' },
      { t: 'Sie halbiert sich.', ok: true },
      { t: 'Sie bleibt gleich.', fb: 'Das Produkt F<sub>Z</sub> · a<sub>Z</sub> muss gleich bleiben. Wenn a<sub>Z</sub> doppelt so groß wird …' },
      { t: 'Sie wird ein Viertel.', fb: 'Das wäre bei vierfachem Kraftarm so.' }
    ],
    ok: '<b>Genau!</b> Doppelter Kraftarm → halbe Kraft. Kraft und Kraftarm sind <b>antiproportional</b>.' },
  { id: 's3-q4', type: 'num', tag: 'Rechnen', text: 'Ein Gewicht mit <b>4 N</b> hängt <b>30 cm</b> vom Drehpunkt entfernt. Du ziehst mit dem Kraftmesser bei <b>60 cm</b>. Welche Zugkraft hält den Hebel im Gleichgewicht?',
    answer: 2, unit: 'N', hints: ['F_L · a_L = F_Z · a_Z', '4 N · 30 cm = F_Z · 60 cm'], special: { '8': 'Das wäre richtig, wenn der Kraftarm <b>kürzer</b> wäre als der Lastarm. Hier ist er länger!' },
    solution: '4 N · 30 cm = 120 N·cm. F<sub>Z</sub> = 120 N·cm : 60 cm = <b>2 N</b>.',
    ok: '4 N · 30 cm = 120 N·cm = <i>F</i><sub>Z</sub> · 60 cm → <i>F</i><sub>Z</sub> = <b>2 N</b>. Probier es im Simulator aus!' },
  { id: 's3-q5', type: 'mc', tag: 'Goldene Regel der Mechanik', text: 'Mit einem langen Kraftarm sparst du Kraft. Was musst du dafür „bezahlen“?',
    options: [
      { t: 'Nichts – Kraftsparen ist gratis.', fb: 'Leider nicht. Denk daran, wie weit sich deine Hand bewegen muss, um die Last 1 cm anzuheben.' },
      { t: 'Deine Hand muss einen längeren Weg zurücklegen.', ok: true },
      { t: 'Der Hebel wird schwerer.', fb: 'Das Gewicht des Hebels ändert sich nicht.' }
    ],
    ok: '<b>Genau: Was man an Kraft spart, muss man an Weg zusetzen.</b> Ist der Kraftarm doppelt so lang wie der Lastarm, bewegt sich deine Hand doppelt so weit wie die Last.' }
];

/* =========================================================
   STATION 4: zweiseitiger Hebel
   ========================================================= */
function LeverTwo() {
  const st = { stage: null, th: 0, w: 0, q: null };
  const P = V3(0, 46, 0);
  let beam, rL, rR, hL, hR, sL, sR, arrL, arrR, labL, labR, dimL, dimR;
  const vals = () => ({ f1: rangeVal('s4-f1'), r1: rangeVal('s4-r1'), f2: rangeVal('s4-f2'), r2: rangeVal('s4-r2') });
  const balanced = (v) => Math.abs(v.f1 * v.r1 - v.f2 * v.r2) < 0.5;
  function build() {
    const stage = st.stage = new Stage('stage4', { id: 4, target: V3(0, 34, 0), radius: 132, theta: 0.18, phi: 1.36, shadow: 80, floorColor: 0xd8c4a6 });
    const sc = stage.scene;
    const base = box(30, 2.4, 22, MAT.dark); base.position.set(0, 1.2, -2); sc.add(base);
    const colm = cyl(1.6, 5, P.y, MAT.steel, 4); colm.rotation.y = Math.PI / 4; colm.position.set(0, P.y / 2, -3.2); sc.add(colm);
    sc.add(rod(V3(0, P.y, -5.5), V3(0, P.y, 1.8), 0.7, MAT.chrome));
    const pv = makePivot(1.2, true, 3.6); pv.position.set(0, P.y, 2.2); pv.userData.label.position.set(0, -15, 0); sc.add(pv);
    beam = new THREE.Group(); beam.position.copy(P); sc.add(beam);
    const tex = beamTexture(-58, 58, (v) => v === 0 ? '' : String(Math.abs(v)));
    const alu = mat(0xcbd5e1, { metalness: 0.6, roughness: 0.35 });
    const bm = mesh(new THREE.BoxGeometry(116, 3, 1.6), [alu, alu, alu, alu, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.3, roughness: 0.45 }), alu]);
    beam.add(bm);
    const rider = (m) => { const g = new THREE.Group(); g.add(box(2.2, 4, 2.6, m)); const r = mesh(new THREE.TorusGeometry(0.6, 0.16, 8, 16), MAT.steel); r.position.y = -2.6; g.add(r); beam.add(g); return g; };
    rL = rider(MAT.dark); rR = rider(MAT.dark);
    hL = makeHanger({ r: 3.2, h: 1.15, maxDiscs: 12, rodLen: 15, mat: MAT.weightO }); hR = makeHanger({ r: 3.2, h: 1.15, maxDiscs: 12, rodLen: 15, mat: MAT.weightC }); sc.add(hL, hR);
    sL = rod(V3(), V3(0, 1, 0), 0.08, MAT.black); sR = rod(V3(), V3(0, 1, 0), 0.08, MAT.black); sc.add(sL, sR);
    arrL = makeArrow(0xf97316, 0.55); arrR = makeArrow(0x06b6d4, 0.55); sc.add(arrL, arrR);
    labL = makeLabel('', { color: '#c2410c', size: 4, border: '#fdba74' }); labR = makeLabel('', { color: '#0e7490', size: 4, border: '#67e8f9' }); sc.add(labL, labR);
    dimL = makeDim('#ea580c', 3.4); dimL.position.set(0, -5.2, 1.4); beam.add(dimL);
    dimR = makeDim('#0891b2', 3.4); dimR.position.set(0, -5.2, 1.4); beam.add(dimR);
    stage.onUpdate(tick);
  }
  function tick(dt) {
    const v = vals();
    const M1 = v.f1 * v.r1, M2 = v.f2 * v.r2;
    const target = balanced(v) ? 0 : clamp((M1 - M2) * 0.0022, -0.2, 0.2);
    st.w += (45 * (target - st.th) - 7.5 * st.w) * dt; st.th += st.w * dt;
    $('s4-bub').style.left = 'calc(50% - 11px + ' + (st.th / 0.2 * 40).toFixed(1) + 'px)';
    if (!beam) return;
    beam.rotation.z = st.th;
    rL.position.x = -v.r1; rR.position.x = v.r2;
    beam.updateMatrixWorld();
    const pL = beam.localToWorld(V3(-v.r1, -3.2, 0)), pR = beam.localToWorld(V3(v.r2, -3.2, 0));
    const tL = pL.clone().add(V3(0, -4, 0)), tR = pR.clone().add(V3(0, -4, 0));
    setRod(sL, pL, tL); setRod(sR, pR, tR);
    hL.position.copy(tL); hR.position.copy(tR);
    hL.userData.setCount(Math.round(v.f1 / 0.5)); hR.userData.setCount(Math.round(v.f2 / 0.5));
    arrL.userData.set(pL.clone().add(V3(0, -1, 3.4)), V3(0, -1, 0), v.f1 * 5);
    arrR.userData.set(pR.clone().add(V3(0, -1, 3.4)), V3(0, -1, 0), v.f2 * 5);
    labL.position.copy(pL).add(V3(-12, -12, 3.4)); labR.position.copy(pR).add(V3(12, -12, 3.4));
    dimL.userData.set(-v.r1, 0, 'r_{1} = ' + v.r1 + ' cm', 3.2);
    dimR.userData.set(0, v.r2, 'r_{2} = ' + v.r2 + ' cm', 3.2);
  }
  function ui() {
    const v = vals();
    $('s4-f1v').textContent = fmt(v.f1, 1) + ' N'; $('s4-r1v').textContent = v.r1 + ' cm'; $('s4-f2v').textContent = fmt(v.f2, 1) + ' N'; $('s4-r2v').textContent = v.r2 + ' cm';
    if (labL) { labL.userData.set('F_{1} = ' + fmt(v.f1, 1) + ' N'); labR.userData.set('F_{2} = ' + fmt(v.f2, 1) + ' N'); }
    const bal = balanced(v);
    $('s4-level').classList.toggle('bal', bal);
    const b = $('s4-save');
    if (!b.dataset.flash) { b.disabled = !bal; b.className = 'btn block' + (bal ? ' success' : ''); b.textContent = bal ? '✅ Gleichgewicht! Messwert speichern' : 'Hebel ausbalancieren zum Speichern'; }
    const M1 = v.f1 * v.r1, M2 = v.f2 * v.r2, mx = Math.max(M1, M2, 1);
    $('s4-tql').style.width = (M1 / mx * 100) + '%'; $('s4-tqr').style.width = (M2 / mx * 100) + '%';
    $('s4-tqlv').textContent = fmtAuto(M1); $('s4-tqrv').textContent = fmtAuto(M2);
  }
  function flash(msg) { const b = $('s4-save'); b.dataset.flash = '1'; b.textContent = msg; b.disabled = true; setTimeout(() => { delete b.dataset.flash; ui(); }, 1500); }
  function record() {
    const v = vals(); if (!balanced(v)) return;
    if (S.l2.some((m) => m.f1 === v.f1 && m.r1 === v.r1 && m.f2 === v.f2 && m.r2 === v.r2)) { flash('Diese Messung hast du schon ✓'); return; }
    S.l2.push(v); save(); renderTable(true); flash('Gespeichert ✓'); checkUnlock();
  }
  function renderTable(isNew) {
    const tb = $('s4-tbody'); const calc = !!S.done['s4-q1'];
    document.querySelectorAll('.s4-calc').forEach((x) => x.classList.toggle('hidden', !calc));
    $('s4-tq').classList.toggle('hidden', !calc);
    $('s4-def').classList.toggle('hidden', !calc);
    if (!S.l2.length) { tb.innerHTML = '<tr class="empty"><td colspan="8">Bringe den Hebel in verschiedenen Positionen ins Gleichgewicht und speichere mindestens 3 Messungen.</td></tr>'; return; }
    tb.innerHTML = '';
    S.l2.forEach((m, i) => {
      const tr = el('tr', isNew && i === S.l2.length - 1 ? 'new' : '');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + fmt(m.f1, 1) + ' N</td><td>' + m.r1 + ' cm</td><td style="color:var(--cyan);font-weight:800">' + fmt(m.f2, 1) + ' N</td><td>' + m.r2 + ' cm</td>' +
        (calc ? '<td class="calc">' + fmtAuto(m.f1 * m.r1) + ' N·cm</td><td class="calc">' + fmtAuto(m.f2 * m.r2) + ' N·cm</td>' : '') + '<td><button class="del">✕</button></td>';
      tr.querySelector('.del').onclick = () => { S.l2.splice(i, 1); save(); renderTable(); };
      tb.appendChild(tr);
    });
  }
  function checkUnlock() {
    if (!(S.done['s4-unlocked'] || S.l2.length >= 3)) return;
    if (!S.done['s4-unlocked']) { S.done['s4-unlocked'] = true; save(); }
    $('s4-q').classList.remove('hidden');
    if (!st.q) st.q = QuestionList($('s4-q'), 'Was fällt dir an den Zahlen auf?', QUESTIONS_4(), { onComplete: () => { $('s4-merke').classList.remove('hidden'); markStationDone('tab4'); } });
  }
  function init() {
    if (Engine.ok) build();
    ['s4-f1', 's4-r1', 's4-f2', 's4-r2'].forEach((id) => bindRange(id, ui));
    $('s4-save').onclick = record;
    ui(); renderTable(); checkUnlock();
    if (S.done.tab4) $('s4-merke').classList.remove('hidden');
  }
  return { init, get stage() { return st.stage; }, renderTable };
}
const QUESTIONS_4 = () => [
  { id: 's4-q1', type: 'formula', text: 'Schau dir die Werte links (<i>F</i><sub>1</sub>, <i>r</i><sub>1</sub>) und rechts (<i>F</i><sub>2</sub>, <i>r</i><sub>2</sub>) an. Welche Rechnung liefert auf beiden Seiten denselben Wert? Gib die Formel für die <b>linke</b> Seite ein.',
    prefix: 'Wirkung links =', accept: ['f1*r1', 'r1*f1', 'f1r1', 'r1f1'], show: 'F_1 · r_1',
    chips: [{ l: 'F<sub>1</sub>', v: 'F1' }, { l: 'r<sub>1</sub>', v: 'r1' }, { l: 'F<sub>2</sub>', v: 'F2' }, { l: 'r<sub>2</sub>', v: 'r2' }, { l: '·', v: '·', op: true }, { l: '/', v: '/', op: true }, { l: '+', v: '+', op: true }],
    special: { 'f2*r2': 'Das ist die <b>rechte</b> Seite. Gefragt ist die linke.', 'f1/r1': 'Teste mit deinen Zahlen: Ist F<sub>1</sub>/r<sub>1</sub> links und rechts gleich? Versuche es mit <b>Multiplizieren</b>.', 'f1+r1': 'Newton und Zentimeter kann man nicht addieren. Versuche es mit <b>Multiplizieren</b>.' },
    wrong: 'Benutze <b>F<sub>1</sub></b> und <b>r<sub>1</sub></b> mit einem Malzeichen.',
    ok: '<b>Hervorragend erkannt!</b> Kraft mal Hebelarm ist links und rechts gleich. Unten erfährst du, wie diese Größe heißt.',
    onSolved: (restore) => { LEVER2.renderTable(); if (!restore) setTimeout(() => $('s4-def').scrollIntoView({ behavior: 'smooth', block: 'center' }), 400); } },
  { id: 's4-q2', type: 'num', tag: 'Rechnen', text: 'Links hängen <b>4 N</b> im Abstand <b>30 cm</b>. Rechts willst du <b>6 N</b> anhängen. In welchem Abstand vom Drehpunkt muss das Gewicht hängen?',
    answer: 20, unit: 'cm', hints: ['M_links = M_rechts', '4 N · 30 cm = 6 N · r₂'], special: { '45': 'Dann wäre das rechte Drehmoment 6 N · 45 cm = 270 N·cm – zu groß. Die schwerere Kraft braucht den <b>kürzeren</b> Arm.' },
    solution: 'M<sub>links</sub> = 4 N · 30 cm = 120 N·cm. r<sub>2</sub> = 120 N·cm : 6 N = <b>20 cm</b>.',
    ok: '4 N · 30 cm = 120 N·cm = 6 N · <i>r</i><sub>2</sub> → <i>r</i><sub>2</sub> = <b>20 cm</b>. Die größere Kraft braucht den kürzeren Arm.' },
  { id: 's4-q3', type: 'mc', text: 'Ein Hebel ist im Gleichgewicht. Nun werden <b>beide Kräfte verdoppelt</b> (die Abstände bleiben gleich). Was passiert?',
    options: [
      { t: 'Der Hebel bleibt im Gleichgewicht.', ok: true },
      { t: 'Er kippt nach links.', fb: 'Beide Drehmomente ändern sich auf die gleiche Weise …' },
      { t: 'Er kippt nach rechts.', fb: 'Beide Drehmomente ändern sich auf die gleiche Weise …' }
    ],
    ok: '<b>Richtig!</b> Beide Drehmomente verdoppeln sich – sie bleiben also gleich groß. Probiere es mit den Reglern aus!' },
  { id: 's4-q4', type: 'mc', text: 'Du willst mit <b>möglichst wenig Kraft</b> ein großes Drehmoment erzeugen. Wo setzt du an?',
    options: [
      { t: 'Direkt am Drehpunkt', fb: 'Am Drehpunkt ist der Hebelarm 0 – dann ist auch das Drehmoment 0, egal wie stark du drückst!' },
      { t: 'In der Mitte des Hebels', fb: 'Das geht, aber es gibt eine bessere Stelle.' },
      { t: 'So weit wie möglich vom Drehpunkt entfernt', ok: true }
    ],
    ok: '<b>Genau!</b> M = F · r: Je größer der Hebelarm r, desto kleiner darf F sein.' },
  { id: 's4-q5', type: 'num', tag: 'Einheiten', text: 'In der Technik gibt man Drehmomente in <b>Newtonmeter (N·m)</b> an. Rechne um: <b>150 N·cm</b> sind wie viel N·m?',
    answer: 1.5, unit: 'N·m', hints: ['1 m = 100 cm', 'Also: 1 N·m = 100 N·cm'], special: { '15000': 'Andersherum: N·m ist die <b>größere</b> Einheit, die Zahl wird also kleiner.' },
    solution: '1 N·m = 100 N·cm → 150 N·cm = 150 : 100 N·m = <b>1,5 N·m</b>.',
    ok: '150 N·cm = <b>1,5 N·m</b> (durch 100 teilen, weil 1 m = 100 cm).' }
];
