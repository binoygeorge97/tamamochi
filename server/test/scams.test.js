// The scam-spotting game (Nov 7, the T-Mobile track): a friend shows him a made-up scam message on the magenta phone,
// he asks you what looks fishy, your answer is checked against that message's tells, he says what you spotted and
// what you missed and the safe thing to do, then they delete it and block it, and the badge counts it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { SCENES, TELLS, TELL_IDS, scamGameAsk, pickScene, scamScene, gradeAnswer, answerNote, afterScene, PHONE } from "../scams.js";
import { skitMoment, skitThings } from "../skits.js";
import { createServer } from "../index.js";

test("asking for the game, and not: a message to check, or it happened to them", () => {
  for (const t of ["play the scam game", "Play the scam-spotting game", "teach me about scams", "do a skit about scams with Mimi", "how do I spot a scam?", "what is phishing?", "can we practise spotting fake texts?"])
    assert.equal(skitMoment(t, "", {}).need, "scam", t);
  for (const t of ["is this a scam? you won a prize", "check this https://x.win", "I got scammed yesterday", "scams are bad", "let's play a game"])
    assert.notEqual((skitMoment(t, "", {}) || {}).need, "scam", t);
});

test("every scene: short lines, real tells, the phone handed over, and his question to you at the end", () => {
  for (const sc of SCENES) {
    assert.ok(sc.tells.length >= 3 && sc.tells.every((id) => TELL_IDS.includes(id)), sc.id);
    for (const w of Object.keys(sc.lines)) {
      const s = scamScene(sc.id, w);
      for (const b of s.beats) assert.ok(!b.line || b.line.length <= 90, `${sc.id}: "${b.line}" fits a bubble`);
      assert.equal(s.beats[0].do, "arrive"); assert.equal(s.beats[0].with, PHONE);
      assert.ok(s.beats.some((b) => b.do === "give" && b.with === PHONE), "he holds the phone");
      assert.equal(s.beats.at(-1).do, "aside"); assert.match(s.beats.at(-1).line, /\?/);
      assert.deepEqual(s.quiz, { id: sc.id, who: s.quiz.who, tells: sc.tells });
      assert.ok(!/https?:|www\.|\.com\b/.test(JSON.stringify(s)), "no real address in it");
      assert.ok(skitThings(s)[PHONE], "the page gets the phone's pattern");
    }
  }
  // a fresh one each time; a scene that needs a certain friend gets them
  const seen = new Set(); let recent = [];
  for (let i = 0; i < 6; i++) { const p = pickScene(recent, null, () => (i * 0.37) % 1); assert.ok(!recent.slice(-3).includes(p.id)); seen.add(p.id); recent = [...recent, p.id]; }
  assert.ok(seen.size >= 4);
  assert.equal(pickScene([], "mimi", () => 0.99).who, "mimi");
  assert.equal(scamScene("friend", "mimi").quiz.who, "cocoa", "only Cocoa gets the text from 'Mimi'");
});

test("your answer: what you spotted, what you missed; anything else isn't an answer", () => {
  const q = scamScene("prize", "mimi").quiz;   // prize, hurry, link, stranger
  assert.deepEqual(gradeAnswer("the link, and it rushes you", q).found, ["hurry", "link"]);
  assert.deepEqual(gradeAnswer("you never entered for a prize and it's from a random number", q).found, ["prize", "stranger"]);
  assert.deepEqual(gradeAnswer("umm the 10 minutes thing?", q).missed, ["prize", "link", "stranger"]);
  assert.equal(gradeAnswer("I don't know", q).idk, true);
  assert.equal(gradeAnswer("it's fake", q).guessed, true);
  assert.deepEqual(gradeAnswer("it wants her password", q).also, ["code"], "a real tell, just not in this one");
  for (const t of ["make me a hat", "let's dance", "never mind", "what's your favourite colour?"]) assert.equal(gradeAnswer(t, q), null, t);
  const g = gradeAnswer("the link", q), note = answerNote(q, g, { spotted: 2 });
  assert.match(note, /They spotted: it wants you to tap a link/); assert.match(note, /Still to tell them: .*won something.*rushes you.*number you don't know/);
  assert.match(note, /never share a code or password, ask a grown-up/); assert.match(note, /Don't write lines for Mimi/);
  const after = afterScene(q, g, 2);
  assert.equal(after.beats[0].do, "arrive"); assert.match(after.beats.map((b) => b.line).join(" "), /Delete… and block!/); assert.match(after.beats.at(-2).line, /That's 2 now/);
});

test("in the chat: the game, your answer, his reply, the delete-and-block scene, and the count on the badge", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-scam-"));
  let sys = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body); sys = body.messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
    if (/tiny stage scenes/.test(body.messages[0].content)) throw new Error("the game is never written by the model");
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: /scam-spotting game: .* just showed you/.test(sys) ? "Yes! The link is a trick. Never tap it!" : "Ooh, the scam-spotting game! Watch closely…" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "s.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, skitRandom: () => 0 });
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`), got = [];
  ws.on("message", (raw) => { try { const m = JSON.parse(String(raw)); if (m.type === "skit") got.push(m); } catch (_) { /* fine */ } });
  await new Promise((ok) => ws.on("open", ok));
  const say = async (text) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json();
  const wait = async (n) => { for (let i = 0; i < 80 && got.length < n; i++) await new Promise((ok) => setTimeout(ok, 100)); };
  try {
    await say("Play the scam-spotting game");
    assert.match(sys, /Don't explain scams or name any warning signs now/);
    await wait(1);
    assert.equal(got.length, 1); assert.equal(got[0].need, "scam"); assert.ok(got[0].things[PHONE], "with the phone");
    // the first time scams come up he knows nothing: he downloads the scam-spotting pack, then the scene starts
    assert.equal(got[0].beats[0].who, "mochi"); assert.match(got[0].beats[0].line, /don't know anything about scams yet/);
    assert.equal(got[0].beats[1].do, "download"); assert.equal(got[0].beats[1].items.length, 7);
    assert.equal(got[0].waits, "quiz", "the stage knows the scene waits for an answer");
    const who = got[0].beats[3].who;
    assert.match(got[0].beats.at(-1).line, /what looks fishy/i);
    const r = await say("the link! and it's rushing you");
    assert.equal(r.reply.text, "Yes! The link is a trick. Never tap it!");
    assert.match(sys, /They spotted: /); assert.match(sys, /Still to tell them: /);
    await wait(2);
    assert.equal(got[1].need, "scam_after"); assert.equal(got[1].beats[0].who, who);
    const g = await (await fetch(`http://127.0.0.1:${S.port}/api/growth`)).json();
    assert.deepEqual(g.scams, { played: 1, spotted: 1, checked: 0, caught: 0 });
    assert.deepEqual(g.skills, ["spotting scams"], "he keeps the skill");
    // the next game: no download again, and no answer → the page asks for the ending; Mochi shows it himself
    S.memory.set("scam.quiz", { id: "parcel", who: "mimi", tells: ["pay", "link"], at: Date.now() });   // (a question left open)
    const w = await (await fetch(`http://127.0.0.1:${S.port}/api/scam/wrap`, { method: "POST" })).json();
    assert.ok(w.skit && w.skit.beats.length >= 4, "an ending");
    assert.ok(["hug", "dance"].includes(w.skit.beats.at(-1).do));
    assert.equal((await (await fetch(`http://127.0.0.1:${S.port}/api/scam/wrap`, { method: "POST" })).json()).skit, null, "only once");
    // the question was answered: the next message is just talk again
    await say("the link");
    assert.doesNotMatch(sys, /scam-spotting game: .* just showed you/);
  } finally { ws.close(); await S.close(); }
});

test("Cocoa the scammer: the call, Mochi's pause and three choices; each choice plays out; Teach Mimi", async () => {
  const { callScene, gradeChoice, choiceScene, CALLS, scamScene, afterScene } = await import("../scams.js");
  const { skitThings } = await import("../skits.js");
  for (const c of CALLS) {
    const s = callScene(c.id);
    assert.equal(s.beats[1].do, "dress"); assert.equal(s.beats[1].with, "disguise");
    assert.ok(skitThings(s)["job:disguise"].wear[0].name === "silly disguise", "the disguise is a real pattern");
    assert.match(s.beats.at(-2).line, /What should Mimi do/); assert.match(s.beats.at(-1).line, /^1\) .*2\) .*3\) /);
    for (const pick of ["hang", "ask", "code"]) { const r = choiceScene(s.choice, pick); assert.equal(r.good, pick === "hang"); assert.ok(r.beats.length >= 4 && r.beats.every((b) => b.who && b.do)); }
    assert.equal(gradeChoice(String(c.order.indexOf("hang") + 1), s.choice), "hang");
  }
  const ch = callScene("bank-code").choice;
  assert.equal(gradeChoice("the second one", ch), "hang"); assert.equal(gradeChoice("hang up!", ch), "hang");
  assert.equal(gradeChoice("ask him who he is", ch), "ask"); assert.equal(gradeChoice("read him the code", ch), "code");
  assert.equal(gradeChoice("make me a hat", ch), null);
  // Teach Mimi: she remembers what you spotted, and spots it herself next time
  const q = scamScene("prize", "mimi").quiz, after = afterScene(q, { found: ["hurry"], missed: ["prize"] }, 1);
  assert.match(after.beats.map((b) => b.line).join(" "), /I'm going to remember that: it rushes you/);
  const again = scamScene("prize", "mimi", { learned: { hurry: { said: "it rushes you" } } });
  assert.match(again.beats.map((b) => b.line).join(" "), /I remember what you taught me! It rushes you/);
  assert.ok(!again.quiz.tells.includes("hurry") && again.quiz.remembered === "hurry");
  assert.ok(!scamScene("code", "cocoa", { learned: { code: {} } }).quiz.remembered, "Cocoa didn't learn it: Mimi did");
});

test("a scene they asked for is the answer: no tools that turn, so he can't wander off into a made-up routine (Nov 7)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-scam2-")), bodies = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body); bodies.push(body);
    // what Gemma did on the share link: called do_activity instead of just answering
    if (body.tools) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", type: "function", function: { name: "do_activity", arguments: JSON.stringify({ kind: "improvise", ask: "skit on scam" }) } }] }, finish_reason: "tool_calls" }] }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Ooh, the scam-spotting game! Watch closely…" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "s.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, skitRandom: () => 0 });
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`), got = [];
  ws.on("message", (raw) => { try { const m = JSON.parse(String(raw)); if (m.type === "skit") got.push(m); } catch (_) { /* fine */ } });
  await new Promise((ok) => ws.on("open", ok));
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Show skit on scam", id: "x1" }) })).json();
    assert.ok(!r.reply.activity, "no made-up routine");
    assert.ok(!bodies.some((b) => b.tools), "no tools offered on a scene turn");
    for (let i = 0; i < 80 && !got.length; i++) await new Promise((ok) => setTimeout(ok, 100));
    assert.equal(got.length, 1); assert.equal(got[0].need, "scam");
  } finally { ws.close(); await S.close(); }
});

test("\"have a skit\" is a skit; \"again\" or \"another one\" right after a scam game is the scam game again", () => {
  const now = Date.now(), ctx = { lastNeed: "scam_after", lastAt: now };
  assert.equal(skitMoment("Have a skit", "", {}).need, "story");
  for (const t of ["Have a skit", "another one", "again!", "one more", "let's do it again"]) assert.equal(skitMoment(t, "", ctx).need, "scam", t);
  assert.equal(skitMoment("another one", "", { lastNeed: "scam", lastAt: now - 11 * 60000 }), null, "not after 10 minutes");
  assert.equal(skitMoment("do a skit where Mimi is a doctor", "", ctx).need, "jobs");
  assert.equal(skitMoment("I love pizza", "", ctx), null);
});
