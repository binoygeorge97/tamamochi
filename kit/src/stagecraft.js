/* Stagecraft: what Mochi holds and how he moves (days 2–3).
 *
 * Props: a recipe (shared/craft.js), built by props.js and mounted in its slot:
 *   hand    the hoof on the screen's right. Upright props stay upright whatever the arm does (a wand, an umbrella held
 *           up over his head), launchers are aimed out to the side and a little up, "along" props point where the
 *           arm points. A held prop sways a little behind the hoof when it moves, like a real thing would.
 *   head    on top of his head (hats, crowns, glasses); his costume hats step aside meanwhile.
 *   body    around his round body (a protective vest, a medal, a scarf), breathing with him.
 *   beside  on the ground at his side (a plush friend, a plant), breathing gently.
 * Moves: a recipe of channel tracks played as a layer over whatever the body is doing: the arms are blended toward
 *   the move's pose, everything else is added as an offset. Wobbly at first (skill), smoother with practice: pat him
 *   within a few seconds after a move and he tries it again, a little better.
 * Posing: drag his arms, head, body or feet to teach a move. Parts stay where you leave them; "done" eases him back
 *   to rest, and the recording becomes a recipe (no model involved).
 * Smoothness: whenever the arm and leg pose would jump (a new mood, a move starting or being interrupted, posing
 *   starting), it is cross-faded from where it was over a fifth of a second, so nothing ever snaps.
 *
 * The kit calls pre() before the springs step each frame, post() at the very end of animate(), begin() when a queued
 * "@perf" step comes up and patted() after a pat. */
import * as THREE from "three";
import { Water } from "./water.js";
import { buildProp, disposeProp, shown } from "./props.js";
import { validateProp, validateMove, sampleMove, simplifyTrack, themeRecipe, rotateRecipe, eatStyle, ARCHETYPES, CHANNELS, MOVE_LIMITS } from "../../shared/craft.js";
import { rimify } from "./zeroday.js";
import { Rider } from "./rides.js";
import { Stance } from "./stance.js";
import { Activities } from "./activities.js";
import { Eating } from "./eating.js";
import { Movers } from "./moving.js";

const TAU = Math.PI * 2;
const emit = (name, detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent(name, { detail })); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };

class Spring {   // same feel as the kit's springs
  constructor(v, k = 150, zeta = 0.78) { this.x = v; this.t = v; this.v = 0; this.k = k; this.c = 2 * Math.sqrt(k) * zeta; }
  step(dt) { const a = this.k * (this.t - this.x) - this.c * this.v; this.v += a * dt; this.x += this.v * dt; }
}

// the arm channels → the kit's shoulder angles (rest is raise 0, spread 0: rx -0.62, rz ±0.22)
// the box a recipe's parts fill (its biggest side), for shrinking one to fit a hoof
const propBoundsOf = (parts) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const q of parts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q.at[k] - q.size[k] / 2); hi[k] = Math.max(hi[k], q.at[k] + q.size[k] / 2); } return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]; };
export const armRx = (raise) => (raise >= 0 ? -0.62 - 2.0 * raise : -0.62 - 0.9 * raise);
export const armRz = (s, spread) => s * (spread >= 0 ? 0.22 + 2.6 * spread : 0.22 + 1.2 * spread);
// how the hoof on the screen's right holds each kind of prop: an arm pose, and how the prop leans relative to the body
const HOLDS = {
  upright: { raise: 0.4, spread: 0.12, lean: [-0.1, 0, -0.14] },   // in front of him, leaning out a touch
  canopy: { raise: 0.62, spread: -0.05, lean: [-0.16, 0, 0.12] },  // up and over his head, nearly level
  aim: { raise: 0.46, spread: 0.22 },                              // barrel out to the side, a little up and toward you
  along: { raise: 0.5, spread: 0.08 },                             // pointing where the arm points
  throw: { raise: 0.3, spread: 0.14, lean: [0, 0, 0] },            // a ball resting on his hoof, ready to throw
  guard: { raise: 0.6, spread: -0.28, lean: [0.05, -0.5, 0] },     // a shield held up in front, turned to face Cocoa (on his left)
};
const AIM_DIR = new THREE.Vector3(0.8, 0.34, 0.5).normalize();
const AIM_Q = (() => {
  const x = AIM_DIR.clone(), y = new THREE.Vector3(0, 1, 0).addScaledVector(x, -x.y).normalize(), z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
})();
const SHELL_COLOR = { confetti: 0xffd25e, bubbles: 0xd8f1ff, petals: 0xff8fb8, stars: 0xffd25e, hearts: 0xff6f91, snow: 0xffffff, glitter: 0xf3f6ff, coins: 0xf2c14e, starbursts: 0xff5f6d };
// A big launcher (too big for one hoof: the confetti rocket launcher) is carried in front of his chest, both hooves
// under it, and he stands up to hold it. Where its middle sits (body frame), how it's turned (the barrel toward you a
// little and up a touch, its top tipped toward you so you see its stickers), his two arms under it, how far he leans
// back against the weight. How far he can swing the barrel to aim (it's heavy: not far).
export const HEAVY = { at: [0.34, 0.8, 0.86], yaw: 0.28, pitch: 0.1, roll: 0.25, right: { raise: 0.3, spread: 0.02 }, left: { raise: 0.15, spread: -0.04 }, lean: -0.1,
  yawRange: [-0.35, 0.95], pitchRange: [-0.3, 1.15], turn: 3.3 };   // turn: how far his whole body may turn to bring it round (all the way if need be)
const ALONG_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI));
const UP = new THREE.Vector3(0, 1, 0);
function mergeFins(a, b) {   // two crossed fin plates as one geometry (no extra import for two boxes)
  const pa = a.attributes.position.array, pb = b.attributes.position.array, na = a.attributes.normal.array, nb = b.attributes.normal.array;
  const g = new THREE.BufferGeometry(), off = pa.length / 3;
  g.setAttribute("position", new THREE.Float32BufferAttribute([...pa, ...pb], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([...na, ...nb], 3));
  g.setIndex([...a.index.array, ...Array.from(b.index.array, (x) => x + off)]);
  a.dispose(); b.dispose();
  return g;
}
const FACE_CH = { "face.smile": ["smile", 0.75], "face.blush": ["blush", 0.8], "face.mouth": ["mouthOpen", 0.9], "face.ears": ["ear", 1.0] };
const POSE_CH = ["leftArm.raise", "leftArm.spread", "rightArm.raise", "rightArm.spread", "head.nod", "head.turn", "head.tilt", "body.hop", "body.lean", "body.spin", "leftLeg.kick", "rightLeg.kick", "prop.spin", "prop.tilt"];
// Zero Day ammo: glowing, unlit, in the phosphor palette (green, cyan, amber, magenta)
const ZD_AMMO = {
  water: { geo: "cube", size: [0.028, 0.022], colors: [0x39ff7a, 0x2fd8ff, 0xb8ffd2] },
  bubbles: { geo: "orb", size: [0.05, 0.06], colors: [0x2fd8ff, 0x39ff7a], wire: true, opacity: 0.8 },
  petals: { geo: "confetti", size: [1, 0], colors: [0xff2bd6, 0x39ff7a, 0xd6ffe4] },
  stars: { geo: "star", size: [0.4, 0.25], colors: [0x39ff7a, 0xffcf5c] },
  hearts: { geo: "heart", size: [0.45, 0.25], colors: [0xff2bd6, 0xff6ad8] },
  snow: { geo: "cube", size: [0.02, 0.016], colors: [0xd6ffe4, 0x39ff7a] },
  glitter: { geo: "gem", size: [0.8, 0.7], colors: [0x39ff7a, 0x2fd8ff, 0xffcf5c, 0xff2bd6] },
  coins: { geo: "coin", size: [0.9, 0.3], colors: [0x39ff7a, 0xffcf5c] },
  confetti: { geo: "confetti", size: [1, 0], colors: [0x39ff7a, 0x2fd8ff, 0xd6ffe4, 0x1fbf5b, 0xff2bd6] },
};
const AMMO_LOOK = {   // gravity (+ falls, - floats), drag, speed, life (ms), size
  confetti: { g: 1.5, drag: 1.6, speed: 3.0, life: 1900, size: 1 },
  bubbles: { g: -0.35, drag: 1.9, speed: 2.1, life: 2300, size: 1 },
  water: { g: 5.2, drag: 0.35, speed: 3.4, life: 1200, size: 1 },
  petals: { g: 0.9, drag: 2.3, speed: 2.6, life: 2300, size: 1 },
  stars: { g: 1.3, drag: 1.4, speed: 2.8, life: 1700, size: 1 },
  hearts: { g: -0.25, drag: 1.6, speed: 2.4, life: 2000, size: 1 },
  snow: { g: 0.8, drag: 2.6, speed: 2.4, life: 2300, size: 1 },
  glitter: { g: 1.4, drag: 1.3, speed: 3.0, life: 1600, size: 1 },
  coins: { g: 4.2, drag: 0.4, speed: 3.0, life: 1500, size: 1 },
  starbursts: { g: 0.9, drag: 1.5, speed: 3.4, life: 1700, size: 1 },   // a little rocket that pops into stars and confetti
  spark: { g: 0.5, drag: 3.2, speed: 0.6, life: 480, size: 1 },          // the rocket's trail
};

export class Stagecraft {
  constructor(m) {
    this.m = m;
    this.reduce = m.reduce;
    // mounts: the grip just in front of the right hoof, the top of the head, the ground at his side
    this.hand = new THREE.Group(); this.hand.position.set(0, -0.27, 0.035); m.arms[1].add(this.hand);
    this.handSpin = new THREE.Group(); this.handSpin.rotation.order = "ZYX"; this.hand.add(this.handSpin);   // spin about its own stick, then tilt
    this.headMount = new THREE.Group(); this.headMount.position.set(0, 0.44, 0.0); this.headMount.scale.setScalar(1 / 1.17); m.head.add(this.headMount);
    this.bodyMount = new THREE.Group(); this.bodyMount.position.set(0, 0.56, 0); m.body.add(this.bodyMount);
    this.beside = new THREE.Group(); (m.actor || m.scene).add(this.beside);
    this.besideShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: m.ground.material.map, transparent: true, depthWrite: false, opacity: 0.85 }));
    this.besideShadow.rotation.x = -Math.PI / 2; this.besideShadow.position.y = 0.005; this.beside.add(this.besideShadow);
    this.prop = null; this.leaving = [];
    this.worn = { head: null, body: null };   // worn as well as what's in his hoof, under him or beside him (a helmet on the skateboard)
    this.perf = null; this.vals = null; this.lastPerf = null;
    this.holdW = new Spring(0, 90, 0.9);
    this.wearW = new Spring(0, 90, 0.9);   // a vest on: his front legs come out in front of it
    this.armZ = m.arms.map((a) => a.position.z); this.armX = m.arms.map((a) => a.position.x);
    this.lagZ = new Spring(0, 70, 0.42); this.lagX = new Spring(0, 70, 0.42);
    this.handPrev = null; this.handVel = new THREE.Vector3();
    this.fade = null; this.prevPose = null; this.lastMood = m.mood;
    this.ammo = []; this.geo = null; this.water = new Water(this);   // how water lands (water.js)
    this.posing = null; this.handles = null;
    this.tmpV = new THREE.Vector3(); this.tmpV2 = new THREE.Vector3(); this.tmpV3 = new THREE.Vector3(); this.tmpV4 = new THREE.Vector3(); this.tmpQ = new THREE.Quaternion(); this.tmpE = new THREE.Euler();
    // pointing: a tap on the stage aims a held launcher there; a tap on the prop uses it
    this.aim = null; this.aimQ = AIM_Q.clone();
    this.aimRaise = new Spring(HOLDS.aim.raise, 90, 0.9); this.aimSpread = new Spring(HOLDS.aim.spread, 90, 0.9); this.aimTurn = new Spring(0, 70, 0.9);
    this.shells = []; this.marks = []; this.useAnim = null;
    this.flights = []; this.toss = null;   // throwables: balls in the air, and his throw (wind up, swing, let go)
    this.rider = new Rider(this);          // a bike, a trike or a skateboard under him
    this.stance = new Stance(this);        // sitting, standing up, going for a walk
    this.acts = new Activities(this);      // painting, juggling, party tricks (Nov 3)
    this.eating = new Eating(this);        // a bite, a sip, a spoonful (Nov 4)
    // a big launcher rests on both hooves in front of his chest, on its own mount
    this.heavyMount = new THREE.Group(); m.body.add(this.heavyMount);
    this.heavyE = new THREE.Euler(0, 0, 0, "YZX"); this.heavyYaw = new Spring(HEAVY.yaw, 26, 0.9); this.heavyPitch = new Spring(HEAVY.pitch, 26, 0.9);
    this.heavyKick = new Spring(0, 55, 0.32); this.heave = null; this.heaveAt = 0; this.kickAt = -1e9;
    this.heavyTurn = new Spring(0, 22, 0.9);   // his body turning toward a target (a shuffle round, it's heavy)
    this.uses = new Map();                 // taught ways to use a prop: its name → the move he plays when he uses it
    this.study = null; this.studyW = new Spring(0, 60, 0.9);   // looking at what he holds (the globe, before answering)
    this.pushBase = this.hand.position.clone();          // the grip stays in his hoof, always
    this.clear = { spread: 0, raise: 0, leanX: 0, leanZ: 0, calm: 0 };   // how he holds it away so it never goes through him
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
  }

  /* ================================================================= props */
  hold(input, { ms = 9000, quiet = false, instant = false } = {}) {
    const v = validateProp(input);
    if (!v.recipe) return { ok: false, errors: v.errors, warnings: v.warnings };
    const r = v.recipe, A = ARCHETYPES[r.archetype], now = performance.now();
    // one thing per place: a hat (or a vest) stays on while he holds, rides or sets down something else
    const S = A.slot, wearable = S === "head" || S === "body", cur = this.prop && !this.prop.leaving ? this.prop : null;
    if (wearable && this.worn[S]) this.takeOff(S, true);
    let asWorn = false;
    if (cur && cur.slot === S) this.letGo(true);
    else if (cur && wearable && cur.slot !== "head" && cur.slot !== "body") asWorn = true;   // keep the skateboard, put the helmet on too
    else if (cur && (cur.slot === "head" || cur.slot === "body")) { this.worn[cur.slot] = cur; cur.worn = true; this.prop = null; }   // the helmet stays on
    else this.letGo(true);
    const group = this.build(r);
    const box = new THREE.Box3().setFromObject(group);
    const P = { group, recipe: r, base: r, slot: A.slot, hold: r.archetype === "handheld_canopy" ? "canopy" : r.hold || A.hold || "upright", until: now + ms, born: now,
      scale: new Spring(instant ? 1 : 0.001, 170, 0.5), open: new Spring(1, 110, 0.62), fit: 1, box, kick: 0, flash: 0 };
    P.scale.t = 1;
    P.movers = new Movers(group, { ride: A.slot === "ride", seed: now % 6.28 });   // its moving parts (Nov 7): spinners, flags, flames, a lid
    if (P.slot === "hand") {
      if (P.hold === "canopy") P.fit = clamp(1.95 / Math.max(0.3, box.max.y), 0.8, 1.5);   // high and big enough to keep the rain off his head
      if (r.heavy && P.hold === "aim") {   // too big for one hoof: on both, in front of him, and he stands up for it
        P.heavy = true; P.mid = box.getCenter(new THREE.Vector3());
        this.heavyMount.add(group); this.stance.need("heavy", true);
        this.heave = null; this.heaveAt = now + 2600; this.heavyKick.x = this.heavyKick.v = 0;
      } else this.handSpin.add(group);
    } else if (P.slot === "head") this.headMount.add(group);
    else if (P.slot === "body") this.bodyMount.add(group);
    else if (P.slot === "ride") this.rider.setup(P);
    if (asWorn) {
      P.worn = true; this.worn[S] = P; this.keep(ms);
      if (!quiet) { for (let i = 0; i < 3; i++) this.m.spawn("star", 1100); }
      emit("mochi:prop", { holding: this.holding() });
      return { ok: true, slot: P.slot, name: r.name, worn: true, warnings: v.warnings };
    }
    if (P.slot === "beside") {
      this.beside.add(group);
      const w = box.max.x - box.min.x, d = box.max.z - box.min.z;
      P.besideX = -(0.62 + w / 2 + 0.06);
      this.besideShadow.scale.set(Math.max(0.4, w * 1.5), Math.max(0.4, d * 1.5), 1);
    }
    this.prop = P; this.aim = null; this.useAnim = null; this.studySpin = 0; this.toss = null;
    Object.assign(this.clear, { spread: 0, raise: 0, leanX: 0, leanZ: 0, calm: 0 }); this.hand.position.copy(this.pushBase);
    if (!quiet) { for (let i = 0; i < 3; i++) this.m.spawn("star", 1100); }
    if (this.m.zd && this.m.zd.materialize && !instant) this.m.zd.materialize(group);   // Zero Day: it downloads in (not when you're only turning it)
    emit("mochi:prop", { holding: this.holding() });
    return { ok: true, slot: P.slot, name: r.name, warnings: v.warnings };
  }
  build(r) {   // the prop as he shows it: in Zero Day mode, re-skinned in neon; every material can take the neon edge glow
    const zd = this.m.zd && this.m.zd.on, g = buildProp(zd ? themeRecipe(r, "zeroday") : r);
    g.traverse((o) => {
      if (!o.material) return;
      rimify(o.material);
      // Zero Day's lights are dim: each part also glows faintly in its own colour, so nothing he holds goes black
      // against the night (Nov 7). Parts that already glow keep their glow.
      const M = o.material;
      if (zd && M.emissive && !(M.emissiveIntensity > 0 && M.emissive.getHex())) {
        if (M.map) { M.emissive.setScalar(0.16); M.emissiveMap = M.map; } else M.emissive.copy(M.color).multiplyScalar(0.2);
        M.emissiveIntensity = 1;
      }
    });
    return g;
  }
  retheme() {   // the mode changed while he holds something: swap its look in place
    for (const P of [this.prop, this.worn.head, this.worn.body]) {
      if (!P) continue;
      const parent = P.group.parent, g = this.build(P.base);
      g.scale.copy(P.group.scale); g.rotation.copy(P.group.rotation); g.userData.muzzle = P.group.userData.muzzle;
      disposeProp(P.group); if (parent) parent.add(g);
      P.group = g;
      if (P.slot === "ride" && P === this.prop) {   // same ride, new look: keep going where he was going
        const R = this.rider, keep = { trip: R.trip, pos: R.pos && { ...R.pos }, dist: R.dist, v: R.v, tx: R.turn.x, tt: R.turn.t };
        R.setup(P);
        if (keep.trip) Object.assign(R, { trip: keep.trip, pos: keep.pos, dist: keep.dist, v: keep.v });
        R.turn.x = keep.tx; R.turn.t = keep.tt;
      }
    }
  }
  takeOff(slot, now) {   // a worn thing comes off (shrinks away, or at once to make room)
    const W = this.worn[slot];
    if (!W) return;
    this.worn[slot] = null;
    if (now) { disposeProp(W.group); return; }
    W.scale.t = 0; this.leaving.push(W);
    emit("mochi:prop", { holding: this.holding() });
  }
  inUse() { return [this.prop, this.worn.head, this.worn.body].filter((P) => P && !P.leaving).map((P) => P.recipe.name); }
  letGo(now) {   // put the prop away: it shrinks away (or vanishes at once, to make room for the next one)
    const P = this.prop;
    if (!P) return;
    this.prop = null; this.aim = null; this.useAnim = null; this.toss = null;
    if (P.slot === "ride") this.rider.off();
    if (P.heavy) this.stance.need("heavy", false);
    emit("mochi:prop", { holding: null });
    if (now) { disposeProp(P.group); return; }
    P.scale.t = 0; this.leaving.push(P);
  }
  holding() {
    const wearing = ["head", "body"].map((k) => this.worn[k]).filter((W) => W && !W.leaving).map((W) => W.recipe.name);
    if (this.prop && !this.prop.leaving) return { name: this.prop.recipe.name, slot: this.prop.slot, archetype: this.prop.recipe.archetype, launcher: this.isLauncher(), throwable: this.isThrowable(), aims: this.canAim(), ride: this.prop.slot === "ride", heavy: !!this.prop.heavy, wearing };
    const W = this.worn.head || this.worn.body;   // only something worn left on
    return W && !W.leaving ? { name: W.recipe.name, slot: W.slot, archetype: W.recipe.archetype, launcher: false, throwable: false, aims: false, ride: false, wearing: wearing.filter((n) => n !== W.recipe.name) } : null;
  }
  /** what he has out for you to move or turn: the thing in his hoof (or beside him, or ridden), else what he wears */
  heldInfo(which = null) {   // which: "hand" | "worn" | null (the hand's, else what he wears)
    const hand = this.prop && !this.prop.leaving ? this.prop : null, worn = ["head", "body"].map((k) => this.worn[k]).find((W) => W && !W.leaving) || null;
    const P = which === "worn" ? worn : which === "hand" ? hand : hand || worn;
    if (!P) return null;
    return { name: P.recipe.name, recipe: P.base, slot: P.slot, worn: P !== this.prop, ride: P.slot === "ride", launcher: !!(P.group.userData.muzzle && P.hold === "aim"), heavy: !!P.heavy };
  }
  /** turn what he holds (or wears) by hand: the recipe itself turns, so it stays that way (the page saves it) */
  adjustHeld(axis, deg, which = null) {
    const H = this.heldInfo(which);
    if (!H || H.ride || H.heavy || (H.launcher && axis !== "x") || (H.worn && axis !== "y")) return null;
    const r = rotateRecipe(H.recipe, axis, deg);
    if (!r.ok) return null;
    const out = this.hold(r.recipe, { ms: 30000, quiet: true, instant: true });
    return out && out.ok ? r.recipe : null;
  }
  /** put down what he holds or wears (it comes off at once: you're picking it up) */
  releaseHeld(H = this.heldInfo()) { if (!H) return null; if (H.worn) this.takeOff(H.slot, true); else this.letGo(true); return H; }
  /** the screen point just above what he holds (for the page's little panel) */
  heldScreen(which = null) {
    const hand = this.prop && !this.prop.leaving ? this.prop : null, worn = ["head", "body"].map((k) => this.worn[k]).find((W) => W && !W.leaving) || null;
    const P = which === "worn" ? worn : which === "hand" ? hand : hand || worn;
    if (!P) return null;
    const box = new THREE.Box3().setFromObject(P.group), top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    return this.screen(top);
  }
  isLauncher() { const P = this.prop; return !!(P && P.slot === "hand" && P.hold === "aim" && P.group.userData.muzzle); }
  isThrowable() { const P = this.prop; return !!(P && !P.leaving && P.slot === "hand" && P.hold === "throw"); }
  canAim() { return this.isLauncher() || this.isThrowable(); }
  keep(ms) { for (const P of [this.prop, this.worn.head, this.worn.body]) if (P) P.until = Math.max(P.until, performance.now() + ms); }   // still in use: don't put it away yet

  /* ================================================================= pointing and using */
  // the screen point (client px) as a ray from the camera
  rayAt(x, y) {
    const r = this.m.canvas.getBoundingClientRect();
    this.ndc.set(clamp(((x - r.left) / r.width) * 2 - 1, -0.97, 0.97), clamp(-((y - r.top) / r.height) * 2 + 1, -0.97, 0.97));
    this.ray.setFromCamera(this.ndc, this.m.camera);
    return this.ray.ray;
  }
  propHit(x, y) {   // does a tap at (x, y) land on what he's holding, wearing or has beside him?
    const P = this.prop;
    this.rayAt(x, y); this.ray.params.Line = { threshold: 0.05 };
    for (const W of [this.worn.head, this.worn.body]) if (W && !W.leaving && this.ray.intersectObject(W.group, true).some((h) => shown(h.object))) { W.wig = performance.now(); return "worn"; }
    if (!P || P.leaving) return false;
    return this.ray.intersectObject(P.group, true).some((h) => shown(h.object));
  }
  pointAt(x, y) {   // a tap on the stage: use the prop if it's under the finger, else aim a launcher there (or throw)
    if (this.posing || this.m.inBed) return null;
    const hit = this.propHit(x, y);
    if (hit === "worn") return "prop";   // a tap on his helmet: it wiggles
    if (hit) { this.useProp(); return "prop"; }
    if (!this.canAim()) return null;
    const S = this.m.scuffle;
    if (S && S.cocoaHit(this.rayAt(x, y))) {   // a tap on Cocoa: throw at him (he learns), or squirt him
      if (this.isThrowable()) { S.fight([{ from: "mochi", at: "cocoa" }], { ball: this.prop.base }); return "aim"; }
      const kind = this.prop.recipe.ammo || "water";
      this.aimAt(S.target("cocoa"), { mark: false, onLand: () => S.squirted("cocoa", kind) });
      return "aim";
    }
    if (S && S.mimiHit && S.mimiHit()) {   // a tap on Mimi: a gentle squirt (or a soft throw) her way
      const kind = this.prop.recipe.ammo || "water", at = S.mimiTarget();
      if (this.isThrowable()) { this.throwAt(at, { onLand: () => S.squirted("mimi", "other") }); return "aim"; }
      this.aimAt(at, { mark: false, onLand: () => S.squirted("mimi", kind) });
      return "aim";
    }
    if (this.isThrowable()) {   // the upright plane just in front of the hoof
      const ray = this.rayAt(x, y), from = this.hand.getWorldPosition(new THREE.Vector3()), z = from.z + 0.15, k = (z - ray.origin.z) / ray.direction.z;
      if (!(k > 0)) return null;
      const target = ray.origin.clone().addScaledVector(ray.direction, k);
      this.mark(target, 0.75); this.throwAt(target);
      return "aim";
    }
    const ray = this.rayAt(x, y), P = this.prop;
    P.group.updateWorldMatrix(true, false);
    const muzzle = P.group.localToWorld(P.group.userData.muzzle.clone());
    const z = muzzle.z + 0.15, k = (z - ray.origin.z) / ray.direction.z;   // the upright plane just in front of the barrel
    if (!(k > 0)) return null;
    this.aimAt(ray.origin.clone().addScaledVector(ray.direction, k));
    return "aim";
  }
  aimAtFriend(who) {
    const S = this.m.scuffle, m = this.m;
    if (!S || !this.canAim()) return false;
    const here = who === "cocoa" ? m.bud && !m.bud.leaving && m.cocoa.visible : m.gf && !m.gf.leaving && m.mimi.visible;
    if (!here) return false;
    if (m.friendArrived && !m.friendArrived(who)) { this.aimWait = { who, until: performance.now() + 7000 }; return true; }   // still on the way: once they're here
    if (who === "cocoa" && this.isThrowable()) { S.fight([{ from: "mochi", at: "cocoa" }], { ball: this.prop.base }); return true; }
    const at = who === "cocoa" ? S.target("cocoa") : S.mimiTarget(), kind = this.prop.recipe.ammo || "water";
    if (this.isThrowable()) return this.throwAt(at, { onLand: () => S.squirted(who, "other") }) !== false;
    return this.aimAt(at, { mark: false, onLand: () => S.squirted(who, kind), hit: { on: this.water.headOf(who) } });
  }
  aimAt(target, { viewer = false, mark = true, onLand = null, hit = null } = {}) {   // hit: what it'll land on ({ on: { group, radius } } or { normal }), for the water
    if (this.isThrowable()) { if (mark && !viewer) this.mark(target, 0.75); return this.throwAt(target, { viewer, onLand }); }
    if (!this.isLauncher()) return false;
    this.aim = { target: target.clone(), t0: performance.now(), fired: false, viewer, onLand, hit };
    this.keep(20000);
    if (mark && !viewer) this.mark(target, 0.75);
    this.m.touch();
    return true;
  }
  // he takes a prop out and looks at it for a moment, as if checking something (a globe for "which countries border
  // India?"); a globe or a coin turns in his hoof while he looks
  studyProp(input, { ms = 1800, keep = 14000 } = {}) {
    const cur = this.prop, name = input && (input.name || (input.recipe && input.recipe.name));
    if (!cur || cur.leaving || cur.recipe.name !== name) { const r = this.hold(input.recipe || input, { ms: keep, quiet: true }); if (!r.ok) return r; }
    else this.keep(keep);
    const n = String(name || "").toLowerCase();
    this.study = { until: performance.now() + ms, spin: /globe|coin|wheel|ball/.test(n) ? 1.1 : 0 };
    return { ok: true };
  }
  // fire a held launcher at whoever is watching: the shot comes out of the screen and splashes on the glass
  atViewer() {
    if (!this.canAim()) return false;
    const cam = this.m.camera.position, P = this.prop;
    P.group.updateWorldMatrix(true, false);
    const ball = this.isThrowable(), muzzle = ball ? this.hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-0.15, 0.25, 0)) : P.group.localToWorld(P.group.userData.muzzle.clone());
    // most of the way to the camera along the line of sight through the muzzle (so it lands on the glass right in
    // front of the barrel), nudged up and in a little toward the middle of the screen. A ball stops a bit sooner, or
    // it would fill the screen before it splats.
    const target = muzzle.clone().lerp(cam, ball ? 0.74 : 0.84).add(new THREE.Vector3(-0.06, 0.05, 0));
    this.aimAt(target, { viewer: true });
    return true;
  }
  cheer() {   // celebrating: up into the air, over his head
    if (!this.isLauncher()) return false;
    const P = this.prop; P.group.updateWorldMatrix(true, false);
    const muzzle = P.group.localToWorld(P.group.userData.muzzle.clone());
    return this.aimAt(muzzle.add(new THREE.Vector3(0.35, 1.5, 0.2)), { mark: false });
  }
  useProp() {   // a tap on the prop: what you taught him to do with it, or fire it, twirl it, show it off, make it hop
    const P = this.prop, m = this.m;
    if (!P || P.leaving) return false;
    this.keep(12000); m.touch();
    const taught = P.slot !== "ride" && !this.isThrowable() && this.uses.get(String(P.recipe.name).toLowerCase());
    if (taught && !this.perf) {
      this.play(taught.recipe, { skill: taught.skill ?? 0.4, prop: P.slot === "hand" ? P.base : null, id: taught.id || null, name: taught.name });
      emit("mochi:used", { name: P.recipe.name, how: "taught", move: taught.name });
      return true;
    }
    if (this.isLauncher()) { this.fire(); return true; }
    if (this.isThrowable()) { this.atViewer(); return true; }   // tap the ball: he throws it at you
    if (P.slot === "ride") { this.rider.go(); emit("mochi:used", { name: P.recipe.name, how: "ride" }); return true; }   // tap the bike: off he goes
    if (P.movers && P.movers.open(performance.now())) { this.useAnim = null; emit("mochi:used", { name: P.recipe.name, how: "open" }); return true; }   // a lid, a door, a hatch: it opens (Nov 7)
    if ((P.slot === "hand" || P.slot === "beside") && eatStyle(P.recipe.name) && !this.eating.busy()) return !!this.eat();   // tap the cookie: he eats it (Nov 4)
    const kind = P.slot === "hand" ? (P.hold === "canopy" ? "twirl" : "present") : P.slot === "beside" ? "hop" : "wiggle";
    this.useAnim = { kind, t0: performance.now(), dur: kind === "twirl" ? 900 : 700 };
    if (kind === "twirl") { P.open.t = 0.45; setTimeout(() => { if (this.prop === P) P.open.t = 1; }, 380); }
    for (let i = 0; i < 3; i++) m.spawn(kind === "hop" ? "heart" : "star", 1100);
    emit("mochi:used", { name: P.recipe.name, how: kind });
    return true;
  }
  /** he eats (or drinks) what's in his hoof (Nov 4, a little scene: Mimi brought him soup): up to his mouth, three
   * bites (it gets smaller each time) or sips, a happy munch, then it's gone */
  eat({ drink = false, how = null } = {}) {   // how: "bite" | "sip" | "scoop" (else from its name: eating.js)
    const P = this.prop, m = this.m;
    if (P && !P.leaving && P.slot === "beside" && eatStyle(P.recipe.name)) {   // a bowl beside him (the M5's noodles): picked up, a hoof-sized one, then eaten
      const r0 = P.base, big = Math.max(...propBoundsOf(r0.parts)), k = Math.min(1, 0.85 / Math.max(0.01, big));
      const handy = { ...r0, archetype: "handheld_tool", hold: "upright", parts: r0.parts.map((q) => ({ ...q, size: q.size.map((v) => v * k), at: [q.at[0] * k, q.at[1] * k + 0.05, q.at[2] * k] })) };
      if (!this.hold(handy, { ms: 15000, quiet: true }).ok) return false;
      setTimeout(() => this.eat({ drink, how }), 450);
      return { style: eatStyle(P.recipe.name), ms: 450 + 5200 };
    }
    if (!P || P.leaving || P.slot !== "hand") return false;
    this.keep(12000); m.touch();
    const r = this.eating.start(P, how || (drink ? "sip" : null));
    this.useAnim = { kind: "eat", t0: performance.now(), dur: r.ms, drink: r.style === "sip", style: r.style };
    emit("mochi:used", { name: P.recipe.name, how: r.style === "sip" ? "drink" : "eat", style: r.style });
    return r;
  }
  /** is what he's holding (or this name) something to eat or drink? */
  edible(name = null) { const n = name || (this.prop && !this.prop.leaving ? this.prop.recipe.name : ""); return !!eatStyle(n); }
  // where the barrel should point (in the frame of the body the arm hangs from), and how the arm and body follow
  aimFrame(P) {
    const a = this.m.arms[1], parentQ = a.parent.getWorldQuaternion(this.tmpQ).invert();
    const mount = P && P.heavy ? this.heavyMount : this.hand;
    mount.updateWorldMatrix(true, false);
    const from = mount.getWorldPosition(new THREE.Vector3());
    const dw = this.aim.target.clone().sub(from).normalize(), d = dw.clone().applyQuaternion(parentQ);
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize(), zz = new THREE.Vector3().crossVectors(d, up);
    return { q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, up, zz)), d, dw };
  }
  headProp() { return !!((this.prop && this.prop.slot === "head") || (this.worn.head && !this.worn.head.leaving)); }
  /** You taught him a way to use this prop: from now on, using it (a tap, or asked) plays that move with it. */
  teachUse(name, move) {
    if (!name) return false;
    if (!move || !move.recipe) { this.uses.delete(String(name).toLowerCase()); return true; }
    const v = validateMove(move.recipe);
    if (!v.recipe) return false;
    this.uses.set(String(name).toLowerCase(), { recipe: v.recipe, skill: move.skill, id: move.id, name: move.name || v.recipe.name });
    return true;
  }

  /* ================================================================= throwing */
  // A throw: he winds up (hoof up and back), swings through and lets go; the ball flies in an arc to the target (a
  // point, or a function giving one, so it follows someone who's moving) and a new one appears in his hoof.
  throwAt(target, { viewer = false, onLand = null } = {}) {
    if (!this.isThrowable() || this.toss) return false;
    this.toss = { t0: performance.now(), target, viewer, onLand, released: false, regrowAt: 0 };
    this.keep(15000); this.m.touch();
    emit("mochi:threw", { name: this.prop.recipe.name, viewer });
    return true;
  }
  tossTarget(T) { return typeof T.target === "function" ? T.target() : T.target; }
  release(T) {   // the ball leaves his hoof: a copy flies, the one in his hoof is gone until a new one pops in
    const P = this.prop;
    if (!P) return;
    P.group.updateWorldMatrix(true, true);
    const g = this.build(P.base);
    P.group.matrixWorld.decompose(g.position, g.quaternion, g.scale);
    this.flyBall(g, { kind: P.recipe.ammo || "confetti", to: () => this.tossTarget(T), viewer: T.viewer, onLand: T.onLand });
    P.scale.x = 0.001; P.scale.v = 0; P.scale.t = 0.001; T.regrowAt = performance.now() + 650;
  }
  // a thing flying through the air in an arc (spinning), from where it is now to to() (a point or a function), then
  // bursting into its ammo there (or on the glass, thrown at the viewer). Anyone can throw: Cocoa uses it too.
  flyBall(g, { kind = "confetti", to, viewer = false, onLand = null, spin = 9 } = {}) {
    const m = this.m, toFn = typeof to === "function" ? to : () => to;
    g.updateWorldMatrix(true, true);
    const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
    const pivot = new THREE.Group(); pivot.position.copy(c); m.scene.add(pivot);
    g.position.sub(c); pivot.add(g);
    const dist = c.distanceTo(toFn()), r = m.r;
    const F = { pivot, g, from: c.clone(), toFn, kind, viewer, onLand, t: 0, dur: viewer ? 0.46 : clamp(dist / 3.4, 0.4, 0.85), arc: viewer ? 0.14 : 0.18 + 0.12 * dist,
      axis: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), spin: spin * (this.reduce ? 0.3 : 1) };
    this.flights.push(F);
    return F;
  }
  stepFlights(dt) {
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const F = this.flights[i];
      F.t += dt / F.dur;
      const u = Math.min(1, F.t), to = F.toFn();
      F.pivot.position.lerpVectors(F.from, to, u); F.pivot.position.y += F.arc * 4 * u * (1 - u);
      F.pivot.quaternion.premultiply(this.tmpQ.setFromAxisAngle(F.axis, F.spin * dt));
      if (F.t < 1) continue;
      this.m.scene.remove(F.pivot); disposeProp(F.g); this.flights.splice(i, 1);
      if (F.viewer) { this.splat(F.kind, to); this.burst(F.kind, to, new THREE.Vector3(0, 0.4, 1).normalize(), 8, { spread: 1.2 }); }
      else this.splash(to.clone(), F.kind);
      if (F.onLand) F.onLand(to.clone());
    }
  }

  /* ================================================================= moves */
  play(input, { skill = 0.6, prop = null, id = null, name = null, seed = null, replay = false } = {}) {
    const v = validateMove(input);
    if (!v.recipe) return { ok: false, errors: v.errors, warnings: v.warnings };
    const m = this.m, job = { recipe: v.recipe, skill: clamp(+skill || 0, 0, 1), id, name: name || v.recipe.name, seed: seed || String(id || v.recipe.name), propRecipe: prop ? prop.recipe || prop : null, replay };
    if (this.posing) this.poseCancel();
    m.touch();
    if (m.cur || m.queue.length) m.queue.push(["@perf", job]); else m.run([["@perf", job]]);
    return { ok: true, warnings: v.warnings, duration: v.recipe.duration };
  }
  begin(job) {   // the "@perf" step: off he goes
    const m = this.m, now = performance.now(), d = job.recipe.duration;
    if (job.propRecipe) {
      const same = this.prop && this.prop.recipe.name === (job.propRecipe.name || "") && this.prop.slot === "hand";
      if (same) this.prop.until = Math.max(this.prop.until, now + d * 1000 + 2500);
      else this.hold(job.propRecipe, { ms: d * 1000 + 2500, quiet: true });
    } else if (this.prop && this.prop.slot === "hand") this.prop.until = Math.max(this.prop.until, now + d * 1000 + 1500);
    let lead = job.propRecipe && !(this.prop && now - this.prop.born > 300) ? 260 : 0;   // let a new prop pop in first
    // a move taught standing: he gets up for it, and sits back down after if he was sitting
    let stoodUp = false;
    if (job.recipe.stand && this.stance && !this.stance.standing() && this.stance.stand()) { stoodUp = this.stance.askedAt || true; lead = Math.max(lead, 450); }
    this.perf = { ...job, t0: now + lead, fired: new Set(), stop: null, stoodUp };
    this.vals = null;
    m.play("performing", lead + d * 1000 + 250);
  }
  stop() { if (this.perf && !this.perf.stop) this.perf.stop = { at: performance.now(), vals: { ...(this.vals || {}) } }; }
  endPerf(done) {
    const P = this.perf, now = performance.now();
    this.perf = null; this.vals = null;
    // he stood up for it: he sits back down, unless someone asked him to stand meanwhile (or another move began)
    if (P && P.stoodUp && this.stance) setTimeout(() => { if (!this.perf && !this.posing && this.stance.askedAt === P.stoodUp) this.stance.sit({ quiet: true }); }, 600);
    if (this.prop) this.prop.open.t = 1;
    this.m.setFace(this.m.mood);
    if (done && P) {
      this.lastPerf = { ...P, at: now };
      emit("mochi:performed", { id: P.id, name: P.name, skill: P.skill });
    }
  }
  /* practice: a pat soon after a move → a little better, and he shows you */
  patted() {
    const L = this.lastPerf, now = performance.now();
    if (!L || !L.at || now - L.at > 8000) return;
    L.at = 0;
    const skill = Math.min(1, L.skill + 0.15);
    emit("mochi:practised", { id: L.id, name: L.name, skill });
    this.m.say(skill >= 0.95 ? "I've got it now!" : ["Ooh, again? Watch!", "Better this time!", "Okay, like this?"][Math.floor(this.m.r() * 3)]);
    const job = { recipe: L.recipe, skill, id: L.id, name: L.name, seed: L.seed, propRecipe: L.propRecipe, replay: true };
    this.m.queue.push(["@perf", job]);
  }

  /* ================================================================= every frame, before the springs step */
  pre(now, dt) {
    if (this.eating.busy()) this.eating.face(now);   // munching, sipping, open for the spoon (eating.js)
    if (this.study && this.studyW.x > 0.05 && this.m.P.lookX) {   // eyes on what he's studying (set before the face springs step)
      const sw = clamp(this.studyW.x, 0, 1);
      this.m.P.lookX.t = lerp(this.m.P.lookX.t, 0.7, sw); this.m.P.lookY.t = lerp(this.m.P.lookY.t, -0.55, sw);
    }
    const m = this.m, P = this.perf;
    this.vals = null;
    if (this.posing) this.stepPose(now, dt);
    else if (P && !P.stop) {
      if (m.cur !== "performing") { if ((now - P.t0) / 1000 >= P.recipe.duration - 0.3) this.endPerf(true); else this.stop(); }   // (a slow frame rate can end the mood first: still counts)
      else {
        const t = (now - P.t0) / 1000;
        if (t >= P.recipe.duration) this.endPerf(true);
        else {
          this.vals = sampleMove(P.recipe, Math.max(0, t), { skill: P.skill, seed: P.seed });
          for (const ev of P.recipe.events || []) if (t >= ev[0] && !P.fired.has(ev)) { P.fired.add(ev); this.event(ev[1]); }
        }
      }
    }
    if (this.perf && this.perf.stop) {   // interrupted (a new message, a tap): let go smoothly within a fifth of a second
      const u = (now - this.perf.stop.at) / 220;
      if (u >= 1) this.endPerf(false);
      else {
        const w = 1 - ease(u), v = {};
        for (const [k, x] of Object.entries(this.perf.stop.vals)) v[k] = k === "body.spin" || k === "prop.spin" ? lerp(Math.round(x), x, w) : x * w;
        this.vals = v;
      }
    }
    const vals = this.posing ? this.posing.vals : this.vals;
    if (vals) {   // the face channels ride on the current face
      for (const [ch, [k, gain]] of Object.entries(FACE_CH)) if (vals[ch] !== undefined) m.P[k].t = m.faceBase(k) + vals[ch] * gain;
      if (vals["face.eyes"] !== undefined) m.P.eyeHappy.t = Math.max(m.faceBase("eyeHappy"), vals["face.eyes"]);
    }
  }

  /* ================================================================= every frame, after the body has been posed */
  post(now, t, dt) {
    const m = this.m, vals = this.posing ? this.posing.vals : this.vals, g = (k) => (vals && vals[k] !== undefined ? vals[k] : 0);
    const big = this.reduce ? 0.35 : 1;
    if (vals) {
      const hop = g("body.hop") * 0.45 * big;
      m.root.position.y += hop * m.root.scale.y;
      if (hop > 0) { m.ground.scale.multiplyScalar(1 - Math.min(0.35, hop * 1.1)); m.ground.material.opacity *= 1 - Math.min(0.6, hop * 2); }
      m.root.rotation.z += -0.35 * g("body.sway");
      m.body.rotation.x += 0.35 * g("body.lean");
      if (!this.reduce) m.root.rotation.y += TAU * g("body.spin");
      m.neck.rotation.x += 0.5 * g("head.nod");
      m.neck.rotation.z += -0.4 * g("head.tilt");
      m.neck.rotation.y += 0.7 * g("head.turn");
      // a kick lifts the hoof high and out to its side, so it shows from the front (sitting, his legs point at you, and
      // a kick straight up toward the camera hardly moved on screen: "I am not able to move his legs", Nov 2)
      m.legs.forEach((l, i) => { const k = g(i ? "rightLeg.kick" : "leftLeg.kick"); if (k) { l.rotation.x -= 0.6 * k; l.rotation.z += (i ? 1 : -1) * 0.95 * k; } });
    }
    if (m.zd) m.zd.stance(now, t);   // Zero Day: hooves on hips while he waits
    for (const X of [this.prop, this.worn.head, this.worn.body]) if (X && X.movers && X.movers.any) X.movers.step(now, this.reduce ? 0.3 : 1);   // moving parts
    this.rider.pose(now, dt);        // on a bike or a board: where he is, how high, which way he faces
    this.stance.pose(now, dt);       // standing up, or out for a walk
    this.acts.pose(now, dt);         // painting at his easel, juggling, a party trick
    // arms: the move's pose (and the hold pose for the hoof that has a prop), blended over whatever the mood does
    const P = this.prop, held = P && P.slot === "hand" && !P.leaving ? HOLDS[P.hold] || HOLDS.upright : null;
    const heavy = !!(held && P.heavy), heavyHold = heavy ? this.heavyPose(now, dt, P) : null;
    if (!heavy && this.heavyFace) this.unFace();
    // aiming: the hoof rises and swings toward the target, the body turns a little, the head follows
    const aimF = this.aim && this.isLauncher() ? this.aimFrame(P) : null;
    this.aimRaise.t = aimF ? clamp(0.46 + 0.8 * aimF.d.y, 0.05, 0.98) : HOLDS.aim.raise;
    this.aimSpread.t = aimF ? clamp(0.22 + 0.35 * aimF.d.x, -0.3, 0.62) : HOLDS.aim.spread;
    let tossX = 0;
    if (this.toss && !aimF) { const tt = this.tossTarget(this.toss), hp = this.hand.getWorldPosition(new THREE.Vector3()); tossX = (tt.x - hp.x) / Math.max(0.3, tt.distanceTo(hp)); }
    const guarding = P && P.hold === "guard" && !P.leaving;   // shield up: he turns to face Cocoa, so it's in front of him
    this.aimTurn.t = (aimF && !heavy ? clamp(0.42 * aimF.dw.x, -0.42, 0.42) : this.toss ? clamp(0.42 * tossX, -0.42, 0.42) : guarding ? -0.38 : 0) * (this.reduce ? 0.4 : 1);
    this.aimRaise.step(dt); this.aimSpread.step(dt); this.aimTurn.step(dt);
    if (Math.abs(this.aimTurn.x) > 1e-4) { m.root.rotation.y += this.aimTurn.x; m.neck.rotation.y += 0.5 * this.aimTurn.x; }
    if (aimF) m.neck.rotation.x -= 0.25 * clamp(aimF.dw.y, -0.6, 0.8);
    const handHold = heavy ? heavyHold.right : held && P.hold === "aim" ? { raise: this.aimRaise.x, spread: this.aimSpread.x } : held && { ...held };
    // studying it: the hoof brings it up and in, the head turns down to it, eyes on it
    if (this.study && (now > this.study.until || !held)) this.study = null;
    this.studyW.t = this.study ? 1 : 0; this.studyW.step(dt);
    const sw = clamp(this.studyW.x, 0, 1);
    if (sw > 0.001) {
      if (handHold && P.hold !== "aim") { handHold.raise = lerp(handHold.raise, 0.36, sw); handHold.spread = lerp(handHold.spread, -0.02, sw); }   // in front of his chest, where he can look down at it
      m.neck.rotation.y += 0.32 * sw; m.neck.rotation.x += 0.3 * sw; m.neck.rotation.z -= 0.1 * sw;
      if (m.P.lookX) { m.P.lookX.t = lerp(m.P.lookX.t, 0.75, sw); m.P.lookY.t = lerp(m.P.lookY.t, -0.45, sw); }
    }
    if (this.eating.busy() && handHold) this.eating.hold(now, handHold);   // up to his mouth (or the bowl low, for the spoon)
    if (this.useAnim && this.useAnim.kind === "present" && handHold) {   // "look!": the hoof lifts it up for a moment
      const u = (now - this.useAnim.t0) / this.useAnim.dur;
      handHold.raise = Math.min(0.98, handHold.raise + 0.35 * Math.sin(Math.PI * clamp(u, 0, 1)));
    }
    if (this.toss) {   // throwing: hoof up and back, swing through (let go on the way), back to the ready pose
      const T = this.toss, u = now - T.t0, b = handHold || HOLDS.throw;
      let raise, spread;
      if (u < 300) { const k = ease(u / 300); raise = lerp(b.raise, 0.98, k); spread = lerp(b.spread, 0.42, k); }
      else if (u < 480) { const k = ease((u - 300) / 180); raise = lerp(0.98, 0.12, k); spread = lerp(0.42, -0.02, k); }
      else { const k = ease((u - 480) / 380); raise = lerp(0.12, b.raise, k); spread = lerp(-0.02, b.spread, k); }
      if (handHold) { handHold.raise = raise; handHold.spread = spread; }
      if (!T.released && u >= 390) { T.released = true; T.releaseNow = true; }
      if (T.regrowAt && now > T.regrowAt) { if (this.prop) this.prop.scale.t = 1; T.regrowAt = 0; }
      if (u > 880 && T.released && !T.regrowAt) this.toss = null;
    }
    this.holdW.t = handHold && !m.inBed ? 1 : 0; this.holdW.step(dt);
    this.wearW.t = (P && P.slot === "body" && !P.leaving) || (this.worn.body && !this.worn.body.leaving) ? 1 : 0; this.wearW.step(dt);
    m.arms.forEach((a, i) => { a.position.z = this.armZ[i] + 0.2 * this.wearW.x; a.position.x = this.armX[i] * (1 + 0.1 * this.wearW.x); });
    m.arms.forEach((a, i) => {
      const s = i ? 1 : -1, nm = i ? "rightArm" : "leftArm";
      const has = vals && (vals[`${nm}.raise`] !== undefined || vals[`${nm}.spread`] !== undefined);
      const hw = i === 1 || heavy ? this.holdW.x : 0;
      if (!has && hw < 0.001) return;
      let raise = g(`${nm}.raise`), spread = g(`${nm}.spread`), w = has ? 1 : 0;
      const H = i === 1 ? handHold : heavy ? heavyHold.left : null;   // the big launcher takes both hooves
      if (H) {   // move values are relative to the hold pose, so a held prop never drops
        if (i === 1) { H.raise = Math.min(0.98, H.raise + this.clear.raise); H.spread = Math.min(0.95, H.spread + this.clear.spread); }
        raise = H.raise + raise * (raise >= 0 ? 1 - H.raise : 1 + H.raise);
        spread = clamp(H.spread + spread, -1, 1);
        w = Math.max(w, hw);
      }
      a.rotation.x = lerp(a.rotation.x, armRx(raise), w);
      a.rotation.z = lerp(a.rotation.z, armRz(s, spread), w);
    });
    if (this.eating.busy()) this.eating.left(now, armRx, armRz);   // the spoon hoof
    this.rider.limbs(now);  // hooves on the handlebar, legs pedalling
    this.stance.limbs(now); // arms swinging as he walks
    this.acts.limbs(now);   // the brush dabbing, hooves juggling, the wand waving
    this.smoothPose(now);   // no snaps, whatever changed
    this.stepProp(now, t, dt, vals);
    if (this.eating.busy()) this.eating.prop(now);   // the cup tipped, the food going down
    this.acts.brush();      // painting: the brush turned so its tip is on the canvas
    if (this.aimWait) { const W = this.aimWait; if (now > W.until) this.aimWait = null; else if (this.m.friendArrived(W.who)) { this.aimWait = null; this.aimAtFriend(W.who); } }
    if (this.toss && this.toss.releaseNow) { this.toss.releaseNow = false; this.release(this.toss); }   // the hoof is where it is this frame
    this.stepAmmo(dt); this.stepShells(dt); this.stepMarks(dt); this.stepFlights(dt); this.water.step(dt);
    if (this.posing) this.stepHandles(now);
  }

  /* the big launcher: it wobbles; every few seconds its front sags and he heaves it back up (eyes screwed shut,
     cheeks puffed, a little hop); he leans back against the weight and sweats; when it goes off it kicks him back and
     he's wide-eyed for a moment, then chuffed. Returns where his two hooves go (under it). */
  heavyPose(now, dt, P) {
    const m = this.m, calm = this.reduce ? 0.3 : 1, t = now / 1000;
    let yaw = HEAVY.yaw, pitch = HEAVY.pitch;
    let bodyTurn = 0;
    // his body's turn so far goes on first, so the target is measured from where he actually faces
    if (Math.abs(this.heavyTurn.x) > 1e-4) { m.root.rotation.y -= this.heavyTurn.x; m.neck.rotation.y -= 0.25 * this.heavyTurn.x; m.root.updateWorldMatrix(true, true); }
    if (this.aim) {   // he shuffles round to face the target (the whole body), then the barrel does the rest
      const F = this.aimFrame(P);
      if (this.aim.plan === undefined) {   // worked out once, in the world: how far round the target is from the barrel's rest direction
        const facing = m.root.rotation.y + this.heavyTurn.x;   // (root is reset each frame; our turn is what's been added so far)
        let around = Math.atan2(F.dw.z, F.dw.x) + facing - HEAVY.yaw;   // relative to where the barrel rests with no turn
        around = Math.atan2(Math.sin(around), Math.cos(around));           // -π..π
        const barrelLo = HEAVY.yawRange[0] - HEAVY.yaw + 0.1, barrelHi = HEAVY.yawRange[1] - HEAVY.yaw - 0.1;
        const bodyPart = around < barrelLo ? around - barrelLo : around > barrelHi ? around - barrelHi : 0;   // what the barrel can't swing
        this.aim.plan = { bodyTurn: clamp(bodyPart, -HEAVY.turn, HEAVY.turn) };
      }
      bodyTurn = this.aim.plan.bodyTurn;
      // the barrel finishes the job: a servo in stepHeavy measures the real barrel against the target once the mount is
      // placed this frame (close targets need the muzzle's actual position), and nudges yaw and pitch
      yaw = this.aim.servoYaw ?? HEAVY.yaw; pitch = this.aim.servoPitch ?? HEAVY.pitch;
      this.heave = null; this.heaveAt = Math.max(this.heaveAt, now + 2500);
    }
    this.heavyTurn.t = bodyTurn; this.heavyTurn.step(dt);
    this.heavyYaw.t = yaw; this.heavyPitch.t = pitch; this.heavyYaw.step(dt); this.heavyPitch.step(dt);
    // on target when the body and barrel have settled near where they're going
    this.heavyOnTarget = !this.aim || (this.aim.steady || 0) >= 4;   // pointing there, and held there for a few frames

    this.heavyKick.t = 0; this.heavyKick.step(dt);
    let sag = 0, heaving = 0;
    if (!this.heave && now > this.heaveAt && !this.aim && !this.perf && !this.posing && this.stance.standing()) this.heave = { t0: now, dur: 1700, hopped: false };
    if (this.heave) {   // down slowly (0 → 1), heaved back up past level, settling
      const u = (now - this.heave.t0) / this.heave.dur;
      if (u >= 1) { this.heave = null; this.heaveAt = now + 3800 + m.r() * 3200; }
      else if (u < 0.62) sag = ease(u / 0.62);
      else if (u < 0.76) { sag = lerp(1, -0.3, ease((u - 0.62) / 0.14)); heaving = 1; if (!this.heave.hopped) { this.heave.hopped = true; if (m.hop) m.hop(0.05, 260, 0); } }
      else { sag = lerp(-0.3, 0, ease((u - 0.76) / 0.24)); heaving = Math.max(0, 1 - (u - 0.76) / 0.12); }
    }
    sag *= calm;
    const kick = this.heavyKick.x * (this.reduce ? 0.4 : 1), wob = (Math.sin(t * 2.3) * 0.045 + Math.sin(t * 5.1 + 1) * 0.02) * calm * (this.aim ? 0.25 : 1);   // steadier while he aims
    this.hv = { sag, kick, wob };
    // him: leaning back against it, tipping toward its heavy end as it sags (a stagger that way), knocked back by the kick
    const sc = m.root.scale.x;
    m.body.rotation.x += HEAVY.lean - 0.06 * kick;
    m.root.rotation.z += -0.07 * sag + 0.02 * Math.sin(t * 2.3) * calm + 0.16 * kick;
    m.root.position.x += (0.05 * sag - 0.22 * kick) * sc;
    // his face: concentrating, a sweat drop; screwed up tight while he heaves; "whoa!" at the kick, then chuffed
    const F = m.P, base = (k) => m.faceBase(k), since = now - this.kickAt, T = (k, v) => { if (F[k]) F[k].t = v; };
    this.heavyFace = true;
    T("sweat", 1);
    if (since < 750) { T("eyeScale", 1.35); T("eyeOpen", 1.15); T("mouthOpen", 0.85); T("mouthW", 0.5); T("brow", 1); T("browY", 1.2); T("eyeClosed", 0); T("puff", 0); T("eyeHappy", 0); }
    else if (since < 2300) { T("eyeScale", base("eyeScale")); T("eyeOpen", base("eyeOpen")); T("eyeHappy", 1); T("smile", 1); T("mouthOpen", 0.45); T("mouthW", base("mouthW")); T("brow", 0.5); T("browY", 0.5); T("blush", Math.max(base("blush"), 0.9)); T("eyeClosed", 0); T("puff", 0); }
    else {
      T("eyeScale", base("eyeScale")); T("eyeOpen", base("eyeOpen")); T("eyeHappy", base("eyeHappy") * (1 - heaving)); T("mouthOpen", base("mouthOpen") * (1 - heaving));
      T("eyeClosed", Math.max(base("eyeClosed"), 0.78 * heaving)); T("puff", Math.max(base("puff"), 0.9 * heaving));
      T("brow", Math.max(base("brow"), lerp(0.5, 0.95, heaving))); T("browY", base("browY")); T("browSad", Math.min(base("browSad"), -0.25));
      T("mouthW", lerp(base("mouthW"), 0.5, heaving)); T("smile", lerp(Math.min(base("smile"), 0.35), -0.15, heaving)); T("blush", Math.max(base("blush"), 0.6 + 0.5 * heaving));
    }
    // his hooves: under it, following it up when he aims high, down a little as it sags, up with the kick
    const dp = this.heavyPitch.x - HEAVY.pitch;
    return { right: { raise: clamp(HEAVY.right.raise + 0.35 * dp - 0.12 * sag + 0.25 * kick, -0.4, 0.98), spread: HEAVY.right.spread },
      left: { raise: clamp(HEAVY.left.raise + 0.2 * dp + 0.06 * sag + 0.2 * kick, -0.4, 0.98), spread: HEAVY.left.spread } };
  }
  unFace() {   // put back the face channels the launcher was holding
    const F = this.m.P;
    for (const k of ["sweat", "eyeScale", "eyeOpen", "eyeHappy", "eyeClosed", "puff", "brow", "browY", "browSad", "mouthW", "mouthOpen", "smile", "blush"]) if (F[k]) F[k].t = this.m.faceBase(k);
    this.heavyFace = false;
  }
  stepHeavy(P, now, sc) {   // the big launcher on its mount: turned, its middle in front of his chest, wobbling, kicking
    const H = this.hv || { sag: 0, kick: 0, wob: 0 }, calm = this.reduce ? 0.3 : 1, t = now / 1000;
    const pitch = this.heavyPitch.x + H.wob - 0.3 * H.sag + 0.5 * H.kick, yaw = this.heavyYaw.x + Math.sin(t * 1.3) * 0.03 * calm;
    const roll = HEAVY.roll + Math.sin(t * 1.9 + 2) * 0.04 * calm;
    const M = this.heavyMount;
    M.quaternion.setFromEuler(this.heavyE.set(roll, -yaw, pitch));
    const mid = this.tmpV.copy(P.mid).multiplyScalar(sc).applyQuaternion(M.quaternion);
    const back = this.tmpV2.set(1, 0, 0).applyQuaternion(M.quaternion).multiplyScalar(-0.16 * H.kick);   // the kick: back along the barrel
    M.position.set(HEAVY.at[0] - mid.x + back.x, HEAVY.at[1] - mid.y + back.y - 0.04 * H.sag, HEAVY.at[2] - mid.z + back.z);
    P.group.position.set(0, 0, 0); P.group.rotation.set(0, 0, 0);
    P.group.scale.setScalar(sc);
    M.visible = this.m.arms[1].visible;
    if (this.aim) {   // the servo: the barrel as it really is now vs the target
      P.group.updateWorldMatrix(true, false);
      const muzzle = P.group.localToWorld(this.tmpV3.copy(P.group.userData.muzzle)), dirNow = this.tmpV4.set(1, 0, 0).transformDirection(P.group.matrixWorld);
      const toT = this.aim.target.clone().sub(muzzle).normalize();
      const errYaw = Math.atan2(toT.z, toT.x) - Math.atan2(dirNow.z, dirNow.x), eY = Math.atan2(Math.sin(errYaw), Math.cos(errYaw));
      const errPitch = Math.asin(clamp(toT.y, -1, 1)) - Math.asin(clamp(dirNow.y, -1, 1));
      this.aim.servoYaw = clamp((this.aim.servoYaw ?? HEAVY.yaw) + clamp(eY * Math.max(0.3, Math.cos(this.heavyPitch.x)) * 0.5, -0.12, 0.12), HEAVY.yawRange[0], HEAVY.yawRange[1]);
      this.aim.servoPitch = clamp((this.aim.servoPitch ?? HEAVY.pitch) + clamp(errPitch * 0.5, -0.12, 0.12), HEAVY.pitchRange[0], HEAVY.pitchRange[1]);
      this.aim.err = dirNow.angleTo(toT);
      this.aim.steady = this.aim.err < 0.14 && Math.abs(this.heavyTurn.x - this.heavyTurn.t) < 0.12 ? (this.aim.steady || 0) + 1 : 0;
    }
  }
  kickBack() {   // the big launcher went off: it jumps in his hooves and knocks him onto his bottom for a moment
    const now = performance.now();
    this.heavyKick.x = 1; this.heavyKick.v = 0; this.kickAt = now;
    this.heave = null; this.heaveAt = now + 4200;
    this.stance.plop(1500);
    emit("mochi:kick", {});
  }

  /* cross-fade the limbs whenever their pose would jump */
  smoothPose(now) {
    const m = this.m, cur = [m.arms[0].rotation.x, m.arms[0].rotation.z, m.arms[1].rotation.x, m.arms[1].rotation.z, m.legs[0].rotation.x, m.legs[1].rotation.x];
    const prev = this.prevPose, raw = this.prevRaw;   // what was shown last frame, and what the body wanted last frame
    let jump = this.lastMood !== m.mood;
    if (raw && !jump) for (let i = 0; i < cur.length; i++) if (Math.abs(cur[i] - raw[i]) > 0.42) { jump = true; break; }   // the wanted pose itself jumped
    this.lastMood = m.mood;
    this.prevRaw = cur.slice();
    if (jump && prev) {   // a bigger change takes a little longer, so even arms flung up come down gracefully
      let far = 0; for (let i = 0; i < cur.length; i++) far = Math.max(far, Math.abs(cur[i] - prev[i]));
      this.fade = { t0: now, from: prev.slice(), ms: clamp(140 + far * 110, 180, 420) };
    }
    if (this.fade) {
      const u = (now - this.fade.t0) / this.fade.ms;
      if (u >= 1) this.fade = null;
      else {
        const k = ease(u), f = this.fade.from;
        for (let i = 0; i < cur.length; i++) cur[i] = lerp(f[i], cur[i], k);
        m.arms[0].rotation.x = cur[0]; m.arms[0].rotation.z = cur[1]; m.arms[1].rotation.x = cur[2]; m.arms[1].rotation.z = cur[3];
        m.legs[0].rotation.x = cur[4]; m.legs[1].rotation.x = cur[5];
      }
    }
    this.prevPose = cur;
  }

  stepProp(now, t, dt, vals) {
    const m = this.m, calm = this.reduce ? 0.3 : 1;
    for (let i = this.leaving.length - 1; i >= 0; i--) {   // props shrinking away
      const L = this.leaving[i]; L.scale.step(dt);
      if (L.scale.x < 0.03) { disposeProp(L.group); this.leaving.splice(i, 1); }
      else L.group.scale.setScalar(Math.max(0.001, L.scale.x) * L.fit);
    }
    for (const k of ["head", "body"]) {   // worn as well: a helmet while he rides
      const W = this.worn[k];
      if (!W) continue;
      if (this.prop && !this.prop.leaving) W.until = Math.max(W.until, this.prop.until);
      if ((now > W.until && !this.perf && !this.posing) || m.inBed || m.sulking) { this.takeOff(k, false); continue; }
      W.scale.step(dt);
      const s = Math.max(0.001, W.scale.x) * W.fit, wig = W.wig ? Math.sin(((now - W.wig) / 700) * 18) * (1 - clamp((now - W.wig) / 700, 0, 1)) * (this.reduce ? 0.3 : 1) : 0;
      W.group.scale.setScalar(s);
      W.group.rotation.z = k === "head" ? Math.sin(t * 1.7) * 0.015 * calm + wig * 0.12 : wig * 0.06;
      (k === "head" ? this.headMount : this.bodyMount).visible = Math.max(0, m.P.bed.x) < 0.3;
    }
    const P = this.prop;
    if (!P) return;
    if ((now > P.until && !this.perf && !this.posing) || m.inBed || m.sulking) { this.letGo(false); return; }
    P.scale.step(dt); P.open.step(dt);
    P.kick *= Math.exp(-dt * 9); P.flash *= Math.exp(-dt * 7);
    const sc = Math.max(0.001, P.scale.x) * P.fit * (1 + P.flash * 0.12);
    if (P.slot === "hand" && P.heavy) {
      this.stepHeavy(P, now, sc);
      this.hand.visible = m.arms[1].visible;
      // it takes a moment to swing round (it's heavy), then it goes off
      // it goes off once it's actually pointing there (or after 2 s whatever happens), then he swings back
      if (this.aim && !this.aim.fired && now - this.aim.t0 > (this.aim.viewer ? 700 : 450) && (this.heavyOnTarget || now - this.aim.t0 > 2000)) { this.aim.fired = true; this.aim.firedAt = now; this.fireAt(this.aim.target, { viewer: this.aim.viewer, onLand: this.aim.onLand, hit: this.aim.hit }); }
      if (this.aim && this.aim.fired && now - this.aim.firedAt > 1200) this.aim = null;
    } else if (P.slot === "hand") {
      const H = HOLDS[P.hold] || HOLDS.upright, a = m.arms[1];
      // orientation relative to the body, whatever the arm does
      if (P.hold === "aim") {
        const want = this.aim ? this.aimFrame(P).q : AIM_Q;
        this.aimQ.slerp(want, 1 - Math.exp(-dt * (this.aim ? 12 : 6)));
        this.hand.quaternion.copy(a.quaternion).invert().multiply(this.aimQ);
        if (this.aim && !this.aim.fired && now - this.aim.t0 > (this.aim.viewer ? 450 : 300)) { this.aim.fired = true; this.fireAt(this.aim.target, { viewer: this.aim.viewer, onLand: this.aim.onLand, hit: this.aim.hit }); }
        if (this.aim && now - this.aim.t0 > 1700) this.aim = null;   // back to the ready pose
      }
      else if (P.hold === "along") this.hand.quaternion.copy(ALONG_Q);
      else this.hand.quaternion.copy(a.quaternion).invert().multiply(this.tmpQ.setFromEuler(this.tmpE.set(H.lean[0] + this.clear.leanX, H.lean[1], H.lean[2] - this.clear.leanZ)));
      // a little lag behind the hoof's motion, and a recoil kick when it fires
      const wp = this.hand.getWorldPosition(this.tmpV);
      if (this.handPrev && dt > 0) { this.handVel.subVectors(wp, this.handPrev).divideScalar(dt); } this.handPrev = (this.handPrev || new THREE.Vector3()).copy(wp);
      const sway = P.hold === "aim" ? 0.35 : 1;
      this.lagZ.t = clamp(this.handVel.x * 0.07, -0.32, 0.32) * sway * calm; this.lagX.t = clamp(-this.handVel.z * 0.05 + this.handVel.y * 0.03, -0.25, 0.25) * sway * calm;
      this.lagZ.step(dt); this.lagX.step(dt);
      const spin = vals && vals["prop.spin"] !== undefined ? vals["prop.spin"] : 0, tilt = vals && vals["prop.tilt"] !== undefined ? vals["prop.tilt"] : 0;
      let twirl = 0;
      if (this.useAnim && this.useAnim.kind === "twirl") twirl = ease((now - this.useAnim.t0) / this.useAnim.dur);
      if (this.study && this.study.spin) { this.studySpin = (this.studySpin || 0) + dt * this.study.spin * calm; }
      twirl += (this.studySpin || 0) / TAU;
      this.handSpin.rotation.set(this.lagX.x, TAU * (spin + twirl), this.lagZ.x - 0.6 * tilt);
      this.handSpin.position.set(-P.kick * 0.06, -P.kick * 0.02, 0);
      if (!(this.acts.cur && this.acts.cur.kind === "paint" && this.acts.cur.stroke) && !this.eating.atMouth(now)) this.keepOut(P, a, dt);   // (eating: right up to his mouth)   // (painting: the brush goes where the canvas is)
      else this.hand.position.copy(this.pushBase);
      const open = clamp(P.open.x, 0.2, 1.2);
      P.group.scale.set(sc * open, sc, sc * open);
      this.hand.visible = a.visible;
    } else if (P.slot === "ride") {
      P.group.scale.setScalar(1);
      this.rider.place(P, Math.max(0.001, P.scale.x));
    } else if (P.slot === "head") {
      P.group.scale.setScalar(sc);
      this.headMount.visible = Math.max(0, m.P.bed.x) < 0.3;
      P.group.rotation.z = Math.sin(t * 1.7) * 0.015 * calm + this.wiggle(now) * 0.12;   // settles and sits softly
    } else if (P.slot === "body") {
      P.group.scale.setScalar(sc);
      P.group.rotation.z = this.wiggle(now) * 0.06;
      this.bodyMount.visible = Math.max(0, m.P.bed.x) < 0.3;
    } else {   // beside him on the ground, breathing a little
      const dv = clamp(m.duo.x, 0, 1);
      const hop = this.useAnim && this.useAnim.kind === "hop" ? Math.sin(Math.PI * clamp((now - this.useAnim.t0) / this.useAnim.dur, 0, 1)) : 0;
      this.beside.position.set(P.besideX - 0.6 * dv, 0.32 * hop * calm, 0.22);
      P.group.rotation.y = 0.32 + Math.sin(t * 0.6) * 0.04 * calm;
      P.group.rotation.z = Math.sin(t * 1.3 + 1) * 0.02 * calm;
      P.group.scale.set(sc, sc * (1 + Math.sin(t * 2.2) * 0.012 * calm), sc);
      this.besideShadow.material.opacity = 0.85 * Math.min(1, P.scale.x);
    }
    this.beside.visible = P.slot === "beside";
    if (this.useAnim && now - this.useAnim.t0 > this.useAnim.dur + (this.useAnim.kind === "eat" ? 200 : 0)) this.useAnim = null;
  }
  // A held prop never goes through him, and never floats away from his hoof either: every part (as a sphere) is
  // checked against his head and body (ellipsoids, the same invisible shapes the kit uses for touches), and when one
  // goes in, his arm swings out (and up a little) until it's clear: hoof and prop move together. Covering part of his
  // face from in front is fine; only going through him counts. It eases back when there's room again. Canopies are
  // meant to be over his head, so they're left alone.
  // How far the held prop goes into him. Each part is sampled at its centre, its 6 face centres and its 8 corners
  // pulled a little in (so a thin disc is a disc, not a ball, and a ball isn't a box); each point is checked against
  // his head and body ellipsoids (the touch shapes). Returns the deepest point's depth, which way is out (body frame),
  // how high it is above the grip, and the smallest clearance. His head is strict; against his tummy, right next to
  // the hoof, a little contact is how you hold a thing (it presses into the wool), so only deeper than 0.12 counts.
  overlap(P) {
    const m = this.m, out = { pen: 0, dir: null, above: 0, margin: Infinity, head: 0, body: 0 };
    if (!P || !m.headHit || !m.tummy) return out;
    P.group.updateWorldMatrix(true, true);
    const bodies = [[m.headHit, 0, "head"], [m.tummy, 0.12, "body"]].map(([E, give, name]) => { E.updateWorldMatrix(true, false); return { E, give, name, c: new THREE.Vector3().setFromMatrixPosition(E.matrixWorld), inv: E.matrixWorld.clone().invert() }; });
    const toBody = m.body.getWorldQuaternion(new THREE.Quaternion()).invert(), grip = this.hand.getWorldPosition(new THREE.Vector3());
    const pts = this.samplePts || (this.samplePts = (() => {   // in a part's unit box: centre, faces, corners pulled in
      const a = [[0, 0, 0]];
      for (let k = 0; k < 3; k++) for (const sg of [-1, 1]) { const v = [0, 0, 0]; v[k] = sg; a.push(v); }
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) a.push([x * 0.7, y * 0.7, z * 0.7]);
      return a.map((v) => new THREE.Vector3(...v));
    })());
    const w = new THREE.Vector3(), l = new THREE.Vector3(), sfc = new THREE.Vector3(), bb = new THREE.Vector3(), bc = new THREE.Vector3();
    P.group.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const box = o.geometry.boundingBox; box.getCenter(bc); box.getSize(bb).multiplyScalar(0.5);
      for (const q of pts) {
        w.set(bc.x + q.x * bb.x, bc.y + q.y * bb.y, bc.z + q.z * bb.z).applyMatrix4(o.matrixWorld);
        for (const B of bodies) {
          l.copy(w).applyMatrix4(B.inv);
          const len = l.length();
          if (len < 1e-6) l.set(1, 0, 0.3);
          const R = sfc.copy(l).normalize().applyMatrix4(B.E.matrixWorld).distanceTo(B.c), d = w.distanceTo(B.c), gap = d - R + B.give;
          out.margin = Math.min(out.margin, gap); out[B.name] = Math.max(out[B.name], R - d);
          if (-gap > out.pen) { out.pen = -gap; out.dir = w.clone().sub(B.c).applyQuaternion(toBody).normalize(); out.above = w.y - grip.y; }
        }
      }
    });
    return out;
  }
  keepOut(P, arm, dt) {
    const C = this.clear;
    this.hand.position.copy(this.pushBase);
    const relax = (k) => { for (const key of ["spread", "raise", "leanX", "leanZ"]) C[key] *= k; };
    if (P.hold === "canopy" || !this.m.headHit || !this.m.tummy) { relax(0.9); return; }
    const { pen, dir, above, margin } = this.overlap(P);
    if (pen > 0.004) {
      // what he'd do: tip it out to the side and forward from his hoof (the hoof keeps its grip), then lower or swing
      // the arm out if that's not enough. Each a little per frame, so it eases out of him instead of jumping.
      const k = Math.min(0.05, pen * 0.7), along = P.hold === "upright" || P.hold === undefined;
      if (along && above > 0.05) {
        C.leanZ = Math.min(0.8, C.leanZ + k * (0.4 + Math.max(0, dir.x)));
        C.leanX = Math.min(0.55, C.leanX + k * (0.2 + Math.max(0, dir.z)));
      }
      if (!along || above <= 0.05 || C.leanZ > 0.5) C.spread = Math.min(0.55, C.spread + k * 0.6);
      if (above > 0.15 && C.leanZ > 0.4) C.raise = Math.max(-0.3, C.raise - k * 0.5);   // tall things: hold them lower
      C.calm = 0;
    } else if (margin > 0.08 && (C.calm += dt) > 0.4) relax(Math.exp(-dt * 0.8));        // room again: ease back
  }
  wiggle(now) {   // a worn thing tapped: a quick decaying wobble
    if (!this.useAnim || this.useAnim.kind !== "wiggle") return 0;
    const u = (now - this.useAnim.t0) / this.useAnim.dur;
    return Math.sin(u * 18) * (1 - clamp(u, 0, 1)) * (this.reduce ? 0.3 : 1);
  }

  event(name) {
    const m = this.m, P = this.prop;
    if (name === "pop") this.fire();
    else if (name === "open" && P) P.open.t = 1;
    else if (name === "close" && P) P.open.t = 0.3;
    else if (name === "sparkle") { for (let i = 0; i < 5; i++) m.spawn("star", 1300); }
    else if (name === "hearts") { for (let i = 0; i < 3; i++) m.spawn("heart", 1600); }
  }

  /* ================================================================= launcher ammo */
  fire() {
    const m = this.m, P = this.prop;
    if (this.isThrowable()) {   // no spot picked: a lob out in front of him, onto the floor
      const from = this.hand.getWorldPosition(new THREE.Vector3());
      return this.throwAt(new THREE.Vector3(from.x + 0.75, 0.04, from.z + 0.8));
    }
    let from, dir, kind;
    if (P && P.slot === "hand" && P.group.userData.muzzle) {
      P.group.updateWorldMatrix(true, false);
      from = P.group.localToWorld(P.group.userData.muzzle.clone());
      dir = new THREE.Vector3(1, 0, 0).transformDirection(P.group.matrixWorld);
      kind = P.recipe.ammo || "confetti";
      P.kick = 1; P.flash = 1;
      if (P.heavy) this.kickBack();
    } else {   // no launcher in the hoof: a burst of confetti from the hoof itself
      m.arms[1].updateWorldMatrix(true, false);
      from = m.arms[1].localToWorld(new THREE.Vector3(0, -0.3, 0.05));
      dir = new THREE.Vector3(0.3, 1, 0.3).normalize();
      kind = "confetti";
    }
    if (kind === "starbursts") {   // a little rocket: out along the barrel and up, popping in the air
      const to = from.clone().addScaledVector(dir, 2.1).add(new THREE.Vector3(0, 0.9, 0));
      this.rocket(from, dir, to);
      emit("mochi:fired", { kind, aimed: false });
      return;
    }
    this.burst(kind, from, dir, kind === "water" ? 22 : 16);
  }
  // aimed: a shell flies from the muzzle to the point you tapped and bursts there (water: a stream that lands there)
  fireAt(target, { viewer = false, onLand = null, hit = null } = {}) {
    const m = this.m, P = this.prop;
    if (!this.isLauncher()) return;
    P.group.updateWorldMatrix(true, false);
    const from = P.group.localToWorld(P.group.userData.muzzle.clone()), kind = P.recipe.ammo || "confetti";
    P.kick = 1; P.flash = 1; this.keep(20000);
    if (P.heavy) this.kickBack();
    const dist = from.distanceTo(target);
    if (kind === "starbursts") this.rocket(from, new THREE.Vector3(1, 0, 0).transformDirection(P.group.matrixWorld), target, { viewer, onLand });
    else if (kind === "water") this.squirtTo(from, target, { viewer, onLand, hit });
    else {
      const mat = new THREE.MeshBasicMaterial({ color: (this.m.zd && this.m.zd.on) ? 0x22e6ff : SHELL_COLOR[kind] || 0xffd25e, transparent: true });
      const mesh = new THREE.Mesh(this.ammoGeo().sphere, mat); mesh.scale.setScalar(0.055); mesh.position.copy(from); m.scene.add(mesh);
      this.shells.push({ mesh, from, to: target.clone(), t: 0, dur: clamp(dist / 6.5, 0.16, 0.55), kind, arc: viewer ? 0.15 : kind === "bubbles" ? 0.05 : 0.12 * dist, viewer, onLand });
    }
    for (let i = 0; i < 2; i++) m.spawn("star", 700);
    emit("mochi:fired", { kind, aimed: true });
  }
  /** a stream of water from one point to another (his water gun, or Cocoa's): droplets thrown so they come down on
   * the spot, landing when the stream does */
  squirtTo(from, target, { viewer = false, onLand = null, n = null, hit = null } = {}) {
    const L = AMMO_LOOK.water, dist = from.distanceTo(target), T = clamp(dist / 4.2, 0.22, 0.7);
    const v0 = target.clone().sub(from).divideScalar(T); v0.y += 0.5 * L.g * T;
    const k0 = this.ammo.length;
    this.burst("water", from, v0.clone().normalize(), n || (viewer ? 12 : 22), { speed: v0.length(), spread: viewer ? 0.06 : 0.12 });
    // the stream stops at what it hits (it used to fly on through them): a drop that gets there bursts there
    if (!viewer && hit) for (let k = k0; k < this.ammo.length; k++) this.ammo[k].stop = { at: target.clone(), r: 0.2 };
    this.shells.push({ mesh: null, from: from.clone(), to: target.clone(), t: 0, dur: T, kind: "water", arc: 0, viewer, onLand, hit });   // lands with the stream (frame-timed)
  }
  /** one drop of water, thrown (the spray off a splash, a drip falling off someone) */
  drop(at, vel, size, { life = 1200, floor = null } = {}) {
    if (this.ammo.length >= 150) return;
    const mesh = new THREE.Mesh(this.ammoGeo().sphere, this.water.dropMat());
    mesh.position.copy(at); mesh.scale.setScalar(size); this.m.scene.add(mesh);
    this.ammo.push({ mesh, vel: vel.clone(), L: AMMO_LOOK.water, age: 0, life, spin: new THREE.Vector3(), size, kind: "water", phase: 0, op: 1, floor });
  }
  splat(kind, at) {   // it hit the screen: the page draws drops (or confetti) on the glass where it landed
    let x = 0.5, y = 0.5;
    if (this.m.canvas && this.m.canvas.getBoundingClientRect) {
      const p = at.clone().project(this.m.camera), r = this.m.canvas.getBoundingClientRect();
      x = r.left + (p.x + 1) / 2 * r.width; y = r.top + (1 - p.y) / 2 * r.height;
    }
    emit("mochi:splat", { kind, x, y });
  }
  splash(at, kind) {
    this.burst(kind, at, new THREE.Vector3(0, 1, 0.25).normalize(), kind === "water" ? 14 : 26, { spread: 1.15, speed: kind === "water" ? 1.6 : undefined });
    this.mark(at, 0.45);
  }
  // a little confetti rocket: out along the barrel, curving round to where it's going, sparks trailing, then pop
  rocket(from, dir, to, { viewer = false, onLand = null } = {}) {
    const m = this.m, zd = m.zd && m.zd.on, G = this.rocketGeo();
    const g = new THREE.Group(), mats = [new THREE.MeshBasicMaterial({ color: zd ? 0x22e6ff : 0xff5f6d }), new THREE.MeshBasicMaterial({ color: zd ? 0xff3df2 : 0xffffff }), new THREE.MeshBasicMaterial({ color: zd ? 0x9b5cff : 0xffd34d })];
    g.add(new THREE.Mesh(G.body, mats[0]), new THREE.Mesh(G.tip, mats[1]), new THREE.Mesh(G.fins, mats[2]));
    g.position.copy(from); m.scene.add(g);
    const dist = from.distanceTo(to), ctrl = from.clone().addScaledVector(dir.clone().normalize(), Math.min(1.4, 0.45 * dist + 0.3)).add(new THREE.Vector3(0, viewer ? 0.1 : 0.25, 0));
    this.shells.push({ mesh: g, rocket: true, from: from.clone(), dir: dir.clone().normalize(), ctrl, to: to.clone(), t: 0, dur: clamp(dist / 5.2, 0.38, 0.95), kind: "starbursts", viewer, onLand, mats, sparkAt: 0 });
  }
  rocketGeo() {
    if (this.rGeo) return this.rGeo;
    const body = new THREE.CylinderGeometry(0.045, 0.05, 0.2, 14), tip = new THREE.ConeGeometry(0.045, 0.09, 14); tip.translate(0, 0.145, 0);
    const fins = new THREE.BoxGeometry(0.16, 0.06, 0.012); fins.translate(0, -0.08, 0);
    const f2 = new THREE.BoxGeometry(0.012, 0.06, 0.16); f2.translate(0, -0.08, 0);
    this.rGeo = { body, tip, fins: mergeFins(fins, f2) };
    return this.rGeo;
  }
  popFirework(at, big = 1) {   // the big one (kit/src/boom.js): a firework, or a data burst in Zero Day
    if (this.m.boom) this.m.boom.big(at, { size: big, zeroDay: !!(this.m.zd && this.m.zd.on) });
    else { this.burst("starbursts", at, new THREE.Vector3(0, 1, 0), Math.round(30 * big), { spread: 2.4 }); for (let i = 0; i < 3; i++) this.m.spawn("star", 900); }
  }
  stepShells(dt) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const S = this.shells[i];
      S.t += dt / S.dur;
      const u = Math.min(1, S.t);
      if (S.rocket) {   // along the curve, nose first, sparks behind
        const a = 1 - u, p = S.mesh.position;
        p.set(0, 0, 0).addScaledVector(S.from, a * a).addScaledVector(S.ctrl, 2 * a * u).addScaledVector(S.to, u * u);
        const tan = this.tmpV.copy(S.ctrl).sub(S.from).multiplyScalar(2 * a).addScaledVector(this.tmpV2.copy(S.to).sub(S.ctrl), 2 * u);
        if (tan.lengthSq() > 1e-8) S.mesh.quaternion.setFromUnitVectors(UP, tan.normalize());
        S.mesh.rotateY(S.t * 14);   // it spins as it goes
        S.mesh.scale.setScalar(S.viewer ? 1 + 2.2 * u * u : 1);
        if ((S.sparkAt += dt) > 0.028) { S.sparkAt = 0; this.burst("spark", this.tmpV3.copy(p).addScaledVector(tan, -0.12 * S.mesh.scale.x), this.tmpV4.copy(tan).negate(), 1, { spread: 0.7, speed: 0.5 }); }
        if (S.t >= 1) {
          this.m.scene.remove(S.mesh); for (const mt of S.mats) mt.dispose();
          this.shells.splice(i, 1);
          if (S.viewer) { this.splat("starbursts", S.to); this.popFirework(S.to, 0.5); } else { this.popFirework(S.to, 1); this.mark(S.to, 0.45); }
          if (S.onLand) S.onLand(S.to);
        }
        continue;
      }
      if (S.mesh) {
        S.mesh.position.lerpVectors(S.from, S.to, u); S.mesh.position.y += S.arc * 4 * u * (1 - u);
        S.mesh.scale.setScalar(0.055 * (1 + 0.25 * Math.sin(S.t * 40)));
      }
      if (S.t >= 1) {
        if (S.mesh) { this.m.scene.remove(S.mesh); S.mesh.material.dispose(); }
        this.shells.splice(i, 1);
        if (S.viewer) this.splat(S.kind, S.to);
        else if (S.kind === "water") this.water.impact(S.to, { dir: this.tmpV.copy(S.to).sub(S.from), on: S.hit && S.hit.on, normal: S.hit && S.hit.normal });   // like water
        else this.splash(S.to, S.kind);
        if (S.onLand) S.onLand(S.to);
      }
    }
  }
  mark(at, size) {   // a ring where you pointed, opening and fading
    const zd = this.m.zd && this.m.zd.on;
    const mesh = new THREE.Mesh(this.ringGeo || (this.ringGeo = new THREE.RingGeometry(0.82, 1, 48)),
      new THREE.MeshBasicMaterial({ color: zd ? 0x22e6ff : 0xff8a3d, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.copy(at); mesh.lookAt(this.m.camera.position); mesh.scale.setScalar(0.05);
    this.m.scene.add(mesh); this.marks.push({ mesh, age: 0, size });
  }
  stepMarks(dt) {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const M = this.marks[i]; M.age += dt / 0.7;
      if (M.age >= 1) { this.m.scene.remove(M.mesh); M.mesh.material.dispose(); this.marks.splice(i, 1); continue; }
      M.mesh.scale.setScalar(M.size * (0.25 + 0.75 * ease(M.age)) * 0.5); M.mesh.material.opacity = 0.85 * (1 - M.age);
    }
  }
  burst(kind, from, dir, n, { speed = null, spread = null } = {}) {
    const L = AMMO_LOOK[kind] || AMMO_LOOK.confetti, G = this.ammoGeo(), r = this.m.r;
    const cap = kind === "spark" ? 60 : 130;   // a rocket's trail never crowds out its pop
    for (let i = 0; i < n && this.ammo.length < cap; i++) {
      const jitter = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(spread ?? (kind === "water" ? 0.35 : 0.9));
      const vel = dir.clone().add(jitter).normalize().multiplyScalar((speed ?? L.speed) * (speed ? 0.9 + r() * 0.2 : 0.6 + r() * 0.6));
      let geo, mat, size = 1;
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      // Zero Day: the same shots, made of light and data (Nov 2: "all the props have a zero day themed look and
      // functionality"): water is a stream of glowing pixels, bubbles are wireframe orbs, coins are green tokens…
      const Z = this.m.zd && this.m.zd.on && kind !== "spark" && kind !== "starbursts" ? ZD_AMMO[kind] || ZD_AMMO.confetti : null;
      if (Z) {
        geo = Z.geo === "confetti" ? this.m.confettiGeo : Z.geo === "star" ? this.m.starGeo : Z.geo === "heart" ? this.m.heartGeo : G[Z.geo];
        size = Z.size[0] + r() * Z.size[1];
        mat = new THREE.MeshBasicMaterial({ color: pick(Z.colors), transparent: true, opacity: Z.opacity || 1, wireframe: !!Z.wire, side: THREE.DoubleSide, depthWrite: !Z.wire });
      } else switch (kind) {
        case "bubbles": geo = G.sphere; size = 0.05 + r() * 0.06; mat = new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0.04, transparent: true, opacity: 0.38, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.3, depthWrite: false }); break;
        case "water": geo = G.sphere; size = 0.026 + r() * 0.02; mat = new THREE.MeshPhysicalMaterial({ color: 0x7cc8ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }); break;
        case "petals": geo = G.petal; size = 0.9 + r() * 0.4; mat = new THREE.MeshPhysicalMaterial({ color: pick([0xffb3cf, 0xff8fb8, 0xffd1e0, 0xfff0f5]), roughness: 0.6, sheen: 1, sheenColor: 0xffffff, side: THREE.DoubleSide, transparent: true }); break;
        case "stars": geo = this.m.starGeo; size = 0.4 + r() * 0.25; mat = new THREE.MeshPhysicalMaterial({ color: 0xffd25e, emissive: 0x6a4a00, roughness: 0.3, clearcoat: 1, transparent: true }); break;
        case "hearts": geo = this.m.heartGeo; size = 0.45 + r() * 0.25; mat = new THREE.MeshPhysicalMaterial({ color: pick([0xff6f91, 0xff8fb8, 0xff5f86]), roughness: 0.3, clearcoat: 1, transparent: true }); break;
        case "snow": geo = G.sphere; size = 0.022 + r() * 0.02; mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.7, sheen: 1, transparent: true }); break;
        case "glitter": geo = G.gem; size = 0.8 + r() * 0.7; mat = new THREE.MeshPhysicalMaterial({ color: pick([0xffd25e, 0xf3f6ff, 0xff9ad0, 0xb9a6ff]), emissive: 0x332200, metalness: 0.6, roughness: 0.2, clearcoat: 1, transparent: true }); break;
        case "coins": geo = G.coin; size = 0.9 + r() * 0.3; mat = new THREE.MeshPhysicalMaterial({ color: 0xf2c14e, metalness: 0.85, roughness: 0.22, clearcoat: 0.6, transparent: true }); break;
        case "spark": { geo = G.gem; size = 0.7 + r() * 0.6; const S = this.sparkMats || (this.sparkMats = [0x22e6ff, 0xff3df2, 0xffe27a, 0xffffff, 0xffb347].map((c) => Object.assign(new THREE.MeshBasicMaterial({ color: c, transparent: true }), { userData: { shared: true } })));
          mat = pick(this.m.zd && this.m.zd.on ? S.slice(0, 2) : S.slice(2)); break; }
        case "starbursts": {   // stars, confetti and glitter, in party colours
          const cols = this.m.zd && this.m.zd.on ? this.m.zd.fx.confetti : [0xff6f91, 0xffd25e, 0x5ec8ff, 0x7be08a, 0xb48cff, 0xffffff], kind2 = r();
          if (kind2 < 0.4) { geo = this.m.starGeo; size = 0.3 + r() * 0.22; mat = new THREE.MeshBasicMaterial({ color: pick(cols), transparent: true }); }
          else if (kind2 < 0.8) { geo = this.m.confettiGeo; size = 1; mat = new THREE.MeshBasicMaterial({ color: pick(cols), side: THREE.DoubleSide, transparent: true }); }
          else { geo = G.gem; size = 1 + r() * 0.8; mat = new THREE.MeshBasicMaterial({ color: pick([0xffe27a, 0xffffff]), transparent: true }); }
          break;
        }
        default: geo = this.m.confettiGeo; size = 1; mat = new THREE.MeshBasicMaterial({ color: pick(this.m.zd && this.m.zd.on ? this.m.zd.fx.confetti : [0xff6f91, 0xffd25e, 0x5ec8ff, 0x7be08a, 0xb48cff]), side: THREE.DoubleSide, transparent: true });
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(from); mesh.scale.setScalar(size); mesh.rotation.set(r() * 6, r() * 6, r() * 6);
      this.m.scene.add(mesh);
      this.ammo.push({ mesh, vel, L, age: 0, life: L.life * (0.75 + r() * 0.5), spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(10), size, kind, phase: r() * 6, op: mat.opacity ?? 1 });
    }
  }
  ammoGeo() {
    if (this.geo) return this.geo;
    const petal = new THREE.SphereGeometry(0.05, 16, 10); petal.scale(1, 0.28, 0.62);
    const coin = new THREE.CylinderGeometry(0.06, 0.06, 0.014, 28); coin.rotateX(Math.PI / 2);
    this.geo = { sphere: new THREE.SphereGeometry(1, 20, 14), petal, gem: new THREE.OctahedronGeometry(0.024, 0), coin, cube: new THREE.BoxGeometry(1, 1, 1), orb: new THREE.IcosahedronGeometry(1, 1) };
    return this.geo;
  }
  removeAmmo(i) { const a = this.ammo[i]; this.m.scene.remove(a.mesh); if (!a.mesh.material.userData.shared) a.mesh.material.dispose(); this.ammo.splice(i, 1); }
  stepAmmo(dt) {
    for (let i = this.ammo.length - 1; i >= 0; i--) {
      const a = this.ammo[i], L = a.L;
      a.age += dt * 1000;
      const u = a.age / a.life;
      if (u >= 1) { this.m.scene.remove(a.mesh); if (!a.mesh.material.userData.shared) a.mesh.material.dispose(); this.ammo.splice(i, 1); continue; }
      a.vel.y -= L.g * dt;
      a.vel.multiplyScalar(Math.exp(-L.drag * dt));
      if (a.kind === "petals" || a.kind === "confetti" || a.kind === "snow" || a.kind === "starbursts") a.vel.x += Math.sin(a.age / 260 + a.phase) * 0.6 * dt;   // flutter
      if (a.kind === "bubbles") a.vel.x += Math.sin(a.age / 400 + a.phase) * 0.25 * dt;
      a.mesh.position.addScaledVector(a.vel, dt);
      if (a.kind === "water") {   // water: it stops at what it hits, and at the floor (a splash, a puddle)
        const p = a.mesh.position;
        if (a.stop && p.distanceToSquared(a.stop.at) < a.stop.r * a.stop.r) { if (this.m.r() < 0.35) this.drop(p, this.tmpV.copy(a.vel).multiplyScalar(-0.15).add(this.tmpV2.set(this.m.r() - 0.5, 0.6, this.m.r() - 0.5)), a.size * 0.6, { life: 700 }); this.removeAmmo(i); continue; }
        if (p.y < this.water.floorY() && a.vel.y < 0) { this.water.floorHit(p, a.vel.length(), !!a.floor); this.removeAmmo(i); continue; }
      }
      a.mesh.rotation.x += a.spin.x * dt; a.mesh.rotation.y += a.spin.y * dt; a.mesh.rotation.z += a.spin.z * dt;
      const grow = Math.min(1, u * 8), twinkle = a.kind === "glitter" || a.kind === "spark" || a.kind === "starbursts" ? 0.75 + 0.25 * Math.sin(a.age / 45 + a.phase) : 1;
      if (a.kind === "water") { const sp = a.vel.length(); a.mesh.scale.set(a.size, a.size * (1 + Math.min(1.6, sp * 0.25)), a.size); a.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.tmpV.copy(a.vel).normalize()); }
      else a.mesh.scale.setScalar(a.size * (0.4 + 0.6 * grow) * twinkle);
      if (a.mesh.material.userData.shared) a.mesh.scale.multiplyScalar(Math.max(0.01, 1 - u * u));   // a shared material: fade by size
      else a.mesh.material.opacity = (a.op ?? 1) * (u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1);   // from its own opacity (Zero Day bubbles are brighter)
      if (a.kind === "bubbles" && u > 0.93) a.mesh.scale.multiplyScalar(1 + (u - 0.93) * 6);   // pop!
    }
  }

  /* ================================================================= posing */
  poseStart() {
    const m = this.m;
    if (this.posing) return;
    if (this.perf) this.endPerf(false);
    m.touch(); m.queue = []; m.cur = null;
    const vals = {}; for (const k of POSE_CH) vals[k] = 0;
    this.posing = { vals, target: { ...vals }, samples: [], t0: 0, recording: false, drags: new Map(), lastSample: 0, full: false };
    m.mood = "posing"; m.setFace("posing");
    this.showHandles(true);   // the page's posing bar says what to do
  }
  poseCancel() {
    if (!this.posing) return;
    this.posing = null; this.showHandles(false);
    this.m.cur = null; this.m.next();
  }
  /** Finish posing: the recording becomes a recipe (or an error if nothing moved). He plays it back once, wobbly. */
  poseDone(name = "my move", { skill = 0.2, playBack = true } = {}) {
    const S = this.posing;
    if (!S) return { ok: false, errors: ["not posing"] };
    this.sample(performance.now(), true);
    this.posing = null; this.showHandles(false);
    const out = recipeFromSamples(S.samples, name);
    if (out.ok && this.posingProp()) { out.recipe.prop = this.prop.recipe.archetype === "handheld_canopy" || this.prop.recipe.archetype === "launcher" ? this.prop.recipe.archetype : "handheld_tool"; out.forProp = { name: this.prop.recipe.name, archetype: this.prop.recipe.archetype, recipe: this.prop.base }; }
    this.m.cur = null; this.m.next();
    if (!out.ok) { this.m.say("Hmm, I didn't really move. Try dragging my arms!"); return out; }
    if (this.stance && this.stance.standing()) out.recipe.stand = true;   // posed standing up: he'll stand to do it
    if (playBack) { this.m.say("Like this?"); this.play(out.recipe, { skill, name, seed: `posed:${name}` }); }
    return out;
  }
  poseSet(ch, v) {   // drive the pose directly (tests, or a future slider UI)
    const S = this.posing;
    if (!S || !(ch in S.target)) return false;
    const C = CHANNELS[ch]; S.target[ch] = clamp(v, C.min, C.max);
    if (!S.recording) { S.recording = true; S.t0 = performance.now(); S.lastSample = 0; }
    return true;
  }
  stepPose(now, dt) {
    const S = this.posing, k = 1 - Math.exp(-dt * 20);   // the pose follows your finger closely, never jerkily
    for (const ch of POSE_CH) S.vals[ch] += (S.target[ch] - S.vals[ch]) * k;
    if (S.recording) this.sample(now, false);
    this.m.lastActive = now;   // no dozing off mid-lesson
  }
  sample(now, force) {
    const S = this.posing;
    if (!S || !S.recording || S.full) return;
    const t = (now - S.t0) / 1000;
    if (!force && now - S.lastSample < 100) return;
    S.lastSample = now;
    S.samples.push({ t, v: { ...S.vals } });
    if (t > 8) { S.full = true; this.m.say("That's a long one! Tap done when you're ready."); }
  }
  /* pointer input while posing: grab the nearest part and move it */
  anchors() {
    const m = this.m, at = (obj, x, y, z) => obj.localToWorld(new THREE.Vector3(x, y, z));
    m.root.updateWorldMatrix(true, true);
    return [
      ["leftArm", at(m.arms[0], 0, -0.25, 0)], ["rightArm", at(m.arms[1], 0, -0.25, 0)],
      ["head", at(m.head, 0, 0.05, 0.3)], ["body", at(m.body, 0, 0.5, 0.45)],
      ["leftLeg", at(m.legs[0], 0, -0.24, 0)], ["rightLeg", at(m.legs[1], 0, -0.24, 0)],
      ...(this.posingProp() ? [["prop", new THREE.Box3().setFromObject(this.prop.group).getCenter(new THREE.Vector3())]] : []),
    ];
  }
  screen(v) { const p = v.clone().project(this.m.camera), r = this.m.canvas.getBoundingClientRect(); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; }
  poseDown(e) {
    const S = this.posing;
    if (!S) return;
    const hr = this.m.host.getBoundingClientRect();
    let best = null, bestD = Infinity;
    // the nearest handle wins, but his feet are favoured and his body is a last resort: a finger on his leg used to
    // catch the body handle and spin him round and round (Nov 2: "it just uncontrollably keeps rotating")
    const A = this.anchors(), body = A.find(([p]) => p === "body"), bodyY = body ? this.screen(body[1]).y : -Infinity;
    for (const [part, w] of A) {
      const s = this.screen(w), leg = /Leg$/.test(part);
      const d = Math.hypot(s.x - e.clientX, s.y - e.clientY) * (part === "body" ? 1.6 : leg ? (e.clientY > bodyY ? 0.6 : 0.85) : 1);
      if (d < bestD) { bestD = d; best = part; }
    }
    if (!best || bestD > hr.width * 0.45) return;
    S.drags.set(e.pointerId, { part: best, x0: e.clientX, y0: e.clientY, start: { ...S.target } });
    if (!S.recording) { S.recording = true; S.t0 = performance.now(); S.lastSample = 0; }
    this.active = best;
  }
  posingProp() { const P = this.prop; return !!(P && !P.leaving && P.slot === "hand" && P.hold !== "throw"); }   // drag it to turn it
  poseMove(e) {
    const S = this.posing, D = S && S.drags.get(e.pointerId);
    if (!D) return;
    const H = Math.max(80, this.m.host.getBoundingClientRect().height), dx = (e.clientX - D.x0) / H, dy = (D.y0 - e.clientY) / H, st = D.start, T = S.target;
    const set = (ch, v) => { const C = CHANNELS[ch]; T[ch] = clamp(v, C.min, C.max); };
    switch (D.part) {
      case "leftArm": case "rightArm": { const s = D.part === "rightArm" ? 1 : -1; set(`${D.part}.raise`, st[`${D.part}.raise`] + dy * 2.6); set(`${D.part}.spread`, st[`${D.part}.spread`] + s * dx * 2.6); break; }
      case "head": set("head.turn", st["head.turn"] + dx * 3); set("head.nod", st["head.nod"] - dy * 3); set("head.tilt", st["head.tilt"] + dx * 1.0); break;
      case "body": set("body.spin", st["body.spin"] + (Math.abs(dx) > 0.06 ? (dx - Math.sign(dx) * 0.06) * 0.9 : 0)); /* a small dead zone, and a whole turn takes a long drag */ if (dy >= 0) { set("body.hop", st["body.hop"] + dy * 3); set("body.lean", st["body.lean"] * (1 - Math.min(1, dy * 6))); } else { set("body.lean", st["body.lean"] - dy * 3); set("body.hop", st["body.hop"] * (1 + Math.max(-1, dy * 6))); } break;
      case "leftLeg": case "rightLeg": { const out = (D.part === "rightLeg" ? 1 : -1) * dx; set(`${D.part}.kick`, st[`${D.part}.kick`] + (dy + Math.max(0, out) * 0.7) * 3.2); break; }   // up, or out to its side
      case "prop": set("prop.spin", st["prop.spin"] + dx * 1.4); set("prop.tilt", st["prop.tilt"] - dy * 2.2); break;   // across: it turns; up and down: it tips
    }
  }
  poseUp(e) { const S = this.posing; if (S) S.drags.delete(e.pointerId); if (S && !S.drags.size) this.active = null; }
  showHandles(on) {
    const m = this.m;
    if (on && !this.handles) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xe8744f, transparent: true, opacity: 0.6, depthTest: false });
      this.handles = ["leftArm", "rightArm", "head", "body", "leftLeg", "rightLeg", "prop"].map((part) => {
        const g = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.105, 40), mat.clone()); g.renderOrder = 10; g.userData.part = part; m.scene.add(g); return g;
      });
    }
    if (!on && this.handles) { this.handles.forEach((h) => { m.scene.remove(h); h.geometry.dispose(); h.material.dispose(); }); this.handles = null; }
  }
  stepHandles(now) {
    if (!this.handles) return;
    const A = new Map(this.anchors());
    for (const h of this.handles) {
      const p = A.get(h.userData.part); h.visible = !!p; if (!p) continue;
      h.position.copy(p); h.quaternion.copy(this.m.camera.quaternion);
      const act = this.active === h.userData.part, pulse = 1 + Math.sin(now / 260 + h.id) * 0.08;
      h.scale.setScalar((act ? 1.35 : 1) * pulse * (h.userData.part === "body" ? 1.4 : 1));
      h.material.opacity = act ? 0.95 : 0.6;
      h.material.color.setHex(act ? 0xffb703 : 0xe8744f);
    }
  }
}

/** Turn pose samples [{t, v: {channel: value}}] into a move recipe: idle time trimmed, a soft return to rest added,
 * every track simplified to its key moments, then validated (≤ 4 s, ≤ 12 keys, rest at both ends). */
export function recipeFromSamples(samples, name = "my move") {
  if (!samples || samples.length < 2) return { ok: false, errors: ["nothing recorded"], warnings: [] };
  const moved = (s, ch) => Math.abs(s.v[ch] || 0) > 0.04;
  const chans = POSE_CH.filter((ch) => samples.some((s) => moved(s, ch)));
  if (!chans.length) return { ok: false, errors: ["nothing moved"], warnings: [] };
  // trim the still bits at the start and the end (keep a breath of each)
  const changed = (i) => i > 0 && chans.some((ch) => Math.abs((samples[i].v[ch] || 0) - (samples[i - 1].v[ch] || 0)) > 0.01);
  let first = samples.findIndex((s, i) => changed(i) || chans.some((ch) => moved(s, ch)));
  let last = samples.length - 1; while (last > first && !changed(last)) last--;
  first = Math.max(0, first - 1); last = Math.min(samples.length - 1, last + 2);
  const use = samples.slice(first, last + 1), t0 = use[0].t - 0.25, end = use[use.length - 1].t - t0;
  const tracks = {};
  for (const ch of chans) {
    let keys = [[0, 0], ...use.map((s) => [s.t - t0, s.v[ch] || 0])];
    const lastV = keys[keys.length - 1][1], rest = ch === "body.spin" || ch === "prop.spin" ? Math.round(lastV) : 0;
    keys.push([end + 0.2 + Math.min(0.5, Math.abs(lastV - rest) * 0.5), rest]);   // ease home: longer if it's further away
    tracks[ch] = simplifyTrack(dedupeKeys(keys), MOVE_LIMITS.keys);
  }
  const v = validateMove({ name, tracks });
  return { ok: v.ok, recipe: v.recipe, errors: v.errors, warnings: v.warnings };
}
function dedupeKeys(keys) { return keys.filter((k, i) => i === 0 || k[0] - keys[i - 1][0] > 0.021); }
