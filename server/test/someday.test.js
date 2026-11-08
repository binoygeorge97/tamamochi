// The someday list (Nov 4: "[workbench: snack toss → someday list] ... what does someday mean?"). It was a list
// nothing ever took from: the sixth thing asked for within an hour went on it and stayed. Now what you ask for only
// waits there when five things are already waiting, and the bench takes from it whenever it's free.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openMemory } from "../memory.js";

const fresh = () => openMemory(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mochi-someday-")), "s.sqlite"));
const finish = (M) => { const j = M.nextJob(); M.setJob(j.id, { status: "done" }); return j; };

test("you asking for six things in a few minutes: all six get made, one after another", () => {
  const M = fresh();
  for (let i = 1; i <= 5; i++) { assert.equal(M.enqueue({ kind: "prop", request: `thing ${i}: x` }).status, "queued"); finish(M); }
  assert.equal(M.enqueue({ kind: "move", request: "snack toss: hand snacks over" }).status, "queued", "not the someday list: the bench is free");
  assert.equal(finish(M).request, "snack toss: hand snacks over");
});

test("a full bench: the extra goes on the someday list, and gets made once the bench is free (yours before his)", () => {
  const M = fresh();
  for (let i = 1; i <= 5; i++) M.enqueue({ kind: "prop", request: `thing ${i}: x` });
  const mine = M.enqueue({ kind: "prop", request: "giant cookie: yum" }), his = M.enqueue({ kind: "prop", request: "kite: his idea", source: "mochi" });
  assert.equal(mine.status, "someday"); assert.equal(his.status, "someday");
  for (let i = 0; i < 5; i++) finish(M);
  assert.equal(finish(M).request, "giant cookie: yum");
  assert.equal(finish(M).request, "kite: his idea");
  assert.equal(M.nextJob(), undefined);
});

test("his own ideas: still five an hour", () => {
  const M = fresh();
  for (let i = 1; i <= 5; i++) { M.enqueue({ kind: "prop", request: `idea ${i}: x`, source: "mochi" }); finish(M); }
  assert.equal(M.enqueue({ kind: "prop", request: "idea 6: x", source: "mochi" }).status, "someday");
  assert.equal(M.nextJob(), undefined, "not yet: he's had his five this hour");
});

// Nov 4: "make a cookie" went on the someday list; "show em the cookie" → "I don't have one ready yet, but I'm working
// on it! I'll show it to you as soon as it's done baking." while he held up the cookie from his pocket.
test("he says there isn't one while holding one up: the words give way to what he's holding", async () => {
  const { makeBrain } = await import("../brain.js");
  const M = fresh();
  for (let i = 1; i <= 5; i++) M.enqueue({ kind: "prop", request: `thing ${i}: x` });
  M.enqueue({ kind: "prop", request: "giant chocolate chip cookie: a giant, yummy chocolate chip cookie" });
  const said = "I don't have one ready yet, but I'm working on it! I'll show it to you as soon as it's done baking.";
  const fetchImpl = async () => new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: said }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), { status: 200, headers: { "content-type": "application/json" } });
  const brain = makeBrain({ memory: M, fetchImpl, log: { log() {}, warn() {}, error() {} } });
  const r = await brain.reply({ text: "show em the cookie" });
  const shown = r.actions.find((a) => a.kind === "prop");
  assert.ok(shown && /cookie/.test(shown.name), "the cookie from his pocket");
  assert.doesNotMatch(r.text, /don'?t have|working on it/i);
  assert.match(r.text, /giant chocolate chip cookie isn't ready yet, but here's a little cookie from my pocket/);
});
