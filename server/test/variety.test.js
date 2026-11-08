// Fresh stories (Nov 5, Binoy: "Gemma might be prone to reuse the same story again and again ... something like
// seeding based on time").
import { test } from "node:test";
import assert from "node:assert/strict";
import { momentOfDay, holidayNear, spice, TWISTS, likeness, tooLike } from "../variety.js";
import { writeCaper, caperText } from "../capers.js";

const mem = () => { const kv = {}; return { get: (k, d) => (k in kv ? kv[k] : d), set: (k, v) => { kv[k] = v; } }; };

test("the real day: time, weekday, season, a holiday coming", () => {
  assert.match(momentOfDay(new Date(2026, 10, 5, 19, 0)), /^It's Thursday evening, autumn/);
  assert.equal(holidayNear(new Date(2026, 10, 20)), "Thanksgiving is in 6 days");
  assert.equal(holidayNear(new Date(2026, 11, 25)), "today is Christmas!");
  assert.equal(holidayNear(new Date(2026, 4, 3)), "");
  assert.match(momentOfDay(new Date(2026, 0, 10, 8)), /Saturday morning, winter/);
});

test("a twist not used lately", () => {
  const M = mem(), seen = new Set();
  for (let i = 0; i < 8; i++) { const t = spice(M, "caper"); assert.ok(!seen.has(t), "no repeat within eight"); seen.add(t); }
  assert.ok(TWISTS.length > 8);
});

test("too like a recent one", () => {
  const a = "the big confetti cannon: Mimi, look at my confetti cannon! / Eep! Confetti everywhere! / Hehe sorry Mimi";
  assert.ok(likeness(a, a) === 1);
  assert.ok(tooLike("confetti cannon: Mimi look at my confetti cannon! / Eep, confetti everywhere! / sorry Mimi hehe", [a]));
  assert.ok(!tooLike("a picnic surprise: Cocoa brought sandwiches / we played tag / the ants won", [a]));
});

test("a caper that comes back like a recent one is written again (with another twist, a new seed)", async () => {
  const old = { title: "confetti surprise", scenes: [{ who: "mochi", do: "call", who2: "mimi", how: "", line: "Mimi, look at my confetti cannon!" }, { who: "mochi", do: "use_on", who2: "mimi", how: "", line: "Surprise!" }, { who: "mimi", do: "react", who2: "", how: "laugh", line: "Eep! Confetti everywhere!" }] };
  const fresh = { title: "the royal parade", scenes: [{ who: "mochi", do: "call", who2: "cocoa", how: "", line: "Cocoa, be my royal drummer!" }, { who: "cocoa", do: "friend_say", who2: "", how: "", line: "Dude, I was born for this." }, { who: "mochi", do: "use", who2: "", how: "", line: "Make way for the parade!" }] };
  const calls = [];
  const llm = { chat: async (o) => { calls.push(o); return { json: calls.length === 1 ? old : fresh }; } };
  const c = await writeCaper({ llm, prop: { name: "confetti cannon", archetype: "launcher" }, recent: [caperText(old)], memory: mem(), log: { log() {}, warn() {} } });
  assert.equal(c.title, "the royal parade");
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].seed, calls[1].seed);
  assert.match(calls[0].user, /Work in this twist: /); assert.match(calls[0].user, /It's \w+day/); assert.match(calls[0].user, /Recent capers/);
  assert.notEqual(/Work in this twist: ([^.]+)/.exec(calls[0].user)[1], /Work in this twist: ([^.]+)/.exec(calls[1].user)[1]);
});
