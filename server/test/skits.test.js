// Little scenes from the conversation (Nov 4: "if I tell mochi if he has eaten something and he is like 'no not yet'
// and then mimi shows up with some food…"), and the piggyback ride.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { skitMoment, clean, fallbackSkit, writeSkit, skitThings, skitSummary, skitLead, skitPeekLine, pickShape, SHAPES, EDIBLE } from "../skits.js";
import { piggyIntent } from "../brain.js";
import { createServer } from "../index.js";

test("the moments a scene can follow", () => {
  const need = (t, r = "", f = {}) => (skitMoment(t, r, f) || {}).need || null;
  assert.equal(need("have you eaten anything today?", "No, not yet! My tummy is rumbling."), "hungry");
  assert.equal(need("have you eaten?", "Yes! I had a cookie."), null, "he has: no scene");
  assert.equal(need("are you tired?", "A little bit… *yawns*"), "tired");
  assert.equal(need("it's so cold today", "Brr!"), "cold");
  assert.equal(need("I had a really bad day", "Oh no."), "sad_you");
  assert.equal(need("I had a really bad day", "Oh no.", { crisis: true }), null, "never on a crisis line");
  assert.equal(need("I got the job!!", "Yay!"), "good_news");
  assert.equal(need("can you and your friends act out a little story?"), "story");
  assert.equal(need("where's mimi?", "At home!"), "miss"); assert.equal(skitMoment("where's mimi?", "", {}).who, "mimi");
  assert.equal(need("I am bored"), "bored");
  assert.equal(need("how are you"), null);
  assert.equal(skitMoment("act out a little story", "", {}).chance, 1, "asked for: always");
});

test("a written scene is kept to what the stage can play", () => {
  const sk = clean({ title: "t", beats: [
    { who: "mimi", do: "give", with: "cookie", how: "", line: "" },   // gives before she's here
    { who: "mochi", do: "eat", with: "", how: "", line: "" },
    { who: "mochi", do: "say", with: "", how: "", line: "Mimi: Hehe, enjoy! ♡" },   // her line in his
    { who: "cocoa", do: "hug", with: "", how: "", line: "" },          // Cocoa was never here
    { who: "mochi", do: "eat", with: "", how: "", line: "Nom" },        // nothing left to eat
    { who: "mochi", do: "give", with: "", how: "", line: "" },          // he can't give
  ] });
  const seq = sk.beats.map((b) => `${b.who}:${b.do}${b.with ? `(${b.with})` : ""}`);
  assert.deepEqual(seq, ["mimi:arrive(cookie)", "mimi:give(cookie)", "mochi:eat(cookie)", "mimi:friend_say", "cocoa:arrive", "cocoa:hug", "mochi:feel"]);
  assert.equal(sk.beats[3].line, "Hehe, enjoy! ♡");
  // brought and never handed over: handed over after the first thing she says
  const k = clean({ title: "x", beats: [{ who: "mimi", do: "arrive", with: "scarf", line: "" }, { who: "mimi", do: "friend_say", line: "Brr! For you ♡" }, { who: "mochi", do: "aside", line: "Isn't she sweet?" }] });
  assert.deepEqual(k.beats.map((b) => b.do), ["arrive", "friend_say", "give", "aside"]);
  // words on action beats (as Gemma writes them, from the bench on the M5) get said: as she arrives, before she hands
  // it over, after he eats; a friend's line naming themselves is his
  const g = clean({ title: "Cocoa's Surprise Snack", beats: [
    { who: "cocoa", do: "arrive", with: "pizza slice", how: "surprised", line: "Yo, did I hear someone's tummy rumbling?" },
    { who: "mochi", do: "feel", how: "surprised", line: "Cocoa! You scared me!" },
    { who: "cocoa", do: "give", with: "pizza slice", how: "shy", line: "I brought this for you, bro." },
    { who: "mochi", do: "eat", with: "pizza slice", how: "happy", line: "Nom nom… so yummy!" },
    { who: "cocoa", do: "hug", how: "happy", line: "You're the best, Cocoa!" },
    { who: "cocoa", do: "friend_say", line: "Cocoa here, always!" } ] });
  assert.deepEqual(g.beats.map((b) => `${b.who}:${b.do}${b.line ? `"${b.line}"` : ""}`), ["cocoa:arrive", 'cocoa:friend_say"Yo, did I hear someone\'s tummy rumbling?"', 'mochi:feel"Cocoa! You scared me!"',
    'cocoa:friend_say"I brought this for you, bro."', "cocoa:give", "mochi:eat", 'mochi:say"Nom nom… so yummy!"', "cocoa:hug", 'mochi:say"You\'re the best, Cocoa!"', 'cocoa:friend_say"Cocoa here, always!"']);
  // from the second bench: Cocoa called over, then "arrives" with the confetti (handed over after he's come, not
  // before the call); "Mmm, so yummy!" with a cupcake in his hoof and no eat beat: he eats it
  const c = clean({ beats: [{ who: "mochi", do: "call", line: "Cocoa! Come quick!" }, { who: "cocoa", do: "arrive", with: "confetti popper", line: "" }, { who: "mochi", do: "aside", line: "They came!" },
    { who: "mimi", do: "arrive", with: "cupcake", line: "" }, { who: "mimi", do: "give", with: "cupcake", line: "" }, { who: "mochi", do: "feel", how: "happy", line: "Mmm, it is so yummy and sweet!" }] });
  assert.deepEqual(c.beats.map((b) => `${b.who}:${b.do}`), ["mochi:call", "cocoa:give", "mochi:aside", "mimi:arrive", "mimi:give", "mochi:eat", "mochi:feel"]);
  assert.equal(c.beats[5].with, "cupcake");
  // whoever peeked in comes, even if the scene forgot them
  assert.ok(clean({ beats: [{ who: "cocoa", do: "arrive", line: "" }, { who: "cocoa", do: "friend_say", line: "Hi!" }] }, { who: "mimi", peeked: true }).beats.some((b) => b.who === "mimi" && b.do === "arrive"));
  // a different shape each time, not one of the last few
  let n0 = 3; const r0 = () => ((n0 = (n0 * 9301 + 49297) % 233280) / 233280), seen = [];
  for (let i = 0; i < 12; i++) { const sh = pickShape(seen, r0); assert.ok(!seen.slice(-3).includes(sh.id), `${sh.id} again`); seen.push(sh.id); }
  assert.ok(new Set(seen).size >= 6); assert.ok(SHAPES.length >= 8);
  assert.notEqual(pickShape([], () => 0.45, "sad_you").id, "mixup");
  // every hand-written one plays: friends arrive before they act, food is given before it's eaten
  for (const need of ["hungry", "thirsty", "tired", "cold", "rain", "sad_him", "sad_you", "bored", "good_news", "birthday", "miss", "story"]) for (let i = 0; i < 4; i++) {
    let n = i * 31 + 7; const rnd = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const f = fallbackSkit({ need, text: "" }, { rnd }), here = new Set(); let holding = null;
    assert.ok(f.beats.length >= 4, `${need}: ${f.beats.length} beats`);
    for (const b of f.beats) {
      if (b.do === "arrive") here.add(b.who);
      if (b.who !== "mochi") assert.ok(here.has(b.who), `${need}: ${b.who} ${b.do} before arriving`);
      if (b.do === "give") holding = b.with;
      if (b.do === "eat") { assert.ok(holding && EDIBLE.has(holding), `${need}: eats ${holding}`); holding = null; }
    }
    for (const w of Object.keys(skitThings(f))) assert.ok(f.beats.some((b) => b.with === w));
  }
});

test("Gemma writes it, fresh, told the recent ones; a hand-written one if it can't", async () => {
  let user = "", system = "";
  const llm = { chat: async (o) => { user = o.user; system = o.system; return { json: { title: "Soup surprise", beats: [
    { who: "mimi", do: "arrive", with: "bowl of soup", how: "", line: "" }, { who: "mimi", do: "friend_say", with: "", how: "", line: "I thought I'd bring you some soup! ♡" },
    { who: "mochi", do: "feel", with: "", how: "surprised", line: "" }, { who: "mimi", do: "give", with: "bowl of soup", how: "", line: "" },
    { who: "mochi", do: "say", with: "", how: "", line: "For me? Thank you, Mimi!" }, { who: "mochi", do: "eat", with: "", how: "", line: "" },
    { who: "mochi", do: "aside", with: "", how: "", line: "Isn't she the sweetest?" } ] } }; } };
  const m = skitMoment("have you eaten anything?", "No, not yet!", {});
  const sk = await writeSkit({ llm, moment: m, userText: "have you eaten anything?", reply: "No, not yet!", recent: ["Cocoa's pizza party"] });
  assert.equal(sk.from, "model"); assert.equal(sk.title, "Soup surprise");
  assert.equal(sk.beats.find((b) => b.do === "eat").with, "bowl of soup");
  assert.match(user, /hasn't eaten yet/); assert.match(user, /No, not yet!/); assert.match(user, /do something else this time\): Cocoa's pizza party/);
  assert.match(system, /Things a friend can bring: .*bowl of soup/);
  assert.match(skitSummary(sk), /Mimi came by with a bowl of soup, Mimi gave me the bowl of soup, I ate the bowl of soup, I told you "Isn't she the sweetest\?"/);
  // who comes is settled first, so they can peek in while it's written; the model's told they did
  assert.deepEqual(skitLead({ need: "hungry", who: "cocoa" }), { who: "cocoa", both: false });
  assert.deepEqual(skitLead({ need: "good_news" }), { who: "mimi", both: true });
  assert.match(skitPeekLine("hungry", "mimi", () => 0), /Not eaten yet/);
  assert.match(skitPeekLine("nope", "cocoa"), /dude/);
  await writeSkit({ llm, moment: { ...m, who: "mimi", peeked: true }, userText: "x", reply: "y" });
  assert.match(user, /Who comes first: Mimi \(she peeked in a moment ago, heard, and went to get something\)/);
  await writeSkit({ llm, moment: m, userText: "x", reply: "y", recentShapes: ["plain", "call", "shy"], recentLines: ["Cocoa! You scared me!"] });
  assert.match(user, /The shape this time: /); assert.doesNotMatch(user, /The shape this time: (the friend turns up out of the blue|Mochi calls a friend over|the friend is a little shy)/);
  assert.match(user, /Lines already used \(say it differently\): "Cocoa! You scared me!"/);
  const broken = await writeSkit({ llm: { chat: async () => ({ text: "Ooh, a kite!" }) }, moment: m, log: { warn() {} } });
  assert.equal(broken.from, "hand-written"); assert.ok(broken.beats.some((b) => b.do === "give"));
});

test("a piggyback ride, asked for", () => {
  assert.equal(piggyIntent("give mimi a piggyback ride"), "mimi");
  assert.equal(piggyIntent("can cocoa ride on your back?"), "cocoa");
  assert.equal(piggyIntent("Mimi, jump on Mochi's back!"), "mimi");
  assert.equal(piggyIntent("piggy back!"), "mimi");
  assert.equal(piggyIntent("give Cocoa a shoulder ride"), "cocoa");
  assert.equal(piggyIntent("don't give mimi a piggyback ride"), null);
  assert.equal(piggyIntent("I put my bag on my back"), null);
});

test("the chat route: his answer, then a scene for it pushed to the page; a piggyback on the spot", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-skit-"));
  let notes = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), sys = body.messages[0].content, user = [...body.messages].reverse().find((m) => m.role === "user").content;
    if (/tiny stage scenes/.test(sys)) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify({ title: "Cocoa's cookie run", beats: [
      { who: "cocoa", do: "arrive", with: "cookie", how: "", line: "" }, { who: "cocoa", do: "friend_say", with: "", how: "", line: "Heard you're hungry, dude!" },
      { who: "cocoa", do: "give", with: "cookie", how: "", line: "" }, { who: "mochi", do: "eat", with: "", how: "", line: "" }, { who: "mochi", do: "aside", with: "", how: "", line: "Best buddy ever." }] }) }, finish_reason: "stop" }] }), { status: 200 });
    notes = sys;
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: /eaten/.test(user) ? "No, not yet! My tummy is rumbling." : "Wheee!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "s.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, skitRandom: () => 0 });
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`), got = [], soon = [];
  ws.on("message", (raw) => { try { const m = JSON.parse(String(raw)); if (m.type === "skit") got.push(m); if (m.type === "skitSoon") soon.push(m); } catch (_) { /* fine */ } });
  await new Promise((ok) => ws.on("open", ok));
  const say = async (text) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json();
  try {
    const r = await say("have you eaten anything today?");
    assert.equal(r.reply.text, "No, not yet! My tummy is rumbling.");
    for (let i = 0; i < 60 && !got.length; i++) await new Promise((ok) => setTimeout(ok, 100));
    assert.equal(got.length, 1, "the scene came after his answer");
    assert.equal(soon.length, 1, "whoever's coming peeked in first"); assert.ok(["mimi", "cocoa"].includes(soon[0].who)); assert.ok(soon[0].line.length > 5);
    assert.equal(got[0].title, "Cocoa's cookie run"); assert.equal(got[0].need, "hungry");
    assert.equal(got[0].things.cookie.name, "cookie", "the cookie's recipe comes with it");
    // he knows it happened
    await say("that was nice");
    assert.match(notes, /A few minutes ago, this happened on your stage with your friends: Cocoa's cookie run: Cocoa came by with a cookie/);
    const p = await say("give mimi a piggyback ride!");
    assert.equal(p.piggy, "mimi"); assert.match(notes, /Mimi hopped up onto your back for a piggyback ride/);
  } finally { ws.close(); await S.close(); }
});

test("eating, asked for: 'eat your noodles', 'drink your tea' (a bite, a sip or a spoonful, by what it is)", async () => {
  const { propIntent } = await import("../brain.js");
  const { eatStyle } = await import("../../shared/craft.js");
  const props = [{ id: 1, name: "bowl of noodles", archetype: "companion", recipe: {} }];
  assert.equal(propIntent({ text: "eat your noodles", props }).use, "eat");
  assert.equal(propIntent({ text: "drink your hot cocoa", props }).prop.name, "hot cocoa", "from his pocket");
  for (const t of ["did you eat?", "I ate pizza", "what do you eat", "don't eat that"]) assert.equal(propIntent({ text: t, props }), null, t);
  assert.equal(eatStyle("bowl of noodles"), "scoop"); assert.equal(eatStyle("cup of tea"), "sip"); assert.equal(eatStyle("cookie"), "bite");
  assert.equal(eatStyle("magnifying glass"), null); assert.equal(eatStyle("water pistol"), null); assert.equal(eatStyle("traffic cone"), null);
});

test("a friend narrating themselves is acted out, not said (Nov 7: \"Cocoa starts laughing so hard he can't stop, dude!\")", async () => {
  const { clean } = await import("../skits.js");
  const { narrated } = await import("../../shared/speech.js");
  assert.equal(narrated("Cocoa starts laughing so hard he can't stop, dude!", "cocoa").act, "laugh");
  assert.equal(narrated("Mochi looks amazing!", "mimi"), null, "another's name: still words");
  assert.equal(narrated("I have to go now! See you later ♡", "mimi"), null);
  const sk = clean({ title: "t", beats: [{ who: "cocoa", do: "arrive", with: "", how: "", line: "" }, { who: "cocoa", do: "friend_say", with: "", how: "", line: "Cocoa starts laughing so hard he can't stop, dude!" }, { who: "mimi", do: "friend_say", with: "", how: "", line: "*Mimi twirls happily*" }] }, {});
  const c = sk.beats.find((b) => b.who === "cocoa" && b.do !== "arrive");
  assert.equal(c.do, "feel"); assert.equal(c.how, "laugh"); assert.equal(c.line, "");
  assert.ok(!sk.beats.some((b) => /twirls|laughing/.test(b.line || "")), "no stage directions said out loud");
});
