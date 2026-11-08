/* Activities he really does (Binoy, Nov 3: "paint a picture", "juggle", "show me a cool party trick").
 *   paint   an easel stands to his right; he turns to it with his paintbrush and the picture (planned on the server as
 *           a few bold shapes) builds up on the canvas, shape by shape, each one brushed on in a wipe; then he steps
 *           back to admire it. The page gets the finished picture ("mochi:painted") to keep.
 *   juggle  two or three balls loop between his hooves in a cascade; now and then one gets away (less as he gets
 *           better: `skill`), bounces on the floor, he says oops and picks it up. "mochi:activity" {kind, drops, done}.
 *   trick   magic (star wand, sparkles, something appears), confetti (his popper), balance (a ball on his head),
 *           vanish (poof, gone, poof, back), hat (a spin and his party hat lands on his head), juggle.
 *   routine an entry from his activity book (shared/activity-book.js, built on the server): timed steps of props in his
 *           hooves or on his head, a thing set down beside him (a drum, a pot, a tent), motions, faces, effects, sounds,
 *           Mimi and Cocoa joining in, a ball tossed or a game of catch.
 * Stagecraft calls pose() after the stance (where he is, which way he faces) and limbs() after the arms are posed. */
import * as THREE from "three";
import { validateProp } from "../../shared/craft.js";
import { disposeProp } from "./props.js";
import { MOTIONS } from "../../shared/motions.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
const armRx = (raise) => (raise >= 0 ? -0.62 - 2.0 * raise : -0.62 - 0.9 * raise);
const armRz = (s, spread) => s * (spread >= 0 ? 0.22 + 2.6 * spread : 0.22 + 1.2 * spread);
const emit = (name, detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent(name, { detail })); };
const CW = 512, CH = 384, K = CW / 100;   // the canvas: 100 × 75 planning units
// the easel, just within reach of his brush (the far corner too, leaning over), and how much bigger his brush is for it
const EASEL_AT = [1.2, 0, 0.3], EASEL_SCALE = 0.88, BRUSH_FIT = 1.15;

/* ---------- painting on a 2D canvas ---------- */
function shapePath(c, s) {
  const x = s.x * K, y = s.y * K, w = Math.max(2, s.w * K), h = Math.max(2, s.h * K);
  c.save(); c.translate(x, y); c.rotate(((s.rotate || 0) * Math.PI) / 180); c.beginPath();
  switch (s.shape) {
    case "rect": { const r = Math.min(w, h) * 0.12; c.roundRect ? c.roundRect(-w / 2, -h / 2, w, h, r) : c.rect(-w / 2, -h / 2, w, h); break; }
    case "triangle": c.moveTo(0, -h / 2); c.lineTo(w / 2, h / 2); c.lineTo(-w / 2, h / 2); c.closePath(); break;
    case "line": c.ellipse(0, 0, w / 2, Math.max(1.5, h / 2), 0, 0, Math.PI * 2); break;
    case "star": for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1; c.lineTo(Math.cos(a) * r * w / 2, Math.sin(a) * r * h / 2); } c.closePath(); break;
    case "heart": c.moveTo(0, h * 0.35); c.bezierCurveTo(-w * 0.9, -h * 0.15, -w * 0.3, -h * 0.75, 0, -h * 0.2); c.bezierCurveTo(w * 0.3, -h * 0.75, w * 0.9, -h * 0.15, 0, h * 0.35); c.closePath(); break;
    case "blob": for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2, r = 1 + 0.07 * Math.sin(a * 5 + s.x) + 0.04 * Math.sin(a * 9 + s.y); c.lineTo(Math.cos(a) * r * w / 2, Math.sin(a) * r * h / 2); } c.closePath(); break;
    case "cloud": for (const [cx, cy, r] of [[-0.28, 0.12, 0.3], [0, -0.12, 0.38], [0.3, 0.1, 0.3], [0.05, 0.2, 0.32]]) { c.moveTo(cx * w + r * w, cy * h); c.ellipse(cx * w, cy * h, r * w, r * h * 1.4, 0, 0, Math.PI * 2); } break;
    default: c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);   // circle, ellipse
  }
  c.restore();
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), f = (v) => clamp(Math.round(v * k), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function paintShape(c, s, u, seed) {   // u: how much of it is brushed on (a wipe from one side, a ragged wet edge)
  if (u <= 0) return;
  const x = s.x * K, w = Math.max(4, s.w * K) * 1.25, y = s.y * K, h = Math.max(4, s.h * K) * 1.25;
  c.save();
  if (u < 1) {   // only the part brushed so far: a wipe across it, its edge a little ragged like wet paint
    c.beginPath(); const x0 = x - w / 2, edge = x0 + w * u;
    c.moveTo(x0, y - h / 2 - 4);
    for (let i = 0; i <= 8; i++) { const yy = y - h / 2 - 4 + ((h + 8) * i) / 8; c.lineTo(edge + Math.sin(i * 1.7 + seed) * 5, yy); }
    c.lineTo(x0, y + h / 2 + 4); c.closePath(); c.clip();
  }
  shapePath(c, s); c.fillStyle = s.color; c.fill();
  // brush texture: a few lighter and darker strokes inside the shape, and a soft darker edge
  c.save(); shapePath(c, s); c.clip();
  const r = (i) => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 7; i++) {
    c.strokeStyle = i % 2 ? shade(s.color, 1.12) : shade(s.color, 0.9); c.globalAlpha = 0.22; c.lineWidth = 3 + r(i) * 4; c.lineCap = "round";
    const yy = y - h / 2 + r(i + 9) * h, xx = x - w / 2 + r(i + 3) * w * 0.4;
    c.beginPath(); c.moveTo(xx, yy); c.quadraticCurveTo(xx + w * 0.3, yy - 4 + r(i + 5) * 8, xx + w * (0.4 + r(i + 7) * 0.5), yy + 2); c.stroke();
  }
  c.restore();
  if (s.shape !== "cloud") { c.globalAlpha = 0.35; c.lineWidth = 2; c.strokeStyle = shade(s.color, 0.72); shapePath(c, s); c.stroke(); }   // (a cloud's puffs would show their seams)
  c.restore();
}

export class Activities {
  constructor(craft) {
    this.c = craft; this.m = craft.m;
    this.cur = null;
    this.yaw = 0; this.easelW = 0; this.tmp = new THREE.Vector3();
    this.flights = []; this.leftovers = [];   // routine: balls in the air; scenery folding away after
    this.grp = new THREE.Group(); (this.m.actor || this.m.scene).add(this.grp);
  }
  busy() { return !!this.cur; }
  stop() { if (this.cur) this.end(true); }
  /** spec from the server: { kind: "paint"|"juggle"|"trick", … } */
  start(spec) {
    if (!spec || !spec.kind) return false;
    if (this.cur) this.end(true);
    const now = performance.now(), m = this.m;
    m.touch && m.touch();
    if (this.c.stance && this.c.stance.walking && this.c.stance.walking()) this.c.stance.stopWalk();
    const kind = spec.kind === "trick" && spec.trick === "juggle" ? "juggle" : spec.kind;
    this.cur = { ...spec, kind, t0: now, drops: 0 };
    if (kind === "paint") this.startPaint(spec);
    else if (kind === "juggle") this.startJuggle(spec);
    else if (kind === "trick") this.startTrick(spec);
    else if (kind === "routine") this.startRoutine(spec);
    emit("mochi:activity", { kind: this.cur.kind, trick: spec.trick || null, start: true });
    return true;
  }

  /* ---------- painting ---------- */
  startPaint(spec) {
    const C = this.cur, m = this.m;
    C.plan = spec.painting || { background: "#bfe6ff", shapes: [] };
    const n = C.plan.shapes.length, calm = this.c.reduce;
    C.per = clamp(9000 / Math.max(1, n), 380, 900) * (calm ? 0.6 : 1);   // each shape a moment; ~6–10 s in all
    C.paintAt = 1400; C.doneAt = C.paintAt + n * C.per; C.until = C.doneAt + 12000;
    // the canvas
    const cv = C.cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
    const g = C.g = cv.getContext("2d"); g.fillStyle = "#fbf8f1"; g.fillRect(0, 0, CW, CH);
    C.done = document.createElement("canvas"); C.done.width = CW; C.done.height = CH;
    const dg = C.done.getContext("2d"); dg.fillStyle = "#fbf8f1"; dg.fillRect(0, 0, CW, CH);
    C.bgDone = false; C.painted = -1;
    C.tex = new THREE.CanvasTexture(cv); C.tex.colorSpace = THREE.SRGBColorSpace;
    // the easel: three legs, a ledge, the canvas on it
    const E = C.easel = new THREE.Group(), wood = new THREE.MeshPhysicalMaterial({ color: 0xb98a55, roughness: 0.7, sheen: 0.2 });
    for (const [x, z, rz, rx] of [[-0.42, 0.06, 0.1, -0.04], [0.42, 0.06, -0.1, -0.04], [0, -0.38, 0, 0.4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.9, 10), wood); leg.position.set(x, 0.92, z); leg.rotation.set(rx, 0, rz); E.add(leg);
    }
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.12), wood); ledge.position.set(0, 0.62, 0.1); E.add(ledge);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.95, 0.04), new THREE.MeshPhysicalMaterial({ color: 0xe9dcc4, roughness: 0.85 })); board.position.set(0, 1.12, 0.08); board.rotation.x = -0.1; E.add(board);
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.87), new THREE.MeshStandardMaterial({ map: C.tex, roughness: 0.9 })); canvas.position.set(0, 1.12, 0.103); canvas.rotation.x = -0.1; E.add(canvas);
    for (const [x, y, col] of [[-0.3, 0.665, 0xff6f91], [-0.1, 0.665, 0xffd34d], [0.12, 0.665, 0x7fd1ff]]) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 14), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.4, clearcoat: 0.6 })); pot.position.set(x, y, 0.12); E.add(pot); }
    E.position.set(...EASEL_AT); E.rotation.y = -0.5; E.scale.setScalar(0.001);
    this.grp.add(E);
    C.canvasMesh = canvas; C.ik = null; C.stroke = null; C.sx = CW * 0.3; C.sy = CH * 0.5;
    if (spec.brush && this.c.hold(spec.brush, { ms: C.until + 2000, quiet: true }).ok) {
      const P = C.brushP = this.c.prop, b = P.box;   // its tip: the top middle of the brush (the bristles, the paint on them)
      P.fit = BRUSH_FIT;                              // his big painting brush
      C.tipLocal = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
      C.tipLen = C.tipLocal.length(); C.tipDir = C.tipLocal.clone().normalize();
    }
    m.play && m.play("thinking", 1200);
  }
  /* Where the brush is on the canvas: at the wet edge of the shape going on (the wipe goes left to right), scrubbing up
     and down across it; up off the canvas for a moment between shapes. Canvas pixels, eased so it travels, then the
     world point a hair in front of the canvas and the canvas's facing. */
  strokeAt(now, el) {
    const C = this.cur, shapes = C.plan.shapes, calm = this.c.reduce ? 0.4 : 1, scrub = Math.sin(now / 95) * calm;
    let x, y, lift = 0;
    if (el < C.paintAt || !shapes.length) {   // the background: big sweeps across the middle
      const u = clamp((el - 900) / Math.max(1, C.paintAt - 900), 0, 1);
      x = CW * (0.22 + 0.56 * u); y = CH * (0.5 + 0.3 * scrub);
    } else {
      const k = Math.min(shapes.length - 1, Math.floor((el - C.paintAt) / C.per)), u = clamp((el - C.paintAt - k * C.per) / C.per, 0, 1), s = shapes[k];
      const rot = ((s.rotate || 0) * Math.PI) / 180, sw = Math.max(4, s.w * K), sh = Math.max(4, s.h * K);
      const bw = Math.abs(sw * Math.cos(rot)) + Math.abs(sh * Math.sin(rot)), bh = Math.abs(sw * Math.sin(rot)) + Math.abs(sh * Math.cos(rot));
      const w = sw * 1.25, edge = s.x * K - w / 2 + w * ease(u);   // (as paintShape wipes it)
      x = clamp(edge, s.x * K - bw / 2, s.x * K + bw / 2); y = s.y * K + 0.42 * bh * scrub;
      if (u < 0.16 && k > 0) lift = Math.sin((Math.PI * u) / 0.16);
    }
    if (C.aimAt) { [x, y] = C.aimAt; lift = 0; }   // tests: hold the brush on one spot
    const dt = C.strokeT ? clamp((now - C.strokeT) / 1000, 0, 0.5) : 0.5, f = 1 - Math.exp(-dt * 22); C.strokeT = now;
    C.sx = lerp(C.sx, clamp(x, 12, CW - 12), f); C.sy = lerp(C.sy, clamp(y, 12, CH - 12), f);
    const cm = C.canvasMesh; cm.updateWorldMatrix(true, false);
    const cs = cm.getWorldScale(new THREE.Vector3()).x;
    const n = new THREE.Vector3(0, 0, 1).transformDirection(cm.matrixWorld);
    const on = new THREE.Vector3((C.sx / CW - 0.5) * 1.16, (0.5 - C.sy / CH) * 0.87, 0).applyMatrix4(cm.matrixWorld);
    return { on, T: on.clone().addScaledVector(n, (0.012 + 0.08 * lift) * cs), n, cs, lift };
  }
  brushReach(cs) {   // grip to tip, in the world (no brush: the hoof itself dabs)
    const C = this.cur, P = this.c.prop;
    if (!P || P !== C.brushP || P.leaving || P.slot !== "hand") return { L: 0.05 * cs, brush: false };
    return { L: C.tipLen * P.group.getWorldScale(new THREE.Vector3()).y, brush: true };
  }
  /* His arm: a little search over its pose (raise, spread) for the one that puts the hoof the brush's length away from
     the point on the canvas, well in front of it and facing it, starting from last frame's (so it moves smoothly). */
  paintArm(now, el) {
    const C = this.cur, m = this.m, a = m.arms[1], hand = this.c.hand;
    const w = C.finished ? 1 - ease((now - (C.finishedAt || now)) / 450) : ease((el - 900) / 450);
    if (w <= 0.001 || !C.canvasMesh) { C.stroke = null; return; }
    const S = this.strokeAt(now, el), { L, brush } = this.brushReach(S.cs), T = S.T, n = S.n, G = new THREE.Vector3(), D = new THREE.Vector3();
    const rx0 = a.rotation.x, rz0 = a.rotation.z, tz0 = m.root.rotation.z, bx0 = m.body.rotation.x, ry0 = m.root.rotation.y, front = 0.55 * L;
    // the pose: his arm (raise, spread), and his body: leaning over sideways, leaning in (or back), turning to it
    const put = (r, sp, tilt, lean, turn) => {
      a.rotation.x = armRx(r); a.rotation.z = armRz(1, sp);
      m.root.rotation.z = tz0 - tilt * w; m.body.rotation.x = bx0 + lean * w; m.root.rotation.y = ry0 + turn * w;
    };
    const cost = (r, sp, tilt, lean, turn) => {
      put(r, sp, tilt, lean, turn); hand.getWorldPosition(G); D.subVectors(G, T);
      const d = D.length(), h = D.dot(n);
      return (d - L) ** 2 + 0.015 * (1 - h / Math.max(1e-6, d)) + (h < front ? (front - h) ** 2 * 4 : 0) + 0.03 * (tilt * tilt + lean * lean + 0.5 * turn * turn);
    };
    // from last frame's pose, in small steps, and with a cost for moving his body: the search used to hop between
    // near-equal poses frame to frame, so he trembled as he painted (his head shaking 5 cm: Nov 4 probe)
    const prev = C.ik ? C.ik.slice() : null;
    const still = (y) => (prev ? 0.6 * ((y[2] - prev[2]) ** 2 + (y[3] - prev[3]) ** 2 + (y[4] - prev[4]) ** 2) + 0.08 * ((y[0] - prev[0]) ** 2 + (y[1] - prev[1]) ** 2) : 0);
    const costS = (y) => cost(...y) + still(y);
    let x = prev ? prev.slice() : [0.45, 0.3, 0, 0, 0], best = costS(x);
    const lo = [-0.3, -0.35, -0.15, -0.12, -0.35], hi = [0.98, 0.95, 0.32, 0.38, 0.45];
    for (const st of prev ? [0.03, 0.015, 0.007] : [0.1, 0.05, 0.025, 0.012]) {
      for (let it = 0, moved = true; moved && it < 3; it++) {
        moved = false;
        for (let k = 0; k < x.length; k++) for (const sg of [1, -1]) {
          const y = x.slice(); y[k] = clamp(y[k] + sg * st, lo[k], hi[k]);
          const c = costS(y);
          if (c < best - 1e-9) { best = c; x = y; moved = true; }
        }
      }
    }
    // and his body follows the solution smoothly (the brush slides in his hoof to make up the difference)
    const dt = Math.min(0.05, Math.max(0.001, (now - (C.ikT || now - 16)) / 1000)); C.ikT = now;
    if (prev && C.ikS) { const r = [Math.min(1, dt * 22), Math.min(1, dt * 22), Math.min(1, dt * 7), Math.min(1, dt * 7), Math.min(1, dt * 7)]; C.ikS = C.ikS.map((v, k) => v + (x[k] - v) * r[k]); }
    else C.ikS = x.slice();
    C.ik = x;
    put(...C.ikS);
    a.rotation.x = lerp(rx0, a.rotation.x, w); a.rotation.z = lerp(rz0, a.rotation.z, w);
    hand.getWorldPosition(G);
    C.stroke = { ...S, L, brush, w, miss: (G.distanceTo(T) - L) / L };
  }
  /* After the prop's own pose (Stagecraft calls this last): the brush turned so its tip is on that point, sliding a
     little in his hoof to make up what the arm couldn't. Easing in (and out) the tip travels between where the hold
     had it and the canvas, so it's always the tip that goes where it's sent, and it never goes behind the canvas's
     face: if it would, it touches the nearest point of the canvas it can reach instead. */
  brush() {
    const C = this.cur, S = C && C.kind === "paint" ? C.stroke : null, P = this.c.prop;
    if (!S || !S.brush || !P || P !== C.brushP || P.leaving) { if (C) C.contact = null; return; }
    const hand = this.c.hand, spin = this.c.handSpin, arm = this.m.arms[1], n = S.n;
    arm.updateWorldMatrix(true, false);
    const A = new THREE.Matrix3().setFromMatrix4(arm.matrixWorld), Ai = A.clone().invert();   // (his body breathes: not a pure turn)
    const inner = spin.quaternion.clone().multiply(P.group.quaternion);
    const v = C.tipLocal.clone().multiply(P.group.scale).applyQuaternion(inner);   // grip to tip, in the hoof's frame
    const G = hand.getWorldPosition(new THREE.Vector3()), q0 = hand.quaternion.clone();
    const reach = (q) => v.clone().applyQuaternion(q).applyMatrix3(A);            // grip to tip in the world, the hoof turned q
    const held = G.clone().add(reach(q0)), face0 = S.on.clone().addScaledVector(n, 0.005 * S.cs), hG0 = G.clone().sub(face0).dot(n);
    const aim = held.clone().lerp(S.T, S.w);
    const place = (L, lift = 0) => {   // where the tip goes for a brush this long: at the aim, or the nearest touch of the canvas's face
      const D = Math.max(1e-6, G.distanceTo(aim)), Le = L + clamp(D - L, -0.3 * L, 0.1 * L);   // (choked up on the handle, or held right at its end)
      const face = face0.clone().addScaledVector(n, lift);
      let tip = G.clone().addScaledVector(aim.clone().sub(G), Le / D);
      const hG = hG0 - lift;
      if (tip.clone().sub(face).dot(n) < 0 && hG > 0.005) {
        const foot = G.clone().addScaledVector(n, -hG), to = aim.clone().sub(foot);
        to.addScaledVector(n, -to.dot(n));
        if (to.lengthSq() < 1e-10) to.set(0, 1, 0).addScaledVector(n, -n.y);
        tip = foot.addScaledVector(to.normalize(), Math.sqrt(Math.max(0, Le * Le - hG * hG)));
      }
      return tip;
    };
    const turn = (tip) => {   // the hoof's turn that points the brush there (from how it was held, so it keeps its roll)
      const want = tip.clone().sub(G).applyMatrix3(Ai).normalize(), now = v.clone().applyQuaternion(q0).normalize();
      return new THREE.Quaternion().setFromUnitVectors(now, want).multiply(q0);
    };
    let L = reach(q0).length(), lift = 0, tip, q, k;
    const set = () => {
      tip = place(L, lift); q = turn(tip);
      const L2 = reach(q).length(); if (Math.abs(L2 - L) > 1e-4 * L) { L = L2; tip = place(L, lift); q = turn(tip); L = reach(q).length(); }
      hand.quaternion.copy(q);
      k = G.distanceTo(tip) / Math.max(1e-6, L) - 1;   // slid along in his hoof: the rest of the way
      spin.position.copy(v).multiplyScalar(k);
    };
    set();
    // the tip is on the canvas, but a brush laid at a slant can still dip its side in: lift it by as much and again
    for (let i = 0; i < 2; i++) { const dip = this.dip(P, face0, n); if (dip <= 0.002 * S.cs) break; lift += dip; set(); }
    P.group.updateWorldMatrix(true, false);
    const got = P.group.localToWorld(C.tipLocal.clone()), hG = hG0;
    C.contact = { lift: S.lift, w: S.w, miss: +S.miss.toFixed(3), body: C.ik.slice(2).map((v) => +v.toFixed(2)), slide: +k.toFixed(3), gap: +(got.sub(S.on).dot(n) / S.cs).toFixed(4), hG: +(hG / L).toFixed(3) };
  }
  dip(P, face, n) {   // how far the brush goes behind the canvas's face where it's over the canvas (its vertices, thinned)
    P.group.updateWorldMatrix(true, true);
    const C = this.cur, cm = C.canvasMesh, inv = cm.matrixWorld.clone().invert(), w = new THREE.Vector3(), l = new THREE.Vector3();
    let deep = 0;
    P.group.traverse((o) => {
      const pos = o.isMesh && o.geometry && o.geometry.attributes.position; if (!pos) return;
      const step = Math.max(1, Math.floor(pos.count / 240));
      for (let i = 0; i < pos.count; i += step) {
        w.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const d = face.clone().sub(w).dot(n); if (d <= deep) continue;
        l.copy(w).applyMatrix4(inv); if (Math.abs(l.x) < 0.62 && Math.abs(l.y) < 0.5) deep = d;
      }
    });
    return deep;
  }
  /** tests: how the brush meets the canvas right now: the deepest any of its points goes behind the canvas's face
   * (canvas units; < 0 is through it) and whether that point is over the canvas, the tip's gap, the stroke's lift */
  probe() {
    const C = this.cur, P = this.c.prop;
    if (!C || C.kind !== "paint" || !C.canvasMesh || !P || P !== C.brushP) return null;
    const cm = C.canvasMesh; cm.updateWorldMatrix(true, false); P.group.updateWorldMatrix(true, true);
    const inv = cm.matrixWorld.clone().invert(), v = new THREE.Vector3(), cs = cm.getWorldScale(new THREE.Vector3()).x;
    let deep = Infinity, over = false;
    P.group.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        const inside = Math.abs(v.x) < 0.62 && Math.abs(v.y) < 0.5;   // over the board (canvas and its rim)
        if (inside && v.z < deep) { deep = v.z; over = true; }
      }
    });
    const tip = P.group.localToWorld(C.tipLocal.clone()).applyMatrix4(inv);
    return { deep: over ? +deep.toFixed(4) : null, tipGap: +tip.z.toFixed(4), tipX: +((tip.x / 1.16 + 0.5) * CW).toFixed(1), tipY: +((0.5 - tip.y / 0.87) * CH).toFixed(1),
      aim: C.stroke ? [Math.round(C.sx), Math.round(C.sy)] : null, lift: C.stroke ? +C.stroke.lift.toFixed(2) : null, w: C.stroke ? +C.stroke.w.toFixed(2) : 0, contact: C.contact, cs: +cs.toFixed(3) };
  }
  paintFrame(now) {
    const C = this.cur, el = now - C.t0, g = C.g, dg = C.done.getContext("2d"), shapes = C.plan.shapes;
    const k = el < C.paintAt ? -1 : Math.floor((el - C.paintAt) / C.per), u = el < C.paintAt ? 0 : ((el - C.paintAt) % C.per) / C.per;
    if (!C.bgDone && el >= C.paintAt * 0.7) {   // the background: one big wash first
      C.bgDone = true; dg.fillStyle = C.plan.background; dg.fillRect(0, 0, CW, CH);
      dg.globalAlpha = 0.1; for (let i = 0; i < 40; i++) { dg.fillStyle = i % 2 ? "#ffffff" : "#000000"; dg.fillRect(Math.random() * CW, Math.random() * CH, 30 + Math.random() * 60, 2); } dg.globalAlpha = 1;
    }
    while (C.painted < Math.min(k, shapes.length) - 1) { C.painted++; paintShape(dg, shapes[C.painted], 1, C.painted + 1); }
    g.drawImage(C.done, 0, 0);
    if (k >= 0 && k < shapes.length) paintShape(g, shapes[k], ease(u), k + 1);
    C.tex.needsUpdate = true;
    if (k >= shapes.length && !C.finished) {
      C.finished = true; C.finishedAt = now;
      for (let i = C.painted + 1; i < shapes.length; i++) paintShape(dg, shapes[i], 1, i + 1);
      g.drawImage(C.done, 0, 0); C.tex.needsUpdate = true;
      const m = this.m; m.play && m.play("proud", 2600); m.spawn && [0, 1, 2].forEach(() => m.spawn("star", 1400));
      let png = null; try { png = C.cv.toDataURL("image/png"); } catch (_) { /* fine */ }
      emit("mochi:painted", { subject: C.subject || "", title: C.plan.title || "", png });
      emit("mochi:activity", { kind: "paint", done: true });
    }
  }

  /* ---------- juggling ---------- */
  startJuggle(spec) {
    const C = this.cur, n = clamp(spec.balls || 3, 2, 4), cols = [0xff6f91, 0xffd34d, 0x4fd0c0, 0xa77ce8];
    C.n = n; C.skill = clamp(spec.skill ?? 0.3, 0, 1); C.T = 0.36; C.until = (spec.ms || 7000) + 600; C.lastDrop = -1e9; C.cycle = new Array(n).fill(-1);
    C.balls = cols.slice(0, n).map((col) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, clearcoat: 0.6 })); b.visible = false; this.grp.add(b); return { mesh: b, drop: null }; });
    this.c.letGo && this.c.letGo(false);
  }
  hands() {   // where his hooves are (in the actor's space)
    const m = this.m, sc = m.root.scale.x, x = m.root.position.x, y = m.root.position.y, z = (m.root.position.z || 0) + 0.78 * sc;   // in front of his round tummy
    return [new THREE.Vector3(x - 0.42 * sc, y + 0.62 * sc, z), new THREE.Vector3(x + 0.42 * sc, y + 0.62 * sc, z)];
  }
  juggleFrame(now, dt) {
    const C = this.cur, m = this.m, el = (now - C.t0) / 1000, sc = m.root.scale.x, [L, R] = this.hands(), H = 1.2 * sc * (this.c.reduce ? 0.6 : 1);
    const ending = el * 1000 > C.until - 600;
    C.balls.forEach((B, i) => {
      const o = B.mesh; o.visible = el > 0.3;
      if (B.drop) {   // falling, bouncing, lying there, then he picks it up
        const d = B.drop, t = (now - d.t0) / 1000;
        if (t < 1.6) {
          d.v.y -= 9 * dt; d.p.addScaledVector(d.v, dt);
          if (d.p.y < 0.085) { d.p.y = 0.085; d.v.y = Math.abs(d.v.y) * 0.45; d.v.x *= 0.7; }
          o.position.copy(d.p); o.scale.setScalar(1);
        } else if (t < 1.9) { o.scale.setScalar(Math.max(0.01, 1 - (t - 1.6) / 0.3)); }
        else { B.drop = null; o.scale.setScalar(1); }
        return;
      }
      const ph = el / C.T + i * (2 * C.n) / C.n / 2, cyc = Math.floor(ph / C.n), f = (ph % C.n) / C.n;
      if (cyc !== C.cycle[i] && el > 0.6 && !ending) {   // a throw: sometimes it gets away
        C.cycle[i] = cyc;
        const pDrop = 0.3 * (1 - C.skill) ** 1.5;
        if (Math.random() < pDrop && now - C.lastDrop > 1800) {
          C.lastDrop = now; C.drops++;
          B.drop = { t0: now, p: o.position.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.4, 0.5) };
          m.play && m.play("oops", 900); if (m.say && C.drops === 1) m.say(["Oops!", "Whoa—!", "Butterhooves!"][Math.floor(Math.random() * 3)]);
          return;
        }
      }
      const fromL = cyc % 2 === 0, A = fromL ? L : R, Bh = fromL ? R : L;
      if (f < 0.78) { const u = f / 0.78; o.position.lerpVectors(A, Bh, u); o.position.y += 4 * H * u * (1 - u); o.position.z += 0.05 * Math.sin(Math.PI * u); }
      else { const u = (f - 0.78) / 0.22; o.position.copy(Bh); o.position.x += (fromL ? -1 : 1) * 0.1 * sc * Math.sin(Math.PI * u); o.position.y -= 0.06 * sc * Math.sin(Math.PI * u); }
      if (ending) o.scale.setScalar(Math.max(0.01, 1 - (el * 1000 - (C.until - 600)) / 600));
    });
    if (el * 1000 >= C.until - 50 && !C.finished) {
      C.finished = true;
      m.play && m.play(C.drops ? "laugh" : "proud", 2000); if (m.spawn) m.spawn("star", 1200);
      emit("mochi:activity", { kind: "juggle", drops: C.drops, done: true });
    }
  }

  /* ---------- party tricks ---------- */
  startTrick(spec) {
    const C = this.cur, m = this.m, tr = spec.trick;
    C.until = { magic: 5200, confetti: 3600, balance: 5200, vanish: 4200, hat: 3200 }[tr] || 4000;
    if (tr === "magic" && spec.wand) this.c.hold(spec.wand, { ms: 2600, quiet: true });
    if (tr === "confetti" && spec.popper) this.c.hold(spec.popper, { ms: 5000, quiet: true });
    if (tr === "balance") { this.c.letGo && this.c.letGo(false); C.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 22, 16), new THREE.MeshPhysicalMaterial({ color: 0xff6f91, roughness: 0.35, clearcoat: 0.6 })); C.ball.visible = false; this.grp.add(C.ball); }
    if (tr === "hat") this.c.letGo && this.c.letGo(false);
    m.play && m.play("excited", 1200);
  }
  trickFrame(now, dt) {
    const C = this.cur, m = this.m, el = now - C.t0, tr = C.trick;
    const once = (key, at, fn) => { const k = `_once_${key}`; if (el >= at && !C[k]) { C[k] = true; fn(); } };   // (its own keys: C.reveal and C.hat are the spec's)
    if (tr === "magic") {
      once("spark", 1500, () => { if (m.spawn) for (let i = 0; i < 7; i++) m.spawn(i % 2 ? "star" : "confetti", 1400); m.say && m.say("Abracadabra!"); });
      once("reveal", 2100, () => {
        if (C.reveal && C.reveal.recipe) { this.c.hold(C.reveal, { ms: 9000 }); m.play && m.play("proud", 2200); m.say && m.say("Ta-da!"); }
        else { m.play && m.play("oops", 1600); m.say && m.say(C.make ? `My ${C.make} isn't ready yet!` : "Hmm… just sparkles!"); }
        if (m.spawn) for (let i = 0; i < 4; i++) m.spawn("star", 1100);
      });
    } else if (tr === "confetti") {
      once("pop", 1300, () => { if (this.c.fire) this.c.fire(); if (m.spawn) for (let i = 0; i < 8; i++) m.spawn("confetti", 1800); m.play && m.play("superexcited", 1600); m.say && m.say("Surprise!"); });
    } else if (tr === "balance") {
      const B = C.ball, head = m.head ? m.head.localToWorld(this.tmp.set(0, 0.62, 0.05)) : null;
      if (B && head) {
        (m.actor || m.scene).worldToLocal(head); B.visible = el > 300 && el < 4600;
        const wob = Math.sin(el / 170) * 0.05 * (this.c.reduce ? 0.3 : 1);
        if (el < 700) { const u = ease((el - 300) / 400); head.y += (1 - u) * 0.8; }   // tossed up, lands on his head
        if (el > 3900) { const u = (el - 3900) / 700; head.y += Math.sin(Math.PI * clamp(u, 0, 1)) * 0.9; head.x += 0.35 * u; }   // bounced up, caught
        B.position.set(head.x + wob, head.y, head.z);
      }
      once("caught", 4600, () => { m.play && m.play("proud", 2000); m.say && m.say("Ta-da!"); if (m.spawn) m.spawn("star", 1200); });
    } else if (tr === "vanish") {
      once("poof1", 400, () => { if (m.spawn) for (let i = 0; i < 6; i++) m.spawn("confetti", 1200); m.say && m.say("Now you see me…"); });
      once("poof2", 2200, () => { if (m.spawn) for (let i = 0; i < 6; i++) m.spawn("star", 1200); m.play && m.play("proud", 1800); m.say && m.say("Ta-da!"); m.hop && m.hop(0.2, 380, 0); });
    } else if (tr === "hat") {
      once("hat", 1300, () => { if (C.hat) this.c.hold(C.hat, { ms: 30000, quiet: true }); if (m.spawn) for (let i = 0; i < 4; i++) m.spawn("star", 1100); m.play && m.play("proud", 1800); m.say && m.say("Ta-da!"); });
      once("hop", 300, () => { m.hop && m.hop(0.32, 700, 0); });
    }
    if (el >= C.until - 50 && !C.finished) { C.finished = true; emit("mochi:activity", { kind: "trick", trick: tr, done: true }); }
  }

  /* ---------- a routine from his activity book ---------- */
  startRoutine(spec) {
    const C = this.cur;
    C.steps = (spec.steps || []).slice().sort((a, b) => a.at - b.at); C.i = 0; C.until = clamp(spec.ms || 8000, 2000, 45000);
    C.sets = []; C.later = []; C.turn = 0; C.worn = []; C.arm = null;
    C.wasStanding = !!(this.c.stance && this.c.stance.standing && this.c.stance.standing());
    for (const slot of ["head", "body"]) {   // the last activity's chef hat or swim ring comes off first (unless this one wears it too)
      const W = this.c.worn && this.c.worn[slot], keep = (spec.steps || []).some((s) => s.do === "wear" && s.prop && W && s.prop.name === W.recipe.name);
      if (W && !W.leaving && (this.lastWorn || []).includes(W.recipe.name) && !keep) this.c.takeOff(slot, false);
    }
    const P = this.c.prop;
    if (P && !P.leaving && (P.slot === "head" || P.slot === "body") && (this.lastWorn || []).includes(P.recipe.name) && !(spec.steps || []).some((s) => s.do === "wear" && s.prop && s.prop.name === P.recipe.name)) this.c.letGo(false);
    if (this.c.prop && !this.c.prop.leaving && this.c.prop.slot === "beside") this.c.letGo(true);   // room for the scenery
    // the reply's face ends now, so his first motion starts on time instead of waiting behind it
    const m = this.m; if (m.cur && m.cur !== "performing") m.curEnd = performance.now();
    if (Array.isArray(m.queue)) m.queue = m.queue.filter((q) => q[0] === "@wear" || q[0] === "@perf");
  }
  later(ms, fn) { const C = this.cur; if (C) C.later.push({ at: performance.now() + ms, fn }); }
  handAt() { const v = new THREE.Vector3(); (this.c.hand || this.m.root).getWorldPosition(v); return this.grp.worldToLocal(v); }
  friendAt(who) {
    const S = this.m.scuffle, m = this.m; if (!S) return null;
    const here = who === "cocoa" ? m.bud && !m.bud.leaving : m.gf && !m.gf.leaving; if (!here) return null;   // (the target is always somewhere, even when they've gone)
    try { const w = who === "cocoa" ? S.target("cocoa") : S.mimiTarget(); return w ? this.grp.worldToLocal(w.clone()).add(new THREE.Vector3(0, -0.28, 0.1)) : null; } catch (_) { return null; }
  }
  /** a copy of a prop flies from a to b (balls in a game); rest: it stays where it lands until the routine ends */
  fly(recipe, from, to, { dur = 0.8, arc = 1, onLand = null, rest = false } = {}) {
    const v = validateProp(recipe); if (!v.recipe || !from || !to) return null;
    const g = this.c.build(v.recipe), pivot = new THREE.Group(); pivot.add(g); g.position.y = -0.15;
    pivot.scale.setScalar(this.m.root.scale.x); pivot.position.copy(from); this.grp.add(pivot);
    const F = { pivot, g, from: from.clone(), to: to.clone(), t0: performance.now(), dur, arc, onLand, rest, landed: false };   // (by the clock: a slow frame rate mustn't slow the ball)
    this.flights.push(F); return F;
  }
  dropFlight(F) { disposeProp(F.g); this.grp.remove(F.pivot); const i = this.flights.indexOf(F); if (i >= 0) this.flights.splice(i, 1); }   // (its geometry and materials go too)
  stepFlights(now, dt) {
    for (const F of this.flights.slice()) {
      if (F.landed) continue;
      const u = Math.min(1, (now - F.t0) / (F.dur * 1000));
      F.pivot.position.lerpVectors(F.from, F.to, u); F.pivot.position.y += F.arc * 4 * u * (1 - u);
      F.pivot.rotation.z -= Math.min(dt, 0.1) * 7;
      if (u < 1) continue;
      F.landed = true; const fn = F.onLand; F.onLand = null;
      if (!F.rest) this.dropFlight(F);
      if (fn) fn(F);
    }
  }
  setDown(prop) {   // a thing set down beside him for the activity: the drum, the pot, the tent
    const v = prop && validateProp(prop.recipe || prop); if (!v || !v.recipe) return;
    const g = this.c.build(v.recipe), box = new THREE.Box3().setFromObject(g), w = box.max.x - box.min.x;
    const C = this.cur, sc0 = this.m.root.scale.x, holder = new THREE.Group(); holder.add(g);
    // something he plays or works at (a drum, a piano, a pot on its stove) goes right in front of him, under his hooves;
    // anything else sits on the ground beside him, turned a little toward him
    // small things for everyone (a cake, a campfire, a picnic basket) go on the ground in front, a little to his right
    // (the screen's left), in front of where Cocoa stands; tall or far ones (a tent, a snowman, the pins) beside him
    const n = v.recipe.name, front = /\b(?:drum|piano|pot)\b/.test(n) && !C.sets.some((S) => S.front), low = !front && /cake|campfire|picnic|present|duck|sandcastle|sunflower|pins/.test(n);
    const side = front ? 0 : -1, rx = this.m.root.position.x, rz = this.m.root.position.z || 0;
    const dv = this.m.duo ? clamp(this.m.duo.x, 0, 1) : 0, sc = front || low ? sc0 * 0.82 : sc0;
    if (front) holder.position.set(rx + 0.12 * sc0, 0, rz + 0.95 * sc0);
    else if (low && /sunflower/.test(n)) holder.position.set(rx + (0.7 + (w / 2) * 0.82) * sc0, 0, rz + 0.86 * sc0);   // on the side of his watering-can hoof
    else if (low) holder.position.set(rx - (0.62 + (w / 2) * 0.82) * sc0, 0, rz + 0.92 * sc0);
    else holder.position.set(-(0.66 + (w / 2) * sc + 0.08) - 0.6 * dv, 0, 0.26);
    holder.rotation.y = front ? 0 : low ? (/sunflower/.test(n) ? -0.25 : 0.25) : 0.34; holder.scale.setScalar(0.001); this.grp.add(holder);
    const S = { holder, side: side || 1, front, born: performance.now(), sc, knock: 0, name: n };
    C.sets.push(S);
    if (!C.turn && !front) C.turn = -0.2;   // a glance toward it
    for (let i = 0; i < 3; i++) this.m.spawn && this.m.spawn("star", 1000);
  }
  step(s, el) {   // one step of the routine
    const m = this.m, c = this.c, C = this.cur, left = Math.max(1500, C.until - el);
    switch (s.do) {
      case "hold": case "wear": if (s.prop && s.prop.recipe) { c.hold(s.prop.recipe, { ms: left + 2500, quiet: s.do === "hold" }); if (s.do === "wear") C.worn.push(s.prop.name); } break;
      case "set": this.setDown(s.prop); break;
      case "undress": for (const k of ["head", "body"]) if (c.worn[k] && !c.worn[k].leaving) c.takeOff(k, true); break;   // dressing up for a job: yesterday's job comes off first (Nov 7)
      case "motion": {
        const P = c.prop && !c.prop.leaving && c.prop.slot === "hand" ? c.prop.base : null;
        if (s.recipe) c.play(s.recipe, { skill: s.skill ?? 0.9, prop: s.recipe.prop ? P : null, name: C.name || s.recipe.name });
        break;
      }
      case "face": {   // after the last move: if it's still finishing, a moment later (it was being skipped)
        const go = (n) => { if (!this.cur || this.cur !== C) return; if (c.perf && n < 8) return this.later(250, () => go(n + 1)); if (m.play) m.play(s.name || "happy", s.ms || 1500); };
        go(0); break;
      }
      case "fx": { const n = clamp(s.n || 3, 1, 10); for (let i = 0; i < n; i++) m.spawn && m.spawn(s.kind || "star", s.kind === "snow" ? 2600 : undefined, s.kind === "orbit" ? i / n : s.kind === "huff" ? (i % 2 ? 1 : -1) : undefined); break; }
      case "say": if (s.text && m.say) m.say(s.text); break;
      case "friend": { const go = () => m.friend && m.friend(s.who, s.role || "hello", left + 4000); if (!go()) [700, 1400, 2400].forEach((t) => this.later(t, go)); break; }
      case "fsay": {
        const say = () => { if (m.scuffle && m.scuffle.friendSay) m.scuffle.friendSay(s.who, s.text, 2400); };
        const here = m.friendsHere ? !!m.friendsHere()[s.who] : true;
        if (!here) { m.friend && m.friend(s.who, "hello", left + 4000); this.later(1300, say); } else { m.stayFriend && m.stayFriend(s.who, left + 3000); say(); }
        emit("mochi:activity", { kind: "routine", id: C.id, who: s.who, line: s.text });
        break;
      }
      case "fmove": if (m.friendMoves && s.recipe) try { m.friendMoves.play(s.who, s.recipe, { skill: 0.6 }); } catch (_) { /* not here yet */ } break;
      case "bye": if (m.dismissFriend) m.dismissFriend(s.who, { quiet: true }); break;
      case "hug": if (m.friendMoves && m.friendMoves.hug) m.friendMoves.hug(s.who); break;
      case "use": if (c.useProp) c.useProp(); break;
      case "toss": this.toss(s.to || "up"); break;
      case "knock": { const S = C.sets[C.sets.length - 1]; if (S) S.knock = performance.now(); for (let i = 0; i < 5; i++) m.spawn && m.spawn("star", 1100); break; }
      case "catch": this.catchGame(s.who || "cocoa", s.n || 2); break;
      case "sound": emit("mochi:sound", { kind: s.kind, ms: s.ms || 2000 }); break;
      case "walk": if (c.stance && c.stance.walkTo && c.stance.walkTo(clamp(+s.x || 1, -1.3, 1.3))) C.walked = true; break;
      case "hop": m.hop && m.hop(0.3, 420, 0); break;
    }
  }
  heldBall() { const P = this.c.prop; return P && !P.leaving && P.slot === "hand" ? P.base : null; }
  toss(to) {
    const ball = this.heldBall(), m = this.m;
    if (to === "viewer") { if (this.c.atViewer && this.c.atViewer()) return; }
    if (!ball) return;
    const from = this.handAt(); this.c.letGo(true);
    if (to === "set" && this.cur.sets.length) {
      const S = this.cur.sets[this.cur.sets.length - 1], at = S.holder.position.clone().add(new THREE.Vector3(0, 0.22, 0.05));
      this.fly(ball, from, at, { dur: 0.9, arc: 0.35, rest: false, onLand: () => { for (let i = 0; i < 4; i++) m.spawn && m.spawn("star", 1000); } });
      return;
    }
    const top = from.clone().add(new THREE.Vector3(0.45, 2.4, 0)), floor = from.clone().set(from.x + 1.0, 0.18, from.z + 0.2);
    this.fly(ball, from, top, { dur: 0.6, arc: 0.2, onLand: () => this.fly(ball, top, floor, { dur: 0.55, arc: 0.15, rest: true, onLand: () => { for (let i = 0; i < 4; i++) m.spawn && m.spawn("star", 1000); } }) });
  }
  catchGame(who, n) {   // the ball goes to Cocoa (or Mimi) and back, n times; the last one he catches with a cheer
    const m = this.m, C = this.cur, ball = this.heldBall() || (C.steps.find((s) => s.do === "hold") || {}).prop?.recipe; if (!ball) return;
    // (his arms are posed straight from here, in limbs(): moves queued behind his "performing" mood drifted away from
    // the ball, and by the second round he threw with an empty hoof). One round is ~3.3 s: server/book.js CATCH_ROUND_MS.
    const round = (k) => {
      if (this.cur !== C) return;
      const at = this.friendAt(who);
      if (!at) { m.say && m.say("Hmm, where'd they go?"); return; }
      C.arm = { kind: "throw", t0: performance.now() };
      this.later(450, () => {
        if (this.cur !== C) return;
        const from = this.handAt(); this.c.letGo(true);
        this.fly(ball, from, at, { dur: 0.75, arc: 0.9, rest: true, onLand: (F) => {
          if (k === 0 && m.scuffle && m.scuffle.friendSay) m.scuffle.friendSay(who, "Got it!", 1400);
          this.later(600, () => {
            this.dropFlight(F);
            if (this.cur !== C) return;
            const back = this.friendAt(who) || at;
            C.arm = { kind: "catch", t0: performance.now() + 350 };
            this.fly(ball, back, this.handAt(), { dur: 0.75, arc: 0.9, onLand: () => {
              if (this.cur !== C) return;
              this.c.hold(ball, { ms: 8000, quiet: true, instant: true });
              if (k === n - 1) { m.say && m.say("Got it!"); for (let i = 0; i < 4; i++) m.spawn && m.spawn("star", 1000); }
              else this.later(750, () => round(k + 1));
            } });
          });
        } });
      });
    };
    round(0);
  }
  routineFrame(now, dt) {
    const C = this.cur, el = now - C.t0;
    while (C.i < C.steps.length && C.steps[C.i].at <= el) { const s = C.steps[C.i++]; try { this.step(s, el); } catch (e) { console.warn("[routine]", s.do, e); } }
    for (const L of C.later.slice()) if (now >= L.at) { C.later.splice(C.later.indexOf(L), 1); try { L.fn(); } catch (e) { console.warn("[routine]", e); } }
    for (const S of C.sets) {
      const k = ease((now - S.born) / 450);
      S.holder.scale.setScalar(Math.max(0.001, k * S.sc * (1 + 0.08 * Math.sin(Math.PI * clamp((now - S.born) / 450, 0, 1)))));
      if (S.knock) { const u = ease((now - S.knock) / 500); S.holder.rotation.z = S.side * 1.35 * u; S.holder.position.y = -0.05 * u; }
    }
    if (this.c.keep) this.c.keep(2500);
    if (el >= C.until - 50 && !C.finished) { C.finished = true; emit("mochi:activity", { kind: "routine", id: C.id, done: true }); }
  }

  /* ---------- every frame ---------- */
  pose(now, dt) {
    const m = this.m, C = this.cur, calm = this.c.reduce ? 0.35 : 1;
    // the easel: up while painting (and a while after, to admire), then folded away
    const wantE = C && C.kind === "paint" && now - C.t0 < C.until ? 1 : 0;
    this.easelW += (wantE - this.easelW) * Math.min(1, dt * (wantE ? 5 : 3));
    const E = C && C.easel ? C.easel : this.lastEasel;
    if (E) { const k = ease(clamp(this.easelW, 0, 1)); E.scale.setScalar(Math.max(0.001, k * EASEL_SCALE)); E.visible = k > 0.01; }
    this.stepFlights(now, dt);
    for (const L of this.leftovers.slice()) {   // the routine's scenery folds away
      const u = clamp((now - L.t0) / 500, 0, 1); L.holder.scale.setScalar(Math.max(0.001, (1 - ease(u)) * L.sc));
      if (u >= 1) { disposeProp(L.holder); this.grp.remove(L.holder); this.leftovers.splice(this.leftovers.indexOf(L), 1); }
    }
    if (!C) { this.yaw *= Math.exp(-dt * 4); m.root.rotation.y += this.yaw; if (this.lastEasel && this.easelW < 0.01) { this.grp.remove(this.lastEasel); this.lastEasel = null; } return; }
    const el = now - C.t0;
    if (C.kind === "paint") {
      if (!C.finished) this.paintFrame(now);
      const painting = el > 600 && !C.finished, admire = C.finished;
      this.yaw = lerp(this.yaw, painting ? 0.62 : admire ? 0.22 : 0, 1 - Math.exp(-dt * 4));
      m.root.rotation.y += this.yaw;
      if (painting) { m.neck.rotation.y += 0.25; m.neck.rotation.x += 0.08 * Math.sin(now / 900); if (m.P.lookX) { m.P.lookX.t = 0.8; m.P.lookY.t = 0.1; } }
      if (this.c.keep) this.c.keep(2000);
    } else if (C.kind === "routine") {
      this.routineFrame(now, dt);
      const turning = C.turn && !C.finished && el > 500;
      this.yaw = lerp(this.yaw, turning ? C.turn : 0, 1 - Math.exp(-dt * 4));
      m.root.rotation.y += this.yaw;
    } else if (C.kind === "juggle") {
      this.juggleFrame(now, dt);
      m.neck.rotation.x -= 0.18 + 0.05 * Math.sin(now / 180) * calm;   // eyes up on the balls
    } else if (C.kind === "trick") {
      this.trickFrame(now, dt);
      if (C.trick === "vanish") {   // shrinks to nothing in a puff, then pops back with a bounce
        const k = el < 450 ? 1 : el < 900 ? 1 - ease((el - 450) / 450) : el < 2200 ? 0 : el < 2600 ? 1 + 0.25 * Math.sin(Math.PI * (el - 2200) / 400) * calm : 1;
        m.root.scale.multiplyScalar(Math.max(0.001, k)); if (m.ground) m.ground.scale.multiplyScalar(Math.max(0.001, Math.min(1, k)));
      }
      if (C.trick === "hat" && el > 300 && el < 1300) m.root.rotation.y += Math.PI * 2 * ease((el - 300) / 1000) * calm;   // a spin
      if (C.trick === "balance") m.neck.rotation.z += Math.sin(el / 170) * 0.06 * calm;
    }
    if (el > (C.until || 6000)) this.end(false);
  }
  limbs(now) {
    const C = this.cur, m = this.m; if (!C) return;
    const el = now - C.t0, calm = this.c.reduce ? 0.35 : 1, set = (i, raise, spread) => { const a = m.arms[i], s = i ? 1 : -1; a.rotation.x = armRx(raise); a.rotation.z = armRz(s, spread); };
    if (C.kind === "routine" && C.arm) {   // catch: a throw overarm, then both hooves up for the ball coming back
      const u = (now - C.arm.t0) / (C.arm.kind === "throw" ? 600 : 700);
      if (u >= 0 && u <= 1) {
        const k = Math.sin(Math.PI * u);
        if (C.arm.kind === "throw") set(1, 0.3 + 0.7 * k * (u < 0.6 ? 1 : 0.5), 0.15 * k);
        else { set(0, 0.25 + 0.4 * k, 0.25 * k); set(1, 0.25 + 0.4 * k, 0.25 * k); }
      }
    }
    if (C.kind === "paint") this.paintArm(now, el);   // the brush's tip on the canvas, where the paint is going on
    else if (C.kind === "juggle") { const b = (i) => 0.06 * Math.sin((now / 1000 / C.T) * Math.PI + (i ? Math.PI : 0)) * calm; set(0, 0.22 + b(0), -0.12); set(1, 0.22 + b(1), -0.12); }
    else if (C.kind === "trick") {
      if (C.trick === "magic" && el < 2100) set(1, 0.55 + 0.25 * Math.sin(now / 120) * calm, 0.2 + 0.15 * Math.cos(now / 160) * calm);   // waving the wand
      if (C.trick === "balance" && el > 300 && el < 4600) { set(0, 0.05, 0.55 + 0.06 * Math.sin(el / 230) * calm); set(1, 0.05, 0.55 - 0.06 * Math.sin(el / 230) * calm); }   // arms out for balance
      if (C.trick === "hat" && el < 1300) { set(0, 0.85, 0.2); set(1, 0.85, 0.2); }
    }
  }
  end(interrupted) {
    const C = this.cur; if (!C) return;
    if (C.balls) for (const B of C.balls) { this.grp.remove(B.mesh); B.mesh.geometry.dispose(); B.mesh.material.dispose(); }
    if (C.ball) { this.grp.remove(C.ball); C.ball.geometry.dispose(); }
    if (C.easel) this.lastEasel = C.easel;
    if (C.sets) for (const S of C.sets) this.leftovers.push({ holder: S.holder, sc: S.sc, t0: performance.now() });
    if (C.worn) this.lastWorn = C.worn;
    if (C.kind === "routine") {
      const m = this.m;   // its moves still waiting in line don't play after it's over; one cut short stops
      if (Array.isArray(m.queue)) m.queue = m.queue.filter((q) => !(q[0] === "@perf" && q[1] && q[1].name === C.name));
      if (interrupted && this.c.perf && this.c.perf.name === C.name) this.c.stop();
      if (C.walked && !C.wasStanding && this.c.stance && this.c.stance.sit) setTimeout(() => { if (!this.cur && !(this.c.stance.walking && this.c.stance.walking())) this.c.stance.sit({ quiet: true }); }, 400);
    }
    for (const F of this.flights.slice()) this.dropFlight(F);
    if (!C.finished) emit("mochi:activity", { kind: C.kind, trick: C.trick || null, drops: C.drops || 0, done: true, interrupted: !!interrupted });
    this.cur = null;
  }
}
