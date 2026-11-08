// His voice: ElevenLabs through the server with the browser as the floor; pointing ("shoot this thing over here").
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeVoice, pointIntent, voiceConfig } from "../voice.js";
import { createServer } from "../index.js";

const quiet = { log() {}, warn() {} };
test("pointing words: what to do where the finger goes; stories and questions aren't orders", () => {
  assert.deepEqual(pointIntent("can you shoot this thing over here"), { do: "shoot", thing: null });
  assert.deepEqual(pointIntent("throw a snowball at that"), { do: "throw", thing: "snowball" });
  assert.deepEqual(pointIntent("fire the water pistol over there"), { do: "shoot", thing: "water pistol" });
  assert.equal(pointIntent("shoot that with your bazooka").thing, "bazooka");
  assert.equal(pointIntent("look at this").do, "look"); assert.equal(pointIntent("go over there").do, "go"); assert.equal(pointIntent("put it there").do, "put");
  for (const t of ["shoot it", "what is that?", "I threw that yesterday", "don't shoot that", "hello there", "there is a cat"]) assert.equal(pointIntent(t), null, t);
});

test("speech: ElevenLabs when there's a key, the browser's voice otherwise or when it rests; words from a clip", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-voice-")), file = path.join(dir, "keys.json");
  const seen = []; let fail = null;
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    if (fail) return new Response(JSON.stringify({ detail: fail.msg }), { status: fail.status });
    if (url.includes("/text-to-speech/")) return new Response(new Uint8Array([73, 68, 51, 0, 0, 0]), { status: 200, headers: { "content-type": "audio/mpeg" } });
    if (url.includes("/speech-to-text")) return new Response(JSON.stringify({ text: "shoot this thing over here", language_code: "en" }), { status: 200 });
    if (url.includes("/audio/transcriptions")) return new Response(JSON.stringify({ text: "from whisper" }), { status: 200 });
    return new Response("?", { status: 404 });
  };
  let V = makeVoice({ keysFile: file, env: {}, fetchImpl, log: quiet, local: false });
  assert.equal(await V.tts("Hi there! [waves]"), null, "no key: the browser speaks"); assert.equal(V.status().tts, "browser voice"); assert.equal(V.status().elevenlabs, "no key");
  fs.writeFileSync(file, JSON.stringify({ voice: { key: "xi-test-1", voiceId: "v1" } }));
  V = makeVoice({ keysFile: file, env: {}, fetchImpl, log: quiet, local: false });
  const mp3 = await V.tts("Hi there! [waves] *hops*");
  assert.ok(Buffer.isBuffer(mp3) && mp3.length === 6);
  const req = seen.at(-1); assert.ok(req.url.startsWith("https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_22050_32")); assert.equal(req.init.headers["xi-api-key"], "xi-test-1");
  const body = JSON.parse(req.init.body); assert.equal(body.text, "Hi there!"); assert.equal(body.model_id, "eleven_flash_v2_5"); assert.equal(body.voice_settings.speed, 1.05);
  assert.equal(V.sayable("Look! [holds up umbrella] *twirls* https://x.y"), "Look!");
  // a short line said again (every bubble is spoken now, Nov 5): from what was kept, not paid for twice
  const calls = () => seen.filter((s) => s.url.includes("text-to-speech")).length, n0 = calls();
  assert.ok(Buffer.isBuffer(await V.tts("Hehe, that tickles!"))); assert.ok(Buffer.isBuffer(await V.tts("Hehe, that tickles!")));
  assert.equal(calls(), n0 + 1);
  // quota gone: rests, the browser speaks meanwhile; a bad key rests a day
  fail = { status: 429, msg: "quota" }; assert.equal(await V.tts("again"), null); assert.match(V.status().elevenlabs, /^resting/);
  fail = null; assert.equal(await V.tts("still resting"), null); assert.equal(seen.filter((s) => s.url.includes("text-to-speech")).length, 3);
  // speech in: ElevenLabs Scribe
  const r = await V.stt(Buffer.alloc(4000, 1), { mime: "audio/webm", seconds: 3 });
  assert.deepEqual(r, { text: "shoot this thing over here", by: "eleven" });
  const sreq = seen.at(-1); assert.equal(sreq.url, "https://api.elevenlabs.io/v1/speech-to-text"); assert.ok(sreq.init.body instanceof FormData); assert.equal(sreq.init.body.get("model_id"), "scribe_v2");
  // no key at all but a local whisper: that answers
  fs.writeFileSync(file, JSON.stringify({ voice: { localStt: { url: "http://127.0.0.1:8000/v1/", model: "small" } } }));
  V = makeVoice({ keysFile: file, env: {}, fetchImpl, log: quiet, local: false });
  assert.deepEqual(await V.stt(Buffer.alloc(4000, 1)), { text: "from whisper", by: "local" }); assert.equal(seen.at(-1).url, "http://127.0.0.1:8000/v1/audio/transcriptions");
  assert.equal(V.status().stt, "local whisper");
  // nothing: the page listens itself
  fs.writeFileSync(file, "{}"); V = makeVoice({ keysFile: file, env: {}, fetchImpl, log: quiet, local: false });
  assert.equal(await V.stt(Buffer.alloc(4000, 1)), null);
  assert.ok(!JSON.stringify(V.status()).includes("xi-test"), "no key in the status");
  assert.equal(voiceConfig(file, { ELEVENLABS_API_KEY: "xi-env" }).key, "xi-env");
});

test("server: /api/tts and /api/stt, and 'shoot this thing over here' arms a tap with his launcher", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-voice2-")), file = path.join(dir, "keys.json");
  fs.writeFileSync(file, JSON.stringify({ voice: { key: "xi-1" } }));
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "x" }] }), { status: 200 });
    if (url.includes("/text-to-speech/")) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    if (url.includes("/speech-to-text")) return new Response(JSON.stringify({ text: "hello mochi" }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Pew pew!" }, finish_reason: "stop" }] }), { status: 200 });
  };
  const S = await createServer({ db: path.join(dir, "v.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, keysFile: file, cloud: false });
  const base = `http://127.0.0.1:${S.port}`;
  try {
    let r = await fetch(`${base}/api/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Pew!" }) });
    assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "audio/mpeg"); assert.equal((await r.arrayBuffer()).byteLength, 3);
    r = await fetch(`${base}/api/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "" }) }); assert.equal(r.status, 400);
    r = await fetch(`${base}/api/stt`, { method: "POST", headers: { "content-type": "audio/webm", "x-seconds": "2" }, body: Buffer.alloc(3000, 7) });
    assert.equal(r.status, 200); assert.equal((await r.json()).text, "hello mochi");
    r = await fetch(`${base}/api/stt`, { method: "POST", headers: { "content-type": "audio/webm" }, body: Buffer.alloc(10) }); assert.equal(r.status, 400);
    const say = async (text) => (await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, id: String(Math.random()) }) })).json();
    let c = await say("can you shoot this thing over here");
    assert.equal(c.point.do, "shoot"); assert.equal(c.point.prop.name, "water pistol"); assert.ok(!c.cue, "no globe while pointing");
    c = await say("throw a snowball at that"); assert.equal(c.point.do, "throw"); assert.equal(c.point.prop.name, "snowball");
    c = await say("look at this"); assert.equal(c.point.do, "look"); assert.equal(c.point.prop, null);
    c = await say("what is that?"); assert.equal(c.point, null);
    const h = await (await fetch(`${base}/health`)).json(); assert.equal(h.voice.tts, "elevenlabs");
  } finally { await S.close(); }
});

test("the page can ask what the server's voice can do (a phone listens itself, from the tap, when it can't)", async () => {
  const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
  const { createServer } = await import("../index.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-vc-"));
  const fetchImpl = async (url) => (String(url).endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 }) : new Response("{}", { status: 200 }));
  const S = await createServer({ db: path.join(dir, "v.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, keysFile: null, env: {} });
  try {
    const j = await (await fetch(`http://127.0.0.1:${S.port}/api/voice`)).json();
    assert.deepEqual(j, { tts: false, engine: "browser voice", stt: false }, "no key, no Whisper: the page uses its own voice and its own listening");
  } finally { await S.close(); }
});

test("a voice the plan won't speak with (a library voice on a free plan): only that one falls back; a new keys.json tries again (Nov 5)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-voice-")), file = path.join(dir, "keys.json");
  fs.writeFileSync(file, JSON.stringify({ voice: { key: "k-test-1234", voiceId: "MOCHI1", friends: { mimi: "MIMI1", cocoa: "COCOA1" } } }));
  const asked = [];
  const fetchImpl = async (url) => {
    const id = url.split("/text-to-speech/")[1].split("?")[0]; asked.push(id);
    if (id === "MOCHI1" || id === "MIMI1") return new Response(JSON.stringify({ detail: { type: "payment_required", code: "paid_plan_required", message: "Free users cannot use library voices via the API." } }), { status: 402 });
    return new Response(new Uint8Array([73, 68, 51, 0]), { status: 200, headers: { "content-type": "audio/mpeg" } });
  };
  const V = makeVoice({ keysFile: file, fetchImpl, log: quiet, local: false });
  assert.equal(await V.tts("Hello!", { who: "mochi" }), null);
  assert.equal(await V.tts("Hi Mochi!", { who: "mimi" }), null);
  assert.ok(Buffer.isBuffer(await V.tts("Dude!", { who: "cocoa" })), "Cocoa still speaks: not the whole account resting a day");
  assert.equal(await V.tts("Hello again!", { who: "mochi" }), null); assert.equal(asked.filter((x) => x === "MOCHI1").length, 1, "not asked again");
  assert.match(V.status().lastError, /paid ElevenLabs plan/);
  fs.writeFileSync(file, JSON.stringify({ voice: { key: "k-test-1234", voiceId: "MOCHI2", friends: { mimi: "MIMI2", cocoa: "COCOA1" } } }));   // default voices instead
  fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
  assert.ok(Buffer.isBuffer(await V.tts("Hello!", { who: "mochi" }))); assert.ok(Buffer.isBuffer(await V.tts("Hi Mochi!", { who: "mimi" })));
});
