// Fixing a prop they don't like ("it's too big"), the water gun mix-up, and clearing his shelf (Binoy, Nov 2).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../index.js";
import { fixIntent, propIntent } from "../brain.js";
import { resizeRecipe, sizeChange, propBounds } from "../../shared/craft.js";

const bowl = () => ({ name: "bowl of soup", archetype: "companion", parts: [
  { shape: "cylinder", size: [1, 0.5, 1], at: [0, 0.25, 0], color: "#ffffff", material: "plastic", hollow: true, label: "bowl" },
  { shape: "cylinder", size: [0.9, 0.05, 0.9], at: [0, 0.45, 0], color: "#e8a33c", material: "plastic", label: "soup" }] });

test("how much bigger or smaller, from their words", () => {
  assert.equal(sizeChange("no it doesnt, it is too big"), 0.65);
  assert.equal(sizeChange("it's way too big"), 0.5);
  assert.equal(sizeChange("a little too big"), 0.82);
  assert.equal(sizeChange("make it smaller please"), 0.65);
  assert.equal(sizeChange("too small!"), 1.45);
  assert.equal(sizeChange("half the size"), 0.5);
  assert.equal(sizeChange("make it green"), null);
  assert.equal(sizeChange("the soup"), null);
});

test("a resized prop keeps its shape and stands where it stood", () => {
  const r = resizeRecipe(bowl(), 0.65);
  assert.ok(r.ok);
  const a = propBounds(bowl().parts).size, b = propBounds(r.recipe.parts).size;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(b[i] / a[i] - 0.65) < 0.02, `axis ${i} scaled`);
  assert.ok(Math.abs(propBounds(r.recipe.parts).lo[1]) < 0.02, "still on the ground");
  assert.equal(r.recipe.name, "bowl of soup");
});

test("a size complaint is a fix only when it's about the prop: 'it', or the prop by name; ordinary chat isn't", () => {
  const names = (x) => (/soup/.test(x) ? { name: "bowl of soup" } : null);
  assert.ok(fixIntent({ text: "no it doesnt, it is too big", names }));
  assert.ok(fixIntent({ text: "too small!", names }));
  assert.ok(fixIntent({ text: "make it smaller please", names }));
  assert.equal(fixIntent({ text: "the soup is too big", names }).target.name, "bowl of soup");
  const c = fixIntent({ text: "the soup", spoken: "Oh, I get it! I'll try to make a smaller bowl so we can actually finish it.", prevUser: "no it doesnt, it is too big", names });
  assert.ok(c && c.carried && c.target.name === "bowl of soup", "a complaint carried into 'the soup', with his promise");
  // not a fix (Nov 3 review): ordinary chat, his own words alone, questions, negations, care
  for (const t of ["can you make your answers shorter?", "the party last night was way too long", "make it shorter", "everything feels way too big for me right now", "is it too big?", "it's not too big", "don't make it smaller", "my house is too big for one person", "make me a bigger umbrella"])
    assert.equal(fixIntent({ text: t, names }), null, t);
  assert.equal(fixIntent({ text: "thanks so much", spoken: "I can make it smaller!", names }), null, "his offer isn't their ask");
  assert.equal(fixIntent({ text: "the soup", spoken: "I can't make it any smaller", prevUser: "it's too big", names }), null, "can't isn't a promise");
});

test("a size fix is only a resize when size is all they asked for", async () => {
  const { pureSize } = await import("../brain.js");
  assert.ok(pureSize("no it doesnt, it is too big", "bowl of soup"));
  assert.ok(pureSize("make the bowl of soup smaller", "bowl of soup"));
  assert.ok(!pureSize("smaller and green please", "bowl of soup"), "the colour needs the workbench");
  assert.ok(!pureSize("the handle is too long", "bowl of soup"), "a part's shape needs the workbench");
  assert.equal(sizeChange("the handle is too long"), null, "too long is a shape, not a size");
});

test("water gun is the pocket water pistol, not the launcher he made", () => {
  const props = [{ name: "Confetti Rocket Launcher", archetype: "launcher", recipe: {} }];
  const r = propIntent({ text: "show me your water gun", props });
  assert.equal(r.prop.name, "water pistol"); assert.equal(r.prop.pocket, true);
  assert.equal(propIntent({ text: "you are showing your rocket launcher, show me the water pistol", props }).prop.name, "water pistol");
  assert.equal(propIntent({ text: "show me your gun", props }).prop.name, "Confetti Rocket Launcher", "a bare 'gun' is still his");
  assert.equal(propIntent({ text: "show me your launcher", props }).prop.name, "Confetti Rocket Launcher");
});

test("end to end: 'it's too big' after a reveal shrinks it; a colour fix goes to the workbench; water gun; clearing the shelf", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-fix-"));
  const script = {
    "no it doesnt, it is too big": { content: "Too big for what? Are you talking about the soup or something else?" },
    "the soup": { content: "Oh, I get it! I'll try to make a smaller bowl so we can actually finish it." },
    "can you make the soup green": { tool: ["fix_prop", { prop: "soup", change: "make the soup green" }] },
    "show me your water gun": { tool: ["show_prop", { prop: "water gun" }] },
  };
  let seen = null;
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1), user = [...body.messages].reverse().find((m) => m.role === "user").content;
    seen = body.messages;
    const key = user.split("\n").at(-1), s = script[key] || { content: "Hm?" };
    const message = last.role === "tool" ? { role: "assistant", content: "There!" } : s.tool ? { role: "assistant", content: null, tool_calls: [{ id: "t" + Math.random(), type: "function", function: { name: s.tool[0], arguments: JSON.stringify(s.tool[1]) } }] } : { role: "assistant", content: s.content };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "f.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const say = async (text) => (await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json()).reply;
  const post = async (p, body) => (await fetch(`http://127.0.0.1:${S.port}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) })).json();
  try {
    const id = S.memory.addProp({ name: "bowl of soup", archetype: "companion", recipe: bowl(), origin: "test", source: "user" });
    S.memory.addProp({ name: "Confetti Rocket Launcher", archetype: "launcher", recipe: { name: "Confetti Rocket Launcher", archetype: "launcher", ammo: "confetti", muzzle: [0.3, 0.2, 0], parts: [{ shape: "box", size: [0.6, 0.2, 0.2], at: [0.1, 0.1, 0], color: "#ff0000", material: "plastic" }] }, origin: "test", source: "user" });
    // the reveal is part of the talk, and "it" is that
    S.memory.turn("assistant", "I made the bowl of soup you asked for! …I think. Does it look right?", { reveal: id });
    S.memory.set("lastReveal", { id, at: Date.now() });
    const w0 = propBounds(bowl().parts).size[0];
    let r = await say("no it doesnt, it is too big");
    assert.ok(seen.some((m) => m.role === "assistant" && /Does it look right/.test(m.content)), "the model sees what he just showed");
    assert.equal(seen.filter((m) => m.role === "user" && m.content.includes("no it doesnt")).length, 1, "their message once, not twice");
    const a = r.actions.find((x) => x.kind === "prop");
    assert.ok(a && a.fixed === "smaller" && a.id === id, "the soup comes out again, smaller");
    let saved = S.memory.props().find((p) => p.id === id);
    assert.ok(Math.abs(propBounds(saved.recipe.parts).size[0] / w0 - 0.65) < 0.02, "and stays smaller");
    // "the soup" right after: the complaint was already handled, no second shrink
    r = await say("the soup");
    assert.ok(!r.actions.some((x) => x.fixed), "not shrunk twice");
    // a colour: back on the workbench as a fix of this one
    r = await say("can you make the soup green");
    const job = S.memory.nextJob();
    assert.ok(job && /green/.test(job.request) && job.context === `fix:${id}`, "a fix job for that prop");
    // the water gun
    r = await say("show me your water gun");
    assert.equal(r.actions.find((x) => x.kind === "prop").name, "water pistol");
    // clear the shelf, then undo
    const c = await post("/api/props/clear");
    assert.equal(c.cleared, 2); assert.equal(S.memory.props().length, 0);
    const u = await post("/api/props/restore", { ids: c.ids });
    assert.equal(u.restored, 2); assert.equal(S.memory.props().length, 2);
  } finally { await S.close(); }
});

test("the workbench remakes a prop in place for a fix job", async () => {
  const { makeCrafter } = await import("../crafter.js");
  const llm = { vision: false, async chat({ what, user }) {
    assert.equal(what, "remake"); assert.ok(/make the soup green/.test(user) && /bowl of soup/.test(user), "it gets the prop and the change");
    const j = bowl(); j.parts[1].color = "#3bbf5c"; return { json: { plan: "soup green", ...j }, provider: "local" };
  } };
  const C = makeCrafter({ llm, renderer: null, log: { log() {}, warn() {} } });
  const r = await C.remakeProp({ recipe: bowl(), change: "make the soup green" });
  assert.ok(r.ok); assert.equal(r.recipe.name, "bowl of soup"); assert.equal(r.recipe.parts[1].color.toLowerCase(), "#3bbf5c");
});

test("'bring out your shield' with the water pistol out shows the shield, not the pistol (M5, Nov 3)", () => {
  const props = [{ id: 1, name: "Confetti Rocket Launcher", archetype: "launcher", recipe: {} }];
  const r = propIntent({ text: "bring out your shield", spoken: "Look, it's my little shield!", props, holding: { name: "water pistol" } });
  assert.equal(r.prop.name, "toy shield");
  assert.equal(propIntent({ text: "show me your globe", props, holding: { name: "water pistol" } }).prop.name, "desk globe");
  assert.equal(propIntent({ text: "show me", props, holding: { name: "water pistol" } }).prop.name, "water pistol", "a bare 'show me' is what he holds");
  assert.equal(propIntent({ text: "do you have a xmas hat?", spoken: "Yep! Here it is!", props }), null, "another kind of hat isn't his party hat");
});

test("'bring out your rocket launcher' with none of his own: the big one from his pocket (Nov 4, shared Mochi)", () => {
  const r = propIntent({ text: "Bring out your rocket launcher", props: [{ id: 4, name: "cup of tea", archetype: "handheld_tool", recipe: {} }] });
  assert.equal(r.use, "show"); assert.equal(r.prop.name, "big confetti rocket launcher"); assert.equal(r.prop.pocket, true);
  assert.equal(propIntent({ text: "show me your rocket launcher", props: [{ name: "Confetti Rocket Launcher", archetype: "launcher", recipe: {} }] }).prop.name, "Confetti Rocket Launcher", "his own first");
});
