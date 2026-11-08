/* A hug that holds together (Nov 4, Binoy: "mochi and mimi hug ends up with each of them phasing through the other.
 * can you make sure the actual hug physics are correct and they dont phase through").
 *
 * The old hug moved the friend a fixed 0.42 toward wherever she stood and swung the arms to fixed angles. Mochi had
 * stepped aside 0.62 to make room, so she ended up with her body 0.3 inside his and her inner hoof at his middle.
 *
 * Now each sheep is a pair of soft shells (fleece ellipsoids round the body and the head, the puffs' outer edge) and
 * every frame of a hug:
 *  - the friend stands where the shells just meet (a binary search along the line between them, checking points on
 *    each shell against the other's), with a little give for the fleece squashing, whatever pose, lean or turn they
 *    are in and wherever Mochi happens to be standing;
 *  - each inner arm reaches for a spot on the other's fleece, as far round their back as the arm can get without the
 *    hoof going in, the arm passing through them, or the hoof sinking into its own fleece.
 */
import * as THREE from "three";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
export const SQUISH = 0.9;    // a point of one fleece may sit this far inside the other's shell (puffs squashing together)

// points spread over a unit sphere, to test one shell against another
const DIRS = (() => {
  const L = [], n = 96, g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y); L.push(new THREE.Vector3(Math.cos(g * i) * r, y, Math.sin(g * i) * r)); }
  return L;
})();

const T = new THREE.Matrix4(), S = new THREE.Matrix4();
const shell = (obj, ty, sx, sy, sz) => { obj.updateWorldMatrix(true, false); return obj.matrixWorld.clone().multiply(T.makeTranslation(0, ty, 0)).multiply(S.makeScale(sx, sy, sz)); };

/** the fleece shells (unit sphere → world) of Mochi or a friend, as they stand this frame */
// the ears stick out past the fleece (his reach 1.1 from the middle of his head), so they're shells too: the outer ear
// is a unit sphere scaled, so its own matrix is its shell
const ears = (L) => (L || []).map((e) => { const o = e.children[0]; o.updateWorldMatrix(true, false); return o.matrixWorld.clone(); });
export function shellsOf(m, who, withEars = true) {
  if (who === "mochi") {
    m.tummy.updateWorldMatrix(true, false); m.headHit.updateWorldMatrix(true, false);
    return [m.tummy.matrixWorld.clone(), m.headHit.matrixWorld.clone(), ...(withEars ? ears(m.ears) : [])];
  }
  const horns = (m.cocoaHorns || []).map((h) => shell(h, 0, 0.15, 0.15, 0.15));   // (horns don't bend, ears or no ears)
  if (who === "mimi") return [shell(m.mimiBody, 0.54, 0.6, 0.62, 0.56), shell(m.mimiHead, 0.02, 0.66, 0.66, 0.6), ...(withEars ? ears(m.mimiEars) : [])];
  return [shell(m.cocoaBody, 0.55, 0.62, 0.63, 0.58), shell(m.cocoaHead, 0.02, 0.67, 0.66, 0.6), ...(withEars ? ears(m.cocoaEars) : []), ...horns];
}
/** the ears, one by one ([group, shell]), to see which one is touching */
export const earShells = (L) => (L || []).map((e) => [e, ears([e])[0]]);

const v = new THREE.Vector3();
/** how far in a world point is (1 on the shell, less inside), the deepest over a set of inverted shells */
const depth = (p, invs) => { let r = Infinity; for (const I of invs) r = Math.min(r, v.copy(p).applyMatrix4(I).length()); return r; };
const inv = (Ms) => Ms.map((M) => M.clone().invert());

/** a set of shells ready for testing: each one's inverse, middle, outer reach and points over its surface */
function prep(Ms) {
  return Ms.map((M) => {
    const e = M.elements, rad = Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10]));
    return { I: M.clone().invert(), c: new THREE.Vector3().setFromMatrixPosition(M), rad, pts: DIRS.map((d) => d.clone().applyMatrix4(M)) };
  });
}
/** the closest any point of one set of shells comes into the other (1 = just touching), with the second set moved dx
 * along x; pairs too far apart to touch are skipped */
function closestP(A, B, dx) {
  let r = Infinity;
  for (const a of A) for (const b of B) {
    const ddx = a.c.x - b.c.x - dx, ddy = a.c.y - b.c.y, ddz = a.c.z - b.c.z;
    if (ddx * ddx + ddy * ddy + ddz * ddz > (a.rad + b.rad) ** 2) continue;
    for (const p of a.pts) { v.set(p.x - dx, p.y, p.z).applyMatrix4(b.I); r = Math.min(r, v.length()); }
    for (const p of b.pts) { v.set(p.x + dx, p.y, p.z).applyMatrix4(a.I); r = Math.min(r, v.length()); }
  }
  return r;
}
export const closest = (A, B) => closestP(prep(A), prep(B), 0);

/** where along x the friend's group goes so the two of them just meet (need: how far a point of one may sit inside the
 * other's shell, 1 for just touching); side is +1 with the friend on his right. Sliding a whole group along x slides
 * its shells, so the shells are worked out once and moved, not re-posed. */
export function contactX(m, who, group, side, need = SQUISH, withEars = true) {
  const x0 = group.position.x, mx = m.root.position.x, A = prep(shellsOf(m, "mochi", withEars)), B = prep(shellsOf(m, who, withEars));
  const meets = (x) => closestP(A, B, x - x0) >= need;
  let lo = mx + side * 0.2, hi = mx + side * 2.6;   // lo: well inside him; hi: well clear
  if (meets(lo)) return lo;
  for (let i = 0; i < 13; i++) { const mid = (lo + hi) / 2; if (meets(mid)) hi = mid; else lo = mid; }
  return hi;
}
/** do they overlap as they stand (closer than need)? */
export const overlapping = (m, who, need = 1, withEars = true) => closestP(prep(shellsOf(m, "mochi", withEars)), prep(shellsOf(m, who, withEars)), 0) < need;
/** how close one shell comes to a set (1 = touching) */
export const touches = (M, set) => closestP(prep([M]), prep(set), 0);

const W = new THREE.Vector3(), P = new THREE.Vector3(), Q = new THREE.Vector3(), C = new THREE.Vector3(), D = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), BACK = new THREE.Vector3(0, 0, -1);
/** one arm round the other: aims the arm (rotation x and z on its shoulder, as the rigs use them) at the furthest-round
 * spot on the other's body fleece the hoof can rest on. reach: shoulder to hoof centre in the arm's own units.
 * Returns the hoof's spot (world) or null if there was nowhere to put it. */
export function wrapArm(arm, reach, own, other, k, now = null) {
  if (k <= 0.001) { arm.userData.wrap = null; return null; }
  arm.updateWorldMatrix(true, false);
  const sh = arm.getWorldPosition(new THREE.Vector3()), L = reach * arm.getWorldScale(W).y;
  const body = other[0], bodyInv = body.clone().invert(), otherInv = inv(other), ownInv = inv(own);
  C.setFromMatrixPosition(body);
  const toward = new THREE.Vector3().copy(sh).sub(C).setY(0).normalize(), back = new THREE.Vector3().copy(BACK).addScaledVector(toward, -BACK.dot(toward)).normalize();
  let best = null;
  for (let th = -1.5; th <= 2.4; th += 0.12) for (const ps of [0.05, 0.22, 0.4, 0.58, 0.75]) {
    // a direction out from the middle of their body, from their front (th < 0) round past facing this shoulder (0) to
    // their back, a bit up
    D.copy(toward).multiplyScalar(Math.cos(th)).addScaledVector(back, Math.sin(th)).multiplyScalar(Math.cos(ps)).addScaledVector(UP, Math.sin(ps));
    // where that direction meets their fleece
    P.copy(D).transformDirection(bodyInv).normalize().applyMatrix4(body);
    const dist = P.distanceTo(sh);
    if (depth(P, ownInv) < 0.82) continue;                       // the hoof buried in its own fleece
    let through = false;                                          // the arm passing through them on the way
    for (const t of [0.3, 0.55, 0.8]) if (depth(Q.copy(sh).lerp(P, t), otherInv) < 0.86) { through = true; break; }
    if (through) continue;
    // closer than the arm is long, the hoof would go in: only if there's nowhere else (then as little as can be)
    const short = dist < L - 0.02;
    const cost = (short ? 100 + (L - dist) * 100 : Math.max(0, dist - L - 0.02) * 30) + Math.abs(th - 1.5) * 0.35 + Math.abs(ps - 0.25) * 0.4;
    if (!best || cost < best.cost) best = { cost, p: P.clone(), dist };
  }
  if (!best) return null;
  const parent = arm.parent, inParent = parent.worldToLocal(best.p.clone()), d = inParent.sub(arm.position).normalize();
  const rz = Math.asin(clamp(d.x, -1, 1));
  let rx = Math.atan2(-d.z, -d.y);
  // no snaps: the spot can hop from one place on their fleece to another between frames (two nearly as good), so the
  // arm swings over to it rather than jumping, starting from wherever it was when the hug began
  const Wr = arm.userData.wrap, fresh = !Wr || now == null || now - Wr.t > 300;
  const w = fresh ? { rx: arm.rotation.x, rz: arm.rotation.z, t: now } : Wr;
  while (rx - w.rx > Math.PI) rx -= Math.PI * 2;
  while (rx - w.rx < -Math.PI) rx += Math.PI * 2;
  const a = now == null ? 1 : 1 - Math.exp(-clamp((now - w.t) / 1000, 0, 0.1) * 10);   // (no clock: straight there)
  w.rx += (rx - w.rx) * a; w.rz += (rz - w.rz) * a; w.t = now; arm.userData.wrap = w;
  arm.rotation.x = lerp(arm.rotation.x, w.rx, k); arm.rotation.z = lerp(arm.rotation.z, w.rz, k); arm.rotation.y = lerp(arm.rotation.y, 0, k);
  return best.p;
}

/** the shoulder angles (rotation x and z, as the rigs use them) that point an arm at a spot (world) */
export function aimAngles(arm, point) {
  arm.updateWorldMatrix(true, false);
  const d = arm.parent.worldToLocal(point.clone()).sub(arm.position).normalize();
  return { rx: Math.atan2(-d.z, -d.y), rz: Math.asin(clamp(d.x, -1, 1)) };
}
