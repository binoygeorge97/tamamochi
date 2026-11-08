// Practising while you're away (Nov 7): a prop that didn't come out right is made again in a long quiet moment, by
// the background model if keys.json names one; better, it replaces the old one and he says so once; a message stops it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { practiceCandidates, interruptible, practiceNote, makePractice } from "../practice.js";
import { openMemory } from "../memory.js";
import { makeRouter } from "../router.js";

const day = 24 * 3600 * 1000, now = Date.parse("2026-11-07T20:00:00Z");
test("which props get another go: his own, unsure, not too often or too lately", () => {
  const rows = [
    { id: 1, name: "windmill", source: "user", meta: { unsure: true, guess: "a spinning top" } },
    { id: 2, name: "cupcake", source: "pocket", meta: { unsure: true } },
    { id: 3, name: "teapot", source: "user", meta: { matched: true } },
    { id: 4, name: "yo-yo", source: "user", meta: { unsure: true, practiceTries: 2 } },
    { id: 5, name: "lamp", source: "user", meta: { unsure: true, practisedAt: new Date(now - 3600000).toISOString(), practiceTries: 1 } },
    { id: 6, name: "hourglass", source: "mochi", meta: { unsure: true, practisedAt: new Date(now - day).toISOString(), practiceTries: 1 } },
  ];
  assert.deepEqual(practiceCandidates(rows, { now }).map((p) => p.name), ["windmill", "hourglass"]);
});

test("a message stops it: the next model call is refused", async () => {
  let back = false; const calls = [];
  const llm = { model: "g", vision: true, async chat(a) { calls.push(a); return { text: "{}", json: {} }; } };
  const p = interruptible(llm, () => back, { background: true });
  await p.chat({ what: "recipe" }); assert.equal(calls[0].background, true); assert.equal(p.vision, true);
  back = true; await assert.rejects(p.chat({ what: "recipe" }), /they're back/);
  assert.match(practiceNote([{ name: "windmill", was: "a spinning top" }]), /practised making your windmill \(it used to look like a spinning top\)/);
  assert.equal(practiceNote([]), "");
});

test("a better one replaces the old; a worse one doesn't; the background model is the one asked, switch or not", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-practice-")), memory = openMemory(path.join(dir, "p.sqlite"));
  const a = memory.addProp({ name: "windmill", archetype: "companion", recipe: { name: "windmill", parts: [1], request: "a windmill" }, origin: "x", meta: { unsure: true, guess: "a spinning top" } });
  const b = memory.addProp({ name: "yo-yo", archetype: "handheld_tool", recipe: { name: "yo-yo", parts: [1] }, origin: "x", meta: { unsure: true, guess: "a top" } });
  let quiet = true, asked = [];
  const better = [];
  const P = makePractice({ memory, llm: {}, isQuiet: () => quiet, lastMessageAt: () => 0, log: { log() {}, warn() {} }, onBetter: (x) => better.push(x),
    makeCrafter: (llm) => ({ async craftProp(o) { asked.push(o); const ok = o.name === "yo-yo"; return { ok: true, matched: ok, guess: ok ? "a yo-yo" : "a top", recipe: { name: o.name, parts: [1, 2] }, timings: { models: ["nemotron-brev x"] } }; } }) });
  assert.equal((await P.tick()).better, true, "the yo-yo (newest) first");
  assert.equal(better[0].name, "yo-yo"); assert.equal(asked[0].archetype, "handheld_tool");
  const yy = memory.propsWithMeta().find((p) => p.id === Number(b));
  assert.deepEqual(yy.recipe.parts, [1, 2]); assert.equal(yy.meta.matched, true); assert.equal(yy.meta.was, "a top");
  assert.equal((await P.tick()).better, false, "the windmill: still not right");
  const wm = memory.propsWithMeta().find((p) => p.id === Number(a));
  assert.deepEqual(wm.recipe.parts, [1], "the old one stays"); assert.equal(wm.meta.practiceTries, 1);
  assert.equal(await P.tick(), null, "nothing left for now (the windmill waits a few hours)");
  quiet = false; assert.equal(await P.tick(), null);
  // the router: background work goes to the model marked for it, whatever the cloud boost says; Gemma for pictures it can't see
  const keys = path.join(dir, "keys.json");
  fs.writeFileSync(keys, JSON.stringify({ more: [{ name: "nemotron-brev", baseUrl: "http://x.test/v1", key: "k", model: "nem", local: false, vision: false, background: true }] }));
  const local = { model: "gemma", calls: [], async chat() { return { text: "{}", json: { from: "gemma" } }; }, async models() { return []; } };
  const R = makeRouter({ local, env: {}, keysFile: keys, log: { log() {}, warn() {} }, gate: (p) => p.local,
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"from":"nem"}' } }] }), { status: 200, headers: { "content-type": "application/json" } }) });
  assert.equal((await R.chat({ what: "recipe", user: "x", schema: {} })).provider, "local", "everyday work: the switch is off");
  assert.equal((await R.chat({ what: "recipe", user: "x", schema: {}, background: true })).provider, "nemotron-brev");
  assert.equal((await R.chat({ what: "critique", user: "x", schema: {}, images: ["data:image/png;base64,AA"], background: true })).provider, "local");
  memory.close();
});
