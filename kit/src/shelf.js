/* His shelf (the plan's "provenance is the UI"): a little wooden bookcase on the floor to his right, with small
 * copies of the things he's made or kept, newest first, so you can see him grow. Tap one and he takes it out and
 * tells you where it came from ("You asked me for this on Nov 2, when you said it's raining!"); while it's in his
 * hoof (or on his head, or beside him) its spot on the shelf is empty. A new one arrives with a few sparkles. */
import * as THREE from "three";
import { disposeProp } from "./props.js";

const SLOT = 0.3;   // how big a copy is (fits a 0.3 box)
// the bookcase, as a prop recipe so it looks like everything else he has (and goes neon in Zero Day)
const CASE = {
  name: "shelf", archetype: "companion",
  parts: [
    { shape: "box", size: [0.07, 1.06, 0.4], at: [-0.56, 0.53, 0], color: "#c8915c", material: "wood", round: 0.25, label: "side" },
    { shape: "box", size: [0.07, 1.06, 0.4], at: [0.56, 0.53, 0], color: "#c8915c", material: "wood", round: 0.25, label: "side" },
    { shape: "box", size: [1.18, 0.06, 0.42], at: [0, 1.07, 0], color: "#b97f4c", material: "wood", round: 0.3, label: "top" },
    { shape: "box", size: [1.06, 0.05, 0.38], at: [0, 0.56, 0], color: "#d39a63", material: "wood", round: 0.2, label: "shelf" },
    { shape: "box", size: [1.06, 0.06, 0.38], at: [0, 0.06, 0], color: "#d39a63", material: "wood", round: 0.2, label: "shelf" },
    { shape: "box", size: [1.06, 1.0, 0.03], at: [0, 0.55, -0.19], color: "#e7c9a1", material: "wood", label: "back" },
    { shape: "box", size: [1.1, 0.07, 0.02], at: [0, 0.07, 0.205], color: "#a86f40", material: "wood", label: "trim" },
  ],
};
const TIERS = [0.59, 0.095];             // the tops of the two shelves
const XS = [-0.33, 0, 0.33];             // three spots per shelf

export class Shelf {
  constructor(m) {
    this.m = m;
    this.group = new THREE.Group(); this.group.name = "shelf";
    this.group.position.set(2.2, 0, -0.55); this.group.rotation.y = -0.42; this.group.scale.setScalar(1.2);   // to his right, turned toward the middle
    (m.furniture || m.scene).add(this.group);
    this.frame = null; this.items = []; this.want = []; this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: m.ground.material.map, transparent: true, depthWrite: false, opacity: 0.7 }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.set(0, 0.004, 0.02); this.group.add(this.shadow);
    this.group.visible = false;
  }
  build() { if (this.frame) { this.group.remove(this.frame); disposeProp(this.frame); } this.frame = this.m.craft.build(CASE); this.group.add(this.frame); }
  /** what's on it: [{ id, name, recipe, origin, source, uses, created_at }] (his props from the server, any order) */
  set(list) {
    const props = (list || []).filter((p) => p && p.recipe && Array.isArray(p.recipe.parts)).sort((a, b) => b.id - a.id).slice(0, TIERS.length * XS.length);
    if (!props.length) { this.clear(); this.group.visible = false; return 0; }
    if (!this.frame) this.build();
    this.group.visible = true;
    const old = new Map(this.items.map((it) => [it.id, it])), first = !this.items.length && !this.seeded;
    this.seeded = true;
    const next = [];
    props.forEach((p, i) => {
      let it = old.get(p.id);
      if (it) old.delete(p.id);
      else it = this.make(p, !first);
      it.data = p;
      const tier = Math.floor(i / XS.length), x = XS[i % XS.length];
      it.home.set(x, TIERS[tier], 0.02);
      next.push(it);
    });
    for (const it of old.values()) { this.group.remove(it.g); disposeProp(it.g); }
    this.items = next;
    return next.length;
  }
  make(p, isNew) {   // a small copy, sitting on its bottom, centred in its spot, turned a little to show it off
    const g = this.m.craft.build(p.recipe), box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
    const k = SLOT / Math.max(0.05, size.x, size.y, size.z * 1.4);
    const inner = new THREE.Group(); inner.add(g);
    g.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    inner.scale.setScalar(k); inner.rotation.y = 0.35;
    const it = { id: p.id, g: inner, home: new THREE.Vector3(), born: performance.now(), isNew, k, out: false, data: p };
    inner.userData.shelfItem = it;
    this.group.add(inner);
    if (isNew) for (let i = 0; i < 4; i++) this.m.spawn("star", 1200);
    return it;
  }
  clear() { for (const it of this.items) { this.group.remove(it.g); disposeProp(it.g); } this.items = []; }
  retheme() { if (!this.frame) return; this.build(); const data = this.items.map((it) => it.data); this.clear(); this.seeded = false; this.set(data); }
  /** a tap at (x, y) client px: the item under it, or null */
  pick(x, y) {
    if (!this.group.visible || !this.items.length) return null;
    const c = this.m.canvas.getBoundingClientRect();
    this.ndc.set(((x - c.left) / c.width) * 2 - 1, -((y - c.top) / c.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.m.camera);
    for (const h of this.ray.intersectObjects(this.items.filter((it) => !it.out).map((it) => it.g), true)) {
      let o = h.object; while (o && !o.userData.shelfItem) o = o.parent;
      if (o) return o.userData.shelfItem.data;
    }
    return null;
  }
  step(now) {
    if (!this.group.visible) return;
    // what's out (in his hoof, on him, under him): a cheap check first, the set only when it changed
    const names = this.m.craft && this.m.craft.inUse ? this.m.craft.inUse() : [], key = names.join("|");
    if (key !== this.outKey) { this.outKey = key; this.outSet = new Set(names); }
    const out = this.outSet, calm = this.m.reduce ? 0.3 : 1;
    for (const it of this.items) {
      it.out = out.has(it.data.name);   // it's out (in his hoof, on him, under him): his spot is empty
      const t = (now - it.born) / 700, pop = it.isNew ? Math.min(1, Math.max(0, t)) : 1;
      const s = it.out ? 0.001 : it.k * (pop < 1 ? 1 - Math.pow(1 - pop, 3) * Math.cos(pop * 6) : 1);
      it.g.scale.setScalar(Math.max(0.001, s));
      it.g.position.copy(it.home);
      if (it.isNew && t < 3) it.g.position.y += Math.abs(Math.sin(t * 3.2)) * 0.05 * (1 - t / 3) * calm;
      it.g.rotation.y = 0.35 + Math.sin(now / 1900 + it.id) * 0.06 * calm;
    }
  }
}

/** what he says about something from his shelf, in his words, from where it came from */
export function shelfStory(p) {
  const name = p.name, o = String(p.origin || "").trim();
  const said = /^you asked for it on ([^:]+)(?::\s*"(.+)")?$/i.exec(o);
  if (said) return said[2] ? `My ${name}! You asked me for it on ${said[1]}, when you said "${said[2]}".` : `My ${name}! You asked me for it on ${said[1]}.`;
  if (/^I made it on my own/i.test(o)) return `My ${name}! I made it on my own${o.replace(/^I made it on my own:?/i, "").trim() ? `, ${o.replace(/^I made it on my own:?\s*/i, "")}` : ""}.`;
  if (/pocket/i.test(o)) return `My ${name}! It was in my pocket, and you showed me what to do with it.`;
  return o ? `My ${name}! ${o[0].toUpperCase()}${o.slice(1)}${/[.!?]$/.test(o) ? "" : "."}` : `My ${name}!`;
}
