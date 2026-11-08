// Standing up, sitting down, going for a walk, and the big confetti rocket launcher he struggles to carry (Binoy, Nov 2:
// "does mochi stand?" and "a big rocket launcher that it struggles to carry a little but it can still shoot with it").
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stanceIntent, stripActions } from "../brain.js";
import { findPattern } from "../crafter.js";
import { createServer } from "../index.js";
import { validateProp, PROP_EXAMPLES, AMMO, BIG_LAUNCHER } from "../../shared/craft.js";

const big = () => Object.values(PROP_EXAMPLES).flat().find((e) => e.heavy);

test("stand up, sit down, go for a walk: only when it's asked of him", () => {
  for (const [t, want] of [["stand up", "stand"], ["can you stand?", "stand"], ["does mochi stand?", "stand"], ["Mochi, stand up please", "stand"], ["try standing up", "stand"],
    ["can you stand on your back legs?", "stand"], ["sit down", "sit"], ["please sit", "sit"], ["could you sit down for a sec", "sit"], ["go for a walk", "walk"],
    ["can you walk around?", "walk"], ["walk around the stage", "walk"], ["let's go for a walk", "walk"], ["show me you can walk", "walk"]]) assert.equal(stanceIntent(t), want, t);
  for (const t of ["I can't stand my boss", "I walked the dog yesterday", "sit tight", "walk me through it", "stand by", "don't sit down", "what time is it",
    "I went for a walk today", "the kids sat down", "i will stand up for myself", "I like to walk in the park", "stop walking"]) assert.equal(stanceIntent(t), null, t);
  assert.deepEqual(stripActions("*stands up proudly* Ta-da!").actions, [{ kind: "stance", name: "stand" }]);
  assert.deepEqual(stripActions("*sits back down* Comfy.").actions, [{ kind: "stance", name: "sit" }]);
  assert.deepEqual(stripActions("*toddles across the stage*").actions, [{ kind: "stance", name: "walk" }]);
  assert.equal(stripActions("*walks you through it*").actions[0].kind, "mood");
  assert.equal(stripActions("*hops up and down*").actions[0].name, "happy");
});

test("the big confetti rocket launcher: heavy, fires confetti rockets, and every rocket launcher or bazooka is it", () => {
  const e = big(); assert.ok(e, "a heavy launcher pattern");
  const v = validateProp(e);
  assert.ok(v.recipe, v.errors.join("; ")); assert.deepEqual(v.warnings, []);
  assert.equal(v.recipe.heavy, true); assert.equal(v.recipe.ammo, "starbursts"); assert.ok(AMMO.includes("starbursts"));
  assert.ok(v.recipe.muzzle[0] > 1.2, "the muzzle is out at the end of the long tube");
  // starbursts (little confetti rockets) are a listed, harmless kind; anything that sounds like real ammunition is still confetti
  for (const a of ["rockets", "missiles", "fire", "bullets"]) assert.equal(validateProp({ ...e, ammo: a }).recipe.ammo, "confetti", a);
  assert.equal(validateProp({ ...e, ammo: "fireworks" }).recipe.ammo, "starbursts");
  // a small launcher isn't heavy; a big one is, even made from scratch
  assert.ok(!validateProp(Object.values(PROP_EXAMPLES).flat().find((x) => x.name === "water pistol")).recipe.heavy);
  assert.equal(validateProp({ name: "giant bubble cannon", archetype: "launcher", ammo: "bubbles", muzzle: [1, 0.2, 0], parts: [{ shape: "cylinder", size: [0.3, 1.6, 0.3], at: [0.3, 0.2, 0], rotate: [0, 0, 90], color: "#88ccff" }, { shape: "box", size: [0.12, 0.3, 0.12], at: [0, 0, 0], color: "#333333" }] }).recipe.heavy, true);
  // the crafter starts every rocket launcher or bazooka from it, as it is
  for (const n of ["rocket launcher", "big rocket launcher", "bazooka", "grenade launcher"]) { const p = findPattern("launcher", n); assert.equal(p && p.example.name, e.name, n); assert.equal(p.mode, "base"); }
  assert.equal(findPattern("launcher", "water pistol").example.name, "water pistol");
  assert.ok(BIG_LAUNCHER.test("show me your bazooka") && !BIG_LAUNCHER.test("show me your water pistol"));
});

test("server: stand / walk / sit go to the page with his first reaction; a rocket launcher is the big one, not the water pistol", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-stance-"));
  const seen = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1), user = [...body.messages].reverse().find((m) => m.role === "user").content;
    seen.push(body.messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n"));
    let message;
    if (/rocket launcher/.test(user) && last.role !== "tool") message = { role: "assistant", content: "Here it is! *wobbles*", tool_calls: [{ id: "t1", type: "function", function: { name: "show_prop", arguments: JSON.stringify({ prop: "rocket launcher" }) } }] };
    else if (/rocket launcher/.test(user)) message = { role: "assistant", content: "It's so heavy!" };
    else if (/your day/.test(user)) message = { role: "assistant", content: "*stands up* It was great!" };
    else message = { role: "assistant", content: "Okay!" };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "s.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const say = async (text, extra = {}) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()), ...extra }) })).json();
  try {
    let r = await say("does mochi stand?");
    assert.equal(r.stance, "stand"); assert.ok(/you stood up on your little back legs/.test(seen.at(-1)), "the brain hears he stood up");
    r = await say("stand up", { standing: true }); assert.equal(r.stance, "stand"); assert.ok(/already standing/.test(seen.at(-1)));
    r = await say("go for a walk"); assert.equal(r.stance, "walk"); assert.ok(/toddling across the stage/.test(seen.at(-1)));
    r = await say("sit down", { standing: true }); assert.equal(r.stance, "sit");
    r = await say("I can't stand rainy days"); assert.equal(r.stance, null);
    r = await say("tell me about your day"); assert.ok(r.reply.actions.some((a) => a.kind === "stance" && a.name === "stand"), "*stands up* in his words stands him up");
    // a water pistol on the shelf doesn't answer for a rocket launcher
    const wp = validateProp(Object.values(PROP_EXAMPLES).flat().find((x) => x.name === "water pistol")).recipe;
    S.memory.addProp({ name: "water pistol", archetype: "launcher", recipe: wp, origin: "test", source: "user" });
    assert.ok(S.memory.props().some((p) => p.name === "water pistol"));
    r = await say("show me your rocket launcher");
    const shown = r.reply.actions.find((a) => a.kind === "prop");
    assert.ok(shown, "something came out"); assert.equal(shown.name, big().name); assert.equal(shown.recipe.heavy, true);
  } finally { await S.close(); }
});

test("fixes: narration doesn't stand him up; a rocket launcher beats a small launcher he owns by name", async () => {
  for (const t of ["grab coffee and walk to work", "we have stand-up at 9", "so stand up", "then sit down"]) assert.equal(stanceIntent(t), null, t);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-stance2-"));
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "x" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1);
    const message = last.role === "tool" ? { role: "assistant", content: "Here!" } : { role: "assistant", content: "Here!", tool_calls: [{ id: "t1", type: "function", function: { name: "show_prop", arguments: JSON.stringify({ prop: "rocket launcher" }) } }] };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "s.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    const small = validateProp(Object.values(PROP_EXAMPLES).flat().find((x) => x.name === "bubble blaster")).recipe;
    S.memory.addProp({ name: "confetti launcher", archetype: "launcher", recipe: small, origin: "test", source: "user" });
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "show me your rocket launcher", id: "1" }) })).json();
    const shown = r.reply.actions.find((a) => a.kind === "prop");
    assert.equal(shown && shown.name, big().name);
  } finally { await S.close(); }
});
