// The workbench, Nov 7 (Binoy: "I like these ideas. Can you implement them"): several takes at once that Pip picks
// from, and the patterns he learns from props he got right first time.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeCrafter, findPattern, setLearned, learnedFor, learnable } from "../crafter.js";
import { createServer } from "../index.js";
import { PROP_EXAMPLES, validateProp } from "../../shared/craft.js";

const quiet = { log() {}, warn() {} };
const tool = PROP_EXAMPLES.handheld_tool[0];
const reply = (name, extra = {}) => ({ plan: `a ${name}`, name, parts: tool.parts, ...(tool.hold ? { hold: tool.hold } : {}), ...extra });
// a model from a script; `delay` makes calls take time so we can see them overlap
function fakeLLM(script, { delay = 0 } = {}) {
  const used = {}, calls = [];
  let open = 0;
  const L = { calls, vision: null, maxOpen: 0,
    async chat(o) {
      open++; L.maxOpen = Math.max(L.maxOpen, open);
      try {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        const list = script[o.what] || [], i = used[o.what] = (used[o.what] ?? -1) + 1;
        let a = list[Math.min(i, list.length - 1)];
        if (typeof a === "function") a = await a(o, i);
        if (a instanceof Error) throw a;
        if (a === undefined) throw new Error(`no scripted answer for ${o.what}`);
        if (o.images && o.images.length) L.vision = true;
        calls.push({ what: o.what, temperature: o.temperature, user: o.user, images: (o.images || []).length });
        return { text: JSON.stringify(a), json: a, ms: 1, usage: { completion_tokens: 100 }, finish: "stop" };
      } finally { open--; }
    } };
  return L;
}
const renderer = { n: 0, opts: [], async render(recipe, o = {}) { this.n++; (this.opts || (this.opts = [])).push(o); return { ok: true, png: Buffer.from(`png:${recipe.name}`), dataUrl: `data:image/png;base64,${Buffer.from(String(this.n)).toString("base64")}`, ms: 1 }; } };

test("three takes at once: written side by side, Pip looks at each, the one he recognises wins", async () => {
  setLearned([]);
  const llm = fakeLLM({
    classify: [{ archetype: "handheld_tool", name: "paper lantern", kind: "prop" }],
    recipe: [reply("paper lantern"), reply("paper lantern"), reply("paper lantern")],
    look: [{ guess: "a red drum", confidence: 0.6 }, { guess: "a candle", confidence: 0.5 }, { guess: "a paper lantern", confidence: 0.85 }],
    same: [{ same: false }],
  }, { delay: 20 });
  const c = makeCrafter({ llm, renderer: { ...renderer, n: 0 }, log: quiet, parallel: 3 });
  const r = await c.craftProp({ request: "a paper lantern" });
  assert.equal(r.ok, true); assert.equal(r.matched, true); assert.equal(r.guess, "a paper lantern");
  const recipes = llm.calls.filter((x) => x.what === "recipe");
  assert.equal(recipes.length, 3, "three takes");
  assert.ok(llm.maxOpen >= 3, `written at the same time (${llm.maxOpen} at once)`);
  assert.deepEqual([...new Set(recipes.map((x) => x.temperature))].length, 3, "each a little different");
  assert.ok(recipes.some((x) => /simple and bold/.test(x.user)) && recipes.some((x) => /your own take/.test(x.user)), "with its own brief");
  assert.equal(llm.calls.filter((x) => x.what === "look").length, 3, "Pip looks at each");
  assert.ok(!llm.calls.some((x) => x.what === "critique" || x.what === "fix"), "no fix round needed");
  assert.deepEqual(r.attempts.map((a) => a.take), [1, 2, 3]);
  assert.equal(r.attempts.find((a) => a.match).kept, true);
});

test("none of the takes recognised: the one most like it is picked, and one fix round starts from it", async () => {
  setLearned([]);
  let fixFrom = null;
  const llm = fakeLLM({
    classify: [{ archetype: "handheld_tool", name: "paper lantern", kind: "prop" }],
    recipe: [reply("paper lantern"), reply("paper lantern"), reply("paper lantern")],
    look: [{ guess: "a drum", confidence: 0.5 }, { guess: "a cup", confidence: 0.5 }, { guess: "a candle", confidence: 0.5 }, { guess: "a jar", confidence: 0.4 }],
    same: [{ same: false }],
    pick: [{ best: 3 }, { best: 1 }],
    critique: [{ features: ["a glowing round paper body"], fixes: ["make the body rounder"] }],
    fix: [(o) => { fixFrom = o.user; return reply("paper lantern"); }],
  });
  const c = makeCrafter({ llm, renderer: { ...renderer, n: 0 }, log: quiet, parallel: 3 });
  const r = await c.craftProp({ request: "a paper lantern" });
  assert.equal(r.ok, true); assert.equal(r.matched, false); assert.equal(r.unsure, true);
  const whats = llm.calls.map((x) => x.what);
  assert.equal(whats.filter((w) => w === "recipe").length, 3); assert.equal(whats.filter((w) => w === "fix").length, 1, "one fix round after the takes");
  assert.match(fixFrom, /looked like "a candle"/, "the fix starts from the take Pip's pick chose");
  assert.equal(llm.calls.find((x) => x.what === "pick").images, 3, "the pick sees all three takes");
  assert.equal(llm.calls.filter((x) => x.what === "pick").length, 2, "and at the end, the best of everything");
});

test("takes on a miss: one try first; only if Pip doesn't know it, a fix of it and two fresh designs side by side", async () => {
  setLearned([]);
  // known at first sight: one recipe, nothing else
  const easy = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "lollipop", kind: "prop" }], recipe: [reply("lollipop")], look: [{ guess: "a lollipop", confidence: 0.9 }], same: [{ same: true }] });
  const r1 = await makeCrafter({ llm: easy, renderer: { ...renderer, n: 0 }, log: quiet, parallel: 3, takesOn: "miss" }).craftProp({ request: "a lollipop" });
  assert.equal(r1.matched, true);
  assert.deepEqual(easy.calls.filter((x) => /recipe|fix/.test(x.what)).map((x) => x.what), ["recipe"], "an easy one stays one try");
  // missed: then the takes, at the same time: the fix of what Pip saw, and two fresh ones
  let fixFrom = null;
  const hard = fakeLLM({
    classify: [{ archetype: "handheld_tool", name: "windmill", kind: "prop" }],
    recipe: [reply("windmill"), reply("windmill"), reply("windmill")],
    look: [{ guess: "a lamp post", confidence: 0.5 }, { guess: "a tower", confidence: 0.5 }, { guess: "a windmill", confidence: 0.8 }, { guess: "a fan", confidence: 0.5 }],
    same: [{ same: false }],
    critique: [{ features: ["four big sails"], fixes: ["add four big sails at the top"] }],
    fix: [(o) => { fixFrom = o.user; return reply("windmill"); }],
    pick: [{ best: 1 }],
  }, { delay: 20 });
  const r2 = await makeCrafter({ llm: hard, renderer: { ...renderer, n: 0 }, log: quiet, parallel: 3, takesOn: "miss" }).craftProp({ request: "a windmill" });
  assert.equal(r2.matched, true, "one of the takes got it");
  const whats = hard.calls.map((x) => x.what);
  assert.equal(whats.filter((w) => w === "recipe").length, 3, "the first try and two fresh designs");
  assert.equal(whats.filter((w) => w === "fix").length, 1, "and one fix");
  assert.match(fixFrom, /looked like "a lamp post"/, "the fix starts from what Pip saw the first time");
  assert.ok(hard.maxOpen >= 3, `the second round is written all at once (${hard.maxOpen})`);
  const fresh = hard.calls.filter((x) => x.what === "recipe").slice(1);
  assert.ok(fresh.every((x) => /your own take|simple and bold|silhouette/.test(x.user)), "each fresh take has its own brief");
  assert.deepEqual(r2.attempts.filter((a) => a.round === 1).map((a) => a.take).sort(), [1, 2, 3]);
  assert.equal(r2.attempts.filter((a) => a.round === 0).length, 1);
});

test("the time budget counts Pip's looks: after a round of takes (four looks) no third round past the budget; one at a time still gets three", async () => {
  setLearned([]);
  const script = (name) => ({
    classify: [{ archetype: "handheld_tool", name, kind: "prop" }],
    recipe: [reply(name)], fix: [reply(name)],
    look: [{ guess: "a red drum", confidence: 0.5 }], same: [{ same: false }],
    critique: [{ features: ["a thing"], fixes: ["make it more like it"] }], pick: [{ best: 1 }],
  });
  const a = fakeLLM(script("kazoo"));
  await makeCrafter({ llm: a, renderer: { ...renderer, n: 0 }, log: quiet, parallel: 3, takesOn: "miss", budgetMs: 0 }).craftProp({ request: "a kazoo" });
  assert.equal(a.calls.filter((x) => x.what === "look").length, 4, "one look, then three: and no more once over the budget");
  const b = fakeLLM(script("kazoo"));
  await makeCrafter({ llm: b, renderer: { ...renderer, n: 0 }, log: quiet, parallel: 1, budgetMs: 0 }).craftProp({ request: "a kazoo" });
  assert.equal(b.calls.filter((x) => x.what === "look").length, 3, "one at a time: still three looks (Nov 4)");
});

test("a hand-made pattern needs no takes; one take failing to write doesn't stop the others", async () => {
  setLearned([]);
  const R = { ...renderer, n: 0, opts: [] };
  const llm = fakeLLM({ classify: [{ archetype: "handheld_canopy", name: "red umbrella", kind: "prop" }], look: [{ guess: "a red umbrella", confidence: 0.9 }] });
  const r = await makeCrafter({ llm, renderer: R, log: quiet, parallel: 3 }).craftProp({ request: "a red umbrella" });
  assert.equal(r.matched, true); assert.equal(r.pattern.mode, "base");
  assert.ok(!llm.calls.some((x) => x.what === "recipe"), "the pattern, as it is"); assert.equal(R.n, 2);
  assert.equal(R.opts[0].hand, true, "Pip sees it held by the stand-in hoof"); assert.equal(R.opts[1].hand, false, "its shelf picture is on its own");
  const llm2 = fakeLLM({
    classify: [{ archetype: "handheld_tool", name: "paper lantern", kind: "prop" }],
    recipe: [new Error("timed out"), reply("paper lantern"), "not a prop"],
    look: [{ guess: "a paper lantern", confidence: 0.8 }],
  });
  const r2 = await makeCrafter({ llm: llm2, renderer: { ...renderer, n: 0 }, log: quiet, parallel: 3 }).craftProp({ request: "a paper lantern" });
  assert.equal(r2.ok, true); assert.equal(r2.matched, true);
  assert.ok(r2.attempts.some((a) => a.take === 1 && /timed out/.test(a.error)), "the failed take is noted");
});

test("learned patterns: what counts, and a learned one comes out at once next time, recoloured if asked", async () => {
  const lantern = validateProp({ ...reply("paper lantern"), archetype: "handheld_tool" }).recipe;
  const first = { ok: true, matched: true, recipe: { ...lantern, name: "paper lantern", archetype: "handheld_tool" }, pattern: null, attempts: [{ round: 0, take: 2, match: true, confidence: 0.8 }] };
  assert.equal(learnable(first), true);
  assert.equal(learnable({ ...first, attempts: [{ round: 0, match: false }, { round: 1, match: true, confidence: 0.9 }] }), false, "only when right first time");
  assert.equal(learnable({ ...first, attempts: [{ round: 0, match: true, confidence: 0.3 }] }), false, "and Pip was fairly sure");
  assert.equal(learnable({ ...first, pattern: { name: "umbrella", mode: "base" } }), false, "a hand-made pattern isn't learned again");
  assert.equal(learnable({ ...first, matched: false }), false);
  assert.equal(learnable({ ...first, recipe: { ...first.recipe, name: "little blue umbrella", archetype: "handheld_canopy" } }), false, "there's already a pattern of that name");
  setLearned([{ archetype: "handheld_tool", name: "paper lantern", recipe: lantern }]);
  assert.equal(learnedFor("handheld_tool").length, 1);
  const p = findPattern("handheld_tool", "red paper lantern", "red paper lantern");
  assert.equal(p.mode, "base"); assert.equal(p.example.learned, true); assert.equal(p.colour, "#e5484d");
  const llm = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "red paper lantern", kind: "prop" }], look: [{ guess: "a red paper lantern", confidence: 0.9 }] });
  const r = await makeCrafter({ llm, renderer: { ...renderer, n: 0 }, log: quiet, parallel: 3 }).craftProp({ request: "a red paper lantern" });
  assert.equal(r.matched, true); assert.deepEqual(r.pattern, { name: "paper lantern", mode: "base", learned: true });
  assert.ok(!llm.calls.some((x) => x.what === "recipe"), "no recipe to write: he knows how");
  assert.ok(r.recipe.parts.some((x) => x.color === "#e5484d"), "in red");
  setLearned([]);
});

test("the server learns from a prop got right first time, says so, uses it, and forgets one Pip stops recognising", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-learn-"));
  const lantern = validateProp({ ...reply("paper lantern"), archetype: "handheld_tool" }).recipe;
  const results = [
    { ok: true, matched: true, unsure: false, guess: "a paper lantern", recipe: { ...lantern, name: "paper lantern", archetype: "handheld_tool", request: "a paper lantern" }, pattern: null, attempts: [{ round: 0, take: 1, match: true, confidence: 0.8 }], timings: { total: 30000 } },
    { ok: true, matched: true, unsure: false, guess: "a paper lantern", recipe: { ...lantern, name: "paper lantern", archetype: "handheld_tool", request: "a paper lantern" }, pattern: { name: "paper lantern", mode: "base", learned: true }, attempts: [{ round: 0, match: true, confidence: 0.9 }], timings: { total: 2000 } },
    { ok: true, matched: false, unsure: true, guess: "a drum", recipe: { ...lantern, name: "paper lantern", archetype: "handheld_tool", request: "a paper lantern" }, pattern: { name: "paper lantern", mode: "base", learned: true }, attempts: [{ round: 0, match: false }], timings: { total: 2000 } },
  ];
  let k = 0;
  const crafter = { async craftProp() { return results[k++]; }, async craftMove() { return { ok: false, error: "no", attempts: [], timings: { total: 1 } }; } };
  const S = await createServer({ db: path.join(dir, "l.sqlite"), port: 0, host: "127.0.0.1", feelings: null, renderer: null, crafter, worker: true });
  try {
    const j = S.memory.enqueue({ kind: "prop", request: "a paper lantern" });
    await S.workTick();
    const known = S.memory.get("patterns.learned", []);
    assert.equal(known.length, 1); assert.equal(known[0].name, "paper lantern"); assert.ok(!("request" in known[0].recipe));
    assert.equal(learnedFor("handheld_tool").length, 1, "the crafter knows it straight away");
    assert.equal(JSON.parse(S.memory.job(j.id).log).learned, true);
    // the next one from the pattern, recognised: counted
    S.memory.enqueue({ kind: "prop", request: "a paper lantern" }); await S.workTick();
    assert.equal(S.memory.get("patterns.learned", [])[0].uses, 1);
    // Pip doesn't recognise it as it is: forgotten
    S.memory.enqueue({ kind: "prop", request: "a paper lantern" }); await S.workTick();
    assert.equal(S.memory.get("patterns.learned", []).length, 0); assert.equal(learnedFor("handheld_tool").length, 0);
  } finally { await S.close(); setLearned([]); }
});

test("\"does it look right?\": what Pip saw, and your answer counts (yes: confirmed and learned; no: he asks what to change)", async () => {
  const { revealVerdict, unsureLine } = await import("../verdict.js");
  for (const t of ["yes!", "Yeah it does", "yep", "it looks great", "perfect", "I love it!", "that's so cute", "haha yes", "looks just like one"]) assert.equal(revealVerdict(t), "yes", t);
  for (const t of ["no", "nope, make it rounder", "not really", "it looks like a drum", "yes but the handle is too long", "that is not it", "hmm no"]) assert.equal(revealVerdict(t), "no", t);
  for (const t of ["what is it", "can you make a kite", "tell me a joke"]) assert.equal(revealVerdict(t), null, t);
  assert.equal(unsureLine("paper lantern", "a red drum"), "I made the paper lantern you asked for! Pip thought it looked a bit like a red drum… Does it look right to you?");
  assert.equal(unsureLine("kite", "a small colorful toy"), "I made the kite you asked for! …I think. Does it look right to you?", "a vague guess isn't said");
  setLearned([]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-verdict-"));
  const bodies = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Yay!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "v.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: async () => ({ decision: "neutral", request: "none", ms: 1 }) });
  const post = async (body) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  const sys = () => bodies.at(-1).messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  try {
    const lantern = validateProp({ ...reply("paper lantern"), archetype: "handheld_tool" }).recipe;
    const id = S.memory.addProp({ name: "paper lantern", archetype: "handheld_tool", recipe: lantern, origin: "you asked", source: "user", meta: { matched: false, unsure: true, guess: "a red drum" } });
    S.memory.set("lastReveal", { id, at: Date.now(), unsure: true, guess: "a red drum" });
    await post({ text: "yes it does!", id: "v1", rule: "happy" });
    assert.match(sys(), /They just said your paper lantern looks right \(Pip hadn't been sure\)[^\n]*now you know how to make them/);
    assert.equal(S.memory.get("patterns.learned", []).length, 1, "learned, as if Pip had known it");
    assert.equal(learnedFor("handheld_tool")[0].name, "paper lantern");
    await post({ text: "yes!", id: "v2", rule: "happy" });
    assert.doesNotMatch(sys(), /looks right \(Pip/, "only the first answer counts");
    // a no: he asks what to change
    const id2 = S.memory.addProp({ name: "kite", archetype: "handheld_tool", recipe: lantern, origin: "you asked", source: "user", meta: { unsure: true } });
    S.memory.set("lastReveal", { id: id2, at: Date.now(), unsure: true, guess: "a sail" });
    await post({ text: "not really", id: "v3", rule: "nod" });
    assert.match(sys(), /They said your kite doesn't look right yet[^\n]*ask what you should change/);
    assert.equal(S.memory.get("patterns.learned", []).length, 1, "nothing learned from a no");
  } finally { await S.close(); setLearned([]); }
});

test("the short recipe: every hand-made pattern survives the round trip; Gemma writes lists; turned down, it's the usual one for good", async () => {
  const { compactPart, expandPart, expandRecipe, compactSchema, COMPACT_NOTE } = await import("../crafter.js");
  let n = 0;
  for (const [a, list] of Object.entries(PROP_EXAMPLES)) for (const e of list) {
    const v1 = validateProp({ ...e, archetype: a }), v2 = validateProp({ ...e, archetype: a, parts: e.parts.map((p) => expandPart(compactPart(p))) });
    const bare = (ps) => ps.map(({ label, ...x }) => x);   // (an unnamed part comes back named after its shape)
    assert.ok(v2.recipe, `${e.name}`); assert.deepEqual(bare(v2.recipe.parts), bare(v1.recipe.parts), `${e.name}: the same toy`); n++;
  }
  assert.ok(n > 100, `${n} patterns`);
  const S = compactSchema("launcher"), item = S.properties.parts.items;
  assert.equal(item.type, "array"); assert.equal(item.prefixItems.length, 7); assert.ok(S.required.includes("muzzle"), "the rest of the recipe as before");
  setLearned([]);
  const short = (name) => ({ plan: `a ${name}`, name, parts: tool.parts.map(compactPart), ...(tool.hold ? { hold: tool.hold } : {}) });
  let prompt = null, schema = null;
  const llm = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "paper lantern", kind: "prop" }], recipe: [(o) => { prompt = o; schema = o.schema; return short("paper lantern"); }], look: [{ guess: "a paper lantern", confidence: 0.9 }] });
  const r = await makeCrafter({ llm, renderer: { ...renderer, n: 0 }, log: quiet, compact: true }).craftProp({ request: "a paper lantern" });
  assert.equal(r.ok, true); assert.equal(r.matched, true); assert.equal(r.recipe.parts.length, tool.parts.length);
  assert.ok(prompt.system.includes(COMPACT_NOTE)); assert.match(prompt.user, /\["[^"]+","[a-z]+",\[/, "examples as lists");
  assert.equal(schema.properties.parts.items.type, "array"); assert.equal(prompt.strictSchema, true, "a refused schema doesn't switch structured output off for everything");
  // LM Studio turns the list schema down: the usual recipe, then and from then on
  const turnedDown = Object.assign(new Error("LM Studio 400: invalid json_schema"), { status: 400 });
  const schemas = [];
  const llm2 = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "paper lantern", kind: "prop" }], recipe: [(o) => { schemas.push(o.schema.properties.parts.items.type); return turnedDown; }, (o) => { schemas.push(o.schema.properties.parts.items.type); return reply("paper lantern"); }, (o) => { schemas.push(o.schema.properties.parts.items.type); return reply("paper lantern"); }], look: [{ guess: "a paper lantern", confidence: 0.9 }] });
  const c2 = makeCrafter({ llm: llm2, renderer: { ...renderer, n: 0 }, log: quiet, compact: true });
  assert.equal((await c2.craftProp({ request: "a paper lantern" })).matched, true);
  await c2.craftProp({ request: "a paper lantern" });
  assert.deepEqual(schemas, ["array", "object", "object"]);
  assert.deepEqual(expandRecipe({ parts: [["a", "ball", [1, 1, 1], [0, 0, 0], "#ffffff", "plastic", { round: 0.5 }]] }).parts[0], { label: "a", shape: "ball", size: [1, 1, 1], at: [0, 0, 0], color: "#ffffff", material: "plastic", round: 0.5 });
});

test("building from parts: a request is offered the pieces it needs, and a borrowed piece arrives built, sized, turned and placed", async () => {
  const { piecesFor, piece, expandBorrowed } = await import("../crafter.js");
  assert.deepEqual(piecesFor("a wheelbarrow").map((p) => p.name), ["wheel"]);
  assert.deepEqual(piecesFor("a windmill").map((p) => p.name), ["propeller"]);
  assert.deepEqual(piecesFor("a panda plush").map((p) => p.name), ["teddy head"]);
  assert.deepEqual(piecesFor("a teapot"), [], "nothing offered when nothing fits");
  for (const n of ["wheel", "bicycle wheel", "propeller", "rotor", "umbrella canopy", "star", "teddy head", "lens", "bow", "candle", "nose cone"]) assert.ok(piece(n) && piece(n).parts.length, n);
  assert.equal(piece("teddy head").parts.length, 9, "both ears and both eyes"); assert.deepEqual(piece("candle").parts.map((p) => p.label), ["candle", "flame"]);
  const tub = { label: "tub", shape: "box", size: [0.8, 0.3, 0.55], at: [0.05, 0.55, 0], color: "#4fbf68", material: "plastic" };
  const x = expandBorrowed({ name: "wheelbarrow", parts: [tub, { label: "from: wheel", shape: "cylinder", size: [0.32, 0.32, 0.1], at: [0.5, 0.18, 0], color: "#000000", material: "rubber" }] });
  assert.deepEqual(x.borrowed, ["wheel"]); assert.equal(x.parts.length, 4);
  const lo = [0, 1, 2].map((k) => Math.min(...x.parts.slice(1).map((p) => p.at[k] - p.size[k] / 2))), hi = [0, 1, 2].map((k) => Math.max(...x.parts.slice(1).map((p) => p.at[k] + p.size[k] / 2)));
  assert.ok(Math.abs(Math.max(...hi.map((h, k) => h - lo[k])) - 0.32) < 0.01, "scaled to the size asked");
  assert.ok(Math.abs((lo[0] + hi[0]) / 2 - 0.5) < 0.01 && Math.abs((lo[1] + hi[1]) / 2 - 0.18) < 0.01, "centred where asked");
  assert.ok(validateProp({ ...x, archetype: "companion" }).recipe, "a valid prop");
  const turned = expandBorrowed({ parts: [{ label: "from: propeller", size: [0.9, 0.9, 0.9], at: [0, 0, 0], rotate: [0, 90, 0] }] });
  assert.notDeepEqual(turned.parts.map((p) => p.rotate), piece("propeller").parts.map((p) => p.rotate || [0, 0, 0]), "turned when asked");
  assert.deepEqual(expandBorrowed({ parts: [{ label: "from: spaceship engine", shape: "cone", size: [1, 1, 1], at: [0, 0, 0] }] }).parts[0].label, "spaceship engine", "a piece there isn't: just a part");
  // through the workbench: offered in the prompt only when it fits, and expanded before Pip looks
  setLearned([]);
  let sys = null;
  const llm = fakeLLM({ classify: [{ archetype: "companion", name: "wheelbarrow", kind: "prop" }],
    recipe: [(o) => { sys = o.system; return { plan: "a tub on a wheel", name: "wheelbarrow", parts: [tub, { label: "from: wheel", shape: "cylinder", size: [0.32, 0.32, 0.1], at: [0.5, 0.18, 0], color: "#000000", material: "rubber" }] }; }],
    look: [{ guess: "a wheelbarrow", confidence: 0.9 }] });
  const r = await makeCrafter({ llm, renderer: { ...renderer, n: 0 }, log: quiet }).craftProp({ request: "a wheelbarrow" });
  assert.equal(r.matched, true); assert.match(sys, /"from: wheel"/);
  assert.ok(r.recipe.parts.some((p) => /hub cap/.test(p.label)), "the car's wheel, hub cap and all");
  let sys2 = null;
  const llm2 = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "teapot", kind: "prop" }], recipe: [(o) => { sys2 = o.system; return reply("teapot"); }], look: [{ guess: "a teapot", confidence: 0.9 }] });
  await makeCrafter({ llm: llm2, renderer: { ...renderer, n: 0 }, log: quiet }).craftProp({ request: "a teapot" });
  assert.doesNotMatch(sys2, /borrow/, "a teapot is offered nothing");
});
