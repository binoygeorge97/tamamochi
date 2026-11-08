// Hints about his friends (Nov 7, server/hints.js): "I think Mimi wants a piggyback ride" → he asks her, she answers,
// and only a yes leads to it. A plain request still happens at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hintIntent, hintPlan, hintNote, hintClean, RECENT_MS } from "../hints.js";
import { createServer } from "../index.js";

test("a guess about a friend is a hint; a request, a no or someone else's story isn't", () => {
  const h = (t) => hintIntent(t);
  assert.deepEqual(h("i think Mimi wants a piggy back ride"), { who: "mimi", want: "piggy", thing: null });
  assert.deepEqual(h("i think cocoa is looking at your food and wants some"), { who: "cocoa", want: "food", thing: null });
  for (const [t, who] of [["Mimi looks hungry", "mimi"], ["I bet Cocoa wants some of your cookie", "cocoa"], ["Cocoa keeps staring at your pizza", "cocoa"], ["maybe Mimi would like a piggyback ride", "mimi"], ["Mimi said she wants a piggyback ride", "mimi"], ["I think Cocoa is hungry", "cocoa"]]) assert.equal((h(t) || {}).who, who, t);
  assert.equal(h("cocoa wants a bite of your apple").thing, "apple");
  for (const t of ["give Mimi a piggyback ride", "can you give cocoa a piggyback ride?", "share your cookie with Cocoa", "Mimi is not hungry", "I think Mimi wants to dance", "Cocoa wants hot cocoa", "Mimi doesn't want a piggyback ride", "I went for a piggyback ride", "let's give Mimi a piggyback ride"]) assert.equal(h(t), null, t);
});

test("they say yes, unless they had one a few minutes ago; the brain hears the question and the answer", () => {
  const now = 1e12, r = () => 0;
  const y = hintPlan({ who: "mimi", want: "piggy" }, { now, r });
  assert.equal(y.yes, true); assert.match(y.ask, /^Mimi, do you want a piggyback ride\?$/); assert.ok(y.answer);
  const n = hintPlan({ who: "cocoa", want: "food" }, { last: { food: { cocoa: now - 60000 } }, food: "cookie", now, r });
  assert.equal(n.yes, false); assert.match(n.ask, /cookie/); assert.equal(n.why, "just had a snack");
  assert.equal(hintPlan({ who: "cocoa", want: "food" }, { last: { food: { cocoa: now - RECENT_MS - 1 } }, now, r }).yes, true, "a while ago: yes again");
  assert.equal(hintPlan({ who: "mimi", want: "food" }, { last: { food: { cocoa: now } }, now, r }).yes, true, "Cocoa ate, not Mimi");
  assert.match(hintNote(y), /you asked her, "Mimi, do you want a piggyback ride\?", and she said yes .*hopped onto your back/);
  assert.match(hintNote(n), /he said no \(".+"\): he just had a snack.*be fine with his answer/);
});

test("in the chat: he asks, she answers, the yes plays; asked again straight after, a kind no; a request still goes at once", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-hint-"));
  const bodies = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Wheee!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "h.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: async () => ({ decision: "neutral", request: "perform", ms: 1 }) });
  const post = async (body) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  const sys = () => bodies.at(-1).messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  try {
    let r = await post({ text: "i think Mimi wants a piggy back ride", id: "h1", rule: "nod" });
    assert.equal(r.hint.who, "mimi"); assert.equal(r.hint.yes, true); assert.match(r.hint.ask, /Mimi/);
    assert.equal(r.piggy, "mimi", "her yes: the piggyback ride");
    assert.match(sys(), /you asked her, ".*", and she said yes/);
    r = await post({ text: "maybe Mimi wants another piggyback ride", id: "h2", rule: "nod" });
    assert.equal(r.hint.yes, false); assert.equal(r.piggy, null, "she just had one: no ride");
    assert.match(sys(), /she said no/);
    r = await post({ text: "i think cocoa is looking at your food and wants some", id: "h3", rule: "nod" });
    assert.equal(r.hint.who, "cocoa"); assert.equal(r.hint.want, "food"); assert.equal(r.hint.yes, true);
    assert.deepEqual(r.share.who, ["cocoa"]); assert.equal(r.share.food, true); assert.equal(r.hint.food, r.share.prop.name);
    assert.ok(!r.activity && !r.cue, "nothing else on top");
    r = await post({ text: "give Mimi a piggyback ride", id: "h4", rule: "nod" });
    assert.equal(r.hint, null); assert.equal(r.piggy, "mimi", "asked straight: at once, as before");
  } finally { await S.close(); }
});

test("his reply doesn't ask again or say her answer for her (Nov 7, on the M5: the question and the yes came twice)", () => {
  const p = hintPlan({ who: "mimi", want: "piggy" }, { r: () => 0.6 });   // "Hey Mimi, want a ride on my back?" / "Ooh, yes! Can I?"
  assert.equal(hintClean("Oh, I think you might be right! Hey Mimi, want a ride on my back?", p), "Oh, I think you might be right!");
  assert.equal(hintClean("Ooh, yes! Can I? Here we go!", p), "Here we go!");
  assert.equal(hintClean('Mimi: "Ooh, yes! Can I?" ♡ Wheee!', p), "Wheee!");
  assert.equal(hintClean("Wheee! Hold on tight, Mimi!", p), "Wheee! Hold on tight, Mimi!", "a reply that follows on is kept");
  assert.equal(hintClean("Hey Mimi, want a ride on my back?", p), "Hold on tight, Mimi! Wheee!", "nothing left: a line that follows on");
  const f = hintPlan({ who: "cocoa", want: "food" }, { food: "cookie", r: () => 0 });
  assert.equal(hintClean("Hey buddy, want some cookie? Here you go!", f), "Here you go!");
  assert.match(hintNote(p), /already happened on screen.*Don't ask her again and don't say Mimi's line for her/);
});
