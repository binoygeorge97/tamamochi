/* Props you can pick up, move and turn (Binoy, Nov 2–3: "move the props individually… place the props in mochi's (or
 * the others') hand by dragging it there and saying here take it"; "make sure the props are also accessible to be
 * rotated and moved by the user").
 *   drag      press on a prop on his bookcase, on the floor, on its chip under him, or the one in his hoof (or on his
 *             head), and pull: it comes away and follows your finger, floating just in front of everything
 *   give      let go over Mochi and he takes it ("for me?"); over Cocoa or Mimi and it goes in their hoof for a while;
 *             whoever you're over perks up as you get close
 *   floor     let go anywhere else and it drops onto the floor there and stays (up to 8 things, remembered in this
 *             browser); below his stage, over the chat, it stands right where you let go (for now: not remembered
 *             after a reload, when the page's layout has changed). Pull it again to move it; tap it to select it: the page's little panel turns it, tips it,
 *             nudges it, gives it to Mochi or puts it away; the mouse wheel over it turns it; "here, take it" gives
 *             him the last one you put down
 * The props stay his: nothing here changes what he owns, only where it is right now. */
import * as THREE from "three";
import { disposeProp } from "./props.js";

const MAX = 8, KEY = "mochi.floor.v1";
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const DEG = Math.PI / 180;
const emit = (name, detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent(name, { detail })); };
const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) { return []; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* no storage: it just isn't remembered */ } } };

export class Floor {
  constructor(m) {
    this.m = m; this.items = []; this.drag = null; this.over = null; this.lastDrop = null; this.given = {}; this.sel = null; this.n = 0;
    this.group = new THREE.Group(); this.group.name = "floor"; (m.furniture || m.scene).add(this.group);
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    // the selected one gets a soft ring on the floor under it
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.75, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; this.ring.renderOrder = 2; this.group.add(this.ring);
  }
  rayAt(x, y) {
    const c = this.m.canvas.getBoundingClientRect();
    this.ndc.set(((x - c.left) / c.width) * 2 - 1, -((y - c.top) / c.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.m.camera);
    return this.ray.ray;
  }
  /** where a screen point lands on an upright plane at depth z (world) */
  atDepth(x, y, z) { const r = this.rayAt(x, y), k = (z - r.origin.z) / r.direction.z; return k > 0 ? r.origin.clone().addScaledVector(r.direction, k) : null; }
  /** where it lands on the floor (y = 0) in front of the wall; null if the finger is above the horizon */
  onFloor(x, y) {
    const r = this.rayAt(x, y);
    if (r.direction.y >= -1e-3) return null;
    const k = -r.origin.y / r.direction.y, p = r.origin.clone().addScaledVector(r.direction, k);
    return p.z > -1.2 && p.z < 2.6 ? p : null;
  }
  /** is this screen height below his stage (the page lets him and his things roam over the chat: data-roam="page")? */
  belowStage(y) {
    const h = this.m.host; if (!h || h.dataset.roam !== "page") return false;
    const st = h.parentElement && h.parentElement.getBoundingClientRect();
    return !!st && y > st.bottom - 2;
  }
  /** the lowest a prop may stand (world y at depth z): just above the message box, so it's never hidden under it */
  lowest(z) {
    const h = this.m.host, fl = h && h.dataset.floor && document.querySelector(h.dataset.floor);
    const q = this.atDepth(innerWidth / 2, (fl ? fl.getBoundingClientRect().top : innerHeight) - 30, z);
    return q ? Math.min(0, q.y) : -3;
  }
  /** holder (where it stands) → spin (how it's turned) → the prop, about the size it is in his hoof */
  build(recipe) {
    const g = this.m.craft.build(recipe);
    g.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(g), big = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 0.01);
    const s = clamp(0.95 / big, 0.45, 1.1);
    const holder = new THREE.Group(), spin = new THREE.Group(), mid = new THREE.Group();
    holder.add(spin); spin.add(mid); mid.add(g); g.scale.setScalar(s);
    // turned round its own middle, not round its grip
    mid.position.set(-(box.min.x + box.max.x) / 2 * s, -(box.min.y + box.max.y) / 2 * s, -(box.min.z + box.max.z) / 2 * s);
    holder.userData.h = (box.max.y - box.min.y) * s;
    return { holder, spin };
  }
  /** stand it on the floor whichever way it's turned (its lowest point on y = 0) */
  settle(it) {
    it.spin.rotation.set(0, it.ry * DEG, it.rz * DEG, "YXZ");
    it.spin.position.set(0, 0, 0); it.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(it.spin), base = it.group.getWorldPosition(new THREE.Vector3());
    it.spin.position.y = base.y - box.min.y;
  }

  /* ---------------------------------------------------------------- dragging */
  /** start pulling a prop: { name, recipe, id } from his bookcase or chips; { item } a floor prop; { held } the one he
   *  holds or wears (he lets go of it) */
  begin(prop, x, y, { item = null, held = false } = {}) {
    this.cancel();
    let from = null;
    if (held) {   // held: true | "hand" | "worn"
      const C = this.m.craft, H = C.heldInfo && C.heldInfo(held === true ? null : held);
      if (!H || !C.releaseHeld(H)) return false;
      prop = { name: H.name, recipe: H.recipe, id: (prop && prop.id) || null };
      from = { held: H.worn ? "worn" : "hand" };
      this.m.run([["surprised", 500]]);
    }
    if (!prop || !prop.recipe) return false;
    let g, spin, ry = 0, rz = 0;
    if (item) {
      if (this.sel === item) this.select(null);
      g = item.group; spin = item.spin; ry = item.ry; rz = item.rz;
      from = { item: { at: item.at.clone(), ry, rz } };   // where it was, if the pull is called off
      this.group.remove(g); this.items = this.items.filter((i) => i !== item);
    } else ({ holder: g, spin } = this.build(prop.recipe));
    spin.rotation.set(0, ry * DEG, rz * DEG, "YXZ"); spin.position.set(0, 0, 0);
    this.m.scene.add(g);
    this.drag = { prop, g, spin, ry, rz, t0: performance.now(), x, y, from };
    this.move(x, y);
    return true;
  }
  move(x, y) {
    const D = this.drag; if (!D) return;
    D.x = x; D.y = y;
    const p = this.atDepth(x, y, 1.1);   // just in front of everyone
    if (p) D.g.position.set(p.x, p.y, p.z);
    const who = this.targetAt(x, y);
    if (who !== this.over) {
      this.over = who;
      if (who === "mochi") { if (!this.m.sulking && !this.m.inBed) this.m.run([["excited", 700]]); }
      else if (who) this.m.friend(who, "hello", 9000);
      emit("mochi:drag-over", { who });
    }
  }
  /** who's under the finger: "mochi", "cocoa", "mimi" or null */
  targetAt(x, y) {
    const m = this.m, f = m.friendAt ? m.friendAt(x, y) : null;
    if (f) return f;
    if (m.onSelf && m.onSelf(x, y)) return "mochi";
    // near one of his hooves, even just off him (Nov 4: "if we drag and place it on to mochi's hands then let him
    // automatically grab it"): a hoof reaches for what's held out to it
    if (this.nearHoof(x, y)) return "mochi";
    const h = m.host.getBoundingClientRect(), cx = h.left + h.width / 2, cy = h.top + h.height * 0.55;   // near enough to him: his middle, generously
    return Math.abs(x - cx) < h.width * 0.36 && Math.abs(y - cy) < h.height * 0.42 ? "mochi" : null;
  }
  /** is this screen point within reach of one of his hooves? */
  nearHoof(x, y) {
    const m = this.m; if (!m.arms || !m.craft || !m.craft.screen) return false;
    const reach = Math.max(36, (m.host.getBoundingClientRect().height || 300) * 0.14);
    for (const a of m.arms) {
      a.updateWorldMatrix(true, false);
      const p = m.craft.screen(a.localToWorld(new THREE.Vector3(0, -0.27, 0.035)));
      if (Math.hypot(p.x - x, p.y - y) < reach) return true;
    }
    return false;
  }
  /** will he take this one into his hoof? Not something bigger than he is (a car, a big cake), and not when his hooves
   * are full already (then it goes down next to him and he says so) */
  takes(prop) {
    const r = prop && prop.recipe; if (!r) return false;
    if (r.archetype === "ride") return false;
    const big = Array.isArray(r.parts) && r.parts.length ? (() => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const q of r.parts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q.at[k] - q.size[k] / 2); hi[k] = Math.max(hi[k], q.at[k] + q.size[k] / 2); } return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); })() : 0;
    return big <= 1.7;   // (he's 1.3 wide and 2.2 tall sitting)
  }
  handsFull() { const P = this.m.craft && this.m.craft.prop; return !!(P && !P.leaving && (P.slot === "hand" || P.slot === "ride" || P.heavy)); }
  end(x, y) {
    const D = this.drag; if (!D) return null;
    this.drag = null; this.over = null;
    emit("mochi:drag-over", { who: null });
    let who = this.targetAt(x, y);
    const m = this.m;
    // onto him: into his hoof, unless it's bigger than he is, or his hooves are full (then it goes down by him)
    if (who === "mochi" && (!this.takes(D.prop) || (this.handsFull() && !(D.from && D.from.held)))) {
      who = null;
      if (this.handsFull() && this.takes(D.prop)) { m.say(["My hooves are full! I'll put it here.", "Oops, I'm holding something already!", "Hold on, my hooves are busy!"][Math.floor(m.r() * 3)]); if (m.run) m.run([["thinking", 1100]]); }
    }
    if (who && this.give(who, D.prop)) {   // (he won't take it while he's sulking or asleep: then it goes on the floor)
      m.scene.remove(D.g); disposeProp(D.g); this.save();
      const r = { to: who, name: D.prop.name, id: D.prop.id || null };
      emit("mochi:dropped", r);
      return r;
    }
    // the floor: where the finger is, or straight down from it; below his stage (over the chat, Nov 3: "placed by the
    // user even over the chat window and conversation") it stands right where you let go
    const free = this.belowStage(y);
    let p = free ? this.atDepth(x, y, 0.4) : this.onFloor(x, y);
    if (free && p) p.y -= (D.g.userData.h || 0) * 0.45;   // the finger was on its middle, not its base
    if (!p) { const q = this.atDepth(x, y, 0.4); p = q ? new THREE.Vector3(q.x, 0, 0.4) : new THREE.Vector3(0, 0, 0.4); }
    p.x = clamp(p.x, -9, 9); p.z = clamp(p.z, -0.9, 2.2); p.y = Math.min(0, p.y);
    const from = D.g.position.clone();
    m.scene.remove(D.g);
    const it = this.place(D.prop, D.g, D.spin, this.group.worldToLocal(p.clone()), { ry: D.ry, rz: D.rz, fall: p.y < 0 ? 0.08 : Math.max(0, from.y - p.y) });
    this.lastDrop = { item: it, at: performance.now() };
    this.select(it);
    this.save();
    const r = { to: "floor", name: D.prop.name, id: D.prop.id || null, count: this.items.length };
    emit("mochi:dropped", r);
    return r;
  }
  place(prop, holder, spin, local, { ry = 0, rz = 0, fall = 0 } = {}) {
    const it = { key: ++this.n, prop, group: holder, spin, at: local, ry, rz, fall, t0: performance.now() };
    holder.position.copy(local); this.group.add(holder);
    this.items.push(it); this.settle(it);
    while (this.items.length > MAX) this.remove(this.items[0], { quiet: true });
    return it;
  }
  /** the pull is called off (the browser took the touch for a scroll, or similar): it goes back where it came from:
   *  a floor prop to its spot, his prop back to him, a copy off his bookcase simply vanishes (the bookcase still has it) */
  cancel() {
    const D = this.drag; if (!D) return;
    this.drag = null; this.over = null;
    emit("mochi:drag-over", { who: null });
    this.m.scene.remove(D.g);
    if (D.from && D.from.item) { this.place(D.prop, D.g, D.spin, D.from.item.at, { ry: D.from.item.ry, rz: D.from.item.rz }).t0 = 0; this.save(); return; }
    disposeProp(D.g);
    if (D.from && D.from.held) this.m.craft.hold(D.prop.recipe, { ms: 20000, quiet: true });
  }
  /** "here, take it" while you're still pulling it: straight to him */
  giveDragged(who = "mochi") {
    const D = this.drag; if (!D) return false;
    if (!this.give(who, D.prop)) return false;
    this.drag = null; this.over = null; emit("mochi:drag-over", { who: null });
    this.m.scene.remove(D.g); disposeProp(D.g); this.save();
    emit("mochi:dropped", { to: who, name: D.prop.name, id: D.prop.id || null });
    return true;
  }
  /** the floor prop under a screen point, or null */
  pick(x, y) {
    if (!this.items.length) return null;
    this.rayAt(x, y);
    for (const h of this.ray.intersectObjects(this.items.map((i) => i.group), true)) {
      let o = h.object; while (o && o.parent !== this.group) o = o.parent;
      const it = this.items.find((i) => i.group === o); if (it) return it;
    }
    return null;
  }

  /* ---------------------------------------------------------------- selecting, turning, nudging */
  select(it) {
    this.sel = it && this.items.includes(it) ? it : null;
    this.ring.visible = !!this.sel;
    emit("mochi:floor-select", this.sel ? { name: this.sel.prop.name } : null);
  }
  selected() { return this.sel && this.items.includes(this.sel) ? this.sel : null; }
  turn(it, deg) { it = it || this.selected(); if (!it) return false; it.ry = ((it.ry + deg) % 360 + 360) % 360; this.settle(it); this.save(); return true; }
  tip(it, deg) { it = it || this.selected(); if (!it) return false; it.rz = clamp(it.rz + deg, -90, 90); this.settle(it); this.save(); return true; }
  nudge(it, dx, dz) {
    it = it || this.selected(); if (!it) return false;
    it.at.x = clamp(it.at.x + dx, -9, 9); it.at.z = clamp(it.at.z + dz, -0.9, 2.2);
    it.group.position.copy(it.at); it.t0 = 0; this.save(); return true;
  }
  reset(it) { it = it || this.selected(); if (!it) return false; it.ry = 0; it.rz = 0; this.settle(it); this.save(); return true; }
  remove(it, { quiet = false } = {}) {
    it = it || this.selected(); if (!it) return false;
    if (this.sel === it) this.select(null);
    this.items = this.items.filter((i) => i !== it); this.group.remove(it.group); disposeProp(it.group);
    if (this.lastDrop && this.lastDrop.item === it) this.lastDrop = null;
    if (!quiet) this.save();
    return true;
  }
  /** the screen point just above a floor prop (for the page's little panel) */
  screenOf(it) {
    it = it || this.selected(); if (!it) return null;
    it.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(it.group), top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    return this.m.craft.screen(top);
  }

  /* ---------------------------------------------------------------- giving */
  give(who, prop) {
    const m = this.m;
    if (who === "mochi") {
      if (m.inBed) return false;   // asleep: it waits on the floor
      if (m.sulking) { m.touch(); m.run([["angry", 1000]]); if (m.huff) m.huff(); return false; }   // only "sorry" ends a sulk, not a present
      const r = m.craft.hold(prop.recipe, { ms: 20000 });
      if (!r || !r.ok) return false;
      m.run([["love", 1400]]); m.note(`given:${prop.name}`);
      const lines = [`For me? Yay, my ${prop.name}!`, "Ooh, thank you!", `My ${prop.name}! Hehe.`, "Got it!"];
      this.lineN = ((this.lineN ?? -1) + 1) % lines.length; m.say(lines[this.lineN]);
      emit("mochi:given", { to: "mochi", name: prop.name });
      return true;
    }
    if (!m.friendMoves || !m.friendMoves.giveProp || m.sulking || m.inBed) return false;
    if (!m.friendsHere()[who]) m.friend(who, "hello", 16000);
    m.friendMoves.giveProp(who, prop.recipe);
    this.given[who] = { until: performance.now() + 18000 };
    const st = who === "mimi" ? m.gf : m.bud; if (st) st.until = Math.max(st.until, performance.now() + 16000);
    const say = who === "mimi" ? ["For me? Aww, thank you ♡", "Ooh, pretty! Hehe."] : ["Sweet! Thanks, dude!", "Ooh, gimme gimme! Thanks!"];
    if (m.scuffle) m.scuffle.say(who, say[Math.floor(m.r() * say.length)]);
    m.note(`gave_${who}:${prop.name}`);
    emit("mochi:given", { to: who, name: prop.name });
    return true;
  }
  /** give a floor prop to someone: "here, take it" (the last one you put down), the panel's button, or a tap's choice */
  take(it = null, who = "mochi") {
    it = it || (this.lastDrop && this.items.includes(this.lastDrop.item) ? this.lastDrop.item : this.items[this.items.length - 1]);
    if (!it) return false;
    if (!this.give(who, it.prop)) return false;   // he wouldn't (sulking, asleep): it stays put
    this.remove(it);
    return true;
  }
  /** Zero Day switched: the floor props change their look in place */
  retheme() {
    for (const it of this.items) {
      const { holder, spin } = this.build(it.prop.recipe);
      this.group.remove(it.group); disposeProp(it.group);
      it.group = holder; it.spin = spin; holder.position.copy(it.at); this.group.add(holder); this.settle(it);
    }
  }
  recent(ms = 120000) { return !!(this.lastDrop && this.items.includes(this.lastDrop.item) && performance.now() - this.lastDrop.at < ms); }
  clearAll() { for (const it of [...this.items]) this.remove(it, { quiet: true }); this.lastDrop = null; this.cancel(); this.save(); }
  names() { return this.items.map((i) => i.prop.name); }

  /* ---------------------------------------------------------------- remembered in this browser */
  save() { store.set(this.items.map((i) => ({ id: i.prop.id || null, name: i.prop.name, at: [i.at.x, i.at.y, i.at.z].map((v) => Math.round(v * 1000) / 1000), ry: i.ry, rz: i.rz }))); }
  /** put back what was on the floor last time, from the props he has now ([{ id, name, recipe }]) */
  restore(props) {
    if (this.restored || !Array.isArray(props)) return 0;
    this.restored = true;
    let n = 0;
    for (const s of store.get().slice(0, MAX)) {
      const p = (s.id && props.find((q) => q.id === s.id)) || props.find((q) => q.name === s.name);
      if (!p || !p.recipe || !Array.isArray(s.at)) continue;
      // one left over the page (below his stage, over the chat) was put there for now: after a reload the page is laid
      // out differently (the window's size, the chat, the menu) and its spot can be an empty margin nothing reaches
      // (Nov 4: the Christmas scarf, stuck off to the left of the chat for a day). It goes back on his shelf instead
      // (the shelf still has it); only what's on his stage's own floor comes back where it was.
      if ((+s.at[1] || 0) < -0.05) continue;
      const { holder, spin } = this.build(p.recipe);
      const z = clamp(+s.at[2] || 0, -0.9, 2.2), y = clamp(+s.at[1] || 0, this.lowest(z), 0);   // (over the chat: still on screen if the window got smaller)
      this.place({ id: p.id || null, name: p.name, recipe: p.recipe }, holder, spin, new THREE.Vector3(+s.at[0] || 0, y, z), { ry: +s.ry || 0, rz: clamp(+s.rz || 0, -90, 90) });
      n++;
    }
    for (const it of this.items) it.t0 = 0;   // no falling in
    this.save();
    return n;
  }

  step(now) {
    for (const it of this.items) {   // a dropped prop falls the last little bit and settles with a bounce
      const u = it.t0 ? clamp((now - it.t0) / 380, 0, 1) : 1;
      if (u < 1) { const b = it.fall * (1 - u) * (1 - u) + Math.abs(Math.sin(u * Math.PI)) * 0.06 * (1 - u); it.group.position.set(it.at.x, it.at.y + b, it.at.z); }
      else if (!it.group.position.equals(it.at)) it.group.position.copy(it.at);
    }
    const S = this.selected();
    if (S) { this.ring.position.set(S.at.x, S.at.y + 0.006, S.at.z); this.ring.material.opacity = 0.55 + 0.25 * Math.sin(now / 260); }
    else if (this.ring.visible) this.ring.visible = false;
    if (this.drag) this.drag.g.rotation.z = Math.sin(now / 180) * 0.08;   // a gentle wobble on the one you're pulling
    for (const who of Object.keys(this.given)) {   // a friend's present goes back after a while (or when they go)
      const st = who === "mimi" ? this.m.gf : this.m.bud;
      if (now > this.given[who].until || !st || st.leaving) { if (this.m.friendMoves) this.m.friendMoves.dropProp(who); delete this.given[who]; }
    }
  }
}
