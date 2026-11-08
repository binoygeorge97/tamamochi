// Rides (a bicycle, a tricycle, a skateboard) and taught prop uses: the patterns, "ride your bike" in chat, and in the
// kit on a stand-in body: he sits on the seat (or stands on the board), rides across and back with the wheels rolling
// and his legs pedalling; posing with a prop in his hoof becomes the way he uses it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as C from "../../shared/craft.js";
import { createServer } from "../index.js";
import { rideIntent } from "../brain.js";

const ex = (n) => Object.values(C.PROP_EXAMPLES).flat().find((e) => e.name === n);

test("ride patterns: where he sits, how he rides, what turns", () => {
  for (const [name, kind, seatY] of [["bicycle", "pedal", 0.62], ["tricycle", "pedal", 0.585], ["skateboard", "board", 0.185]]) {
    const v = C.validateProp(ex(name));
    assert.equal(v.ok, true, name); assert.deepEqual(v.warnings, [], `${name} needs no repairs`);
    assert.equal(v.recipe.archetype, "ride"); assert.equal(v.recipe.rideKind, kind, name); assert.ok(Math.abs(v.recipe.seat[1] - seatY) < 0.02, `${name} seat ${v.recipe.seat}`);
    assert.ok(v.recipe.parts.filter((p) => C.RIDE_WHEEL.test(p.label)).length >= (name === "tricycle" ? 3 : 2), `${name} has labelled wheels`);
    const lo = Math.min(...v.recipe.parts.map((p) => C.partBounds(p).lo[1]));
    assert.ok(Math.abs(lo) < 0.01, `${name} stands on the ground`);
  }
  for (const [t, a] of [["bike", "ride"], ["a tricycle", "ride"], ["skateboard", "ride"], ["scooter", "ride"], ["toy car", "companion"]]) assert.equal(C.guessArchetype(t), a, t);
  const made = C.validateProp({ name: "unicycle", archetype: "ride", parts: [{ shape: "torus", size: [0.6, 0.6, 0.08], at: [0, 0.5, 0], color: "#333", material: "rubber", label: "wheel" }, { shape: "capsule", size: [0.15, 0.3, 0.2], at: [0, 1.0, 0], rotate: [0, 0, 90], color: "#e33", material: "cloth", label: "seat" }] });
  assert.equal(made.recipe.parts[0].at[1], 0.3, "moved down onto the ground"); assert.equal(made.recipe.rideKind, "sit");
  assert.equal(made.recipe.seat[1], C.partBounds(made.recipe.parts[1]).hi[1], "he sits on top of the seat (glued down onto the wheel)");
});

test("'ride your bike' in chat: which ride, and not when it's about someone else's bike", () => {
  const W = (t) => (rideIntent(t) || {}).name || null;
  assert.equal(W("ride your bike"), "bicycle"); assert.equal(W("can you ride a tricycle?"), "tricycle"); assert.equal(W("let's go skateboarding!"), "skateboard");
  assert.equal(W("go for a ride!"), "bicycle"); assert.equal(W("do a lap on your trike"), "tricycle");
  for (const t of ["I rode my bike to work", "my son rides his bike", "don't ride the bike", "show me your skateboard", "what a ride today"]) assert.equal(W(t), null, t);
  assert.equal(rideIntent("ride your scooter", [{ name: "zippy blue scooter", archetype: "ride" }]).name, "zippy blue scooter", "his own one first");
});

test("chat: he hops on and rides; use_prop rides; a taught use plays when he uses the prop; teach_use goes to the workbench", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-ride-"));
  let system = "", script = {};
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1), user = [...body.messages].reverse().find((m) => m.role === "user").content;
    system = body.messages[0].content;
    const s = script[user];
    const message = last.role === "tool" ? { role: "assistant", content: "Wheee!" } : s ? { role: "assistant", content: null, tool_calls: [{ id: "t" + Math.random(), type: "function", function: { name: s[0], arguments: JSON.stringify(s[1]) } }] } : { role: "assistant", content: "Wheee!" };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "r.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const base = `http://127.0.0.1:${S.port}`;
  const say = async (text, extra = {}) => (await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()), ...extra }) })).json();
  try {
    let r = await say("ride your bike!");
    assert.equal(r.ride.name, "bicycle"); assert.equal(r.ride.archetype, "ride"); assert.ok(r.ride.recipe.parts.length > 10);
    assert.match(system, /hopped on your bicycle/); assert.equal(r.cue, null);
    script = { "take the trike out": ["use_prop", { prop: "trike" }] };
    r = await say("take the trike out");
    const a = r.reply.actions.find((x) => x.kind === "prop");
    assert.equal(a.name, "tricycle"); assert.equal(a.use, "ride");
    // posed with the globe in his hoof: saved as the way he uses it (the globe goes on his shelf)
    const recipe = { name: "globe spin", duration: 1.5, prop: "handheld_tool", tracks: { "rightArm.raise": [[0, 0], [0.5, 0.6], [1.5, 0]], "prop.spin": [[0, 0], [1.2, 1], [1.5, 1]] } };
    const saved = await (await fetch(`${base}/api/moves`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "globe spin", recipe, forProp: { name: "desk globe", archetype: "handheld_tool" } }) })).json();
    assert.equal(saved.linked, "desk globe");
    const room = await (await fetch(`${base}/api/room`)).json(), globe = room.props.find((p) => p.name === "desk globe");
    assert.ok(globe && globe.useMove === saved.id, "the shelf knows how he uses it");
    script = { "spin your globe": ["use_prop", { prop: "globe" }], "when you use the umbrella, twirl it and jump": ["teach_use", { prop: "umbrella", how: "twirl it and jump", name: "umbrella hop" }] };
    r = await say("spin your globe");
    const mv = r.reply.actions.find((x) => x.kind === "move");
    assert.equal(mv.name, "globe spin"); assert.equal(mv.prop.name, "desk globe"); assert.ok(mv.recipe.tracks["prop.spin"]);
    assert.match(system, /How they taught you to use your props.*desk globe → globe spin/);
    r = await say("when you use the umbrella, twirl it and jump");
    const job = S.memory.queue().find((j) => j.kind === "move");
    assert.match(job.request, /^umbrella hop: twirl it and jump, holding the little blue umbrella \[for: little blue umbrella\]$/);
  } finally { await S.close(); }
});

// ------------------------------------------------------------------ the kit, on a stand-in body
const threePath = fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url));
const have = fs.existsSync(threePath);
const THREE = have ? await import(threePath) : null;
const SC = have ? await import("../../kit/src/stagecraft.js") : null;
let NOW = 50000;
if (have) Object.defineProperty(performance, "now", { value: () => NOW, configurable: true, writable: true });
function fakeMochi() {
  const scene = new THREE.Scene(), root = new THREE.Group(), body = new THREE.Group(), neck = new THREE.Group(), head = new THREE.Group();
  scene.add(root); root.add(body); neck.position.set(0, 1.04, 0.04); body.add(neck); head.position.set(0, 0.54, 0.05); head.scale.setScalar(1.17); neck.add(head);
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 0.74, 0.4); a.userData.side = s; body.add(a); return a; });
  const legs = [-1, 1].map((s) => { const l = new THREE.Group(); l.position.set(s * 0.25, 0.15, 0.24); body.add(l); return l; });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true }));
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50); camera.position.set(0, 1.64, 7.6); camera.lookAt(0, 1.28, 0);
  const P = {}; for (const k of ["smile", "blush", "mouthOpen", "ear", "eyeHappy", "bed"]) P[k] = { x: 0, t: 0 };
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m = { scene, root, body, neck, head, arms, legs, ground, camera, P, r, reduce: false, mood: "idle", cur: null, curEnd: 0, queue: [], inBed: false, sulking: false, held: false, duo: { x: 0 },
    spawned: [], said: [], spawn(k) { this.spawned.push(k); }, say(t) { this.said.push(t); }, touch() {}, setFace() {}, faceBase: () => 0, lastActive: 0,
    play(name, ms) { this.cur = name; this.mood = name; this.curEnd = NOW + (ms || 1500); },
    run(steps) { this.queue = steps.slice(); this.next(); },
    next() { const s = this.queue.shift(); if (s && s[0] === "@perf") this.craft.begin(s[1]); else if (s) this.play(s[0], s[1]); else { this.cur = null; this.mood = "idle"; } },
    host: { getBoundingClientRect: () => ({ width: 260, height: 350, left: 0, top: 0 }) }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 374, height: 434 }) } };
  m.headHit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12)); m.headHit.scale.set(0.68, 0.66, 0.6); head.add(m.headHit);
  m.tummy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12)); m.tummy.scale.set(0.64, 0.66, 0.6); m.tummy.position.y = 0.56; body.add(m.tummy);
  m.craft = new SC.Stagecraft(m);
  return m;
}
function frame(m, dt = 1 / 60) {
  NOW += dt * 1000;
  if (m.cur && NOW > m.curEnd) m.next();
  m.craft.pre(NOW, dt);
  m.arms.forEach((a) => a.rotation.set(-0.62, 0, a.userData.side * 0.22));
  m.legs.forEach((l) => l.rotation.set(-Math.PI / 2 + 0.18, 0, 0));
  m.neck.rotation.set(0, 0, 0); m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0); m.root.scale.setScalar(1); m.body.rotation.set(0, 0, 0); m.ground.scale.set(1, 1, 1); m.ground.position.set(0, 0, 0); m.ground.material.opacity = 1;
  m.craft.post(NOW, NOW / 1000, dt);
  m.scene.updateMatrixWorld(true);
}
const run = (m, s, each) => { for (let i = 0; i < Math.round(s * 60); i++) { frame(m); if (each) each(i); } };

test("kit: on the bike he sits on the seat, rides right, U-turns toward you, rides left and comes home; wheels roll, legs pedal", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  const r = c.hold(ex("bicycle"), { quiet: true, ms: 30000 });
  assert.equal(r.ok, true); assert.equal(r.slot, "ride"); assert.equal(c.holding().ride, true);
  run(m, 1.2);
  const seat = c.prop.recipe.seat, s = m.root.scale.x;
  assert.ok(s < 0.85, "a touch smaller on it");
  assert.ok(Math.abs(m.root.position.y - (seat[1] - 0.02) * s) < 0.02, `sits on the seat (${m.root.position.y.toFixed(3)})`);
  const seatW = new THREE.Vector3(...seat).applyMatrix4(c.prop.group.matrixWorld);
  assert.ok(Math.hypot(seatW.x - m.root.position.x, seatW.z - m.root.position.z) < 0.02, "the seat is right under him");
  assert.ok(m.root.rotation.y > 0.3, "parked, turned to show the bike off");
  const wheel = []; c.prop.group.traverse((o) => { if (o.isMesh && /wheel/.test(o.userData.label)) wheel.push(o); });
  const q0 = wheel[0].quaternion.clone(), legs = [];
  assert.equal(c.useProp(), true, "a tap: off he goes");
  let maxX = -9, minX = 9, faced = 0, turnedToYou = false;
  run(m, 3.0, () => { maxX = Math.max(maxX, m.root.position.x); legs.push(m.legs[0].rotation.x); if (Math.abs(m.root.rotation.y) < 0.15 && m.root.position.z > 0.08) turnedToYou = true; faced = Math.max(faced, m.root.rotation.y); });
  assert.ok(maxX > 1.0, `rode right (${maxX.toFixed(2)})`); assert.ok(faced > 0.7, "facing where he goes");
  assert.ok(turnedToYou, "U-turned toward you");
  assert.ok(wheel[0].quaternion.angleTo(q0) > 0.3, "the wheels rolled");
  assert.ok(Math.max(...legs) - Math.min(...legs) > 0.4, "his legs pedalled");
  run(m, 6.5, () => { minX = Math.min(minX, m.root.position.x); });
  assert.ok(minX < -1.0, `rode left (${minX.toFixed(2)})`);
  assert.ok(Math.abs(m.root.position.x) < 0.02 && !c.rider.trip, "and came home");
  c.letGo(false); run(m, 1.5);
  assert.ok(Math.abs(m.root.position.y) < 0.01 && Math.abs(m.root.scale.x - 1) < 0.01, "off the bike, back on the ground");
});

test("kit: on the skateboard he stands with his arms out, pushes off, and the board pops up with him at each end", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.hold(ex("skateboard"), { quiet: true, ms: 30000 }); run(m, 1.2);
  assert.ok(Math.abs(m.legs[0].rotation.x) < 0.2, "standing, legs down"); assert.ok(m.arms[1].rotation.z > 1.2, "arms out for balance");
  assert.ok(Math.abs(m.root.rotation.y) < 0.2, "facing you");
  c.useProp();
  let maxBoard = 0, pushed = false;
  run(m, 7.5, () => { maxBoard = Math.max(maxBoard, c.rider.mount.position.y); if (m.legs[1].rotation.x < -0.3) pushed = true; });
  assert.ok(pushed, "pushed off with one hoof"); assert.ok(maxBoard > 0.15, `an ollie (${maxBoard.toFixed(2)})`);
});

test("kit: posing with the globe in his hoof: drag it to turn it; saved, that's how he uses it", { skip: !have }, () => {
  const m = fakeMochi(), c = m.craft;
  c.hold(ex("desk globe"), { quiet: true, ms: 30000 }); run(m, 0.6);
  c.poseStart();
  assert.ok(c.anchors().some(([p]) => p === "prop"), "the globe has a handle");
  c.poseSet("rightArm.raise", 0.5); run(m, 0.4); c.poseSet("prop.spin", 1); run(m, 0.8); c.poseSet("rightArm.raise", 0); run(m, 0.4);
  const out = c.poseDone("globe spin", { playBack: false });
  assert.equal(out.ok, true); assert.ok(out.recipe.tracks["prop.spin"], "the turn is in the move"); assert.equal(out.recipe.tracks["prop.spin"].at(-1)[1], 1, "ends on a whole turn");
  assert.equal(out.forProp.name, "desk globe");
  assert.equal(c.teachUse("desk globe", { id: 7, name: "globe spin", recipe: out.recipe, skill: 0.5 }), true);
  run(m, 0.5);
  assert.equal(c.useProp(), true);
  run(m, 0.6);
  assert.equal(c.perf && c.perf.name, "globe spin", "using it plays what you taught"); assert.equal(c.prop.recipe.name, "desk globe", "with the globe still in his hoof");
});

test("cars (Nov 3): a car is a ride he sits in and drives, a friend rides in the back, an old toy car becomes one", async () => {
  const car = C.validateProp(ex("car"));
  assert.ok(car.ok, JSON.stringify(car.errors)); assert.equal(car.recipe.rideKind, "drive");
  assert.ok(car.recipe.seat[1] < 0.7, "his seat is down inside the car"); assert.ok(car.recipe.passenger, "a back seat");
  assert.ok(Math.max(...C.propBounds(car.recipe.parts).size) > 2.6, "big enough to sit in, not shrunk");
  assert.equal(C.guessArchetype("a red car"), "ride"); assert.equal(C.guessArchetype("a tiny toy car"), "companion");
  assert.deepEqual(rideIntent("pick up Mimi in your car"), { name: "car", owned: false, passenger: "mimi" });
  assert.equal(rideIntent("let's go for a drive").name, "car");
  assert.equal(rideIntent("I drove my car to school"), null, "their car, not his");
  // a server with an old "car" that sat beside him: it's rebuilt as a car he can drive, and Cocoa gets a ride
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-car-"));
  const { openMemory } = await import("../memory.js");
  const mem = openMemory(path.join(dir, "c.sqlite"));
  const old = { name: "car", archetype: "companion", parts: [{ shape: "box", size: [1.4, 0.6, 0.8], at: [0, 0.4, 0], color: "#2f7de1", material: "plastic" }, { shape: "cylinder", size: [0.3, 0.1, 0.3], at: [0.4, 0.15, 0.4], rotate: [90, 0, 0], color: "#222222", material: "rubber" }] };
  mem.addProp({ name: "car", archetype: "companion", recipe: old, origin: "you asked for it", source: "user" }); mem.close();
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    system = JSON.parse(init.body).messages[0].content;
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Vroom!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "c.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    const p = S.memory ? S.memory.props()[0] : null;
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "give Cocoa a ride in your car", id: "c1" }) })).json();
    assert.equal(r.ride.name, "car"); assert.equal(r.ride.drive, true); assert.equal(r.ride.passenger, "cocoa"); assert.equal(r.ride.helmet, null);
    assert.equal(C.validateProp(r.ride.recipe).recipe.rideKind, "drive");
    assert.ok(r.ride.recipe.parts.some((q) => q.color === "#2f7de1"), "kept its own colour");
    assert.match(system, /driving it across the stage and back with him/);
    if (p) assert.equal(p.archetype, "ride");
  } finally { await S.close(); }
});
