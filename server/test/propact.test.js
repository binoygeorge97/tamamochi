// Props acting on props (Nov 7, Binoy: "Props acting on props (scissors cut the paper)").
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { propActIntent, propActNote, PAPER } from "../../shared/propact.js";
import { PROP_EXAMPLES, validateProp } from "../../shared/craft.js";
import { createServer } from "../index.js";

const pocket = Object.values(PROP_EXAMPLES).flat();
const A = (t, props = []) => { const r = propActIntent(t, { props, pocket }); return r ? `${r.verb}: ${r.tool.name} → ${r.target.name}${r.colourName ? ` (${r.colourName})` : ""}` : null; };

test("what they ask him to do to what, with which tool", () => {
  assert.equal(A("water the flower"), "water: watering can → potted sunflower");
  assert.equal(A("cut the paper with the scissors"), "cut: safety scissors → paper");
  assert.equal(A("can you cut the cake?"), "cut: safety scissors → birthday cake");
  assert.equal(A("light the campfire"), "light: star wand → campfire", "a magic spark, never a match");
  assert.equal(A("paint the present blue"), "paint: paintbrush → present (blue)");
  assert.equal(A("pop the balloon"), "pop: pencil → red balloon");
  assert.equal(A("measure the snowman"), "measure: wooden ruler → snowman");
  assert.equal(A("how tall is the sandcastle?"), "measure: wooden ruler → sandcastle");
  assert.equal(A("look at the cupcake with the magnifying glass"), "look: magnifying glass → cupcake");
  assert.equal(A("bonk the drum"), "bonk: toy hammer → toy drum");
  assert.equal(A("water the flower", [{ id: 7, name: "rainbow flower", archetype: "companion", recipe: { parts: [] } }]), "water: watering can → rainbow flower", "his own first");
  assert.equal(A("cut the paper", [{ id: 3, name: "glitter scissors", archetype: "handheld_tool", recipe: { parts: [] } }]), "cut: glitter scissors → paper", "with his own scissors if he made some");
  for (const t of ["have a water fight", "water gun!", "i cut my finger", "paint me a dragon", "light up the room", "pop a confetti popper", "stop cutting the paper", "pop the teapot", "water the teapot", "I painted my room blue", "did you cut it?"]) assert.equal(A(t), null, t);
  assert.ok(validateProp(PAPER).recipe, "plain paper is a prop too");
  assert.match(propActNote(propActIntent("measure the snowman", { pocket }), { hooves: 5 }), /about 5 hooves tall/);
});

test("in the chat: it plays at once (tool in his hoof, the thing beside him), the brain is told, and the reply doesn't swap the tool", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-pa-"));
  const bodies = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Look how big it got!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "p.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: async () => ({ decision: "neutral", request: "perform", ms: 1 }) });
  const post = async (body) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  const sys = () => bodies.at(-1).messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  try {
    let r = await post({ text: "water the flower", id: "a1", rule: "nod" });
    assert.equal(r.propAct.verb, "water"); assert.equal(r.propAct.tool.name, "watering can"); assert.equal(r.propAct.target.name, "potted sunflower");
    assert.ok(Array.isArray(r.propAct.target.recipe.parts), "the page gets what to build");
    assert.ok(!r.activity, "not the gardening activity as well");
    assert.match(sys(), /On screen just now: you watered the potted sunflower with your watering can and it grew bigger/);
    r = await post({ text: "how tall is the snowman?", id: "a2", rule: "nod" });
    assert.equal(r.propAct.verb, "measure"); assert.ok(r.propAct.hooves >= 1 && r.propAct.hooves <= 8, `${r.propAct.hooves} hooves`);
    assert.match(sys(), new RegExp(`about ${r.propAct.hooves} hooves tall`));
    r = await post({ text: "paint the present blue", id: "a3", rule: "nod" });
    assert.equal(r.propAct.colour, "#3d8bff"); assert.ok(!r.activity, "not painting a picture of a present");
    r = await post({ text: "how was your day?", id: "a4", rule: "nod" });
    assert.equal(r.propAct, null);
    // the Ideas chips on the stage (Nov 7) all do what they say, as written there
    const page = fs.readFileSync(new URL("../../web/stage.html", import.meta.url), "utf8");
    const chips = [...page.matchAll(/<button type="button">([^<]+)<\/button>/g)].map((m) => m[1]);
    const want = { "Water the flower": "water", "Cut the paper": "cut", "Light the campfire": "light", "Pop the balloon": "pop" };
    for (const [i, [chip, verb]] of Object.entries(want).entries()) {
      assert.ok(chips.includes(chip), `"${chip}" is in the Ideas row`);
      r = await post({ text: chip, id: `c${i}`, rule: "nod" });
      assert.equal(r.propAct && r.propAct.verb, verb, chip);
    }
  } finally { await S.close(); }
});
