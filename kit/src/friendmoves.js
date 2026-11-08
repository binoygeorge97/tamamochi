/* Mochi teaches Mimi (or Cocoa) a move (the plan's "second-order teaching": the skill library is data, so the same
 * recipe runs on a friend's body). "Teach Mimi the twirl": she hops in and watches, he shows her ("Watch, Mimi!"),
 * she tries it, wobbly; "Almost! Again!"; her second go is smoother; he cheers. If the move is done with a prop she
 * gets her own copy in her hoof. The friends' moves are the same channel tracks as his (arms, head, hop, lean, spin,
 * sway, the prop's spin and tilt), played over whatever they're doing, blended in and out so nothing snaps. */
import * as THREE from "three";
import { sampleMove, validateMove, eatStyle, ARCHETYPES } from "../../shared/craft.js";
import { armRx, armRz } from "./stagecraft.js";
import { disposeProp } from "./props.js";
import { MIMI_SCALE, COCOA_SCALE } from "./sizes.js";
import { shellsOf, contactX, wrapArm, overlapping, touches, earShells, aimAngles, SQUISH } from "./hug.js";

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
const emit = (detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:taught", { detail })); };
const NAME = { mimi: "Mimi", cocoa: "Cocoa" };
// where something to wear goes on each of them, made for Mochi: his hats sit at 0.44 on his head (head wool 0.55 wide,
// the head scaled 1.17) and what he wears on his body at 0.56 on it (body wool 0.5 wide); theirs, by the same measure
const WEAR_FIT = {
  mimi: { headY: 0.432, head: (1 / 1.17) * (0.54 / 0.55), bodyY: 0.54, body: 0.96 },
  cocoa: { headY: 0.432, head: (1 / 1.17) * (0.55 / 0.55), bodyY: 0.55, body: 1.03 },
};
const HEAD_TILT = 0.3;   // in a hug, how far each head tips away from the other (their heads are bigger than their bodies: upright, the heads met with the bodies a hoof apart)

export class FriendMoves {
  constructor(m) {
    this.m = m; this.jobs = []; this.lesson = null;
    this.hands = {};   // a friend's own copy of the prop: { group, inner, arm }
    this.shares = [];  // him handing them something, one at a time
    this.worn = { mimi: {}, cocoa: {} };   // dressed up (Nov 7): { head, body } each { mount, g, recipe }
  }
  /* Dressing up (Nov 7, Binoy: "allow the other two characters mimi and cocoa to also dress up as any of these
   * professions correctly"). Something to wear, made for Mochi (shared/jobs.js), on Mimi or Cocoa: on the same spot of
   * their head or body as on his, sized to them (their heads and bodies are a little smaller than his, in their own
   * units: mochi.js). Mimi's bow comes off under a hat, Cocoa's bandana under something round his neck. */
  wear(who, recipe) {
    const A = recipe && ARCHETYPES[recipe.archetype], slot = A && A.slot;
    if (slot !== "head" && slot !== "body" || !this.worn[who]) return false;
    this.unwear(who, slot);
    const R = this.rig(who), F = WEAR_FIT[who], mount = new THREE.Group();
    if (slot === "head") { mount.position.set(0, F.headY, 0); mount.scale.setScalar(F.head); R.head.add(mount); }
    else { mount.position.set(0, F.bodyY, 0); mount.scale.setScalar(F.body); R.body.add(mount); }
    const g = this.m.craft.build(recipe); mount.add(g);
    this.worn[who][slot] = { mount, g, recipe, born: performance.now() };
    this.ownLook(who);
    return true;
  }
  unwear(who, slot = null) {
    const W = this.worn[who]; if (!W) return;
    for (const k of slot ? [slot] : ["head", "body"]) { const X = W[k]; if (!X) continue; X.mount.parent && X.mount.parent.remove(X.mount); disposeProp(X.g); delete W[k]; }
    this.ownLook(who);
  }
  wearing(who) { const W = this.worn[who] || {}; return ["head", "body"].filter((k) => W[k]).map((k) => W[k].recipe.name); }
  ownLook(who) {
    const W = this.worn[who] || {}, m = this.m;
    if (who === "mimi" && m.mimiBow) m.mimiBow.visible = !W.head;
    if (who === "cocoa" && m.cocoaBandana) m.cocoaBandana.visible = !W.body;
  }
  /** a tool for the job in their hoof, held up in front of them for a while (ms) */
  holdFor(who, recipe, ms = 45000) {
    if (!recipe || !this.rig(who).here()) return false;
    this.giveProp(who, recipe);
    const H = this.hands[who]; H.carry = true; H.keepUntil = performance.now() + ms;
    return true;
  }
  rig(who) {
    const m = this.m;
    return who === "mimi" ? { g: m.mimi, body: m.mimiBody, neck: m.mimiNeck, head: m.mimiHead, arms: m.mimiArms, here: () => !!(m.gf && !m.gf.leaving), state: () => m.gf, scale: MIMI_SCALE }
      : { g: m.cocoa, body: m.cocoaBody, neck: m.cocoaNeck, head: m.cocoaHead, arms: m.cocoaArms, here: () => !!(m.bud && !m.bud.leaving), state: () => m.bud, scale: COCOA_SCALE };
  }
  /** a friend plays a move (skill 0 wobbly … 1 smooth) */
  play(who, input, { skill = 0.5, seed = "friend", prop = null } = {}) {
    const v = validateMove(input);
    if (!v.recipe || !this.rig(who).here()) return false;
    this.jobs = this.jobs.filter((j) => j.who !== who);
    this.jobs.push({ who, recipe: v.recipe, skill, seed: `${seed}:${who}`, t0: performance.now(), d: v.recipe.duration });
    if (prop && v.recipe.prop) this.giveProp(who, prop);
    return true;
  }
  giveProp(who, recipe, side = 1) {
    this.dropProp(who);
    const R = this.rig(who), arm = R.arms.find((a) => a.userData.side === side) || R.arms.find((a) => a.userData.side > 0);
    const hand = new THREE.Group(); hand.position.set(0, -0.26, 0.04); arm.add(hand);
    const inner = new THREE.Group(); hand.add(inner);
    const g = this.m.craft.build(recipe); inner.add(g); g.scale.setScalar(0.92);
    this.hands[who] = { hand, inner, g, arm, recipe, born: performance.now() };
  }
  retheme() {   // Zero Day switched: what Mimi or Cocoa holds changes its look too
    for (const H of Object.values(this.hands)) { if (!H.recipe) continue; const g = this.m.craft.build(H.recipe); g.scale.copy(H.g.scale); disposeProp(H.g); H.inner.add(g); H.g = g; }
    for (const W of Object.values(this.worn)) for (const X of Object.values(W)) { const g = this.m.craft.build(X.recipe); disposeProp(X.g); X.mount.add(g); X.g = g; }   // and what they wear
  }
  dropProp(who) { const H = this.hands[who]; if (!H) return; H.arm.remove(H.hand); disposeProp(H.g); delete this.hands[who]; }
  /** "teach Mimi the twirl": { name, recipe, skill } (and the prop he does it with, if any) */
  teach(who, move, { prop = null } = {}) {
    const m = this.m;
    if (m.sulking || m.inBed || !move || !move.recipe || !NAME[who]) return { ok: false };
    const v = validateMove(move.recipe);
    if (!v.recipe) return { ok: false };
    if (!this.rig(who).here()) m.friend(who, "learn", 26000);
    const st = this.rig(who).state(); if (st) { st.role = "learn"; st.roleAt = performance.now(); st.until = Math.max(st.until, performance.now() + 20000); }
    this.lesson = { who, move: { ...move, recipe: v.recipe }, prop, phase: "arrive", t0: performance.now(), d: v.recipe.duration };
    return { ok: true, ms: 1500 + (v.recipe.duration + 0.9) * 3000 + 1500 };
  }
  busy() { return !!(this.lesson || this.jobs.length || this.hugging || this.giving || this.shares.length); }
  /** a friend comes by carrying something (Nov 4, a little scene: "Mimi shows up with some food"): it's in their
   * hoof, held out in front of them, upright, until they hand it over */
  carry(who, recipe) {
    if (!NAME[who] || !recipe) return false;
    this.giveProp(who, recipe);
    const H = this.hands[who]; H.carry = true; H.w = 0;
    return true;
  }
  carrying(who) { const H = this.hands[who]; return H && H.carry ? H.recipe : null; }
  /** and hands it to Mochi: they step up to him, hoof out, and he takes it (holds it, or puts it on, or sets it down
   * beside him if it's that kind of thing). done(recipe) once it's his. */
  handOver(who, done = null) {
    const m = this.m, H = this.hands[who], st = this.rig(who).state();
    if (!H || !H.carry || !st || st.leaving || m.sulking || m.inBed) return false;
    const now = performance.now();
    this.giving = { who, t0: now, recipe: H.recipe, done, role: st.role, given: false };
    st.role = "give"; st.roleAt = now; st.until = Math.max(st.until, now + 8000);
    return true;
  }
  /** he shares something with them (Nov 4, Binoy: "it would also be cool to have mochi be able to share his props
   * with his friends like a cookie"): he holds it out, they step up and take it. Food: they get one of their own (he
   * keeps his) and eat it, bite by bite, crumbs and all. Anything else: he gives it to them (with two of them, they
   * get one each) and they hold it a while, looking at it. who: "mimi", "cocoa" or both, one after the other.
   * give: true hands over his own, false keeps his (default: keep food, give things). */
  share(who, recipe, { give = null, done = null } = {}) {   // done(who): eaten up, or in their hoof
    const m = this.m, list = [...new Set(Array.isArray(who) ? who : [who])].filter((w) => NAME[w]);
    if (!list.length || !recipe || !recipe.name || m.sulking || m.inBed) return { ok: false };
    const style = eatStyle(recipe.name), food = !!style, keep = give == null ? food || list.length > 1 : !give;
    const now = performance.now(), C = m.craft;
    const inHoof = C && C.prop && !C.prop.leaving && C.prop.recipe && C.prop.recipe.name === recipe.name;
    if (C && !inHoof) C.hold(recipe, { ms: 30000 });
    let late = false;
    for (const w of list) { if (!this.rig(w).here()) { m.friend(w, "hello", 24000); late = true; } else if (m.stayFriend) m.stayFriend(w, 24000); }
    let t = Math.max(now + (late ? 2600 : 700), ...this.shares.map((x) => x.t0 + 1700));
    for (const w of list) { this.shares.push({ who: w, recipe, style, keep: keep || w !== list.at(-1), t0: t, done }); t += 1700; }
    return { ok: true, food, ms: t - now + (food ? 3600 : 1500) };
  }
  sharing() { return this.shares.length > 0; }
  /** a big hug with Mimi or Cocoa: they come right up to him, arms round each other, hearts */
  hug(who, ms = 3600) {
    const m = this.m;
    if (m.sulking || m.inBed || !NAME[who]) return false;
    if (!this.rig(who).here()) m.friend(who, "hello", ms + 6000);
    const now = performance.now();
    this.hugging = { who, t0: now + (this.rig(who).here() ? 0 : 1500), until: now + ms + (this.rig(who).here() ? 0 : 1500), started: false };
    if (m.craft && m.craft.prop && m.craft.prop.slot === "hand") m.craft.letGo(false);   // both hooves free for it
    return true;
  }

  /* every frame, after the friends are posed (their roles) and before Mochi's own move layer */
  step(now, dt) {
    const m = this.m, L = this.lesson;
    for (const who of ["mimi", "cocoa"]) {   // dressed up: it comes off when they go home; it pops on
      const W = this.worn[who]; if (!W.head && !W.body) continue;
      const R = this.rig(who);
      if (!R.here() && !(R.state() && R.state().leaving)) { this.unwear(who); continue; }
      for (const X of Object.values(W)) { const u = Math.min(1, (now - X.born) / 280); X.g.scale.setScalar(u < 1 ? 0.6 + 0.4 * u + 0.12 * Math.sin(u * Math.PI) : 1); }
    }
    if (L) this.stepLesson(now, L);
    if (this.hugging) this.stepHug(now);
    if (this.giving) this.stepGive(now);
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      const J = this.jobs[i], R = this.rig(J.who), t = (now - J.t0) / 1000;
      if (!R.here() || t > J.d + 0.25) { this.jobs.splice(i, 1); if ((!this.lesson || this.lesson.who !== J.who) && !(this.hands[J.who] && this.hands[J.who].carry && R.here())) this.dropProp(J.who); continue; }
      const w = ease(t / 0.2) * ease((J.d + 0.25 - t) / 0.25), v = sampleMove(J.recipe, Math.min(J.d, t), { skill: J.skill, seed: J.seed });
      const has = (k) => J.recipe.tracks[k] !== undefined, g = (k) => (v[k] !== undefined ? v[k] : 0);
      R.arms.forEach((a) => {
        const s = a.userData.side, nm = s > 0 ? "rightArm" : "leftArm";
        if (!has(`${nm}.raise`) && !has(`${nm}.spread`)) return;
        a.rotation.x = lerp(a.rotation.x, armRx(g(`${nm}.raise`)), w); a.rotation.z = lerp(a.rotation.z, armRz(s, g(`${nm}.spread`)), w);
      });
      R.neck.rotation.x += 0.5 * g("head.nod") * w; R.neck.rotation.y += 0.7 * g("head.turn") * w; R.neck.rotation.z += -0.4 * g("head.tilt") * w;
      R.g.position.y += 0.45 * g("body.hop") * R.scale * w;
      // fading out after a whole turn, they're facing front already: no spinning back the way they came (they whirled
      // round backwards a full turn in a quarter second after every dance spin: Nov 4 probe)
      if (!m.reduce) { const sp = g("body.spin"); R.g.rotation.y += TAU * lerp(Math.round(sp), sp, w); }
      R.g.rotation.z += -0.35 * g("body.sway") * w;
      R.g.rotation.z += 0.12 * g("body.hips") * w; R.g.rotation.y += 0.2 * g("body.hips") * w;   // (a hip swing, roughly)
      R.body.rotation.x += 0.35 * g("body.lean") * w;
      const H = this.hands[J.who];
      if (H) {   // her copy stays upright in her hoof, turning and tipping with the move
        H.arm.updateWorldMatrix(true, false);
        const up = R.body.getWorldQuaternion(this.qA || (this.qA = new THREE.Quaternion()));
        H.hand.quaternion.copy(H.arm.getWorldQuaternion(this.qB || (this.qB = new THREE.Quaternion())).invert().multiply(up));
        H.inner.rotation.set(0, TAU * g("prop.spin"), -0.6 * g("prop.tilt"));
        H.g.scale.setScalar(0.92 * Math.min(1, (now - H.born) / 250));
      }
    }
    this.stepCarry(now, dt);
  }
  /* what they're carrying: held out in front, upright, as they walk in (after whatever their role did to the arm) */
  stepCarry(now, dt) {
    for (const [who, H] of Object.entries(this.hands)) {
      if (!H.carry) continue;
      const R = this.rig(who);
      if (!R.here() && !(R.state() && R.state().leaving)) { this.dropProp(who); continue; }
      if (this.jobs.some((j) => j.who === who)) continue;
      H.w = Math.min(1, (H.w || 0) + dt / 0.3);
      const G = this.giving && this.giving.who === who ? this.giving : null, out = G ? Math.sin(Math.PI * clamp((now - G.t0) / 1300, 0, 1)) : 0;   // held further out to him
      const k = ease(H.w), s = H.arm.userData.side;
      H.arm.rotation.x = lerp(H.arm.rotation.x, -1.2 - 0.35 * out, k); H.arm.rotation.z = lerp(H.arm.rotation.z, s * (0.18 - 0.15 * out), k);
      const other = R.arms.find((a) => a !== H.arm);   // the other hoof underneath, steadying it
      if (other) { other.rotation.x = lerp(other.rotation.x, -0.95 - 0.2 * out, k); other.rotation.z = lerp(other.rotation.z, -s * 0.05, k); }
      H.arm.updateWorldMatrix(true, false);
      const up = R.body.getWorldQuaternion(this.qA || (this.qA = new THREE.Quaternion()));
      H.hand.quaternion.copy(H.arm.getWorldQuaternion(this.qB || (this.qB = new THREE.Quaternion())).invert().multiply(up));
      H.inner.rotation.set(0, 0, 0);
      H.g.scale.setScalar(0.92 * Math.min(1, (now - H.born) / 250) * (H.left == null ? 1 : Math.max(0.001, H.left)));
      if (H.eat) this.stepFriendEat(who, H, R, now);
      else if (H.keepUntil && now > H.keepUntil) this.dropProp(who);   // (it goes in their pocket)
    }
  }
  /* something he shared: up to the mouth, a bite (or a sip), down again; three times and it's gone */
  stepFriendEat(who, H, R, now) {
    const E = H.eat, BITE = E.style === "sip" ? 1300 : 950, u = (now - E.t0) / BITE;
    if (u < 0) return;
    const b = Math.floor(u);
    if (b >= 3) {
      this.dropProp(who);
      const st = R.state();
      if (st && st.role === "give") { st.role = E.role && E.role !== "give" ? E.role : "hello"; st.roleAt = now; }
      if (this.m.spawn) for (let i = 0; i < 2; i++) this.m.spawn("heart", 1300);
      if (E.done) try { E.done(); } catch (_) { /* fine */ }
      return;
    }
    const f = u - b, lift = Math.sin(Math.PI * clamp(f / 0.8, 0, 1));
    // she bends to it and it comes up to her: head and body bow forward, the hoof lifts it to her mouth (the arm is
    // shorter than shoulder to mouth, so the last bit is the food coming up out of the hoof a little)
    R.neck.rotation.x += 0.3 * lift; R.body.rotation.x += 0.1 * lift;
    R.g.updateWorldMatrix(true, true);
    const mouth = R.head.localToWorld(new THREE.Vector3(0, -0.2, 0.5));
    const aim = aimAngles(H.arm, mouth);
    H.arm.rotation.x = lerp(H.arm.rotation.x, aim.rx, lift); H.arm.rotation.z = lerp(H.arm.rotation.z, aim.rz, lift); H.arm.rotation.y = lerp(H.arm.rotation.y, 0, lift);
    H.arm.updateWorldMatrix(true, false);
    const sh = H.arm.getWorldPosition(new THREE.Vector3()), reach = 0.26 * H.arm.getWorldScale(new THREE.Vector3()).y;
    const extra = clamp(sh.distanceTo(mouth) - reach - 0.12 * R.scale, 0, 0.2);
    H.hand.position.y = -0.26 - (extra / H.arm.getWorldScale(new THREE.Vector3()).y) * lift;
    if (f > 0.4 && E.b !== b) {   // the bite
      E.b = b;
      if (E.style !== "sip") {
        H.leftTo = 1 - (b + 1) / 3;
        const at = this.m.actor ? this.m.actor.worldToLocal(mouth.clone()) : mouth;
        for (let i = 0; i < 3; i++) this.m.spawn("crumb", 900, 0, at);
      }
    }
    if (H.leftTo != null) H.left = (H.left == null ? 1 : H.left) + (H.leftTo - (H.left == null ? 1 : H.left)) * 0.35;
  }
  /* him handing it over (last thing each frame: his arm, after his own move layer has posed it) */
  stepShares(now) {
    const S = this.shares[0];
    if (!S || now < S.t0) return;
    const m = this.m, R = this.rig(S.who), st = R.state(), u = now - S.t0;
    if (!R.here() || !st) { if (u > 5000) this.shares.shift(); return; }   // still on the way in (or they went)
    if (!S.started) { S.started = true; S.role = st.role; st.role = "give"; st.roleAt = now; st.until = Math.max(st.until, now + 14000); }
    // his hoof out to them, it in it
    const side = Math.sign(R.g.position.x - m.root.position.x) || 1, out = Math.sin(Math.PI * clamp(u / 1400, 0, 1));
    const P = m.craft && m.craft.prop;
    if (out > 0 && (!S.given || S.keep)) { const a = m.arms[1]; a.rotation.x = lerp(a.rotation.x, -1.38, out); a.rotation.z = lerp(a.rotation.z, side > 0 ? 0.95 : -0.15, out); }
    if (!S.given && u > 700) {   // into their hoof
      S.given = true;
      this.giveProp(S.who, S.recipe, -side);   // (the hoof nearer him)
      const H = this.hands[S.who]; H.carry = true; H.w = 0.6;
      const done = () => { if (S.done) try { S.done(S.who); } catch (_) { /* fine */ } };
      if (S.style) H.eat = { t0: now + 1100, style: S.style, b: -1, role: S.role, done };   // (she stays up close till it's gone)
      else { H.keepUntil = now + 11000; done(); }
      if (!S.keep && P && !P.leaving && P.recipe && P.recipe.name === S.recipe.name) m.craft.letGo(false);
      m.spawn("star", 900);
    }
    if (u > 1400) {
      if (st.role === "give" && !S.style) { st.role = S.role && S.role !== "give" ? S.role : "hello"; st.roleAt = now; }
      this.shares.shift();
    }
  }
  stepGive(now) {
    const m = this.m, G = this.giving, R = this.rig(G.who), st = R.state(), u = now - G.t0;
    if (!R.here() || !st) { this.giving = null; return; }
    if (!G.given && u > 700) {   // into his hoof
      G.given = true; this.dropProp(G.who);
      if (m.craft) m.craft.hold(G.recipe, { ms: 40000, quiet: true });
      if (G.done) try { G.done(G.recipe); } catch (_) { /* fine */ }
    }
    if (u > 1300) { if (st.role === "give") { st.role = G.role && G.role !== "give" ? G.role : "hello"; st.roleAt = now; } this.giving = null; }
  }
  stepHug(now) {
    const m = this.m, H = this.hugging, R = this.rig(H.who), st = R.state();
    if (now < H.t0) return;   // they're still on their way in
    if (!R.here() || now > H.until + 500) { this.hugging = null; if (st && !st.leaving) { st.role = H.who === "mimi" ? "showoff" : "hello"; st.roleAt = now; } return; }
    if (!H.started) {
      H.started = true; if (st) { st.role = "hug"; st.roleAt = now; st.until = Math.max(st.until, H.until + 5000); }
      m.run([["love", H.until - now]]); emit({ who: H.who, hug: true }); m.note(`hug_${H.who}`);
    }
    if (now - (H.heartAt || 0) > 420 && now < H.until && m.parts.length < 12) { H.heartAt = now; m.spawn("heart", 1500); }
    // his side: turn and lean into them (his swaying calmed, so they sway together), the hoof on their side round them
    // (settle() puts it on their back), the other one in front
    const k = H.k = Math.min(1, (now - H.t0) / 450) * Math.min(1, Math.max(0, (H.until + 400 - now) / 400)), side = H.who === "mimi" ? 1 : -1;
    m.root.rotation.z *= 1 - 0.7 * k;
    m.root.rotation.z -= 0.04 * side * k; m.root.position.x += 0.1 * side * k; m.root.rotation.y += 0.28 * side * k;
    // his head tips a little away (it's far bigger than his body: upright, their heads met with their bodies a hoof
    // apart) and the ear on their side folds back out of the way
    m.neck.rotation.z += HEAD_TILT * side * k;
    m.ears.forEach((e) => { if (e.userData.side === side) e.rotation.y = lerp(e.rotation.y, side * 1.15, k); });
    const g = H.who === "mimi" ? m.mimi : m.cocoa; g.rotation.y -= 0.22 * side * k;   // and they turn to him
    m.arms.forEach((a, i) => {
      const s = i ? 1 : -1, round = s === side;
      a.rotation.x = lerp(a.rotation.x, armRx(round ? 0.38 : 0.3), k); a.rotation.z = lerp(a.rotation.z, armRz(s, round ? 0.72 : 0.05), k);
    });
  }
  /* last thing each frame (after everything that moves him; Nov 4: "make sure the actual hug physics are correct and
   * they dont phase through"): a friend never stands inside him. In a hug (or easing out of one) she stands where
   * their fleece and his meet, the fleece squashing a little, and the inner hooves rest on each other's backs; the rest
   * of the time, if where she'd stand overlaps him (her spot is fixed and his head and ears are big: his ear was in
   * her head just standing beside him), she's nudged out to just touching (hug.js) */
  settle(now = performance.now()) {
    const m = this.m, dt = clamp((now - (this.settleAt || now)) / 1000, 0, 0.1); this.settleAt = now;
    if (m.craft && m.craft.rider && m.craft.rider.cur) return;   // riding something: they're in it, or out of the way
    for (const who of ["mimi", "cocoa"]) {
      const F = who === "mimi" ? m.gf : m.bud, g = who === "mimi" ? m.mimi : m.cocoa, ground = who === "mimi" ? m.mimiGround : m.cocoaGround;
      if (!F) continue;
      const free = g.visible && !F.inCar && !F.held && !(m.piggy && m.piggy.riding(who)) && performance.now() >= F.t0;   // (before then: off-screen, or peeking in)
      const away = Math.sign(g.position.x - m.root.position.x) || (who === "mimi" ? 1 : -1);
      const k = free && F.hugK > 0.001 && F.hugBase != null ? F.hugK : 0;
      // hugging, her head tips a little away from him and the ear on his side folds back (as his do: stepHug)
      (who === "mimi" ? m.mimiEars : m.cocoaEars).forEach((e) => { e.rotation.y = e.userData.side === -away ? -away * 1.15 * Math.max(k, e.userData.give || 0) : 0; });
      if (k) (who === "mimi" ? m.mimiNeck : m.cocoaNeck).rotation.z -= HEAD_TILT * away * k;
      // a hug that's only theirs (a role, not his hug()): his head and ear make room too (stepHug does it for his own)
      const H = this.hugging && this.hugging.who === who && this.hugging.started ? this.hugging : null;
      if (k && !H) {
        m.neck.rotation.z += HEAD_TILT * away * k;
        m.ears.forEach((e) => { if (e.userData.side === away) e.rotation.y = lerp(e.rotation.y, away * 1.15, k); });
      }
      if (!k) F.hugX = null;
      if (!free) continue;
      let x = g.position.x;
      if (k) {
        const cx = contactX(m, who, g, away, SQUISH);
        F.push = (F.push || 0) * Math.exp(-dt * 5);   // (from being nudged out before the hug: it hands over gently)
        x = lerp(F.hugBase + away * F.push, cx, k);
        if (away * (x - cx) < 0) x = cx;   // never closer than touching (even easing in from a spot that was too close)
        F.hugX = cx;
      } else {
        // not hugging: an ear touching the other's head bends back out of the way (they're soft; pushing her away
        // for an ear had her sliding about as she danced: Nov 4 probe)...
        this.earsGive(who, away, dt);
        // ...and she's pushed out to just touching if her body or head overlaps his; the push eases in and out over a
        // few frames (a hard push followed every sway and bob), quickly enough that she never shows inside him
        const need = overlapping(m, who, 0.96, false) ? Math.max(0, away * (contactX(m, who, g, away, 0.96, false) - x)) : 0;
        F.push = (F.push || 0) + (need - (F.push || 0)) * (1 - Math.exp(-dt * (need > (F.push || 0) ? 10 : 3)));
        if (F.push < 1e-4) { F.push = 0; continue; }
        x += away * F.push;
      }
      const dx = x - g.position.x; g.position.x = x; if (ground) ground.position.x += dx; g.updateMatrixWorld(true);
      if (!k) continue;
      const mine = shellsOf(m, "mochi"), theirs = shellsOf(m, who);
      const inner = (who === "mimi" ? m.mimiArms : m.cocoaArms).find((a) => a.userData.side === -away);
      if (inner) wrapArm(inner, who === "mimi" ? 0.23 : 0.24, theirs, mine, k, now);
      if (H && H.k > 0.001) { const a = m.arms.find((q) => q.userData.side === away); if (a) wrapArm(a, 0.245, mine, theirs, H.k, now); }
    }
    this.stepShares(now);
    // an ear that bent back for someone who's gone (or hugging now) comes back up
    for (const e of [...m.ears, ...(m.mimiEars || []), ...(m.cocoaEars || [])]) {
      if (!e.userData.give || e.userData.giveAt === now) continue;
      e.userData.give *= Math.exp(-dt * 2.5); if (e.userData.give < 0.01) e.userData.give = 0;
      if (m.ears.includes(e)) e.rotation.y = lerp(e.rotation.y, e.userData.side * 1.15, e.userData.give);
    }
  }
  /** his ear on her side and hers on his: each bends back while it's touching the other (and eases back up after) */
  earsGive(who, away, dt) {
    const m = this.m, mine = shellsOf(m, "mochi", false), theirs = shellsOf(m, who, false);
    const bend = (e, M, other) => {
      // it bends back while it touches, and comes back up only once it's clear with room to spare (bent part way it
      // can be clear while upright it wouldn't be, and it would flap)
      const r = touches(M, other), g0 = e.userData.give || 0, want = r < 1 || (r < 1.15 && g0 > 0.05);
      e.userData.give = g0 + ((want ? 1 : 0) - g0) * (1 - Math.exp(-dt * (r < 1 ? 9 : 2.5)));
      e.userData.giveAt = this.settleAt;
    };
    for (const [e, M] of earShells(m.ears)) if (e.userData.side === away) bend(e, M, theirs);
    for (const [e, M] of earShells(who === "mimi" ? m.mimiEars : m.cocoaEars)) if (e.userData.side === -away) bend(e, M, mine);
    // his: on top of how his ears are posed this frame (hers are set from it each frame above)
    m.ears.forEach((e) => { if (e.userData.side === away && e.userData.give) e.rotation.y = lerp(e.rotation.y, away * 1.15, e.userData.give); });
  }
  stepLesson(now, L) {
    const m = this.m, R = this.rig(L.who), el = (now - L.t0) / 1000, who = NAME[L.who];
    const watch = (k) => { m.neck.rotation.y += (L.who === "mimi" ? 0.35 : -0.35) * k; };   // he looks over at her while she tries
    if (L.phase !== "arrive" && (!R.here() || m.inBed || m.sulking)) { this.lesson = null; this.dropProp(L.who); return; }   // she left (or he's done for the day): no cheering an empty spot
    switch (L.phase) {
      case "arrive":   // she's here, and his answer is in (it would wipe a move he'd queued)
        if (R.here() && el > 1.3 && !m.busy) { L.phase = "show"; L.t0 = now; m.say(`Watch, ${who}!`); m.craft.play(L.move.recipe, { skill: Math.max(0.6, L.move.skill || 0.6), prop: L.prop, name: L.move.name, id: L.move.id || null }); }
        else if (el > 15) { this.lesson = null; }
        break;
      case "show": {   // his turn (it may wait for whatever he's doing first): then hers, half a second after he's done
        const P = m.craft.perf;
        if (!L.seen && P && P.name === L.move.name) L.seen = true;
        if (!L.doneAt && ((L.seen && !m.craft.perf) || el > L.d + 6)) L.doneAt = now;
        if (L.doneAt && now - L.doneAt > 500) { L.phase = "try1"; L.t0 = now; this.play(L.who, L.move.recipe, { skill: 0.08, seed: "first", prop: L.prop }); }
        break;
      }
      case "try1":
        watch(ease(el / 0.4));
        if (el > L.d + 0.5) { L.phase = "again"; L.t0 = now; m.say("Almost! Again!"); m.run([["excited", 1200]]); }
        break;
      case "again":
        if (el > 1.2) { L.phase = "try2"; L.t0 = now; this.play(L.who, L.move.recipe, { skill: 0.6, seed: "second", prop: L.prop }); }
        break;
      case "try2":
        watch(ease(el / 0.4));
        if (el > L.d + 0.5) {
          L.phase = "cheer"; L.t0 = now;
          m.say(`You got it, ${who}!`); m.run([["happy", 1800]]);
          for (let i = 0; i < 4; i++) m.spawn(i % 2 ? "heart" : "star", 1400);
          const st = R.state(); if (st) { st.role = L.who === "mimi" ? "showoff" : "cheer"; st.roleAt = now; st.until = Math.max(st.until, now + 6000); }
          emit({ who: L.who, move: L.move.name });
          m.note(`taught_${L.who}`);
        }
        break;
      case "cheer":
        if (el > 1.5) { this.lesson = null; this.dropProp(L.who); }
        break;
    }
  }
}
