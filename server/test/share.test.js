// Sharing with Mimi and Cocoa (Nov 4, Binoy: "it would also be cool to have mochi be able to share his props with his
// friends like a cookie or something"): who gets it, and what.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shareIntent } from "../brain.js";

const props = [{ id: 3, name: "giant chocolate chip cookie", archetype: "handheld_tool", recipe: { name: "giant chocolate chip cookie" } }, { id: 4, name: "trophy", archetype: "handheld_tool", recipe: {} }, { id: 5, name: "red car", archetype: "ride", recipe: {} }];
const S = (text, o = {}) => { const r = shareIntent({ text, props, ...o }); return r && { who: r.who.join("+"), prop: r.prop.name, give: r.give }; };

test("share it, give them one: who and what", () => {
  assert.deepEqual(S("share your cookie with Mimi"), { who: "mimi", prop: "giant chocolate chip cookie", give: false });
  assert.deepEqual(S("can you share some popcorn with your friends?"), { who: "mimi+cocoa", prop: "popcorn", give: false });
  assert.deepEqual(S("share the pizza slice with Mimi and Cocoa"), { who: "mimi+cocoa", prop: "pizza slice", give: false });
  assert.deepEqual(S("offer cocoa an apple"), { who: "cocoa", prop: "apple", give: false });
  assert.deepEqual(S("give your trophy to Mimi"), { who: "mimi", prop: "trophy", give: true }, "his own, handed over");
  assert.deepEqual(S("share it with them", { holding: { name: "cookie" } }), { who: "mimi+cocoa", prop: "cookie", give: false }, "the one in his hoof");
  assert.deepEqual(S("give them some", { holding: { name: "cookie" } }), { who: "mimi+cocoa", prop: "cookie", give: false });
});

test("not sharing a thing: hugs, rides, kisses, stories, a don't, a car", () => {
  for (const t of ["give mimi a hug", "give cocoa a high five", "give her a piggyback ride", "give mimi a kiss", "I want to share a story with you", "don't share with mimi", "share your feelings with Mimi", "give Mimi a ride in your red car", "share with Cocoa"]) assert.equal(S(t), null, t);
});
