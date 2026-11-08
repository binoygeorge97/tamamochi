// Judges (Nov 7, Binoy: "Can mochi also act like a judge - both a casual hackathon judge and a civil court judge (and
// also have the corresponding attires for them)?"): two book entries and their outfits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bookIntent, routineFor } from "../book.js";
import { BOOK_BY_ID } from "../../shared/activity-book.js";
import { PROP_EXAMPLES, validateProp } from "../../shared/craft.js";

test("the words: a hackathon judge or a court judge; their outfits are real patterns", () => {
  const id = (t) => (bookIntent(t) || {}).id || null;
  for (const t of ["be a hackathon judge", "can you be a judge at our hackathon?", "act like a casual hackathon judge", "judge my project", "rate my app", "grade my pitch", "be a judge for our hackathon"]) assert.equal(id(t), "hackjudge", t);
  for (const t of ["can you be a judge?", "be a judge", "can you act like a civil court judge?", "Cocoa ate my sandwich, can you judge this case?", "order in the court!", "play court", "pretend to be a judge"]) assert.equal(id(t), "courtjudge", t);
  for (const t of ["I am a judge", "the judges loved it", "help me with my project", "score a goal"]) assert.notEqual(id(t), "courtjudge", t), assert.notEqual(id(t), "hackjudge", t);
  const all = Object.values(PROP_EXAMPLES).flat();
  for (const n of ["judge's robe", "gavel", "sound block", "hackathon hoodie", "clipboard"]) { const e = all.find((x) => x.name === n); assert.ok(e, n); const v = validateProp(e, { request: n }); assert.ok(v.recipe, n); assert.deepEqual(v.warnings, [], n); }
  const court = routineFor(BOOK_BY_ID.courtjudge, { ask: "be a judge" }), hack = routineFor(BOOK_BY_ID.hackjudge, { ask: "be a hackathon judge" });
  const props = (r) => r.steps.filter((s) => s.prop).map((s) => `${s.do}:${s.prop.name}`);
  assert.deepEqual(props(court), ["wear:judge's robe", "set:sound block", "hold:gavel"]);
  assert.deepEqual(props(hack), ["wear:hackathon hoodie", "hold:clipboard"]);
  assert.ok(court.talk && hack.talk, "his reply is the verdict, or the scores");
  assert.ok(court.steps.some((s) => s.do === "sound" && s.kind === "knock"), "the gavel knocks");
});
