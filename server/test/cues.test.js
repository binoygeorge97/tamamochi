// Props from the conversation (server/cues.js): what he takes out for what you said, and when he doesn't.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pickCue, CUES, pattern } from "../cues.js";
import { createServer } from "../index.js";

const cue = (text, decision = "neutral", ctx = {}) => { const c = pickCue(text, { decision, ...ctx }); return c && `${c.how} ${c.prop.name}`; };

test("every prop cue has a hand-made pattern to take out; the others bring friends", () => {
  for (const c of CUES) assert.ok(c.prop ? pattern(c.prop) : c.friends && c.friends.length, `${c.id}: ${c.prop}`);
});

test("Mimi and Cocoa join in when it fits", () => {
  const fr = (text, decision = "neutral", ctx = {}) => { const c = pickCue(text, { decision, ...ctx }); return c && c.friends.map((f) => `${f.who}:${f.role}`).join(" "); };
  assert.equal(fr("who's your best friend?"), "cocoa:hello");
  assert.equal(fr("do you have any friends"), "cocoa:hello");
  assert.equal(fr("i'm so bored"), "cocoa:play");
  assert.equal(fr("let's play soccer"), "cocoa:play");
  assert.equal(fr("tell me a joke"), "cocoa:giggle");
  assert.equal(fr("let's dance!"), "mimi:dance cocoa:dance");
  assert.equal(fr("IT'S MY BIRTHDAY", "cheer"), "mimi:cheer cocoa:cheer", "a party: everyone comes");
  assert.equal(fr("what music do you like"), "mimi:dance");
  assert.equal(fr("lol you're so slow", "pout"), "mimi:giggle");
  assert.equal(fr("i feel so lonely", "comfort"), "mimi:comfort");
  const now = Date.now();
  assert.equal(fr("where's cocoa?", "neutral", { lastAny: now - 1000, since: 0, now }), "cocoa:hello", "asked for by name: always");
  assert.equal(fr("i'm bored", "neutral", { lastAny: now - 1000, now }), null, "otherwise not right after another entrance");
  assert.equal(fr("tell me a joke", "hurt"), null, "not when he's hurt");
  assert.equal(pickCue("who's your best friend?", { decision: "neutral" }).prop, null, "no prop for that");
});

test("the right prop for what they said", () => {
  assert.equal(cue("mochi do you know which country border india"), "study desk globe");
  assert.equal(cue("what's the capital of Japan?"), "study desk globe");
  assert.equal(cue("how do I get to the park from here"), "study folded map");
  assert.equal(cue("how tall is the eiffel tower"), "study wooden ruler");
  assert.equal(cue("ugh it's raining again"), "hold little blue umbrella");
  assert.equal(cue("I GOT THE JOB!!!", "cheer"), "cheer confetti popper");
  assert.equal(cue("heads or tails?"), "use big gold coin");
  assert.equal(cue("what music do you like?"), "wear magenta headphones");
  assert.equal(cue("the power went out", "concern"), "hold flashlight");
  assert.equal(cue("you are the king", "affection"), "wear golden crown");
  assert.equal(cue("going on a bike ride later"), "wear protective helmet");
  assert.equal(cue("i'm saving up for a trip", "neutral"), "beside piggy bank");
  assert.equal(cue("i feel so lonely tonight", "comfort"), "beside little teddy bear");
  assert.equal(cue("lol you're so slow", "pout"), "squirt water pistol", "a tease: a squirt, right at them");
  assert.equal(cue("you're so slow", null), "squirt water pistol", "without the feelings model, tease words");
});

test("and when he doesn't", () => {
  assert.equal(cue("you suck", "hurt"), null, "hurt is not playful: no squirt");
  assert.equal(cue("i cut my finger", "concern"), null);
  assert.equal(cue("what's the capital of france", "neutral", { care: true }), null, "never in care mode");
  assert.equal(cue("which country borders india", "neutral", { crisis: true }), null);
  assert.equal(cue("which country borders india", "neutral", { sulking: true }), null);
  assert.equal(cue("can you make me a globe?"), null, "asking for one goes to the workbench");
  assert.equal(cue("let's brainstorm"), null);
  assert.equal(cue("hey what's up"), null);
  assert.equal(cue("it's raining and i'm so sad", "comfort"), null, "not when they're hurting");
  const now = Date.now();
  assert.equal(cue("lol you're so slow", "pout", { lastFired: { squirt: now - 30000 }, now }), null, "a squirt rests a few minutes");
  assert.equal(cue("and the capital of peru?", "neutral", { lastFired: { globe: now - 20000 }, now }), null, "not the globe again straight away");
  assert.equal(cue("and the capital of peru?", "neutral", { lastFired: { globe: now - 70000 }, now }), "study desk globe", "a minute later it can come out again");
  assert.equal(cue("ugh it's raining", "neutral", { lastAny: now - 10000, now }), null, "props come out now and then, not every message");
  assert.equal(cue("ugh it's raining", "neutral", { since: 1, now }), null);
  assert.equal(cue("ugh it's raining", "neutral", { lastAny: now - 60000, since: 3, now }), "hold little blue umbrella");
  assert.equal(cue("lol you're so slow", "pout", { lastAny: now - 5000, since: 0, now }), "squirt water pistol", "a tease has its own rest");
  assert.equal(cue("which country borders india", "neutral", { holding: { name: "desk globe" } }), null, "already out: just answer");
});

test("his own prop is used if he made one", () => {
  const mine = { id: 7, name: "Confetti Rocket Launcher", archetype: "launcher", recipe: { name: "Confetti Rocket Launcher", archetype: "launcher", parts: [] } };
  const c = pickCue("happy birthday to me!", { decision: "cheer", owned: [mine] });
  assert.equal(c.prop.id, 7);
  const g = pickCue("which countries border india", { decision: "neutral", owned: [mine] });
  assert.equal(g.prop.name, "desk globe"); assert.ok(g.prop.pocket);
});

test("the server sends the cue with his first reaction and tells the brain", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-cue-"));
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    system = JSON.parse(init.body).messages[0].content;
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Let me check my globe... Pakistan, China, Nepal, Bhutan, Bangladesh and Myanmar!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "c.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "mochi do you know which country border india", id: "g1" }) })).json();
    assert.equal(r.cue.how, "study"); assert.equal(r.cue.prop.name, "desk globe"); assert.ok(r.cue.prop.recipe.parts.length > 5);
    assert.match(system, /took out your desk globe/);
    assert.match(system, /Your pocket: .*desk globe/);
    const r2 = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "hey", id: "g2" }) })).json();
    assert.equal(r2.cue, null);
  } finally { await S.close(); }
});
