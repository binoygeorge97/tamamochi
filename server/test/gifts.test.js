// Gifts he makes on his own: what for (and never for grief or illness), one per event and one a day, kept secret from
// the brain's workbench list, and given at a quiet moment a little later with the right words.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { giftFor, whenWords, giftLine, sweepGifts, favouriteColour } from "../gifts.js";
import { openMemory } from "../memory.js";
import { createServer } from "../index.js";
import { CONFIG } from "../config.js";

test("what he'd make, and what he'd say", () => {
  const G = (t) => (giftFor({ text: t }) || {}).pattern || null;
  assert.equal(G("has a job interview on Thursday"), "gold medal");
  assert.equal(G("birthday is on March 3"), "confetti popper");
  assert.equal(G("is going on a trip to Japan"), "folded map");
  assert.equal(G("starts a new job on Monday"), "potted sunflower");
  assert.equal(G("is having a rough week"), "little teddy bear");
  for (const t of ["grandma passed away", "has surgery on Friday", "is in the hospital", "has a dentist appointment", "likes pizza"]) assert.equal(G(t), null, t);
  assert.equal(favouriteColour([{ text: "favorite colour is teal" }]), "teal");
  assert.equal(giftFor({ text: "has an exam tomorrow" }, [{ text: "loves purple" }]).gift, "purple gold medal");
  assert.equal(whenWords("2026-11-03", "2026-11-02"), "tomorrow"); assert.equal(whenWords("2026-11-05", "2026-11-02"), "on Thursday"); assert.equal(whenWords("2026-11-02", "2026-11-02"), "today");
  assert.equal(giftLine(giftFor({ text: "has a job interview" }), "tomorrow"), "I made you something for your interview tomorrow. For luck!");
  assert.equal(giftLine(giftFor({ text: "birthday" }), "today"), "I made you something for your birthday. Happy birthday!");
});

test("the sweep: one gift per event, one a day, not in care mode, not for undated events", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-gift-")), M = openMemory(path.join(dir, "g.sqlite"));
  try {
    const today = M.today(), tomorrow = new Date(Date.now() + 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    M.remember("has a job interview", { kind: "event", when: tomorrow, weight: 0.9 });
    M.remember("has a dentist appointment", { kind: "event", when: tomorrow, weight: 0.9 });
    M.remember("has a big exam someday", { kind: "event", weight: 0.9 });
    assert.deepEqual(sweepGifts(M, { care: true, today }), [], "not while he's worried about them");
    const made = sweepGifts(M, { today });
    assert.equal(made.length, 1); assert.equal(made[0].pattern, "gold medal");
    const job = M.queue().find((j) => j.source === "mochi");
    assert.match(job.request, /^gold medal: a surprise gift for their interview$/); assert.equal(job.status, "queued");
    assert.equal(M.secretGifts().length, 1);
    assert.deepEqual(sweepGifts(M, { today }), [], "one a day");
    M.set("lastGiftDay", "2000-01-01");
    assert.deepEqual(sweepGifts(M, { today }), [], "and only once per event (the dentist and the undated exam get nothing)");
  } finally { M.close(); }
});

test("server: remembering an interview queues a secret gift; given later at a quiet moment with the right words", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-gift-s-"));
  const tomorrow = new Date(Date.now() + 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  let system = "";
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1), user = [...body.messages].reverse().find((m) => m.role === "user").content;
    system = body.messages[0].content;
    const message = last.role === "tool" ? { role: "assistant", content: "Ooh, good luck!" } : /interview/.test(user)
      ? { role: "assistant", content: null, tool_calls: [{ id: "r1", type: "function", function: { name: "remember", arguments: JSON.stringify({ text: "has a job interview", kind: "event", when: tomorrow, weight: 0.9 }) } }] }
      : { role: "assistant", content: "Hehe!" };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }), { status: 200 });
  };
  const keep = { quietMs: CONFIG.quietMs, giftDelayMs: CONFIG.giftDelayMs };
  CONFIG.quietMs = 0; CONFIG.giftDelayMs = 3600000;
  const S = await createServer({ db: path.join(dir, "s.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const say = async (text) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json();
  const { WebSocket } = await import("ws");
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`), got = [];
  ws.on("message", (d) => { const m = JSON.parse(d); if (m.type === "reveal") got.push(m); });
  try {
    await new Promise((ok) => ws.on("open", ok));
    await say("I have a job interview tomorrow!");
    const job = S.memory.queue().find((j) => j.source === "mochi");
    assert.ok(job, "a gift was queued on its own"); assert.match(job.request, /^gold medal/);
    await say("what's up?");
    assert.match(system, /A surprise you're making for them on your own \(keep it a secret[^)]*\): gold medal for your interview/);
    assert.doesNotMatch(system, /On your workbench list[^\n]*gold medal/, "not in the workbench list he talks about");
    // the workbench made it: it waits (not right away), then he gives it
    const pid = S.memory.addProp({ name: "gold medal", archetype: "body_wearable", recipe: { name: "gold medal", archetype: "body_wearable", parts: [] }, origin: "I made it on my own: for your interview", source: "mochi" });
    S.memory.setJob(job.id, { status: "done", result_id: pid, finished_at: new Date().toISOString().replace("T", " ").slice(0, 19) });
    await new Promise((ok) => setTimeout(ok, 2600));
    assert.equal(got.length, 0, "not straight away");
    CONFIG.giftDelayMs = 0;
    await new Promise((ok) => setTimeout(ok, 2600));
    assert.equal(got.length, 1); assert.equal(got[0].gift, true);
    assert.equal(got[0].text, "I made you something for your interview tomorrow. For luck! Ta-da!");
    assert.equal(S.memory.secretGifts().length, 0, "no longer a secret");
  } finally { ws.close(); await S.close(); CONFIG.quietMs = keep.quietMs; CONFIG.giftDelayMs = keep.giftDelayMs; }
});
