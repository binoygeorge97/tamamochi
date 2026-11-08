// Fixes from Binoy's chats on the M5 (Nov 2, afternoon): tool calls written out as words, words that came with a tool
// call, HTML replies, a friend's line inside his reply, sulking that ended without a sorry, Mimi not showing up, hugs,
// "drive it around".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { leakedToolCalls, plainText, friendLines, hugIntent, rideIntent, stripActions, TOOLS } from "../brain.js";
import { makeReactor } from "../feelings.js";
import { pickCue } from "../cues.js";
import { createServer } from "../index.js";

const NAMES = TOOLS.map((t) => t.function.name);

test("a tool call written as words runs, and isn't shown", () => {
  let r = leakedToolCalls("Turkey borders Greece and Syria. That's a lot of neighbors! show_prop{prop:<|\"|>desk globe<|\"|>}", NAMES);
  assert.equal(r.clean, "Turkey borders Greece and Syria. That's a lot of neighbors!"); assert.deepEqual(r.calls, [{ name: "show_prop", arguments: { prop: "desk globe" } }]);
  r = leakedToolCalls("<|tool_call>call:use_prop{prop:<|\"|>water pistol<|\"|>,aim:true}<tool_call|> Pew!", NAMES);
  assert.equal(r.clean, "Pew!"); assert.deepEqual(r.calls[0].arguments, { prop: "water pistol", aim: true });
  r = leakedToolCalls("Ok use_prop(prop=\"umbrella\") done", NAMES); assert.equal(r.calls[0].arguments.prop, "umbrella");
  r = leakedToolCalls("I will remember (that is important) forever.", NAMES); assert.equal(r.calls.length, 0); assert.equal(r.clean, "I will remember (that is important) forever.");
  // just a value (M5, Nov 4: "Let me get to work on my workbench right away! request_prop(sword)" in his words)
  r = leakedToolCalls("Ooh, a sword? That sounds super cool! Let me get to work on my workbench right away! request_prop(sword)", NAMES);
  assert.equal(r.clean, "Ooh, a sword? That sounds super cool! Let me get to work on my workbench right away!"); assert.deepEqual(r.calls, [{ name: "request_prop", arguments: { name: "sword" } }]);
  r = leakedToolCalls('Here! show_prop("desk globe")', NAMES); assert.deepEqual(r.calls[0].arguments, { prop: "desk globe" }); assert.equal(r.clean, "Here!");
  r = leakedToolCalls("Hmm show_prop() ok", NAMES); assert.equal(r.calls.length, 0);
});

test("HTML and markdown become plain words; a friend's line goes to the friend", () => {
  assert.equal(plainText("<p><em>slides in from the left with a hoof bump</em></p><p>He's right here!</p>"), "*slides in from the left with a hoof bump*\nHe's right here!");
  assert.equal(plainText("**Wow**, that&#39;s great"), "Wow, that's great");
  let f = friendLines("I do! Mimi is my girlfriend, and Cocoa is my best buddy. \"Hey! Did someone say my name?\"");
  assert.equal(f.text, "I do! Mimi is my girlfriend, and Cocoa is my best buddy."); assert.deepEqual(f.lines, [{ who: "cocoa", text: "Hey! Did someone say my name?" }]);
  f = friendLines("Hehe! Mimi: \"So cute!\""); assert.deepEqual(f.lines, [{ who: "mimi", text: "So cute!" }]); assert.equal(f.text, "Hehe!");
  f = friendLines("You said \"pizza\" and I laughed!"); assert.deepEqual(f.lines, []);
  assert.deepEqual(stripActions("*hugs Mimi tightly* She's the best.").actions, [{ kind: "hug", who: "mimi" }]);
  assert.deepEqual(stripActions("*hops on the bicycle and pedals across the stage* Wheee!").actions, [{ kind: "ride", name: "bicycle" }]);
});

test("sulking ends only with a sorry (or after a long quiet while)", async () => {
  const decide = { "you dumb": "hurt", "i will beat you": "hurt", "you suck": "hurt", hello: "neutral", jk: "unhurt", "i love you": "affection", "im sorry": "forgive" };
  const react = makeReactor(async (t) => ({ decision: decide[t] || "neutral", target: "mochi", intent: "x", decision_p: 0.9, request: "none", ms: 1 }));
  const st = { strikes: 0, lastIncrease: 0, careUntil: 0, careModeMs: 1 };
  const seen = [];
  for (const t of ["you suck", "you dumb", "i will beat you", "hello", "jk", "i love you", "im sorry"]) { const r = await react(t, null, st); seen.push(`${t}:${st.strikes}${r.endSulk ? " end" : ""}`); }
  assert.deepEqual(seen, ["you suck:1", "you dumb:2", "i will beat you:3", "hello:3", "jk:3", "i love you:3", "im sorry:0 end"]);
  const noModel = makeReactor(null), st2 = { strikes: 3, lastIncrease: 1, careUntil: 0, careModeMs: 1, sulkAt: Date.now() };
  assert.equal((await noModel("hello", null, st2)).endSulk, false);
  assert.equal((await noModel("sorry mochi", null, st2)).endSulk, true, "an apology in words works without the feelings model too");
  const st3 = { strikes: 3, lastIncrease: 1, careUntil: 0, careModeMs: 1, sulkAt: Date.now() - 11 * 60e3 };
  assert.equal((await noModel("hello", null, st3)).endSulk, true, "he can't stay cross forever");
});

test("Mimi comes when she's mentioned; hugs; 'drive it around' with the bike out rides it", () => {
  const c = pickCue("where is mimi", { decision: "concern" });
  assert.equal(c && c.id, "mimi"); assert.deepEqual(c.friends, [{ who: "mimi", role: "showoff" }]);
  assert.equal(pickCue("where is mimi", { decision: "hurt" }), null);
  assert.equal(hugIntent("give her a hug"), "mimi"); assert.equal(hugIntent("can you hug cocoa?"), "cocoa"); assert.equal(hugIntent("hug me"), null);
  assert.equal(rideIntent("drive it around", [], { name: "bicycle", slot: "ride" }).name, "bicycle"); assert.equal(rideIntent("drive it around"), null);
});

test("server: the ruler comes out even when his words came with the tool and the follow-up was empty", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-fix-"));
  let n = 0;
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1), user = [...body.messages].reverse().find((m) => m.role === "user").content;
    let message;
    if (user === "show me the ruler") message = last.role === "tool" ? { role: "assistant", content: "" } : { role: "assistant", content: "*pulls it out of my pocket*\n\nHere it is! It's got all the little lines on it.", tool_calls: [{ id: "t1", type: "function", function: { name: "show_prop", arguments: JSON.stringify({ prop: "wooden ruler" }) } }] };
    else if (user === "what countries border turkey") message = { role: "assistant", content: "Let me see... Greece, Bulgaria and Syria! show_prop{prop:<|\"|>desk globe<|\"|>}" };
    else if (user === "where is cocoa?") message = { role: "assistant", content: "<p><em>slides in from the left</em></p><p>He's right here!</p> \"Hey there!\"" };
    else message = { role: "assistant", content: "Hi!" };
    n++;
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "f.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const say = async (text) => (await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json()).reply;
  try {
    let r = await say("show me the ruler");
    assert.equal(r.text, "Here it is! It's got all the little lines on it."); assert.ok(!r.fallback);
    assert.ok(r.actions.some((a) => a.kind === "prop" && a.name === "wooden ruler" && a.use === "show"), "the ruler comes out");
    r = await say("what countries border turkey");
    assert.equal(r.text, "Let me see... Greece, Bulgaria and Syria!"); assert.ok(r.actions.some((a) => a.kind === "prop" && a.name === "desk globe"));
    r = await say("where is cocoa?");
    assert.equal(r.text, "He's right here!"); assert.deepEqual(r.friendSay, [{ who: "cocoa", text: "Hey there!" }]);
  } finally { await S.close(); }
});

test("review fixes: fake apologies don't end a sulk; a fresh dig restarts the clock; colours he's told are read right", async () => {
  const { isApology } = await import("../feelings.js");
  for (const t of ["sorry", "I'm so sorry", "my bad", "ok sorry!!"]) assert.ok(isApology(t), t);
  for (const t of ["sorry, not sorry", "I'm not sorry", "you should be sorry", "sorry you're so dumb", "no sorry"]) assert.ok(!isApology(t), t);
  const { favouriteColour } = await import("../gifts.js");
  assert.equal(favouriteColour([{ text: "I hate red but love blue" }]), "blue");
  assert.equal(favouriteColour([{ text: "I don't like pink" }]), null);
  assert.equal(favouriteColour([{ text: "likes my black cat" }]), null);
  assert.equal(favouriteColour([{ text: "my favourite colour is purple" }]), "purple");
  assert.equal(favouriteColour([{ text: "she doesn't like green, prefers lilac" }]), "lilac");
});

test("server: a non-string message and a client that hangs up don't jam the workbench", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-fix2-"));
  let release;
  const fetchImpl = async (url) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "x" }] }), { status: 200 });
    await new Promise((ok) => { release = ok; });
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Hi!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "f.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    // the client goes away mid-reply
    const ctl = new AbortController();
    const p = fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "hello", id: "a" }), signal: ctl.signal }).catch(() => null);
    await new Promise((ok) => setTimeout(ok, 150)); ctl.abort(); await p;
    await new Promise((ok) => setTimeout(ok, 100)); release && release();
    await new Promise((ok) => setTimeout(ok, 100));
    // a bad body: no crash, a normal reply path
    const q = fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: 5, id: "b" }) });
    await new Promise((ok) => setTimeout(ok, 100)); release && release();
    const r = await (await q).json();
    assert.equal(r.reply.text, "Hi!");
    const h = await (await fetch(`http://127.0.0.1:${S.port}/health`)).json();
    assert.ok(h.ok !== undefined);
  } finally { await S.close(); }
});

test("data dressed up as words never reaches his bubble (shared Mochi, Nov 7: `<pre>{\"calls\":, \"on_stage\": \"mochi\"}</pre> Whoops!…`)", async () => {
  const { plainText } = await import("../brain.js");
  assert.equal(plainText('<pre>{"calls":, "on_stage": "mochi"}</pre> Whoops! I missed her and hit Cocoa instead!'), "Whoops! I missed her and hit Cocoa instead!");
  assert.equal(plainText('```json\n{"a": 1}\n```\nHi there!'), "Hi there!");
  assert.equal(plainText('I have {"calls": [{"name": "x"}]} oops'), "I have oops");
  assert.equal(plainText("Use <code>hello</code> to greet me!"), "Use hello to greet me!", "a code block of plain words is just unwrapped");
  assert.equal(plainText("Here you go! {whisper}it's a secret{/whisper} {excited} Yay! {rate=0.8}slow{/}"), "Here you go! {whisper}it's a secret{/whisper} {excited} Yay! {rate=0.8}slow{/}", "voice tags stay");
});

test("a prop request never reaches the workbench as \"undefined\" (Nov 7)", async () => {
  const { nameArg } = await import("../brain.js");
  assert.equal(nameArg({ item: "hair dryer" }), "hair dryer");
  assert.equal(nameArg({ name: "undefined", description: "a red kite" }), "a red kite");
  assert.equal(nameArg({}), "");
});
