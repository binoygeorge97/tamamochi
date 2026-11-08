// Activities he really does (Nov 3): painting, juggling, party tricks; and no pretending.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { activityIntent, paintAnswer, paintSubject, cleanPainting, fallbackPainting, planPainting, pickTrick, juggled, juggleSpec, honesty } from "../activities.js";
import { createServer } from "../index.js";

test("what counts as asking for an activity (and what doesn't)", () => {
  assert.deepEqual(activityIntent("can you paint something for me?"), { kind: "paint", subject: null });
  assert.equal(activityIntent("paint me a picture of a red dragon").subject, "a red dragon");
  assert.equal(activityIntent("draw Mimi").subject, "Mimi");
  assert.equal(activityIntent("make me a portrait of my dog").subject, "your dog");
  assert.equal(activityIntent("juggle!").kind, "juggle");
  assert.equal(activityIntent("show me a cool party trick").kind, "trick");
  assert.equal(activityIntent("pull a rabbit out of a hat").kind, "trick");
  for (const t of ["I painted my room today", "my drawing is in the fridge", "I drew you a hat! Can you make it?", "draw a card", "what is your favourite trick?", "trick or treat!", "don't paint", "I love magic"]) assert.equal(activityIntent(t), null, t);
  // "What should I paint?" … "a sheep" (M5, Nov 3)
  assert.deepEqual(paintAnswer("a sheep", "Ooh, I'd love to! What should I try to paint?"), { kind: "paint", subject: "a sheep" });
  assert.equal(paintAnswer("no thanks", "What should I paint?"), null);
  assert.equal(paintAnswer("a sheep", "How was your day?"), null);
  assert.equal(paintSubject("paint me"), "you");
});

test("a painting: the model's plan, cleaned; a hand-made one when it can't", async () => {
  const p = cleanPainting({ title: "Dragon<script>", background: "blue", shapes: [{ shape: "circle", x: 500, y: 20, w: 10, h: 10, color: "#FF0000", rotate: 0 }, { shape: "squiggle", x: 10, y: 10, w: 5, h: 5, color: "nope", rotate: 0 }] }, "a dragon");
  assert.equal(p.title, "Dragonscript"); assert.equal(p.background, "#bfe6ff"); assert.equal(p.shapes[0].x, 110); assert.equal(p.shapes[0].color, "#ff0000"); assert.equal(p.shapes[1].shape, "blob");
  const fb = fallbackPainting("a sheep"); assert.ok(fb.shapes.length >= 8);
  const llm = { chat: async () => ({ json: { title: "a sheep", background: "#bfe6ff", shapes: Array.from({ length: 9 }, (_, i) => ({ shape: "circle", x: 10 * i, y: 30, w: 8, h: 8, color: "#ffffff", rotate: 0 })) } }) };
  assert.equal((await planPainting({ llm, subject: "a sheep" })).shapes.length, 9);
  const down = await planPainting({ llm: { chat: async () => { throw new Error("down"); } }, subject: "a cat", log: { warn() {} } });
  assert.match(down.title, /cat/); assert.ok(down.shapes.length >= 8);
});

test("tricks and juggling: what he picks, what the workbench makes, getting better", () => {
  assert.equal(pickTrick({ ask: "balance a ball on your head" }).trick, "balance");
  assert.equal(pickTrick({ ask: "can you make yourself disappear" }).trick, "vanish");
  const rabbit = pickTrick({ ask: "pull a rabbit out of a hat", props: [] });
  assert.equal(rabbit.trick, "magic"); assert.equal(rabbit.make, "rabbit"); assert.equal(rabbit.reveal, null);
  const kite = pickTrick({ ask: "do a magic trick", props: [{ id: 2, name: "kite", archetype: "handheld_canopy", recipe: {} }] });
  assert.equal(kite.reveal.name, "kite");
  assert.notEqual(pickTrick({ ask: "a trick!", last: ["magic", "confetti", "balance", "vanish", "hat"], r: () => 0 }).trick, "magic", "one he hasn't done lately");
  let sk = {}; assert.equal(juggleSpec(sk).balls, 2, "two balls the first time");
  sk = juggled(sk, 2); sk = juggled(sk, 0); assert.ok(sk.juggle.skill > 0.4); assert.equal(sk.juggle.times, 2); assert.equal(juggleSpec(sk).balls, 3);
});

test("no pretending: a claim with nothing behind it is done, or made honest", () => {
  assert.deepEqual(honesty({ text: "A sheep! I'm working on it right now, just stay tuned!", userText: "a sheep", prev: "What should I try to paint?" }), { activity: { kind: "paint", subject: "a sheep" } });
  assert.equal(honesty({ text: "Watch this! *juggles*", userText: "can you juggle?" }).activity.kind, "juggle");
  const h = honesty({ text: "Sure! I'm building it right now. It'll be awesome.", userText: "build me a rocket ship to the moon" });
  assert.match(h.text, /^Sure! It'll be awesome\. I can't make that one yet/);
  assert.equal(honesty({ text: "I'm working on it, stay tuned!", userText: "x", did: true }), null, "something did happen");
  assert.equal(honesty({ text: "That sounds lovely!", userText: "I went to the park" }), null);
  // the workbench (M5, Nov 3): "can you make a mini game?" → "let me see if I can figure something out on the workbench!", never queued
  assert.match(honesty({ text: "Ooh, a mini game! I don't know how to build one yet, but let me see if I can figure something out on the workbench!", userText: "can you make a mini game?" }).text, /^Ooh, a mini game! Hmm, my workbench can't make that one/);
  assert.match(honesty({ text: "It's still bubbling away on my workbench!", userText: "did you get the minigame?" }).text, /nothing on my workbench/);
  assert.deepEqual(honesty({ text: "Ooh yes! I'll put it on my workbench!", userText: "make me a red kite" }), { queue: "red kite" });
  assert.equal(honesty({ text: "Ooh, a kite! I'll make it for you!", userText: "I drew you a kite! Can you make it?" }).queue, undefined, "not a thing called \"it\"");
  assert.equal(honesty({ text: "It's on my workbench, almost done!", userText: "is my hat ready?", pending: true }), null);
});

test("chat: 'paint a sheep' → the painting comes with the reply; the finished one is kept; juggling gets better", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-act-"));
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body);
    if (body.response_format) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify({ title: "a woolly sheep", background: "#bfe6ff", shapes: Array.from({ length: 8 }, (_, i) => ({ shape: "blob", x: 10 + i * 10, y: 40, w: 10, h: 8, color: "#ffffff", rotate: 0 })) }) }, finish_reason: "stop" }] }), { status: 200 });
    system = body.messages[0].content;
    const user = [...body.messages].reverse().find((m) => m.role === "user").content;
    const content = /rocket/.test(user) ? "Okay! I'm building it right now, stay tuned!" : "Here I go!";
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "a.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, cloud: false });
  const base = `http://127.0.0.1:${S.port}`, post = async (u, b) => (await fetch(base + u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
  try {
    let r = await post("/api/chat", { text: "can you paint a sheep for me?", id: "1" });
    assert.equal(r.reply.activity.kind, "paint"); assert.equal(r.reply.activity.subject, "a sheep"); assert.equal(r.reply.activity.painting.title, "a woolly sheep");
    assert.ok(r.reply.activity.brush, "his paintbrush"); assert.match(system, /painting a sheep/);
    r = await post("/api/chat", { text: "can you juggle?", id: "2" });
    assert.equal(r.reply.activity.kind, "juggle"); assert.equal(r.reply.activity.balls, 2);
    const done = await post("/api/activity/done", { kind: "juggle", drops: 1 }); assert.ok(done.skill.skill > 0.2);
    r = await post("/api/chat", { text: "can you build me a rocket ship?", id: "3" });
    assert.equal(r.reply.activity, null); assert.doesNotMatch(r.reply.text, /stay tuned/); assert.match(r.reply.text, /can't make that one yet/);
    r = await post("/api/chat", { text: "can you bake me a cake?", id: "3b" });   // in his activity book now: he really bakes
    assert.equal(r.reply.activity.kind, "routine"); assert.equal(r.reply.activity.id, "bake");
    // the finished painting is kept: a file, the art wall, the scrapbook
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const saved = await post("/api/paintings", { subject: "a sheep", title: "a woolly sheep", png });
    assert.ok(saved.ok); assert.equal((await fetch(base + saved.url)).status, 200);
    const wall = await (await fetch(base + "/api/paintings")).json(); assert.equal(wall[0].title, "a woolly sheep");
    assert.equal((await post("/api/paintings", { png: "javascript:alert(1)" })).error, "a picture, please");
  } finally { await S.close(); }
});
