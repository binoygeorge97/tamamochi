// He said it was there, and it wasn't (Binoy's chats on the M5, Nov 8): "can you give me a bed" → "let me make one!"
// with nothing made (the name came under "prop_name"); "make the bed" → "I have my little bed right here!" with no bed,
// and the watering can held up instead ("can you…" read as the watering can, also for "can you bring out your car");
// show_prop("little bed") failed and he still said "Found it!"; "download the scams knowledge" → "I can't download".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { propIntent, nameArg, propArg } from "../brain.js";
import { createServer, SKILL_ASK } from "../index.js";

test("'can you…' is not the watering can, and Cocoa is a friend before a drink", () => {
  const name = (t) => { const r = propIntent({ text: t, props: [] }); return r && r.prop ? r.prop.name : null; };
  assert.equal(name("yes, can you take out your bazooka"), "big confetti rocket launcher");
  assert.equal(name("can you bring out your car"), "car");
  assert.equal(name("Can you make the bed"), null);
  assert.equal(name("Can you show me a skit about scam"), null);
  assert.equal(name("Can you show me a scam scenario"), null);
  assert.equal(name("show me cocoa"), null);
  assert.equal(name("show me your watering can"), "watering can");
  assert.equal(name("can you show me the hot cocoa"), "hot cocoa");
});

test("a tool's name comes from whatever key it was put under", () => {
  assert.equal(nameArg({ prop_name: "cozy little bed", name: "" }), "cozy little bed");
  assert.equal(nameArg({ item_name: "kite" }), "kite");
  assert.equal(nameArg({ name: "undefined", description: "a red kite" }), "a red kite");
  assert.equal(nameArg({}), "");
  assert.equal(propArg({ name: "desk globe" }), "desk globe");
  assert.equal(propArg({ prop_name: "umbrella" }), "umbrella");
  assert.equal(propArg({ prop: "null" }), "");
});

test("asking him to download his scam skill", () => {
  for (const t of ["Can you download the scams knowledge", "download the scam skill pack", "mochi can you learn about scams?"]) assert.ok(SKILL_ASK.test(t), t);
  for (const t of ["Is this a scam?", "I want to learn about scams", "download a picture", "play the scam game"]) assert.ok(!SKILL_ASK.test(t), t);
});

async function server(script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-claims-"));
  const calls = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), last = body.messages.at(-1), user = [...body.messages].reverse().find((m) => m.role === "user").content.split("\n").at(-1);
    calls.push({ user, last: last.role, retry: /Now reply to them in words/.test(body.messages[0].content) });
    const s = script[user] || { content: "Hm?" };
    let message;
    if (/Now reply to them in words/.test(body.messages[0].content)) message = { role: "assistant", content: s.retry || "Okay!" };
    else if (last.role === "tool") message = { role: "assistant", content: s.after ?? "" };
    else message = { role: "assistant", content: s.content ?? "", ...(s.tool ? { tool_calls: [{ id: "t1", type: "function", function: { name: s.tool[0], arguments: JSON.stringify(s.tool[1]) } }] } : {}) };
    return new Response(JSON.stringify({ choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "c.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const say = async (text) => (await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json()).reply;
  return { S, say, calls };
}

test("his bed comes out when he says it's here, and a failed tool doesn't get a 'Found it!'", async () => {
  const { S, say } = await server({
    "Can you give me a bed": { content: "ooh, I don't have one yet, let me make one!", tool: ["request_prop", { prop_name: "cozy little bed", name: "" }], after: "", retry: "Oh, I already have my little bed! Let's snuggle." },
    "Can you make the bed": { content: "Oh! I forgot I already have my little bed right here! Do you want to snuggle up in it with me?" },
    "Where is the bed": { content: "Found it!", tool: ["show_prop", { prop: "little bed" }] },
    "show me your unicorn lamp": { content: "Found it! Here it is!", tool: ["show_prop", { prop: "unicorn lamp" }], after: "", retry: "Hmm, I don't have a unicorn lamp yet. Want me to make one?" },
    "bring out the moon lamp": { content: 'Here it is! show_prop("moon lamp")' },
    "can I have your phone": { content: 'Ooh, I don\'t have one yet, let me make one! request_prop("phone")' },
  });
  try {
    let r = await say("Can you give me a bed");
    assert.ok(r.actions.some((a) => a.kind === "kit" && a.name === "bed"), "the bed comes out");
    assert.ok(!/let me make/.test(r.text), `not "let me make one" when he has one: ${r.text}`);
    assert.equal(S.memory.queue().length, 0, "nothing queued: he already has a bed");
    r = await say("Can you make the bed");
    assert.ok(r.actions.some((a) => a.kind === "kit" && a.name === "bed"), "said it's right here: it is");
    assert.ok(!r.actions.some((a) => a.kind === "prop" && /watering/.test(a.name)), "not the watering can");
    r = await say("Where is the bed");
    assert.ok(r.actions.some((a) => a.kind === "kit" && a.name === "bed"));
    r = await say("show me your unicorn lamp");
    assert.ok(!/Found it/.test(r.text), r.text);
    assert.match(r.text, /don't have a unicorn lamp/);
    r = await say("bring out the moon lamp");
    assert.match(r.text, /I don't have a moon lamp yet/, "a tool written as words that didn't work: his words give way");
    r = await say("can I have your phone");
    assert.match(r.text, /I already have my little phone/, r.text);
    assert.ok(r.actions.some((a) => a.kind === "kit" && a.name === "phone"));
  } finally { await S.close(); }
});

test("'download the scams knowledge' downloads his skill pack, once", async () => {
  const { S, say } = await server({});
  try {
    let r = await say("Can you download the scams knowledge");
    assert.match(r.text, /Downloading my scam-spotting skill pack/);
    assert.ok((S.memory.get("skills", null) || {}).scams || Object.keys(S.memory.get("skills", null) || {}).length === 1);
    r = await say("Can you download the scams knowledge");
    assert.match(r.text, /already downloaded/);
  } finally { await S.close(); }
});

test("'bake a pumpkin pie' makes a pie, not a birthday cake", async () => {
  const { S, say } = await server({ "make me a pumpkin pie": { content: "It's going to smell amazing!", tool: ["do_activity", { what: "bake a pumpkin pie" }], after: "Into the oven!" } });
  try {
    await say("make me a pumpkin pie");
    const q = S.memory.queue();
    assert.ok(q.some((j) => /pumpkin pie/.test(j.request)), JSON.stringify(q.map((j) => j.request)));
  } finally { await S.close(); }
});
