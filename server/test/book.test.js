// His activity book (Nov 3): many everyday activities he can really do, and the ones he makes up.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BOOK, CATEGORIES } from "../../shared/activity-book.js";
import { MOTIONS } from "../../shared/motions.js";
import { PROP_EXAMPLES, validateMove, validateProp } from "../../shared/craft.js";
import { bookIntent, bookLookup, routineFor, cleanImprov, fallbackImprov, improvise, routineNote, FX, SOUNDS } from "../book.js";
import { createServer } from "../index.js";

const POCKET = new Set(Object.values(PROP_EXAMPLES).flat().map((e) => e.name));

test("every page of the book is made of things he really has", () => {
  assert.ok(BOOK.length >= 80, `${BOOK.length} activities`);
  for (const [c] of CATEGORIES) assert.ok(BOOK.filter((e) => e.cat === c).length >= 3, `category ${c}`);
  for (const m of Object.values(MOTIONS)) { const v = validateMove(m); assert.ok(v.ok && !v.warnings.length, `${m.name}: ${v.errors} ${v.warnings}`); }
  for (const e of BOOK) {
    if (e.pickOne) continue;
    for (const k of ["hold", "wear", "set"]) if (e[k]) assert.ok(POCKET.has(e[k]), `${e.id}: ${k} ${e[k]}`);
    for (const [, name] of e.pick || []) assert.ok(POCKET.has(name), `${e.id}: pick ${name}`);
    for (const m of e.moves || []) assert.ok(MOTIONS[m], `${e.id}: motion ${m}`);
    for (const s of e.steps || []) { if (s[0] === "move") assert.ok(MOTIONS[s[1]], `${e.id}: motion ${s[1]}`); if (["hold", "set", "wear"].includes(s[0])) assert.ok(POCKET.has(s[1]), `${e.id}: ${s[1]}`); if (s[0] === "fx") assert.ok(FX.includes(s[1]), `${e.id}: fx ${s[1]}`); if (s[0] === "sound") assert.ok(SOUNDS.includes(s[1]), `${e.id}: sound ${s[1]}`); }
    if (e.fx) assert.ok(FX.includes(e.fx), `${e.id}: fx ${e.fx}`);
    if (e.sound) assert.ok(SOUNDS.includes(e.sound), `${e.id}: sound ${e.sound}`);
    const r = routineFor(e, { ask: e.name });
    assert.ok(r.steps.some((s) => ["motion", "use", "catch", "walk", "toss"].includes(s.do)), `${e.id}: he does something`);
    assert.ok(r.ms >= 3000 && r.ms <= 30000, `${e.id}: ${r.ms} ms`);
    for (const s of r.steps) if (s.prop) assert.ok(validateProp(s.prop.recipe).ok, `${e.id}: ${s.prop.name}`);
    assert.deepEqual(r.steps.map((s) => s.at), r.steps.map((s) => s.at).slice().sort((a, b) => a - b), `${e.id}: in order`);
    assert.equal(bookLookup(e.name).id, e.id, `${e.id}: found by its own name`);
  }
});

test("what asks for one, and what doesn't", () => {
  const yes = { "play the guitar": "guitar", "can you play us a song on your guitar?": "guitar", "sing!": "sing", "let's have a tea party": "teaparty", "can you go fishing?": "fishing", "read me a story": "read", "do some yoga with mimi": "yoga", "play catch with cocoa": "catch", "let's play hide and seek": "hide", "bake a cake": "bake", "eat a cookie": "snack", "brush your teeth": "teeth", "be an astronaut": "astronaut", "tell me a joke": "comedy", "set off fireworks": "fireworks", "do the robot": "robot", "shoot some hoops": "basketball", "go bowling": "bowling", "take a selfie": "selfie", "go camping": "camping", "be a pirate": "treasure", "clean your room": "clean", "drink some hot cocoa": "drink", "use the walkie-talkie": "walkie" };
  for (const [t, id] of Object.entries(yes)) assert.equal(bookIntent(t)?.id, id, t);
  for (const t of ["I went swimming today", "I love to sing", "my mom bakes cakes", "do you like reading?", "what's your favourite song?", "I'm going to cook dinner", "don't sing", "we had a picnic yesterday", "I played soccer", "nice singing!", "how was the movie?", "can you dance?", "call mimi", "take out your guitar", "my sister plays the piano", "have you ever been fishing?"]) assert.equal(bookIntent(t), null, t);
  assert.equal(bookIntent("do the twirl", { moves: [{ name: "the twirl" }] }), null, "a move you taught him wins");
  assert.equal(bookIntent("let's play a game").id, "game");
  assert.deepEqual(bookIntent("can you do a rain dance?"), { kind: "improvise", ask: "rain dance" });
  assert.equal(bookIntent("do a happy dance", { moves: [{ name: "happy dance", source: "builtin" }] }), null, "a move he knows");
  assert.equal(bookIntent("make me a wizard hat"), null, "a prop for the workbench");
  assert.equal(bookIntent("let's play with your car"), null);
  // the review (Nov 3): questions, help with their own things, and words that only look like activities
  for (const t of ["do you swim?", "do you eat pizza?", "have you been swimming?", "let's work out a plan", "explore the options", "please clean up this code", "clean up my essay", "investigate why my code crashes", "stretch the truth", "warm up the car", "wash up the dishes", "help me study for my test", "do the weather for tomorrow", "knock knock", "I'm going swimming later", "you look like a wizard", "that's a cool drum"]) assert.equal(bookIntent(t), null, t);
  // and each sentence on its own; things said, not asked, that are plainly invitations
  for (const [t, id] of [["do you want to swim?", "swim"], ["can you sing? I love your voice", "sing"], ["it's my birthday!", "birthday"], ["say cheese!", "photo"], ["tag, you're it!", "tag"], ["give me a cheer", "cheerlead"], ["find the treasure", "treasure"], ["I'm so bored", "anything"]]) assert.equal(bookIntent(t)?.id, id, t);
  assert.deepEqual(routineFor(BOOK.find((e) => e.id === "drink"), { ask: "can you drink some hot cocoa" }).friends, [], "hot cocoa isn't Cocoa");
  assert.deepEqual(routineFor(BOOK.find((e) => e.id === "catch"), { ask: "play catch by yourself" }).friends, ["cocoa"], "catch needs someone to catch");
  const owned = [{ id: 3, name: "jump rope", archetype: "handheld_tool", recipe: { name: "jump rope", archetype: "handheld_tool", parts: [] } }, { id: 4, name: "water balloon", archetype: "throwable", recipe: { name: "water balloon", archetype: "throwable", parts: [] } }];
  assert.equal(routineFor({ id: "learned:x", moves: ["hop"], hold: "jump rope" }, { owned }).steps.find((s) => s.do === "hold").prop.name, "jump rope", "one of his own, picked by a made-up activity");
  assert.equal(routineFor(BOOK.find((e) => e.id === "catch"), { ask: "play catch", owned }).steps.find((s) => s.do === "hold").prop.name, "foam ball", "a water balloon isn't a foam ball");
  const g = routineFor(BOOK.find((e) => e.id === "guitar"), { ask: "x" }), mv = g.steps.filter((s) => s.do === "motion");
  assert.ok(mv[1].at - mv[0].at >= mv[0].recipe.duration * 1000 + 300, "the moves don't pile up behind each other");
});

test("a routine: his own guitar first, friends you name join in, a game picks one", () => {
  const owned = [{ id: 7, name: "rainbow guitar", archetype: "handheld_tool", recipe: { name: "rainbow guitar", archetype: "handheld_tool", parts: [{ shape: "sphere", size: [0.4, 0.4, 0.1], at: [0, 0.2, 0], color: "#ff0000", material: "wood" }] } }];
  const r = routineFor(BOOK.find((e) => e.id === "guitar"), { ask: "play the guitar for mimi", owned });
  assert.equal(r.steps.find((s) => s.do === "hold").prop.name, "rainbow guitar");
  assert.deepEqual(r.friends, ["mimi"]);
  assert.ok(r.steps.some((s) => s.do === "sound" && s.kind === "guitar"));
  assert.match(routineNote(r), /playing your guitar \(Mimi joined in\)/);
  const snack = routineFor(BOOK.find((e) => e.id === "snack"), { ask: "eat some pizza" });
  assert.equal(snack.steps.find((s) => s.do === "hold").prop.name, "pizza slice");
  assert.deepEqual(routineFor(BOOK.find((e) => e.id === "yoga"), { ask: "yoga by yourself" }).friends, []);
  const g = routineFor(BOOK.find((e) => e.id === "game"), { ask: "let's play a game", r: () => 0 });
  assert.equal(g.id, "catch");
});

test("making one up: only real pieces; a plain one if the model can't; remembered", async () => {
  const e = cleanImprov({ name: "Rain Dance", ing: "doing a rain dance", hold: "little blue umbrella", wear: "laser helmet", set: "none", moves: ["hula", "nope", "spin"], fx: "snow", sound: "splash", friends: "mimi", start: "Rain, rain, come!", end_line: "It worked!", end_face: "proud", need: "none" }, "do a rain dance");
  assert.equal(e.hold, "little blue umbrella"); assert.equal(e.wear, null); assert.deepEqual(e.moves, ["hula", "spin"]); assert.equal(e.need, null); assert.deepEqual(e.friends, ["mimi"]);
  assert.equal(cleanImprov({ moves: ["nope"] }, "x"), null);
  assert.ok(fallbackImprov("can you do a cartwheel?").moves.length);
  const kv = new Map(), memory = { props: () => [], get: (k, d) => (kv.has(k) ? kv.get(k) : d), set: (k, v) => kv.set(k, v) };
  let calls = 0;
  const llm = { chat: async () => { calls++; return { json: { name: "cartwheel show", ing: "doing cartwheels", hold: "none", wear: "none", set: "none", moves: ["spin", "hop"], fx: "star", sound: "boing", friends: "none", start: "Here goes!", end_line: "Ta-da!", end_face: "proud", need: "a gym mat" } }; } };
  const a = await improvise({ llm, ask: "can you do a cartwheel?", memory });
  assert.equal(a.fresh, true); assert.equal(a.entry.need, "a gym mat");
  const b = await improvise({ llm, ask: "do a cartwheel", memory });
  assert.equal(b.fresh, false); assert.equal(calls, 1, "the second time he already knows it");
  const r = routineFor(b.entry, { ask: "do a cartwheel" }); assert.ok(r.learned); assert.match(routineNote(r), /making it up/);
});

test("chat: the book plays with the reply; one he makes up follows over the socket and joins his book", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-book-"));
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body);
    if (body.response_format && /moves/.test(JSON.stringify(body.response_format))) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify({ name: "rain dance", ing: "doing a rain dance", hold: "little blue umbrella", wear: "none", set: "none", moves: ["hula", "spin"], fx: "snow", sound: "splash", friends: "none", start: "Rain, come!", end_line: "Splash!", end_face: "excited", need: "none" }) }, finish_reason: "stop" }] }), { status: 200 });
    system = body.messages[0].content;
    const last = body.messages[body.messages.length - 1], user = [...body.messages].reverse().find((m) => m.role === "user").content;
    if (/rain dance/.test(user) && last.role !== "tool") return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "do_activity", arguments: JSON.stringify({ what: "a rain dance" }) } }] }, finish_reason: "tool_calls" }] }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Yay, let's go!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "b.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, cloud: false });
  const base = `http://127.0.0.1:${S.port}`, post = async (u, b) => (await fetch(base + u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
  try {
    let r = await post("/api/chat", { text: "can you play the drums for us?", id: "1" });
    assert.equal(r.reply.activity.kind, "routine"); assert.equal(r.reply.activity.id, "drums"); assert.match(system, /playing your toy drum/);
    assert.ok(r.reply.activity.steps.some((s) => s.do === "set" && s.prop.name === "toy drum"));
    await post("/api/activity/done", { kind: "routine", id: "drums" });
    r = await post("/api/chat", { text: "do a rain dance!", id: "2" });
    assert.equal(r.reply.activity, null, "the reply doesn't wait for it");
    let book = null;
    for (let i = 0; i < 40 && !(book && book.learned.length); i++) { await new Promise((ok) => setTimeout(ok, 50)); book = await (await fetch(base + "/api/book")).json(); }
    assert.equal(book.learned[0].name, "rain dance");
    assert.equal(book.categories.find((c) => c.id === "music").items.find((x) => x.id === "drums").times, 1);
  } finally { await S.close(); }
});

test("his story: after an activity he liked, he wants to try the next one like it", async () => {
  const { openMemory } = await import("../memory.js"), { makeStory } = await import("../story.js");
  const memory = openMemory(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mochi-bs-")), "m.sqlite"));
  memory.set("book.done", { guitar: { n: 1, at: new Date().toISOString() } });
  assert.equal(makeStory({ memory, llm: null }).state().wants.some((x) => x.kind === "book"), false, "on his own doesn't count");
  memory.set("book.asked", { guitar: new Date().toISOString() });
  const story = makeStory({ memory, llm: null });
  const w = story.state().wants.find((x) => x.kind === "book");
  assert.ok(w, "a book want"); assert.equal(w.text, "play the drums");
  let beat = null; for (let i = 0; i < 4 && !(beat && beat.kind === "activity"); i++) beat = await story.pickBeat();
  assert.equal(beat.kind, "activity"); assert.equal(beat.act.kind, "routine"); assert.equal(beat.act.id, "drums");
});

test("bugs (Nov 3): junk activity ids aren't counted; a cut-off prop name is mended from its request", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-bk2-")), db = path.join(dir, "b.sqlite");
  const { openMemory } = await import("../memory.js");
  const m0 = openMemory(db), recipe = Object.values(PROP_EXAMPLES).flat().find((e) => e.name === "water pistol");
  const pid = m0.addProp({ name: "bright neon blue and orange water blaste", archetype: "launcher", recipe: { ...recipe, name: "bright neon blue and orange water blaste" }, origin: "test" });
  const q = m0.enqueue({ kind: "prop", request: "water blaster: a bright neon blue and orange water blaster" });
  m0.db.prepare("UPDATE queue SET status = 'done', result_id = ?, revealed = 1 WHERE id = ?").run(pid, q.id);
  m0.addMove({ name: "blaste trick", recipe: Object.values(MOTIONS)[0], origin: "test", source: "posed" });
  m0.db.close?.();
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Yay!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db, port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, cloud: false });
  const base = `http://127.0.0.1:${S.port}`, post = async (u, b) => fetch(base + u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  try {
    assert.equal(S.memory.props().find((p) => p.id === pid).name, "water blaster");
    assert.ok(S.memory.moves().some((m) => m.name === "blaster trick"));
    assert.equal((await post("/api/activity/done", { kind: "routine", id: "__proto__" })).status, 400);
    assert.equal((await post("/api/activity/done", { kind: "routine", id: "x".repeat(50) })).status, 400);
    assert.equal((await post("/api/activity/done", { kind: "routine", id: "drums" })).status, 200);
    assert.deepEqual(Object.keys(S.memory.get("book.done", {})), ["drums"]);
  } finally { await S.close(); }
});

