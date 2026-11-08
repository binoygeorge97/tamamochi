/* Rides: a bicycle, a tricycle, a skateboard, a car (or one he made). In a car (Nov 3) he sits down inside it, hooves
 * on the steering wheel, and drives across the stage and back; a friend can hop into the back seat (board()) and ride
 * along, then hops out when the car is put away. He gets on (sits on the seat with his hooves on the
 * handlebar, or stands on the board with his arms out), and when you tap it or ask, he rides across the stage and
 * back: on a bike or trike he turns three-quarters toward where he's going, pedals (his legs go round with the
 * pedals), the wheels roll at the speed he goes and he U-turns at each end, toward you; on a skateboard he pushes off,
 * glides with his arms out and pops a little ollie to turn around.
 *
 * The ride stands on the ground in the scene (not in his hoof); the part labels say what turns: "wheel" (with its
 * "spoke"s, "hub" and "rim"), and "crank" and "pedal". Stagecraft calls pose() early in its post step (it moves him:
 * where he is, how high, which way he faces), limbs() after the arms are posed, and place() for the ride itself. */
import * as THREE from "three";
import { RIDE_WHEEL, RIDE_SPIN, RIDE_CRANK, RIDE_PROP, RIDE_FLAME, RIDE_WATER } from "../../shared/craft.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
const HALF = Math.PI / 2;
const UP = new THREE.Vector3(0, 1, 0), ZAXIS = new THREE.Vector3(0, 0, 1);
const FACE = 0.85;     // how far he turns toward where he's going on a bike (3/4)
const PARK = 0.55;     // parked: turned a little to show the bike off
const REACH = 1.2;     // how far across the stage he rides
// a car is seen more from the side, so a friend in the back seat shows beside him rather than behind his head
const CAR_PARK = 1.0, CAR_FACE = 1.22;
// Nov 4: rides that fly (a rocket ship, a plane, a helicopter: up off the stage, across and back, down again) and
// sail (a boat, a ship, a submarine: bobbing along on their little pond); seen from the side, like the car
const SIDE = (kind) => kind === "drive" || kind === "fly" || kind === "sail";
const ALT = 0.45;      // how high he flies (his units: higher and his head goes off the top of the stage, Nov 4 strip)
const parkYaw = (kind) => (kind === "board" ? 0 : SIDE(kind) ? CAR_PARK : PARK);

class Spring {
  constructor(v, k = 60, zeta = 0.9) { this.x = v; this.t = v; this.v = 0; this.k = k; this.c = 2 * Math.sqrt(k) * zeta; }
  step(dt) { const a = this.k * (this.t - this.x) - this.c * this.v; this.v += a * dt; this.x += this.v * dt; }
}

// a ride across the stage and back: where he is (x), which way he faces (yaw, pedal kinds), and a hop (ollie)
// at each end on a board. Segments are [duration, from x, to x, yaw from, yaw to, ollie, height from, height to].
function route(kind) {
  if (kind === "fly") { const P0 = CAR_PARK, F = CAR_FACE, A = ALT; return [
    [0.7, 0, 0.02, P0, F, 0, 0, 0], [1.4, 0.02, 0.45, F, F, 0, 0, A], [0.9, 0.45, REACH, F, F, 0, A, A],
    [0.9, REACH, REACH, F, -F, 0, A, A * 1.12], [2.4, REACH, -REACH, -F, -F, 0, A * 1.12, A], [0.9, -REACH, -REACH, -F, F, 0, A, A * 1.12],
    [1.3, -REACH, -0.3, F, F, 0, A * 1.12, A * 0.45], [1.1, -0.3, 0, F, P0, 0, A * 0.45, 0]]; }
  if (kind === "board") return [
    [0.7, 0, 0.25, 0, 0, 0], [1.3, 0.25, REACH, 0, 0, 0], [0.55, REACH, REACH, 0, 0, 1],
    [2.2, REACH, -REACH, 0, 0, 0], [0.55, -REACH, -REACH, 0, 0, 1], [1.4, -REACH, 0, 0, 0, 0]];
  const P0 = SIDE(kind) ? CAR_PARK : PARK, F = SIDE(kind) ? CAR_FACE : FACE;
  return [
    [0.5, 0, 0.12, P0, F, 0], [1.25, 0.12, REACH, F, F, 0], [0.7, REACH, REACH, F, -F, 0],
    [2.3, REACH, -REACH, -F, -F, 0], [0.7, -REACH, -REACH, -F, F, 0], [1.4, -REACH, 0, F, P0, 0]];
}
export const tripSeconds = (kind) => route(kind).reduce((s, g) => s + g[0], 0);
function along(segs, t) {   // position on the route at t seconds
  let t0 = 0;
  for (let i = 0; i < segs.length; i++) {
    const [d, x0, x1, y0, y1, hop, a0 = 0, a1 = 0] = segs[i];
    if (t <= t0 + d || i === segs.length - 1) {
      const u = clamp((t - t0) / d, 0, 1), first = i === 0, last = i === segs.length - 1;
      // speed up at the start, slow down at the end, cruise in between
      const k = first ? u * u : last ? 1 - (1 - u) * (1 - u) : u;
      const turn = x0 === x1;   // a U-turn on the spot: a little loop out toward you
      return { x: lerp(x0, x1, k) + (turn ? Math.sign(x0) * 0.12 * Math.sin(Math.PI * u) : 0), z: turn ? 0.18 * Math.sin(Math.PI * u) : 0,
        yaw: lerp(y0, y1, ease(u)), hop: hop ? Math.sin(Math.PI * u) : 0, alt: lerp(a0, a1, ease(u)), done: t >= t0 + d && last };
    }
    t0 += d;
  }
  return { x: 0, z: 0, yaw: 0, hop: 0, alt: 0, done: true };
}

export class Rider {
  constructor(craft) {
    this.c = craft; this.m = craft.m;
    this.mount = new THREE.Group(); (this.m.actor || this.m.scene).add(this.mount);
    this.w = new Spring(0, 55, 0.95);
    this.turn = new Spring(0.3, 30, 0.9);   // a board turns a little toward where it's going
    this.cur = null;          // the ride he's on (or getting off): { P, kind, seat, wheels, crank }
    this.trip = null;         // riding the route: { t0, segs, last }
    this.pos = { x: 0, z: 0, yaw: PARK, hop: 0 };
    this.dist = 0; this.v = 0;
    this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpP = new THREE.Vector3(); this.tmpV2 = new THREE.Vector3(); this.tmpE = new THREE.Euler();
    this.pass = null;         // a friend in the back seat: { who, t0, out }
    this.at = null;           // where the back seat is right now (in the actor's space), for the friend
  }
  /** a friend hops into the back seat (a car with one) */
  board(who) {
    if (!this.riding() || !this.cur.P.recipe.passenger || (who !== "mimi" && who !== "cocoa")) return false;
    if (this.pass && this.pass.who === who && !this.pass.out) return true;
    // not while they're still on their way in: they get here first (Nov 4 probe: Mimi flew 5.7 across the stage
    // into the back seat in half a second), then hop in
    const m = this.m, F = who === "mimi" ? m.gf : m.bud, now = performance.now(), arrive = F && !F.leaving ? F.t0 + (F.inMs || 1500) + 250 : 0;
    this.pass = { who, t0: Math.max(now + 150, arrive), out: 0 };
    this.c.keep(60000);
    return true;
  }
  /** and out again */
  unboard() { if (this.pass && !this.pass.out) this.pass.out = performance.now(); }
  /** for the friend's animation: where to sit, how far in they've hopped (k: 0 standing outside … 1 seated), a hop */
  seatFor(who, fromX = null) {
    const p = this.pass; if (!p || p.who !== who || !this.at) return null;
    const now = performance.now();
    if (now < p.t0) return null;
    if (p.d == null && fromX != null) p.d = Math.abs(fromX - this.at.x);   // how far they hop: a longer hop takes longer
    const IN = 650 + 260 * Math.min(4, p.d || 0), OUT = 550;
    let u = Math.min(1, (now - p.t0) / IN);
    if (p.out) { u = 1 - Math.min(1, (now - p.out) / OUT); if (u <= 0) { this.pass = null; return null; } }
    return { ...this.at, k: ease(u), hop: Math.sin(Math.PI * u) * (u < 1 ? 1 : 0) };
  }
  passenger() { return this.pass && !this.pass.out ? this.pass.who : null; }
  /** a ride was taken out: find its wheels, spokes and pedals */
  setup(P) {
    const r = P.recipe, kind = r.rideKind || "sit", meshes = [];
    P.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const info = (o) => {
      const p = o.userData.part || {}, size = p.size || [1, 1, 1], k = size.indexOf(Math.min(...size));
      const axle = new THREE.Vector3(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0).applyQuaternion(o.quaternion);
      if (axle.z < 0) axle.negate();
      return { o, p0: o.position.clone(), q0: o.quaternion.clone(), axle, r: Math.max(size[0], size[1], size[2]) / 2 };
    };
    const wheels = meshes.filter((o) => RIDE_WHEEL.test(o.userData.label || "")).map((o) => ({ ...info(o), members: [] }));
    for (const o of meshes) {   // spokes and hubs turn with the wheel they're in
      if (!RIDE_SPIN.test(o.userData.label || "") || RIDE_WHEEL.test(o.userData.label || "")) continue;
      const w = wheels.find((W) => W.p0.distanceTo(o.position) < W.r * 0.9);
      if (w) w.members.push(info(o));
    }
    const cranks = meshes.filter((o) => RIDE_CRANK.test(o.userData.label || "")).map(info);
    const hub = cranks.find((x) => /crank|chainring/.test(x.o.userData.label));
    const centre = hub ? hub.p0.clone() : cranks.length ? cranks.reduce((a, x) => a.add(x.p0), new THREE.Vector3()).divideScalar(cranks.length) : null;
    const onWheel = centre && wheels.some((W) => Math.hypot(W.p0.x - centre.x, W.p0.y - centre.y) < 0.05);   // a trike: pedals on the front wheel
    const big = wheels.reduce((a, W) => Math.max(a, W.r), 0.1);
    // what spins (propellers, rotors: about their thinnest side, round their own middle), what flickers (a rocket's
    // flame), and the pond a boat sits in (it stays level while the boat bobs)
    const props = meshes.filter((o) => RIDE_PROP.test(o.userData.label || "")).map(info);
    const flames = meshes.filter((o) => RIDE_FLAME.test(o.userData.label || "")).map((o) => ({ o, s0: o.scale.clone() }));
    const water = meshes.filter((o) => RIDE_WATER.test(o.userData.label || "")).map((o) => ({ o, p0: o.position.clone(), q0: o.quaternion.clone() }));
    this.cur = { P, kind, seat: r.seat || [0, 0.5, 0], wheels, cranks, centre, gear: onWheel ? 1 : 0.55, big, props, flames, water, spin: 0, spinV: 0, thrust: 0, tilt: { pitch: 0, roll: 0 }, bob: 0 };
    this.trip = null; this.pos = { x: 0, z: 0, yaw: parkYaw(kind), hop: 0, alt: 0 }; this.dist = 0; this.v = 0; this.turn.x = this.turn.t = 0.3;
    P.group.position.set(0, 0, 0);
    this.mount.add(P.group);
    return this.cur;
  }
  riding() { return !!(this.cur && !this.cur.P.leaving && this.c.prop === this.cur.P); }
  /** off he goes: across the stage and back */
  go() {
    if (!this.riding() || this.trip) return false;
    const segs = route(this.cur.kind);
    this.trip = { t0: performance.now(), segs, last: null };
    this.c.keep(tripSeconds(this.cur.kind) * 1000 + 4000);
    this.m.touch();
    return true;
  }
  /* every frame, early: where he is, how high he sits, which way he faces */
  pose(now, dt) {
    const m = this.m, R = this.cur;
    this.w.t = this.riding() ? 1 : 0; this.w.step(dt);
    const w = clamp(this.w.x, 0, 1);
    if (!R) return;
    if (!this.riding() && this.pass && !this.pass.out) this.unboard();   // the car's going away: everybody out
    if (w < 0.002 && !this.riding()) { this.cur = null; this.trip = null; return; }
    const calm = this.c.reduce ? 0.35 : 1;
    let at = { x: 0, z: 0, yaw: parkYaw(R.kind), hop: 0, alt: 0, done: true };
    if (this.trip) { at = along(this.trip.segs, (now - this.trip.t0) / 1000); if (at.done) this.trip = null; }
    const prevX = this.pos.x, prevZ = this.pos.z, prevAlt = this.pos.alt || 0, prevYaw = this.pos.yaw;
    // flying: a gentle float up there; sailing: bobbing on the water (and both lean: nose up as it climbs, into the turns)
    const T = now / 1000, calm0 = this.c.reduce ? 0.35 : 1, up = clamp((at.alt || 0) / 0.15, 0, 1);
    if (R.kind === "fly") at.alt = (at.alt || 0) + up * 0.035 * Math.sin(T * 2.3) * calm0;
    R.bob = R.kind === "sail" ? (0.03 + 0.03 * Math.sin(T * 2.1)) * calm0 : 0;
    if (dt > 0) {
      const climb = ((at.alt || 0) - prevAlt) / dt, yawV = (at.yaw - prevYaw) / dt, rotor = R.props.some((x) => /rotor/.test(x.o.userData.label || ""));
      const pitchT = R.kind === "fly" ? (rotor ? -0.1 * clamp(Math.abs(this.v) / 1.2, 0, 1) + 0.15 * clamp(climb, -1, 1) : clamp(climb * 0.55, -0.22, 0.3)) : R.kind === "sail" ? 0.04 * Math.sin(T * 1.7) * calm0 : 0;
      const rollT = R.kind === "fly" ? clamp(-yawV * 0.12, -0.3, 0.3) * up : R.kind === "sail" ? 0.05 * Math.sin(T * 1.3) * calm0 : 0;
      const k = Math.min(1, dt * 5);
      R.tilt.pitch += (pitchT * calm0 - R.tilt.pitch) * k; R.tilt.roll += (rollT * calm0 - R.tilt.roll) * k;
    }
    this.pos = at;
    this.v = dt > 0 ? Math.hypot(at.x - prevX, at.z - prevZ) / dt * Math.sign((at.x - prevX) * (R.kind === "board" ? 1 : Math.sign(Math.sin(at.yaw)) || 1) || 1) : 0;
    m.root.scale.multiplyScalar(1 - (R.kind === "fly" ? 0.28 : 0.2) * w);   // a touch smaller on it, so he and his ride both fit on the stage (flying, more: up there too)
    // standing on a board, his hooves (0.31 down his straight legs, which start 0.15 up his body) rest on the deck
    const sc = m.root.scale.x, lift = (R.kind === "board" ? R.seat[1] + 0.155 : R.seat[1] - 0.02) * sc + 0.32 * at.hop * calm * sc + ((at.alt || 0) * calm + R.bob) * sc;
    m.root.position.x += at.x * w; m.root.position.z = at.z * w;   // (the kit never moves him in depth; this is ours)
    m.root.position.y += lift * w;
    if (R.kind === "board") {   // he turns a little with the board, balances, and leans into the glide
      this.turn.t = Math.abs(this.v) > 0.15 ? 0.32 * Math.sign(this.v) : this.turn.t; this.turn.step(dt);
      m.root.rotation.y += 0.45 * this.turn.x * w;
      m.root.rotation.z += (Math.sin(now / 420) * 0.04 - 0.05 * clamp(this.v, -1.5, 1.5)) * w * calm;
    } else m.root.rotation.y += at.yaw * w;
    if ((R.kind === "pedal" || R.kind === "sit") && this.trip) m.body.rotation.x += 0.1 * w;   // leaning into the pedals
    if (SIDE(R.kind)) m.body.rotation.x -= 0.06 * w;                                         // sat back in his seat
    // leaning with it (the roll on his root, about his own forward axis: his body's z isn't set afresh every frame, and
    // a += there wound him round and round, Nov 4 probe)
    if (R.kind === "fly" || R.kind === "sail") { m.body.rotation.x -= R.tilt.pitch * w; m.root.rotation.z += R.tilt.roll * w; }
    if (m.ground) { m.ground.position.x += at.x * w; m.ground.scale.x *= 1 + 0.35 * w; m.ground.material.opacity *= (1 - 0.35 * at.hop) * (1 - 0.55 * clamp((at.alt || 0) / ALT, 0, 1)); }
    if ((at.alt || 0) < 0.05) this.dist += (this.v * dt) / Math.max(0.3, sc);   // (wheels don't roll in the air)
    // propellers and rotors: winding up as he sets off, flat out in the air, winding down after; the flame roars
    const going = !!this.trip, want = going ? (R.kind === "fly" ? (up > 0.2 || (now - this.trip.t0) > 500 ? 30 : 12) : 12) : 0;
    R.spinV += (want - R.spinV) * Math.min(1, dt * (want > R.spinV ? 1.6 : 0.8)); R.spin += R.spinV * dt * calm;
    R.thrust += ((going ? 1 : 0) - R.thrust) * Math.min(1, dt * 3);
  }
  /* after the arms are posed: hooves on the handlebar (or out for balance), legs pedalling (or standing) */
  limbs(now) {
    const m = this.m, R = this.cur, w = clamp(this.w.x, 0, 1);
    if (!R || w < 0.002) return;
    const armRx = (raise) => (raise >= 0 ? -0.62 - 2.0 * raise : -0.62 - 0.9 * raise), armRz = (s, spread) => s * (spread >= 0 ? 0.22 + 2.6 * spread : 0.22 + 1.2 * spread);
    const board = R.kind === "board", drive = SIDE(R.kind), calm = this.c.reduce ? 0.35 : 1;
    const steer = drive && this.trip ? Math.sin(now / 260) * 0.08 * calm : 0;   // little turns of the wheel as he drives
    m.arms.forEach((a, i) => {
      const s = i ? 1 : -1, wob = board ? Math.sin(now / 300 + i * 2) * 0.06 * calm : 0;
      a.rotation.x = lerp(a.rotation.x, armRx(board ? 0.12 + wob : drive ? 0.3 + steer * s : 0.4), w);
      a.rotation.z = lerp(a.rotation.z, armRz(s, board ? 0.55 + wob : drive ? -0.2 : -0.12), w);
    });
    const crank = -this.dist / R.big * R.gear;   // the pedals go round as the wheels roll
    m.legs.forEach((l, i) => {
      let want;
      if (board) {
        want = -0.08;   // standing on it
        if (this.trip && now - this.trip.t0 < 700) want += i ? -0.55 * Math.sin(Math.PI * clamp((now - this.trip.t0) / 700, 0, 1)) : 0;   // a push off with one hoof
      } else want = -Math.PI / 2 + 0.3 + (R.kind === "pedal" ? 0.32 * Math.sin(crank + i * Math.PI) : 0);
      l.rotation.x = lerp(l.rotation.x, want, w);
    });
  }
  /* the ride itself: under him, turned the way he faces, the wheels rolling and the pedals going round */
  place(P, sc) {
    const m = this.m, R = this.cur;
    if (!R || R.P !== P) return;
    const s = m.root.scale.x, yaw = R.kind === "board" ? this.turn.x : this.pos.yaw - HALF;
    this.mount.rotation.order = "YZX";   // its own roll first, then its pitch, then which way it faces
    this.mount.rotation.set(R.tilt.roll, yaw, R.tilt.pitch);
    this.mount.scale.setScalar(s * sc);
    // the seat goes under him: the ride's origin is his position less the seat, turned the way the ride faces
    const seat = this.tmpV.set(R.seat[0], 0, R.seat[2]).applyAxisAngle(UP, yaw).multiplyScalar(s);
    const hop = 0.32 * this.pos.hop * (this.c.reduce ? 0.35 : 1) * s, up = (((this.pos.alt || 0) * (this.c.reduce ? 0.35 : 1)) + R.bob) * s;
    this.mount.position.set(m.root.position.x - seat.x, hop + up, (m.root.position.z || 0) - seat.z);
    if (R.tilt.pitch || R.tilt.roll) {   // tipped about his seat, so he stays in it
      const S = s * sc, flat = this.tmpP.set(R.seat[0], R.seat[1], R.seat[2]).applyAxisAngle(UP, yaw).multiplyScalar(S);
      this.mount.updateMatrix();
      const tipped = this.tmpV2.set(R.seat[0], R.seat[1], R.seat[2]).applyQuaternion(this.mount.quaternion).multiplyScalar(S);
      this.mount.position.add(flat.sub(tipped));
    }
    this.mount.visible = true;
    const ps = P.recipe.passenger;   // the back seat, where a friend sits (in the actor's space)
    if (ps) { const v = this.tmpP.set(ps[0], ps[1], ps[2]).applyAxisAngle(UP, yaw).multiplyScalar(s * sc).add(this.mount.position); this.at = { x: v.x, y: v.y, z: v.z, yaw: R.kind === "board" ? 0 : this.pos.yaw }; }
    else this.at = null;
    const roll = -this.dist;   // rolling toward +x turns the wheels clockwise (seen from the front)
    for (const W of R.wheels) {
      const th = roll / Math.max(0.03, W.r);
      for (const x of [W, ...W.members]) {
        const q = this.tmpQ.setFromAxisAngle(W.axle, th);
        x.o.position.copy(x.p0).sub(W.p0).applyQuaternion(q).add(W.p0);
        x.o.quaternion.copy(q).multiply(x.q0);
      }
    }
    for (const x of R.props) { const q = this.tmpQ.setFromAxisAngle(x.axle, R.spin); x.o.quaternion.copy(q).multiply(x.q0); }
    const now = performance.now();
    for (const F of R.flames) { const f = (0.45 + 0.55 * R.thrust) * (1 + (0.08 + 0.12 * R.thrust) * Math.sin(now / 38) * Math.sin(now / 71)); F.o.scale.copy(F.s0).multiplyScalar(f); }
    if (R.water.length) {   // the pond stays level and on the stage while the boat bobs and rocks on it
      const inv = this.tmpQ.setFromEuler(this.tmpE.set(-R.tilt.roll, 0, -R.tilt.pitch, "XZY")), S = s * sc;   // (the tilt undone: Rx(-roll)·Rz(-pitch))
      for (const W of R.water) { W.o.quaternion.copy(inv).multiply(W.q0); W.o.position.copy(W.p0); W.o.position.y -= R.bob * s / Math.max(0.01, S); }
    }
    if (R.centre) {
      const th = (roll / R.big) * R.gear, q = this.tmpQ.setFromAxisAngle(ZAXIS, th);
      for (const x of R.cranks) {
        x.o.position.copy(x.p0).sub(R.centre).applyQuaternion(q).add(R.centre);
        if (!/pedal/.test(x.o.userData.label)) x.o.quaternion.copy(q).multiply(x.q0);   // pedals stay level
      }
    }
  }
  off() { this.trip = null; this.unboard(); }
}
