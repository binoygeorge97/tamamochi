// A LAN server with no auth: odd input must never take it down (Nov 3 review).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { createServer } from "../index.js";

test("an odd socket message or word rule doesn't crash the server; a friend-only reply is remembered", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-robust-"));
  let reply = { content: "" };
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", ...reply }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "r.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const base = `http://127.0.0.1:${S.port}`;
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${S.port}/ws`);
    await new Promise((ok, no) => { ws.on("open", ok); ws.on("error", no); });
    ws.send(JSON.stringify({ type: "taught", who: "mimi", move: { toString: 1 } }));
    ws.send("null"); ws.send(JSON.stringify({ type: "pat", moveId: { a: 1 } }));
    await new Promise((ok) => setTimeout(ok, 150));
    ws.close();
    assert.equal((await fetch(`${base}/health`)).status, 200, "still up after odd socket messages");
    // an empty model reply with a word rule that names a built-in object property
    const r = await (await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "hello there", rule: "constructor", id: "1" }) })).json();
    assert.equal(typeof r.reply.text, "string");
    assert.equal((await fetch(`${base}/health`)).status, 200, "still up after rule: constructor");
    // Mimi answers on her own: the line is kept in the talk
    reply = { content: 'Mimi: "Hi hi! I\'m great ♡"' };
    const r2 = await (await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Mimi, how are you?", id: "2", friends: { mimi: "hello", cocoa: null } }) })).json();
    assert.equal(r2.reply.friendSay[0].who, "mimi");
    const last = S.memory.recentTurns(2).at(-1);
    assert.ok(last.role === "assistant" && /Mimi: "Hi hi!/.test(last.text), "her line is in the talk, not an empty turn");
  } finally { await S.close(); }
});

test("a broken thought tag isn't a reply: he's asked again for words (M5, Nov 3: 'hold this' → '<thought\\n搬>')", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-thought-"));
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
    const body = JSON.parse(init.body), again = /Now reply to them in words/.test(body.messages[0].content);
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: again ? "Ooh, okay! I've got it." : "<thought\n搬>" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "t.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "hold this", id: "1" }) })).json();
    assert.equal(r.reply.text, "Ooh, okay! I've got it.");
  } finally { await S.close(); }
});
