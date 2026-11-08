/* Water that behaves like water when it lands (Nov 4, Binoy: "I want the water physics when it hits anyone or
 * anything to be more realistic"). A squirt used to end in a little puff of drops that went straight on through
 * whoever it hit. Now:
 *   - the stream stops at what it hits: each drop that reaches it bursts there;
 *   - it sprays off the surface: a sheet of drops thrown out sideways along it and back off it (the bounce), falling;
 *   - a wet patch shows where it hit, a darker sheen that soaks in and dries over a few seconds, and moves with them;
 *   - a few drops cling and run down their face or fleece, round the curve, and drip off the bottom;
 *   - drops that reach the floor splash once more, and the water gathers in a puddle that spreads and dries up.
 * The drops themselves are the stage's ammo (stagecraft.js: drop()), so they share its limits and its Zero Day look.
 */
import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };

export class Water {
  constructor(c) {
    this.c = c; this.m = c.m;
    this.patches = []; this.runners = []; this.puddles = [];
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector3();
  }
  zd() { return !!(this.m.zd && this.m.zd.on); }
  floorY() { return (this.m.actor ? this.m.actor.position.y : 0) + 0.004; }

  /** A head (or anything round) that a squirt can land on: its group (patches and runners go along with it), and its
   * centre and size, for the way the surface faces and the way the drops run down it. */
  headOf(who) {
    const m = this.m, g = who === "cocoa" ? m.cocoaHead : who === "mimi" ? m.mimiHead : who === "mochi" ? m.head : null;
    return g ? { group: g, radius: 0.52 } : null;
  }

  /** the water arrives at `at` (world), coming in along `dir`; `on`: { group, radius } it landed on (else the air or a
   * shield: `normal` then says which way the surface faces) */
  impact(at, { dir = null, on = null, normal = null, n = 18 } = {}) {
    const r = this.m.r, inc = (dir ? dir.clone() : new THREE.Vector3(0, -0.3, -1)).normalize();
    let nrm = normal ? normal.clone().normalize() : null;
    if (on) { on.group.updateWorldMatrix(true, false); const c = on.group.getWorldPosition(this.v); nrm = at.clone().sub(c).normalize(); }
    if (!nrm) nrm = inc.clone().negate();
    const bounce = inc.clone().sub(nrm.clone().multiplyScalar(2 * inc.dot(nrm)));   // off the surface, like a mirror
    // the spray: a sheet thrown out along the surface, some back off it, all falling
    for (let i = 0; i < n; i++) {
      const t = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5); t.addScaledVector(nrm, -t.dot(nrm)).normalize();   // along the surface
      const vel = t.multiplyScalar(0.9 + r() * 1.6).addScaledVector(nrm, 0.35 + r() * 0.8).addScaledVector(bounce, r() * 0.7);
      this.c.drop(at.clone().addScaledVector(nrm, 0.03), vel, 0.012 + r() * 0.016, { life: 900 + r() * 700 });
    }
    if (on) { this.patch(at, nrm, on); this.run(at, on, 3 + Math.floor(r() * 3)); }
  }

  /* ---- a wet patch: a darker sheen on them where it hit, soaking in, drying */
  patch(at, nrm, on) {
    const g = on.group, local = g.worldToLocal(at.clone()), size = 0.2 + this.m.r() * 0.1;
    const zd = this.zd(), mat = new THREE.MeshPhysicalMaterial({ color: zd ? 0x39ff7a : 0x6d8aa3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05,
      transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(this.discGeo || (this.discGeo = new THREE.CircleGeometry(1, 28)), mat);
    const ln = local.clone().normalize();
    mesh.position.copy(ln.clone().multiplyScalar(local.length() + 0.012));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ln);
    mesh.scale.set(size * 0.5, size * 0.62, 1);   // a little longer up and down: it runs
    mesh.renderOrder = 2;
    g.add(mesh);
    this.patches.push({ mesh, g, age: 0, life: 4.5 + this.m.r() * 1.5, size });
  }

  /* ---- drops that cling and run down the curve, then drip off */
  run(at, on, k) {
    const g = on.group, local = g.worldToLocal(at.clone()), R = Math.max(0.3, local.length() || on.radius), r = this.m.r;
    for (let i = 0; i < k; i++) {
      const p = local.clone().add(new THREE.Vector3((r() - 0.5) * 0.12, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08)).setLength(R + 0.015);
      const mesh = new THREE.Mesh(this.c.ammoGeo().sphere, this.dropMat());
      mesh.position.copy(p); mesh.scale.setScalar(0.014 + r() * 0.01); g.add(mesh);
      this.runners.push({ mesh, g, R, wait: i * (0.15 + r() * 0.25), speed: 0.12 + r() * 0.16, age: 0 });
    }
  }
  dropMat() {
    if (this.zd()) return this.zdMat || (this.zdMat = Object.assign(new THREE.MeshBasicMaterial({ color: 0x39ff7a, transparent: true }), { userData: { shared: true } }));
    return this.mat || (this.mat = Object.assign(new THREE.MeshPhysicalMaterial({ color: 0x9fd6ff, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.85 }), { userData: { shared: true } }));
  }

  /* ---- the floor: a drop lands, splashes a little once, and adds to a puddle there */
  floorHit(p, speed, bounced) {
    const r = this.m.r, y = this.floorY();
    if (!bounced && speed > 1.2) for (let i = 0; i < 2; i++) this.c.drop(new THREE.Vector3(p.x, y + 0.01, p.z), new THREE.Vector3((r() - 0.5) * 0.9, 0.5 + r() * 0.6, (r() - 0.5) * 0.5), 0.008 + r() * 0.006, { life: 500, floor: "last" });
    this.pool(p, 0.022 + Math.min(0.03, speed * 0.008));
  }
  pool(p, add) {
    const y = this.floorY();
    let P = this.puddles.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < Math.max(0.42, q.r * 1.1));
    if (!P) {
      if (this.puddles.length > 6) { const old = this.puddles.shift(); this.m.scene.remove(old.mesh); old.mesh.material.dispose(); }
      const zd = this.zd(), mat = new THREE.MeshPhysicalMaterial({ color: zd ? 0x39ff7a : 0xa9d6f5, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
      const mesh = new THREE.Mesh(this.discGeo || (this.discGeo = new THREE.CircleGeometry(1, 28)), mat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(p.x, y, p.z); mesh.scale.setScalar(0.001); mesh.renderOrder = 1;
      this.m.scene.add(mesh);
      P = { mesh, x: p.x, z: p.z, r: 0, want: 0, age: 0, wet: 0, stretch: 0.75 + this.m.r() * 0.4 };
      this.puddles.push(P);
    }
    // the water spreads it out a little toward where the drop fell, and it's fresh again
    P.want = Math.min(0.42, Math.sqrt(P.want * P.want + add * 1.2));
    P.x += (p.x - P.x) * 0.15; P.z += (p.z - P.z) * 0.15; P.age = 0; P.wet = 1;
  }

  step(dt) {
    // patches soak in, then dry
    for (let i = this.patches.length - 1; i >= 0; i--) {
      const W = this.patches[i]; W.age += dt;
      const u = W.age / W.life;
      if (u >= 1 || !W.g.parent) { W.g.remove(W.mesh); W.mesh.material.dispose(); this.patches.splice(i, 1); continue; }
      const grow = 0.6 + 0.4 * ease(W.age / 0.35);
      W.mesh.scale.set(W.size * 0.5 * grow, W.size * 0.62 * grow * (1 + 0.25 * ease(W.age / 1.5)), 1);
      W.mesh.material.opacity = 0.34 * Math.min(1, W.age / 0.12) * (u > 0.55 ? 1 - (u - 0.55) / 0.45 : 1);
    }
    // runners slide down round the curve (in their head's own space, so they go along with it), then drip
    for (let i = this.runners.length - 1; i >= 0; i--) {
      const D = this.runners[i]; D.age += dt;
      if (!D.g.parent) { D.g.remove(D.mesh); this.runners.splice(i, 1); continue; }
      if (D.age < D.wait) continue;
      const p = D.mesh.position, n = this.v.copy(p).normalize();
      const down = this.v2.set(0, -1, 0).addScaledVector(n, n.y).normalize();   // down, along the surface
      p.addScaledVector(down, D.speed * dt * (1 + D.age * 0.6)).setLength(D.R + 0.015);
      D.mesh.scale.y = D.mesh.scale.x * (1.3 + Math.min(0.6, D.age * 0.4));   // stretches as it runs
      if (n.y < -0.55 || D.age > D.wait + 2.6) {   // off the bottom (or it's been a while): it falls
        const w = D.g.localToWorld(p.clone());
        D.g.remove(D.mesh); this.runners.splice(i, 1);
        this.c.drop(w, new THREE.Vector3(0, -0.2, 0.05), D.mesh.scale.x, { life: 1500 });
      }
    }
    // puddles spread to their size, stay a while, and dry up
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const P = this.puddles[i]; P.age += dt;
      P.r += (P.want - P.r) * (1 - Math.exp(-dt * 5));
      const dry = clamp((P.age - 4) / 4, 0, 1);
      if (dry >= 1) { this.m.scene.remove(P.mesh); P.mesh.material.dispose(); this.puddles.splice(i, 1); continue; }
      P.mesh.position.set(P.x, this.floorY(), P.z);
      const rr = Math.max(0.001, P.r * (1 - 0.35 * dry));
      P.mesh.scale.set(rr, rr * P.stretch, 1);
      P.mesh.material.opacity = 0.3 * Math.min(1, P.r / 0.05) * (1 - dry);
    }
  }
  clear() {
    for (const W of this.patches) { W.g.remove(W.mesh); W.mesh.material.dispose(); }
    for (const D of this.runners) D.g.remove(D.mesh);
    for (const P of this.puddles) { this.m.scene.remove(P.mesh); P.mesh.material.dispose(); }
    this.patches = []; this.runners = []; this.puddles = [];
  }
}
