/* Carrying Mochi around the screen: the spring his box follows your finger on, the pendulum swing below it, and how
 * much he stretches while you move him. Pure (no DOM, no three.js), so the tests can drive a real drag at 60 fps.
 *
 * Nov 7, Binoy: "I feel like mochi stretches too much when we hold him to move him around". He used to get up to 16%
 * taller with speed (an ordinary drag hit that cap) and another 28% when he dug his hooves in before being yanked,
 * with nothing smoothing it, so he wobbled taller and thinner from frame to frame. Now a hint of it (a few percent),
 * eased in and out, and his volume stays the same (taller is also a little thinner all round, not just sideways). */

export const STRETCH = {
  speed: 0.035,     // at most this much taller from speed alone
  fullAt: 2600,     // px/s for the full speed stretch (a brisk drag)
  resist: 0.05,     // digging his hooves in before he's yanked along
  ease: 10,         // per second: how quickly the stretch follows (smooth, never frame to frame)
};

/** One frame of the carry. D: the drag state ({ x, y, vx, vy, tx, ty, swing, swingV, yankAt, … }; it's changed in
 * place). o: { held, simT (ms), reduce, canWalk (nothing else stops him walking there) }. Returns whether the box
 * is still moving. Also keeps D.resist (0..1 while he digs in), D.walk (-1, 0, 1) and D.stretch (smoothed). */
export function stepCarry(D, dt, { held = false, simT = 0, reduce = false, canWalk = true } = {}) {
  const since = simT - (D.yankAt ?? -1e9);
  const resist = held && since < 240, snap = since >= 240 && since < 1100;
  const k = resist ? 5 : snap ? 420 : held ? 700 : 240, zeta = resist ? 1 : snap ? 0.28 : 0.85, c = 2 * Math.sqrt(k) * zeta;
  const n = dt > 0.02 ? 3 : 1, h = dt / n;
  // not carried, not flung, not zooming: across the screen he walks (Nov 3), a toddle of about 220 px a second
  const walk = canWalk && !held && !resist && !snap && Math.abs(D.tx - D.x) > 18;
  D.walk = walk ? Math.sign(D.tx - D.x) : 0;
  for (let i = 0; i < n; i++) {
    const pv = D.vx;
    if (walk) {   // a steady toddle sideways; up and down still springs
      const step = Math.min(Math.abs(D.tx - D.x), (reduce ? 320 : 220) * h);
      D.vx = Math.sign(D.tx - D.x) * step / h; D.x += Math.sign(D.tx - D.x) * step;
      D.vy += (k * (D.ty - D.y) - c * D.vy) * h; D.y += D.vy * h;
    } else {
      D.vx += (k * (D.tx - D.x) - c * D.vx) * h; D.vy += (k * (D.ty - D.y) - c * D.vy) * h;
      D.x += D.vx * h; D.y += D.vy * h;
    }
    // the swing: pushed the other way when the box speeds up, pulled back by gravity
    const g = held ? 55 : 80, damp = held ? 4.5 : 9;
    D.swingV = (D.swingV || 0) + (-g * (D.swing || 0) - damp * (D.swingV || 0) - (D.vx - pv) / h * 0.0035 * (reduce ? 0.3 : 1)) * h;
    D.swing = Math.max(-0.62, Math.min(0.62, (D.swing || 0) + D.swingV * h));
  }
  const moving = Math.abs(D.x - D.tx) > 0.2 || Math.abs(D.y - D.ty) > 0.2 || Math.abs(D.vx) + Math.abs(D.vy) > 2;
  if (!moving) { D.x = D.tx; D.y = D.ty; D.vx = D.vy = 0; }
  D.resist = resist ? Math.min(1, since / 240) : 0;
  // the stretch: a little with speed while he's carried or still swinging, a little more while he digs in; eased
  const swinging = held || Math.abs(D.swing || 0) > 0.002;
  const want = swinging ? (STRETCH.speed * Math.min(1, Math.hypot(D.vx, D.vy) / STRETCH.fullAt) + STRETCH.resist * D.resist) * (reduce ? 0.5 : 1) : 0;
  D.stretch = (D.stretch || 0) + (want - (D.stretch || 0)) * (1 - Math.exp(-dt * STRETCH.ease));
  if (D.stretch < 1e-4 && !want) D.stretch = 0;
  return moving;
}

/** How his body is scaled for the stretch: taller by `y`, and thinner by `xz` across and front to back, so his
 * volume stays the same (y × xz² = 1). */
export function carryShape(D) {
  const s = Math.max(0, D.stretch || 0);
  return { y: 1 + s, xz: 1 / Math.sqrt(1 + s) };
}
