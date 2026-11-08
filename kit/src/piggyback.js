/* A piggyback ride (Nov 4, Binoy: "is there an action where mimi can jump on top of mochi like for a piggy back ride?
 * might be fun to see that"). Mimi (or Cocoa) hops up onto his back, arms round his neck, peeking over his shoulder;
 * he stands, staggers a moment under the weight (more for Cocoa), and toddles across the stage and back with her
 * bouncing along, then she hops down beside him again.
 *
 * Runs after everything else has posed the friends (it moves the rider wherever his back is, frame by frame, so it
 * follows his walk, his lean and his bounce) and before the frame's smoothing.
 */
import * as THREE from "three";
import { MIMI_SCALE, COCOA_SCALE } from "./sizes.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
const UP_MS = 750, DOWN_MS = 700;
// where they sit on him (his body's own space): up on his back behind his shoulder, so their head shows beside his
const SEAT = { mimi: new THREE.Vector3(0.5, 0.56, -0.5), cocoa: new THREE.Vector3(0.52, 0.5, -0.55) };

export class Piggyback {
  constructor(m) { this.m = m; this.cur = null; this.v = new THREE.Vector3(); this.v2 = new THREE.Vector3(); }
  busy() { return !!this.cur; }
  riding(who) { return !!(this.cur && (!who || this.cur.who === who)); }
  /** who climbs on; ms: how long the ride lasts; quiet: no lines of theirs (the page says them) */
  start(who, { ms = 7000, quiet = false } = {}) {
    const m = this.m;
    if ((who !== "mimi" && who !== "cocoa") || this.cur || m.sulking || m.inBed || m.held) return false;
    const F = who === "mimi" ? m.gf : m.bud;
    if (!F || F.leaving) m.friend(who, "hello", ms + 12000);
    const now = performance.now(), F2 = who === "mimi" ? m.gf : m.bud;
    const wait = F2 && now < F2.t0 + (F2.inMs || 1500) + 300 ? F2.t0 + (F2.inMs || 1500) + 300 - now : 150;   // they get here first
    if (F2) F2.until = Math.max(F2.until, now + wait + ms + 6000);
    if (m.craft && m.craft.prop && m.craft.prop.slot === "hand") m.craft.letGo(false);   // both hooves free
    this.cur = { who, t0: now + wait, ms, quiet, phase: "wait", said: 0 };
    return { ok: true, ms: wait + UP_MS + ms + DOWN_MS };
  }
  stop() { if (this.cur && this.cur.phase !== "down") { this.cur.phase = "down"; this.cur.downAt = performance.now(); } }

  step(now, dt) {
    const C = this.cur; if (!C) return;
    const m = this.m, who = C.who, mimi = who === "mimi", F = mimi ? m.gf : m.bud, g = mimi ? m.mimi : m.cocoa;
    if (!F || m.sulking || m.inBed || m.held) { this.end(); return; }
    if (now < C.t0) return;
    const el = now - C.t0;
    if (C.phase === "wait") { C.phase = "up"; C.from = g.position.clone(); C.fromRot = g.rotation.clone(); if (!C.quiet && m.scuffle) m.scuffle.friendSay(who, mimi ? ["Wheee! Up I go~ ♡", "Piggyback! Hehe ♡"][Math.floor(m.r() * 2)] : ["Yeehaw! Coming up, dude!", "Incoming, bro!"][Math.floor(m.r() * 2)], 1600); }
    const home = g.position.clone();   // where they'd be standing (their own animation put them there this frame)
    // over whichever shoulder is toward you (walking the other way, they shift across his back so they don't vanish
    // behind him)
    const zr = this.seatAt(who, 1).z, zl = this.seatAt(who, -1).z;
    C.side = C.side == null ? 1 : C.side + ((zr >= zl - 0.02 ? 1 : -1) - C.side) * Math.min(1, dt * 3);
    const side = clamp(C.side, -1, 1), seat = this.seatAt(who, side), body = m.body;
    let k = 1, arc = 0, pos;
    if (C.phase === "up") {
      const u = el / UP_MS; k = ease(u); arc = Math.sin(Math.PI * clamp(u, 0, 1)) * 0.75;
      pos = C.from.clone().lerp(seat, k); pos.y += arc;
      if (u >= 1) { C.phase = "ride"; C.rideAt = now; m.hop(0.04, 260, 0); if (m.craft && m.craft.stance) { m.craft.stance.stand(); setTimeout(() => { if (this.cur === C && C.phase === "ride" && m.craft.stance.walk) m.craft.stance.walk({ reach: 0.55 }); }, mimi ? 500 : 1100); } }
    } else if (C.phase === "ride") {
      pos = seat.clone(); pos.y += Math.abs(Math.sin((now - C.rideAt) / 1000 * 7)) * 0.05;   // bouncing along
      if (!C.quiet && !C.said && now - C.rideAt > 1600 && m.scuffle) { C.said = 1; m.scuffle.friendSay(who, mimi ? ["Giddy-up, Mochi! Hehe ♡", "You're so strong! ♡", "Faster, faster~"][Math.floor(m.r() * 3)] : ["Go go go, dude!", "Best. Ride. Ever.", "Onward, noble steed!"][Math.floor(m.r() * 3)], 1800); }
      const walking = m.craft && m.craft.stance && m.craft.stance.walking();
      if (now - C.rideAt > C.ms || (now - C.rideAt > 2500 && C.walked && !walking)) { C.phase = "down"; C.downAt = now; }
      if (walking) C.walked = true;
    }
    if (C.phase === "down") {
      const u = (now - C.downAt) / DOWN_MS; k = 1 - ease(u); arc = Math.sin(Math.PI * clamp(u, 0, 1)) * 0.55;
      pos = home.clone().lerp(seat, k); pos.y += arc;
      if (u >= 1) { F.landAt = now; this.end(); return; }
    }
    // the rider: on his back, facing the way he faces, leaning in over his shoulder, arms round his neck
    const yaw = m.root.rotation.y;
    g.position.copy(pos);
    const rideK = C.phase === "up" ? k : C.phase === "down" ? k : 1;
    g.rotation.set(lerp(C.fromRot ? C.fromRot.x : 0, 0.18, rideK), lerp(C.fromRot ? C.fromRot.y : 0, yaw - 0.15 * side, rideK), lerp(C.fromRot ? C.fromRot.z : 0, 0.22 * side, rideK));
    g.scale.setScalar(mimi ? MIMI_SCALE : COCOA_SCALE);
    const arms = mimi ? m.mimiArms : m.cocoaArms, legs = mimi ? m.mimiLegs : m.cocoaLegs, neck = mimi ? m.mimiNeck : m.cocoaNeck;
    arms.forEach((a) => { const s = a.userData.side; a.rotation.x = lerp(a.rotation.x, -1.75, rideK); a.rotation.z = lerp(a.rotation.z, s * -0.35, rideK); });
    legs.forEach((l, i) => { l.rotation.x = lerp(l.rotation.x, -0.55 + 0.15 * Math.sin(now / 160 + i * Math.PI) * (C.phase === "ride" ? 1 : 0), rideK); });
    neck.rotation.z = lerp(neck.rotation.z, -0.25 * side, rideK); neck.rotation.y = lerp(neck.rotation.y, 0.35 * side, rideK);   // cheek to his, looking out at you
    const ground = mimi ? m.mimiGround : m.cocoaGround; if (ground) ground.visible = rideK < 0.5;
    // him: braced under the weight (Cocoa's heavier), arms back round their legs
    const heavy = mimi ? 1 : 1.8, wob = C.phase === "ride" ? Math.sin((now - C.rideAt) / 1000 * 9) * 0.03 * heavy * Math.max(0, 1 - (now - C.rideAt) / 1800) : 0;
    body.rotation.x += (0.1 * heavy) * rideK; m.root.rotation.z += wob;
    m.arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.x = lerp(a.rotation.x, 0.55, rideK * 0.85); a.rotation.z = lerp(a.rotation.z, s * 0.55, rideK * 0.85); });
    if (C.phase === "ride" && !mimi && m.P.sweat) m.P.sweat.t = 0.6;   // Cocoa's a big lad
  }
  /** their seat on his back, in the actor's space (where the friends live) */
  seatAt(who, side = 1) {
    const m = this.m;
    m.body.updateWorldMatrix(true, false);
    const w = m.body.localToWorld(this.v.copy(SEAT[who]).setX(SEAT[who].x * side));
    return (m.actor || m.scene).worldToLocal(w).clone();
  }
  end() {
    const C = this.cur; this.cur = null;
    if (!C) return;
    const m = this.m, ground = C.who === "mimi" ? m.mimiGround : m.cocoaGround; if (ground) ground.visible = true;
    if (m.craft && m.craft.stance && m.craft.stance.walking && m.craft.stance.walking()) m.craft.stance.stopWalk();
  }
}
