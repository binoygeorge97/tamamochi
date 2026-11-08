// His own little story (Binoy, Nov 3): plans made of what he has and knows, beats he acts out in a quiet moment, and
// a conversation that can add to or drop them.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openMemory } from "../memory.js";
import { makeStory } from "../story.js";
import { makeBrain } from "../brain.js";
import { PROP_EXAMPLES, MOVE_EXAMPLES } from "../../shared/craft.js";

const fresh = () => openMemory(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mochi-story-")), "m.sqlite"));
const kite = PROP_EXAMPLES.handheld_canopy.find((e) => e.name === "kite");

test("day zero: no plans; plans come from what he learns (a wobbly move, an untried prop, a gap about you)", async () => {
  const memory = fresh(), story = makeStory({ memory });
  assert.deepEqual(story.state().wants, []);
  assert.match(story.context(), /don't have any plans of your own yet/);
  const moveId = memory.addMove({ name: "twirl", recipe: MOVE_EXAMPLES[0], origin: "you posed me", source: "posed", skill: 0.2 });
  const propId = memory.addProp({ name: "kite", archetype: "handheld_canopy", recipe: kite, origin: "made", source: "local" });
  const w = story.state().wants;
  assert.ok(w.some((x) => x.kind === "practise" && x.text === "get my twirl smooth"), JSON.stringify(w));
  assert.ok(w.some((x) => x.kind === "caper" && x.text === "do something fun with my kite"), "a new prop gets a little story");
  assert.ok(w.length <= 3);
  assert.match(story.context(), /get my twirl smooth/);
  // a beat: he practises on his own and gets a little better; the scrapbook remembers
  const b = await story.pickBeat();   // the caper comes first: scenes the page can act out
  assert.equal(b.type, "beat"); assert.equal(b.kind, "caper"); assert.equal(b.prop.id, propId); assert.ok(b.scenes.length >= 1 && b.scenes.length <= 3); assert.ok(b.title);
  assert.ok(memory.scrapbook().some((s) => /on my own/.test(s.entry)));
  assert.match(story.context(), /in the middle of a little story|What you did on your own/);
  // the story carries on until its last scene, then the other plan gets its turn
  let n = 0, last = b; while (!last.last && n++ < 4) last = await story.pickBeat();
  assert.ok(last.last, "the caper ended"); assert.ok(story.state().done.some((d) => /kite/.test(d.text)));
  const b2 = await story.pickBeat(); assert.equal(b2.kind, "practise"); assert.equal(b2.move.id, moveId); assert.ok(memory.moveById(moveId).skill > 0.2);
});

test("the conversation shapes it: want / drop_want tools, and things done together count", async () => {
  const memory = fresh(), story = makeStory({ memory });
  assert.match(story.runTool("want", { text: "fly my kite in the garden", why: "they said it would be fun" }, "you should fly it in the garden"), /added/);
  let w = story.state().wants.find((x) => x.kind === "free");
  assert.equal(w.text, "fly my kite in the garden"); assert.equal(w.from, "you");
  assert.match(story.runTool("want", { text: "fly my kite in the garden" }), /already/);
  assert.match(story.runTool("drop_want", { which: "fly my kite", how: "done, it flew!" }), /done/);
  assert.equal(story.state().wants.length, 0);
  assert.ok(story.state().done.some((d) => /kite/.test(d.text)));
  // the next context tells him to celebrate, once
  assert.match(story.context(), /just managed something/); assert.doesNotMatch(story.context(), /just managed something/);
  // a prop he wanted to try, used with you: done
  const propId = memory.addProp({ name: "kite", archetype: "handheld_canopy", recipe: kite, origin: "made", source: "local" });
  assert.ok(story.state().wants.some((x) => x.kind === "caper" && x.propId === undefined || x.kind === "caper"));
  story.onEvent({ kind: "remembered", text: "favourite colour is green" });
  assert.ok(!story.state().wants.some((x) => x.kind === "ask" && /colour/.test(x.text)), "a fact learned together closes the question");
  // the brain carries the tools and the context
  const brain = makeBrain({ memory, story, fetchImpl: async () => new Response("{}") });
  assert.ok(brain.tools.some((t) => t.function.name === "want"));
  assert.match(brain.context("", null), /plans/);
});

test("the chapter: the model's two sentences, or a plain fallback; no beats while paused", async () => {
  const memory = fresh();
  const llm = { chat: async () => ({ text: "Today I want to get my twirl smooth. I practised twice and wobbled less!", ms: 5 }) };
  const story = makeStory({ memory, llm });
  memory.addMove({ name: "twirl", recipe: MOVE_EXAMPLES[0], origin: "you posed me", source: "posed", skill: 0.3 });
  const c = await story.chapter(); assert.match(c.text, /twirl/);
  const bad = makeStory({ memory, llm: { chat: async () => { throw new Error("down"); } }, log: { warn() {} } });
  await bad.pickBeat();   // something changed, so the chapter is rewritten
  const c2 = await bad.chapter(); assert.match(c2.text, /Right now I want to get my twirl smooth/);
  story.pause(60000); assert.equal(await story.pickBeat(), null);
});

test("capers: the model's scenes, steering from the conversation, and a cross Mimi to make it up to", async () => {
  const memory = fresh();
  const scenes = (how) => ({ title: "the bazooka ambush", scenes: [
    { who: "mochi", do: "call", who2: "mimi", how: "", line: "Mimi! Come here!" }, { who: "mochi", do: "use_on", who2: "mimi", how: "", line: "Surprise!" },
    { who: "mimi", do: "react", who2: "", how, line: how === "annoyed" ? "Mochi! Hmph!" : "Hehe!" }, { who: "mochi", do: "say", who2: "", how: "", line: "Oops." }] });
  let asked = [];
  const llm = { chat: async (q) => { asked.push(q.user); return q.what === "caper" ? { json: scenes(/shield|block/.test(q.user) ? "block" : "annoyed"), ms: 3 } : { text: "Two sentences. About me!", ms: 3 }; } };
  const story = makeStory({ memory, llm, log: { warn() {} } });
  const launcher = PROP_EXAMPLES.launcher.find((e) => e.heavy);
  const propId = memory.addProp({ name: "confetti bazooka", archetype: "launcher", recipe: launcher, origin: "made", source: "local" });
  // "shoot the bazooka at Mimi": the conversation starts a caper with that premise
  assert.match(story.runTool("want", { text: "shoot the bazooka at Mimi", why: "they dared me" }, "you should shoot it at mimi"), /plan now/);
  const c = story.state().wants.find((w) => w.kind === "caper" && /bazooka at mimi/i.test(w.text)); assert.ok(c); assert.equal(c.from, "you");
  const b1 = await story.pickBeat();
  assert.equal(b1.kind, "caper"); assert.equal(b1.title, "the bazooka ambush"); assert.equal(b1.scenes.length, 3); assert.equal(b1.scenes[1].do, "use_on");
  assert.match(asked[0], /shoot the bazooka at Mimi/);
  assert.match(story.context(), /in the middle of a little story.*bazooka ambush.*Next you plan to/);
  // mid-story, they change what happens: the rest is rewritten
  assert.match(story.runTool("steer_story", { how: "Mimi blocks it with a shield" }), /go that way/);
  const b2 = await story.pickBeat();
  assert.ok(b2.scenes.some((sc) => sc.how === "block"), JSON.stringify(b2.scenes)); assert.match(asked.at(-1), /blocks it with a shield/);
  // a caper that ends with Mimi cross leaves a plan to make it up to her, acted out as a hug
  const story2 = makeStory({ memory, llm: { chat: async (q) => (q.what === "caper" ? { json: scenes("annoyed"), ms: 1 } : { text: "x", ms: 1 }) }, log: { warn() {} } });
  memory.set("story", null); memory.addProp({ name: "foam cannon", archetype: "launcher", recipe: launcher, origin: "made", source: "local" });
  let bb = await story2.pickBeat(); while (bb && !bb.last) bb = await story2.pickBeat();
  const mend = story2.state().wants.find((w) => /make it up to Mimi/.test(w.text)); assert.ok(mend, JSON.stringify(story2.state().wants)); assert.match(mend.why, /cross about my foam cannon/);
  const hugBeat = await story2.pickBeat(); assert.equal(hugBeat.kind, "caper"); assert.ok(hugBeat.scenes.some((sc) => sc.how === "hug" || /sorry/i.test(sc.line)));
  assert.equal(memory.props().find((p) => p.id === propId).uses, 2, "firing it counts as using it (once per telling)");
});

test("stage directions in (parentheses) or [brackets] are his body, not his words (M5, Nov 3)", async () => {
  const { stripActions } = await import("../brain.js");
  const r = stripActions("Party time! Let's get this disco ball moving! (A disco ball drops from the top of the screen, colorful lights start spinning everywhere, and upbeat music begins to play.)");
  assert.equal(r.text, "Party time! Let's get this disco ball moving!"); assert.equal(r.actions.length, 1);
  assert.equal(stripActions("(wiggles excitedly) Yay!").text, "Yay!");
  assert.equal(stripActions("Okay [hops on the bike]").actions[0].kind, "ride");
  for (const t of ["I can do it (I think!)", "See you soon (you too, Mimi)!", "The answer is 4 (four)."]) assert.equal(stripActions(t).text, t, t);
});

test("activities in his story: once he's painted, he plans a portrait for a friend and really paints it", async () => {
  const memory = fresh();
  memory.set("paintings", [{ file: "x.png", subject: "a sheep", title: "a sheep", at: new Date().toISOString() }]);
  memory.set("skills", { juggle: { skill: 0.3, times: 1 } });
  const story = makeStory({ memory, log: { warn() {} } });
  const w = story.state().wants;
  assert.ok(w.some((x) => /portrait/.test(x.text)), JSON.stringify(w)); assert.ok(w.some((x) => x.kind === "practise-juggle"));
  let b = await story.pickBeat(), all = [];
  while (b && b.kind === "caper") { all.push(...b.scenes); if (b.last) break; b = await story.pickBeat(); }
  const act = all.find((s) => s.do === "activity");
  assert.ok(act, JSON.stringify(all)); assert.equal(act.act.kind, "paint"); assert.ok(act.act.painting.shapes.length >= 5); assert.match(act.act.subject, /portrait/);
  let j = null; for (let i = 0; i < 8 && !(j && j.kind === "activity"); i++) j = await story.pickBeat();   // (Cocoa's portrait may come first)
  assert.equal(j.kind, "activity"); assert.equal(j.act.kind, "juggle");
});

test("a caper that's only an idea (paint Mimi's portrait) can be written by the model (M5, Nov 4: it crashed on the missing move)", async () => {
  const { writeCaper } = await import("../capers.js");
  let asked = "";
  const llm = { chat: async (o) => { asked = o.user; return { json: { title: "a portrait of Mimi", scenes: [
    { who: "mochi", do: "call", who2: "mimi", line: "Mimi! Sit still!" }, { who: "mochi", do: "activity", how: "paint", who2: "mimi", line: "Mimi's portrait" },
    { who: "mimi", do: "react", how: "hug", line: "I love it!" }] } }; } };
  const c = await writeCaper({ llm, premise: "paint Mimi's portrait and give it to her", log: { warn() {} } });
  assert.equal(c.title, "a portrait of Mimi"); assert.equal(c.scenes.length, 3);
  assert.match(asked, /paint Mimi's portrait/);
});
