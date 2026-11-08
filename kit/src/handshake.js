/* The secret handshake (the plan's day 5; the demo's closing beat). You teach him a short sequence of taps and swipes
 * on his hooves, head and tummy; he plays it back ("Like this?"); saved, it's yours. Doing it together: he holds out
 * what comes next (a soft gold ring marks it), you tap, he meets each one, and at the end: hooves up, hearts, "Our
 * secret handshake!". And he starts it by himself when you come back: after a while away (no mouse, keys or touches,
 * the tab hidden, or him dozing), the first sign of you and he holds out his hoof. No model involved.
 *
 * Gestures, named as you see him: L / R a tap on the hoof on your left / right, LS / RS a swipe across that hoof (a
 * slide), H a tap or stroke on his head, T a tap on his tummy. A handshake is [{ g, dt }]: dt is the seconds since the
 * step before, so he keeps your rhythm. */
import * as THREE from "three";
import { armRx, armRz } from "./stagecraft.js";
import { HS_MAX, cleanHandshake } from "../../shared/handshake.js";
export { HS_GESTURES, HS_NAMES, cleanHandshake } from "../../shared/handshake.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const emit = (detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:handshake", { detail })); };
const OFFER_LINES = ["You're back! Handshake?", "Hey, it's you! Our handshake?", "There you are! Handshake?"];
const COOLDOWN = 90000;   // between offers, and after doing it

class Spring {
  constructor(v, k = 120, zeta = 0.85) { this.x = v; this.t = v; this.v = 0; this.k = k; this.c = 2 * Math.sqrt(k) * zeta; }
  step(dt) { const a = this.k * (this.t - this.x) - this.c * this.v; this.v += a * dt; this.x += this.v * dt; }
}

export class Handshake {
  constructor(m) {
    this.m = m;
    this.steps = null;        // the saved handshake
    this.mode = null;         // null | "teach" | "check" (playing back what you taught) | "together" | "solo" (showing you)
    this.rec = [];            // teaching: what you've done so far
    this.idx = 0; this.misses = 0; this.waitUntil = 0; this.lastAt = 0;
    this.lastDone = -1e9; this.lastOffer = -1e9; this.care = false; this.awayMs = 25000;
    this.play = null;         // check / solo playback: { t0, at: [times], i }
    this.hits = [];           // reactions on his body: { g, t0, dir }
    this.w = new Spring(0, 70, 0.9);
    this.v = new THREE.Vector3();
    this.gest = null;         // a finger down for the handshake
    this.seen = performance.now(); this.hiddenAt = 0; this.pendingOffer = null;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.15, 48), new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.ring.renderOrder = 12; this.ring.visible = false; m.scene.add(this.ring);
    if (typeof document !== "undefined" && document.addEventListener) {
      // you, coming back: the mouse or a key after a while with neither, or back to this tab after a while away
      const back = (why) => { const now = performance.now(), away = now - this.seen; this.seen = now; if (away > this.awayMs) this.returned(why); };
      document.addEventListener("pointermove", () => back("pointer"), { passive: true });
      document.addEventListener("pointerdown", () => { this.seen = performance.now(); }, { passive: true, capture: true });
      document.addEventListener("keydown", () => { this.seen = performance.now(); }, { capture: true });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) { this.hiddenAt = performance.now(); return; }
        const away = this.hiddenAt ? performance.now() - this.hiddenAt : 0; this.hiddenAt = 0; this.seen = performance.now();
        if (away > this.awayMs) this.returned("tab");
      });
    }
  }
  set(steps) { this.steps = cleanHandshake(steps); return !!this.steps; }
  busy() { return !!this.mode; }
  capturing() { return this.mode === "teach" || this.mode === "together"; }
  can() { const m = this.m; return !!this.steps && !this.care && !m.sulking && !m.held && !(m.craft && m.craft.posing) && !(m.scuffle && m.scuffle.busy()); }

  /* ---------------------------------------------------------------- teaching */
  teachStart() {
    const m = this.m;
    if (m.sulking || m.held) return false;
    if (m.craft && m.craft.prop && m.craft.prop.slot === "hand") m.craft.letGo(false);   // both hooves free
    m.touch(); this.mode = "teach"; this.rec = []; this.lastAt = 0; this.play = null;
    m.run([["hello", 900]]); m.say("Show me! Tap my hooves, my head or my tummy.");
    emit({ phase: "teach", steps: [] });
    return true;
  }
  teachCancel() { if (["teach", "check", "checked"].includes(this.mode)) { this.mode = null; this.rec = []; this.play = null; emit({ phase: "idle" }); } }
  /** finished showing him: he plays it back. Returns the steps (or why not). */
  teachDone() {
    if (this.mode !== "teach") return { ok: false, error: "not teaching" };
    if (this.rec.length < 2) { this.m.say("Just one? Do a few more!"); return { ok: false, error: "too short" }; }
    const steps = cleanHandshake(this.rec);
    this.m.say("Like this?");
    this.startPlay("check", steps);
    return { ok: true, steps };
  }
  /** keep it (the page saves it on the server too) */
  save(steps) {
    const s = cleanHandshake(steps || this.checked || this.rec);
    if (!s) return false;
    this.steps = s; this.mode = null; this.play = null; this.lastDone = performance.now();
    this.m.run([["happy", 1600]]); this.m.say("Our secret handshake!"); for (let i = 0; i < 4; i++) this.m.spawn("heart", 1500);
    emit({ phase: "saved", steps: s });
    return true;
  }
  again() { if (["teach", "check", "checked"].includes(this.mode)) { this.mode = "teach"; this.rec = []; this.lastAt = 0; this.play = null; this.m.say("Okay, show me again!"); emit({ phase: "teach", steps: [] }); } }

  /* ---------------------------------------------------------------- doing it together */
  /** he holds out his hoof for it (you came back, or someone asked) */
  offer({ line = null, force = false } = {}) {
    const now = performance.now();
    if (!this.can() || this.mode) return false;
    if (!force && now - Math.max(this.lastOffer, this.lastDone) < COOLDOWN) return false;
    const m = this.m;
    if (m.craft && m.craft.prop && m.craft.prop.slot === "hand") m.craft.letGo(false);
    m.touch();
    this.mode = "together"; this.idx = 0; this.misses = 0; this.lastOffer = now; this.waitUntil = now + 10000; this.lastAt = 0;
    m.say(line || OFFER_LINES[Math.floor(m.r() * OFFER_LINES.length)]);
    m.note("handshake_offer");
    emit({ phase: "offer", next: this.steps[0].g });
    return true;
  }
  /** you came back after a while: he wakes up if he was dozing and, once he's said hello, offers it */
  returned(why) {
    if (!this.can() || this.mode || this.pendingOffer) return false;
    const now = performance.now();
    if (now - Math.max(this.lastOffer, this.lastDone) < COOLDOWN) return false;
    const m = this.m, asleep = m.mood === "sleep" || m.mood === "bed" || m.inBed;
    if (why === "message") { this.pendingOffer = { at: Infinity, why }; return true; }   // after he has answered (replied())
    if (asleep || why === "tab" || why === "pointer") { m.touch(); m.run([["surprised", 600], ["hello", 1300]]); }
    this.pendingOffer = { at: now + 1700, why };
    return true;
  }
  replied() { if (this.pendingOffer && this.pendingOffer.at === Infinity) this.pendingOffer.at = performance.now() + 1200; }
  /** idle, and you tap the hoof the handshake starts with: off you go together */
  tapStart(g) {
    if (!this.can() || this.mode || !this.steps || this.steps[0].g !== g || (g !== "L" && g !== "R")) return false;
    this.mode = "together"; this.idx = 0; this.misses = 0; this.lastAt = 0; this.waitUntil = performance.now() + 8000; this.lastOffer = performance.now();
    this.input(g);
    return true;
  }
  /** one gesture from you (the kit's touch input classifies it) */
  input(g, dir = 0) {
    const m = this.m, now = performance.now();
    if (this.mode === "teach") {
      if (this.rec.length >= HS_MAX) { m.say("That's a long one! Tap done."); return false; }
      this.rec.push({ g, dt: this.lastAt ? (now - this.lastAt) / 1000 : 0 }); this.lastAt = now;
      this.hit(g, dir); m.touch();
      emit({ phase: "teach", steps: this.rec.map((s) => s.g) });
      return true;
    }
    if (this.mode !== "together") return false;
    const want = this.steps && this.steps[this.idx];
    if (!want) { this.mode = null; return false; }
    if (g === want.g) {
      this.hit(g, dir); this.idx++; this.lastAt = now; this.waitUntil = now + 6000; m.touch();
      emit({ phase: "together", done: this.idx, of: this.steps.length, next: this.steps[this.idx] ? this.steps[this.idx].g : null });
      if (this.idx >= this.steps.length) this.success();
      return true;
    }
    this.misses++; this.hit("oops", 0);
    if (this.misses >= 3) { m.say("Hehe, like this! Watch."); m.note("handshake_miss"); this.startPlay("solo", this.steps); emit({ phase: "missed" }); }
    else m.say(["Hehe, no, this one!", "Almost! This one!"][this.misses - 1]);
    this.waitUntil = now + 7000;
    return true;
  }
  success() {
    const m = this.m;
    this.mode = null; this.lastDone = performance.now();
    m.run([["happy", 2000]]); m.say("Our secret handshake!");
    for (let i = 0; i < 5; i++) m.spawn(i % 2 ? "star" : "heart", 1600);
    if (m.gf && !m.gf.leaving) { m.gf.role = "cheer"; m.gf.roleAt = performance.now(); }
    m.note("handshake");
    emit({ phase: "done" });
  }

  /* ---------------------------------------------------------------- gestures on his body (from the kit's touch input) */
  where(x, y) {   // which part a finger is on: the nearest hoof within reach, else his head, else his tummy
    const m = this.m, r = m.canvas.getBoundingClientRect(), hw = m.host.getBoundingClientRect().width;
    const scr = (v) => { const p = v.project(m.camera); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; };
    let best = null, bestD = hw * 0.17;
    m.arms.forEach((a, i) => { a.updateWorldMatrix(true, false); const s = scr(a.localToWorld(this.v.set(0, -0.26, 0.05))); const d = Math.hypot(s.x - x, s.y - y); if (d < bestD) { bestD = d; best = i ? "R" : "L"; } });
    if (best) return best;
    if (m.headAt && m.headAt(x, y)) return "H";
    m.body.updateWorldMatrix(true, false);
    const t = scr(m.body.localToWorld(this.v.set(0, 0.5, 0.45)));
    return Math.hypot(t.x - x, t.y - y) < hw * 0.22 ? "T" : null;
  }
  spots() {   // where each part is on the screen (client px): tests, and hints
    const m = this.m, r = m.canvas.getBoundingClientRect(), out = {};
    const scr = (v) => { const p = v.project(m.camera); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; };
    m.arms.forEach((a, i) => { a.updateWorldMatrix(true, false); out[i ? "R" : "L"] = scr(a.localToWorld(this.v.set(0, -0.26, 0.05))); });
    m.head.updateWorldMatrix(true, false); out.H = scr(m.head.localToWorld(this.v.set(0, 0.3, 0.3)));
    m.body.updateWorldMatrix(true, false); out.T = scr(m.body.localToWorld(this.v.set(0, 0.45, 0.55)));
    return out;
  }
  down(e) { this.gest = { x: e.clientX, y: e.clientY, t: performance.now(), part: this.where(e.clientX, e.clientY), moved: 0, dx: 0 }; return true; }
  move(e) { const G = this.gest; if (!G) return; G.dx = e.clientX - G.x; G.moved = Math.max(G.moved, Math.hypot(e.clientX - G.x, e.clientY - G.y)); }
  up(e) {
    const G = this.gest; this.gest = null;
    if (!G || !G.part) return null;
    this.move(e);
    const slow = performance.now() - G.t > 900;
    let g = G.part;
    if (G.moved >= 14 && !slow && (g === "L" || g === "R")) g = g === "L" ? "LS" : "RS";   // a swipe across a hoof: a slide
    else if (G.moved >= 14 && !(g === "H" || g === "T")) return null;
    this.input(g, Math.sign(G.dx));
    return g;
  }

  /* ---------------------------------------------------------------- playing it back (his turn) */
  startPlay(mode, steps) {
    let t = 0.35; const at = [];
    for (const s of steps) { t += Math.max(0.28, Math.min(1.2, s.dt || 0.5)); at.push(t); }
    this.mode = mode; this.play = { t0: performance.now(), at, steps, i: 0 };
  }
  hit(g, dir) { this.hits.push({ g, t0: performance.now(), dir: dir || (g === "LS" ? -1 : 1) }); if (this.hits.length > 8) this.hits.shift(); }

  /* ---------------------------------------------------------------- every frame, after the body and his props */
  step(now, dt) {
    const m = this.m;
    if (this.pendingOffer && now >= this.pendingOffer.at) { this.pendingOffer = null; this.offer(); }
    if (this.mode === "together" && now > this.waitUntil) {   // nobody there after all, or they forgot
      this.mode = null; m.say(this.idx ? "Hehe, we'll finish it next time!" : "Later, then!"); emit({ phase: "idle" });
    }
    if (this.play) {
      const P = this.play, t = (now - P.t0) / 1000;
      while (P.i < P.at.length && t >= P.at[P.i]) { this.hit(P.steps[P.i].g, 0); P.i++; }
      if (t > P.at[P.at.length - 1] + 0.7) {
        const was = this.mode; this.play = null;
        if (was === "check") { this.mode = "checked"; this.checked = P.steps; emit({ phase: "check", steps: P.steps.map((s) => s.g) }); }   // waiting for Save or Again
        else { this.mode = null; emit({ phase: "idle" }); }
      }
    }
    // the pose: both hooves out to you while teaching, playing back or doing it together; the next one a bit further
    this.w.t = this.mode && !m.held && !m.inBed ? 1 : 0; this.w.step(dt);
    const w = clamp(this.w.x, 0, 1), next = this.mode === "together" && this.steps && this.steps[this.idx] ? this.steps[this.idx].g : null;
    for (let i = this.hits.length - 1; i >= 0; i--) if (now - this.hits[i].t0 > 600) this.hits.splice(i, 1);
    const kick = (g) => this.hits.filter((h) => h.g === g || (g === "L" && h.g === "LS") || (g === "R" && h.g === "RS")).reduce((a, h) => {
      const u = (now - h.t0) / 600; return a + Math.sin(Math.PI * Math.min(1, u * 2.2)) * (1 - u) * (h.g.length > 1 ? h.dir : 1);
    }, 0);
    const calm = m.reduce ? 0.35 : 1;
    if (w > 0.002) {
      m.arms.forEach((a, i) => {
        const g = i ? "R" : "L", s = i ? 1 : -1, slide = this.hits.some((h) => h.g === g + "S");
        const out = next === g || next === g + "S" ? 0.14 : 0;
        const k = kick(g) * calm;
        const raise = 0.5 + out - (slide ? 0 : 0.32 * k), spread = 0.22 + (slide ? 0.35 * k * s : 0) + 0.04 * Math.sin(now / 500 + i);
        a.rotation.x = lerp(a.rotation.x, armRx(raise), w); a.rotation.z = lerp(a.rotation.z, armRz(s, spread), w);
      });
    }
    // his head nods when you tap it, his tummy bounces, a head shake for a wrong one
    const kh = kick("H") * calm, kt = kick("T") * calm, ko = kick("oops") * calm;
    if (kh) m.neck.rotation.x += 0.28 * kh;
    if (kt) { m.root.scale.y *= 1 - 0.07 * kt; m.root.position.y += 0.04 * Math.max(0, -kt); }
    if (ko) m.neck.rotation.y += 0.35 * Math.sin((now / 70)) * Math.abs(ko);
    if (w > 0.002 && this.mode && this.mode !== "check" && this.mode !== "solo") m.lastActive = now;   // no dozing off mid-handshake
    // the gold ring: what comes next (doing it together)
    const R = this.ring;
    if (next && w > 0.3) {
      const a = next === "H" ? null : next === "T" ? null : m.arms[next[0] === "R" ? 1 : 0];
      let p;
      if (a) { a.updateWorldMatrix(true, false); p = a.localToWorld(this.v.set(0, -0.26, 0.08)); }
      else if (next === "H") { m.head.updateWorldMatrix(true, false); p = m.head.localToWorld(this.v.set(0, 0.42, 0.25)); }
      else { m.body.updateWorldMatrix(true, false); p = m.body.localToWorld(this.v.set(0, 0.5, 0.62)); }
      R.position.copy(p); R.quaternion.copy(m.camera.quaternion);
      const pulse = 1 + 0.12 * Math.sin(now / 180);
      R.scale.setScalar(pulse * (next === "T" ? 1.6 : next === "H" ? 1.4 : 1) * m.root.scale.x);
      R.material.opacity = 0.75 * w; R.visible = true;
    } else R.visible = false;
  }
}
