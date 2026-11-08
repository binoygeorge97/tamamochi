/* A dance party (Binoy, Nov 3: "allow mochi to be able to dance and even party with his friends").
 *   "let's dance" / "party time!": a disco ball drops down over him, coloured beams sweep the stage, music notes float
 *   up, confetti pops on the beat. He stands up and dances a routine; Mimi and Cocoa come in and dance the same
 *   routine with him (their own bodies, in step, a little wobbly), then the next routine, and the next.
 *   Zero Day: chrome ball, green/cyan/magenta lasers, and the picture glitches on the drops.
 *   It ends with everyone cheering; the ball goes back up and he sits down. The page plays the music (web/party.js). */
import * as THREE from "three";
import { validateMove, MOVE_EXAMPLES } from "../../shared/craft.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const BEAT = 0.5;   // seconds (120 bpm)
const emit = (name, detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent(name, { detail })); };

// routines, on the beat (a key every half second or quarter beat)
const k = (pairs) => pairs.map(([t, v]) => [t * BEAT, v]);
const ROUTINES = [
  MOVE_EXAMPLES.find((m) => m.name === "happy dance"),
  { name: "party groove", tracks: {
    "rightArm.raise": k([[0, 0], [1, 1], [2, 0.2], [3, 1], [4, 0.2], [5, 1], [6, 0.2], [7.6, 0]]),
    "leftArm.raise": k([[0, 0], [1, 0.2], [2, 1], [3, 0.2], [4, 1], [5, 0.2], [6, 1], [7.6, 0]]),
    "body.sway": k([[0, 0], [1, 0.7], [2, -0.7], [3, 0.7], [4, -0.7], [5, 0.7], [6, -0.7], [7.6, 0]]),
    "body.hop": k([[0, 0], [0.5, 0.25], [1, 0], [2.5, 0.25], [3, 0], [4.5, 0.25], [5, 0], [6.5, 0.25], [7, 0]]),
    "head.tilt": k([[0, 0], [1, 0.6], [2, -0.6], [3, 0.6], [4, -0.6], [5, 0.6], [6, -0.6], [7.6, 0]]),
    "face.smile": k([[0, 0], [1, 1], [7, 1], [7.6, 0]]) } },
  { name: "disco point", tracks: {
    "rightArm.raise": k([[0, 0], [1, 1], [2, 0.1], [3, 1], [4, 0.1], [5, 1], [6, 0.1], [7.6, 0]]),
    "rightArm.spread": k([[0, 0], [1, 0.9], [2, 0.2], [3, 0.9], [4, 0.2], [5, 0.9], [6, 0.2], [7.6, 0]]),
    "leftArm.spread": k([[0, 0], [1, 0.3], [7, 0.3], [7.6, 0]]),
    "head.turn": k([[0, 0], [1, 0.5], [2, 0], [3, 0.5], [4, 0], [5, 0.5], [6, 0], [7.6, 0]]),
    "body.lean": k([[0, 0], [1, -0.3], [2, 0.1], [3, -0.3], [4, 0.1], [5, -0.3], [6, 0.1], [7.6, 0]]),
    "face.smile": k([[0, 0], [1, 1], [7, 1], [7.6, 0]]) } },
  { name: "spin and cheer", tracks: {
    "body.spin": k([[0, 0], [1, 0], [3, 1], [7.6, 1]]),
    "leftArm.raise": k([[0, 0], [1, 0.6], [3, 1], [4, 1], [5, 0.4], [6, 1], [7.6, 0]]),
    "rightArm.raise": k([[0, 0], [1, 0.6], [3, 1], [4, 1], [5, 0.4], [6, 1], [7.6, 0]]),
    "body.hop": k([[0, 0], [3.5, 0], [4, 0.5], [4.5, 0], [5.5, 0], [6, 0.5], [6.5, 0]]),
    "face.mouth": k([[0, 0], [3, 0.8], [6.5, 0.8], [7.6, 0]]) } },
].filter(Boolean).map((r) => { const v = validateMove(r); return v.recipe; }).filter(Boolean);

function noteTex(ch, color) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"); g.font = "bold 48px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = 10; g.fillStyle = color; g.fillText(ch, 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Party {
  constructor(m) { this.m = m; this.on = null; this.notes = []; }
  /** start (or keep going): { friends: ["mimi", "cocoa"], ms } */
  start({ friends = ["mimi", "cocoa"], ms = 16000 } = {}) {
    const m = this.m, now = performance.now();
    if (m.sulking || m.inBed) return false;
    if (this.on) { this.on.until = Math.max(this.on.until, now + ms); return true; }
    this.build();
    this.on = { t0: now, until: now + ms, friends, n: 0, beatN: -1, ending: 0 };
    m.party = { until: this.on.until + 2500 };   // friends don't leave mid-party
    for (const w of friends) m.friend(w, "dance", ms + 8000);
    if (m.craft && m.craft.stance) m.craft.stance.need("party", true);   // up on his feet to dance
    if (m.craft && m.craft.prop && !m.craft.prop.leaving && m.craft.prop.slot !== "head") m.craft.letGo(false);   // hooves free
    this.G.visible = true;
    emit("mochi:party", { on: true, friends, ms });
    m.touch(); m.note("party");
    return true;
  }
  stop() { if (this.on && !this.on.ending) { this.on.until = performance.now(); } }
  build() {
    if (this.G) return;
    const m = this.m, G = this.G = new THREE.Group(); G.name = "party"; G.visible = false; m.scene.add(G);
    // the disco ball on its string
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xdfe6f0, metalness: 1, roughness: 0.12, flatShading: true, emissive: 0x222833 });
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 2), ballMat); G.add(this.ball);
    this.string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3, 6), new THREE.MeshBasicMaterial({ color: 0x9aa3ad })); G.add(this.string);
    // beams: open cones from the ball, additive
    this.beams = [0xff5fa2, 0x5fd0ff, 0xffd25e, 0x9b7bff].map((c, i) => {
      const geo = new THREE.ConeGeometry(0.3, 2.6, 24, 1, true); geo.translate(0, -1.3, 0);   // narrow, and only the near side drawn, so they don't wash out his face
      const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
      b.userData = { c, phase: (i / 4) * Math.PI * 2 }; G.add(b); return b;
    });
    // coloured spots on the floor
    this.spots = this.beams.map((b) => { const s = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ color: b.userData.c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); s.rotation.x = -Math.PI / 2; G.add(s); return s; });
    this.noteTex = [["♪", "#ff74a6"], ["♫", "#5fd0ff"], ["♪", "#ffd25e"], ["♬", "#9b7bff"]].map(([ch, c]) => noteTex(ch, c));
    this.noteTexZd = [["♪", "#39ff7a"], ["♫", "#2fd8ff"], ["♬", "#ff2bd6"]].map(([ch, c]) => noteTex(ch, c));
  }
  step(now, dt) {
    const P = this.on, m = this.m;
    // notes float up and fade
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i], u = (now - n.t0) / n.life;
      if (u >= 1) { this.G.remove(n.s); n.s.material.dispose(); this.notes.splice(i, 1); continue; }
      n.s.position.set(n.x + Math.sin(u * 6 + n.ph) * 0.12, n.y + u * 1.1, n.z); n.s.material.opacity = Math.min(1, u * 5) * (1 - u);
    }
    if (!this.G || (!P && !this.G.visible)) return;
    const A = m.actor ? m.actor.position : new THREE.Vector3(), zd = !!(m.zd && m.zd.on);
    const t = (now - (P ? P.t0 : this.endAt || now)) / 1000;
    // the ball comes down at the start and goes up at the end
    let drop;
    if (P) { const u = clamp(t / 0.9, 0, 1); drop = 1 - (1 - u) * (1 - u); }
    else { const u = clamp((now - this.endAt) / 900, 0, 1); drop = 1 - u * u; if (u >= 1) { this.G.visible = false; return; } }
    const top = 3.6, low = 2.45, y = top + (low - top) * drop;
    this.ball.position.set(A.x, y + A.y, A.z + 0.2); this.ball.rotation.y += dt * 1.6;
    this.string.position.set(A.x, y + A.y + 1.5, A.z + 0.2);
    this.ball.material.color.setHex(zd ? 0x2a3330 : 0xdfe6f0); this.ball.material.emissive.setHex(zd ? 0x0c3b22 : 0x222833);
    const ZDC = [0x39ff7a, 0x2fd8ff, 0xff2bd6, 0x39ff7a];
    this.beams.forEach((b, i) => {
      const a = b.userData.phase + t * 1.3, swing = 0.55 + 0.15 * Math.sin(t * 0.7 + i);
      b.position.copy(this.ball.position); b.rotation.set(Math.sin(a) * swing, 0, Math.cos(a) * swing);
      b.material.color.setHex(zd ? ZDC[i] : b.userData.c); b.material.opacity = (zd ? 0.2 : 0.12) * drop * (0.75 + 0.25 * Math.sin(t * 8 + i));
      // where the beam meets the floor
      const dir = new THREE.Vector3(0, -1, 0).applyEuler(b.rotation), k2 = -this.ball.position.y / Math.min(-0.2, dir.y);
      const s = this.spots[i]; s.position.set(this.ball.position.x + dir.x * k2, 0.012, this.ball.position.z + dir.z * k2); s.material.color.copy(b.material.color); s.material.opacity = 0.32 * drop;
    });
    if (!P) return;
    // the beat: notes, confetti, a glitch on the drops in Zero Day
    const beat = Math.floor(t / BEAT);
    if (beat !== P.beatN) {
      P.beatN = beat;
      if (beat % 2 === 0) this.note(A, zd);
      if (beat % 4 === 0) { for (let i = 0; i < 3; i++) m.spawn(i % 2 ? "confetti" : "star", 1300); }
      if (zd && beat % 8 === 0 && m.zd && m.zd.glitchNow) m.zd.glitchNow(90, 0.45);
    }
    // on the beat: a little bounce and a head bob, under whatever routine he's doing (so it looks danced, not posed)
    if (!P.ending && !m.reduce) {
      const ph = (t % BEAT) / BEAT, bounce = Math.pow(Math.sin(ph * Math.PI), 2);
      if (m.root) m.root.position.y += 0.035 * bounce;
      if (m.neck) m.neck.rotation.x += 0.07 * Math.sin(ph * Math.PI * 2);
    }
    // the routines: his, and the same on Mimi and Cocoa
    const C = m.craft;
    if (!P.ending && now < P.until && C && !C.perf && !C.posing && (!P.nextAt || now >= P.nextAt)) {
      const r = ROUTINES[P.n % ROUTINES.length]; P.n++;
      C.play(r, { skill: 0.9, name: r.name });
      P.nextAt = now + r.duration * 1000 + 150;
      // in step with him (a beat behind put their sways against his, so they bumped heads), just a hair late
      for (const w of P.friends) setTimeout(() => { if (this.on && m.friendMoves) m.friendMoves.play(w, r, { skill: 0.55, seed: `party${P.n}` }); }, 90);
    }
    // the end: everyone cheers, then the ball goes back up and he sits down
    if (now >= P.until && !P.ending) {
      P.ending = now;
      for (const w of P.friends) m.friend(w, "cheer", 12000);
      m.run([["superexcited", 1600]]);
      emit("mochi:party", { on: false });
    }
    if (P.ending && now - P.ending > 1800) {
      this.on = null; this.endAt = now;
      if (C && C.stance) C.stance.need("party", false);
      m.party = { until: now + 1500 };
    }
  }
  note(A, zd) {
    const set = zd ? this.noteTexZd : this.noteTex, tex = set[Math.floor(Math.random() * set.length)];
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.28); this.G.add(s);
    const side = Math.random() < 0.5 ? -1 : 1;
    this.notes.push({ s, t0: performance.now(), life: 2200, x: A.x + side * (0.5 + Math.random() * 1.1), y: A.y + 1.2 + Math.random() * 0.5, z: A.z + 0.4, ph: Math.random() * 6 });
  }
}
