/* No snaps on screen, whatever the animation underneath does (Nov 4, Binoy: "make sure they are smooth and clean and
 * without bugs or not awkward").
 *
 * Mochi, Mimi and Cocoa are posed fresh every frame from whatever they're doing: a role, a move, a throw, a walk.
 * When one of those switches (Cocoa going from cheering to dancing, Mochi calling Mimi straight after Cocoa), a pose
 * can jump in a single frame: an arm flung from up to down, a head turned the other way. The probe (a frame-by-frame
 * run of every action) found dozens of these.
 *
 * This watches the channels that make up a pose (positions and angles) and, when one changes speed suddenly (more than
 * a body could), it keeps what was on screen and lets the difference fade out over a fifth of a second or so, while
 * the new motion carries on underneath (inertialization, as games blend animations). It's display-only: the real
 * values are put back right after the frame is drawn, so nothing that reads them (or adds to them next frame) is fooled.
 */
const TAU = Math.PI * 2;
const wrap = (d) => { d %= TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => u * u * u * (u * (u * 6 - 15) + 10);   // smootherstep: no kink at either end

export class Smoother {
  /** chans: [[object, key, isAngle, limit?], …], object being a Vector3 or an Euler; pos/rot: the sudden change of speed
   * (units or radians per second, from one frame to the next) that counts as a snap */
  constructor(chans, { pos = 3.6, rot = 15 } = {}) {
    this.ch = chans; this.pos = pos; this.rot = rot;
    this.raw = new Float64Array(chans.length); this.shown = new Float64Array(chans.length);
    this.reset();
  }
  reset() { this.prev = null; this.vel = null; this.off = null; this.applied = false; this.hasShown = false; }
  /** before drawing. live: false while it shouldn't be touched (hidden, or posed some other way) */
  apply(now, dt, live = true) {
    if (!live) { this.reset(); return; }
    const C = this.ch, n = C.length, raw = this.raw;
    for (let i = 0; i < n; i++) raw[i] = C[i][0][C[i][1]];
    if (this.prev && dt > 0) {
      let jump = 0;
      const vel = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const d = C[i][2] ? wrap(raw[i] - this.prev[i]) : raw[i] - this.prev[i];
        vel[i] = d / dt;
        if (this.vel) { const lim = C[i][3] || (C[i][2] ? this.rot : this.pos), dv = Math.abs(vel[i] - this.vel[i]); if (dv > lim) jump = Math.max(jump, dv / lim); }
      }
      if (jump && this.hasShown) {   // keep what's on screen; the difference fades out
        const off = new Float64Array(n); let far = 0;
        for (let i = 0; i < n; i++) { off[i] = C[i][2] ? wrap(this.shown[i] - raw[i]) : this.shown[i] - raw[i]; far = Math.max(far, Math.abs(off[i]) * (C[i][2] ? 1 : 2.5)); }
        this.off = off; this.t0 = now; this.ms = clamp(150 + far * 110, 170, 400);
        this.vel = null;   // (the jump itself isn't a speed to compare the next frame with)
      } else this.vel = vel;
    }
    this.prev = Float64Array.from(raw);
    let k = 0;
    if (this.off) { const u = (now - this.t0) / this.ms; if (u >= 1) this.off = null; else k = 1 - smooth(u); }
    for (let i = 0; i < n; i++) {
      const out = this.off ? raw[i] + this.off[i] * k : raw[i];
      this.shown[i] = out;
      if (out !== raw[i]) C[i][0][C[i][1]] = out;
    }
    this.hasShown = true; this.applied = !!this.off;
  }
  /** after drawing: the real values back */
  restore() {
    if (!this.applied) return;
    const C = this.ch;
    for (let i = 0; i < C.length; i++) C[i][0][C[i][1]] = this.raw[i];
    this.applied = false;
  }
}

/** the channels of a character's pose: where it is and how it's turned, its body, neck, arms and legs */
export function poseChannels({ group, body, neck, arms = [], legs = [] }) {
  const c = [];
  const pos = (v) => ["x", "y", "z"].forEach((k) => c.push([v, k, false]));
  const rot = (e, lim) => ["x", "y", "z"].forEach((k) => c.push([e, k, true, lim]));
  // the whole body turning, or the body on its legs: the head is a long way out, so a smaller turn shows
  if (group) { pos(group.position); rot(group.rotation, 4); }
  if (body) rot(body.rotation, 6);
  if (neck) rot(neck.rotation);
  for (const a of arms) rot(a.rotation);
  for (const l of legs) rot(l.rotation);
  return c;
}
