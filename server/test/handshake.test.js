// The secret handshake: the shared rules (cleaning, the chat intent), the server (saved, counted, told to the brain),
// and the kit on a stand-in body: teach by gestures, he plays it back, save; together with the ring on what's next;
// mistakes; and he offers it when you come back after a while (not too often, never while he's worried about you).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanHandshake, handshakeIntent, describeHandshake, teachMoveIntent } from "../../shared/handshake.js";
import { createServer } from "../index.js";

test("handshake data: cleaned, described, asked for in words", () => {
  assert.deepEqual(cleanHandshake([{ g: "L" }, { g: "R", dt: 0.4 }, { g: "X" }, { g: "H", dt: 9 }]), [{ g: "L", dt: 0 }, { g: "R", dt: 0.4 }, { g: "H", dt: 2 }]);
  assert.equal(cleanHandshake([{ g: "L" }]), null, "one tap isn't a handshake");
  assert.equal(cleanHandshake("nope"), null);
  assert.equal(cleanHandshake(Array.from({ length: 12 }, () => ({ g: "L", dt: 0.3 }))).length, 8);
  assert.equal(describeHandshake([{ g: "L" }, { g: "RS" }, { g: "T" }]), "left hoof, then slide on the right hoof, then tummy");
  for (const [t, want] of [["let's do our handshake", "offer"], ["handshake!", "offer"], ["can we do our secret handshake?", "offer"], ["let's make a secret handshake", "teach"],
    ["teach you a new handshake", "teach"], ["his handshake was firm", null], ["don't do the handshake", null], ["hi there", null]]) assert.equal(handshakeIntent(t), want, t);
});

test("server: saved and counted; the brain knows it; 'let's do our handshake' offers it, or asks to be taught", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-hs-"));
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    system = JSON.parse(init.body).messages[0].content;
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Yay!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "h.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const base = `http://127.0.0.1:${S.port}`;
  const say = async (text, extra = {}) => (await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()), ...extra }) })).json();
  try {
    let r = await say("let's do our handshake");
    assert.equal(r.handshake, "teach", "none yet: he asks to be taught"); assert.match(system, /You don't have a secret handshake with them yet/); assert.match(system, /held out both hooves so they can teach you/);
    const bad = await fetch(`${base}/api/handshake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ steps: [{ g: "L" }] }) });
    assert.equal(bad.status, 400);
    const ok = await (await fetch(`${base}/api/handshake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ steps: [{ g: "L" }, { g: "R", dt: 0.3 }, { g: "H", dt: 0.5 }] }) })).json();
    assert.equal(ok.ok, true);
    assert.equal((await (await fetch(`${base}/api/handshake`)).json()).steps.length, 3);
    r = await say("let's do our handshake!");
    assert.equal(r.handshake, "offer"); assert.match(system, /Your secret handshake with them: left hoof, then right hoof, then head \(done together 0 times\)/);
    assert.match(system, /you held out your hoof to do your secret handshake/);
    // done together (the page tells the server over the WebSocket)
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`); await new Promise((ok) => ws.on("open", ok));
    ws.send(JSON.stringify({ type: "handshake", done: true })); await new Promise((ok) => setTimeout(ok, 150)); ws.close();
    assert.equal((await (await fetch(`${base}/api/handshake`)).json()).times, 1);
    r = await say("hi", { events: ["handshake"] });
    assert.match(system, /you just did your secret handshake together/); assert.match(system, /done together 1 time\)/);
    assert.ok(S.memory.scrapbook().some((e) => /our secret handshake/.test(e.entry)), "in the scrapbook");
  } finally { await S.close(); }
});

test("teaching him a move by saying so (Nov 4): the posing lesson opens, and he doesn't make one up", async () => {
  for (const t of ["I want to teach you a cool move", "mochi, wnat to learn a new move", "wanna learn a dance move?", "let me show you a cool dance move", "I want to teach you to dance", "can you learn a new trick?"]) assert.equal(teachMoveIntent(t), true, t);
  for (const t of ["teach me a move", "show me your moves", "learn the moonwalk", "teach mimi the twirl", "teach you a new handshake", "make up a new move", "you learned a new move!", "do a dance"]) assert.equal(teachMoveIntent(t), false, t);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-pose-"));
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body); system = body.messages[0].content;
    if (body.tools && !body.messages.some((m) => m.role === "tool")) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "request_move", arguments: JSON.stringify({ name: "cool move" }) } }] }, finish_reason: "tool_calls" }] }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Ooh, yes! Show me!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "p.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const base = `http://127.0.0.1:${S.port}`;
  try {
    const r = await (await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "mochi, want to learn a new move?", id: "p1" }) })).json();
    assert.equal(r.pose, "teach");
    assert.match(system, /they drag your arms, head, body or feet to show you/);
    assert.ok(!S.memory.queue().some((q) => q.kind === "move" && q.status !== "cancelled"), "nothing on the workbench for it");
    assert.ok(!(r.actions || []).some((a) => a.kind === "move"));
  } finally { await S.close(); }
});

// ------------------------------------------------------------------ the kit, on a stand-in body
const threePath = fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url));
const have = fs.existsSync(threePath);
const THREE = have ? await import(threePath) : null;
const HSK = have ? await import("../../kit/src/handshake.js") : null;
let NOW = 100000;
if (have) Object.defineProperty(performance, "now", { value: () => NOW, configurable: true, writable: true });
function fake() {
  const scene = new THREE.Scene(), root = new THREE.Group(), body = new THREE.Group(), neck = new THREE.Group(), head = new THREE.Group();
  scene.add(root); root.add(body); neck.position.set(0, 1.04, 0.04); body.add(neck); head.position.set(0, 0.54, 0.05); neck.add(head);
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 0.74, 0.4); a.userData.side = s; body.add(a); return a; });
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50); camera.position.set(0, 1.64, 7.6); camera.lookAt(0, 1.28, 0);
  let seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m = { scene, root, body, neck, head, arms, camera, r, reduce: false, mood: "idle", held: false, sulking: false, inBed: false, gf: null, said: [], runs: [], notes: [], spawned: 0, lastActive: NOW,
    craft: { prop: null, posing: null, letGo() { this.prop = null; } }, scuffle: { busy: () => false },
    say(t) { this.said.push(t); }, run(steps) { this.runs.push(steps.map((s) => s[0]).join(">")); }, touch() { this.lastActive = NOW; }, note(e) { this.notes.push(e); }, spawn() { this.spawned++; },
    host: { getBoundingClientRect: () => ({ width: 260, height: 350, left: 0, top: 0 }) }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 374, height: 434 }) } };
  m.hs = new HSK.Handshake(m);
  return m;
}
function frame(m, dt = 1 / 60) {
  NOW += dt * 1000;
  m.arms.forEach((a) => a.rotation.set(-0.62, 0, a.userData.side * 0.22)); m.neck.rotation.set(0, 0, 0); m.root.position.set(0, 0, 0); m.root.scale.setScalar(1);
  m.hs.step(NOW, dt);
  m.scene.updateMatrixWorld(true);
}
const run = (m, s) => { for (let i = 0; i < Math.round(s * 60); i++) frame(m); };

test("kit: taught by gestures with your rhythm, played back, saved; hooves out while teaching", { skip: !have }, () => {
  const m = fake(), H = m.hs;
  assert.equal(H.teachStart(), true);
  run(m, 0.5);
  assert.ok(m.arms[0].rotation.x < -1.4 && m.arms[1].rotation.x < -1.4, "both hooves held out to you");
  for (const [g, wait] of [["L", 0.3], ["R", 0.5], ["RS", 0.4], ["H", 0.3]]) { H.input(g, 1); run(m, wait); }
  const d = H.teachDone();
  assert.equal(d.ok, true); assert.deepEqual(d.steps.map((s) => s.g), ["L", "R", "RS", "H"]);
  assert.ok(Math.abs(d.steps[1].dt - 0.3) < 0.05 && Math.abs(d.steps[2].dt - 0.5) < 0.05, "kept your rhythm");
  assert.equal(m.said.at(-1), "Like this?");
  let nods = 0; for (let i = 0; i < 260; i++) { frame(m); if (m.neck.rotation.x > 0.05) nods++; }
  assert.ok(nods > 3, "he played it back (the head step nodded)"); assert.equal(H.mode, "checked", "waiting for Save or Try again");
  assert.equal(H.save(), true); assert.equal(H.steps.length, 4); assert.equal(H.mode, null);
  const short = fake(); short.hs.teachStart(); short.hs.input("L"); assert.equal(short.hs.teachDone().ok, false, "one tap isn't a handshake");
});

test("kit: together: the ring shows what's next, a wrong one gets a head shake, three wrong and he shows you", { skip: !have }, () => {
  const m = fake(), H = m.hs;
  H.set([{ g: "L", dt: 0 }, { g: "R", dt: 0.4 }, { g: "T", dt: 0.4 }]);
  assert.equal(H.offer({ force: true }), true); run(m, 0.6);
  assert.equal(H.ring.visible, true);
  const ringAt = (g) => { const a = m.arms[g === "R" ? 1 : 0]; return H.ring.position.distanceTo(a.localToWorld(new THREE.Vector3(0, -0.26, 0.08))); };
  assert.ok(ringAt("L") < 0.05, "on the left hoof first");
  H.input("L"); run(m, 0.2); assert.ok(ringAt("R") < 0.05, "then the right");
  H.input("H"); assert.match(m.said.at(-1), /no, this one|Almost/); assert.equal(H.idx, 1, "a wrong one doesn't count");
  H.input("R"); H.input("T");
  assert.equal(H.mode, null); assert.equal(m.said.at(-1), "Our secret handshake!"); assert.ok(m.notes.includes("handshake")); assert.ok(m.spawned >= 5);
  // muddled: he shows it himself
  const m2 = fake(); m2.hs.set(H.steps); m2.hs.offer({ force: true }); for (const g of ["H", "H", "H"]) m2.hs.input(g);
  assert.equal(m2.hs.mode, "solo"); assert.ok(m2.notes.includes("handshake_miss"));
  run(m2, 3); assert.equal(m2.hs.mode, null);
  // nobody taps: "Later, then!"
  const m3 = fake(); m3.hs.set(H.steps); m3.hs.offer({ force: true }); run(m3, 11);
  assert.equal(m3.hs.mode, null); assert.equal(m3.said.at(-1), "Later, then!");
});

test("kit: he offers it when you come back, not again too soon, never while he's worried about you", { skip: !have }, () => {
  const m = fake(), H = m.hs;
  H.set([{ g: "L", dt: 0 }, { g: "R", dt: 0.4 }]);
  H.lastDone = NOW - 200000; H.lastOffer = NOW - 200000;
  m.mood = "sleep";
  assert.equal(H.returned("pointer"), true);
  assert.ok(m.runs.at(-1).startsWith("surprised>hello"), "wakes up and says hi first");
  run(m, 1.0); assert.equal(H.mode, null, "not before he's said hello");
  run(m, 1.0); assert.equal(H.mode, "together"); assert.match(m.said.at(-1), /Handshake\?/); assert.ok(m.notes.includes("handshake_offer"));
  H.input("L"); H.input("R"); assert.equal(H.mode, null);
  assert.equal(H.returned("pointer"), false, "not again right after");
  NOW += 100000; assert.equal(H.returned("message"), true); run(m, 2); assert.equal(H.mode, null, "a message: only after he's answered");
  H.replied(); run(m, 1.5); assert.equal(H.mode, "together");
  const m2 = fake(); m2.hs.set(H.steps); m2.hs.lastDone = m2.hs.lastOffer = NOW - 200000; m2.hs.care = true;
  assert.equal(m2.hs.returned("pointer"), false, "not in care mode"); assert.equal(m2.hs.offer(), false);
  m2.hs.care = false; m2.sulking = true; assert.equal(m2.hs.returned("tab"), false, "not while sulking");
  const m3 = fake(); m3.hs.lastDone = m3.hs.lastOffer = NOW - 200000; assert.equal(m3.hs.returned("pointer"), false, "no handshake yet: nothing to offer");
  // a tap on the hoof it starts with: off you go together (only hoof taps start it)
  const m4 = fake(); m4.hs.set([{ g: "R", dt: 0 }, { g: "L", dt: 0.4 }]); m4.hs.lastDone = m4.hs.lastOffer = NOW - 200000;
  assert.equal(m4.hs.tapStart("L"), false); assert.equal(m4.hs.tapStart("R"), true); assert.equal(m4.hs.idx, 1);
});
