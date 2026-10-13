/* =========================================================
   STATION 5: Alltags-Check – 3D-Modelle
   Jedes Modell baut in natürlichen Einheiten (meist cm), Boden bei y = 0.
   Rückgabe: { size, center, update(t, dt), setSolved(bool), theta?, phi?, zoom? }
   ========================================================= */
const C = { force: 0x3b82f6, load: 0xf97316, forceTxt: '#1d4ed8', forceB: '#93c5fd', loadTxt: '#c2410c', loadB: '#fdba74' };
const labF = (t, s) => makeLabel(t, { color: C.forceTxt, border: C.forceB, size: s });
const labO = (t, s) => makeLabel(t, { color: C.loadTxt, border: C.loadB, size: s });
const labN = (t, s) => makeLabel(t, { color: '#334155', size: s });
function toG(g, o, v) { g.updateMatrixWorld(true); return g.worldToLocal(o.localToWorld(v)); }

/* ---- Scherenartiges Werkzeug (zweiseitiger Hebel): Astschere, Beißzange ---- */
function modelCross(g, p) {
  const s = p.size * 0.057, ar = p.size * 0.008;
  const root = new THREE.Group(); root.position.y = p.y; g.add(root);
  const A = new THREE.Group(), B = new THREE.Group(); root.add(A, B);
  const piece = (grp, z) => {
    grp.add(rod(V3(p.hub * 0.8, 0, z), V3(p.b * 0.45, 0, z), p.hr, MAT.steel));
    grp.add(rod(V3(p.b * 0.45, 0, z), V3(p.b + p.hr, 0, z), p.hr * 1.7, p.grip));
    const jaw = p.style === 'blade' ? box(p.jaw, p.bw, p.bt, MAT.chrome) : box(p.jaw, p.bw, p.bt, MAT.dark);
    jaw.position.set(-p.jaw / 2 + p.hub * 0.3, 0, z); grp.add(jaw);
    if (p.style !== 'blade') { const tip = sph(p.bw * 0.55, MAT.dark); tip.position.set(-p.jaw + p.hub * 0.3, 0, z); grp.add(tip); }
    const hub = cyl(p.hub, p.hub, p.bt, MAT.steel); hub.rotation.x = Math.PI / 2; hub.position.z = z; grp.add(hub);
  };
  piece(A, p.bt / 2 + 0.03); piece(B, -p.bt / 2 - 0.03);
  const bolt = cyl(p.hub * 0.45, p.hub * 0.45, p.bt * 2.6, MAT.chrome); bolt.rotation.x = Math.PI / 2; root.add(bolt);
  const pv = makePivot(p.hub * 0.55, true, s); pv.position.z = p.bt * 1.4; pv.userData.label.position.set(0, -p.hub * 3.2, 0); root.add(pv);
  const obj = p.obj === 'branch'
    ? mesh(new THREE.CylinderGeometry(p.objR, p.objR * 1.1, p.bt * 14, 18), MAT.woodD)
    : mesh(new THREE.CylinderGeometry(p.objR, p.objR, p.bt * 12, 10), mat(0xb87333, { metalness: 0.9, roughness: 0.3 }));
  obj.rotation.x = Math.PI / 2; obj.position.x = -p.a; root.add(obj);
  const aH1 = makeArrow(C.force, ar), aH2 = makeArrow(C.force, ar), aL1 = makeArrow(C.load, ar), aL2 = makeArrow(C.load, ar);
  root.add(aH1, aH2, aL1, aL2);
  const lH = labF('', s), lL = labO(p.loadText, s); root.add(lH, lL);
  const d1 = makeDim('#ea580c', s * 0.9), d2 = makeDim('#2563eb', s * 0.9);
  d1.position.set(0, -p.b * 0.3, p.bt); d2.position.set(0, -p.b * 0.3 - s * 2.2, p.bt); root.add(d1, d2);
  d1.userData.set(-p.a, 0, p.a + ' cm', s * 0.9); d2.userData.set(0, p.b, p.b + ' cm', -s * 0.9);
  const amin = Math.atan((p.objR + p.bw / 2) / p.a), amax = amin + p.open;
  let solved = false;
  return {
    size: p.size, center: V3(p.b * 0.3, p.y + p.b * 0.08, 0), zoom: 1.08,
    setSolved(v) { solved = v; lH.userData.set(v ? p.handText : 'F_{Hand} = ?'); },
    update(t) {
      const a = amin + (amax - amin) * (0.5 + 0.5 * Math.cos(t * 1.7));
      A.rotation.z = a; B.rotation.z = -a;
      const eA = V3(p.b * Math.cos(a), p.b * Math.sin(a), p.bt * 2), eB = V3(p.b * Math.cos(a), -p.b * Math.sin(a), p.bt * 2);
      const dA = V3(Math.sin(a), -Math.cos(a), 0), dB = V3(Math.sin(a), Math.cos(a), 0);
      const L = p.size * 0.16;
      aH1.userData.set(eA.clone().addScaledVector(dA, -L), dA, L * 0.92);
      aH2.userData.set(eB.clone().addScaledVector(dB, -L), dB, L * 0.92);
      const lenL = p.size * 0.12;
      aL1.userData.set(V3(-p.a, p.objR + lenL + 0.2, p.bt * 2), V3(0, -1, 0), lenL);
      aL2.userData.set(V3(-p.a, -p.objR - lenL - 0.2, p.bt * 2), V3(0, 1, 0), lenL);
      lH.position.copy(eA).add(V3(0, L + s, 0));
      lL.position.set(-p.a - s * 2, p.objR + lenL + s * 1.2, p.bt * 2);
    }
  };
}

/* ---- Nussknacker / Pinzette: zwei Schenkel mit Gelenk am Ende (einseitig) ---- */
function modelHinge(g, p) {
  const s = p.size * 0.057, ar = p.size * 0.008;
  const root = new THREE.Group(); root.position.y = p.y; g.add(root);
  const A = new THREE.Group(), B = new THREE.Group(); root.add(A, B);
  const arm = (grp, sign) => {
    const b = box(p.len, p.th, p.w, p.mat); b.position.set(p.len / 2, sign * p.th / 2, 0); grp.add(b);
    if (p.ridges) for (let i = -1; i <= 1; i++) { const r = box(p.th * 0.6, p.th * 0.8, p.w * 0.9, MAT.dark); r.position.set(p.fx + i * p.th * 1.6, sign * (p.th + p.th * 0.35), 0); grp.add(r); }
    if (p.grips) { const gr = box(p.len * 0.45, p.th * 1.8, p.w * 1.15, p.grips); gr.position.set(p.len * 0.74, sign * p.th / 2, 0); grp.add(gr); }
  };
  arm(A, 1); arm(B, -1);
  const hinge = cyl(p.w * 0.45, p.w * 0.45, p.w * 1.6, MAT.chrome); hinge.rotation.x = Math.PI / 2; root.add(hinge);
  if (p.joint) { const j = box(p.th * 4, p.th * 3, p.w, p.mat); j.position.x = -p.th; root.add(j); }
  const pv = makePivot(p.w * 0.3, true, s); pv.position.z = p.w; pv.userData.label.position.set(-s * 0.5, -s * 1.6, 0); root.add(pv);
  const obj = p.obj(); obj.position.x = p.ox; root.add(obj);
  const aF1 = makeArrow(C.force, ar), aF2 = makeArrow(C.force, ar), aO1 = makeArrow(C.load, ar), aO2 = makeArrow(C.load, ar); root.add(aF1, aF2, aO1, aO2);
  const lF = labF(p.forceText, s), lO = labO('', s); root.add(lF, lO);
  const d1 = makeDim('#ea580c', s * 0.9), d2 = makeDim('#2563eb', s * 0.9);
  const dNear = p.ox < p.fx ? d1 : d2, dFar = p.ox < p.fx ? d2 : d1;
  dNear.position.set(0, -p.dimY, p.w); dFar.position.set(0, -p.dimY - s * 2.3, p.w); root.add(d1, d2);
  d1.userData.set(0, p.ox, fmtAuto(p.ox) + ' cm', s * 0.9); d2.userData.set(0, p.fx, fmtAuto(p.fx) + ' cm', s * 0.9);
  const amin = Math.asin(clamp(p.objR / p.ox, 0, 0.9)), amax = amin + p.open;
  return {
    size: p.size, center: V3(p.len * 0.45, p.y, 0),
    setSolved(v) { lO.userData.set(v ? p.objTextSolved : p.objText); },
    update(t) {
      const a = amin + (amax - amin) * (0.5 + 0.5 * Math.cos(t * 1.8));
      A.rotation.z = a; B.rotation.z = -a;
      const L = p.size * 0.13;
      const fA = V3(p.fx * Math.cos(a), p.fx * Math.sin(a) + p.th * 1.2, p.w), fB = V3(p.fx * Math.cos(a), -p.fx * Math.sin(a) - p.th * 1.2, p.w);
      const dA = V3(Math.sin(a), -Math.cos(a), 0), dB = V3(Math.sin(a), Math.cos(a), 0);
      aF1.userData.set(fA.clone().addScaledVector(dA, -L), dA, L * 0.92);
      aF2.userData.set(fB.clone().addScaledVector(dB, -L), dB, L * 0.92);
      const L2 = p.size * 0.1;
      aO1.userData.set(V3(p.ox, p.objR + L2 + p.th, p.w), V3(0, -1, 0), L2);
      aO2.userData.set(V3(p.ox, -p.objR - L2 - p.th, p.w), V3(0, 1, 0), L2);
      lF.position.copy(fA).add(V3(s * 1.5, L + s * 0.8, 0));
      lO.position.set(p.ox, p.objR + L2 + p.th + s * 1.5 + (p.objLabelUp || 0), p.w);
      if (p.squash) obj.scale.y = 1 - 0.08 * (0.5 - 0.5 * Math.cos(t * 1.8));
    }
  };
}

/* ---- Wippe ---- */
function modelSeesaw(g) {
  const s = 27, ar = 3.4;
  const P = V3(0, 55, 0);
  const st = new THREE.Group(); g.add(st);
  const stand = cyl(5, 22, 52, MAT.plasticR, 4); stand.rotation.y = Math.PI / 4; stand.scale.z = 1.4; stand.position.set(0, 26, 0); st.add(stand);
  const axle = cyl(3, 3, 48, MAT.steel); axle.rotation.x = Math.PI / 2; axle.position.copy(P); st.add(axle);
  const pv = makePivot(4, true, s); pv.position.set(0, P.y, 26); pv.userData.label.position.set(0, -14, 0); st.add(pv);
  const plank = new THREE.Group(); plank.position.copy(P); g.add(plank);
  const board = box(430, 6, 34, MAT.wood); board.position.y = 4; plank.add(board);
  [-200, 200].forEach((x) => { const h = rod(V3(x + (x > 0 ? -25 : 25), 7, -14), V3(x + (x > 0 ? -25 : 25), 30, -14), 1.6, MAT.plasticY); plank.add(h); });
  const person = (scale, shirt) => {
    const p = new THREE.Group();
    const body = mesh(new THREE.CapsuleGeometry(11 * scale, 26 * scale, 6, 14), shirt); body.position.y = 7 + 24 * scale; p.add(body);
    const head = sph(10 * scale, MAT.skin); head.position.y = 7 + 52 * scale; p.add(head);
    const hair = sph(10.4 * scale, MAT.black); hair.scale.y = 0.6; hair.position.y = 7 + 56 * scale; p.add(hair);
    const leg = mesh(new THREE.CapsuleGeometry(5 * scale, 26 * scale, 6, 10), mat(0x1e3a8a)); leg.rotation.z = Math.PI / 2; leg.position.set(16 * scale, 11 * scale + 6, 6 * scale); p.add(leg);
    const leg2 = leg.clone(); leg2.position.z = -6 * scale; p.add(leg2);
    return p;
  };
  const jonas = person(1.25, mat(0xfacc15)); jonas.position.x = -200; jonas.rotation.y = 0; plank.add(jonas);
  const dad = person(1.8, mat(0x2563eb)); dad.rotation.y = Math.PI; plank.add(dad);
  const aJ = makeArrow(C.load, ar), aD = makeArrow(C.force, ar); g.add(aJ, aD);
  const lJ = labO('Jonas: 300 N', s), lD = labF('Vater: 600 N', s); g.add(lJ, lD);
  const dJ = makeDim('#ea580c', s * 0.9), dD = makeDim('#2563eb', s * 0.9); dJ.position.set(0, -12, 20); dD.position.set(0, -12, 20); plank.add(dJ, dD);
  dJ.userData.set(-200, 0, '200 cm', 18);
  let solved = false, xD = 150, th = 0, w = 0;
  return {
    size: 470, center: V3(0, 90, 0), phi: 1.33, theta: 0.12, zoom: 0.72,
    setSolved(v) { solved = v; },
    update(t, dt) {
      const goal = solved ? 100 : 150;
      xD += (goal - xD) * Math.min(1, dt * 1.2);
      dad.position.x = xD;
      dD.userData.set(0, xD, solved && Math.abs(xD - 100) < 2 ? '100 cm' : 'r = ?', 18);
      const net = 600 * xD - 300 * 200;
      const target = clamp(-net / 60000 * 0.35, -0.2, 0.2) + (solved && Math.abs(net) < 3000 ? 0.035 * Math.sin(t * 1.4) : 0);
      w += (20 * (target - th) - 5 * w) * dt; th += w * dt;
      plank.rotation.z = th;
      plank.updateMatrixWorld();
      const pj = toG(g, plank, V3(-200, 130, 0)), pd = toG(g, plank, V3(xD, 170, 0));
      aJ.userData.set(pj.clone().add(V3(0, 0, 40)), V3(0, -1, 0), 50);
      aD.userData.set(pd.clone().add(V3(0, 0, 40)), V3(0, -1, 0), 100);
      lJ.position.copy(pj).add(V3(0, 26, 40)); lD.position.copy(pd).add(V3(0, 26, 40));
    }
  };
}

/* ---- Schubkarre ---- */
function modelBarrow(g) {
  const s = 11.5, ar = 1.6;
  const ax = V3(0, 20, 0);
  const wheel = new THREE.Group(); wheel.position.copy(ax); g.add(wheel);
  const tyre = mesh(new THREE.TorusGeometry(16, 4.2, 14, 32), MAT.rubber); wheel.add(tyre);
  const rim = cyl(12, 12, 5, MAT.alu, 24); rim.rotation.x = Math.PI / 2; wheel.add(rim);
  const pv = makePivot(2.2, true, s); pv.position.set(0, 0, 8); pv.userData.label.position.set(-30, 4, 0); wheel.add(pv);
  const body = new THREE.Group(); body.position.copy(ax); g.add(body);
  body.add(rod(V3(0, 0, -6), V3(0, 0, 6), 1.2, MAT.steel));
  [-1, 1].forEach((z) => {
    body.add(rod(V3(0, 0, z * 6), V3(20, 14, z * 21), 1.4, MAT.dark));
    body.add(rod(V3(14, 14, z * 21), V3(168, 16, z * 24), 1.6, MAT.dark));
    const grip = rod(V3(150, 15.7, z * 23.7), V3(172, 16.2, z * 24.2), 2.4, MAT.rubber); body.add(grip);
    body.add(rod(V3(112, 15, z * 22), V3(112, -18, z * 22), 1.4, MAT.dark));
  });
  const trayG = new THREE.CylinderGeometry(42, 30, 26, 4, 1, true); trayG.rotateY(Math.PI / 4); trayG.scale(1.2, 1, 0.75);
  const trayM = mat(0x16a34a, { metalness: 0.4, roughness: 0.45, side: THREE.DoubleSide });
  const tray = mesh(trayG, trayM); tray.position.set(52, 30, 0); body.add(tray);
  const bottom = box(48, 1, 40, trayM); bottom.position.set(52, 17.5, 0); body.add(bottom);
  const sand = sph(34, mat(0xd6b07a, { roughness: 1 })); sand.scale.set(1.35, 0.42, 1); sand.position.set(50, 40, 0); body.add(sand);
  const aL = makeArrow(C.load, ar), aH = makeArrow(C.force, ar); g.add(aL, aH);
  const lL = labO('F_{Last} = 800 N', s), lH = labF('F_{Hand} = ?', s); g.add(lL, lH);
  const d1 = makeDim('#ea580c', s * 0.9), d2 = makeDim('#2563eb', s * 0.9);
  d1.position.set(0, 13, 40); d2.position.set(0, 3, 40); g.add(d1, d2);
  d1.userData.set(0, 40, '40 cm', -s * 0.9); d2.userData.set(0, 160, '160 cm', -s * 0.9);
  const cog = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), mat(0xf97316, { emissive: new THREE.Color(0x7c2d12) })); cog.position.set(40, 30, 0); body.add(cog);
  return {
    size: 200, center: V3(80, 35, 0), theta: 0.55, phi: 1.25,
    setSolved(v) { lH.userData.set(v ? 'F_{Hand} = 200 N' : 'F_{Hand} = ?'); },
    update(t) {
      const th = 0.17 * (0.5 - 0.5 * Math.cos(t * 1.2));
      body.rotation.z = th; body.updateMatrixWorld();
      const pl = toG(g, body, V3(40, 30, 0)), ph = toG(g, body, V3(160, 16, 30));
      aL.userData.set(pl.clone().add(V3(0, 0, 34)), V3(0, -1, 0), 26);
      aH.userData.set(ph.clone().add(V3(0, 2, 2)), V3(0, 1, 0), 26);
      lL.position.copy(pl).add(V3(-14, 34, 34)); lH.position.copy(ph).add(V3(0, 34, 2));
    }
  };
}

/* ---- Unterarm mit Bizeps ---- */
function modelArm(g) {
  const s = 3.5, ar = 0.5;
  const E = V3(0, 30, 0);
  const upper = mesh(new THREE.CapsuleGeometry(4.2, 26, 8, 16), mat(0xf2c09b, { roughness: 0.7, transparent: true, opacity: 0.55 })); upper.position.set(-1.5, 30 + 15, -1); upper.rotation.z = 0.05; g.add(upper);
  const hum = rod(V3(0, 30, 0), V3(-1.2, 58, 0), 1.2, MAT.bone); g.add(hum);
  const sh = sph(4.5, MAT.bone); sh.position.set(-1.4, 60, 0); g.add(sh);
  const fore = new THREE.Group(); fore.position.copy(E); g.add(fore);
  const skin = mesh(new THREE.CapsuleGeometry(3.6, 28, 8, 16), mat(0xf2c09b, { roughness: 0.7, transparent: true, opacity: 0.55 })); skin.rotation.z = -Math.PI / 2; skin.position.x = 16; fore.add(skin);
  fore.add(rod(V3(0, 0, 0), V3(31, 0, 0), 1.0, MAT.bone));
  const hand = mesh(new THREE.BoxGeometry(9, 2.6, 8), MAT.skin); hand.position.set(35, 0, 0); fore.add(hand);
  const thumb = mesh(new THREE.CapsuleGeometry(1, 4, 4, 8), MAT.skin); thumb.position.set(33, 2, 4.4); thumb.rotation.x = 0.6; fore.add(thumb);
  const ball = sph(4.6, mat(0x334155, { metalness: 0.7, roughness: 0.3 })); ball.position.set(35, 5.9, 0); fore.add(ball);
  const pv = makePivot(1.6, true, s); pv.position.set(0, 0, 5); pv.userData.label.position.set(-3, -5, 0); fore.add(pv);
  const muscle = sph(1, MAT.muscle, 24); g.add(muscle);
  const tendon = rod(V3(), V3(0, 1, 0), 0.45, MAT.bone); g.add(tendon);
  const aM = makeArrow(C.force, ar), aB = makeArrow(C.load, ar); g.add(aM, aB);
  const lM = labF('F_{Bizeps} = ?', s), lB = labO('F_{Kugel} = 50 N', s); g.add(lM, lB);
  const d1 = makeDim('#2563eb', s * 0.9), d2 = makeDim('#ea580c', s * 0.9);
  d1.position.set(0, -6.5, 4); d2.position.set(0, -12.5, 4); fore.add(d1, d2);
  d1.userData.set(0, 5, '5 cm', s * 0.9); d2.userData.set(0, 35, '35 cm', s * 0.9);
  const A = V3(3.5, 54, 0);
  return {
    size: 62, center: V3(14, 34, 0), theta: 0.35, phi: 1.32,
    setSolved(v) { lM.userData.set(v ? 'F_{Bizeps} = 350 N' : 'F_{Bizeps} = ?'); },
    update(t) {
      const ph = 0.42 * (0.5 - 0.5 * Math.cos(t * 1.1));
      fore.rotation.z = ph; fore.updateMatrixWorld();
      const B = toG(g, fore, V3(5, 2.2, 0));
      const mid = B.clone().add(V3(0, 6, 0));
      const dir = new THREE.Vector3().subVectors(A, mid); const len = dir.length();
      muscle.position.copy(A).add(mid).multiplyScalar(0.5);
      muscle.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
      const bulge = 3.4 + ph * 3.2;
      muscle.scale.set(bulge, len / 2 + 1, bulge * 0.9);
      setRod(tendon, B, mid);
      const md = new THREE.Vector3().subVectors(A, B).normalize();
      aM.userData.set(B.clone().add(V3(0, 0, 5.5)), md, 11);
      const pb = toG(g, fore, V3(35, 5.9, 0));
      aB.userData.set(pb.clone().add(V3(0, -5, 6)), V3(0, -1, 0), 9);
      lM.position.copy(B).add(V3(9, 14, 5)); lB.position.copy(pb).add(V3(4, -17, 6));
    }
  };
}

/* ---- Tür ---- */
function modelDoor(g) {
  const s = 13.5, ar = 1.8;
  const wallM = mat(0xf1f5f9, { roughness: 0.9 });
  const w1 = box(80, 230, 14, wallM); w1.position.set(-46, 115, -2); g.add(w1);
  const w2 = box(80, 230, 14, wallM); w2.position.set(136, 115, -2); g.add(w2);
  const w3 = box(100, 22, 14, wallM); w3.position.set(45, 219, -2); g.add(w3);
  const fM = mat(0xe5e7eb, { roughness: 0.6 });
  const j1 = box(5, 208, 16, fM); j1.position.set(-3.5, 104, -2); g.add(j1);
  const j2 = box(5, 208, 16, fM); j2.position.set(93.5, 104, -2); g.add(j2);
  const door = new THREE.Group(); g.add(door);
  const panel = box(90, 203, 4, mat(0xb7794a, { roughness: 0.6 })); panel.position.set(45, 101.5, 0); door.add(panel);
  [40, 140].forEach((y) => { const inset = box(70, 70, 0.8, mat(0xa66a3e)); inset.position.set(45, y + 10, 2.3); door.add(inset); });
  const ros = cyl(2.6, 2.6, 1.2, MAT.chrome); ros.rotation.x = Math.PI / 2; ros.position.set(82, 105, 2.6); door.add(ros);
  const lever = rod(V3(82, 105, 4), V3(70, 105, 6.5), 1.1, MAT.chrome); door.add(lever);
  [30, 175].forEach((y) => { const h = cyl(1.4, 1.4, 12, MAT.brass); h.position.set(0, y, 0); g.add(h); });
  const hingeLine = rod(V3(0, 0, 0), V3(0, 215, 0), 0.35, mat(0xef4444, { emissive: new THREE.Color(0x7f1d1d) })); g.add(hingeLine);
  const pl = makeLabel('Drehachse (Scharniere)', { color: '#b91c1c', size: s, border: '#fca5a5' }); pl.position.set(-2, 228, 6); g.add(pl);
  const aH = makeArrow(C.force, ar); door.add(aH); aH.userData.set(V3(78, 105, 6), V3(0, 0, 1), 30);
  const lH = labF('F = 5 N', s); lH.position.set(76, 120, 32); door.add(lH);
  const aX = makeArrow(0xef4444, ar); door.add(aX); aX.userData.set(V3(10, 105, 6), V3(0, 0, 1), 60);
  const lX = makeLabel('F = ?', { color: '#b91c1c', size: s, border: '#fca5a5' }); lX.position.set(14, 130, 64); door.add(lX);
  const d1 = makeDim('#2563eb', s * 0.9); d1.position.set(0, 90, 4); door.add(d1); d1.userData.set(0, 80, '80 cm', s * 0.9);
  const d2 = makeDim('#dc2626', s * 0.9); d2.position.set(0, 58, 4); door.add(d2); d2.userData.set(0, 10, '10 cm', s * 0.9);
  let solved = false;
  return {
    size: 240, center: V3(45, 110, 0), theta: 0.6, phi: 1.36,
    setSolved(v) { solved = v; lX.userData.set(v ? 'F = 40 N (8-mal so viel!)' : 'F = ?'); },
    update(t) { door.rotation.y = -1.05 * (0.5 - 0.5 * Math.cos(t * 0.7)); }
  };
}

/* ---- Wolfskiefer ---- */
function taperBox(len, h, d, f) {
  const geo = new THREE.BoxGeometry(len, h, d, 10, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); const k = 1 - f * (x + len / 2) / len; pos.setY(i, pos.getY(i) * k); pos.setZ(i, pos.getZ(i) * (0.55 + 0.45 * k)); }
  geo.computeVertexNormals();
  return geo;
}
function modelWolf(g) {
  const s = 1.35, ar = 0.17;
  const J = V3(0, 12, 0);
  const root = new THREE.Group(); root.position.copy(J); g.add(root);
  const skullM = MAT.bone;
  const upper = mesh(taperBox(18, 4.4, 7.5, 0.5), skullM); upper.position.set(8, 2.6, 0); root.add(upper);
  const cran = sph(6.2, skullM); cran.scale.set(1.25, 0.95, 0.95); cran.position.set(-2.5, 5.2, 0); root.add(cran);
  const nose = sph(0.9, MAT.black); nose.position.set(17, 3.4, 0); root.add(nose);
  [-1, 1].forEach((z) => { const eye = sph(1.2, MAT.black); eye.position.set(3.2, 6, z * 3.1); root.add(eye); });
  const lower = new THREE.Group(); root.add(lower);
  const jaw = mesh(taperBox(18, 3.2, 6.5, 0.45), skullM); jaw.position.set(8, -1.7, 0); lower.add(jaw);
  const pv = makePivot(0.8, true, s); pv.position.set(0, 0, 4.2); pv.userData.label.position.set(-2.5, -2.4, 0); root.add(pv);
  const toothM = mat(0xfffbeb, { roughness: 0.35 });
  const hiM = mat(0xfb923c, { roughness: 0.35, emissive: new THREE.Color(0x7c2d12) });
  const tooth = (parent, x, y, h, r, dir, m) => { const c = mesh(new THREE.ConeGeometry(r, h, 10), m); c.position.set(x, y + dir * h / 2, 0); if (dir < 0) c.rotation.z = Math.PI; parent.add(c); return c; };
  [6.5, 8, 9.5].forEach((x) => { tooth(root, x, 0.5, 1.0, 0.6, -1, toothM); tooth(lower, x, -0.2, 0.9, 0.55, 1, toothM); });
  tooth(root, 4, 0.5, 1.8, 1.1, -1, hiM); tooth(lower, 4, -0.2, 1.6, 1.0, 1, hiM);
  tooth(root, 12, 0.5, 3.2, 0.6, -1, hiM); tooth(lower, 12.8, -0.2, 2.6, 0.55, 1, hiM);
  [14.6, 15.6].forEach((x) => { tooth(root, x, 0.5, 0.9, 0.35, -1, toothM); tooth(lower, x - 0.3, -0.2, 0.8, 0.32, 1, toothM); });
  const bone = mesh(new THREE.CapsuleGeometry(0.55, 6, 4, 10), MAT.white); bone.rotation.x = Math.PI / 2; bone.position.set(4, 0.2, 0); root.add(bone);
  const muscle = sph(1, MAT.muscle); root.add(muscle);
  const Am = V3(1.5, 8.5, 0);
  const aM = makeArrow(C.force, ar), aR = makeArrow(C.load, ar), aE = makeArrow(C.load, ar); root.add(aM, aR, aE);
  const lM = labF('Kaumuskel: 1200 N', s), lR = labO('Reißzahn (4 cm): 900 N', s), lE = labO('', s); root.add(lM, lR, lE);
  const d1 = makeDim('#2563eb', s * 0.85), d2 = makeDim('#ea580c', s * 0.85), d3 = makeDim('#ea580c', s * 0.85);
  [d1, d2, d3].forEach((d, i) => { d.position.set(0, -5.2 - i * 2.3, 3.6); lower.add(d); });
  d1.userData.set(0, 3, '3 cm', s * 0.8); d2.userData.set(0, 4, '4 cm', s * 0.8); d3.userData.set(0, 12, '12 cm', s * 0.8);
  return {
    size: 24, center: V3(6, 12, 0), theta: 0.45, phi: 1.32,
    setSolved(v) { lE.userData.set(v ? 'Eckzahn (12 cm): 300 N' : 'Eckzahn (12 cm): ?'); },
    update(t) {
      const ph = -0.42 * (0.5 + 0.5 * Math.cos(t * 1.5));
      lower.rotation.z = ph; lower.updateMatrixWorld(); root.updateMatrixWorld();
      const B = V3(3 * Math.cos(ph) - (-1.2) * Math.sin(ph), 3 * Math.sin(ph) + (-1.2) * Math.cos(ph), 0);
      const dir = new THREE.Vector3().subVectors(Am, B); const len = dir.length();
      muscle.position.copy(Am).add(B).multiplyScalar(0.5);
      muscle.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
      muscle.scale.set(1.5 - ph * 1.2, len / 2, 1.4);
      aM.userData.set(B.clone().add(V3(0, 0, 3.8)), dir.clone().normalize(), 3.4);
      const r = V3(4 * Math.cos(ph) + 2.2 * Math.sin(ph), 4 * Math.sin(ph) - 2.2 * Math.cos(ph), 3.8);
      const e = V3(12.8 * Math.cos(ph) + 2.2 * Math.sin(ph), 12.8 * Math.sin(ph) - 2.2 * Math.cos(ph), 3.8);
      aR.userData.set(r, V3(0, 1, 0), 2.7); aE.userData.set(e, V3(0, 1, 0), 0.95);
      lM.position.set(-7, 11.5, 4); lR.position.set(5, 9.8, 4); lE.position.set(e.x + 6, e.y + 1.5, 4);
      bone.scale.y = 1; bone.scale.x = 1 - 0.15 * (1 + ph / 0.42);
    }
  };
}

/* ---- Radkreuz am Autoreifen ---- */
function modelWrench(g) {
  const s = 6.3, ar = 0.8;
  const Cn = V3(0, 37, 0);
  const tyre = mesh(new THREE.TorusGeometry(27, 9.5, 18, 40), MAT.rubber); tyre.position.copy(Cn); g.add(tyre);
  const rim = cyl(19, 19, 15, MAT.alu, 40); rim.rotation.x = Math.PI / 2; rim.position.copy(Cn); g.add(rim);
  const face = cyl(17, 17, 0.6, mat(0x9ca3af, { metalness: 0.8, roughness: 0.3 }), 40); face.rotation.x = Math.PI / 2; face.position.set(0, 37, 7.6); g.add(face);
  const nuts = [];
  for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + i * Math.PI * 2 / 5; const n = cyl(1.6, 1.6, 2.6, MAT.chrome, 6); n.rotation.x = Math.PI / 2; n.position.set(9 * Math.cos(a), 37 + 9 * Math.sin(a), 9); g.add(n); nuts.push(n); }
  const N = V3(0, 46, 9);
  const cross = new THREE.Group(); cross.position.copy(N); g.add(cross);
  const sock = cyl(2.2, 2.2, 10, MAT.dark, 16); sock.rotation.x = Math.PI / 2; sock.position.z = 5; cross.add(sock);
  cross.add(rod(V3(-40, 0, 10), V3(40, 0, 10), 1.2, MAT.dark));
  cross.add(rod(V3(0, -40, 10), V3(0, 40, 10), 1.2, MAT.dark));
  const grip = rod(V3(-40, 0, 10), V3(-31, 0, 10), 1.9, MAT.rubber); cross.add(grip);
  const pv = makePivot(1.2, false); pv.position.set(0, 0, 11.5); cross.add(pv);
  const pl = makeLabel('Drehpunkt (Mutter)', { color: '#b91c1c', size: s, border: '#fca5a5' }); pl.position.set(10, 8, 16); g.add(pl);
  const aH = makeArrow(C.force, ar); g.add(aH);
  const lH = labF('F = ?', s); g.add(lH);
  const lM = labO('Radmutter fest mit M = 120 N·m', s); lM.position.set(18, 76, 12); g.add(lM);
  const d1 = makeDim('#2563eb', s * 0.9); d1.position.set(0, 3, 12); d1.rotation.z = Math.PI; cross.add(d1);
  d1.userData.set(0, 40, '40 cm', s * 0.9);
  return {
    size: 110, center: V3(-8, 42, 0), theta: 0.35, phi: 1.36,
    setSolved(v) { lH.userData.set(v ? 'F = 300 N' : 'F = ?'); },
    update(t) {
      const a = 0.55 * (0.5 - 0.5 * Math.cos(t * 0.9));
      cross.rotation.z = a; cross.updateMatrixWorld();
      const h = toG(g, cross, V3(-38, 0, 13));
      const dir = V3(Math.sin(a), -Math.cos(a), 0);
      aH.userData.set(h.clone().addScaledVector(dir, -18), dir, 16);
      lH.position.copy(h).add(V3(-16, 22, 2));
      nuts[0].rotation.y = a;
    }
  };
}

/* ---- Flaschenöffner ---- */
function modelOpener(g) {
  const s = 1.5, ar = 0.18;
  const pts = [[0, 0], [3.1, 0], [3.25, 0.4], [3.25, 14], [2.95, 16], [1.6, 19.6], [1.35, 21], [1.35, 22.3], [1.55, 22.55], [1.3, 22.9], [0, 22.9]].map((p) => new THREE.Vector2(p[0], p[1]));
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x15803d, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.6 });
  const bottle = mesh(new THREE.LatheGeometry(pts, 40), glass); g.add(bottle);
  const liquid = cyl(2.95, 2.95, 15, mat(0xf59e0b, { roughness: 0.3, transparent: true, opacity: 0.75 }), 32); liquid.position.y = 7.7; g.add(liquid);
  const labTex = canvasTexture(512, 128, (ctx, w, h) => { ctx.fillStyle = '#fef3c7'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#b45309'; ctx.font = 'bold 72px Helvetica, Arial'; ctx.textAlign = 'center'; ctx.fillText('LIMO', w / 4, 92); ctx.fillText('LIMO', w * 3 / 4, 92); });
  const band = mesh(new THREE.CylinderGeometry(3.28, 3.28, 5, 40, 1, true), new THREE.MeshStandardMaterial({ map: labTex, roughness: 0.7 })); band.position.y = 8; g.add(band);
  const capPivot = new THREE.Group(); capPivot.position.set(-1.62, 22.9, 0); g.add(capPivot);
  const cap = mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.7, 21), mat(0xdc2626, { metalness: 0.7, roughness: 0.35 })); cap.position.set(1.62, 0.35, 0); capPivot.add(cap);
  const F = V3(-0.6, 23.6, 0);
  const op = new THREE.Group(); op.position.copy(F); g.add(op);
  const opM = mat(0xc7cdd6, { metalness: 0.9, roughness: 0.25 });
  const plate = box(13.4, 0.4, 2.8, opM); plate.position.set(4.6, 0.2, 0); op.add(plate);
  const lip = box(0.45, 1.6, 2.4, opM); lip.position.set(2.0 + 0.3, -0.55, 0); op.add(lip);
  const lipT = box(0.9, 0.35, 2.4, opM); lipT.position.set(1.95, -1.2, 0); op.add(lipT);
  const handle = rod(V3(6, 0.2, 0), V3(11.6, 0.2, 0), 0.85, MAT.woodD); op.add(handle);
  const pv = makePivot(0.32, true, s); pv.position.set(0, 0, 1.6); pv.userData.label.position.set(-2.5, 1.6, 0); op.add(pv);
  const aH = makeArrow(C.force, ar), aL = makeArrow(C.load, ar); g.add(aH, aL);
  const lH = labF('F_{Hand} = ?', s), lL = labO('Kronkorken: 50 N', s); g.add(lH, lL);
  const d1 = makeDim('#ea580c', s * 0.85), d2 = makeDim('#2563eb', s * 0.85);
  d1.position.set(0, 2.2, 1.6); d2.position.set(0, 4.4, 1.6); op.add(d1, d2);
  d1.userData.set(0, 2, '2 cm', -s * 0.8); d2.userData.set(0, 10, '10 cm', -s * 0.8);
  let solved = false;
  return {
    size: 26, center: V3(4, 18, 0), theta: 0.3, phi: 1.3,
    setSolved(v) { solved = v; lH.userData.set(v ? 'F_{Hand} = 10 N' : 'F_{Hand} = ?'); },
    update(t) {
      const cyc = (t % 3.6) / 3.6;
      let th, capA = 0, fly = 0;
      if (solved) {
        th = cyc < 0.45 ? 0.32 * ease(cyc / 0.45) : cyc < 0.8 ? 0.32 : 0.32 * (1 - ease((cyc - 0.8) / 0.2));
        capA = cyc < 0.45 ? th * 0.75 : 0;
        if (cyc >= 0.45 && cyc < 0.92) fly = (cyc - 0.45) / 0.47;
      } else {
        th = 0.08 * Math.sin(Math.PI * Math.min(1, cyc / 0.6)) * (cyc < 0.6 ? 1 : 0);
        capA = th * 0.6;
      }
      op.rotation.z = th;
      if (fly > 0) { capPivot.position.set(-1.62 + fly * 5, 22.9 + Math.sin(fly * Math.PI) * 9 + fly * 1.5, 0); capPivot.rotation.z = 0.24 + fly * 9; }
      else { capPivot.position.set(-1.62, 22.9, 0); capPivot.rotation.z = capA; }
      op.updateMatrixWorld();
      const h = toG(g, op, V3(10, 1, 1.8)), l = toG(g, op, V3(2, -1.4, 1.8));
      aH.userData.set(h.clone().add(V3(0, 0.1, 0)), V3(0, 1, 0), 3.4);
      aL.userData.set(l.clone().add(V3(0, 0, 0)), V3(0, -1, 0), 3.2);
      lH.position.copy(h).add(V3(0, 4.6, 0)); lL.position.copy(l).add(V3(2.6, -4.6, 0));
    }
  };
}

/* ---- Baukran ---- */
function latticeTex(rx, ry) {
  const t = canvasTexture(64, 64, (ctx, w, h) => { ctx.clearRect(0, 0, w, h); ctx.strokeStyle = '#facc15'; ctx.lineWidth = 7; ctx.strokeRect(3, 3, w - 6, h - 6); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(w - 4, h - 4); ctx.moveTo(w - 4, 4); ctx.lineTo(4, h - 4); ctx.stroke(); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.5 });
}
function modelCrane(g) {
  const s = 2.25, ar = 0.3;
  const pad = box(8, 1, 8, mat(0x9ca3af, { roughness: 0.9 })); pad.position.y = 0.5; g.add(pad);
  const mast = mesh(new THREE.BoxGeometry(2, 30, 2), latticeTex(1, 15)); mast.position.y = 16; g.add(mast);
  const top = new THREE.Group(); top.position.y = 31; g.add(top);
  const ring = cyl(1.6, 1.6, 0.8, MAT.dark); ring.position.y = 0.2; top.add(ring);
  const jib = mesh(new THREE.BoxGeometry(31, 1.5, 1.5), latticeTex(20, 1)); jib.position.set(7.5, 1.4, 0); top.add(jib);
  const apex = mesh(new THREE.BoxGeometry(1.2, 5, 1.2), latticeTex(1, 3)); apex.position.set(0, 4.6, 0); top.add(apex);
  const ropeM = mat(0x374151);
  top.add(rod(V3(0, 7, 0), V3(-7.5, 2.1, 0), 0.08, ropeM), rod(V3(0, 7, 0), V3(22.5, 2.1, 0), 0.08, ropeM));
  const cw = box(2.8, 3.2, 2.6, mat(0x94a3b8, { roughness: 0.95 })); cw.position.set(-5, -1.1, 0); top.add(cw);
  const cab = box(2.2, 2, 2, MAT.plasticY); cab.position.set(1.6, -0.2, 1.8); top.add(cab);
  const win = box(0.1, 1.2, 1.6, MAT.glass); win.position.set(2.75, 0, 1.8); top.add(win);
  const trolley = box(1.6, 0.7, 1.7, MAT.dark); trolley.position.set(20, 0.3, 0); top.add(trolley);
  const cable = rod(V3(), V3(0, 1, 0), 0.06, ropeM); top.add(cable);
  const load = new THREE.Group(); top.add(load);
  const cont = box(3.6, 2.2, 2.2, mat(0xea580c, { roughness: 0.6 })); cont.position.y = -1.4; load.add(cont);
  for (let i = -1; i <= 1; i++) { const r = box(0.12, 2.0, 2.25, mat(0xc2410c)); r.position.set(i * 1.1, -1.4, 0); load.add(r); }
  const hook = mesh(new THREE.TorusGeometry(0.35, 0.1, 6, 12, Math.PI * 1.4), MAT.steel); hook.position.y = -0.1; load.add(hook);
  const pv = makePivot(0.55, true, s); pv.position.set(0, 0.6, 1.2); pv.userData.label.position.set(0, -2.6, 0); top.add(pv);
  const aL = makeArrow(C.load, ar), aC = makeArrow(C.force, ar); top.add(aL, aC);
  const lL = labO('Last: 10 kN', s), lC = labF('Gegengewicht: ?', s); top.add(lL, lC);
  const d1 = makeDim('#2563eb', s * 0.9), d2 = makeDim('#ea580c', s * 0.9);
  d1.position.set(0, 3.4, 1.2); d2.position.set(0, 3.4, 1.2); top.add(d1, d2);
  d1.userData.set(-5, 0, '5 m', -s * 0.9); d2.userData.set(0, 20, '20 m', -s * 0.9);
  aC.userData.set(V3(-5, -2.9, 1.6), V3(0, -1, 0), 5.5);
  lC.position.set(-6.5, -10, 1.6);
  return {
    size: 40, center: V3(6, 18, 0), theta: 0.6, phi: 1.33,
    setSolved(v) { lC.userData.set(v ? 'Gegengewicht: 40 kN' : 'Gegengewicht: ?'); },
    update(t) {
      top.rotation.y = 0.35 * Math.sin(t * 0.25);
      const sw = 0.05 * Math.sin(t * 1.25);
      const L = 13;
      const tip = V3(20, 0, 0), end = V3(20 + L * Math.sin(sw), -L * Math.cos(sw), 0);
      setRod(cable, tip, end);
      load.position.copy(end);
      aL.userData.set(end.clone().add(V3(0, -2.8, 1.6)), V3(0, -1, 0), 4);
      lL.position.copy(end).add(V3(3.5, -6, 1.6));
    }
  };
}

/* ---- Kofferwaage (Feder) ---- */
function modelLuggage(g) {
  const s = 6.8, ar = 0.7;
  const rig = new THREE.Group(); g.add(rig);
  const H = 104;
  const grip = rod(V3(-7, H, 0), V3(7, H, 0), 1.6, MAT.black); rig.add(grip);
  rig.add(rod(V3(-6, H, 0), V3(-2.2, H - 3, 0), 0.6, MAT.black), rod(V3(6, H, 0), V3(2.2, H - 3, 0), 0.6, MAT.black));
  const tube = mesh(new THREE.CylinderGeometry(2.4, 2.4, 18, 24, 1, true), MAT.glass, false); tube.position.y = H - 12; rig.add(tube);
  const capT = cyl(2.6, 2.6, 1, MAT.plasticB); capT.position.y = H - 3; rig.add(capT);
  const capB = cyl(2.6, 2.6, 1, MAT.plasticB); capB.position.y = H - 21; rig.add(capB);
  const L0 = 6;
  const spr = mesh(springGeometry(L0, 12, 1.3, 0.17, 0.4), MAT.steel); spr.position.y = H - 3.5; rig.add(spr);
  const ind = cyl(1.9, 1.9, 0.4, MAT.plasticR); rig.add(ind);
  const scaleT = canvasTexture(64, 512, (ctx, w, h) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); for (let N = 0; N <= 400; N += 10) { const y = (N / 50) / 8 * h; const big = N % 50 === 0; ctx.fillStyle = '#0f172a'; ctx.fillRect(0, y, big ? 30 : 16, big ? 3 : 1.5); if (N % 100 === 0) { ctx.font = 'bold 18px Helvetica'; ctx.fillText(String(N), 30, y + 7); } } });
  const strip = mesh(new THREE.PlaneGeometry(2.6, 8), new THREE.MeshStandardMaterial({ map: scaleT, roughness: 0.6 })); strip.position.set(0, H - 3.5 - L0 - 4, 2.6); rig.add(strip);
  const hookRod = rod(V3(), V3(0, 1, 0), 0.35, MAT.steel); rig.add(hookRod);
  const hook = mesh(new THREE.TorusGeometry(1.2, 0.35, 8, 18, Math.PI * 1.5), MAT.steel); rig.add(hook);
  const caseG = new THREE.Group(); rig.add(caseG);
  const body = box(44, 58, 22, mat(0x1e40af, { roughness: 0.45 })); body.position.y = 29; caseG.add(body);
  for (let i = -2; i <= 2; i++) { const r = box(0.8, 58.2, 22.2, mat(0x1d4ed8)); r.position.set(i * 8, 29, 0); caseG.add(r); }
  const handle = mesh(new THREE.TorusGeometry(5, 1, 8, 20, Math.PI), MAT.black); handle.position.y = 58; caseG.add(handle);
  [-16, 16].forEach((x) => { const w = cyl(2.2, 2.2, 2, MAT.rubber); w.rotation.x = Math.PI / 2; w.position.set(x, -1, 8); caseG.add(w); });
  const strap = rod(V3(), V3(0, 1, 0), 0.5, MAT.black); rig.add(strap);
  const aG = makeArrow(C.load, ar), aH = makeArrow(C.force, ar); g.add(aG, aH);
  const lG = labO('F = ?', s), lH = labF('Hand hält', s), lS = labN('', s * 0.9); g.add(lG, lH, lS);
  const lD = labN('Feder: 2 cm pro 100 N', s * 0.85); lD.position.set(-22, H - 6, 4); g.add(lD);
  return {
    size: 120, center: V3(0, 66, 0), theta: 0.4, phi: 1.36, zoom: 0.95,
    setSolved(v) { lG.userData.set(v ? 'F_{G} = 230 N (≈ 23 kg)' : 'F_{G} = ?'); },
    update(t) {
      const lift = 6 + 4 * Math.sin(t * 0.9);
      const ext = 4.6 + 0.25 * Math.sin(t * 5.2) * Math.max(0, Math.cos(t * 0.9));
      rig.position.y = lift - 6;
      spr.scale.y = (L0 + ext) / L0;
      const yi = H - 3.5 - L0 - ext;
      ind.position.y = yi;
      setRod(hookRod, V3(0, yi, 0), V3(0, H - 24, 0));
      hook.position.set(0.9, H - 25, 0); hook.rotation.z = Math.PI * 0.7;
      caseG.position.y = H - 25 - 14 - 60;
      setRod(strap, V3(0, H - 26, 0), V3(0, H - 25 - 14 - 60 + 63, 0));
      const top = rig.position.y;
      aG.userData.set(V3(0, top + H - 25 - 14 - 60 + 29, 13), V3(0, -1, 0), 26);
      aH.userData.set(V3(0, top + H + 1.6, 3), V3(0, 1, 0), 12);
      lG.position.set(28, top + H - 75, 13); lH.position.set(14, top + H + 9, 3);
      lS.position.set(22, top + yi, 3); lS.userData.set('s = ' + fmt(ext, 1) + ' cm');
    }
  };
}

/* ---- Expander (drei Federn parallel) ---- */
function modelExpander(g) {
  const s = 4.3, ar = 0.8;
  const y = 40, L0 = 40;
  const hL = new THREE.Group(), hR = new THREE.Group(); g.add(hL, hR);
  [hL, hR].forEach((h) => { h.add(rod(V3(0, -9, 0), V3(0, 9, 0), 1.9, MAT.plasticR)); h.add(rod(V3(0, -9, 0), V3(0, 9, 0), 0.6, MAT.steel)); const bar = box(2, 22, 3, MAT.dark); bar.position.x = 0; h.add(bar); });
  const springs = [-7, 0, 7].map((yy) => { const sp = mesh(springGeometry(L0, 34, 1.3, 0.22, 1.2), MAT.steel); sp.rotation.z = Math.PI / 2; sp.position.set(0, yy, 0); hL.add(sp); return sp; });
  const aL = makeArrow(C.force, ar), aR = makeArrow(C.force, ar); g.add(aL, aR);
  const lF = labF('F = ?', s), lS = labN('', s * 0.9), lD = labN('je Feder: D = 1,5 N/cm', s * 0.85); g.add(lF, lS, lD);
  lD.position.set(0, y - 22, 0);
  let solved = false;
  return {
    size: 75, center: V3(0, 40, 0), theta: 0.25, phi: 1.3,
    setSolved(v) { solved = v; },
    update(t) {
      const ext = 20 - 20 * Math.cos(t * 0.9);
      const sep = L0 + ext;
      hL.position.set(-sep / 2, y, 0); hR.position.set(sep / 2, y, 0);
      springs.forEach((sp) => { sp.scale.y = sep / L0; });
      aL.userData.set(V3(-sep / 2 - 3, y, 0), V3(-1, 0, 0), 14); aR.userData.set(V3(sep / 2 + 3, y, 0), V3(1, 0, 0), 14);
      lS.position.set(0, y + 17, 0); lS.userData.set('Ausdehnung s = ' + Math.round(ext) + ' cm');
      lF.position.set(sep / 2 + 12, y + 9, 0);
      lF.userData.set(solved ? 'F = ' + Math.round(3 * 1.5 * ext) + ' N' : (ext > 39 ? 'F = ?' : 'F = …'));
    }
  };
}

/* =========================================================
   Aufgaben der Station 5
   ========================================================= */
function typeQ(key, kind, why) {
  const e = kind === 'e';
  return {
    id: 'a5-' + key + '-type', type: 'mc', text: 'Um welche <b>Hebelart</b> handelt es sich?', tag: 'Teil 1',
    options: [
      { t: 'Einseitiger Hebel – alle Kräfte greifen auf derselben Seite des Drehpunkts an', ok: e, fb: 'Sieh dir im 3D-Modell an, wo der <b>rote Drehpunkt</b> liegt. Liegt er <b>zwischen</b> dem blauen und dem orangen Pfeil?' },
      { t: 'Zweiseitiger Hebel – der Drehpunkt liegt zwischen den Kräften', ok: !e, fb: 'Sieh dir im 3D-Modell an, wo der <b>rote Drehpunkt</b> liegt. Liegen blauer und oranger Pfeil auf <b>derselben Seite</b>?' }
    ],
    ok: why
  };
}
const ALLTAG = [
  { key: 'astschere', em: '✂️', title: 'Die Astschere', cat: 'werkzeug', type: 'Zweiseitiger Hebel',
    story: 'Ein dicker Ast soll ab. Die Schneiden müssen ihn mit <b>200 N</b> zusammendrücken. Der Ast liegt <b>4 cm</b> vom Gelenk entfernt, deine Hände drücken <b>40 cm</b> vom Gelenk entfernt auf die Griffe.',
    given: ['Schneidkraft F<sub>Ast</sub> = 200 N', 'Lastarm a<sub>L</sub> = 4 cm', 'Kraftarm a<sub>K</sub> = 40 cm'], sought: 'Handkraft F<sub>Hand</sub>',
    model: (g) => modelCross(g, { size: 52, y: 22, a: 4, b: 40, jaw: 8, bw: 2.4, bt: 0.6, hr: 0.9, hub: 1.6, style: 'blade', grip: mat(0x15803d, { roughness: 0.6 }), obj: 'branch', objR: 1.4, open: 0.32, loadText: 'F_{Ast} = 200 N', handText: 'F_{Hand} = 20 N' }),
    qs: (k) => [typeQ(k, 'z', 'Richtig: Das Gelenk liegt <b>zwischen</b> Ast und Händen.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Berechne die nötige Handkraft F<sub>Hand</sub>.', answer: 20, unit: 'N',
        hints: ['Hebelgesetz: F<sub>Hand</sub> · 40 cm = 200 N · 4 cm', '200 N · 4 cm = 800 N·cm. Teile durch 40 cm.'], special: { '2000': 'Du hast mit dem langen Arm multipliziert. Die Kraft am <b>langen</b> Arm muss <b>kleiner</b> sein.' },
        solution: 'F<sub>Hand</sub> = 200 N · 4 cm : 40 cm = <b>20 N</b>.', ok: '<b>Exakt!</b> 200 N · 4 cm = F<sub>Hand</sub> · 40 cm → F<sub>Hand</sub> = 20 N. Der lange Griff macht deine Kraft 10-mal so groß.' },
      { id: 'a5-' + k + '-tip', tag: 'Teil 3', type: 'mc', text: 'Wo legst du einen dicken Ast am besten in die Schere?', options: [
        { t: 'Möglichst nah am Gelenk', ok: true }, { t: 'Möglichst weit vorne an der Spitze', fb: 'Dann wird der Lastarm länger – und du brauchst mehr Kraft.' }, { t: 'Das ist egal', fb: 'Probiere es mit dem Hebelgesetz aus: Was passiert mit F<sub>Hand</sub>, wenn a<sub>L</sub> größer wird?' }],
        ok: 'Nah am Gelenk ist der Lastarm kurz – so brauchst du am wenigsten Kraft.' }] },

  { key: 'nuss', em: '🌰', title: 'Der Nussknacker', cat: 'werkzeug', type: 'Einseitiger Hebel',
    story: 'Eine Walnuss liegt <b>3 cm</b> vom Gelenk entfernt im Nussknacker. Du drückst mit <b>30 N</b> auf die Griffe, <b>15 cm</b> vom Gelenk entfernt.',
    given: ['Handkraft F<sub>Hand</sub> = 30 N', 'Kraftarm = 15 cm', 'Lastarm = 3 cm'], sought: 'Kraft auf die Nuss F<sub>Nuss</sub>',
    model: (g) => modelHinge(g, { size: 22, y: 9, len: 18, th: 0.9, w: 1.8, mat: MAT.chrome, grips: mat(0x7c2d12, { roughness: 0.7 }), fx: 15, ox: 3, objR: 1.15, open: 0.1, squash: true, dimY: 4.5,
      obj: () => { const n = sph(1.35, mat(0x92400e, { roughness: 0.85 })); n.scale.set(1, 0.9, 1); return n; }, forceText: 'F_{Hand} = 30 N', objText: 'F_{Nuss} = ?', objTextSolved: 'F_{Nuss} = 150 N' }),
    qs: (k) => [typeQ(k, 'e', 'Richtig: Das Gelenk liegt am Ende – Nuss und Hand sind auf <b>derselben Seite</b>.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Welche Kraft wirkt auf die Nuss?', answer: 150, unit: 'N',
        hints: ['F<sub>Nuss</sub> · 3 cm = 30 N · 15 cm', '30 N · 15 cm = 450 N·cm'], special: { '6': 'Dann wäre die Kraft an der Nuss kleiner als deine Handkraft. Die Nuss sitzt aber am <b>kurzen</b> Arm – dort ist die Kraft größer!' },
        solution: 'F<sub>Nuss</sub> = 30 N · 15 cm : 3 cm = <b>150 N</b>.', ok: '<b>Großartig!</b> 30 N · 15 cm = F<sub>Nuss</sub> · 3 cm → F<sub>Nuss</sub> = 150 N. Der Nussknacker verfünffacht deine Kraft.' }] },

  { key: 'wippe', em: '🛝', title: 'Gleichgewicht auf der Wippe', cat: 'alltag', type: 'Zweiseitiger Hebel',
    story: 'Jonas wiegt <b>30 kg</b> (Gewichtskraft ≈ <b>300 N</b>) und sitzt <b>200 cm</b> vom Drehpunkt entfernt. Sein Vater wiegt <b>60 kg</b> (≈ <b>600 N</b>). Im 3D-Modell sitzt der Vater noch an der falschen Stelle.',
    given: ['F<sub>Jonas</sub> = 300 N', 'r<sub>Jonas</sub> = 200 cm', 'F<sub>Vater</sub> = 600 N'], sought: 'Abstand r<sub>Vater</sub>',
    model: modelSeesaw,
    qs: (k) => [typeQ(k, 'z', 'Genau: Der Drehpunkt der Wippe liegt <b>zwischen</b> Jonas und seinem Vater.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'In welchem Abstand vom Drehpunkt muss der Vater sitzen, damit die Wippe im Gleichgewicht ist?', answer: 100, unit: 'cm',
        hints: ['M<sub>Jonas</sub> = 300 N · 200 cm = 60 000 N·cm', 'Der Vater muss dasselbe Drehmoment erzeugen: 600 N · r = 60 000 N·cm'], special: { '400': 'Dann wäre das Drehmoment des Vaters viermal so groß wie das von Jonas. Wer schwerer ist, muss <b>näher</b> an den Drehpunkt.' },
        solution: 'r = 60 000 N·cm : 600 N = <b>100 cm</b>.', ok: '<b>Richtig!</b> 300 N · 200 cm = 600 N · r → r = 100 cm. Schau ins 3D-Modell: Der Vater rutscht jetzt an die richtige Stelle!' },
      { id: 'a5-' + k + '-plus', tag: 'Teil 3', type: 'mc', text: 'Jonas’ Freundin (auch 300 N) setzt sich direkt zu Jonas. Was muss der Vater tun?', options: [
        { t: 'Auf 200 cm nach außen rutschen', ok: true }, { t: 'Auf 50 cm nach innen rutschen', fb: 'Links ist das Drehmoment jetzt doppelt so groß. Muss der Vater dann einen längeren oder kürzeren Arm haben?' }, { t: 'Sitzen bleiben', fb: 'Links wirkt jetzt doppelt so viel Kraft – das Gleichgewicht ist gestört.' }],
        ok: '600 N · 200 cm = 120 000 N·cm links. Der Vater: 600 N · <b>200 cm</b> – er muss genauso weit außen sitzen wie die Kinder.' }] },

  { key: 'karre', em: '🧱', title: 'Die Schubkarre', cat: 'alltag', type: 'Einseitiger Hebel',
    story: 'Eine mit Sand gefüllte Schubkarre hat eine Gewichtskraft von <b>800 N</b>. Ihr Schwerpunkt liegt <b>40 cm</b> (waagerecht gemessen) von der Radachse entfernt. Du hebst die Griffe <b>160 cm</b> von der Achse entfernt an.',
    given: ['F<sub>Last</sub> = 800 N', 'Lastarm = 40 cm', 'Kraftarm = 160 cm'], sought: 'Handkraft F<sub>Hand</sub>',
    model: modelBarrow,
    qs: (k) => [typeQ(k, 'e', 'Richtig: Das Rad ist der Drehpunkt, Sand und Hände liegen auf <b>derselben Seite</b>.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Mit welcher Kraft musst du die Griffe nach oben ziehen?', answer: 200, unit: 'N',
        hints: ['F<sub>Hand</sub> · 160 cm = 800 N · 40 cm', '800 N · 40 cm = 32 000 N·cm'], special: { '3200': 'Du hast multipliziert statt geteilt. Die Kraft am langen Griff ist <b>kleiner</b> als die Last.' },
        solution: 'F<sub>Hand</sub> = 800 N · 40 cm : 160 cm = <b>200 N</b>.', ok: '<b>Hervorragend!</b> Du musst nur ein Viertel der Last halten – den Rest trägt das Rad.' },
      { id: 'a5-' + k + '-tip', tag: 'Teil 3', type: 'mc', text: 'Wohin solltest du schwere Steine in der Schubkarre legen?', options: [
        { t: 'Möglichst weit vorne, nah am Rad', ok: true }, { t: 'Möglichst weit hinten, nah an den Griffen', fb: 'Dann wird der Lastarm länger und du musst mehr tragen.' }, { t: 'Egal, Hauptsache in die Mitte', fb: 'Der Lastarm hängt davon ab, wo die Last liegt.' }],
        ok: 'Nah am Rad wird der Lastarm kurz – du musst weniger heben.' }] },

  { key: 'zange', em: '🔧', title: 'Die Beißzange', cat: 'werkzeug', type: 'Zweiseitiger Hebel',
    story: 'Du drückst die Griffe einer Beißzange mit <b>50 N</b> zusammen, <b>15 cm</b> vom Gelenk entfernt. Der Draht liegt nur <b>3 cm</b> vom Gelenk entfernt.',
    given: ['Handkraft = 50 N', 'Kraftarm = 15 cm', 'Lastarm = 3 cm'], sought: 'Kraft auf den Draht F<sub>Draht</sub>',
    model: (g) => modelCross(g, { size: 22, y: 9, a: 3, b: 15, jaw: 4.2, bw: 1.5, bt: 0.9, hr: 0.45, hub: 1.1, style: 'pliers', grip: MAT.plasticR, obj: 'wire', objR: 0.18, open: 0.22, loadText: 'F_{Draht} = ?', handText: 'F_{Hand} = 50 N' }),
    qs: (k) => [typeQ(k, 'z', 'Richtig: Das Gelenk liegt <b>zwischen</b> Draht und Hand.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Welche Kraft wirkt auf den Draht?', answer: 250, unit: 'N',
        hints: ['F<sub>Draht</sub> · 3 cm = 50 N · 15 cm', '50 N · 15 cm = 750 N·cm'], special: { '10': 'Am <b>kurzen</b> Arm (Draht) ist die Kraft größer, nicht kleiner.' },
        solution: 'F<sub>Draht</sub> = 750 N·cm : 3 cm = <b>250 N</b>.', ok: '<b>Absolut korrekt!</b> 50 N · 15 cm = F<sub>Draht</sub> · 3 cm → 250 N. Die Zange verfünffacht deine Kraft.' }] },

  { key: 'arm', em: '💪', title: 'Dein Unterarm', cat: 'koerper', type: 'Einseitiger Hebel',
    story: 'Du hältst eine Kugel mit <b>50 N</b> Gewichtskraft auf der Hand. Der Unterarm ist ein Hebel mit dem Ellenbogen als Drehpunkt. Die Kugel liegt <b>35 cm</b> vom Ellenbogen entfernt, der Bizeps setzt aber schon <b>5 cm</b> nach dem Gelenk an.',
    given: ['F<sub>Kugel</sub> = 50 N', 'Lastarm = 35 cm', 'Kraftarm (Bizeps) = 5 cm'], sought: 'Muskelkraft F<sub>Bizeps</sub>',
    model: modelArm,
    qs: (k) => [typeQ(k, 'e', 'Richtig: Bizeps und Kugel ziehen beide <b>vor</b> dem Ellenbogen – auf derselben Seite.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Welche Kraft muss dein Bizeps aufbringen, um die Kugel ruhig zu halten?', answer: 350, unit: 'N',
        hints: ['F<sub>Bizeps</sub> · 5 cm = 50 N · 35 cm', '50 N · 35 cm = 1750 N·cm'], special: { '7.14': 'Hier ist es umgekehrt: Der Muskel sitzt am <b>kurzen</b> Arm – er muss also mehr Kraft aufbringen als die Last.' },
        solution: 'F<sub>Bizeps</sub> = 1750 N·cm : 5 cm = <b>350 N</b>.', ok: '<b>Richtig!</b> Dein Bizeps zieht mit dem 7-Fachen der Last – etwa so viel, wie 35 kg wiegen.' },
      { id: 'a5-' + k + '-why', tag: 'Teil 3', type: 'mc', text: 'Warum setzt der Bizeps so „ungünstig“ nah am Gelenk an?', options: [
        { t: 'Ein Konstruktionsfehler der Natur', fb: 'Die Natur hat hier einen Vorteil „eingekauft“. Denk an die Goldene Regel der Mechanik!' },
        { t: 'Der Muskel verkürzt sich nur ein wenig, die Hand bewegt sich aber weit und schnell.', ok: true },
        { t: 'Damit der Muskel weniger Kraft braucht', fb: 'Im Gegenteil – er braucht 7-mal so viel Kraft wie die Last.' }],
        ok: '<b>Genau!</b> Was der Muskel an Kraft „draufzahlt“, gewinnt die Hand an <b>Weg und Geschwindigkeit</b>: Ein paar Zentimeter Muskelweg reichen für einen großen Schwung der Hand – wichtig zum Werfen.' }] },

  { key: 'tuer', em: '🚪', title: 'Die Türklinke', cat: 'alltag', type: 'Drehmoment',
    story: 'Türklinken sitzen fast immer auf der Seite der Tür, die am weitesten von den Scharnieren entfernt ist. Zum Öffnen brauchst du an der Klinke (<b>80 cm</b> von der Drehachse) eine Kraft von <b>5 N</b>.',
    given: ['F = 5 N an der Klinke', 'Abstand Klinke – Drehachse = 80 cm'], sought: 'Begründung und Kraft nahe der Drehachse',
    model: modelDoor,
    qs: (k) => [
      { id: 'a5-' + k + '-mc', tag: 'Teil 1', type: 'mc', text: 'Warum sitzt die Klinke so weit von den Scharnieren entfernt?', options: [
        { t: 'Weil es schöner aussieht und der Griff sonst im Weg wäre.', fb: 'Das mag sein – aber es gibt einen <b>physikalischen</b> Grund.' },
        { t: 'Weil ein großer Hebelarm bei gleicher Kraft ein großes Drehmoment erzeugt.', ok: true },
        { t: 'Weil die Tür sonst quietschen würde.', fb: 'Quietschen hängt von den Scharnieren ab, nicht von der Klinke.' }],
        ok: '<b>Perfekt!</b> M = F · r: Je größer r, desto weniger Kraft brauchst du für dasselbe Drehmoment.' },
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Wie viel Kraft bräuchtest du, wenn du nur <b>10 cm</b> neben der Drehachse drückst? (Das nötige Drehmoment bleibt gleich.)', answer: 40, unit: 'N',
        hints: ['M = 5 N · 80 cm = 400 N·cm', 'F = 400 N·cm : 10 cm'], special: { '0.625': 'Bei <b>kürzerem</b> Hebelarm brauchst du <b>mehr</b> Kraft, nicht weniger.' },
        solution: 'M = 5 N · 80 cm = 400 N·cm. F = 400 N·cm : 10 cm = <b>40 N</b>.', ok: '<b>Richtig!</b> 40 N – achtmal so viel. Probier es zu Hause an einer Tür aus!' }] },

  { key: 'wolf', em: '🐺', title: 'Kieferkraft beim Wolf', cat: 'koerper', type: 'Einseitiger Hebel',
    story: 'Der Kaumuskel eines Wolfs setzt <b>3 cm</b> vor dem Kiefergelenk an und zieht mit <b>1200 N</b>. Der Reißzahn sitzt <b>4 cm</b>, der Eckzahn <b>12 cm</b> vor dem Gelenk.',
    given: ['F<sub>Muskel</sub> = 1200 N', 'Muskel-Arm = 3 cm', 'Reißzahn: 4 cm', 'Eckzahn: 12 cm'], sought: 'Beißkraft am Eckzahn',
    model: modelWolf,
    qs: (k) => [typeQ(k, 'e', 'Richtig: Gelenk hinten, Muskel und Zähne davor – alle auf <b>derselben Seite</b>.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Mit welcher Kraft beißt der Eckzahn zu?', answer: 300, unit: 'N',
        hints: ['M<sub>Muskel</sub> = 1200 N · 3 cm = 3600 N·cm', 'F<sub>Eckzahn</sub> = 3600 N·cm : 12 cm'],
        solution: 'F = 1200 N · 3 cm : 12 cm = <b>300 N</b>.', ok: '<b>Stimmt!</b> 3600 N·cm : 12 cm = 300 N. Am Reißzahn (4 cm) sind es dagegen 900 N.' },
      { id: 'a5-' + k + '-mc', tag: 'Teil 3', type: 'mc', text: 'Warum knacken Raubtiere Knochen mit den <b>hinteren</b> Reißzähnen?', options: [
        { t: 'Weil die hinteren Zähne spitzer sind.', fb: 'Die Form spielt eine Rolle, aber nutze das Hebelgesetz zur Erklärung.' },
        { t: 'Weil der Hebelarm hinten kürzer ist – dort wirkt eine viel größere Kraft.', ok: true },
        { t: 'Weil vorne keine Zähne sind.', fb: 'Vorne sitzen die langen Eckzähne – zum Festhalten.' }],
        ok: '<b>Absolut richtig!</b> Das Drehmoment des Muskels ist fest. Je kürzer der Hebelarm am Zahn, desto größer die Beißkraft.' }] },

  { key: 'rad', em: '🚗', title: 'Reifenwechsel mit dem Radkreuz', cat: 'technik', type: 'Drehmoment',
    story: 'Die Radmuttern eines Autos sind mit einem Drehmoment von <b>120 N·m</b> festgezogen. Dein Radkreuz hat einen Hebelarm von <b>40 cm</b>.',
    given: ['M = 120 N·m', 'r = 40 cm'], sought: 'Kraft F, um die Mutter zu lösen',
    model: modelWrench,
    qs: (k) => [
      { id: 'a5-' + k + '-main', tag: 'Teil 1', type: 'num', text: 'Mit welcher Kraft musst du am Radkreuz mindestens drücken?', answer: 300, unit: 'N',
        hints: ['Achte auf die Einheiten: 40 cm = 0,4 m', 'F = M : r = 120 N·m : 0,4 m'], special: { '3': 'Achtung Einheiten: Du hast N·m durch cm geteilt. Rechne zuerst 40 cm = 0,4 m.', '4800': 'Teile das Drehmoment durch den Hebelarm, statt zu multiplizieren.' },
        solution: 'r = 40 cm = 0,4 m. F = 120 N·m : 0,4 m = <b>300 N</b>.', ok: '<b>Richtig!</b> 300 N – das ist so, als würdest du dich mit 30 kg auf den Griff stellen.' },
      { id: 'a5-' + k + '-mc', tag: 'Teil 2', type: 'mc', text: 'Die Mutter sitzt noch fester. Was hilft am meisten?', options: [
        { t: 'Ein Rohr über den Griff stecken (längerer Hebelarm)', ok: true },
        { t: 'Kürzer greifen, näher an der Mutter', fb: 'Dann wird der Hebelarm kürzer – du brauchst noch mehr Kraft.' },
        { t: 'Ganz schnell drehen', fb: 'Für das Drehmoment zählen Kraft und Hebelarm – nicht die Geschwindigkeit.' }],
        ok: 'Mit einem 80 cm langen Hebelarm bräuchtest du nur noch <b>150 N</b>.' }] },

  { key: 'flasche', em: '🍾', title: 'Der Flaschenöffner', cat: 'alltag', type: 'Einseitiger Hebel',
    story: 'Der Öffner liegt oben auf dem Kronkorken auf (Drehpunkt). Sein Haken greift <b>2 cm</b> weiter unter den Rand des Kronkorkens, der mit <b>50 N</b> festsitzt. Deine Hand hebt <b>10 cm</b> vom Drehpunkt entfernt.',
    given: ['Haltekraft Kronkorken = 50 N', 'Lastarm = 2 cm', 'Kraftarm = 10 cm'], sought: 'Handkraft F<sub>Hand</sub>',
    model: modelOpener,
    qs: (k) => [typeQ(k, 'e', 'Richtig: Haken und Hand liegen auf <b>derselben Seite</b> des Auflagepunkts.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Mit welcher Kraft musst du den Griff anheben?', answer: 10, unit: 'N',
        hints: ['F<sub>Hand</sub> · 10 cm = 50 N · 2 cm', '50 N · 2 cm = 100 N·cm'], special: { '250': 'Die Hand sitzt am <b>langen</b> Arm – sie braucht weniger Kraft als 50 N.' },
        solution: 'F<sub>Hand</sub> = 100 N·cm : 10 cm = <b>10 N</b>.', ok: '<b>Plopp!</b> 10 N reichen – schau ins 3D-Modell.' }] },

  { key: 'kran', em: '🏗️', title: 'Der Baukran', cat: 'technik', type: 'Zweiseitiger Hebel',
    story: 'Ein Baukran hebt einen Container mit <b>10 kN</b> (≈ 1 Tonne) <b>20 m</b> vom Turm entfernt. Auf der anderen Seite hängt das Gegengewicht <b>5 m</b> vom Turm entfernt.',
    given: ['F<sub>Last</sub> = 10 kN', 'Lastarm = 20 m', 'Arm Gegengewicht = 5 m'], sought: 'Gewichtskraft des Gegengewichts',
    model: modelCrane,
    qs: (k) => [typeQ(k, 'z', 'Richtig: Der Turm (Drehpunkt) liegt <b>zwischen</b> Last und Gegengewicht.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Wie groß muss die Gewichtskraft des Gegengewichts sein, damit der Kran im Gleichgewicht ist?', answer: 40, unit: 'kN',
        hints: ['M<sub>Last</sub> = 10 kN · 20 m = 200 kN·m', 'F<sub>G</sub> · 5 m = 200 kN·m'], special: { '2.5': 'Das Gegengewicht sitzt am <b>kurzen</b> Arm. Es muss also schwerer als die Last sein.', '40000': 'Du hast in N umgerechnet – gib das Ergebnis in <b>kN</b> an.' },
        solution: 'F<sub>G</sub> = 10 kN · 20 m : 5 m = <b>40 kN</b> (≈ 4 Tonnen).', ok: '<b>Richtig!</b> 40 kN – das sind etwa 4 Tonnen Beton.' },
      { id: 'a5-' + k + '-plus', tag: 'Teil 3', type: 'num', text: 'Das Gegengewicht bleibt gleich. Wie weit darf die Laufkatze höchstens ausfahren, wenn sie <b>20 kN</b> heben soll?', answer: 10, unit: 'm',
        hints: ['Das Gegengewicht liefert 40 kN · 5 m = 200 kN·m', '20 kN · r = 200 kN·m'],
        solution: 'r = 200 kN·m : 20 kN = <b>10 m</b>.', ok: '<b>Genau!</b> Deshalb hängen an Kränen Schilder: <i>Je weiter außen, desto weniger Last.</i>' }] },

  { key: 'koffer', em: '🧳', title: 'Die Kofferwaage', cat: 'federn', type: 'Hookesches Gesetz',
    story: 'Eine Kofferwaage enthält eine Feder. Sie dehnt sich um <b>2 cm pro 100 N</b>. Als du den Koffer anhebst, dehnt sie sich um <b>4,6 cm</b>.',
    given: ['2 cm pro 100 N', 'Ausdehnung s = 4,6 cm', 'Ortsfaktor g ≈ 10 N/kg'], sought: 'Gewichtskraft des Koffers',
    model: modelLuggage,
    qs: (k) => [
      { id: 'a5-' + k + '-main', tag: 'Teil 1', type: 'num', text: 'Welche Gewichtskraft hat der Koffer?', answer: 230, unit: 'N',
        hints: ['Die Federkonstante ist D = 100 N : 2 cm = 50 N/cm.', 'F = D · s = 50 N/cm · 4,6 cm'], special: { '9.2': 'Das wäre s · 2. Rechne mit D = 50 N/cm.', '2.3': 'Achtung: Die Feder braucht 50 N für jeden Zentimeter.' },
        solution: 'D = 100 N : 2 cm = 50 N/cm. F = D · s = 50 N/cm · 4,6 cm = <b>230 N</b>.', ok: '<b>Richtig!</b> F = D · s = 50 N/cm · 4,6 cm = 230 N.' },
      { id: 'a5-' + k + '-mc', tag: 'Teil 2', type: 'mc', text: 'Die Fluggesellschaft erlaubt höchstens <b>23 kg</b>. Darf der Koffer mit?', options: [
        { t: 'Ja, 230 N entsprechen etwa 23 kg – gerade noch erlaubt.', ok: true },
        { t: 'Nein, 230 kg sind viel zu schwer.', fb: 'Verwechsle nicht Newton und Kilogramm! Mit g ≈ 10 N/kg entsprechen 230 N etwa 23 kg.' },
        { t: 'Das kann man ohne Waage nicht sagen.', fb: 'Die Kofferwaage <b>ist</b> eine Waage – über das Hookesche Gesetz.' }],
        ok: '230 N : 10 N/kg = <b>23 kg</b> – Punktlandung!' }] },

  { key: 'expander', em: '🏋️', title: 'Der Expander', cat: 'federn', type: 'Hookesches Gesetz',
    story: 'Ein Expander für das Krafttraining hat <b>drei gleiche Federn</b> nebeneinander. Jede Feder hat die Federkonstante <b>D = 1,5 N/cm</b>. Du ziehst den Expander um <b>40 cm</b> auseinander.',
    given: ['3 Federn parallel', 'D = 1,5 N/cm je Feder', 's = 40 cm'], sought: 'Gesamtkraft F',
    model: modelExpander,
    qs: (k) => [
      { id: 'a5-' + k + '-main', tag: 'Teil 1', type: 'num', text: 'Mit welcher Kraft musst du ziehen?', answer: 180, unit: 'N',
        hints: ['Eine Feder: F = D · s = 1,5 N/cm · 40 cm', 'Alle drei Federn ziehen gemeinsam: 3 · 60 N'], special: { '60': 'Das ist die Kraft für <b>eine</b> Feder. Der Expander hat aber drei!', '20': 'Rechne mit F = D · s, nicht s : D.' },
        solution: 'Eine Feder: 1,5 N/cm · 40 cm = 60 N. Drei Federn: 3 · 60 N = <b>180 N</b>.', ok: '<b>Stark!</b> 3 · 60 N = 180 N. Im 3D-Modell siehst du, wie die Kraft mit der Dehnung wächst.' },
      { id: 'a5-' + k + '-mc', tag: 'Teil 2', type: 'mc', text: 'Du hängst eine Feder ab. Wie ändert sich die Kraft bei gleicher Dehnung?', options: [
        { t: 'Sie sinkt auf zwei Drittel (120 N).', ok: true },
        { t: 'Sie bleibt gleich.', fb: 'Jede Feder zieht mit – weniger Federn heißt weniger Kraft.' },
        { t: 'Sie halbiert sich.', fb: 'Von 3 Federn bleiben 2 übrig – das ist nicht die Hälfte.' }],
        ok: '2 · 60 N = 120 N. So kann man den Expander an die eigene Kraft anpassen.' }] },

  { key: 'pinzette', em: '🔬', title: 'Die Pinzette', cat: 'werkzeug', type: 'Einseitiger Hebel',
    story: 'Bei der Pinzette drückst du in der Mitte: <b>4 cm</b> vom hinteren Ende (Drehpunkt) entfernt mit <b>6 N</b>. Die Spitze, die einen Holzsplitter greift, ist <b>12 cm</b> vom Drehpunkt entfernt.',
    given: ['F<sub>Finger</sub> = 6 N', 'Kraftarm = 4 cm', 'Lastarm = 12 cm'], sought: 'Kraft an der Spitze',
    model: (g) => modelHinge(g, { size: 15, y: 5, len: 12.5, th: 0.18, w: 1.0, mat: MAT.chrome, joint: true, ridges: true, fx: 4, ox: 12, objR: 0.32, open: 0.07, dimY: 2.6, objLabelUp: 0.6,
      obj: () => { const o = mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8), MAT.woodD); o.rotation.x = Math.PI / 2; return o; }, forceText: 'F_{Finger} = 6 N', objText: 'F_{Spitze} = ?', objTextSolved: 'F_{Spitze} = 2 N' }),
    qs: (k) => [typeQ(k, 'e', 'Richtig: Drehpunkt hinten, Finger und Spitze auf <b>derselben Seite</b>.'),
      { id: 'a5-' + k + '-main', tag: 'Teil 2', type: 'num', text: 'Mit welcher Kraft drückt die Spitze auf den Splitter?', answer: 2, unit: 'N',
        hints: ['F<sub>Spitze</sub> · 12 cm = 6 N · 4 cm', '6 N · 4 cm = 24 N·cm'], special: { '18': 'Hier ist der <b>Lastarm länger</b> als der Kraftarm – die Kraft an der Spitze wird kleiner!' },
        solution: 'F<sub>Spitze</sub> = 24 N·cm : 12 cm = <b>2 N</b>.', ok: '<b>Genau!</b> Nur 2 N – ein Drittel deiner Fingerkraft.' },
      { id: 'a5-' + k + '-mc', tag: 'Teil 3', type: 'mc', text: 'Die Pinzette „verkleinert“ deine Kraft. Wozu ist das gut?', options: [
        { t: 'Man kann feinfühlig greifen, ohne Kleines zu zerdrücken.', ok: true },
        { t: 'Damit man mehr Kraft hat.', fb: 'Das Gegenteil ist der Fall – die Spitze drückt schwächer als deine Finger.' },
        { t: 'Gar nicht – Pinzetten sind schlecht konstruiert.', fb: 'Für ihren Zweck sind sie perfekt gebaut!' }],
        ok: 'Kleine, gut dosierbare Kraft an der Spitze – perfekt für Splitter, Briefmarken oder im Labor.' }] }
];
const CATS = [{ k: 'all', t: 'Alle' }, { k: 'werkzeug', t: '🛠️ Werkzeuge' }, { k: 'koerper', t: '🧬 Körper & Natur' }, { k: 'alltag', t: '🏠 Alltag & Spielplatz' }, { k: 'technik', t: '🏗️ Technik' }, { k: 'federn', t: '🌀 Federn' }];
const CAT_NAME = { werkzeug: 'Werkzeug', koerper: 'Körper & Natur', alltag: 'Alltag', technik: 'Technik', federn: 'Federn' };

function AlltagStation() {
  const st = { stage: null, cur: null, cache: {}, playing: true, filter: 'all' };
  const solved = (k) => !!S.done['a5-' + k];
  function build() {
    st.stage = new Stage('stage5', { id: 5, target: V3(0, 30, 0), radius: 125, theta: 0.35, phi: 1.28, shadow: 70, floorColor: 0xdbe3ec, bg: 0xe8eef5 });
    st.stage.onUpdate((dt) => { const c = st.cur; if (c && st.playing) { c.t += dt; c.r.update(c.t, dt); } });
  }
  function showModel(d) {
    if (!st.stage) return;
    if (st.cur) st.cur.group.visible = false;
    let m = st.cache[d.key];
    if (!m) {
      const g = new THREE.Group();
      const r = d.model(g);
      const K = 60 / r.size;
      g.scale.setScalar(K); g.position.set(-r.center.x * K, 0, -r.center.z * K);
      g.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
      st.stage.scene.add(g);
      m = st.cache[d.key] = { group: g, r, K, t: 0 };
    }
    m.group.visible = true; st.cur = m;
    m.r.setSolved(solved(d.key));
    m.r.update(m.t, 0.016);
    st.stage.setHome({ theta: m.r.theta != null ? m.r.theta : 0.35, phi: m.r.phi != null ? m.r.phi : 1.28, radius: 128 * (m.r.zoom || 1), target: V3(0, m.r.center.y * m.K, 0) });
  }
  function renderFilters() {
    const f = $('s5-filters'); f.innerHTML = '';
    CATS.forEach((c) => { const b = el('button', 'fchip' + (st.filter === c.k ? ' on' : ''), c.t); b.onclick = () => { st.filter = c.k; renderFilters(); renderTiles(); }; f.appendChild(b); });
  }
  function renderTiles() {
    const t = $('s5-tiles'); t.innerHTML = '';
    ALLTAG.filter((d) => st.filter === 'all' || d.cat === st.filter).forEach((d) => {
      const b = el('button', 'tile' + (S.alltag === d.key ? ' on' : '') + (solved(d.key) ? ' solved' : ''), '<span class="em">' + d.em + '</span><span class="tt">' + d.title + '</span><span class="cat">' + CAT_NAME[d.cat] + '</span>');
      b.onclick = () => { select(d.key); if (window.innerWidth < 900) $('stage5').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      t.appendChild(b);
    });
    const n = ALLTAG.filter((d) => solved(d.key)).length;
    $('s5-count').textContent = n + ' / ' + ALLTAG.length + ' gelöst';
    $('s5-bar').style.width = (n / ALLTAG.length * 100) + '%';
    $('s5-congrats').classList.toggle('hidden', n < ALLTAG.length);
  }
  function select(key) {
    const d = ALLTAG.find((x) => x.key === key) || ALLTAG[0];
    S.alltag = d.key; save();
    renderTiles();
    $('s5-title3d').textContent = d.em + ' ' + d.title;
    const box = $('s5-task'); box.innerHTML = '';
    const head = el('div', '', '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:34px;line-height:1">' + d.em + '</span><div><div style="font-size:12px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">' + CAT_NAME[d.cat] + '</div><h3 style="margin:0">' + d.title + '</h3></div><span class="typetag" style="margin-left:auto">' + (solved(d.key) || ['Drehmoment', 'Hookesches Gesetz'].includes(d.type) ? d.type : 'Hebelart?') + '</span></div>' +
      '<p class="story">' + d.story + '</p><ul class="given">' + d.given.map((x) => '<li><b>geg.:</b> ' + x + '</li>').join('') + '<li style="background:var(--amber-l);border-color:#fde68a"><b>ges.:</b> ' + d.sought + '</li></ul>');
    box.appendChild(head);
    const qc = el('div'); qc.style.marginTop = '14px'; box.appendChild(qc);
    QuestionList(qc, 'Aufgaben', d.qs(d.key), {
      onComplete: () => {
        if (!S.done['a5-' + d.key]) {
          S.done['a5-' + d.key] = true; save();
          head.querySelector('.typetag').textContent = d.type;
          if (st.cur && st.cache[d.key] === st.cur) st.cur.r.setSolved(true);
          renderTiles();
          if (ALLTAG.every((x) => solved(x.key))) { markStationDone('tab5'); setTimeout(() => $('s5-congrats').scrollIntoView({ behavior: 'smooth', block: 'center' }), 500); }
          else {
            const nx = el('div', 'q-tools', '');
            const nextD = ALLTAG.find((x) => !solved(x.key));
            if (nextD) { const b = el('button', 'btn amber', 'Nächste Aufgabe: ' + nextD.em + ' ' + nextD.title + ' →'); b.onclick = () => { select(nextD.key); $('s5-tiles').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; nx.appendChild(b); box.appendChild(nx); }
          }
        }
      }
    });
    showModel(d);
  }
  function init() {
    if (Engine.ok) build();
    $('s5-play').onclick = () => { st.playing = !st.playing; $('s5-play').textContent = st.playing ? '⏸' : '▶'; $('s5-state').textContent = st.playing ? '▶ Animation' : '⏸ angehalten'; };
    renderFilters();
    select(S.alltag || ALLTAG[0].key);
  }
  return { init, get stage() { return st.stage; } };
}

/* =========================================================
   Start
   ========================================================= */
const STATIONS = {};
function switchTab(id) {
  document.querySelectorAll('.station').forEach((s) => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
  const stn = STATIONS[id];
  if (!stn.inited) { stn.inited = true; stn.obj.init(); }
  Engine.attach(stn.obj.stage);
  S.tab = id; save();
  const at = document.querySelector('.tab[data-tab="' + id + '"]'); if (at && at.scrollIntoView) at.scrollIntoView({ block: 'nearest', inline: 'center' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
(function boot() {
  Engine.init();
  if (Engine.ok) initMaterials();
  LEVER1 = LeverOne(); LEVER2 = LeverTwo();
  STATIONS.tab1 = { obj: SpringStation({ num: 1, mode: 'A', key: 'm1', questions: QUESTIONS_1 }) };
  STATIONS.tab2 = { obj: SpringStation({ num: 2, mode: 'B', key: 'm2', questions: QUESTIONS_2 }) };
  STATIONS.tab3 = { obj: LEVER1 };
  STATIONS.tab4 = { obj: LEVER2 };
  STATIONS.tab5 = { obj: AlltagStation() };
  document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => switchTab(t.dataset.tab); if (S.done[t.dataset.tab]) t.classList.add('done'); });
  document.querySelectorAll('[data-goto]').forEach((b) => { b.onclick = () => switchTab(b.dataset.goto); });
  // Impressum / Datenschutz
  const openLegal = id => { const d = $(id); if (d && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } };
  document.querySelectorAll('[data-legal]').forEach(a => a.onclick = e => { e.preventDefault(); openLegal(a.dataset.legal); });
  document.querySelectorAll('dialog.legal-dlg').forEach(d => {
    d.querySelector('[data-close]').onclick = () => d.close ? d.close() : d.removeAttribute('open');
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
  });
  if (location.hash === '#impressum' || location.hash === '#datenschutz') openLegal(location.hash.slice(1));
  $('reset-all').onclick = () => { if (confirm('Wirklich den gesamten Fortschritt (alle Messwerte und Antworten) löschen?')) { try { localStorage.removeItem(STORE_KEY); } catch (e) {} location.reload(); } };
  switchTab(STATIONS[S.tab] ? S.tab : 'tab1');
})();
