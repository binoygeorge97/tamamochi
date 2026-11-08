// The workbench with a scripted model: every path through the crafter (first try, fix rounds, out of time, no vision,
// broken JSON, unsafe requests, model down), moves, the worker inside the server, and the bench report.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeCrafter, findPattern, recolour, recolourAll, drawnColours, keepsColour, propSchema, moveSchema, sameWords, words, vague, repairMoveProp, otherShape, withLook } from "../crafter.js";
import { runBench } from "../bench.js";
import { createServer } from "../index.js";
import { PROP_EXAMPLES, MOVE_EXAMPLES, validateProp } from "../../shared/craft.js";

// a model that answers from a script: { classify: [...], recipe: [...], look: [...], ... } (functions or values)
function fakeLLM(script, { vision = null } = {}) {
  const used = {}, calls = [];
  const L = {
    calls, model: "fake", structured: true, vision,
    async chat(o) {
      const list = script[o.what] || [];
      const i = used[o.what] = (used[o.what] ?? -1) + 1;
      let a = list[Math.min(i, list.length - 1)];
      if (typeof a === "function") a = await a(o, i);
      if (a instanceof Error) { calls.push({ what: o.what, ok: false, error: a.message, ms: 1 }); throw a; }
      if (a === undefined) throw new Error(`no scripted answer for ${o.what}`);
      if (o.images && o.images.length) L.vision = true;
      calls.push({ what: o.what, ms: 2, tokensOut: 100, ok: true });
      const text = typeof a === "string" ? a : JSON.stringify(a);
      let json = null; try { json = JSON.parse(text); } catch (_) { json = null; }
      return { text, json: o.schema ? json : null, ms: 2, usage: { completion_tokens: 100 }, finish: "stop" };
    },
  };
  return L;
}
const fakeRenderer = { renders: 0, async render(recipe) { this.renders++; return { ok: true, png: Buffer.from(`png:${recipe.name}`), dataUrl: "data:image/png;base64,AAAA", ms: 3 }; } };
const umbrella = PROP_EXAMPLES.handheld_canopy[0];
const asReply = (ex, extra = {}) => ({ plan: "a canopy on a stick", name: ex.name, parts: ex.parts, ...(ex.hold ? { hold: ex.hold } : {}), ...extra });

test("words, matching a blind guess to the request", () => {
  assert.deepEqual(words("The little Blue Umbrellas"), ["blue", "umbrella"]);
  assert.ok(sameWords("little blue umbrella", "a blue umbrella"));
  assert.ok(sameWords("magenta smartphone", "pink cell phone"), "compound: smartphone / phone");
  assert.ok(sameWords("potted sunflower", "a flower in a pot"));
  assert.ok(!sameWords("red balloon", "red ball"), "a ball is not a balloon");
  assert.ok(!sameWords("golden crown", "yellow cake"));
  assert.ok(!sameWords("blue umbrella", "blue mushroom"), "a shared colour is not a match");
});

test("schemas: launcher needs ammo and a muzzle, hand props may say how they're held, moves list every channel", () => {
  const L = propSchema("launcher"), H = propSchema("head_wearable"), T = propSchema("handheld_tool");
  assert.ok(L.required.includes("ammo") && L.required.includes("muzzle") && L.properties.ammo.enum.includes("water"));
  assert.ok(!L.properties.ammo.enum.some((a) => /bullet|rocket|fire/.test(a)), "no unsafe ammo can even be written");
  assert.ok(!H.properties.hold && T.properties.hold);
  assert.ok(T.properties.parts.items.properties.hollow, "hollow tubes are allowed");
  const M = moveSchema();
  assert.ok(M.properties.tracks.properties["rightArm.raise"] && M.properties.tracks.properties["body.spin"]);
  assert.equal(M.properties.tracks.additionalProperties, false, "no made-up channels");
});

test("a prop on the first try: classify, recipe, render, blind look, match", async () => {
  const llm = fakeLLM({ classify: [{ archetype: "handheld_canopy", name: "blue beach parasol", kind: "prop" }], recipe: [asReply(umbrella)], look: [{ guess: "a blue beach parasol", confidence: 0.9 }] });
  const R = { ...fakeRenderer, renders: 0 };
  const c = makeCrafter({ llm, renderer: R, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "a beach parasol", context: "it's so sunny" });
  assert.equal(r.ok, true); assert.equal(r.matched, true); assert.equal(r.unsure, false);
  assert.equal(r.recipe.archetype, "handheld_canopy"); assert.equal(r.recipe.name, "blue beach parasol");
  assert.equal(r.attempts.length, 1); assert.equal(R.renders, 2, "Pip's look, then its shelf picture without the stand-in hoof (Nov 7)");
  assert.ok(Buffer.isBuffer(r.png));
  assert.deepEqual(llm.calls.map((x) => x.what), ["classify", "recipe", "look"], "a word match needs no judge call");
  assert.ok(r.timings.total >= 0 && r.timings.recipes.length === 1);
});

test("a prop that looked wrong gets a critique and is fixed in the next round", async () => {
  let fixPrompt = null;
  const llm = fakeLLM({
    classify: [{ archetype: "handheld_canopy", name: "beach parasol", kind: "prop" }],
    recipe: [asReply(umbrella)],
    fix: [(o) => { fixPrompt = o.user; return asReply(umbrella); }],
    look: [{ guess: "a mushroom", confidence: 0.7 }, { guess: "a parasol", confidence: 0.8 }],
    same: [{ same: false }],
    critique: [{ features: ["a wide shallow canopy"], fixes: ["make the canopy wider and flatter", "make the shaft longer"] }],
  });
  const c = makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "a beach parasol" });
  assert.equal(r.ok, true); assert.equal(r.matched, true); assert.equal(r.attempts.length, 2);
  assert.equal(r.attempts[0].guess, "a mushroom"); assert.equal(r.attempts[0].match, false);
  assert.deepEqual(r.attempts[0].fixes, ["What makes it \"beach parasol\": a wide shallow canopy.", "make the canopy wider and flatter", "make the shaft longer"]);
  assert.match(fixPrompt, /looked like "a mushroom"/); assert.match(fixPrompt, /canopy wider/);
});

test("never right after the fixes: the best try is kept and marked unsure (two fixes when there's time, one if asked)", async () => {
  const script = () => fakeLLM({ classify: [{ archetype: "handheld_canopy", name: "beach parasol", kind: "prop" }], recipe: [asReply(umbrella)], fix: [asReply(umbrella)],
    look: [{ guess: "a lamp", confidence: 0.5 }], same: [{ same: false }], critique: [{ fixes: ["wider canopy"] }] });
  const r = await makeCrafter({ llm: script(), renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "a beach parasol" });
  assert.equal(r.ok, true); assert.equal(r.matched, false); assert.equal(r.unsure, true); assert.equal(r.guess, "a lamp");
  assert.equal(r.attempts.length, 3, "first try + 2 fixes");
  const r2 = await makeCrafter({ llm: script(), renderer: fakeRenderer, fixRounds: 1, log: { log() {}, warn() {} } }).craftProp({ request: "a beach parasol" });
  assert.equal(r2.attempts.length, 2, "first try + 1 fix when asked");
});

test("the time budget stops further fix rounds", async () => {
  const slowRecipe = async () => { await new Promise((ok) => setTimeout(ok, 60)); return asReply(umbrella); };
  const llm = fakeLLM({ classify: [{ archetype: "handheld_canopy", name: "beach parasol", kind: "prop" }], recipe: [slowRecipe], fix: [slowRecipe],
    look: [{ guess: "a lamp", confidence: 0.5 }], same: [{ same: false }], critique: [{ fixes: ["wider canopy"] }] });
  const c = makeCrafter({ llm, renderer: fakeRenderer, budgetMs: 50, minTries: 1, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "a beach parasol" });
  assert.equal(r.ok, true); assert.equal(r.attempts.length, 1, "no time for a fix"); assert.equal(r.unsure, true);
});

test("Pip gets three looks, however slow the tries (Nov 4); past three minutes, no more", async () => {
  const slowRecipe = async () => { await new Promise((ok) => setTimeout(ok, 60)); return asReply(umbrella); };
  const script = () => fakeLLM({ classify: [{ archetype: "handheld_canopy", name: "beach parasol", kind: "prop" }], recipe: [slowRecipe], fix: [slowRecipe, slowRecipe],
    look: [{ guess: "a lamp", confidence: 0.5 }, { guess: "a lamp", confidence: 0.5 }, { guess: "a lamp", confidence: 0.5 }], same: [{ same: false }, { same: false }, { same: false }],
    critique: [{ fixes: ["wider canopy"] }, { fixes: ["taller pole"] }], pick: [{ best: 1 }] });
  let r = await makeCrafter({ llm: script(), renderer: fakeRenderer, budgetMs: 50, log: { log() {}, warn() {} } }).craftProp({ request: "a beach parasol" });
  assert.equal(r.attempts.length, 3, "three tries, each one looked at");
  r = await makeCrafter({ llm: script(), renderer: fakeRenderer, budgetMs: 50, maxMs: 50, log: { log() {}, warn() {} } }).craftProp({ request: "a beach parasol" });
  assert.equal(r.attempts.length, 1);
});

test("no vision in the model: the validator decides, and vision isn't tried again", async () => {
  const e = new Error("LM Studio 400: model does not support image input"); e.status = 400;
  const llm = fakeLLM({ classify: [{ archetype: "handheld_canopy", name: "beach parasol", kind: "prop" }], recipe: [asReply(umbrella)], look: [e] });
  const c = makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "a beach parasol" });
  assert.equal(r.ok, true); assert.equal(llm.vision, false); assert.equal(r.checked, false); assert.equal(r.unsure, false);
  const r2 = await c.craftProp({ request: "a beach parasol" });
  assert.equal(r2.ok, true); assert.ok(!llm.calls.slice(4).some((x) => x.what === "look"), "no second vision call");
});

test("broken JSON on the first try: it tries again", async () => {
  const llm = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "magic wand", kind: "prop" }], recipe: ["sorry, here you go: {oops", asReply(PROP_EXAMPLES.handheld_tool[0])], look: [{ guess: "a magic wand", confidence: 0.9 }] });
  const c = makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "a magic wand" });
  assert.equal(r.ok, true); assert.equal(r.attempts.length, 2); assert.match(r.attempts[0].error, /no JSON/);
});

test("make a gun: it becomes a water squirter that can only shoot harmless things", async () => {
  const popper = PROP_EXAMPLES.launcher[0];
  const llm = fakeLLM({ classify: [{ archetype: "launcher", name: "water squirter", kind: "prop" }], recipe: [asReply(popper, { ammo: "bullets", muzzle: popper.muzzle, name: "water squirter" })], look: [{ guess: "a toy water gun", confidence: 0.8 }], same: [{ same: true }] });
  const c = makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "make a gun" });
  assert.equal(r.ok, true); assert.equal(r.recipe.archetype, "launcher"); assert.equal(r.recipe.name, "water squirter");
  assert.equal(r.recipe.ammo, "confetti", "bullets are never ammo");
  assert.match(llm.calls[0].what, /classify/);
});

test("the model is down: the job fails cleanly with the reason", async () => {
  const down = new Error("fetch failed");
  const llm = fakeLLM({ classify: [down], recipe: [down] });
  const c = makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "a pirate hat" });
  assert.equal(r.ok, false); assert.match(r.error, /fetch failed/); assert.equal(r.archetype, "head_wearable", "fell back to the word guess");
});

test("moves: a good recipe, and a lifeless one retried with the reason", async () => {
  const wave = MOVE_EXAMPLES[0];
  const llm = fakeLLM({ move: [{ plan: "wave", name: "wave", duration: wave.duration, prop: "none", tracks: wave.tracks }] });
  const c = makeCrafter({ llm, renderer: null, log: { log() {}, warn() {} } });
  const r = await c.craftMove({ request: "a big wave" });
  assert.equal(r.ok, true); assert.ok(!r.recipe.prop); assert.ok(r.recipe.tracks["rightArm.spread"]);
  let retryPrompt = null;
  const llm2 = fakeLLM({ move: [{ plan: "x", name: "x", duration: 1, tracks: { "head.nod": [[0, 0], [0.5, 0.05], [1, 0]] } }], "move-fix": [(o) => { retryPrompt = o.user; return { plan: "bow", name: "bow", duration: 2, tracks: MOVE_EXAMPLES[1].tracks }; }] });
  const r2 = await makeCrafter({ llm: llm2, log: { log() {}, warn() {} } }).craftMove({ request: "a bow" });
  assert.equal(r2.ok, true); assert.equal(r2.attempts.length, 2); assert.match(retryPrompt, /nothing moves more than a twitch/);
});

test("every example still validates cleanly (they are the model's few-shot teachers)", () => {
  for (const [a, list] of Object.entries(PROP_EXAMPLES)) for (const p of list) {
    const v = validateProp(p);
    assert.equal(v.ok, true, `${a}/${p.name}`); assert.deepEqual(v.warnings, [], `${a}/${p.name}`);
  }
});

test("the worker in the server: a queued prop is crafted, saved with a thumbnail, and waits to be revealed", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-work-"));
  const crafter = { async craftProp({ request }) { return { ok: true, recipe: { ...validateProp(umbrella).recipe, name: "blue umbrella", request }, png: Buffer.from("PNG"), matched: true, unsure: false, guess: "umbrella", attempts: [{ round: 0 }], timings: { total: 5 } }; },
    async craftMove() { return { ok: false, error: "no", attempts: [], timings: { total: 1 } }; } };
  const S = await createServer({ db: path.join(dir, "w.sqlite"), port: 0, host: "127.0.0.1", feelings: null, renderer: null, crafter, worker: true });
  try {
    const j = S.memory.enqueue({ kind: "prop", request: "an umbrella", context: "it's pouring" });
    await S.workTick();
    const job = S.memory.job(j.id);
    assert.equal(job.status, "done"); assert.ok(job.result_id); assert.ok(job.ms >= 0);
    const p = S.memory.props().find((x) => x.id === job.result_id);
    assert.equal(p.name, "blue umbrella"); assert.match(p.origin, /it's pouring/); assert.match(p.thumb, new RegExp(`^/renders/prop-${p.id}-[a-z0-9]+\\.png$`));   // a new file per picture (ids come back after a reset)
    assert.equal(fs.readFileSync(path.join(dir, "renders", p.thumb.replace("/renders/", "")), "utf8"), "PNG");
    const thumb = await fetch(`http://127.0.0.1:${S.port}${p.thumb}`); assert.equal(thumb.status, 200);
    assert.equal(S.memory.unrevealed().id, j.id, "waits for a quiet moment");
    // a failed move gets one more go, then fails for good
    const m = S.memory.enqueue({ kind: "move", request: "a backflip" });
    await S.workTick(); assert.equal(S.memory.job(m.id).status, "queued");
    await S.workTick(); assert.equal(S.memory.job(m.id).status, "failed");
  } finally { await S.close(); }
});

test("the worker: model offline puts the job back without using up a try", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-off-"));
  const crafter = { async craftProp() { return { ok: false, error: "fetch failed", attempts: [], timings: { total: 1 } }; } };
  const S = await createServer({ db: path.join(dir, "o.sqlite"), port: 0, host: "127.0.0.1", feelings: null, renderer: null, crafter });
  try {
    const j = S.memory.enqueue({ kind: "prop", request: "a kite" });
    await S.workTick();
    const job = S.memory.job(j.id);
    assert.equal(job.status, "queued"); assert.equal(job.attempts, 0); assert.ok(S.work.pauseUntil > Date.now());
  } finally { await S.close(); }
});

test("the bench writes a report with timings", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-bench-"));
  const llm = fakeLLM({ classify: [{ archetype: "handheld_canopy", name: "beach parasol", kind: "prop" }], recipe: [asReply(umbrella)], look: [{ guess: "a beach parasol", confidence: 0.9 }],
    move: [{ plan: "w", name: "wave", duration: 2.2, prop: "none", tracks: MOVE_EXAMPLES[0].tracks }] });
  const crafter = makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } });
  const r = await runBench({ spec: { name: "t", props: ["an umbrella", "a parasol"], moves: ["a wave"] }, crafter, llm, dir, log: { log() {} } });
  assert.equal(r.summary.props, 2); assert.equal(r.summary.made, 2); assert.equal(r.summary.recognised, 2); assert.equal(r.summary.movesOk, 1);
  const md = fs.readFileSync(path.join(dir, "report.md"), "utf8");
  assert.match(md, /Time per prop: median/); assert.match(md, /\| an umbrella \| yes/);
  assert.ok(fs.existsSync(path.join(dir, "01-an-umbrella.png")));
});

test("a vague blind guess never counts as recognised", () => {
  for (const g of ["a small blue and pink toy", "a toy", "some colorful object", "a cute little thing"]) assert.ok(vague(g), g);
  for (const g of ["a pink umbrella", "a water pistol", "a toy crown"]) assert.ok(!vague(g), g);
});

test("a move that needs a prop gets one, and a launcher move fires", () => {
  const twirl = repairMoveProp({ duration: 3, tracks: { "body.spin": [[0, 0], [3, 1]], "prop.spin": [[0, 0], [3, 2]] } }, "a twirl with the umbrella");
  assert.equal(twirl.prop, "handheld_canopy");
  const pop = repairMoveProp({ duration: 2.4, tracks: { "rightArm.raise": [[0, 0], [0.9, 0.85], [2.4, 0]], "body.hop": [[0, 0], [1, 0.5], [2.4, 0]] } }, "fire the confetti popper");
  assert.equal(pop.prop, "launcher"); assert.deepEqual(pop.events, [{ t: 0.9, do: "pop" }], "pops at the top of the arm swing");
  const plain = repairMoveProp({ duration: 2, tracks: { "head.nod": [[0, 0], [1, 0.5], [2, 0]] } }, "a polite bow");
  assert.equal(plain.prop, undefined, "no prop for a bow");
  const tool = repairMoveProp({ duration: 2, tracks: { "rightArm.raise": [[0, 0], [1, 0.5], [2, 0]] } }, "wave the magic wand");
  assert.equal(tool.prop, undefined, "a plain verb with a tool word doesn't force a prop");
});

test("patterns: which requests start from a hand-made example, and how", () => {
  const P = (arch, name) => { const p = findPattern(arch, name); return p && `${p.mode}:${p.example.name}${p.colour ? ":" + p.colour : ""}`; };
  assert.equal(P("handheld_tool", "map"), "base:folded map");
  assert.equal(P("handheld_tool", "a pair of scissors"), "base:safety scissors");
  assert.equal(P("handheld_tool", "globe"), "base:desk globe");
  assert.equal(P("handheld_tool", "wooden ruler"), "base:wooden ruler");
  assert.equal(P("handheld_tool", "treasure map"), "adapt:folded map");
  assert.equal(P("handheld_tool", "metal ruler"), "adapt:wooden ruler");
  assert.equal(P("handheld_tool", "riot shield"), "base:riot shield", "the exact pattern wins over adapting the toy shield");
  assert.equal(P("handheld_tool", "shield"), "base:toy shield");
  assert.match(P("handheld_canopy", "red umbrella"), /^base:little blue umbrella:#/, "a colour is a recolour, not a new design");
  assert.equal(P("head_wearable", "police helmet"), "adapt:protective helmet");
  assert.equal(P("head_wearable", "crown"), "base:golden crown");
  assert.equal(P("head_wearable", "pirate hat"), "adapt:hat", "a pirate hat starts from the plain hat, never the party hat");
  assert.equal(P("head_wearable", "hand-drawn hat"), "base:hat", "how it was made isn't what it is (Nov 3: a doodled hat)");
  assert.equal(P("handheld_canopy", "hand-drawn kite"), "base:kite");
  assert.equal(P("handheld_canopy", "umbrella"), "base:little blue umbrella", "\"little\" in a pattern's name doesn't hide it");
  assert.equal(P("companion", "teddy bear"), "base:little teddy bear");
  assert.equal(P("head_wearable", "sunglasses"), "base:dark sunglasses", "(Nov 7: there's a hand-made pair now, Cocoa's disguise)");
  assert.equal(P("handheld_tool", "magic wand"), null, "the star wand is a kind of wand of its own");
  assert.equal(P("handheld_tool", "notebook"), null);
  const red = recolour(PROP_EXAMPLES.handheld_canopy[0], "#e5484d");
  assert.ok(red.parts.some((p) => p.color === "#e5484d") && red.parts.length === PROP_EXAMPLES.handheld_canopy[0].parts.length);
  assert.notEqual(PROP_EXAMPLES.handheld_canopy[0].parts[0].color, "#e5484d", "the pattern itself is untouched");
});

test("a request with a pattern: the pattern itself, no recipe call, still looked at", async () => {
  const llm = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "map", kind: "prop" }], look: [{ guess: "a notebook", confidence: 0.6 }], same: [{ same: false }] });
  const c = makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "a map" });
  assert.equal(r.ok, true); assert.deepEqual(r.pattern, { name: "folded map", mode: "base" });
  assert.deepEqual(llm.calls.map((x) => x.what), ["classify", "look", "same"], "no recipe, no critique, no fixes");
  assert.equal(r.recipe.name, "map"); assert.equal(r.recipe.parts.length, PROP_EXAMPLES.handheld_tool.find((e) => e.name === "folded map").parts.length);
  assert.equal(r.unsure, true, "not recognised: he still asks if it looks right");
});

test("an adapted pattern: the model starts from it; when nothing is recognised it picks the best try", async () => {
  let prompt = null;
  const map = PROP_EXAMPLES.handheld_tool.find((e) => e.name === "folded map");
  const llm = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "treasure map", kind: "prop" }],
    recipe: [(o) => { prompt = o.user; return asReply(map, { name: "treasure map" }); }], fix: [asReply(map, { name: "treasure map" })],
    look: [{ guess: "a notebook", confidence: 0.6 }, { guess: "a sign", confidence: 0.5 }, { guess: "a box", confidence: 0.5 }], same: [{ same: false }],
    critique: [{ fixes: ["add an X"] }], pick: [{ best: 2 }] });
  const c = makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } });
  const r = await c.craftProp({ request: "a treasure map" });
  assert.match(prompt, /Start from this finished folded map and turn it into "treasure map"/);
  assert.equal(r.attempts[0].pattern, "adapted from folded map");
  assert.equal(r.attempts[1].round, "pattern", "after the adapted try, the pattern itself gets a look");
  assert.equal(r.guess, "a sign", "the picked try (2 of 3: the pattern) is kept, not simply the last");
  assert.equal(r.attempts[1].kept, true);
  const llm2 = fakeLLM({ classify: [{ archetype: "handheld_tool", name: "treasure map", kind: "prop" }], recipe: [asReply(map)], fix: [asReply(map)],
    look: [{ guess: "a notebook", confidence: 0.6 }, { guess: "a sign", confidence: 0.5 }], same: [{ same: false }], critique: [{ fixes: ["add an X"] }], pick: [new Error("no")] });
  const r2 = await makeCrafter({ llm: llm2, renderer: fakeRenderer, fixRounds: 1, log: { log() {}, warn() {} } }).craftProp({ request: "a treasure map" });
  assert.equal(r2.guess, "a notebook", "no answer: the first try, closest to the pattern");
  const llm3 = fakeLLM({ classify: [{ archetype: "head_wearable", name: "police helmet", kind: "prop" }], recipe: [asReply(PROP_EXAMPLES.head_wearable.find((e) => e.name === "protective helmet"))],
    look: [{ guess: "a small blue cap or lid", confidence: 0.6 }, { guess: "a police helmet", confidence: 0.8 }] });
  const r3 = await makeCrafter({ llm: llm3, renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "a police helmet" });
  assert.equal(r3.matched, true); assert.equal(r3.attempts.length, 2, "recognised as it is: no critique, no fix");
  assert.ok(!llm3.calls.some((x) => x.what === "critique"));
});

test("the model is down but there's a pattern: the prop is still made", async () => {
  const down = new Error("fetch failed");
  const llm = fakeLLM({ classify: [down], look: [down] });
  const r = await makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "a crown" });
  assert.equal(r.ok, true); assert.equal(r.pattern.name, "golden crown");
});

test("an exact pattern of another kind wins over the classifier", async () => {
  const llm = fakeLLM({ classify: [{ archetype: "head_wearable", name: "traffic cone", kind: "prop" }], look: [{ guess: "a traffic cone", confidence: 0.9 }] });
  const r = await makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "a traffic cone" });
  assert.equal(r.archetype, "companion"); assert.equal(r.recipe.archetype, "companion"); assert.deepEqual(r.pattern, { name: "traffic cone", mode: "base" });
});

test("a pattern of another kind, adapted, beats a blank page; words that only describe it don't count (M5, Nov 3: the soup)", async () => {
  const { findPattern } = await import("../crafter.js");
  assert.equal(findPattern("handheld_tool", "steaming bowl of soup").mode, "base");
  assert.equal(findPattern("handheld_tool", "a yummy cupcake").example.name, "cupcake");
  assert.equal(findPattern("companion", "bowl of soup"), null);
});

test("a reset while the workbench is making something drops it (it belonged to the old Mochi; review, Nov 3)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-stale-"));
  let finish; const gate = new Promise((r) => { finish = r; });
  const crafter = { async craftProp() { await gate; return { ok: true, recipe: { ...validateProp(umbrella).recipe, name: "umbrella" }, png: Buffer.from("PNG"), matched: true, unsure: false, attempts: [], timings: { total: 5 } }; }, async craftMove() { return { ok: false, error: "no", attempts: [], timings: { total: 1 } }; } };
  const S = await createServer({ db: path.join(dir, "s.sqlite"), port: 0, host: "127.0.0.1", feelings: null, renderer: null, crafter, worker: true, demoSnapshot: path.join(dir, "demo.sqlite") });
  try {
    S.memory.enqueue({ kind: "prop", request: "an umbrella" });
    const tick = S.workTick();
    await new Promise((r) => setTimeout(r, 30));
    await fetch(`http://127.0.0.1:${S.port}/api/reset-demo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ which: "zero" }) });
    finish(); await tick;
    assert.equal(S.memory.props().length, 0, "no umbrella on the reborn shelf");
    assert.equal(S.memory.scrapbook().length, 0);
  } finally { await S.close(); }
});

test("the workshop crew sees each step: Kit writes, Pip tests blind (fail, fix, pass)", async () => {
  const llm = fakeLLM({
    classify: [{ archetype: "handheld_canopy", name: "beach parasol", kind: "prop" }], recipe: [asReply(umbrella)], fix: [asReply(umbrella)],
    look: [{ guess: "a mushroom", confidence: 0.7 }, { guess: "a parasol", confidence: 0.8 }], same: [{ same: false }],
    critique: [{ features: ["a wide shallow canopy"], fixes: ["make the canopy wider"] }],
  });
  const steps = [];
  const r = await makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "a beach parasol", onStep: (s) => steps.push(s.phase + (s.phase === "test" ? (s.pass ? "+" : "-") : "")) });
  assert.equal(r.ok, true);
  assert.deepEqual(steps, ["plan", "planned", "write", "wrote", "render", "test-", "critique", "fix", "write", "wrote", "render", "test+"]);
});

test("your drawing (Nov 4): a pattern in your crayons, Gemma shown the picture, and the colour you drew kept", async () => {
  const drawing = { png: "data:image/png;base64,DRAWN", colours: ["#8f6bd6", "#1d1a22", "#ffd34d"], share: [55, 30, 15], name: "hat" };
  assert.deepEqual(drawnColours(drawing), ["#8f6bd6", "#ffd34d"], "colours, not the black outline");
  assert.deepEqual(drawnColours({ colours: ["#1d1a22"], share: [100] }), [], "all black: no colour asked for");
  // a pattern: no recipe call; its two biggest colours become the two crayons you used most
  const quick = fakeLLM({ classify: [{ archetype: "head_wearable", name: "hat", kind: "prop" }], look: [{ guess: "a purple hat", confidence: 0.9 }] });
  const a = await makeCrafter({ llm: quick, renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "hat: the one you drew for me", drawing });
  const cols = new Set(a.recipe.parts.map((p) => p.color));
  assert.ok(cols.has("#8f6bd6") && cols.has("#ffd34d"), [...cols].join(" "));
  assert.ok(!quick.calls.some((c) => c.what === "recipe"), "the pattern, no waiting");
  // from scratch: the recipe call sees the drawing and its colours; if the toy ignores them, its main colour becomes yours
  let seen = null;
  const llm = fakeLLM({ classify: [{ archetype: "handheld_canopy", name: "magic parasol", kind: "prop" }], recipe: [(o) => { seen = o; return asReply(umbrella, { name: "magic parasol" }); }], look: [{ guess: "a magic parasol", confidence: 0.9 }] });
  const b = await makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "magic parasol: the one you drew for me", drawing: { ...drawing, colours: ["#e5484d"], share: [100] } });
  assert.deepEqual(seen.images, ["data:image/png;base64,DRAWN"]); assert.match(seen.user, /They drew it for you \(the picture\)[^]*red #e5484d/);
  assert.ok(b.recipe.parts.some((p) => p.color === "#e5484d"), "in the red they drew");
  assert.ok(b.attempts.some((x) => x.round === "colour"));
  assert.equal(keepsColour({ parts: [{ color: "#e74c4c", material: "plastic", size: [1, 1, 1] }] }, ["#e5484d"]).parts[0].color, "#e74c4c", "close enough is kept");
});

test("chat: 'I drew you a hat!' with the drawing → on the workbench with the drawing linked, even when the model forgets", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-drawn-"));
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), images = JSON.stringify(body.messages).includes("image_url");
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: images ? "hat" : "Ooh, a hat! I love it!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "d.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, cloud: false });
  const base = `http://127.0.0.1:${S.port}`, post = async (u, b) => (await fetch(base + u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
  try {
    const png = "data:image/png;base64," + "A".repeat(400);
    const d = await post("/api/doodle", { png, colours: [{ hex: "#8f6bd6", ink: 300 }, { hex: "#1d1a22", ink: 200 }, { hex: "javascript:", ink: 9 }] });
    assert.equal(d.name, "hat", JSON.stringify(d)); assert.ok(d.id);
    assert.deepEqual(S.memory.get("doodles", {})[d.id].colours, ["#8f6bd6", "#1d1a22"], "only real crayons");
    const r = await post("/api/chat", { text: "I drew you a hat! Can you make it?", id: "1", doodle: d.id });
    const job = S.memory.queue().find((q) => q.kind === "prop" && /^hat/.test(q.request));
    assert.ok(job, "it went on the workbench"); assert.ok(r.reply.queued.some((q) => q.id === job.id));
    assert.equal(S.memory.get("doodle.jobs", {})[job.id], d.id, "with your drawing");
  } finally { await S.close(); }
});


test("a sun is a sun (Nov 4: it came out as a star badge, and the judge took a star-shaped toy for it)", () => {
  assert.equal(otherShape("bright glowing yellow sun sun: a bright, glowing yellow sun", "a yellow star-shaped toy"), true);
  assert.equal(otherShape("heart box", "a heart-shaped box"), false);
  assert.equal(otherShape("sunflower", "a flower-shaped toy"), false);
  assert.equal(otherShape("sun", "a smiling sun"), false);
  const pat = findPattern("companion", "bright glowing yellow sun");
  assert.ok(pat && pat.example.name === "sun" && pat.mode === "base", "the workshop's sun, as it is");
  assert.notEqual((findPattern("companion", "sunflower") || {}).example?.name, "sun");
  assert.notEqual(findPattern("head_wearable", "sunglasses")?.example?.name, "sun", "sunglasses aren't the sun (Nov 7: they have their own pattern now)");
  assert.ok(validateProp(pat.example).recipe.parts.some((p) => p.shape === "burst"), "its rays: the new sunburst block");
  // drawn with red rays round a yellow middle: the rays take the red, the face the yellow
  const drawn = recolourAll(pat.example, ["#e5484d", "#ffd34d"]);
  assert.equal(drawn.parts.find((p) => p.label === "rays").color, "#e5484d");
  assert.equal(drawn.parts.find((p) => p.label === "face").color, "#ffd34d");
  assert.equal(drawn.parts.find((p) => p.label === "eye").color, "#2a1d18");
});

test("a scarf goes round his neck (Nov 4: a Christmas scarf went through his tummy, and \"striped socks\" passed for it)", () => {
  assert.equal(sameWords("Christmas scarf", "red and white striped socks"), false, "sharing \"striped\" isn't the same thing");
  assert.equal(sameWords("striped scarf", "a red scarf"), true);
  const xmas = findPattern("body_wearable", "Christmas scarf", "Christmas scarf: A bright red and white striped scarf, very cozy.");
  assert.equal(xmas.example.name, "scarf"); assert.equal(xmas.mode, "base");
  assert.equal(xmas.look, "stripes"); assert.equal(xmas.colour, "#e5484d");
  const dots = findPattern("body_wearable", "blue polka dot scarf");
  assert.equal(dots.look, "dots"); assert.equal(dots.mode, "base");
  const made = withLook(recolour(dots.example, dots.colour), dots.look, dots.colour2);
  assert.ok(made.parts.filter((p) => p.pattern === "dots").length >= 3, "dots on the scarf itself");
  assert.equal(findPattern("handheld_canopy", "umbrella", "umbrella: a big umbrella with a white handle").colour, null, "a white handle doesn't make it white");
  // the recipe that went through him: now on his front, up by his neck
  const bad = { name: "Christmas scarf", archetype: "body_wearable", parts: [
    { shape: "tube", size: [0.826, 0.155, 0.155], at: [0, 0.103, 0.258], color: "#d62828", material: "cloth", path: [[-0.437, 0, 0], [0.437, 0, 0]], thick: 0.187, label: "scarf_loop" },
    { shape: "box", size: [0.181, 0.181, 0.181], at: [0, 0.077, 0.33], color: "#d62828", material: "cloth", round: 0.4, label: "knot" }] };
  const v = validateProp(bad);
  const loop = v.recipe.parts.find((p) => p.label === "scarf_loop");
  assert.ok(loop.at[1] > 0.25 && loop.at[2] > 0.5, `on his front by his neck: ${loop.at}`);
  for (const e of PROP_EXAMPLES.body_wearable) assert.deepEqual(validateProp(e).warnings, [], `${e.name} sits right as it is`);
});

test("skirts, a tutu, a dress and a jumper start from hand-made ones that go round him (Nov 4 bench: \"a pink collar or ring\", \"a pink bowl\")", async () => {
  const { fitReport } = await import("../../shared/craft.js");
  const want = { "pink tutu": "tutu", "a frilly ballet tutu": "tutu", "a pink dress": "dress", "a grass skirt": "grass skirt", "hula skirt": "grass skirt", "a red skirt": "skirt", "a cozy sweater": "sweater", "an ugly christmas jumper": "sweater", "blue polka dot dress": "dress" };
  for (const [ask, name] of Object.entries(want)) { const f = findPattern("body_wearable", ask, ask); assert.ok(f && f.example.name === name, `${ask} → ${f && f.example.name}`); }
  assert.equal(sameWords("pink tutu", "a pink skirt"), true, "a tutu is a skirt"); assert.equal(sameWords("ugly christmas jumper", "a red sweater"), true);
  assert.equal(sameWords("pink dress", "a pink skirt"), false, "a dress isn't just a skirt");
  assert.equal(findPattern("body_wearable", "a pink dress").mode, "base"); assert.equal(findPattern("body_wearable", "princess dress").mode, "adapt");
  assert.equal(findPattern("head_wearable", "pirate hat", "pirate hat").example.name === "party hat", false, "a party hat is still its own kind");
  for (const name of ["tutu", "skirt", "grass skirt", "dress", "sweater"]) {
    const e = PROP_EXAMPLES.body_wearable.find((x) => x.name === name), v = validateProp(e);
    assert.deepEqual(v.warnings, [], `${name} as it is`); assert.deepEqual(fitReport(v.recipe), [], `${name} fits`);
    // all the way round him, clear of his fleece where it starts (his body is 1.28 × 1.2 at the middle)
    const ring = v.recipe.parts.filter((p) => (p.shape === "cylinder" && p.hollow) || p.shape === "dome" || (p.shape === "torus" && p.size[0] > 1.2));
    assert.ok(ring.length >= 1, `${name}: something that goes round him`);
    for (const p of ring.filter((q) => q.shape === "cylinder")) {
      const top = p.at[1] + p.size[1] / 2, rx = (p.size[0] / 2) * (p.taper ?? 1), rz = (p.size[2] / 2) * (p.taper ?? 1);
      const k = Math.sqrt(Math.max(0, 1 - (top / 0.64) ** 2));
      assert.ok(rx > 0.64 * k && rz > 0.6 * k, `${name}: its top (y ${top}) is outside him`);
    }
  }
  const skirt = validateProp(PROP_EXAMPLES.body_wearable.find((x) => x.name === "skirt")).recipe;
  assert.ok(Math.min(...skirt.parts.map((p) => p.at[1])) < -0.2, "a skirt hangs round his bottom half");
});

test("something to wear is fitted to him (Nov 4): measured, looked at on him, and one round to fix the fit", async () => {
  const { fitReport, fitKind, FIT_GUIDE } = await import("../../shared/craft.js");
  // a tutu written as a disc in front of him (the bench's): it goes all the way round
  const tutu = { name: "tutu", archetype: "body_wearable", parts: [{ shape: "coin", size: [1.4, 1.4, 0.1], at: [0, -0.3, 0.62], color: "#ff8fb8", material: "cloth", label: "skirt" }] };
  assert.equal(fitKind("pink tutu"), "skirt");
  assert.match(fitReport(validateProp(tutu).recipe).join(" "), /all the way round him/);
  // a cape at his front, a huge sweater, a scarf floating off him
  assert.match(fitReport({ ...validateProp({ name: "cape", archetype: "body_wearable", parts: [{ shape: "box", size: [1, 1, 0.05], at: [0, 0, 0.7], color: "#d63a44", material: "cloth" }] }).recipe, name: "cape" }).join(" "), /on his back/);
  assert.match(fitReport({ name: "sweater", archetype: "body_wearable", parts: [{ shape: "cylinder", size: [2.6, 1, 2.4], at: [0, 0, 0], color: "#4fbf8f", material: "cloth", hollow: true, rotate: [0, 0, 0] }] }).join(" "), /too big for him/);
  for (const e of PROP_EXAMPLES.body_wearable) assert.deepEqual(fitReport(validateProp(e).recipe), [], `${e.name} fits as it is`);
  // the coder is told how he's built and where things go; the tester looks at it on him; the fix keeps the look
  // (a kilt: the workshop has no pattern for one, so it's designed; a tutu now starts from the hand-made one)
  const kilt = { ...tutu, name: "kilt" };
  let system = "", fixPrompt = "";
  const llm = fakeLLM({
    classify: [{ archetype: "body_wearable", name: "kilt", kind: "prop" }],
    recipe: [(o) => { system = o.system; return { plan: "a kilt", name: "kilt", parts: kilt.parts }; }],
    look: [{ guess: "a tartan kilt", confidence: 0.8 }],
    fit: [{ fits: false, problem: "it's a flat disc in front of him: make it a frilly ring round his bottom half" }],
    fix: [(o) => { fixPrompt = o.user; return { plan: "a ring round his bottom", name: "kilt", parts: [{ shape: "torus", size: [1.55, 1.5, 0.3], at: [0, -0.3, 0], color: "#ff8fb8", material: "cloth", rotate: [90, 0, 0], label: "skirt" }] }; }],
  });
  const r = await makeCrafter({ llm, renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "a kilt" });
  assert.match(system, /His body is a soft round ball 1.28 wide/); assert.match(system, /his bottom half \(skirt, tutu/);
  assert.match(fixPrompt, /is recognised as a kilt, but it doesn't fit Mochi yet/); assert.match(fixPrompt, /all the way round him/); assert.match(fixPrompt, /frilly ring/);
  assert.equal(r.matched, true); assert.equal(r.recipe.parts[0].shape, "torus", "the fitted one");
  assert.ok(r.attempts[0].fit.length >= 2);
  // the fit round losing it: the recognised one is kept
  const llm2 = fakeLLM({ classify: [{ archetype: "body_wearable", name: "kilt", kind: "prop" }], recipe: [{ plan: "a kilt", name: "kilt", parts: kilt.parts }],
    look: [{ guess: "a tartan kilt", confidence: 0.8 }, { guess: "a donut", confidence: 0.6 }], same: [{ same: false }], fit: [{ fits: true, problem: "" }],
    fix: [{ plan: "x", name: "kilt", parts: [{ shape: "torus", size: [1.55, 1.5, 0.3], at: [0, -0.3, 0], color: "#ff8fb8", material: "cloth", rotate: [90, 0, 0] }] }] });
  const r2 = await makeCrafter({ llm: llm2, renderer: fakeRenderer, log: { log() {}, warn() {} } }).craftProp({ request: "a kilt" });
  assert.equal(r2.matched, true); assert.equal(r2.recipe.parts[0].shape, "coin", "kept the recognised one");
});
