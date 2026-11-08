// Soft-toy throws (shared/scuffle.js, kit/src/scuffle.js, the chat route): who throws at whom from what they said, the
// shield rules (hit → ouch and a shield next time; blocked; cocky after two blocks), a grenade is a confetti ball, and in
// the kit on a stand-in body: the ball leaves the hoof, flies, lands on Cocoa's face or on his shield, and back.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { throwIntent, planThrows, newGuard, throwNote, thingFor, waterFightIntent, planWaterFight, waterFightNote } from "../../shared/scuffle.js";
import * as C from "../../shared/craft.js";
import { createServer } from "../index.js";

test("who throws at whom, from what they said", () => {
  const T = (s) => { const r = throwIntent(s, { month: 10 }); return r ? `${r.steps.map((x) => `${x.from}>${x.at}`).join(",")} ${r.thing}` : null; };
  assert.equal(T("throw a water balloon at cocoa"), "mochi>cocoa water balloon");
  assert.equal(T("Cocoa, throw a snowball at Mochi"), "cocoa>mochi snowball");
  assert.equal(T("tell cocoa to throw something at you"), "cocoa>mochi water balloon");
  assert.equal(T("can you throw a grenade at cocoa?"), "mochi>cocoa confetti ball", "a grenade is a confetti ball");
  assert.equal(T("throw a snowball at me"), "mochi>viewer snowball");
  assert.equal(T("hit cocoa with a snowball"), "mochi>cocoa snowball");
  // Mimi (Nov 7: "Throw it at mimi" waited for a tap, and Gemma said he missed her and hit Cocoa)
  assert.equal(T("Throw it at mimi"), "mochi>mimi water balloon");
  assert.equal(T("throw a snowball at Mimi"), "mochi>mimi snowball");
  assert.equal(T("hit mimi with a water balloon"), "mochi>mimi water balloon");
  assert.equal(T("can you throw a water balloon at her?"), "mochi>mimi water balloon");
  assert.equal(T("throw a rock at cocoa"), "mochi>cocoa foam ball", "nothing hard: a foam ball");
  assert.equal(T("why don't you throw a water balloon at him"), "mochi>cocoa water balloon");
  assert.equal(T("throw a bomb"), "mochi>null confetti ball", "nobody named: they tap where");
  assert.equal(T("snowball fight!"), "mochi>cocoa,cocoa>mochi,mochi>cocoa snowball");
  assert.equal(T("let's have a water balloon fight with cocoa"), "mochi>cocoa,cocoa>mochi,mochi>cocoa water balloon");
  for (const s of ["my kids had a snowball fight today", "I want to throw up", "throw it away", "my brother threw a ball at me", "don't throw anything at cocoa",
    "I'm going to throw a party", "throw it in the bin", "do you have a grenade?"]) assert.equal(T(s), null, s);
  assert.equal(thingFor("something", 11), "snowball", "a snowball in December");
  // a throw at Mimi always gets her (no shield), she squeals and giggles; the brain is told so, and a throw waiting for
  // a tap isn't described as hitting or missing anyone
  const pm = planThrows([{ from: "mochi", at: "mimi" }, { from: "mochi", at: "mimi" }], newGuard());
  assert.deepEqual(pm.plan.map((p) => p.outcome), ["hit", "hit"]); assert.equal(pm.guard.mimi, undefined, "no shield for her");
  assert.match(throwNote(pm.plan.slice(0, 1), "water balloon"), /at Mimi: SPLAT, it got her \(nobody else\)\. She squealed "Eep!"/);
  assert.match(throwNote(planThrows([{ from: "mochi", at: null }], newGuard()).plan, "water balloon"), /holding a water balloon, waiting for them to tap.*Nothing has been thrown/);
});

test("hit → ouch and a shield next time; blocked; cocky after two blocks, then hit again", () => {
  let g = newGuard();
  const outcomes = [];
  for (let i = 0; i < 5; i++) { const r = planThrows([{ from: "mochi", at: "cocoa" }], g); g = r.guard; outcomes.push(r.plan[0].outcome); }
  assert.deepEqual(outcomes, ["hit", "block", "cocky", "hit", "block"]);
  const first = planThrows([{ from: "cocoa", at: "mochi" }], newGuard()).plan[0];
  assert.equal(first.says[0], "Ouch!"); assert.match(first.says[1], /shield/i);
  const g0 = newGuard(); planThrows([{ from: "mochi", at: "cocoa" }], g0); assert.equal(g0.cocoa, 0, "the guard passed in isn't changed");
  assert.equal(planThrows([{ from: "mochi", at: "viewer" }], g0).plan[0].outcome, "splat");
  assert.equal(planThrows([{ from: "mochi", at: "mochi" }], g0).plan[0].outcome, "land", "not at himself");
  const note = throwNote(planThrows([{ from: "mochi", at: "cocoa" }, { from: "cocoa", at: "mochi" }], { cocoa: 1 }).plan, "snowball", { asked: "grenade" });
  assert.match(note, /blocked it with a shield/); assert.match(note, /Cocoa threw a snowball at you: SPLAT/); assert.match(note, /a grenade; in your world that's a snowball/);
});

test("throwables: four patterns that sit in his hoof and burst into the right thing", () => {
  for (const [name, ammo] of [["water balloon", "water"], ["snowball", "snow"], ["confetti ball", "confetti"], ["foam ball", "stars"]]) {
    const v = C.validateProp(Object.values(C.PROP_EXAMPLES).flat().find((e) => e.name === name));
    assert.equal(v.ok, true, name); assert.equal(v.recipe.archetype, "throwable"); assert.equal(v.recipe.hold, "throw"); assert.equal(v.recipe.ammo, ammo, name);
  }
  for (const [t, a] of [["grenade", "throwable"], ["water balloon", "throwable"], ["beach ball", "throwable"], ["balloon", "handheld_canopy"], ["water gun", "launcher"], ["crystal ball", "handheld_tool"]]) assert.equal(C.guessArchetype(t), a, t);
  const made = C.validateProp({ name: "glitter bomb", archetype: "throwable", ammo: "explosive", parts: [{ shape: "sphere", size: [0.3, 0.3, 0.3], at: [0, 0.15, 0], color: "#fff", material: "plastic" }] });
  assert.equal(made.recipe.ammo, "confetti", "nothing explosive comes out of it");
});

test("the chat route: throws are played at once, the brain is told how it went, and never when they're upset", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-throw-"));
  let system = "", script = {};
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1), user = [...body.messages].reverse().find((m) => m.role === "user").content;
    system = body.messages[0].content;
    const s = script[user];
    const message = last.role === "tool" ? { role: "assistant", content: "Hehe!" } : s ? { role: "assistant", content: null, tool_calls: [{ id: "t" + Math.random(), type: "function", function: { name: s[0], arguments: JSON.stringify(s[1]) } }] } : { role: "assistant", content: "Gotcha!" };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "t.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const say = async (text, extra = {}) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()), ...extra }) })).json();
  try {
    let r = await say("throw a water balloon at cocoa");
    assert.deepEqual(r.throw.steps, [{ from: "mochi", at: "cocoa" }]); assert.equal(r.throw.ball.name, "water balloon"); assert.equal(r.throw.shield.name, "toy shield");
    assert.deepEqual(r.throw.plan, ["hit"]); assert.match(system, /You threw a water balloon at Cocoa: SPLAT/); assert.equal(r.cue, null, "no other prop at the same time");
    r = await say("throw another water balloon at cocoa", { guard: { cocoa: 1 } });
    assert.deepEqual(r.throw.plan, ["block"], "the page says Cocoa has his shield ready"); assert.match(system, /blocked it with a shield/);
    r = await say("can you throw a grenade at me?");
    assert.equal(r.throw.ball.name, "confetti ball"); assert.match(system, /a grenade; in your world that's a confetti ball/);
    // the brain can start one too
    script = { "get him, cocoa!": ["throw_at", { thrower: "cocoa", target: "mochi", thing: "snowball" }], "do you have a grenade?": ["show_prop", { prop: "grenade" }] };
    r = await say("get him, cocoa!");
    const a = r.reply.actions.find((x) => x.kind === "throw");
    assert.deepEqual(a.steps, [{ from: "cocoa", at: "mochi" }]); assert.equal(a.ball.name, "snowball");
    r = await say("do you have a grenade?");
    const p = r.reply.actions.find((x) => x.kind === "prop");
    assert.equal(p.name, "confetti ball", "a grenade in his pocket is a confetti ball"); assert.equal(p.archetype, "throwable");
    // not while they're hurting
    r = await say("i want to die. throw a water balloon at cocoa");
    assert.ok(!r.throw, "a crisis line never starts a game");
  } finally { await S.close(); }
});

// ------------------------------------------------------------------ the kit, on a stand-in body
const threePath = fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url));
const have = fs.existsSync(threePath);
const THREE = have ? await import(threePath) : null;
const SC = have ? await import("../../kit/src/stagecraft.js") : null;
const SF = have ? await import("../../kit/src/scuffle.js") : null;
let NOW = 1000;
if (have) Object.defineProperty(performance, "now", { value: () => NOW, configurable: true, writable: true });
const ex = (n) => Object.values(C.PROP_EXAMPLES).flat().find((e) => e.name === n);

function fakeWorld() {
  const scene = new THREE.Scene(), root = new THREE.Group(), body = new THREE.Group(), neck = new THREE.Group(), head = new THREE.Group();
  scene.add(root); root.add(body); neck.position.set(0, 1.04, 0.04); body.add(neck); head.position.set(0, 0.54, 0.05); head.scale.setScalar(1.17); neck.add(head);
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 0.74, 0.4); a.userData.side = s; body.add(a); return a; });
  const legs = [-1, 1].map((s) => { const l = new THREE.Group(); l.position.set(s * 0.25, 0.15, 0.24); body.add(l); return l; });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true }));
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50); camera.position.set(0, 1.64, 7.6); camera.lookAt(0, 1.28, 0);
  const P = {}; for (const k of ["smile", "blush", "mouthOpen", "ear", "eyeHappy", "bed"]) P[k] = { x: 0, t: 0 };
  // Cocoa: a body with two arms, a neck and a head, on Mochi's left
  const cocoa = new THREE.Group(), cocoaBody = new THREE.Group(), cn = new THREE.Group(), cocoaHead = new THREE.Group(); cocoa.add(cocoaBody); scene.add(cocoa); cocoa.visible = false;
  cn.position.set(0, 1.02, 0.04); cocoaBody.add(cn); cocoaHead.position.set(0, 0.52, 0.05); cn.add(cocoaHead);
  cocoaHead.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8))); cocoaBody.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8))); cocoaBody.children.at(-1).position.y = 0.55;
  const cocoaArms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 0.73, 0.38); a.userData.side = s; cocoaBody.add(a); return a; });
  // Mimi: a body and a head, on Mochi's right
  const mimi = new THREE.Group(), mimiHead = new THREE.Group(); scene.add(mimi); mimi.visible = false; mimiHead.position.set(0, 1.5, 0.09); mimi.add(mimiHead);
  mimiHead.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8)));
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m = { scene, root, body, neck, head, arms, legs, ground, camera, P, r, reduce: false, mood: "idle", cur: null, curEnd: 0, queue: [], inBed: false, sulking: false, held: false, duo: { x: 0 },
    cocoa, cocoaBody, cocoaHead, cocoaArms, cocoaEyes: [], bud: null, gf: null, plays: [], mimi, mimiHead,
    spawned: [], said: [], spawn(k) { this.spawned.push(k); }, say(t) { this.said.push(t); }, touch() {}, setFace() {}, faceBase: () => 0, lastActive: 0,
    play(name, ms) { this.cur = name; this.mood = name; this.curEnd = NOW + (ms || 1500); this.plays.push(name); },
    run(steps) { this.queue = steps.slice(); this.next(); },
    next() { const s = this.queue.shift(); if (s && s[0] === "@perf") this.craft.begin(s[1]); else if (s) this.play(s[0], s[1]); else { this.cur = null; this.mood = "idle"; } },
    friend(who, role, ms) {
      if (who === "mimi") { if (!this.gf) this.gf = { t0: NOW, until: NOW + ms, leaving: false, role, roleAt: NOW, inMs: 1500 }; else this.gf.role = role; return true; }
      if (who !== "cocoa") return false; if (!this.bud) this.bud = { t0: NOW, until: NOW + ms, leaving: false, role, roleAt: NOW }; else this.bud.role = role; return true; },
    friendArrived(who) { const F = who === "mimi" ? this.gf : this.bud; return !!(F && !F.leaving && NOW - F.t0 > (F.inMs || 0)); },
    host: { getBoundingClientRect: () => ({ width: 260, height: 350, left: 0, top: 0 }) }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 374, height: 434 }) } };
  m.headHit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12)); m.headHit.scale.set(0.68, 0.66, 0.6); head.add(m.headHit);
  m.tummy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12)); m.tummy.scale.set(0.64, 0.66, 0.6); m.tummy.position.y = 0.56; body.add(m.tummy);
  m.craft = new SC.Stagecraft(m);
  m.scuffle = new SF.Scuffle(m);
  return m;
}
function frame(m, dt = 1 / 60) {
  NOW += dt * 1000;
  if (m.cur && NOW > m.curEnd) m.next();
  m.craft.pre(NOW, dt);
  m.arms.forEach((a) => a.rotation.set(-0.62, 0, a.userData.side * 0.22));
  m.neck.rotation.set(0, 0, 0); m.root.position.set(0.5, 0, 0); m.root.rotation.set(0, 0, 0); m.root.scale.setScalar(0.8); m.body.rotation.set(0, 0, 0); m.ground.scale.set(1, 1, 1);
  if (m.gf) { m.mimi.visible = true; m.mimi.position.set(1.95 - Math.min(0, -1.3 + (NOW - m.gf.t0) / 1150) * -1 + Math.min(0, -1.3 + (NOW - m.gf.t0) / 1150), 0, 0.08); m.mimi.scale.setScalar(0.74); }
  if (m.bud) { m.cocoa.visible = true; m.cocoa.position.set(-1.12 + Math.min(0, -1.7 + (NOW - m.bud.t0) / 400), 0, 0.08); m.cocoa.rotation.set(0, 0.34, 0); m.cocoa.scale.setScalar(0.8); m.cocoaArms.forEach((a) => a.rotation.set(-0.6, 0, a.userData.side * 0.2)); }
  m.scuffle.pose(NOW, dt);
  m.craft.post(NOW, NOW / 1000, dt);
  m.scuffle.step(NOW, NOW / 1000, dt);
  m.scene.updateMatrixWorld(true);
}
const run = (m, s, each) => { for (let i = 0; i < Math.round(s * 60); i++) { frame(m); if (each) each(i); } };

test("kit: Mochi throws at Cocoa: he runs in, the ball flies from the hoof to his face, ouch; next time it bounces off his shield", { skip: !have }, () => {
  const m = fakeWorld(), S = m.scuffle, c = m.craft;
  S.resetGuard();
  const r = S.fight([{ from: "mochi", at: "cocoa" }], { ball: ex("water balloon"), shield: ex("toy shield") });
  assert.deepEqual(r.plan.map((p) => p.outcome), ["hit"]); assert.ok(r.firstMs > 2500, "Cocoa has to run in first");
  let flewFrom = null, peak = -Infinity, sawToss = false;
  run(m, 6, () => {
    if (c.toss) sawToss = true;
    if (c.flights.length) { const p = c.flights[0].pivot.position; if (!flewFrom) flewFrom = p.clone(); peak = Math.max(peak, p.y); }
  });
  assert.ok(m.bud, "Cocoa came"); assert.ok(sawToss, "Mochi wound up and threw");
  assert.equal(c.prop.recipe.name, "water balloon"); assert.ok(c.prop.scale.x > 0.9, "a new one in his hoof");
  const done = S.done.at(-1);
  assert.equal(done.outcome, "hit");
  assert.ok(flewFrom.x > 0, "it left from his hoof, on the right"); assert.ok(done.landedAt.x < -0.6, "and landed on Cocoa, on the left");
  assert.ok(peak > Math.max(flewFrom.y, done.landedAt.y) + 0.1, "in an arc");
  assert.deepEqual(S.heard.slice(0, 2), [["cocoa", "Ouch!"], ["cocoa", "Shield next time!"]]);
  assert.ok(m.plays.includes("laugh"), "Mochi laughs"); assert.equal(S.guard.cocoa, 1, "Cocoa keeps a shield ready");
  // again: Cocoa holds up his shield, the ball lands on it
  S.fight([{ from: "mochi", at: "cocoa" }], { ball: ex("water balloon"), shield: ex("toy shield") });
  let shieldAt = null;
  run(m, 4, () => { if (S.cItem && S.cItem.kind === "shield" && c.flights.length) shieldAt = S.center(S.cItem.group); });
  const d2 = S.done.at(-1);
  assert.equal(d2.outcome, "block"); assert.ok(shieldAt, "his shield was up while it flew");
  assert.ok(d2.landedAt.distanceTo(shieldAt) < 0.05, `it hit the shield (${d2.landedAt.distanceTo(shieldAt).toFixed(2)} away)`);
  assert.equal(S.heard.at(-1)[0], "cocoa"); assert.match(S.heard.at(-1)[1], /Blocked|Missed|Nope/);
});

test("kit: Mochi throws at Mimi (Nov 7): she walks in, it flies to her face and gets her, she squeals then giggles, no shield next time", { skip: !have }, () => {
  const m = fakeWorld(), S = m.scuffle, c = m.craft;
  S.resetGuard();
  const r = S.fight([{ from: "mochi", at: "mimi" }], { ball: ex("water balloon"), shield: ex("toy shield") });
  assert.deepEqual(r.plan.map((p) => p.outcome), ["hit"]); assert.ok(r.firstMs > 3000, "Mimi has to walk in first");
  let flewFrom = null, thrownAt = null;
  run(m, 8, () => { if (c.flights.length) { const p = c.flights[0].pivot.position; if (!flewFrom) { flewFrom = p.clone(); thrownAt = NOW; } } });
  assert.ok(m.gf, "Mimi came"); assert.ok(thrownAt - m.gf.t0 >= 1500, "thrown only once she'd arrived");
  const done = S.done.at(-1);
  assert.equal(done.outcome, "hit"); assert.equal(done.at, "mimi");
  assert.ok(done.landedAt.x > 1.2, `it landed on Mimi, on the right (${done.landedAt.x.toFixed(2)})`);
  assert.ok(done.landedAt.distanceTo(S.mimiTarget()) < 0.05, "right on her face");
  assert.deepEqual(S.heard.slice(0, 2).map((h) => h[0]), ["mimi", "mimi"]); assert.match(S.heard[0][1], /Eep|Kyaa/);
  assert.ok(m.plays.includes("laugh"), "Mochi laughs"); assert.equal(m.gf.role, "giggle", "she giggles");
  assert.equal(S.guard.mimi, undefined, "she doesn't learn a shield");
  assert.ok(!S.cItem, "nothing in Cocoa's hoof: he wasn't in it");
});

test("kit: Cocoa throws a snowball at Mochi: ouch; next time Mochi turns to him with a shield and blocks it", { skip: !have }, () => {
  const m = fakeWorld(), S = m.scuffle, c = m.craft;
  S.resetGuard();
  S.fight([{ from: "cocoa", at: "mochi" }], { ball: ex("snowball"), shield: ex("toy shield") });
  let ballInCocoasHoof = false, from = null;
  run(m, 6, () => { if (S.cItem && S.cItem.kind === "ball") ballInCocoasHoof = true; if (c.flights.length && !from) from = c.flights[0].pivot.position.clone(); });
  assert.ok(ballInCocoasHoof, "Cocoa took a snowball"); assert.ok(from && from.x < -0.5, "thrown from Cocoa's hoof");
  const d = S.done.at(-1);
  assert.equal(d.outcome, "hit"); assert.ok(d.landedAt.x > 0, "it got Mochi"); assert.equal(m.said[0], "Ouch!"); assert.ok(m.plays.includes("surprised"));
  S.fight([{ from: "cocoa", at: "mochi" }], { ball: ex("snowball"), shield: ex("toy shield") });
  let guarded = false, turned = 0;
  run(m, 4, () => { if (c.prop && c.prop.hold === "guard") { guarded = true; turned = Math.min(turned, c.aimTurn.x); } });
  assert.ok(guarded, "his shield was up"); assert.ok(turned < -0.2, "he turned to face Cocoa");
  assert.equal(S.done.at(-1).outcome, "block");
});

test("kit: a throw at the viewer splats on the glass; tapping a held ball throws it at you; Cocoa away and sulking → nothing", { skip: !have }, () => {
  const m = fakeWorld(), S = m.scuffle, c = m.craft;
  c.hold(ex("confetti ball"), { quiet: true, ms: 30000 }); run(m, 0.6);
  assert.deepEqual([c.isThrowable(), c.canAim(), c.holding().throwable, c.holding().aims], [true, true, true, true]);
  const spot = new THREE.Vector3(1.2, 0.3, 0.6);
  let landed = null; c.throwAt(spot, { onLand: (p) => (landed = p) });
  run(m, 2);
  assert.ok(landed && landed.distanceTo(spot) < 0.01, "lands where it was thrown"); assert.ok(c.ammo.length > 0 || c.marks.length > 0, "and bursts there");
  let viewer = null; c.flights.length = 0;
  assert.equal(c.useProp(), true, "a tap on the ball");
  run(m, 0.5, () => { if (c.flights.length) viewer = c.flights[0]; });
  assert.ok(viewer && viewer.viewer, "throws it at you");
  m.sulking = true;
  assert.equal(S.fight([{ from: "mochi", at: "cocoa" }]).ok, false, "no games while he sulks");
});

test("a water fight with Cocoa (Nov 4: \"have a water gun fight with cocoa\" only fired once into the air)", async () => {
  for (const t of ["have a water gun fight with cocoa", "water fight!", "let's have a water pistol battle", "squirt each other", "can you and cocoa have a water blaster war?", "water gun game!"]) assert.ok(waterFightIntent(t), t);
  for (const t of ["water balloon fight", "we had a water fight yesterday", "stop the water fight", "let's play with the water gun", "throw a snowball at cocoa"]) assert.equal(waterFightIntent(t), null, t);
  assert.equal(waterFightIntent("cocoa, start a water fight").starter, "cocoa");
  for (let k = 1; k < 40; k++) {   // whatever the dice: turns taken, both get wet, a truce
    let sd = k; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const f = planWaterFight({ rnd, starter: k % 3 ? "mochi" : "cocoa" });
    assert.ok(f.shots.length >= 4 && f.shots.length <= 6);
    f.shots.forEach((x, i) => { assert.notEqual(x.from, x.at); if (i) assert.equal(x.from, f.shots[i - 1].at, "they take turns"); });
    assert.ok(f.wet.mochi >= 1 && f.wet.cocoa >= 1, "both get wet");
    for (let i = 1; i < f.shots.length; i++) if (f.shots[i].at === f.shots[i - 1].at && f.shots[i].outcome === f.shots[i - 1].outcome) assert.notEqual(f.shots[i].says, f.shots[i - 1].says);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-wet-"));
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    system = JSON.parse(init.body).messages[0].content;
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "You're on! *fires his water blaster*" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "w.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const say = async (text) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json();
  try {
    const r = await say("have a water gun fight with cocoa");
    assert.ok(r.water && r.water.fight.shots.length >= 4); assert.equal(r.water.gun.name, "water pistol"); assert.equal(r.water.cocoaGun.name, "water pistol");
    assert.equal(r.throw, null); assert.equal(r.cue, null);
    assert.match(system, /a water fight with Cocoa!/); assert.match(system, /don't write lines for him/);
    assert.ok(!(r.reply.actions || []).some((a) => a.kind === "prop" && a.archetype === "launcher"), "the fight has its own guns");
    assert.equal(S.memory.get("waterfights", null).n, 1);
    // and later he wants another one: Cocoa sneaks up with his water gun (or Mochi starts it)
    const st = S.memory.get("story", null) || {}; S.memory.set("story", { ...st, wants: [], pausedUntil: 0 });
    const story = (await import("../story.js")).makeStory({ memory: S.memory, log: { warn() {}, log() {} } });
    let b = null; for (let i = 0; i < 6 && !(b && b.kind === "waterfight"); i++) b = await story.pickBeat();
    assert.ok(b && b.kind === "waterfight", `a water fight beat: ${b && b.kind}`); assert.ok(b.fight.shots.length >= 4 && b.gun && b.cocoaGun);
  } finally { await S.close(); }
});

test("kit: a water fight: Cocoa's own water gun aimed at Mochi, turns taken, a dodge splashes where he was, a truce", { skip: !have }, () => {
  const m = fakeWorld(), S = m.scuffle, c = m.craft;
  const fight = { starter: "mochi", start: ["Bring it!"], truce: { mochi: "Okay, okay, truce!", cocoa: "Truce! …for now, bro." },
    shots: [{ from: "mochi", at: "cocoa", outcome: "hit", says: "Hey! I'm soaked!" }, { from: "cocoa", at: "mochi", outcome: "dodge", says: "Whoa! Missed!" }, { from: "mochi", at: "cocoa", outcome: "dodge", says: "Too slow, dude!" }, { from: "cocoa", at: "mochi", outcome: "hit", says: "Eep! Cold!" }] };
  const r = S.waterFight(fight, { gun: ex("water pistol") });
  assert.ok(r.ok && r.ms > 10000);
  let gunAim = -1, mLo = 0, mHi = 0, cLo = 0, cHi = 0, gunSeen = false;
  run(m, 22, () => {
    if (S.cItem && S.cItem.kind === "gun") {
      gunSeen = true;
      if (S.cAim) {   // his barrel (+x) points at Mochi while he aims
        S.cItem.group.updateWorldMatrix(true, false);
        const x = new THREE.Vector3(1, 0, 0).transformDirection(S.cItem.group.matrixWorld), from = S.cItem.group.getWorldPosition(new THREE.Vector3());
        gunAim = Math.max(gunAim, x.dot(S.cAim.at.clone().sub(from).normalize()));
      }
    }
    mLo = Math.min(mLo, c.stance.pos.x); mHi = Math.max(mHi, c.stance.pos.x);
    if (m.bud && S.wf && S.wf.cBase !== undefined) { cLo = Math.min(cLo, (m.bud.fx || 0) - S.wf.cBase); cHi = Math.max(cHi, (m.bud.fx || 0) - S.wf.cBase); }
  });
  assert.ok(gunSeen, "Cocoa had his own water gun"); assert.ok(gunAim > 0.95, `aimed at Mochi (${gunAim.toFixed(2)})`);
  assert.ok(mHi - mLo > 0.3, `Mochi stepped aside to dodge (${mLo.toFixed(2)}…${mHi.toFixed(2)})`); assert.ok(cHi - cLo > 0.3, "and Cocoa ran a few steps");
  assert.equal(S.wf, null, "it's over"); assert.equal(c.stance.needs.has("waterfight"), false);
  const said = S.heard.map((h) => h.join(": "));
  for (const l of ["cocoa: Hey! I'm soaked!", "mochi: Whoa! Missed!", "cocoa: Too slow, dude!", "mochi: Eep! Cold!", "mochi: Okay, okay, truce!", "cocoa: Truce! …for now, bro."]) assert.ok(said.includes(l), l);
  assert.ok(S.ouch.cocoa > 0 && S.ouch.mochi > 0, "both got wet");
});
