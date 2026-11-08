// Vehicles (Nov 4, Binoy: "the rocketship mochi made looks terrible. I wonder why pip passed it. can you make it
// better? also give it better building blocks and instructions to help it make future vehicle requests like a ship
// or helicopter etc."). On the M5 "rocket ship: a shiny silver rocket with big colorful fins" was filed as a launcher,
// "rocket" picked the big confetti rocket launcher pattern as it was, Pip saw "a toy rocket" (true enough: it is one)
// and it passed; the fix ("instead of a launcher") kept it a launcher and nobody tested it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeCrafter, findPattern, patternRecipe } from "../crafter.js";
import { createServer } from "../index.js";
import { propIntent } from "../brain.js";
import { PROP_EXAMPLES, validateProp, propBounds, BIG_LAUNCHER, VEHICLE, vehicleGuide } from "../../shared/craft.js";
import { VEHICLES } from "../../shared/pocket-vehicles.js";

function fakeLLM(script) {
  const used = {}, calls = [];
  return {
    calls, model: "fake", structured: true, vision: true,
    async chat(o) {
      calls.push(o);
      const list = script[o.what] || []; const i = used[o.what] = (used[o.what] ?? -1) + 1;
      let a = list[Math.min(i, list.length - 1)]; if (typeof a === "function") a = await a(o, i);
      if (a === undefined) throw new Error(`no scripted answer for ${o.what}`);
      const text = typeof a === "string" ? a : JSON.stringify(a); let json = null; try { json = JSON.parse(text); } catch (_) { /* text */ }
      return { text, json: o.schema ? json : null, ms: 2, usage: { completion_tokens: 50 }, finish: "stop" };
    },
  };
}
const fakeRenderer = { async render(recipe) { return { ok: true, png: Buffer.from(`png:${recipe.name}`), dataUrl: "data:image/png;base64,AAAA", ms: 3 }; } };
const ex = (n) => PROP_EXAMPLES.ride.find((e) => e.name === n);

test("the vehicle patterns: clean, his size, a seat sunk in, and what makes each one move", () => {
  const want = { "rocket ship": "fly", airplane: "fly", helicopter: "fly", sailboat: "sail", ship: "sail", submarine: "sail", train: "drive", "pirate ship": "sail", speedboat: "sail" };
  for (const e of VEHICLES.ride) {
    const v = validateProp(e);
    assert.ok(v.ok, `${e.name}: ${v.errors}`); assert.deepEqual(v.warnings, [], `${e.name} as it is`);
    assert.equal(v.recipe.rideKind, want[e.name], `${e.name} ${want[e.name]}s`);
    const B = propBounds(v.recipe.parts); assert.ok(Math.max(...B.size) <= 3.0 && Math.max(...B.size) > 2.3, `${e.name} is ride-sized: ${B.size}`);
    assert.ok(v.recipe.seat[1] > 0.4 && v.recipe.seat[1] < 1.2, `${e.name}: a seat he sits down into (${v.recipe.seat})`);
    const lab = v.recipe.parts.map((p) => p.label || "");
    if (want[e.name] === "fly") assert.ok(lab.some((l) => /propeller|rotor|flame/.test(l)), `${e.name}: something turns or burns`);
    if (want[e.name] === "sail") assert.ok(lab.includes("water"), `${e.name} sits in its water`);
    if (want[e.name] === "drive") assert.ok(lab.filter((l) => l === "wheel").length >= 4, `${e.name} has wheels`);
  }
  // his old rides are still what they were
  assert.equal(validateProp(ex("car")).recipe.rideKind, "drive"); assert.equal(validateProp(ex("bicycle")).recipe.rideKind, "pedal");
});

test("other names find them; a rocket launcher is still the launcher, and a rocket ship never is", () => {
  const P = (n, r = n, a = "ride") => { const p = findPattern(a, n, r); return p ? `${p.example.name}/${p.mode}` : null; };
  assert.equal(P("rocket ship", "rocket ship: a shiny silver rocket with big colorful fins"), "rocket ship/base");
  assert.equal(findPattern("ride", "rocket ship", "rocket ship: a shiny silver rocket with big colorful fins").colour, "#c9ced6", "silver, as asked");
  assert.equal(P("spaceship"), "rocket ship/base"); assert.equal(P("space rocket"), "rocket ship/base");
  assert.equal(P("plane"), "airplane/base"); assert.equal(P("jet plane"), "airplane/adapt");
  assert.equal(P("chopper"), "helicopter/base"); assert.equal(P("toy boat"), "sailboat/base"); assert.equal(P("pirate ship"), "pirate ship/base");
  assert.equal(P("galleon"), "pirate ship/base"); assert.equal(P("motor boat"), "speedboat/base"); assert.equal(P("steamboat"), "ship/base"); assert.equal(P("yellow submarine"), "submarine/base"); assert.equal(P("choo choo train"), "train/base");
  assert.equal(P("rocket launcher", "rocket launcher", "launcher"), "big confetti rocket launcher/base");
  for (const t of ["rocket ship", "a spaceship", "the rocket-ship", "rocketship"]) assert.ok(!BIG_LAUNCHER.test(t), t);
  assert.ok(BIG_LAUNCHER.test("a rocket launcher") && BIG_LAUNCHER.test("bazooka"));
  assert.ok(VEHICLE.test("a pirate ship") && VEHICLE.test("helicopter") && !VEHICLE.test("a friendship bracelet") && !VEHICLE.test("a planet"));
  assert.match(vehicleGuide("pirate ship"), /A boat sits in its "water"/); assert.match(vehicleGuide("a jet"), /A plane:/); assert.equal(vehicleGuide("bicycle"), null);
});

test("the M5's rocket ship: filed as a launcher, it's made as a ride, from the rocket pattern, and Pip looks", async () => {
  const llm = fakeLLM({ classify: [{ archetype: "launcher", name: "rocket ship", kind: "prop" }], look: [{ guess: "a toy rocket ship", confidence: 0.9 }] });
  const C = makeCrafter({ llm, renderer: fakeRenderer, log: { warn() {}, log() {} } });
  const r = await C.craftProp({ request: "rocket ship: a shiny silver rocket with big colorful fins", context: "where is the rocket?" });
  assert.ok(r.ok); assert.equal(r.archetype, "ride"); assert.equal(r.pattern.name, "rocket ship");
  assert.ok(r.recipe.parts.some((p) => p.label === "nose cone") && r.recipe.parts.some((p) => p.label === "flame"));
  assert.equal(r.recipe.rideKind, "fly"); assert.equal(r.matched, true);
  // a toy one to hold stays what the classifier said
  const t = await makeCrafter({ llm: fakeLLM({ classify: [{ archetype: "handheld_tool", name: "toy rocket", kind: "prop" }], recipe: [{ plan: "x", name: "toy rocket", parts: [{ shape: "cone", size: [0.3, 0.5, 0.3], at: [0, 0.3, 0], color: "#ff0000", material: "plastic" }] }], look: [{ guess: "a toy rocket", confidence: 0.9 }] }), renderer: fakeRenderer, log: { warn() {} } }).craftProp({ request: "a toy rocket to hold", context: "can you hold a toy rocket" });
  assert.equal(t.archetype, "handheld_tool");
  // a jet (no pattern of its own): Gemma designs it, told how vehicles are built, with the plane and the rocket to go by
  let sys = "", usr = "";
  const j = await makeCrafter({ llm: fakeLLM({ classify: [{ archetype: "ride", name: "jet", kind: "prop" }], recipe: [(o) => { sys = o.system; usr = o.user; return { plan: "a jet", name: "jet", parts: ex("airplane").parts }; }], look: [{ guess: "a toy airplane", confidence: 0.9 }], same: [{ same: true }] }), renderer: fakeRenderer, log: { warn() {} } }).craftProp({ request: "a jet" });
  assert.ok(j.ok); assert.match(sys, /Building a vehicle for Mochi/); assert.match(sys, /use 12 to 30 parts/); assert.match(usr, /"airplane"/); assert.match(usr, /"rocket ship"/); assert.doesNotMatch(usr, /"bicycle"/);
});

test("a fix: a vehicle made as something else is made again as a ride; any other fix is tested by Pip, and tried again if he doesn't know it", async () => {
  const bad = { name: "rocket ship", archetype: "launcher", heavy: true, hold: "aim", muzzle: [1.3, 0.9, 0], ammo: "starbursts", request: "rocket ship: a shiny silver rocket with big colorful fins",
    parts: [{ shape: "cylinder", size: [0.4, 1.8, 0.4], at: [0.5, 0.9, 0], color: "#7be08a", material: "plastic", label: "main fuselage" }, { shape: "cone", size: [0.4, 0.5, 0.4], at: [0.994, 1.156, 0], color: "#ff5f6d", material: "plastic", label: "nose cone" }] };
  const llm = fakeLLM({ look: [{ guess: "a rocket ship", confidence: 0.9 }] });
  const C = makeCrafter({ llm, renderer: fakeRenderer, log: { warn() {}, log() {} } });
  const r = await C.remakeProp({ recipe: bad, change: "make it look more like a real spaceship with windows and fins instead of a launcher" });
  assert.ok(r.ok && r.remade); assert.equal(r.recipe.archetype, "ride"); assert.ok(!r.recipe.heavy && !r.recipe.muzzle);
  assert.ok(r.recipe.parts.some((p) => p.label === "porthole")); assert.equal(r.matched, true);
  // a plane's fix that Pip doesn't recognise: a critique, one more go, and that one's kept when he knows it
  const plane = { ...validateProp(ex("airplane")).recipe, name: "plane", request: "a plane" };
  const wonky = { plan: "bigger wings", name: "plane", parts: [{ shape: "box", size: [2, 0.3, 0.3], at: [0, 0.3, 0], color: "#ffd34d", material: "plastic", label: "body" }] };
  const L2 = fakeLLM({ remake: [wonky], look: [{ guess: "a yellow stick", confidence: 0.6 }, { guess: "a toy plane", confidence: 0.9 }], same: [{ same: false }, { same: true }], critique: [{ features: ["wings"], fixes: ["add wings"] }], fix: [{ plan: "wings back", name: "plane", parts: ex("airplane").parts }] });
  const r2 = await makeCrafter({ llm: L2, renderer: fakeRenderer, log: { warn() {} } }).remakeProp({ recipe: plane, change: "make the wings bigger" });
  assert.ok(r2.ok); assert.equal(r2.matched, true); assert.equal(r2.guess, "a toy plane");
  assert.ok(r2.recipe.parts.length > 5, "the second try, which Pip knew");
  assert.deepEqual(L2.calls.map((c) => c.what), ["remake", "look", "same", "critique", "fix", "look"], "(\"a toy plane\" names it: no need to ask)");
});

test("on the M5: the old rocket ship is made again as a ride when the server starts, and 'the rocket' is it", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-veh-"));
  const { openMemory } = await import("../memory.js");
  const mem = openMemory(path.join(dir, "v.sqlite"));
  const bazooka = { ...validateProp(PROP_EXAMPLES.launcher.find((e) => e.heavy)).recipe, name: "confetti rocket launcher" };
  mem.addProp({ name: "confetti rocket launcher", archetype: "launcher", recipe: bazooka, origin: "you asked for it", source: "user" });
  mem.addProp({ name: "rocket ship", archetype: "launcher", recipe: { name: "rocket ship", archetype: "launcher", request: "rocket ship: a shiny silver rocket with big colorful fins", parts: [{ shape: "cylinder", size: [0.4, 1.8, 0.4], at: [0.5, 0.9, 0], color: "#7be08a", material: "plastic" }] }, origin: "you asked for it", source: "user" });
  mem.close();
  const fetchImpl = async (url) => (url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 }) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Zoom!" }, finish_reason: "stop" }] }), { status: 200 }));
  const S = await createServer({ db: path.join(dir, "v.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    const props = S.memory.props(), ship = props.find((p) => p.name === "rocket ship");
    assert.equal(ship.archetype, "ride"); assert.equal(ship.recipe.archetype, "ride");
    assert.ok(ship.recipe.parts.some((p) => p.label === "nose cone"));
    assert.ok(ship.recipe.parts.some((p) => p.color === "#c9ced6"), "shiny silver, as it was asked for");
    assert.equal(props.find((p) => p.name === "confetti rocket launcher").archetype, "launcher", "the bazooka is left alone");
    // "show me the rocket ship" / "the rocket": the ship; "fire your rocket": the launcher
    assert.equal(propIntent({ text: "show me the rocket ship", props }).prop.name, "rocket ship");
    assert.equal(propIntent({ text: "show me the rocket", props }).prop.name, "rocket ship");
    assert.equal(propIntent({ text: "fire your rocket launcher", props }).prop.name, "confetti rocket launcher");
  } finally { await S.close(); }
  // only once
  const S2 = await createServer({ db: path.join(dir, "v.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try { assert.equal(S2.memory.get("repair.vehicles.v1", false), true); } finally { await S2.close(); }
});

test("asking for a ride in one: 'blast off!', 'let's fly the rocket ship', 'set sail', 'ride the helicopter'", async () => {
  const { rideIntent } = await import("../brain.js");
  const owned = [{ name: "rocket ship", archetype: "ride" }, { name: "car", archetype: "ride" }];
  assert.deepEqual(rideIntent("let's fly the rocket ship!", owned), { name: "rocket ship", owned: true });
  assert.deepEqual(rideIntent("blast off!", owned), { name: "rocket ship", owned: true });
  assert.deepEqual(rideIntent("blast off!", [], { name: "helicopter", slot: "ride" }), { name: "helicopter", owned: false }, "the one he has out");
  assert.equal(rideIntent("there's a fly on the wall", owned), null);
  assert.equal(rideIntent("set sail!", owned), null, "a rocket ship is no ship");
  assert.deepEqual(rideIntent("set sail!", [...owned, { name: "pirate ship", archetype: "ride" }]), { name: "pirate ship", owned: true });
  assert.deepEqual(rideIntent("ride the helicopter"), { name: "helicopter", owned: false }, "the one in his pocket");
  // on the stage: no bike helmet in a helicopter, and the brain is told he's flying it
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-fly-"));
  let sys = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    sys = JSON.parse(init.body).messages[0].content;
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Wheee!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "f.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "ride the helicopter!", id: "h1" }) })).json();
    assert.equal(r.ride.name, "helicopter"); assert.equal(r.ride.kind, "fly"); assert.equal(r.ride.helmet, null);
    assert.match(sys, /you're flying it: up off the stage/);
  } finally { await S.close(); }
});
