/* Eating and drinking (Nov 4, Binoy: "can we add a better action for mochi eating or sipping or scooping food into
 * his mouth?"). Three ways, by what it is (eatStyle in shared/craft.js):
 *   bite   a cookie, a slice of pizza, a sandwich, an apple: up to his mouth, a big open-mouthed chomp (his head
 *          dips into it), crumbs falling, cheeks puffed and munching; the food gets smaller each bite; three bites
 *   sip    tea, cocoa, juice, a milkshake: brought up slowly, tipped toward his mouth, eyes closed, a long sip (and
 *          another), the drink going down; then lowered with a happy "ahh"
 *   scoop  soup, noodles, cereal, ice cream in a bowl: the bowl held low in front of him, a little spoon in his other
 *          hoof; dip, a spoonful lifted (a blob of the food on it), mouth open as it arrives, a gulp, chew; three times
 *          and the bowl's contents go down
 * Stagecraft calls face() before the springs (his mouth, cheeks, eyes), hold() for the hoof with the food, left() after
 * the arms are posed (the spoon hoof), and prop() after the prop is placed (the cup's tip, the food going down). */
import * as THREE from "three";
import { eatStyle } from "../../shared/craft.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
const DUR = { bite: 3600, sip: 3900, scoop: 5200 };
// the parts that hold it (not eaten): a bowl, a cup, a plate, a stick, a wrapper, steam
const VESSEL = /bowl|cup|mug|glass|plate|dish|saucer|handle|straw|rim|tray|wrapper|stick|spoon|fork|chopstick|steam|lid|jar|bottle|can\b|box|basket|napkin|holder|sleeve|\bcone\b|heart/;

export class Eating {
  constructor(craft) {
    this.c = craft; this.m = craft.m; this.cur = null;
    this.spoon = null; this.blob = null;
  }
  busy() { return !!this.cur; }
  /** at his mouth right now (a bite or a sip): the hoof may bring it right up to his face */
  atMouth(now) { const C = this.cur; if (!C || C.style === "scoop") return false; return this.at(now).k > 0.04; }
  /** start eating what's in his hoof; how: "bite" | "sip" | "scoop" (else from its name) */
  start(P, how = null) {
    const style = how || eatStyle(P.recipe.name) || "bite", now = performance.now();
    const food = [], all = [];
    let last = "";   // (an unlabelled part goes with the one before it: a pattern labels the first of a pair)
    P.group.traverse((o) => {
      if (!o.isMesh) return;
      const l = o.userData.label || last; last = l; all.push(o);
      if (style === "scoop" && /spoon/.test(l)) { o.userData.eatHid = o.visible; o.visible = false; return; }   // he takes the spoon out of the bowl
      if (!VESSEL.test(l)) food.push(o);
    });
    // nothing labelled as the vessel (a cookie, an apple): all of it is food; all of it vessel (a cup with no drink
    // in it): nothing goes down but the sips
    for (const o of food) { o.userData.eat0 = o.userData.eat0 || { s: o.scale.clone(), p: o.position.clone() }; }
    const colour = food.length ? (food[0].material && food[0].material.color ? food[0].material.color.getHex() : 0xf2c14e) : 0xf2c14e;
    this.cur = { P, style, t0: now, dur: DUR[style], food: food.length && food.length < all.length ? food : style === "bite" ? all : food, n: 0, said: false, colour, whole: style === "bite" && food.length === all.length };
    if (this.cur.whole) for (const o of all) o.userData.eat0 = o.userData.eat0 || { s: o.scale.clone(), p: o.position.clone() };
    if (style === "scoop") this.makeSpoon(colour);
    return { style, ms: this.cur.dur };
  }
  stop() { if (this.cur) this.end(); }
  end() {
    this.cur = null;
    if (this.spoon) { this.spoon.removeFromParent(); this.spoon.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.spoon = null; this.blob = null; }
  }
  makeSpoon(colour) {
    const g = new THREE.Group(), metal = new THREE.MeshPhysicalMaterial({ color: 0xd9dde3, metalness: 0.6, roughness: 0.25, clearcoat: 0.6 });
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.26, 4, 10), metal); handle.position.y = 0.13; g.add(handle);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), metal); bowl.scale.set(0.075, 0.03, 0.06); bowl.position.y = 0.3; g.add(bowl);
    const blob = this.blob = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.5, clearcoat: 0.4 }));
    blob.scale.set(0.055, 0.03, 0.045); blob.position.y = 0.325; blob.visible = false; g.add(blob);
    g.position.set(0, -0.27, 0.035); g.scale.setScalar(0.001);
    this.m.arms[0].add(g); this.spoon = g;
  }
  // where it is in the eating: { u, k (in/out weight), phase within the current go, i (which go) }
  at(now) {
    const C = this.cur, u = clamp((now - C.t0) / C.dur, 0, 1), inK = C.style === "scoop" ? 0.1 : 0.15, outK = C.style === "sip" ? 0.18 : 0.13;
    const k = ease(u / inK) * ease((1 - u) / outK), goes = C.style === "sip" ? 2 : 3, mid = clamp((u - inK) / (1 - inK - outK), 0, 1);
    const i = Math.min(goes - 1, Math.floor(mid * goes)), ph = mid * goes - i;
    return { u, k, i, ph: u <= inK || u >= 1 - outK ? -1 : ph, goes };
  }
  /** his face, before the springs step */
  face(now) {
    const C = this.cur; if (!C) return;
    const F = this.m.P, { k, ph } = this.at(now), set = (name, v) => { if (F[name]) F[name].t = lerp(F[name].t, v, k); };
    if (C.style === "bite") {   // wide open as it comes in, a snap shut, then munching with round cheeks
      const open = ph >= 0 && ph < 0.32 ? Math.sin((ph / 0.32) * Math.PI / 2) : 0, chew = ph >= 0.36 ? Math.abs(Math.sin((now - C.t0) / 1000 * 12)) : 0;
      set("mouthOpen", ph < 0 ? 0.1 : 0.85 * open + 0.3 * chew); set("puff", ph >= 0.36 ? 0.75 : 0.2); set("eyeHappy", ph >= 0.36 ? 1 : 0.4); set("blush", 1);
    } else if (C.style === "sip") {   // eyes closed, a small "o", cheeks a touch round; "ahh" at the end
      const ahh = this.at(now).u > 0.84 ? Math.sin(clamp((this.at(now).u - 0.84) / 0.16, 0, 1) * Math.PI) : 0;
      set("mouthOpen", ph >= 0 && ph < 0.75 ? 0.16 : 0.12 + 0.6 * ahh); set("eyeHappy", 1); set("puff", ph >= 0 && ph < 0.75 ? 0.3 : 0); set("blush", 1.1);
    } else {   // scoop: looking down at the bowl, open for the spoon, a gulp, chewing
      const open = ph >= 0.42 && ph < 0.62 ? Math.sin(((ph - 0.42) / 0.2) * Math.PI) : 0, chew = ph >= 0.62 ? Math.abs(Math.sin((now - C.t0) / 1000 * 10)) : 0;
      set("mouthOpen", 0.08 + 0.85 * open + 0.25 * chew); set("puff", ph >= 0.62 ? 0.6 : 0.1); set("eyeHappy", ph >= 0.62 ? 1 : 0.2); set("blush", 1);
      if (F.lookY) F.lookY.t = lerp(F.lookY.t, ph >= 0 && ph < 0.42 ? -0.6 : 0, k);
    }
  }
  /** the hoof with the food (and his head), in the post step: changes handHold in place */
  hold(now, H) {
    const C = this.cur; if (!C || !H) return;
    const m = this.m, { k, ph, u } = this.at(now);
    if (C.style === "bite") {   // up to his mouth; each bite pushes it in and his head dips forward to meet it
      const push = ph >= 0 && ph < 0.36 ? Math.sin((ph / 0.36) * Math.PI) : 0;
      H.raise = lerp(H.raise, 0.74 + 0.06 * push, k); H.spread = lerp(H.spread, -0.5 - 0.08 * push, k);
      m.neck.rotation.x += (0.12 + 0.16 * push) * k; m.neck.rotation.y -= 0.14 * k;
      if (ph >= 0.36 && ph < 0.95) m.neck.rotation.z += Math.sin((now - C.t0) / 1000 * 12) * 0.03 * k;   // munch munch
    } else if (C.style === "sip") {   // slow up, tipped, his head back a little for the sip; down a bit between sips
      const between = ph >= 0.75 ? Math.sin(((ph - 0.75) / 0.25) * Math.PI) : 0;
      H.raise = lerp(H.raise, 0.76 - 0.1 * between, k); H.spread = lerp(H.spread, -0.5 + 0.1 * between, k);
      const back = ph < 0 ? 0 : ph < 0.2 ? ease(ph / 0.2) : ph < 0.7 ? 1 : ph < 0.95 ? 1 - ease((ph - 0.7) / 0.25) : 0;   // head back for the sip
      m.neck.rotation.x += (0.06 - 0.12 * back) * k; m.neck.rotation.y -= 0.12 * k;
      if (u > 0.84) m.neck.rotation.z += 0.08 * Math.sin(clamp((u - 0.84) / 0.16, 0, 1) * Math.PI);   // "ahh"
    } else {   // the bowl low and in front of him, his head looking down into it, then up for each spoonful
      H.raise = lerp(H.raise, 0.44, k); H.spread = lerp(H.spread, -0.5, k);
      const down = ph >= 0 && ph < 0.42 ? 1 : ph >= 0.42 && ph < 0.6 ? 1 - ease((ph - 0.42) / 0.18) : 0;
      m.neck.rotation.x += (0.08 + 0.22 * down) * k; m.neck.rotation.y -= 0.1 * k;
    }
  }
  /** the spoon hoof (after the arms are posed): down into the bowl, a spoonful up to his mouth */
  left(now, armRx, armRz) {
    const C = this.cur; if (!C || C.style !== "scoop" || !this.spoon) return;
    const a = this.m.arms[0], { k, ph } = this.at(now);
    // dip (0–0.3): into the bowl; lift (0.3–0.5): up to his mouth; in (0.5–0.62): there; back (0.62–1): down and ready
    let raise = 0.42, spread = -0.6;
    if (ph >= 0 && ph < 0.3) { const d = Math.sin((ph / 0.3) * Math.PI); raise = 0.42 - 0.08 * d; spread = -0.6 - 0.08 * d; }
    else if (ph >= 0.3 && ph < 0.62) { const l = ease((ph - 0.3) / 0.2); raise = lerp(0.42, 0.88, l); spread = lerp(-0.6, -0.38, l); }
    else if (ph >= 0.62) { const b = ease((ph - 0.62) / 0.3); raise = lerp(0.88, 0.42, b); spread = lerp(-0.38, -0.6, b); }
    a.rotation.x = lerp(a.rotation.x, armRx(raise), k); a.rotation.z = lerp(a.rotation.z, armRz(-1, spread), k);
    // the spoon: in his hoof while he eats, its bowl tipped toward his mouth on the way up; the blob rides on it
    this.spoon.scale.setScalar(Math.max(0.001, 1.5 * k));
    // pointing up out of his hoof whatever the arm does (in the world: up, toward the middle of him; down into the bowl
    // when dipping, its bowl level-ish toward his mouth on the way up)
    const dip = ph >= 0 && ph < 0.3, up = ph >= 0.3 && ph < 0.62;
    this.tmpD = (this.tmpD || new THREE.Vector3()).set(dip ? 0.55 : up ? 0.45 : 0.4, dip ? 0.35 : 1, up ? 0.25 : 0.15).normalize();
    a.updateWorldMatrix(true, false);
    const aq = a.getWorldQuaternion(this.tmpQ || (this.tmpQ = new THREE.Quaternion())).invert();
    const want = (this.tmpQ2 || (this.tmpQ2 = new THREE.Quaternion())).setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.tmpD);
    const rootQ = this.m.root.getWorldQuaternion(this.tmpQ3 || (this.tmpQ3 = new THREE.Quaternion()));
    this.spoon.quaternion.copy(aq).multiply(rootQ).multiply(want);   // (in his own frame, so it turns with him)
    if (this.blob) this.blob.visible = ph >= 0.24 && ph < 0.56;
  }
  /** after the prop is placed: the cup tipped to his mouth, the food going down, crumbs, hearts, the end */
  prop(now) {
    const C = this.cur; if (!C) return;
    const c = this.c, m = this.m, P = C.P;
    if (c.prop !== P || P.leaving) { this.end(); return; }
    const { k, ph, i, u, goes } = this.at(now);
    if (C.style === "sip") {   // up to his lips (higher than his hoof can reach by itself) and tipped toward his mouth
      const sipK = ph < 0 ? 0.2 : ph < 0.18 ? lerp(0.2, 1, ease(ph / 0.18)) : ph < 0.7 ? 1 : ph < 0.95 ? lerp(1, 0.2, ease((ph - 0.7) / 0.25)) : 0.2;   // (no jumps between sips)
      c.handSpin.rotation.z -= 0.7 * sipK * k; c.handSpin.position.y += (0.12 + 0.16 * sipK) * k; c.handSpin.position.x -= 0.08 * sipK * k;
    }
    if (C.style === "bite") c.handSpin.position.y += 0.1 * k;   // (right up to his mouth)
    if (C.style === "scoop") c.handSpin.rotation.x += 0.35 * k;   // the bowl tipped toward him, so you can see in
    // each go takes some: a bite out, a sip down, a spoonful gone
    const tookAt = C.style === "bite" ? 0.3 : C.style === "sip" ? 0.5 : 0.5;
    if (ph >= tookAt && C.n <= i) {
      C.n = i + 1;
      const left = 1 - C.n / (goes + (C.style === "bite" ? 0.6 : 0.4));
      const parts = C.whole ? [] : C.food;
      for (const o of parts) {
        const z = o.userData.eat0; if (!z) continue;
        if (C.style === "bite") o.scale.copy(z.s).multiplyScalar(Math.max(0.25, left));
        else { o.scale.set(z.s.x * (0.75 + 0.25 * left), z.s.y * Math.max(0.15, left), z.s.z * (0.75 + 0.25 * left)); o.position.copy(z.p); }
      }
      if (C.whole) P.scale.t = Math.max(0.3, left);
      if (C.style === "bite") for (let j = 0; j < 4; j++) m.spawn("crumb", 700, 0, this.mouth());
      else m.spawn("heart", 900);
    }
    if (u >= 1 && !C.done) {
      C.done = true;
      for (let j = 0; j < 3; j++) m.spawn("heart", 1000);
      setTimeout(() => { if (c.prop === P) c.letGo(false); }, C.style === "sip" ? 450 : 200);
      this.end();
    }
  }
  /** his mouth, in the actor's space (crumbs fall from there) */
  mouth() {
    const m = this.m; m.head.updateWorldMatrix(true, false);
    const w = m.head.localToWorld(new THREE.Vector3(0.12, -0.2, 0.52));
    if (m.actor) { m.actor.updateWorldMatrix(true, false); m.actor.worldToLocal(w); }
    return w;
  }
}
