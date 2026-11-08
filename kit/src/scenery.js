/* Scenery for the story he's telling (Nov 5, Binoy: "there arent a lot of the props he says for the scene like bush
 * or twig (wouldnt it be better if these generated for the story)"). When he says "tiny brown tracks leading toward
 * the bushes", the tracks and the bushes pop up around him: bushes and trees behind, rocks and boxes beside, small
 * things by his hooves, tracks in a trail. The page hands them over (shared/scenery.js, or made at the workbench for
 * anything else); they stay while the story goes on and fold away a few minutes after the last one came. */
import * as THREE from "three";
import { validateProp } from "../../shared/craft.js";
import { buildProp, disposeProp } from "./props.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
// where each kind goes, in his units around where he stands (x: his right on screen is +; z: + toward you)
const SPOTS = {
  back: [[-1.5, -0.7], [1.55, -0.75], [-2.3, -0.9], [2.35, -0.9], [0.3, -1.1]],
  side: [[-1.25, 0.15], [1.3, 0.2], [-1.9, 0.35], [1.95, 0.3]],
  front: [[-0.75, 0.95], [0.8, 0.95], [-1.3, 1.05], [1.35, 1.0]],
  near: [[0.45, 0.75], [-0.45, 0.75], [0.15, 0.95], [-0.2, 1.0]],
  trail: [[0.95, 0.85], [-0.95, 0.85]],
};
const MAX = 10, LIFE = 4 * 60000;

export class Scenery {
  constructor(m) {
    this.m = m; this.items = []; this.last = 0;
    this.grp = new THREE.Group(); this.grp.name = "scenery"; m.actor.add(this.grp);
  }
  /** things to put up: [{ name, recipe, at: "back"|"side"|"front"|"near"|"trail", scale }] */
  add(list = []) {
    const now = performance.now(), rx = this.m.root.position.x, sc0 = this.m.root.scale.x || 1;
    let n = 0;
    for (const it of list) {
      const v = validateProp(it && it.recipe); if (!v.recipe) continue;
      const key = it.key || it.name;
      const had = this.items.find((x) => x.key === key && !x.leaving); if (had) { had.born = now; had.bounce = now; continue; }   // already here: a little hop
      while (this.items.filter((x) => !x.leaving).length >= MAX) this.fold(this.items.find((x) => !x.leaving));
      const at = SPOTS[it.at] ? it.at : "side", used = this.items.filter((x) => !x.leaving && x.at === at).map((x) => x.slot);
      const slot = SPOTS[at].findIndex((_, i) => !used.includes(i)), [sx, sz] = SPOTS[at][slot < 0 ? Math.floor(Math.random() * SPOTS[at].length) : slot];
      const g = buildProp(v.recipe), holder = new THREE.Group(); holder.add(g);
      // trail: tracks lead off from by his hooves toward the side it's on; everything else faces him a little
      holder.position.set(rx + sx * sc0, 0, sz * sc0);
      holder.rotation.y = at === "trail" ? (sx > 0 ? 0.25 : Math.PI - 0.25) : -sx * 0.12 + (Math.random() - 0.5) * 0.3;
      holder.scale.setScalar(0.001); this.grp.add(holder);
      this.items.push({ key, name: it.name, at, slot: slot < 0 ? -1 : slot, holder, sc: clamp(+it.scale || 1, 0.3, 2) * sc0, born: now + n * 260, bounce: 0, leaving: 0 });
      n++;
    }
    if (n) this.last = now;
    return n;
  }
  fold(it) { if (it && !it.leaving) it.leaving = performance.now(); }
  /** everything folds away (a new day, "clear old props") */
  clear() { for (const it of this.items) this.fold(it); }
  names() { return this.items.filter((x) => !x.leaving).map((x) => x.name); }
  step(now) {
    if (this.items.length && this.last && now - this.last > LIFE) { this.clear(); this.last = 0; }   // the story's over
    for (const it of this.items.slice()) {
      if (it.leaving) {
        const u = clamp((now - it.leaving) / 450, 0, 1); it.holder.scale.setScalar(Math.max(0.001, (1 - ease(u)) * it.sc));
        if (u >= 1) { disposeProp(it.holder); this.grp.remove(it.holder); this.items.splice(this.items.indexOf(it), 1); }
        continue;
      }
      const u = clamp((now - it.born) / 420, 0, 1), pop = u < 1 ? ease(u) * (1 + 0.18 * Math.sin(Math.PI * u)) : 1;
      const b = it.bounce ? Math.max(0, 1 - (now - it.bounce) / 500) : 0;
      it.holder.scale.set(Math.max(0.001, pop * it.sc * (1 - 0.08 * b)), Math.max(0.001, pop * it.sc * (1 + 0.12 * Math.sin(b * Math.PI))), Math.max(0.001, pop * it.sc));
    }
  }
}
