// Mimi and Cocoa (Binoy, Nov 2): their lines in their own bubbles (quoted or not), only while they're on stage, talking
// to them directly, and "shoot Cocoa" by name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { friendLines, talkToIntent } from "../brain.js";
import { pointIntent } from "../voice.js";

test("an unquoted 'Mimi: …' line is hers, not his", () => {
  const r = friendLines("Hehe, she's the best girlfriend ever! Mimi: Aww, you're so sweet ♡");
  assert.equal(r.text, "Hehe, she's the best girlfriend ever!");
  assert.deepEqual(r.lines, [{ who: "mimi", text: "Aww, you're so sweet ♡" }]);
  const q = friendLines('Ready for a game? Cocoa: "Dude, I was BORN ready!"');
  assert.deepEqual(q.lines, [{ who: "cocoa", text: "Dude, I was BORN ready!" }]);
  assert.equal(friendLines("I told Mimi about it and she laughed.").lines.length, 0, "a sentence about her is his");
});

test("once she has gone, her lines don't turn up in the chat; if it's all he wrote, she hops back to say it", () => {
  const gone = friendLines("Sure thing! Mimi: Hehe, me too ♡", { only: [] });
  assert.equal(gone.text, "Sure thing!"); assert.equal(gone.lines.length, 0); assert.equal(gone.dropped.length, 1);
  const here = friendLines("Sure thing! Mimi: Hehe, me too ♡", { only: ["mimi"] });
  assert.equal(here.lines.length, 1);
  const only = friendLines('Mimi: "Hi hi!"', { only: [] });
  assert.equal(only.lines.length, 1, "nothing of his own: she says it after all");
});

test("talking to a friend directly", () => {
  assert.equal(talkToIntent("Mimi, how was your day?"), "mimi");
  assert.equal(talkToIntent("hey cocoa!"), "cocoa");
  assert.equal(talkToIntent("what do you think, Mimi?"), "mimi");
  assert.equal(talkToIntent("@cocoa tell me a joke"), "cocoa");
  assert.equal(talkToIntent("cocoa what's your favourite snack"), "cocoa");
  assert.equal(talkToIntent("I like Mimi's bow"), null);
  assert.equal(talkToIntent("is mimi your girlfriend?"), null);
});

test("'shoot Cocoa' names the target; throws and Cocoa's own turn don't", () => {
  assert.deepEqual(pointIntent("shoot cocoa"), { do: "shoot", thing: null, at: "cocoa" });
  assert.equal(pointIntent("can you squirt mimi with your water gun?").at, "mimi");
  assert.equal(pointIntent("blast the bazooka at cocoa").thing, "bazooka");
  assert.equal(pointIntent("Cocoa, shoot Mochi"), null);
  assert.equal(pointIntent("throw a snowball at cocoa"), null);
  assert.equal(pointIntent("don't shoot cocoa"), null);
});

test("Nov 3 review: what isn't talking to a friend, a shot, or a friend's whole line", async () => {
  for (const t of ["cocoa is my favorite drink", "Mimi is so cute", "Cocoa can be so annoying", "did you ask Mimi out?", "you should ask Mimi to dance"]) assert.equal(talkToIntent(t), null, t);
  for (const t of ["hit cocoa with a snowball", "nail cocoa with a water balloon", "shoot Mimi a text", "did the snowball hit cocoa?"]) assert.equal(pointIntent(t), null, t);
  const r = friendLines("Mimi: Aww ♡ Cocoa: Dude!");
  assert.deepEqual(r.lines, [{ who: "mimi", text: "Aww ♡" }, { who: "cocoa", text: "Dude!" }]);
  const { propIntent } = await import("../brain.js");
  const props = [{ id: 1, name: "Confetti Rocket Launcher", archetype: "launcher", recipe: {} }];
  assert.equal(propIntent({ text: "brb, i need to use the bathroom", props, holding: { name: "water pistol" } }), null);
  assert.equal(propIntent({ text: "i love pop music", props, holding: { name: "party popper" } }), null);
  assert.equal(propIntent({ text: "brb", props, recent: ["My water pistol is the best!"] }), null);
  assert.equal(propIntent({ text: "shoot it!", props, holding: { name: "water pistol" } }).use, "fire");
});

test("a dance party: 'let's dance', 'party time', with the friends you name; not a story about a party", async () => {
  const { partyIntent } = await import("../brain.js");
  assert.deepEqual(partyIntent("let's dance!").friends, [], "just him unless it's a party or everyone");
  assert.deepEqual(partyIntent("party time!").friends, ["mimi", "cocoa"]);
  assert.deepEqual(partyIntent("can you dance with your friends?").friends, ["mimi", "cocoa"]);
  assert.deepEqual(partyIntent("mochi, can you dance by yourself?").friends, []);
  assert.deepEqual(partyIntent("dance with mimi").friends, ["mimi"]);
  assert.deepEqual(partyIntent("let's party, just you and me").friends, []);
  for (const t of ["we had a party last night", "the party was so fun", "i don't want to dance", "I went dancing yesterday"]) assert.equal(partyIntent(t), null, t);
});

test("sending the friends home: 'let Mimi and Cocoa leave', 'just you and me'; not 'Mimi should go first'", async () => {
  const { dismissIntent } = await import("../brain.js");
  assert.deepEqual(dismissIntent("can we have some personal time? let mimi and cocoa leave"), ["mimi", "cocoa"]);
  assert.deepEqual(dismissIntent("bye mimi!"), ["mimi"]);
  assert.deepEqual(dismissIntent("tell cocoa to go home"), ["cocoa"]);
  assert.deepEqual(dismissIntent("just you and me now"), ["mimi", "cocoa"]);
  for (const t of ["don't let them leave", "mimi should go first in the game", "let's go to the park", "Mimi, how was your day?"]) assert.equal(dismissIntent(t), null, t);
});

test("talking to Mimi with the button: an answer written as Mochi becomes hers", async () => {
  const fs = (await import("node:fs")).default, os = (await import("node:os")).default, path = (await import("node:path")).default;
  const { createServer } = await import("../index.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-talk-"));
  const fetchImpl = async (url) => url.endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] })) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Hehe, I'm doing great, thank you for asking ♡" }, finish_reason: "stop" }] }));
  const S = await createServer({ db: path.join(dir, "t.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, feelings: null, fetchImpl, cloud: false });
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "how are you today?", id: "1", to: "mimi", friends: { mimi: "hello" } }) })).json();
    assert.equal(r.reply.text, ""); assert.deepEqual(r.reply.friendSay, [{ who: "mimi", text: "Hehe, I'm doing great, thank you for asking ♡" }]);
  } finally { await S.close(); }
});
