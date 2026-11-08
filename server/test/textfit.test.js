// Words on a prop (Nov 8, server/textfit.js): "write PNC on the bank". Gemini picks the spot, code fits the words,
// Gemini reads the drawing back blind.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../index.js";

const T = await import("../textfit.js");
const C = await import("../../shared/craft.js");
const ALL = Object.values(C.PROP_EXAMPLES).flat(), get = (n) => ALL.find((x) => x.name === n);
const words = (r) => r.parts.find((p) => p.shape === "text");

test("what they asked: the words and the prop; not saving money, dressing up, painting or writing a story", () => {
  const w = (t) => T.textIntent(t);
  assert.deepEqual(w("write PNC on the bank"), { raw: "PNC", text: "PNC", target: "bank", askName: false });
  assert.equal(w("can you write PNC on your bank?").target, "bank");
  assert.equal(w("make the bank say PNC").text, "PNC");
  assert.equal(w('Write "Mochi" on the kite').text, "Mochi");
  assert.equal(w("put the letters ABC on your car").text, "ABC");
  assert.equal(w("paint the number 7 on the race car").target, "race car");
  assert.equal(w("write your name on the wallet").text, "MOCHI");
  assert.equal(w("write my name on the bank").askName, true);
  for (const t of ["write a story about a bank", "put $4 in the piggy bank", "put a hat on Mimi", "paint the present blue", "write a letter to grandma", "Put $3 in Mochi Bank", "what's on the bank?"]) assert.equal(w(t), null, t);
  assert.equal(w("write fuck on the bank").text, null, "kind words only");
  assert.equal(w("write 5551234567 on it").text, null, "no phone numbers");
  assert.equal(w("write HELLO WORLD!!! on the jar").text, null, `at most ${C.TEXT_MAX} characters`);
});

test("a text part: kept by the validator as placed; cleaned; never offered to the recipe writer", () => {
  const v = C.validateProp({ name: "sign", archetype: "companion", parts: [{ shape: "box", size: [0.6, 0.3, 0.05], at: [0, 0.15, 0], color: "#ffffff", material: "wood" }, { shape: "text", text: "  Hi <b>Mimi</b> ", size: [0.4, 0.1, 0.01], at: [0, 0.15, 0.03], color: "#222222" }] });
  assert.ok(v.ok); const t = words(v.recipe); assert.equal(t.text, "Hi bMimib"); assert.equal(t.label, "words"); assert.deepEqual(v.warnings, []);
  assert.ok(!("text" in C.SHAPES), "the recipe prompt still says no words");
  assert.equal(C.validateProp({ name: "x", archetype: "companion", parts: [{ shape: "box", size: [0.3, 0.3, 0.3], at: [0, 0.15, 0] }, { shape: "text", text: "shit", size: [0.2, 0.1, 0.01], at: [0, 0.15, 0.16] }] }).recipe.parts.length, 1);
});

test("where words can go: room, covered faces, and a sign in front of what covers them", () => {
  const bank = get("little bank"), list = T.spots(bank), by = (l) => list.find((s) => s.label === l && s.side === "front");
  assert.ok(by("building").blocked, "the columns cover the wall"); assert.ok(!by("ledge").blocked);
  assert.ok(!list.some((s) => s.label === "ledge" && s.side === "top"), "the ledge's top is under the roof");
  // the ledge is too thin to read: a sign goes up, in front of it, with the words on it
  let f = T.fitText(bank, by("ledge"), "PNC", { color: "#ffffff" });
  assert.ok(f.sign); const sign = f.recipe.parts.find((p) => p.label === "word sign"), t = words(f.recipe);
  assert.ok(t.at[2] > sign.at[2], "words on the front of the sign"); assert.equal(t.color, "#2b2140", "white on cream doesn't read: dark letters");
  assert.deepEqual(C.validateProp(f.recipe).warnings, []);
  // the covered wall: the sign stands in front of the columns
  f = T.fitText(bank, by("building"), "PNC", {}); const s2 = f.recipe.parts.find((p) => p.label === "word sign"), col = bank.parts.find((p) => p.label === "columns");
  assert.ok(s2.at[2] - s2.size[2] / 2 >= col.at[2] + col.size[2] / 2 - 0.01, "in front of the columns");
  // straight on a big face: no sign, the words fit inside it, the little star under them comes off
  const jar = get("savings jar"), label = T.spots(jar).find((s) => s.label === "label" && s.side === "front");
  f = T.fitText(jar, label, "KITE", { color: "#2b8a4a" });
  assert.ok(!f.sign); const w = words(f.recipe);
  assert.ok(w.size[0] <= label.w + 1e-9 && w.size[1] <= label.h + 1e-9, "fits the label"); assert.equal(w.color, "#2b8a4a");
  assert.ok(!f.recipe.parts.some((p) => p.shape === "star" && Math.abs(p.at[1] - w.at[1]) < 0.05 && p.at[2] > 0.2), "the star under the words came off");
  // at the part limit: the words are kept, the last decoration goes
  const piggy = get("piggy bank"); assert.equal(piggy.parts.length, 16);
  f = T.fitText(piggy, T.spots(piggy).find((s) => s.label === "body"), "SAVE", { sign: true });
  assert.ok(words(f.recipe)); assert.ok(f.recipe.parts.length <= 16);
});

test("Gemini picks the spot; the drawing is read back blind; a second, bigger try when it can't be read", async () => {
  const bank = get("little bank"), calls = [];
  const ledge = T.spots(bank).find((s) => s.label === "ledge" && s.side === "front");
  const llm = (reads) => ({ chat: async (a) => { calls.push(a.what); if (a.what === "textspot") return { json: { spot: ledge.n, sign: true, color: "#1f3a8a" }, provider: "gemini", model: "gemini-3.8-flash" }; return { json: { text: reads.shift() ?? "" }, provider: "gemini" }; } });
  const renderer = { render: async () => ({ ok: true, dataUrl: "data:image/png;base64,AAAA" }) };
  let r = await T.writeOn(bank, "PNC", { llm: llm(["PNC"]), renderer });
  assert.equal(r.spot.label, "ledge"); assert.equal(r.by, "gemini-3.8-flash"); assert.equal(r.read, true); assert.equal(r.tries, 1); assert.ok(r.sign);
  assert.deepEqual(calls, ["textspot", "textread"]);
  assert.ok(/write "PNC"/.test(T.spotPrompt(bank, "PNC", T.spots(bank))) && !/PNC/.test(T.READ_PROMPT), "the reader isn't told what it says");
  r = await T.writeOn(bank, "PNC", { llm: llm(["P N", "pnc!"]), renderer });
  assert.equal(r.tries, 2); assert.equal(r.read, true, "read on the bigger sign");
  const a = words(T.fitText(bank, ledge, "PNC", { sign: true }).recipe), b = words(T.fitText(bank, ledge, "PNC", { sign: true, grow: 1.35 }).recipe);
  assert.ok(b.size[1] > a.size[1]);
  // no model at all: the code's own pick, not checked
  r = await T.writeOn(bank, "PNC", {}); assert.equal(r.by, "code"); assert.equal(r.read, null); assert.ok(words(r.recipe));
  assert.equal(T.readsAs("It says P.N.C.", "PNC"), true); assert.equal(T.readsAs("PWC", "PNC"), false);
});

test("on the server: the bank comes out with PNC on it; no prop, or words that can't be written, get a kind answer", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-words-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Ooh!" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "m.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false });
  const chat = async (text, body = {}) => (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()), ...body }) })).json();
  try {
    let r = await chat("write PNC on the bank");
    assert.equal(r.wrote.name, "little bank"); assert.equal(words(r.wrote.recipe).text, "PNC"); assert.match(r.reply.text, /PNC/);
    r = await chat("can you write PNC on it?", { holding: { name: "savings jar", slot: "beside" } }); assert.equal(r.wrote.name, "savings jar");
    r = await chat("write SUPERCALIFRAGILISTIC on the bank"); assert.ok(!r.wrote); assert.match(r.reply.text, /short, kind words/);
    r = await chat("write PNC on the spaceship"); assert.ok(!r.wrote); assert.match(r.reply.text, /don't have a spaceship/);
    const m = await (await fetch(`http://127.0.0.1:${S.port}/api/money`)).json(); assert.equal(m.wallet, 0, "not a deposit");
  } finally { await S.close(); }
});
