// Nov 5: "I made the gold ring you asked for! …I think." / "i dont see it" / "I'm holding it right here in my hoof!"
// The ring was made as something to wear round his body, 0.4 across, and sat inside his fleece where nobody could see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { guessArchetype, hiddenInBody, asHeld, validateProp } from "../../shared/craft.js";

const ring = { name: "gold ring", archetype: "body_wearable", parts: [
  { shape: "torus", size: [0.4, 0.4, 0.15], at: [0, 0, 0], color: "#ffd700", material: "metal" },
  { shape: "cylinder", size: [0.1, 0.2, 0.1], at: [0, 0.2, 0], rotate: [0, 0, 90], color: "#ffd700", material: "metal" },
  { shape: "sphere", size: [0.25, 0.25, 0.25], at: [0, 0.3, 0], color: "#9fd8ff", material: "glass" },
  { shape: "star", size: [0.1, 0.1, 0.02], at: [0.08, 0.35, 0.507], color: "#ffffff", material: "glow" }] };   // (the real one: a speck of star just out the front)

test("rings, bracelets and gems are held up; a wrestling ring, a swim ring and a necklace aren't jewellery to hold", () => {
  for (const t of ["gold ring", "a shiny gold ring: bright yellow", "diamond bracelet", "magic ring", "pocket watch", "ruby"]) assert.equal(guessArchetype(t), "handheld_tool", t);
  assert.equal(guessArchetype("necklace"), "body_wearable");
  assert.notEqual(guessArchetype("swim ring"), "body_wearable");
});

test("worn inside him, out of sight: he holds it up instead (and a vest or a medal that shows stays worn)", () => {
  assert.equal(hiddenInBody(ring), true);
  const h = asHeld(ring);
  assert.equal(h.archetype, "handheld_tool"); assert.ok(validateProp(h).recipe);
  const tops = h.parts.map((p) => p.at[1] + Math.max(...p.size) / 2), bottoms = h.parts.map((p) => p.at[1] - Math.max(...p.size) / 2);
  assert.ok(Math.max(...tops) - Math.min(...bottoms) <= 0.45, "hoof-sized");
  assert.equal(hiddenInBody({ name: "gold medal", archetype: "body_wearable", parts: [{ shape: "coin", size: [0.3, 0.3, 0.05], at: [0, 0, 0.66], color: "#ffd34d", material: "metal" }] }), false);
  assert.equal(hiddenInBody({ name: "vest", archetype: "body_wearable", parts: [{ shape: "sphere", size: [1.4, 1.2, 1.36], at: [0, 0, 0], color: "#4a8", material: "cloth" }] }), false);
});
