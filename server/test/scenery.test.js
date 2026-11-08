// What his words put on the stage (Nov 5, after a detective game: "a tiny crumb right here near my hoof", "tracks
// leading toward the bushes", "blue fuzz caught on this twig", and none of it was there).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeScenery } from "../scenery.js";
import { sceneryIn } from "../../shared/scenery.js";
import { validateProp } from "../../shared/craft.js";

const mem = () => { const kv = {}; return { get: (k, d) => (k in kv ? kv[k] : d), set: (k, v) => { kv[k] = v; } }; };

test("every ready-made thing is a good prop", async () => {
  const { SCENERY } = await import("../../shared/scenery.js");
  for (const [, name, parts] of SCENERY) assert.ok(validateProp({ name, archetype: "companion", parts: parts() }).recipe, name);
});

test("the detective game: crumb, tracks and bushes, twig and blue fuzz", () => {
  const S = makeScenery({ memory: mem() });
  S.begin();
  assert.deepEqual(S.fromLine("I found something! There's a tiny crumb right here near my hoof. Do you think it's from the cookie?").map((x) => x.name), ["crumbs"]);
  assert.deepEqual(S.fromLine("Wait, I see tiny little brown tracks leading toward the bushes! Do you think we should follow them?").map((x) => x.name), ["bush", "brown tracks"]);
  const r = S.fromLine("Look! There's a tiny bit of blue fuzz caught on this twig... it looks just like Cocoa's bandana!");
  assert.deepEqual(r.map((x) => x.name), ["twig", "blue fuzz"]); assert.equal(r[1].recipe.parts[0].color, "#5b8fe0");
  assert.deepEqual(S.fromLine("Those tracks lead right to the bushes!").map((x) => x.name), [], "already there");
});

test("just chatting: a tree he likes doesn't grow, one he points at does", () => {
  const S = makeScenery({ memory: mem() });
  assert.deepEqual(S.fromLine("I love climbing trees!"), []);
  assert.deepEqual(S.fromLine("Look, there's a big tree over there!").map((x) => [x.name, x.scale]), [["tree", 1.35]]);
  assert.deepEqual(sceneryIn("There's no bush here."), []);
});

test("anything else he points at is made in one quick go, put on, and kept for next time", async () => {
  const M = mem(), sent = [], asks = [];
  const crafter = { craftProp: async (o) => { asks.push(o); return { ok: true, recipe: { name: "lantern", archetype: "companion", parts: [{ shape: "box", size: [0.3, 0.4, 0.3], at: [0, 0.2, 0], color: "#ffd34d", material: "glow" }] } }; } };
  const S = makeScenery({ memory: M, crafter, broadcast: (m) => sent.push(m), log: { log() {}, warn() {} } });
  S.begin();
  assert.deepEqual(S.fromLine("Look! There's an old lantern behind the rock!").map((x) => x.name), ["rock"]);
  await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(asks.length, 1); assert.match(asks[0].request, /^old lantern: /);
  assert.equal(sent[0].type, "scenery"); assert.equal(sent[0].items[0].name, "lantern"); assert.equal(sent[0].items[0].at, "near");
  M.set("scene", { at: 0, items: [] });   // another day, another game
  S.begin();
  assert.deepEqual(S.fromLine("I see a lantern here!").map((x) => x.name), ["lantern"], "at once, from last time");
  assert.equal(asks.length, 1);
  assert.deepEqual(S.fromLine("There's a clue near my hoof, and I found a mystery!"), [], "not things");
});
