// Dressing up for a job (Nov 7, shared/jobs.js, server/dress.js): him, Mimi and Cocoa, in a chat and in a scene.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JOBS, JOB_IDS, jobOf, outfit } from "../../shared/jobs.js";
import { PROP_EXAMPLES, validateProp, fitReport, ARCHETYPES } from "../../shared/craft.js";
import { dressIntent, dressPlan, dressNote } from "../dress.js";
import { bookIntent, routineFor } from "../book.js";
import { BOOK_BY_ID } from "../../shared/activity-book.js";
import { skitMoment, fallbackSkit, skitThings, clean } from "../skits.js";
import { createServer } from "../index.js";

const all = Object.values(PROP_EXAMPLES).flat();
test("every job has its outfit: hand-made, checked, fitted; one thing to wear and at most one to hold", () => {
  for (const id of JOB_IDS) {
    const o = outfit(id);
    assert.ok(o.wear.length >= 1 && o.wear.length <= 1, `${id}: one thing that says it`);
    for (const n of [...o.wear, o.hold].filter(Boolean)) {
      const e = all.find((x) => x.name === n); assert.ok(e, `${id}: ${n} is a pattern`);
      const v = validateProp(e, { request: n }); assert.ok(v.recipe, n); assert.deepEqual(v.warnings, [], `${n} needs no fixing`);
      assert.deepEqual(fitReport(v.recipe), [], `${n} fits him`);
    }
    for (const n of o.wear) assert.ok(["head", "body"].includes(ARCHETYPES[all.find((x) => x.name === n).archetype].slot), `${n} is worn`);
    if (o.hold) assert.equal(ARCHETYPES[all.find((x) => x.name === o.hold).archetype].slot, "hand", `${o.hold} is held`);
  }
  for (const [w, id] of [["a police officer", "police"], ["cops", "police"], ["the detective", "detective"], ["a construction worker", "engineer"], ["nurse", "doctor"], ["firemen", "firefighter"], ["a baker", "chef"], ["astronauts", "astronaut"], ["cookie", null]]) assert.equal(jobOf(w), id, w);
});

test("the stethoscope sits round his neck and down his chest (Nov 7: too low)", () => {
  const v = validateProp(all.find((x) => x.name === "stethoscope"), { request: "stethoscope" }).recipe;
  const chest = v.parts.find((p) => p.label === "chest piece");
  assert.ok(chest.at[1] >= -0.1 && chest.at[1] <= 0.25, `the chest piece is on his chest (y ${chest.at[1]}), not his tummy`);
  assert.ok(v.parts.some((p) => p.shape === "torus" && Math.abs(p.at[1] - 0.4) < 0.05), "round his neck");
  assert.equal(v.parts.filter((p) => p.label === "ear tip").length, 2, "and the earpieces");
});

test("who dresses up as what; just him is his activity book's", () => {
  const d = (t) => dressIntent(t);
  assert.deepEqual(d("Mimi, dress up as a doctor"), [{ who: "mimi", job: "doctor" }]);
  assert.deepEqual(d("can Cocoa be a police officer?"), [{ who: "cocoa", job: "police" }]);
  assert.deepEqual(d("let's all dress up as chefs").map((x) => x.who), ["mochi", "mimi", "cocoa"]);
  assert.deepEqual(d("dress Mimi as a pilot and Cocoa as a firefighter"), [{ who: "mimi", job: "pilot" }, { who: "cocoa", job: "firefighter" }]);
  assert.deepEqual(d("you and Mimi dress up as firefighters").map((x) => x.who).sort(), ["mimi", "mochi"]);
  assert.deepEqual(d("make Cocoa a farmer"), [{ who: "cocoa", job: "farmer" }]);
  for (const t of ["dress up as a doctor", "do a skit where Mimi is a doctor", "I dressed up as a doctor", "Mimi is a doctor in real life", "Cocoa was a police officer", "don't dress Mimi up as a cop"]) assert.equal(d(t), null, t);
  const plan = dressPlan(d("Mimi, dress up as a police officer"));
  assert.deepEqual(plan[0].wear.map((w) => w.name), ["police cap"]); assert.equal(plan[0].hold.name, "walkie-talkie");
  assert.match(dressNote(plan), /Mimi put on a police cap and her walkie-talkie: she's dressed up as a police officer/);
  // him alone: his book's job entries, and the last job's things come off first
  const id = (t) => (bookIntent(t) || {}).id || null;
  for (const [t, e] of [["dress up as a doctor", "doctor"], ["can you dress up as a police officer?", "police"], ["be an engineer", "engineer"], ["dress up like a pilot", "pilot"], ["be a farmer", "farmer"], ["be an artist", "artist"], ["be a detective", "detective"], ["dress up as an astronaut", "astronaut"], ["put on your chef costume", "chef"], ["firefighter costume", "firefighter"], ["dress as a judge", "courtjudge"]]) assert.equal(id(t), e, t);
  assert.equal(id("I dressed up as a doctor"), null);
  const r = routineFor(BOOK_BY_ID.police, { ask: "be a police officer" });
  assert.deepEqual(r.steps.slice(0, 3).map((s) => s.do + (s.prop ? `:${s.prop.name}` : "")), ["undress", "wear:police cap", "hold:walkie-talkie"]);
  assert.equal(routineFor(BOOK_BY_ID.astronaut, { ask: "be an astronaut" }).steps.find((s) => s.do === "wear").prop.name, "space helmet");
});

test("a scene of pretend jobs: they dress up and play the part", () => {
  const m = skitMoment("do a skit where Mimi is a doctor and Cocoa is a police officer", "", {});
  assert.equal(m.need, "jobs"); assert.deepEqual(m.jobs, ["doctor", "police"]);
  assert.equal(skitMoment("tell me a story", "", {}).need, "story");
  const fb = fallbackSkit(m, { rnd: () => 0.1 });
  const dress = fb.beats.find((b) => b.do === "dress"); assert.equal(dress.with, "doctor");
  const th = skitThings(fb); assert.deepEqual(th["job:doctor"].wear.map((w) => w.name), ["stethoscope"]);
  // a model's dress beat: the job by name, a friend arriving first
  const c = clean({ title: "t", beats: [{ who: "cocoa", do: "dress", with: "police officer", line: "Officer Cocoa, reporting!" }, { who: "cocoa", do: "friend_say", line: "Freeze!" }, { who: "mochi", do: "dress", with: "spaceman", line: "" }, { who: "mimi", do: "dress", with: "wizard", line: "" }] }, {});
  assert.deepEqual(c.beats.map((b) => `${b.who}:${b.do}:${b.with}`), ["cocoa:arrive:", "cocoa:dress:police", "cocoa:friend_say:", "cocoa:friend_say:", "mochi:dress:astronaut"].map((x) => x));
});

test("in the chat: Mimi dresses up; the brain hears it", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-dress-"));
  const bodies = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Officer Mimi, reporting for duty!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "d.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: async () => ({ decision: "neutral", request: "perform", ms: 1 }) });
  const post = async (body) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  const sys = () => bodies.at(-1).messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  try {
    const r = await post({ text: "dress Mimi up as a police officer", id: "d1", rule: "nod" });
    assert.equal(r.dress.length, 1); assert.equal(r.dress[0].who, "mimi"); assert.equal(r.dress[0].wear[0].name, "police cap");
    assert.ok(Array.isArray(r.dress[0].wear[0].recipe.parts), "the page gets what to put on her");
    assert.ok(!r.activity, "not his own police routine as well");
    assert.match(sys(), /Mimi put on a police cap/);
  } finally { await S.close(); }
});
