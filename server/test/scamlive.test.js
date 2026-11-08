// New scams for the T-Mobile games, written on the fly by Gemini (Nov 8, server/scamlive.js): code decides the answer
// key and throws away anything real or unkind.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../index.js";

const S = await import("../scamlive.js");
const G = await import("../scams.js");
const SCENE = { kind: "text", lines: ["Mochi! A number I don't know texted me! ♡", "‘You WON a free pet hamster! Tap this link in 5 minutes to claim it!’", "It says don't tell anyone. Should I tap it? ♡"], tells: ["prize"] };
const CALL = { title: 'a call from "Pet Shop Prizes"', scammer: ["Ring ring! Pet Shop Prizes here! You won a pony!", "Just read me the code we texted you, quick, before it expires!"], mimi: "A pony?! Um… what do I do? ♡",
  hang: "Say no and hang up", share: "Read him the code", ask: "Ask which pet shop he means", hangSay: "No thank you! *click* ♡", hangLesson: "Perfect! Nobody real asks for your code.", askSay: "Which pet shop is this?",
  dodge: "Uh… the best one! The code, please!", shareSay: "Okay, the code is four, one…", shareLesson: "Never share a code, not even for a pony.", unmask: "Busted! It was me, Cocoa! No pony, sorry!" };

test("a new scam message: Mochi's own rules find its warning signs; nothing real, nothing unkind", () => {
  const r = S.checkScene(SCENE, "mimi");
  assert.deepEqual(r.scene.tells, ["prize", "hurry", "link", "secret"], "the signs in the words, not the ones the model listed");
  assert.equal(r.scene.lines.mimi.length, 3); assert.ok(r.scene.gen);
  for (const bad of [["Bro, Roblox texted me! Free coins!", "Go to roblox-free.com now, hurry!", "Should I tap it?"], ["Mimi, look!", "Call 555-123-4567 today to claim your prize!", "Should I?"], ["Hi", "Hello there", "Nice day"]])
    assert.ok(S.checkScene({ kind: "text", lines: bad, tells: [] }, "cocoa").problems, bad.join(" "));
});

test("a new scam call: the three choices must mean what they say; the lines for each pick come with it", () => {
  const r = S.checkCall(CALL);
  assert.ok(r.call); assert.deepEqual([...r.call.order].sort(), ["ask", "code", "hang"]);
  assert.match(S.checkCall({ ...CALL, ask: "Give him the password" }).problems[0], /"ask" choice reads as code/);
  assert.ok(S.checkCall({ ...CALL, scammer: ["Ring ring! It's PayPal!", "Read me the code!"] }).problems);
  G.setFreshScams({ calls: [r.call], scenes: [S.checkScene(SCENE, "mimi", 7).scene] });
  assert.match(G.callScene(r.call.id).title, /Pet Shop Prizes.*written just now/);
  assert.deepEqual(G.callScene(r.call.id).choice.order, r.call.order);
  assert.ok(G.choiceScene({ id: r.call.id, order: r.call.order }, "ask").beats.some((b) => b.line === "Uh… the best one! The code, please!"));
  assert.match(G.choiceScene({ id: r.call.id, order: r.call.order }, "hang", { reveal: true }).beats[0].line, /say no and hang up/);
  const sc = G.scamScene("gen-7", "mimi"); assert.match(sc.title, /Mimi's text \(a brand-new one/); assert.deepEqual(sc.quiz.tells, ["prize", "hurry", "link", "secret"]);
  assert.deepEqual(G.gradeAnswer("it says I won a prize and to hurry", sc.quiz).found, ["prize", "hurry"]);
  assert.match(G.scamScene("prize", "mimi").title, /^Mimi's text$/, "the hand-written ones are as they were");
  G.setFreshScams({});
});

test("written by Gemini: asked for Gemini first; a bad one is thrown away", async () => {
  const asked = [];
  const llm = (json) => ({ chat: async (a) => { asked.push(a); return { json, provider: "gemini", model: "gemini-3.8-flash" }; } });
  let r = await S.writeScam({ llm: llm(CALL), kind: "call" });
  assert.ok(r.ok); assert.equal(r.call.by, "Gemini"); assert.equal(asked[0].gemini, true); assert.equal(asked[0].what, "scamskit");
  r = await S.writeScam({ llm: llm({ ...SCENE, lines: ["a", "b", "c"] }), kind: "scene", who: "cocoa" }); assert.equal(r.ok, false);
  r = await S.writeScam({ llm: { chat: async () => { throw new Error("down"); } }, kind: "scene" }); assert.equal(r.ok, false);
});

test("on the server: one written on demand goes in the library, and the game plays it first", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-scamlive-"));
  const fetchImpl = async (url, o) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }));
    const body = JSON.parse(o.body || "{}"), call = /made-up scam phone call/.test(JSON.stringify(body.messages || []));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: call ? JSON.stringify(CALL) : "Ooh!" }, finish_reason: "stop" }] }));
  };
  const S2 = await createServer({ db: path.join(dir, "m.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false });
  try {
    const g = await (await fetch(`http://127.0.0.1:${S2.port}/api/scams/fresh/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "call" }) })).json();
    assert.ok(g.ok, JSON.stringify(g.problems)); assert.match(g.call.title, /Pet Shop Prizes/);
    const lib = await (await fetch(`http://127.0.0.1:${S2.port}/api/scams/fresh`)).json();
    assert.equal(lib.calls.length, 1); assert.equal(lib.calls[0].played, false);
  } finally { await S2.close(); G.setFreshScams({}); }
});
