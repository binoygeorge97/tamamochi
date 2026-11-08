// Sneezes and a little cold (Binoy, Nov 3: "can mochi sneeze? what if the story goes to a point where he catches a cold?")
import { test } from "node:test";
import assert from "node:assert/strict";
import { coldIntent, coldInReply } from "../brain.js";
import { bodyNote } from "../index.js";

test("catching a cold: said to him, or in the story; not a question, not theirs, not a 'don't'", () => {
  for (const t of ["you caught a cold!", "oh no, you have a cold", "and then Mochi caught a cold", "you are sick", "pretend you have a cold", "what if you caught the flu?", "I am sick and you caught a cold from me"])
    assert.deepEqual(coldIntent(t), { start: true }, t);
  for (const t of ["do you have a cold?", "I caught a cold", "i have the flu and you have to take care of me", "don't get sick!", "how are you?"])
    assert.equal(coldIntent(t), null, t);
  assert.equal(coldIntent("you caught a cold!", { cold: true }), null, "already has one");
});

test("getting better: soup, tea, a nap, or 'you're better now' (only while he has a cold)", () => {
  for (const t of ["here, have some soup", "drink some tea", "go to bed and get some rest", "you are better now", "I'll make you some chicken soup"])
    assert.deepEqual(coldIntent(t, { cold: true }), { end: true }, t);
  assert.equal(coldIntent("I don't want soup", { cold: true }), null);
  assert.equal(coldIntent("here, have some soup", { cold: false }), null, "no cold to cure");
});

test("a sneeze on request", () => {
  for (const t of ["can you sneeze?", "sneeze!", "do a big sneeze", "smell this pepper", "achoo"]) assert.deepEqual(coldIntent(t), { sneeze: true }, t);
  for (const t of ["I sneezed", "bless you", "don't sneeze on me"]) assert.equal(coldIntent(t), null, t);
});

test("his own words: 'Achoo!' sneezes on screen; 'I think I'm catching a cold' gives him one", () => {
  assert.deepEqual(coldInReply("Achoo! Oh no, I think I am catching a cold…"), { sneeze: true, start: true });
  assert.deepEqual(coldInReply("Ah-choo! Excuse me!"), { sneeze: true, start: false });
  assert.deepEqual(coldInReply("I'm not getting a cold, silly!"), { sneeze: false, start: false });
  assert.deepEqual(coldInReply("Choo choo! All aboard the train!"), { sneeze: false, start: false });
});

test("what happened on screen reaches the brain", () => {
  assert.match(bodyNote(null, null, ["sneezed"]), /sneezed/);
  assert.match(bodyNote(null, null, ["cold_better"]), /cold just went away/);
  assert.match(bodyNote(null, null, ["moved_mimi"]), /picked Mimi up/);
});

// The doodle pad and the demo snapshot (Nov 3, hackathon prep)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../index.js";

test("a doodle is named by the vision model; a scribble it can't tell asks you instead", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-doodle-"));
  let answer = "A kite.";
  const craftLLM = { chat: async ({ images }) => { assert.equal(images.length, 1); return { text: answer, ms: 5 }; }, vision: true };
  const S = await createServer({ db: path.join(dir, "d.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, craftLLM, cloud: false, demoSnapshot: path.join(dir, "demo.sqlite") });
  const base = `http://127.0.0.1:${S.port}`, png = "data:image/png;base64," + "A".repeat(400);
  const post = async (url, body) => (await fetch(base + url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) })).json();
  try {
    const named = await post("/api/doodle", { png }); assert.equal(named.ok, true); assert.equal(named.name, "kite"); assert.ok(named.id, "the drawing is kept for the workbench");
    answer = "unsure"; assert.equal((await post("/api/doodle", { png })).unsure, true);
    assert.ok((await post("/api/doodle", { png: "javascript:alert(1)" })).error, "only a picture");
    // the demo: saved, then put back (the handshake comes back with it; a cold doesn't)
    await post("/api/handshake", { steps: [{ g: "L", dt: 0 }, { g: "R", dt: 0.5 }] });
    assert.equal((await (await fetch(base + "/api/demo-snapshot")).json()).exists, false);
    assert.equal((await post("/api/demo-snapshot")).exists, true);
    await post("/api/chat", { text: "you caught a cold!", id: "1" });
    await post("/api/handshake", { steps: null });
    assert.equal((await post("/api/reset-demo")).ok, true);
    assert.equal((await (await fetch(base + "/api/handshake")).json()).steps.length, 2);
    assert.equal((await post("/api/cold", {})).cold, 0);
  } finally { await S.close(); }
});

test("growth, day zero, the review and 8090 feedback", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-growth-"));
  const filed = [];
  const factory = { feedback: async (x) => { filed.push(x); return { ok: true, id: "f1" }; }, status: () => ({ on: true }), enabled: () => true };
  const S = await createServer({ db: path.join(dir, "g.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, factory, cloud: false });
  const base = `http://127.0.0.1:${S.port}`;
  const post = async (url, body) => (await fetch(base + url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) })).json();
  const get = async (url) => (await fetch(base + url)).json();
  try {
    await post("/api/moves", { name: "my twirl", recipe: { name: "my twirl", duration: 1, tracks: { "body.sway": [[0, 0], [0.5, 0.5], [1, 0]] } } });
    let g = await get("/api/growth");
    assert.equal(g.moves, 1); assert.equal(g.taught, 1); assert.ok(g.cloud.includes("8090 (feedback)"));
    const r = await post("/api/review", {});
    assert.equal(r.taught, 1); assert.equal(filed.length, 1); assert.match(filed[0].markdown, /1 moves \(1 taught by hand\)/);
    const z = await post("/api/reset-demo", { which: "zero" }); assert.equal(z.ok, true); assert.equal(z.zero, true); assert.match(z.backup, /^mochi\.before-dayzero\.\d+\.sqlite$/);   // a copy first, in case it was a slip
    g = await get("/api/growth");
    assert.equal(g.moves, 0); assert.equal(g.day, 1);
  } finally { await S.close(); }
});

test("saving up: a goal, coins in, the goal reached; the piggy bank shows in the growth badge", async () => {
  const { savingsIntent } = await import("../brain.js");
  assert.deepEqual(savingsIntent("i want to save $40 for a new bike"), { goal: "new bike", target: 40 });
  assert.deepEqual(savingsIntent("I saved $5 today"), { add: 5 });
  assert.equal(savingsIntent("I saved the world"), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-save-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Yay!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "s.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false });
  const base = `http://127.0.0.1:${S.port}`;
  const chat = async (text, id) => (await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id }) })).json();
  try {
    let r = await chat("help me save $10 for a kite", "1"); assert.equal(r.savings.event, "goal"); assert.equal(r.savings.target, 10); assert.equal(r.savings.prop.name, "piggy bank"); assert.equal(r.cue, null);
    r = await chat("I saved $4", "2"); assert.equal(r.savings.event, "add"); assert.equal(r.savings.saved, 4);
    r = await chat("I spent $1", "3"); assert.equal(r.savings.event, "spend"); assert.equal(r.savings.saved, 3);
    r = await chat("put 7 dollars in the piggy bank", "4"); assert.equal(r.savings.event, "done"); assert.equal(r.savings.saved, 10);
    const g = await (await fetch(base + "/api/growth")).json(); assert.equal(g.savings.goal, "kite"); assert.equal(g.savings.saved, 10);
  } finally { await S.close(); }
});

test("from the M5 log (Nov 3): a dance he wasn't taught is his happy dance; an empty answer about a weapon is the safety line; a cold passed on", async () => {
  const { coldIntent } = await import("../brain.js");
  assert.deepEqual(coldIntent("actualy i think i passed it on to you"), { start: true });
  assert.equal(coldIntent("i gave my cold to my sister"), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-log-"));
  let mode = "perform", n = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }));
    n++;
    if (mode === "perform" && n === 1) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", type: "function", function: { name: "perform", arguments: JSON.stringify({ move: "dance" }) } }] }, finish_reason: "tool_calls" }] }));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: mode === "empty" ? "" : "Wheee!" }, finish_reason: "stop" }] }));
  };
  const S = await createServer({ db: path.join(dir, "l.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false });
  const chat = async (text, id) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id }) })).json();
  try {
    let r = await chat("what's something fun you know?", "1");   // ("show me something fun" is his activity book now)
    assert.ok(r.reply.actions.some((a) => a.kind === "move" && a.name === "happy dance"), JSON.stringify(r.reply.actions));
    mode = "empty"; r = await chat("what about a grenade?", "2");
    assert.equal(r.reply.fallback, true); assert.match(r.reply.text, /friendly kind/);
  } finally { await S.close(); }
});

test("review fixes (Nov 3): savings, cold idioms and cures, sending friends home, parties, doodle names", async () => {
  const { savingsIntent, coldIntent, coldInReply, dismissIntent, partyIntent } = await import("../brain.js");
  const { doodleName } = await import("../index.js");
  assert.deepEqual(savingsIntent("I saved $5 for the kite"), { add: 5 });
  assert.equal(savingsIntent("My mom made $500 at work today"), null);
  assert.deepEqual(savingsIntent("help me save $2,000 for a bike"), { goal: "bike", target: 2000 });
  assert.deepEqual(savingsIntent("I saved $1,000"), { add: 1000 });
  assert.equal(savingsIntent("add it to the list"), null);
  assert.deepEqual(savingsIntent("I got $10 for my birthday, save it"), { add: 10 });
  for (const t of ["dude you're sick at this!", "you have a bug in your code", "imagine you in the cold snow"]) assert.equal(coldIntent(t), null, t);
  for (const t of ["I hate tea", "I don't like soup", "honey, I'm home", "I took my medicine"]) assert.equal(coldIntent(t, { cold: true }), null, t);
  for (const t of ["I'm sick of waiting!", "I got a cold drink!", "I have a cold nose"]) assert.equal(coldInReply(t).start, false, t);
  for (const t of ["can I have some time alone with mimi?", "I need some quality time with my family", "the teacher let everyone go home", "later everyone will come over", "they should go to bed"]) assert.equal(dismissIntent(t), null, t);
  for (const t of ["I have a party tomorrow", "can I have a party for my birthday?", "she wants to have a party"]) assert.equal(partyIntent(t), null, t);
  assert.ok(partyIntent("let's have a party!"));
  // Nov 3 review: more ways to ask
  assert.deepEqual(dismissIntent("Mimi, can you leave?"), ["mimi"]); assert.deepEqual(dismissIntent("go home cocoa"), ["cocoa"]);
  for (const t of ["mimi can you go get cocoa", "can you go home with mimi?", "cocoa can you go faster"]) assert.equal(dismissIntent(t), null, t);
  assert.deepEqual(partyIntent("can everyone dance?").friends, ["mimi", "cocoa"]); assert.deepEqual(partyIntent("dance by yourself").friends, []);
  assert.equal(doodleName("It's a kite."), "kite"); assert.equal(doodleName("That's an umbrella!"), "umbrella"); assert.equal(doodleName("I think it's a paper crown"), "paper crown");
});

test("review fixes (Nov 3): a friend sent home doesn't speak; their lines carry no *actions*; the Day badge survives a demo reset", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-rev-"));
  let content = 'Okay, just us! Mimi: "Okay, bye bye ♡"';
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "r.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false, demoSnapshot: path.join(dir, "demo.sqlite") });
  const base = `http://127.0.0.1:${S.port}`;
  const chat = async (body) => (await fetch(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  try {
    let r = await chat({ text: "let mimi and cocoa go", id: "1", friends: { mimi: "hello", cocoa: "hello" } });
    assert.deepEqual(r.dismiss, ["mimi", "cocoa"]); assert.deepEqual(r.reply.friendSay, []);
    content = "*giggles and twirls* My day was lovely ♡";
    r = await chat({ text: "how was your day?", id: "2", to: "mimi", friends: { mimi: "hello" } });
    assert.deepEqual(r.reply.friendSay, [{ who: "mimi", text: "My day was lovely ♡" }]);
    // a demo saved with history keeps its days after a reset (born = the earliest thing he has)
    S.memory.db.exec("UPDATE turns SET created_at = datetime('now', '-2 days')");
    await fetch(base + "/api/demo-snapshot", { method: "POST" });
    await fetch(base + "/api/reset-demo", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    S.memory.db.exec("INSERT INTO props (name, archetype, recipe, origin, source, created_at) VALUES ('kite', 'handheld_canopy', '{\"parts\":[]}', 'test', 'user', datetime('now', '-2 days'))");
    const g = await (await fetch(base + "/api/growth")).json();
    assert.equal(g.day, 3);
  } finally { await S.close(); }
});
