/* Standing up, sitting down and going for a walk. He sits by default (his back legs out in front, soles toward
 * you). "Stand up" and he pushes up onto his little back legs (they straighten under him, he comes up a touch with a
 * small bounce) and stays up, shifting his weight now and then, until you say "sit down" (or he's been left alone a
 * while, or it's bedtime, or he's sulking). "Go for a walk" and he toddles across the stage and back, turned
 * three-quarters toward where he's going: legs stepping, arms swinging, a little bob in every step; he turns round
 * toward you at each end and faces you again when he's back. Something heavy in his hooves (the big launcher) has him
 * stand with his legs planted, and a big kick from it can sit him down with a bump for a moment. A bike, his bed,
 * being carried by the scruff: those pose his legs themselves, so he isn't standing then. */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
const emit = (name, detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent(name, { detail })); };

export const SIT = -Math.PI / 2 + 0.18;   // his back legs out in front of him, soles toward you (the kit's rest pose)
export const STAND = -0.08;               // straight down under him
const LIFT = 0.155;      // how far up he comes when he stands (his hooves 0.31 down his legs, which start 0.15 up)
const STRIDE = 0.24;     // one step
const SPEED = 0.62;      // a toddle (units a second)
const FACE = 0.95;       // how far he turns toward where he's walking (three-quarters)
const IDLE_MS = 90000;   // left alone this long, he sits back down

class Spring {
  constructor(v, k = 60, zeta = 0.9) { this.x = v; this.t = v; this.v = 0; this.k = k; this.c = 2 * Math.sqrt(k) * zeta; }
  step(dt) { const a = this.k * (this.t - this.x) - this.c * this.v; this.v += a * dt; this.x += this.v * dt; }
}

/** the walk: [seconds, from x, to x, yaw from, yaw to], out to one side, across to the other, back to the middle */
export function walkRoute(reach = 1, first = 1) {
  const r = Math.abs(reach) * (first < 0 ? -1 : 1), f = Math.sign(r) * FACE, leg = Math.abs(r) / SPEED;
  return [
    [0.45, 0, 0, 0, f], [leg, 0, r, f, f],
    [0.7, r, r, f, -f], [2 * leg, r, -r, -f, -f],
    [0.7, -r, -r, -f, f], [leg, -r, 0, f, f],
    [0.5, 0, 0, f, 0]];
}
export const walkSeconds = (reach = 1) => walkRoute(reach).reduce((s, g) => s + g[0], 0);
/** over to x (stage units, clamped), a look round at you, then back home */
export function walkToRoute(x, stay = 2.2) {
  const r = clamp(x, -1.3, 1.3), f = Math.sign(r || 1) * FACE, leg = Math.max(0.3, Math.abs(r) / SPEED);
  return [[0.4, 0, 0, 0, f], [leg, 0, r, f, f], [0.5, r, r, f, 0], [stay, r, r, 0, 0], [0.5, r, r, 0, -f], [leg, r, 0, -f, -f], [0.5, 0, 0, -f, 0]];
}
function along(segs, t) {
  let t0 = 0;
  for (let i = 0; i < segs.length; i++) {
    const [d, x0, x1, y0, y1] = segs[i];
    if (t <= t0 + d || i === segs.length - 1) {
      const u = clamp((t - t0) / d, 0, 1), still = x0 === x1, turn = still && y0 !== y1;   // (standing still at the far end isn't stepping)
      return { x: lerp(x0, x1, still ? 0 : u), yaw: lerp(y0, y1, ease(u)), moving: !still && u < 1, turning: turn, done: t >= t0 + d && i === segs.length - 1 };
    }
    t0 += d;
  }
  return { x: 0, yaw: 0, moving: false, turning: false, done: true };
}

export class Stance {
  constructor(craft) {
    this.c = craft; this.m = craft.m;
    this.want = false;                // asked to stand (vs sit)
    this.needs = new Set();           // things that have him standing whatever he was asked ("heavy": the big launcher)
    this.w = new Spring(0, 70, 0.62); // 0 sitting … 1 standing (a little bounce as he comes up)
    this.walkW = new Spring(0, 40, 0.95);
    this.trip = null; this.pending = null;
    this.pos = { x: 0, yaw: 0 }; this.dist = 0; this.plopUntil = 0; this.lastUp = 0; this.wasUp = false;
    this.glide = { dir: 0, until: 0, yaw: new Spring(0, 30, 0.95) };   // walking to a new spot on the screen (the host moving)
  }
  /** can he stand right now? (on a bike, in bed, carried, sulking: no) */
  free() {
    const m = this.m, R = this.c.rider;
    return !m.inBed && !m.sulking && !m.held && !(R && (R.riding() || (R.cur && R.w.x > 0.05))) && Math.max(0, m.P.bed.x) < 0.05;
  }
  standing() { return (this.want || this.needs.size > 0) && this.free(); }
  walking() { return !!(this.trip || this.pending); }
  state() { return { standing: this.standing(), walking: this.walking(), asked: this.want }; }
  stand() {
    if (!this.free()) return false;
    const was = this.standing();
    this.want = true; this.m.touch(); this.askedAt = performance.now();   // (a move that stood him up only sits him back down if this hasn't changed)
    if (!was) { if (this.m.hop) this.m.hop(0.05, 380, 60); emit("mochi:stance", { standing: true }); }
    return true;
  }
  sit({ quiet = false } = {}) {
    const was = this.standing();
    this.want = false; this.stopWalk();
    if (was && !this.standing()) { if (!quiet) this.m.touch(); emit("mochi:stance", { standing: false }); }
    return true;
  }
  stopWalk() { if (this.trip) emit("mochi:walk", { walking: false }); this.trip = null; this.pending = null; }
  /** a walk across the stage and back (he stands up first if he's sitting) */
  walk({ reach = null, first = null } = {}) {
    if (!this.free() || this.walking()) return false;
    const up = this.standing();
    this.stand();
    const friends = this.m.friendsHere ? this.m.friendsHere() : {}, near = friends && (friends.mimi || friends.cocoa);
    const R = reach ?? (near ? 0.45 : 0.85), F = first ?? (friends && friends.cocoa && !friends.mimi ? 1 : friends && friends.mimi && !friends.cocoa ? -1 : this.m.r() < 0.5 ? -1 : 1);
    this.pending = { at: performance.now() + (up ? 150 : 650), segs: walkRoute(R, F) };
    this.c.keep(walkSeconds(R) * 1000 + 3000);
    return true;
  }
  /** "go over there": toddle to x (stage units) and back */
  walkTo(x) {
    if (!this.free()) return false;
    const up = this.standing();
    this.stand(); this.stopWalk();
    const segs = walkToRoute(x);
    this.pending = { at: performance.now() + (up ? 150 : 650), segs };
    this.c.keep(segs.reduce((s, g) => s + g[0], 0) * 1000 + 3000);
    return true;
  }
  /** a few quick steps to one side and stay there a moment (dodging in a water fight), facing the way he faces;
   * from wherever he is now. Then he drifts back to the middle as after any walk. */
  shuffle(x, stay = 1.2) {
    if (!this.free()) return false;
    this.stand();
    const x0 = this.trip ? this.pos.x : this.pos.x || 0, x1 = clamp(x, -1.3, 1.3), leg = Math.max(0.22, Math.abs(x1 - x0) / (SPEED * 1.8));
    this.pending = null; this.trip = { t0: performance.now(), segs: [[leg, x0, x1, 0, 0], [stay, x1, x1, 0, 0]] };
    emit("mochi:walk", { walking: true });
    return true;
  }
  /** something has him standing (true) or doesn't any more (false) */
  need(why, on) {
    const was = this.standing();
    if (on) this.needs.add(why); else this.needs.delete(why);
    if (!was && this.standing() && this.m.hop) this.m.hop(0.05, 380, 60);
  }
  /** knocked back onto his bottom for a moment (the launcher's kick); he gets back up if he was standing */
  plop(ms = 1300) { if (this.standing()) { this.plopUntil = performance.now() + ms; if (this.trip) this.trip.t0 += ms; if (this.m.hop) this.m.hop(0.08, 300, 0); } }

  /* every frame, after the move layer and the bike: how high he is, where he's walked to, his back legs */
  pose(now, dt) {
    const m = this.m, calm = this.c.reduce ? 0.35 : 1;
    if (this.want && !this.needs.size && now - m.lastActive > IDLE_MS) this.sit({ quiet: true });   // left alone a long while: he sits back down (without waking him)
    if (!this.free()) { this.stopWalk(); if (this.want && (m.inBed || m.sulking || (this.c.rider && this.c.rider.riding()))) this.want = false; }
    if (m.mood === "sleep" && (this.want || this.needs.size)) {   // dozed off on his feet: he sits down, and puts down anything heavy
      this.want = false; this.stopWalk();
      if (this.needs.has("heavy") && this.c.prop && this.c.prop.heavy) this.c.letGo(false);
    }
    // the host is walking him somewhere (home, a new spot): he stands, turns toward it and steps
    const gd = ((m.drag && m.drag.walk) || m.duoWalk || 0) && this.free() ? (m.drag && m.drag.walk) || m.duoWalk : 0;   // (or stepping aside for a friend)
    if (gd) { this.glide.dir = gd; this.glide.until = now + 300; }
    const gliding = now < this.glide.until;
    if (gliding !== this.needs.has("walk-to")) this.need("walk-to", gliding);
    this.glide.yaw.t = gd ? gd * FACE : 0; this.glide.yaw.step(dt);
    const up = this.standing() && now > this.plopUntil;
    this.w.t = up ? 1 : 0; this.w.step(dt);
    if (up && !this.wasUp) this.lastUp = now;
    this.wasUp = up;
    if (this.pending && now >= this.pending.at && this.w.x > 0.85) { this.trip = { t0: now, segs: this.pending.segs }; this.pending = null; emit("mochi:walk", { walking: true }); }
    let at = { x: 0, yaw: 0, moving: false, turning: false };
    if (this.trip && now > this.plopUntil) {
      at = along(this.trip.segs, (now - this.trip.t0) / 1000);
      if (at.done) { this.trip = null; emit("mochi:walk", { walking: false }); }
    } else if (this.trip) at = { ...this.pos, moving: false, turning: false };   // sat down by the kick: where he was
    else if (Math.abs(this.pos.x) > 1e-3 || Math.abs(this.pos.yaw) > 1e-3) {   // a walk cut short: back to the middle smoothly
      const k = 1 - Math.exp(-dt * 4);
      at = { x: lerp(this.pos.x, 0, k), yaw: lerp(this.pos.yaw, 0, k), moving: Math.abs(this.pos.x) > 0.02, turning: false };
      if (Math.abs(at.x) < 1e-3 && Math.abs(at.yaw) < 1e-3) at = { x: 0, yaw: 0, moving: false, turning: false };
    }
    const prev = this.pos.x; this.pos = at;
    const v = dt > 0 ? clamp((at.x - prev) / dt, -3, 3) : 0;
    if (gd) at = { ...at, moving: true };
    this.walkW.t = at.moving || at.turning ? 1 : 0; this.walkW.step(dt);
    const w = clamp(this.w.x, 0, 1.08), ww = clamp(this.walkW.x, 0, 1), sc = m.root.scale.y;
    if (w < 0.001 && !this.trip && at.x === 0 && at.yaw === 0 && Math.abs(this.glide.yaw.x) < 1e-3) return;
    this.dist += (Math.abs(v) + (at.turning ? 0.45 : 0) + (gd ? SPEED : 0)) * dt;   // turning on the spot is stepping round too
    const ph = (this.dist / STRIDE) * Math.PI;
    m.root.position.y += LIFT * sc * w + Math.abs(Math.sin(ph)) * 0.035 * sc * ww * calm;
    m.root.position.x += at.x;
    if (m.ground) m.ground.position.x += at.x;
    m.root.rotation.y += at.yaw + this.glide.yaw.x;
    m.root.rotation.z += Math.sin(ph) * 0.045 * ww * calm;
    // standing still: his weight shifts from one hoof to the other now and then
    const shift = (1 - ww) * Math.sin(now / 1500) * calm;
    m.root.rotation.z += 0.02 * shift * w;
    const lw = clamp(w, 0, 1);
    m.legs.forEach((l, i) => {
      const s = i ? 1 : -1;
      // from out in front to straight down (whatever the move layer added stays on top), then stepping
      l.rotation.x += (STAND - SIT) * lw + 0.44 * Math.sin(ph + i * Math.PI) * ww * calm * lw - 0.05 * shift * s * (1 - ww) * lw;
    });
  }
  /* after the arms are posed: they swing as he walks */
  limbs(now) {
    const ww = clamp(this.walkW.x, 0, 1);
    if (ww < 0.002) return;
    const ph = (this.dist / STRIDE) * Math.PI, calm = this.c.reduce ? 0.35 : 1, P = this.c.prop;
    this.m.arms.forEach((a, i) => {
      if (i === 1 && P && !P.leaving && P.slot === "hand") return;   // that hoof is holding something
      if (P && P.heavy && !P.leaving) return;                          // both hooves are
      a.rotation.x += 0.3 * Math.sin(ph + (1 - i) * Math.PI) * ww * calm;
    });
  }
}
