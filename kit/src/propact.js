/* Props acting on props (Nov 7; shared/propact.js reads the request). He takes the tool in his hoof, the other thing is
 * set down on the floor beside him (or the one already there is used), and a moment later it changes where everyone
 * can see: it grows, comes apart in two, lights up, turns a new colour, pops, looms, or squashes and boings back. */
import * as THREE from "three";
import { Movers } from "./moving.js";

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const back = (u) => { const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };   // a little overshoot

export class PropAct {
  constructor(m) { this.m = m; this.cur = null; this.live = []; }
  busy() { return !!this.cur; }
  /** spec: { verb, tool: { name, recipe }, target: { name, recipe, id }, colour, line, hooves } */
  run(spec, { delay = 0 } = {}) {
    const m = this.m, C = m.craft, F = m.floor;
    if (!spec || !spec.verb || !spec.target || !spec.target.recipe || !F || !C || m.sulking || m.inBed) return { ok: false };
    if (this.cur) this.finish();
    if (spec.tool && spec.tool.recipe) C.hold(spec.tool.recipe, { ms: 14000, quiet: true });
    // the thing: on the floor already, else set down beside his hoof (the screen's right)
    let it = F.items.find((x) => x.prop && String(x.prop.name).toLowerCase() === String(spec.target.name).toLowerCase());
    if (!it) {
      const { holder, spin } = F.build(spec.target.recipe);
      const hoof = C.hand.getWorldPosition(new THREE.Vector3());
      const at = F.group.worldToLocal(new THREE.Vector3(Math.min(hoof.x + 0.75, 3.2), 0, 0.5));
      it = F.place({ name: spec.target.name, recipe: spec.target.recipe, id: spec.target.id || null }, holder, spin, at, {});
      F.save && F.save();
    }
    // a campfire that comes with its flames starts out unlit
    const flames = [];
    it.group.traverse((o) => { if (o.isMesh && /flame/.test(o.userData.label || "")) flames.push(o); });
    if (spec.verb === "light") flames.forEach((o) => { o.visible = false; });
    const now = performance.now();
    this.cur = { spec, it, t0: now + delay, hit: now + delay + 900, done: false, flames, s0: it.group.scale.clone(), fx: null };
    if (m.run) m.run([["thinking", 700 + delay], ["excited", 1500]]);
    return { ok: true, ms: delay + 2600 };
  }
  at(it) { const p = it.group.getWorldPosition(new THREE.Vector3()); p.y += (it.group.userData.h || 0.5) * 0.6; return this.m.actor ? this.m.actor.worldToLocal(p) : p; }
  sparkle(it, kind = "star", n = 6) { const p = this.at(it); for (let i = 0; i < n; i++) this.m.spawn(kind, 1300, i / n, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.3, 0.1))); }
  // the change itself, once his tool reaches it
  hit(c) {
    const m = this.m, { spec, it } = c, g = it.group, box = new THREE.Box3().setFromObject(g);
    const say = (t) => { if (t) m.say(t); };
    if (spec.verb === "water") { c.grow = { from: g.scale.x, to: Math.min(g.scale.x * 1.35, 2.2) }; this.sparkle(it, "star", 7); say(spec.line); }
    else if (spec.verb === "light") {
      if (c.flames.length) { c.flames.forEach((o) => { o.visible = true; }); c.fx = new Movers(g); }
      else {   // a little flame on its top, flickering
        const fx = new THREE.Group(), top = g.worldToLocal(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2)), k = 1 / Math.max(0.2, g.scale.x);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06 * k, 0.18 * k, 16), new THREE.MeshStandardMaterial({ color: 0xffa62b, emissive: 0xff6a00, emissiveIntensity: 1.2, roughness: 0.4 }));
        const core = new THREE.Mesh(new THREE.ConeGeometry(0.03 * k, 0.1 * k, 12), new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffd25e, emissiveIntensity: 1.5 }));
        flame.position.copy(top).add(new THREE.Vector3(0, 0.09 * k, 0)); core.position.copy(top).add(new THREE.Vector3(0, 0.06 * k, 0.01 * k));
        flame.userData = { label: "flame", part: { size: [0.12, 0.18, 0.12] } }; core.userData = { label: "flame core", part: { size: [0.06, 0.1, 0.06] } };
        fx.add(flame, core); g.add(fx); c.fx = new Movers(fx); c.added = fx;
      }
      this.sparkle(it, "star", 5); say(spec.line);
    } else if (spec.verb === "paint") {
      const to = new THREE.Color(spec.colour || "#e5484d");
      g.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent && o.material.color) { o.material = o.material.clone(); o.material.userData = { ...(o.material.userData || {}), from: o.material.color.clone() }; } });
      c.paint = to; this.sparkle(it, "confetti", 6); say(spec.line);
    } else if (spec.verb === "pop") { c.pop = true; for (let i = 0; i < 12; i++) m.spawn(i % 3 ? "confetti" : "star", 1600, i / 12, this.at(it)); say(spec.line); }
    else if (spec.verb === "measure") { const n = spec.hooves || Math.max(1, Math.round((box.max.y - box.min.y) / 0.2)); say(`It's about ${n} hoof${n === 1 ? "" : "s"} tall!`); this.sparkle(it, "star", 3); }
    else if (spec.verb === "look") { c.look = true; say(spec.line); }
    else if (spec.verb === "bonk") { c.bonk = true; this.sparkle(it, "star", 4); say(spec.line); }
    else if (spec.verb === "cut") { this.cut(c, box); say(spec.line); }
    if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:propact", { detail: { verb: spec.verb, target: spec.target.name, tool: spec.tool && spec.tool.name } }));
  }
  // in two: each half hides the other side of the cut (a clipping plane), and they slide apart
  cut(c, box) {
    const m = this.m, F = m.floor, it = c.it;
    if (m.renderer) m.renderer.localClippingEnabled = true;
    const mid = (box.min.x + box.max.x) / 2, other = F.build(it.prop.recipe);
    const it2 = F.place({ ...it.prop }, other.holder, other.spin, it.at.clone(), { ry: it.ry, rz: it.rz });
    it2.group.scale.copy(it.group.scale);
    const clip = (grp, normal) => { const plane = new THREE.Plane(normal, normal.x < 0 ? mid : -mid); grp.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.clippingPlanes = [plane]; o.material.clipShadows = true; } }); return plane; };
    c.halves = [{ it, plane: clip(it.group, new THREE.Vector3(-1, 0, 0)), dir: -1, x0: it.at.x }, { it: it2, plane: clip(it2.group, new THREE.Vector3(1, 0, 0)), dir: 1, x0: it2.at.x }];   // (the floor keeps each where its .at says)
    c.mid = mid;
    for (let i = 0; i < 6; i++) m.spawn("confetti", 1200, i / 6, this.at(it));
  }
  step(now) {
    for (const L of this.live) L.fx.step(now);   // flames that stay lit
    const c = this.cur; if (!c) return;
    if (!c.done && now >= c.hit) { c.done = true; c.tHit = now; this.hit(c); }
    if (!c.done) return;
    const u = (now - c.tHit) / 1000, g = c.it.group;
    if (c.grow) { const k = c.grow.from + (c.grow.to - c.grow.from) * back(Math.min(1, u / 1.1)); g.scale.setScalar(k); }
    if (c.paint) { const k = ease(u / 0.9); g.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.from) o.material.color.copy(o.material.userData.from).lerp(c.paint, k); }); }
    if (c.pop) { const k = u < 0.12 ? 1 + u * 1.5 : Math.max(0.001, 1.18 * (1 - (u - 0.12) / 0.12)); g.scale.copy(c.s0).multiplyScalar(k); if (u > 0.26 && !c.popped) { c.popped = true; this.m.floor.remove(c.it, { quiet: true }); } }
    if (c.look) { const k = u < 0.4 ? 1 + 0.6 * ease(u / 0.4) : u < 1.4 ? 1.6 : 1 + 0.6 * (1 - ease((u - 1.4) / 0.4)); g.scale.copy(c.s0).multiplyScalar(Math.max(1, k)); }
    if (c.bonk) { const k = u < 0.12 ? 1 - 0.4 * (u / 0.12) : u < 0.7 ? 0.6 + 0.4 * back((u - 0.12) / 0.58) : 1; g.scale.set(c.s0.x * (2 - k) ** 0.5, c.s0.y * k, c.s0.z * (2 - k) ** 0.5); }
    if (c.halves) {   // apart, and a little tipped
      const d = 0.09 * ease(u / 0.5);
      for (const h of c.halves) { h.it.at.x = h.x0 + h.dir * d; h.it.group.position.x = h.it.at.x; h.plane.constant = h.dir < 0 ? c.mid - d : -(c.mid + d); h.it.spin.rotation.z = (h.it.rz * Math.PI) / 180 + h.dir * -0.12 * ease(u / 0.5); }
    }
    if (c.fx) c.fx.step(now);
    if (u > 2.2) this.finish();
  }
  finish() {
    const c = this.cur; if (!c) return;
    this.cur = null;
    if (c.fx && !c.popped) this.live.push({ fx: c.fx, it: c.it });   // the flame keeps flickering
    if (this.live.length > 6) this.live.shift();
    this.live = this.live.filter((L) => this.m.floor.items.includes(L.it));
  }
}
