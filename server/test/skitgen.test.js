// Money skits written on the fly (Nov 8): Nemotron writes from a lesson card, code checks, Gemma answers blind
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateGen, sumOk, generateSkit, cardOf, choiceWords, toStore, fromStore, LESSON_CARDS, genPrompt } from "../skitgen.js";
import { setExtraSkits, pickSkit, skitScene, skitAnswer, moneyState, moneyIntent } from "../money.js";
import { createServer } from "../index.js";

const GOOD = {
  title: "Cocoa's change",
  beats: [
    { do: "show", who: "mochi", with: "lemonade stand", line: "Mimi's stand is open!" },
    { do: "arrive", who: "cocoa", with: "play money" },
    { do: "friend_say", who: "cocoa", line: "One lemonade, please! Here's $5." },
    { do: "friend_say", who: "mimi", line: "It's $3 ♡ Let me find your change…" },
  ],
  question: "How much change should Cocoa get?",
  choices: ["$2", "$5", "Nothing"], right: 1,
  yes: [{ do: "aside", who: "mochi", line: "Yes! $5 take away $3 is $2. That's his change." }, { do: "friend_say", who: "cocoa", line: "Two dollars back, sweet!" }],
  no: [{ do: "aside", who: "mochi", line: "Let's count: $5 take away $3 leaves $2. That's his change!" }],
  reveal: "$5 take away $3 is $2: that's Cocoa's change!",
  math: ["5 - 3 = 2"],
};

test("sums are worked out, not trusted", () => {
  for (const s of ["5 - 3 = 2", "10 + 1 = 11", "3 * 2 = 6", "$4 x 2 = $8", "12 / 4 = 3", "1.5 + 1.5 = 3"]) assert.ok(sumOk(s), s);
  for (const s of ["5 - 3 = 3", "two plus two = 4", "process.exit() = 1", "5 = 5 = 5", ""]) assert.ok(!sumOk(s), s);
});

test("a good scene passes; bad sums, stray amounts, brands, unknown props and unkind words don't", () => {
  const card = cardOf("change");
  const v = validateGen(GOOD, card); assert.equal(v.ok, true, v.problems.join("; "));
  assert.equal(v.skit.beats.at(-1).line, GOOD.question); assert.equal(v.skit.choices.length, 3); assert.equal(v.skit.right, 1);
  const bad = (patch, re) => { const r = validateGen({ ...GOOD, ...patch }, card); assert.equal(r.ok, false); assert.ok(r.problems.some((p) => re.test(p)), r.problems.join("; ")); };
  bad({ math: ["5 - 3 = 3"] }, /sum/);
  bad({ yes: [{ do: "aside", who: "mochi", line: "Yes! That's $7 back." }] }, /amounts with no sum/);
  bad({ reveal: "Like at Walmart: $2 back!" }, /brand/);
  const odd = validateGen({ ...GOOD, beats: [...GOOD.beats.slice(0, 3), { do: "show", who: "mochi", with: "rocket launcher", line: "Look!" }] }, card);
  assert.equal(odd.ok, true); assert.deepEqual(odd.skit.beats[3], { do: "aside", who: "mochi", line: "Look!" }, "a prop he doesn't have: the line is just said");
  const loose = validateGen({ ...GOOD, beats: [{ do: "arrive", who: "cocoa", with: "a price tag", line: "Cocoa: \"Bro, look!\"" }, ...GOOD.beats.slice(1)] }, card);
  assert.equal(loose.ok, true); assert.equal(loose.skit.beats[0].with, "price tag"); assert.deepEqual(loose.skit.beats[1], { do: "friend_say", who: "cocoa", line: "Bro, look!" }, "names and quotes come off");
  bad({ no: [{ do: "aside", who: "mochi", line: "That's a dumb answer. It's $2." }] }, /word we don't use/);
  bad({ right: 4 }, /right answer/);
  bad({ question: "Tell me the change" }, /question/);
});

test("typed answers find their choice", () => {
  const w = choiceWords(["The kite string", "The giant candy bar"]);
  assert.ok(w[1].test("the string!")); assert.ok(w[2].test("candy")); assert.ok(!w[1].test("candy"));
  const back = fromStore(toStore({ words: w })); assert.ok(back.words[1].test("string"));
});

test("Nemotron writes, Gemma checks blind; a different answer from the checker throws it away", async () => {
  const card = cardOf("change");
  const writer = { chat: async (a) => { assert.equal(a.background, true, "the background model writes"); assert.match(a.user, /change/); return { json: GOOD, provider: "nemotron-brev", model: "nvidia/NVIDIA-Nemotron-3-Nano" }; } };
  let pick = 1;
  const checker = { chat: async (a) => { assert.doesNotMatch(a.user, /"right"|right: 1/, "not told the answer"); return { json: { pick, ok: true } }; } };
  let r = await generateSkit({ writer, checker, card });
  assert.equal(r.ok, true, (r.problems || []).join("; ")); assert.equal(r.by, "Nemotron"); assert.equal(r.checkedBy, "Gemma");
  pick = 2; r = await generateSkit({ writer, checker, card }); assert.equal(r.ok, false); assert.match(r.problems[0], /checker picked 2/);
  r = await generateSkit({ writer, checker: { chat: async () => ({ json: { pick: 1, ok: false, problem: "confusing" } }) }, card }); assert.equal(r.ok, false); assert.match(r.problems[0], /confusing/);
  r = await generateSkit({ writer: { chat: async () => { throw new Error("they're back: practice stopped"); } }, checker, card }); assert.equal(r.ok, false);
  assert.ok(LESSON_CARDS.length >= 15); assert.match(genPrompt(card).system, /no real companies/);
});

test("a kept skit is served first, labelled, and its answers work; topics still pick the hand-written ones", async () => {
  const v = validateGen(GOOD, cardOf("change")); const sk = { ...v.skit, by: "Nemotron", checkedBy: "Gemma" };
  setExtraSkits([sk]);
  try {
    const k = pickSkit([], Math.random, null, []); assert.equal(k.id, sk.id);
    assert.match(skitScene(k).title, /written by Nemotron, checked by Gemma/);
    assert.notEqual(pickSkit([], Math.random, null, [sk.id]).id, sk.id, "played: the hand-written ones next");
    assert.equal(pickSkit([], Math.random, "interest", []).id, "interest");
    assert.equal(skitAnswer(sk.id, 1).right, true); assert.equal(skitAnswer(sk.id, 2).right, false);
    assert.equal(moneyIntent("$2!", moneyState({ pending: { kind: "quiz", id: sk.id, at: Date.now() } })).n, 1);
  } finally { setExtraSkits([]); }
});

test("the endpoint writes one now (fake models) and the library lists it", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-skitgen-"));
  const craftLLM = { chat: async (a) => a.what === "skitgen" ? { json: GOOD, provider: "local" } : a.what === "skitcheck" ? { json: { pick: 1, ok: true } } : { text: "Okay!" }, vision: true };
  const S = await createServer({ db: path.join(dir, "g.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, craftLLM, cloud: false, skitgen: false });
  const base = `http://127.0.0.1:${S.port}`;
  try {
    const r = await (await fetch(base + "/api/money/skits/generate", { method: "POST" })).json();
    assert.equal(r.ok, true, (r.problems || []).join("; "));
    const lib = await (await fetch(base + "/api/money/skits")).json();
    assert.equal(lib.library.length, 1); assert.equal(lib.library[0].played, false); assert.equal(lib.log.length, 1);
  } finally { setExtraSkits([]); await S.close(); }
});
