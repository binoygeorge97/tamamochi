/* Scuffle: soft-toy throws between Mochi, Cocoa and you.
 *
 * fight(steps) plays throws one after another: Cocoa runs in if he isn't here, the thrower takes a ball (a water
 * balloon, snowball, confetti ball or foam ball), winds up and throws. Whoever gets hit says "Ouch!", wobbles, and
 * keeps a shield ready from then on: the next throw at them bounces off it ("Ha! Missed me!"). After two blocks they
 * get cocky and put it away. Who has a shield ready is remembered in this browser (shared/scuffle.js has the rules;
 * the server uses the same ones to tell the brain what happened).
 *
 * Cocoa holds things in his hoof on Mochi's side (a ball to throw, a shield to block) and talks in his own bubble.
 * step() runs every frame after the body, the friends and Mochi's props have been posed. */
import * as THREE from "three";
const SHIELD_E = new THREE.Euler(0, 0.95, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
import { disposeProp, shown } from "./props.js";
import { PROP_EXAMPLES, validateProp } from "../../shared/craft.js";
import { planThrows, newGuard, cleanGuard, SHIELD } from "../../shared/scuffle.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
const KEY = "mochi.guard";
const loadGuard = () => { try { return cleanGuard(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (_) { return newGuard(); } };
const saveGuard = (g) => { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch (_) { /* private mode: this page only */ } };
const pattern = (name) => Object.values(PROP_EXAMPLES).flat().find((r) => r.name === name);
// Cocoa's shield is in his colours: a teal rim like his bandana
const cocoaShield = (r) => ({ ...r, parts: r.parts.map((p) => (p.label === "rim" ? { ...p, color: "#1fb5a8" } : p.shape === "star" ? { ...p, color: "#ffffff" } : p)) });
// and his water gun: teal and white, his colours (the biggest colour on it becomes his teal, the next one white)
const tealGun = (r) => {
  const vol = {}; for (const p of r.parts) if (p.material !== "glass") vol[p.color] = (vol[p.color] || 0) + p.size[0] * p.size[1] * p.size[2];
  const [a, b] = Object.entries(vol).sort((x, y) => y[1] - x[1]).map(([c]) => c), map = { [a]: "#1fb5a8", ...(b ? { [b]: "#ffffff" } : {}) };
  return { ...r, name: "Cocoa's water gun", parts: r.parts.map((p) => (map[p.color] ? { ...p, color: map[p.color] } : p)) };
};
const ease2 = (u) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };

const SQUIRT_LINES = {
  cocoa: { water: ["Hey! I'm soaked!", "Pfft! Right in the bandana!", "Oh, it's ON now!"], bubbles: ["Bubbles?! Hehe, okay that's nice.", "Pop pop pop!"], confetti: ["Confetti in my horns! Again!", "Hey! Now I'm a party."], starbursts: ["Whoa! Fireworks on my face!", "Okay that was awesome. And loud."], other: ["Hey! Got me!", "Oof! Nice shot.", "No fair, I wasn't ready!"] },
  mimi: { water: ["Eep! Mochi!", "My bow is all wet! Hmph… hehe."], bubbles: ["Ooh, bubbles! Pretty~", "Hehe, they tickle!"], other: ["Eep! Mochi!", "Hehe, you got me!", "Mochi! My bow!"] },
};

export class Scuffle {
  constructor(m) {
    this.m = m;
    this.guard = loadGuard();
    this.queue = []; this.cur = null;
    const arm = m.cocoaArms[1];   // his hoof on Mochi's side
    this.cHand = new THREE.Group(); this.cHand.position.set(0, -0.27, 0.035); arm.add(this.cHand);
    this.cItem = null;            // what Cocoa holds: { group, kind: "ball" | "shield", recipe, s, gone }
    this.cAnim = null;            // his throw: { t0, released }
    this.cArm = { rx: -0.6, rz: 0.2, w: 0 };
    this.ouch = { mochi: 0, cocoa: 0 };
    this.bubbles = {}; this.lines = [];
    this.heard = [];              // [who, text]: what's been said (tests, and anyone curious)
    this.done = [];               // the throws played, with where each landed
    this.v = new THREE.Vector3(); this.q = new THREE.Quaternion();
    this.wf = null;               // a water fight (Nov 4): both with water guns, taking turns
    this.cAim = null;             // Cocoa aiming his water gun: { at, t0 }
  }

  /* ---------------------------------------------------------------- the plan */
  /** steps: [{ from: "mochi" | "cocoa", at: "cocoa" | "mochi" | "viewer" | null }]. Returns { ok, plan, firstMs,
   * totalMs }: what will happen (hit, block, cocky, splat) and roughly when the first one lands and the last ends. */
  fight(steps, { ball = null, shield = null } = {}) {
    const m = this.m;
    if (m.sulking || m.inBed || !Array.isArray(steps) || !steps.length) return { ok: false, plan: [] };
    const B = ball && ball.parts ? ball : pattern("water balloon"), Sh = shield && shield.parts ? shield : pattern(SHIELD);
    const { plan, guard } = planThrows(steps, this.guard);
    this.guard = guard; saveGuard(guard);
    const cocoaAway = !m.bud || m.bud.leaving, mimiAway = !m.gf || m.gf.leaving, wait = this.cur || this.queue.length;
    let firstMs = 0, totalMs = 0;
    plan.forEach((p, i) => {
      this.queue.push({ ...p, ball: B, shieldR: Sh, phase: "enter" });
      const step = 450 + 390 + 520 + (p.says.length > 1 ? 2300 : 1300);
      if (i === 0) firstMs = (wait ? 3000 : 0) + ((p.from === "cocoa" || p.at === "cocoa") && cocoaAway ? 1750 : 0) + (p.at === "mimi" && mimiAway ? 3200 : 0) + 450 + 390 + 520;
      totalMs += step;
    });
    if (plan.some((p) => p.from === "cocoa" || p.at === "cocoa") && cocoaAway) totalMs += 1750;
    if (plan.some((p) => p.at === "mimi") && mimiAway) totalMs += 3200;
    return { ok: true, plan, firstMs, totalMs };
  }
  busy() { return !!(this.cur || this.queue.length || this.wf); }
  resetGuard() { this.guard = newGuard(); saveGuard(this.guard); return this.guard; }

  /* ---------------------------------------------------------------- where things are */
  target(who, S = null) {   // the point a throw at someone flies to: their shield if it's up, else their face
    const m = this.m;
    if (who === "cocoa") {
      if (this.cItem && this.cItem.kind === "shield" && !this.cItem.gone) return this.center(this.cItem.group);
      m.cocoaHead.updateWorldMatrix(true, false);
      return m.cocoaHead.localToWorld(this.v.set(0.12, -0.04, 0.42)).clone();
    }
    if (who === "mimi") return m.gf && !m.gf.leaving && m.mimi ? this.mimiTarget() : null;
    if (who === "mochi") {
      const P = m.craft.prop;
      if (S && S.shield && P && P.hold === "guard" && !P.leaving) return this.center(P.group);
      m.head.updateWorldMatrix(true, false);
      return m.head.localToWorld(this.v.set(-0.14, 0.0, 0.42)).clone();
    }
    return null;
  }
  center(g) { g.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()); }
  cocoaHit() {   // is the craft's ray (a tap) on Cocoa?
    const m = this.m;
    if (!m.bud || m.bud.leaving || !m.cocoa.visible) return false;
    return m.craft.ray.intersectObject(m.cocoa, true).some((h) => shown(h.object));
  }
  screenOf(who) {   // where someone's face is on the screen (client px): tests, and the page if it ever needs it
    const m = this.m, at = who === "cocoa" ? (m.bud && m.cocoa.visible ? this.target("cocoa") : null) : this.target("mochi");
    if (!at) return null;
    const p = at.project(m.camera), r = m.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }
  viewerTarget(from) { return from.clone().lerp(this.m.camera.position, 0.74).add(new THREE.Vector3(0.06, 0.05, 0)); }

  /* ---------------------------------------------------------------- Cocoa's hoof */
  give(recipe, kind) {   // something pops into Cocoa's hoof
    this.drop(true);
    const r = kind === "shield" ? cocoaShield(recipe) : recipe, group = this.m.craft.build(r);
    group.scale.setScalar(0.001); this.cHand.add(group);
    this.cItem = { group, kind, recipe: r, s: 0, gone: false };
    return this.cItem;
  }
  drop(now) {   // it goes away (shrinks, or at once)
    const I = this.cItem;
    if (!I) return;
    if (now) { this.cHand.remove(I.group); disposeProp(I.group); this.cItem = null; return; }
    I.gone = true;
  }
  /** Cocoa or Mimi says something in a little bubble over their head (shown while they're on stage). */
  friendSay(who, text, ms = 2600) {
    const host = this.m.host;
    if (!host || typeof document === "undefined" || !host.appendChild || !text) return;
    try { window.dispatchEvent(new CustomEvent("mochi:say", { detail: { who, text: String(text) } })); } catch (_) { /* no voice */ }   // out loud too, in their voice (Nov 5)
    this.bubbles = this.bubbles || {};
    let B = this.bubbles[who];
    if (!B) {
      const b = document.createElement("div");
      b.className = `mochi-friend-say ${who}`; b.setAttribute("role", "status");
      Object.assign(b.style, { position: "absolute", left: "0", top: "0", zIndex: "6", width: "max-content", maxWidth: "200px", padding: "7px 12px", borderRadius: who === "mimi" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: "var(--card, #fff)", color: "var(--label, #2a2430)", boxShadow: "var(--shadow-pop, 0 8px 22px rgba(40,30,60,.18))", font: "600 15px/1.25 inherit", pointerEvents: "none",
        opacity: "0", transform: "translate(-50%, -100%) scale(.6)", transformOrigin: "50% 100%", transition: "opacity .18s, transform .35s cubic-bezier(.34,1.56,.64,1)" });
      host.appendChild(b); B = this.bubbles[who] = { b, until: 0 };
    }
    B.b.textContent = text; B.until = performance.now() + Math.max(ms, 1200 + String(text).length * 45);
    B.b.style.opacity = "1"; B.b.style.transform = "translate(-50%, -100%)";
  }
  cocoaSay(text, ms = 1600) { this.friendSay("cocoa", text, ms); }
  placeBubble(now) {
    const m = this.m;
    if (!this.bubbles || !m.canvas.getBoundingClientRect) return;
    for (const [who, B] of Object.entries(this.bubbles)) {
      const peek = m.peeking && m.peeking.who === who && now >= m.peeking.t0 && now < m.peeking.until;   // (peeking in from the edge: not here yet, but talking)
      const here = who === "cocoa" ? (m.bud || peek) && m.cocoa.visible : (m.gf || peek) && m.mimi.visible, head = who === "cocoa" ? m.cocoaHead : m.mimiHead;
      if (now > B.until || !here || !head) { B.b.style.opacity = "0"; B.b.style.transform = "translate(-50%, -100%) scale(.6)"; continue; }
      head.updateWorldMatrix(true, false);
      const r = m.canvas.getBoundingClientRect(), h = m.host.getBoundingClientRect();
      if (peek) {   // peeking in at the edge: the bubble beside their head, on the side toward the room, its tail to them;
        // put there once, where the head is leaned all the way in (not sliding off with it as they duck out)
        const side = who === "mimi" ? 1 : -1;
        if (!B.peekAt || B.peekAt.t0 !== m.peeking.t0) {
          const c = head.getWorldPosition(this.v), p = c.set(c.x - side * 0.5, c.y + 0.22, c.z).project(m.camera);
          B.peekAt = { t0: m.peeking.t0, left: r.left + ((p.x + 1) / 2) * r.width - h.left, top: Math.max(48, r.top + ((1 - p.y) / 2) * r.height) - h.top };
        }
        B.b.style.transform = side < 0 ? "translate(0, -100%)" : "translate(-100%, -100%)";
        B.b.style.left = `${B.peekAt.left}px`; B.b.style.top = `${B.peekAt.top}px`;
        continue;
      }
      const p = head.localToWorld(this.v.set(0, 0.62, 0)).project(m.camera);
      // kept on the screen: a friend at the very edge (a peek) would have half the bubble off it
      const hw = (B.b.offsetWidth || 160) / 2, vw = (typeof innerWidth === "number" ? innerWidth : r.right), sx = Math.max(hw + 8, Math.min(vw - hw - 8, r.left + ((p.x + 1) / 2) * r.width));
      const sy = Math.max(48, (B.b.offsetHeight || 40) + 12, r.top + ((1 - p.y) / 2) * r.height);   // (the whole bubble on screen, not its top cut off: Nov 7, a phone)
      // not over the page's own buttons and chips (Mimi's "Bye bye ♡" sat on the chips at the top right): slid along
      // toward the middle of the screen until it's clear (looked at a few times a second, not every frame)
      if (now - (B.clearAt || 0) > 200 || Math.abs(sx - (B.lastSx || 0)) > 30) { B.clearAt = now; B.lastSx = sx; B.shift = this.clearShift(B.b, sx, sy, hw, vw); }
      B.b.style.left = `${sx + (B.shift || 0) - h.left}px`; B.b.style.top = `${sy - h.top}px`;
    }
  }

  /** how far to slide a bubble (its tail at sx, sy; hw half its width) so none of it is over something of the page's */
  clearShift(b, sx, sy, hw, vw) {
    if (typeof document === "undefined" || !document.elementFromPoint) return 0;
    const host = this.m.host, H = b.offsetHeight || 40, dir = sx > vw / 2 ? -1 : 1, big = vw * (innerHeight || 800) * 0.3;
    const blocked = (x, y) => {
      const e = document.elementFromPoint(x, y);
      if (!e || e === b || b.contains(e) || host.contains(e) || e.contains(host)) return false;
      const q = e.getBoundingClientRect(); return q.width * q.height < big;   // a button or a chip, not the page behind
    };
    const clearAt = (x) => x - hw >= 4 && x + hw <= vw - 4 && ![[x - hw + 6, sy - H + 6], [x + hw - 6, sy - H + 6], [x, sy - H + 6], [x - hw + 6, sy - 6], [x + hw - 6, sy - 6]].some(([px, py]) => blocked(px, py));
    for (let k = 0; k <= 14; k++) for (const d of k ? [dir, -dir] : [dir]) if (clearAt(sx + d * k * 22)) return d * k * 22;   // the nearest clear spot, either way (toward the middle first)
    return 0;
  }

  /* ---------------------------------------------------------------- every frame */
  step(now, t, dt) {
    this.run(now);
    this.runWater(now);
    this.stepOuch(now, "mochi");
    this.placeBubble(now);
    for (let i = this.lines.length - 1; i >= 0; i--) { const L = this.lines[i]; if (now >= L.at) { this.lines.splice(i, 1); L.fn(); } }
  }
  // before Mochi's props and the balls in the air are stepped, so a ball flies to where Cocoa's shield really is
  pose(now, dt) { this.stepCocoa(now, dt); this.stepOuch(now, "cocoa"); }
  later(ms, fn) { this.lines.push({ at: performance.now() + ms, fn }); }
  // his launcher got them (a tap on Cocoa or Mimi while he holds one): a wobble, a line, and the others laugh
  squirted(who, kind = "water") {
    const m = this.m, now = performance.now(), here = who === "cocoa" ? m.bud && !m.bud.leaving : m.gf && !m.gf.leaving;
    if (!here) return;
    if (who === "cocoa") this.ouch.cocoa = now;
    const L = SQUIRT_LINES[who][kind] || SQUIRT_LINES[who].other;
    this.squirtN = ((this.squirtN || 0) + 1) % L.length;
    this.say(who, L[this.squirtN]);
    this.later(350, () => m.play("laugh", 1500));
    const other = who === "cocoa" ? m.gf : m.bud;
    if (other && !other.leaving) { other.role = "giggle"; other.roleAt = now; }
    if (who === "cocoa" && m.bud) this.later(900, () => { if (m.bud && !m.bud.leaving) { m.bud.role = "ready"; m.bud.roleAt = performance.now(); } });
    // squirted with water, now and then he pulls out his own water gun and gets him right back (Nov 4: "it would be
    // interesting if sometimes cocoa could pull out his own water gun")
    if (who === "cocoa" && kind === "water" && !this.wf && (this.backN = (this.backN || 0) + 1) % 2 === 1) {
      const P = m.craft.prop, gun = P && !P.leaving && P.recipe.ammo === "water" ? P.base : null;
      this.later(1300, () => {
        if (this.wf || !m.bud || m.bud.leaving) return;
        const dodge = this.m.r() < 0.3;
        this.waterFight({ starter: "cocoa", quick: true, start: ["My turn, dude!"], shots: [{ from: "cocoa", at: "mochi", outcome: dodge ? "dodge" : "hit", says: dodge ? "Hehe, missed me!" : "Eep! Cold!" }], truce: { mochi: dodge ? "Ha! Too slow!" : "Hehe, okay, we're even!", cocoa: dodge ? "Next time, bro!" : "Now we're even, bro!" } }, { gun });
      });
    }
  }
  mimiHit() {   // is the craft's ray (a tap) on Mimi?
    const m = this.m;
    if (!m.gf || m.gf.leaving || !m.mimi || !m.mimi.visible) return false;
    return m.craft.ray.intersectObject(m.mimi, true).some((h) => shown(h.object));
  }
  mimiTarget() { const m = this.m; (m.mimiHead || m.mimi).updateWorldMatrix(true, false); return (m.mimiHead || m.mimi).localToWorld(this.v.set(0, 0, 0.3)).clone(); }
  say(who, text) { if (!text) return; this.heard.push([who, text]); if (this.heard.length > 20) this.heard.shift(); if (who === "cocoa" || who === "mimi") this.friendSay(who, text, 1600); else this.m.say(text); }

  /* ---------------------------------------------------------------- a water fight (Nov 4)
   * fight: { starter, shots: [{ from, at, outcome: "hit" | "dodge", says }], start: [line, line], truce: { mochi, cocoa },
   * quick } (shared/scuffle.js plans it). Cocoa runs in if he isn't here and pulls out his own water gun, Mochi gets his
   * out and stands up for it, then they take turns: the shooter aims and squirts at where the other one is; one who
   * dodges really steps out of the way first (Cocoa runs a few steps, Mochi shuffles aside) and it splashes where he
   * was. Hit: a wobble, a line, drips. Then a truce, and the guns go away. */
  waterFight(fight, { gun = null, cocoaGun = null } = {}) {
    const m = this.m;
    if (m.sulking || m.inBed || !fight || !Array.isArray(fight.shots) || !fight.shots.length) return { ok: false };
    if (this.cur || this.queue.length) { this.queue = []; this.cur = null; this.drop(true); }   // a throwing game gives way
    const G = gun && gun.parts ? gun : pattern("water pistol"), CG = validateProp(cocoaGun && cocoaGun.parts ? cocoaGun : pattern("water pistol")).recipe;
    const here = !!(m.bud && !m.bud.leaving);
    // he calls Cocoa over and gets him as he arrives (Nov 4: "mochi surprises him with a water gun shot … maybe the
    // next time cocoa comes prepared with his shield"): only when Cocoa isn't here yet
    const ambush = fight.ambush && !here && fight.shots[0] && fight.shots[0].ambush ? fight.ambush : null;
    if (fight.shots[0] && fight.shots[0].ambush && !ambush) fight = { ...fight, shots: [{ ...fight.shots[0], outcome: "hit", says: "Hey! I'm soaked!", ambush: false }, ...fight.shots.slice(1)] };
    this.wf = { fight, gun: G, cgun: tealGun(CG), i: -1, phase: ambush ? "sneak" : "enter", t0: performance.now(), shot: null, ambush };
    return { ok: true, ms: (here ? 0 : 3200) + 1600 + fight.shots.length * 2600 + 2400 };
  }
  runWater(now) {
    const m = this.m, C = m.craft, W = this.wf;
    if (!W) return;
    if (m.sulking || m.inBed) { this.endWater(true); return; }
    const el = now - W.t0, F = W.fight;
    if (m.bud && !m.bud.leaving) m.bud.until = Math.max(m.bud.until, now + 8000);   // he stays for the fight
    const next = (phase) => { W.phase = phase; W.t0 = now; };
    switch (W.phase) {
      case "sneak": {   // gun out, a sneaky giggle, then he calls Cocoa over and waits for him to get here
        if (!W.called) {
          W.called = true;
          const P = C.prop; if (!(P && !P.leaving && P.recipe.name === W.gun.name)) C.hold(W.gun, { ms: 40000, quiet: true }); else C.keep(40000);
          m.play("peek", 900); m.say("Hehe…");
          this.later(900, () => { if (!this.wf) return; if (!m.friend("cocoa", "ready", 40000)) { this.endWater(true); return; } if (m.bud) m.bud.noBump = true; });
        }
        if (m.bud && !m.bud.leaving && W.ambush.shield && !this.cItem && now > m.bud.t0) { this.give(cocoaShield(pattern(SHIELD)), "shield"); this.guard.cocoa = 1; }   // he's learned: shield up, coming in
        if (m.bud && !m.bud.leaving && now - m.bud.t0 > (m.bud.inMs || 650) * 0.92) { W.i = 0; next("aim"); }   // as he arrives
        else if (el > 9000) this.endWater(true);
        break;
      }
      case "enter": {
        if (!m.bud || m.bud.leaving) { if (!W.called) { W.called = true; if (!m.friend("cocoa", "ready", 40000, { call: F.starter !== "cocoa" })) { this.endWater(true); return; } } if (el > 9000) this.endWater(true); return; }
        if (now - m.bud.t0 < (m.bud.inMs || 650) + 850 && el < 9000) return;   // running in
        m.bud.role = "ready"; m.bud.roleAt = now;
        this.give(W.cgun, "gun");
        const P = C.prop;
        if (!(P && !P.leaving && P.recipe.name === W.gun.name)) C.hold(W.gun, { ms: 40000, quiet: true }); else C.keep(40000);
        if (C.stance) C.stance.need("waterfight", true);
        // a little room for it: Cocoa backs off a few steps, Mochi steps the other way
        W.cBase = F.quick ? 0 : -0.3; W.mBase = F.quick ? 0 : 0.22;
        m.bud.fx = W.cBase;
        if (W.mBase && C.stance) C.stance.shuffle(W.mBase, 60);
        const st = F.start || [];
        if (F.starter === "cocoa") { this.say("cocoa", st[0]); m.play("surprised", 1200); if (st[1]) this.later(1100, () => this.say("cocoa", st[1])); }
        else { if (st[0]) this.say("cocoa", st[0]); if (st[1]) this.later(1000, () => this.say("mochi", st[1])); }
        next("ready");
        break;
      }
      case "ready": if (el > (F.quick ? 700 : 1500)) { W.i++; next(W.i < F.shots.length ? "aim" : "truce"); } break;
      case "aim": {   // the shooter takes aim at where the other one is; one who's going to dodge starts moving
        const S = W.shot = W.shot && W.shot.i === W.i ? W.shot : { i: W.i, ...F.shots[W.i], landed: false };
        if (!S.at0) {
          S.at0 = (S.outcome === "block" && this.cItem && this.cItem.kind === "shield" ? this.center(this.cItem.group) : this.target(S.at)).clone();
          if (S.from === "cocoa") this.cAim = { at: S.at0.clone(), t0: now };
        }
        if (S.outcome === "dodge" && !S.moved && el > 120) {
          S.moved = true;
          if (S.at === "cocoa" && m.bud) m.bud.fx = W.cBase + (this.m.r() < 0.6 ? -0.45 : 0.32);       // a few running steps, one way or the other
          else if (S.at === "mochi" && C.stance) { const side = this.m.r() < 0.65 ? 1 : -1; C.stance.shuffle(W.mBase + side * 0.38, 60); m.play("surprised", 900); }
        }
        if (el > 520) {   // fire
          const onLand = (p) => this.landWater(S, p), hit = this.wetHit(S);
          if (S.from === "mochi") {
            if (!(C.isLauncher() && C.aimAt(S.at0, { mark: false, onLand, hit }))) { const hp = C.hand.getWorldPosition(new THREE.Vector3()); C.squirtTo(hp, S.at0, { onLand, hit }); }
          } else {
            const I = this.cItem;
            if (I && I.kind === "gun" && I.group.userData.muzzle) { I.group.updateWorldMatrix(true, false); const from = I.group.localToWorld(I.group.userData.muzzle.clone()); I.kick = 1; C.squirtTo(from, S.at0, { onLand, hit }); }
            else { this.cAim = null; this.landWater(S, S.at0); }
          }
          next("flying");
        }
        break;
      }
      case "flying": if (el > 3000) { this.landWater(W.shot, W.shot.at0); } break;   // never stuck
      case "after":
        if (W.ambush && W.i === 0 && !W.armed) {   // after the surprise: his own water gun out, the fight's on
          if (el < 900) break;
          W.armed = true;
          if (this.cItem && this.cItem.kind === "shield") this.drop(false);
          this.give(W.cgun, "gun"); m.bud && (m.bud.role = "ready", m.bud.roleAt = now);
          if (C.stance) C.stance.need("waterfight", true);
          W.cBase = -0.3; W.mBase = 0.22; if (m.bud) m.bud.fx = W.cBase; if (C.stance) C.stance.shuffle(W.mBase, 60);
          this.say("cocoa", W.ambush.shield ? "Nice try, bro! My turn!" : "Oh, it's ON now!");
          W.t0 = now - 400;
          break;
        }
        if (el > 1250) {
          if (m.bud) m.bud.fx = W.cBase;   // back to their spots
          if (W.shot && W.shot.outcome === "dodge" && W.shot.at === "mochi" && C.stance) C.stance.shuffle(W.mBase, 60);
          W.shot = null; W.i++; next(W.i < F.shots.length ? "aim" : "truce");
        }
        break;
      case "truce":
        if (!W.said) {
          W.said = true;
          const T = F.truce || {};
          if (T.mochi) this.say("mochi", T.mochi);
          if (T.cocoa) this.later(900, () => this.say("cocoa", T.cocoa));
          this.later(400, () => m.play("laugh", 1600));
          if (m.bud) { m.bud.role = "giggle"; m.bud.roleAt = now; }
        }
        if (el > 2400) this.endWater(false);
        break;
    }
  }
  /** what a squirt lands on (for how the water splashes, wets them and runs down): their head, or the shield; a dodge
   * lands on nothing (it flies on where they were and comes down on the floor) */
  wetHit(S) {
    const W = this.m.craft.water;
    if (S.outcome === "hit") return { on: W.headOf(S.at) };
    if (S.outcome === "block" && this.cItem && this.cItem.kind === "shield") { const c = this.center(this.cItem.group); this.m.cocoaHead.updateWorldMatrix(true, false); return { normal: c.sub(this.m.cocoaHead.getWorldPosition(new THREE.Vector3())).normalize() }; }
    return null;
  }
  landWater(S, at) {
    const m = this.m, C = m.craft, W = this.wf, now = performance.now();
    if (!W || !S || S.landed) return;
    S.landed = true; this.cAim = null;   // (the water itself splashes where it lands: stagecraft → water.js)
    if (S.outcome === "block") {   // off his shield
      if (this.cItem) this.cItem.kick = 1;
      this.later(250, () => m.play("oops", 1300)); this.later(900, () => m.say("Aww!"));
    } else if (S.outcome === "hit") {
      this.ouch[S.at] = now;
      if (S.ambush) this.later(500, () => m.say("Hehe! Surprise!"));
      if (S.at === "mochi") { m.play("surprised", 1000); this.later(1000, () => m.play("laugh", 1400)); }
      else if (m.bud) { m.bud.role = "giggle"; m.bud.roleAt = now; this.later(1100, () => { if (m.bud && this.wf) { m.bud.role = "ready"; m.bud.roleAt = performance.now(); } }); }
      if (S.from === "mochi") this.later(300, () => m.play("laugh", 1300));
    } else if (S.from === "mochi") this.later(200, () => m.play("oops", 1200));
    this.say(S.at, S.says);
    if (m.gf && !m.gf.leaving) { m.gf.role = "giggle"; m.gf.roleAt = now; }
    if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:hit", { detail: { from: S.from, at: S.at, outcome: S.outcome, water: true } }));
    W.phase = "after"; W.t0 = now;
  }
  endWater(cut) {
    const m = this.m, C = m.craft, W = this.wf;
    this.wf = null; this.cAim = null;
    if (m.bud) m.bud.fx = 0;
    if (this.cItem && this.cItem.kind === "gun") this.drop(false);
    if (C.stance) { C.stance.need("waterfight", false); if (C.stance.trip) C.stance.stopWalk(); }   // (he walks back to his spot)
    if (C.prop && W && C.prop.recipe.name === W.gun.name) C.keep(4000);
    if (m.bud && !m.bud.leaving && !cut) { m.bud.role = "play"; m.bud.roleAt = performance.now(); m.bud.until = Math.max(m.bud.until, performance.now() + 6000); }
    const amb = W && W.ambush ? (W.ambush.shield ? "block" : "hit") : null;
    if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:waterfight", { detail: { done: true, cut: !!cut, shots: W ? W.fight.shots.length : 0, ambush: amb } }));
  }

  run(now) {
    const m = this.m, C = m.craft;
    if (!this.cur && this.queue.length) { this.cur = this.queue.shift(); this.cur.t0 = now; }
    const S = this.cur;
    if (!S) return;
    if (m.sulking || m.inBed) { this.queue = []; this.cur = null; this.drop(false); return; }
    const cocoa = S.from === "cocoa" || S.at === "cocoa";
    if (cocoa && m.bud && !m.bud.leaving) m.bud.until = Math.max(m.bud.until, now + 7000);   // he stays for the game
    if (S.at === "mimi" && m.gf && !m.gf.leaving) m.gf.until = Math.max(m.gf.until, now + 7000);   // so does she
    const el = now - S.t0;
    switch (S.phase) {
      case "enter": {
        if (S.at === "mimi") {   // Nov 7: "Throw it at mimi". She's called over if she isn't here, then it's thrown once she's arrived
          if (!m.gf || m.gf.leaving) { if (!S.called) { S.called = true; if (!m.friend("mimi", "hello", 20000)) { this.finish(now); return; } } else if (el > 9000) { this.finish(now); return; } break; }
          if (m.gf.asked) { this.finish(now); return; }   // sent home: no throwing at her on her way out
          if (m.friendArrived("mimi") || el > 9000) { S.phase = "arm"; S.t0 = now; }
          break;
        }
        if (!cocoa) { S.phase = "arm"; S.t0 = now; break; }
        if (!m.bud || m.bud.leaving) { if (!S.called) { S.called = true; if (!m.friend("cocoa", "ready", 20000)) { this.finish(now); return; } } break; }
        if (m.bud.role !== "ready" && m.bud.role !== "giggle") { m.bud.role = "ready"; m.bud.roleAt = now; }
        if (now - m.bud.t0 > (m.bud.inMs || 650) + 1050) { S.phase = "arm"; S.t0 = now; }   // (once he's run in, however far)
        else if (el > 4000) { S.phase = "arm"; S.t0 = now; }
        break;
      }
      case "arm": {   // the thrower takes a ball; a target who learned holds up a shield
        if (!S.armed) {
          S.armed = true;
          if (S.from === "mochi") {
            const P = C.prop;
            if (!(P && !P.leaving && P.hold === "throw" && P.recipe.name === S.ball.name)) C.hold(S.ball, { ms: 16000, quiet: true }); else C.keep(16000);
          } else this.give(S.ball, "ball");
          if (S.shield && S.at === "cocoa") this.give(S.shieldR, "shield");
          if (S.shield && S.at === "mochi") C.hold({ ...S.shieldR, hold: "guard" }, { ms: 7000, quiet: true });
        }
        if (el > 450) { S.phase = "throw"; S.t0 = now; }
        break;
      }
      case "throw": {
        const onLand = (p) => this.land(S, p);
        if (S.from === "mochi") {
          if (!C.isThrowable()) { S.phase = "after"; S.doneAt = now; break; }
          let to;
          if (S.at === "viewer") to = this.viewerTarget(C.hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-0.15, 0.25, 0)));
          else if (S.at === "mimi") { const at0 = this.target("mimi"); if (!at0) { S.phase = "after"; S.doneAt = now; break; } to = () => this.target("mimi") || at0; }
          else if (S.at) to = () => this.target(S.at, S);
          else { const hp = C.hand.getWorldPosition(new THREE.Vector3()); to = new THREE.Vector3(hp.x + 0.75, 0.04, hp.z + 0.8); }
          if (C.throwAt(to, { viewer: S.at === "viewer", onLand })) { S.phase = "flying"; S.t0 = now; }
        } else {
          if (!this.cAnim) {
            if (!this.cItem || this.cItem.kind !== "ball" || !m.bud) { S.phase = "after"; S.doneAt = now; break; }
            this.cAnim = { t0: now, released: false };
          }
          if (!this.cAnim.released && now - this.cAnim.t0 >= 390 && this.cItem && this.cItem.kind === "ball") {
            this.cAnim.released = true;
            const g = C.build(this.cItem.recipe);
            this.cItem.group.updateWorldMatrix(true, true);
            this.cItem.group.matrixWorld.decompose(g.position, g.quaternion, g.scale);
            m.scene.add(g); this.drop(true);
            const to = S.at === "viewer" ? this.viewerTarget(this.center(g)) : () => this.target(S.at || "mochi", S) || this.target("mochi", S);
            C.flyBall(g, { kind: S.ball.ammo || "water", to, viewer: S.at === "viewer", onLand });
            S.phase = "flying"; S.t0 = now;
          }
        }
        break;
      }
      case "flying": if (el > 4000) { S.phase = "after"; S.doneAt = now; } break;   // never stuck
      case "after": if (now >= S.doneAt) this.finish(now); break;
    }
  }
  land(S, at) {   // it got there: ouch, or bonk off the shield, or splat on the glass
    const m = this.m, C = m.craft, now = performance.now(), thrower = S.from, target = S.at;
    if (S.phase !== "flying") return;
    S.phase = "after"; S.doneAt = now + (S.says.length > 1 ? 2300 : 1300);
    const giggle = () => { if (m.gf && !m.gf.leaving) { m.gf.role = "giggle"; m.gf.roleAt = now; } };
    if (S.outcome === "hit" && target === "mimi") {   // she squeals, then giggles; he laughs, Cocoa cracks up
      this.say("mimi", S.says[0]); if (S.says[1]) this.later(1150, () => this.say("mimi", S.says[1]));
      this.later(900, () => { if (m.gf && !m.gf.leaving) { m.gf.role = "giggle"; m.gf.roleAt = performance.now(); } });
      if (thrower === "mochi") this.later(350, () => m.play("laugh", 1500));
      if (m.bud && !m.bud.leaving) { m.bud.role = "giggle"; m.bud.roleAt = now; }
    } else if (S.outcome === "hit") {
      this.ouch[target] = now;
      if (target === "mochi") m.play("surprised", 1300);
      this.say(target, S.says[0]); if (S.says[1]) this.later(1150, () => this.say(target, S.says[1]));
      if (thrower === "mochi") this.later(350, () => m.play("laugh", 1500));
      else if (m.bud) { m.bud.role = "giggle"; m.bud.roleAt = now; this.later(1600, () => { if (m.bud && m.bud.role === "giggle") { m.bud.role = "ready"; m.bud.roleAt = performance.now(); } }); }
      giggle();
    } else if (S.outcome === "block" || S.outcome === "cocky") {
      for (let i = 0; i < 3; i++) m.spawn("star", 700);
      if (target === "cocoa" && this.cItem) this.cItem.kick = 1;
      if (target === "mochi" && C.prop) C.prop.kick = 1;
      this.say(target, S.says[0]);
      if (thrower === "mochi") m.play("surprised", 1200);
      if (S.outcome === "cocky") this.later(1150, () => { this.say(target, S.says[1]); if (target === "cocoa") this.drop(false); else if (C.prop && C.prop.hold === "guard") C.letGo(false); });
    } else if (S.outcome === "splat") {
      this.say(thrower, S.says[0]);
      if (thrower === "mochi") this.later(250, () => m.play("laugh", 1500));
      giggle();
    }
    S.landedAt = at.clone();
    if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:hit", { detail: { from: thrower, at: target, outcome: S.outcome } }));
  }
  finish(now) {
    const m = this.m, S = this.cur;
    this.cur = null; this.cAnim = null;
    if (S) { this.done.push(S); if (this.done.length > 10) this.done.shift(); }   // what happened (tests)
    if (this.queue.length) return;
    // the game's over: his shield goes away after a moment, and he bounces about again
    if (this.cItem && this.cItem.kind === "shield") this.later(1500, () => { if (!this.busy()) this.drop(false); });
    if (m.bud && !m.bud.leaving && S && (S.from === "cocoa" || S.at === "cocoa")) { m.bud.role = "play"; m.bud.roleAt = now; m.bud.until = Math.max(m.bud.until, now + 5000); }
  }

  /* Cocoa's hoof: the thing in it (growing in, shrinking away, a kick when a ball bonks the shield), his arm (ready
   * with a ball, the throw, the shield up), and its facing (a shield turned to Mochi). After animateCocoa has posed him. */
  stepCocoa(now, dt) {
    const m = this.m, I = this.cItem, arm = m.cocoaArms[1];
    if (!m.bud && I) this.drop(true);
    if (I) {
      I.s = I.gone ? Math.max(0, I.s - dt * 5) : Math.min(1, I.s + dt * 6);
      I.kick = (I.kick || 0) * Math.exp(-dt * 8);
      const pop = I.gone ? I.s : 1 - Math.pow(1 - I.s, 3) * Math.cos(I.s * 5);   // a springy pop in
      I.group.scale.setScalar(Math.max(0.001, pop * (I.kind === "shield" ? 0.95 : 1.1)));
      if (I.gone && I.s <= 0) this.drop(true);
    }
    // the arm: a throw (up and back, swing through), the shield held out, or a ball ready
    let rx = -0.6, rz = 0.2, w = 0;
    const A = this.cAnim;
    if (A) {
      const u = now - A.t0;
      if (u < 300) { const k = ease(u / 300); rx = lerp(-1.0, -2.75, k); rz = lerp(0.4, 0.3, k); }
      else if (u < 480) { const k = ease((u - 300) / 180); rx = lerp(-2.75, -1.15, k); rz = lerp(0.3, 0.85, k); }
      else { const k = ease((u - 480) / 380); rx = lerp(-1.15, -0.6, k); rz = lerp(0.85, 0.2, k); }
      w = 1;
    } else if (I && !I.gone && I.kind === "shield") { rx = -1.45 - 0.25 * (I.kick || 0); rz = 0.5; w = 1; }
    else if (I && !I.gone && I.kind === "gun") { const up = this.cAim ? 1 : 0; rx = lerp(-1.05, -1.5, up) - 0.2 * (I.kick || 0); rz = lerp(0.45, 0.62, up); w = 1; }   // his water gun: ready, then up and aimed
    else if (I && !I.gone) { rx = -1.0; rz = 0.4; w = 1; }
    const k = 1 - Math.exp(-dt * 14);
    this.cArm.w += (w - this.cArm.w) * k; this.cArm.rx += (rx - this.cArm.rx) * (A ? 1 : k); this.cArm.rz += (rz - this.cArm.rz) * (A ? 1 : k);
    if (this.cArm.w > 0.002 && m.bud) { arm.rotation.x = lerp(arm.rotation.x, this.cArm.rx, this.cArm.w); arm.rotation.z = lerp(arm.rotation.z, this.cArm.rz, this.cArm.w); }
    if (A && now - A.t0 > 880) this.cAnim = null;
    // a shield faces Mochi (to Cocoa's right and a little toward you); a ball sits upright
    if (I) {
      arm.updateWorldMatrix(true, false);
      let want = I.kind === "shield" ? this.q.setFromEuler(SHIELD_E) : this.q.identity();
      if (I.kind === "gun") {   // the barrel (its +x) at Mochi: right at him when aiming, a little up and toward you when ready
        const hp = this.cHand.getWorldPosition(this.v3 || (this.v3 = new THREE.Vector3()));
        const to = this.cAim ? this.cAim.at : this.target("mochi");
        const x = (this.vx || (this.vx = new THREE.Vector3())).subVectors(to, hp).normalize();
        if (!this.cAim) { x.y += 0.25; x.z += 0.2; x.normalize(); }
        const y = (this.vy || (this.vy = new THREE.Vector3(0, 1, 0))).set(0, 1, 0).addScaledVector(x, -x.y).normalize(), z = (this.vz || (this.vz = new THREE.Vector3())).crossVectors(x, y);
        want = this.q.setFromRotationMatrix((this.mx || (this.mx = new THREE.Matrix4())).makeBasis(x, y, z));
        if (I.kick > 0.01) want.multiply((this.qk || (this.qk = new THREE.Quaternion())).setFromAxisAngle(Z_AXIS, 0.35 * I.kick));   // the kick of a squirt
      }
      this.cHand.quaternion.copy(arm.getWorldQuaternion(this.q2 || (this.q2 = new THREE.Quaternion())).invert().multiply(want));
    }
  }
  stepOuch(now, who) {   // hit: a wobble away from the throw, a squash, eyes squeezed shut for a moment
    const m = this.m, calm = m.reduce ? 0.35 : 1;
    const wob = (t0) => { const u = (now - t0) / 900; return u >= 0 && u < 1 ? Math.sin(u * Math.PI * 3) * (1 - u) * calm : 0; };
    const wm = who === "mochi" && this.ouch.mochi ? wob(this.ouch.mochi) : 0, wc = who === "cocoa" && this.ouch.cocoa ? wob(this.ouch.cocoa) : 0;
    if (wm) { m.root.rotation.z -= 0.2 * wm; m.root.position.x += 0.05 * wm; m.root.scale.y *= 1 - 0.06 * Math.abs(wm); }
    if (wc && m.bud) {
      m.cocoa.rotation.z += 0.24 * wc; m.cocoa.position.x -= 0.06 * wc; m.cocoaBody.scale.y *= 1 - 0.07 * Math.abs(wc);
      if (now - this.ouch.cocoa < 550) m.cocoaEyes.forEach((e) => { e.ball.scale.y = 0.012; e.shines.forEach((sh) => { sh.visible = false; }); });
    }
  }
}
