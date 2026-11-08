// Kokoro on the M5's CPU (Nov 6): three voices, pitch without chipmunk speed, the acting, a WAV; and which voice
// speaks (ElevenLabs while it can, then Kokoro, then the browser). A stand-in engine plays tones instead of Kokoro.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeLocalTTS, resample, toWav, DEFAULTS } from "../localtts.js";
import { makeVoice } from "../voice.js";
import { createServer } from "../index.js";

const quiet = { log() {}, warn() {} };
const SR = 24000;
// a stand-in for Kokoro: a 220 Hz tone, 60 ms a letter at speed 1, with silence either end; remembers what it was asked
function fakeEngine(asked = []) {
  return async () => ({
    voices: new Set(["af_heart", "af_bella", "am_puck", "bf_emma"]),
    async say(text, { voice, speed }) {
      asked.push({ text, voice, speed });
      const n = Math.round(text.length * 0.06 / speed * SR), pad = 0.2 * SR, a = new Float32Array(n + 2 * pad);
      for (let i = 0; i < n; i++) a[pad + i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / SR);
      return { audio: a, rate: SR };
    },
  });
}
const pcm = (w) => { const v = new Int16Array(w.buffer.slice(w.byteOffset + 44, w.byteOffset + w.length)); return Float32Array.from(v, (x) => x / 32767); };
const hz = (x) => { let c = 0; for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) c++; return c / (x.length / SR); };

test("pitch goes up without the speed changing; a clean resample", () => {
  const x = new Float32Array(SR).map((_, i) => Math.sin(2 * Math.PI * 1000 * i / SR));
  const y = resample(x, 1.5);
  assert.equal(y.length, 16000); assert.ok(Math.abs(hz(y.subarray(100, -100)) - 1500) < 5);
  assert.equal(resample(x, 1), x);
  const w = toWav(new Float32Array([0, 0.5, -0.5, 2]), SR);
  assert.equal(w.toString("ascii", 0, 4), "RIFF"); assert.equal(w.readUInt32LE(24), SR); assert.equal(w.readInt16LE(50), 32767, "clipped, not wrapped"); assert.equal(w.mime, "audio/wav");
});

test("each friend in their own voice; the acting reaches the engine; kept lines; the Voices page's choices", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-kokoro-")), keys = path.join(dir, "keys.json"), settingsFile = path.join(dir, "voices.json");
  fs.writeFileSync(keys, JSON.stringify({ voice: { local: { cocoa: { voice: "bf_emma", pitch: 0 } } } }));
  const asked = [], L = makeLocalTTS({ keysFile: keys, settingsFile, engine: fakeEngine(asked), log: quiet });
  assert.equal(await L.say("Hi!"), null, "not loaded yet: the page speaks it itself this time");
  L.warm();
  const w = await L.say("Hello there, this is a test.", { who: "mochi", wait: true });
  assert.equal(w.mime, "audio/wav");
  const x = pcm(w), want = 220 * 2 ** (DEFAULTS.mochi.pitch / 12);
  assert.ok(Math.abs(hz(x.subarray(1000, -3000)) - want) < 3, `his pitch (${hz(x)} vs ${want})`);
  assert.ok(Math.abs(x.length / SR - (28 * 0.06 + 0.2)) < 0.25, "about as long as the line at his own pace");
  const last = asked.at(-1); assert.equal(last.voice, "af_heart"); assert.ok(Math.abs(last.speed - 1 / 2 ** (DEFAULTS.mochi.pitch / 12)) < 0.01, "made slower by the pitch, then sped up");
  // Mimi and Cocoa: their own voices (Cocoa's from keys.json)
  await L.say("Eep!", { who: "mimi" }); assert.equal(asked.at(-1).voice, "af_bella");
  await L.say("Dude!", { who: "cocoa" }); assert.equal(asked.at(-1).voice, "bf_emma");
  // the acting: a whisper, then a shout, each its own piece
  asked.length = 0;
  await L.say("{whisper}Psst.{/whisper} {loud}Boo!{/loud}", { who: "mochi" });
  assert.deepEqual(asked.map((a) => a.text), ["Psst.", "Boo!"]);
  // a short line again: kept, not made twice
  const n = asked.length; await L.say("{whisper}Psst.{/whisper} {loud}Boo!{/loud}", { who: "mochi" }); assert.equal(asked.length, n);
  // the Voices page keeps a choice (in voices.json, beside keys.json), and can go back to the default
  const v = L.set("mochi", { voice: "am_puck", pitch: 9, rate: 1.1 });
  assert.deepEqual(v, { voice: "am_puck", pitch: 8, rate: 1.1, vol: 1 }, "kept within bounds");
  await L.say("Hello!", { who: "mochi" }); assert.equal(asked.at(-1).voice, "am_puck");
  assert.equal(JSON.parse(fs.readFileSync(settingsFile, "utf8")).mochi.voice, "am_puck");
  L.set("mochi", { voice: "nobody", pitch: "x" }); assert.equal(L.settings().mochi.voice, "am_puck", "nonsense keeps what it was");
  L.set("mochi", null); assert.equal(L.settings().mochi.voice, "af_heart");
  // a voice tried out, not kept
  await L.say("Try me", { who: "mimi", voice: { voice: "af_heart", pitch: 5 } }); assert.equal(asked.at(-1).voice, "af_heart"); assert.equal(L.settings().mimi.voice, "af_bella");
  const st = L.status(); assert.equal(st.state, "ready"); assert.ok(st.lines >= 5 && st.speed > 1);
});

test("not installed: null (the browser's voice), said once, tried again later", async () => {
  const warned = []; let t = 0;
  const L = makeLocalTTS({ engine: async () => { const e = new Error("Cannot find package 'kokoro-js'"); e.code = "ERR_MODULE_NOT_FOUND"; throw e; }, log: { log() {}, warn: (m) => warned.push(m) }, now: () => t });
  assert.equal(await L.say("Hi", { wait: true }), null); assert.equal(L.status().state, "missing");
  assert.equal(await L.say("Hi", { wait: true }), null); assert.equal(warned.length, 1, "said once");
  t += 61000; assert.equal(await L.say("Hi", { wait: true }), null); assert.equal(warned.length, 1);
  assert.match(warned[0], /npm install/);
});

test("which voice speaks: ElevenLabs while it can, Kokoro when it can't, the browser when neither; keys.json can choose", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-engine-")), file = path.join(dir, "keys.json");
  const asked = [], L = makeLocalTTS({ keysFile: file, engine: fakeEngine(asked), log: quiet });
  L.warm(); await L.say("warm", { wait: true });
  let elevenCalls = 0;
  const fetchImpl = async (url) => {
    elevenCalls++;
    if (url.includes("/MOCHI1")) return new Response(JSON.stringify({ detail: { code: "paid_plan_required", message: "Free users cannot use library voices via the API." } }), { status: 402 });
    return new Response(new Uint8Array([73, 68, 51, 0]), { status: 200 });
  };
  // no key: Kokoro, with the line as written (its stage directions are for the acting)
  fs.writeFileSync(file, "{}");
  const V = makeVoice({ keysFile: file, env: {}, fetchImpl, log: quiet, local: L });
  let b = await V.tts("Hi there!", { who: "mimi", raw: "*whispers* Hi there~" });
  assert.equal(b.mime, "audio/wav"); assert.equal(asked.at(-1).text, "Hi there"); assert.equal(V.status().tts, "kokoro");
  // a key: ElevenLabs; a voice it won't speak with: Kokoro for that one
  fs.writeFileSync(file, JSON.stringify({ voice: { key: "k-1", voiceId: "MOCHI1", friends: { mimi: "MIMI1" } } }));
  b = await V.tts("Hello!", { who: "mimi" }); assert.equal(b.mime, "audio/mpeg");
  b = await V.tts("Hello!", { who: "mochi" }); assert.equal(b.mime, "audio/wav");
  b = await V.tts("Hello again!", { who: "mochi" }); assert.equal(b.mime, "audio/wav");
  assert.equal(V.status().tts, "kokoro"); assert.match(V.status().elevenlabs, /paid plan/);
  // "local": Kokoro only, ElevenLabs never asked
  fs.writeFileSync(file, JSON.stringify({ voice: { key: "k-1", engine: "local", friends: { mimi: "MIMI1" } } }));
  const n = elevenCalls; b = await V.tts("Hello friend!", { who: "mimi" }); assert.equal(b.mime, "audio/wav"); assert.equal(elevenCalls, n);
  // "browser": nothing from the server
  fs.writeFileSync(file, JSON.stringify({ voice: { engine: "browser" } }));
  assert.equal(await V.tts("Hello!"), null); assert.equal(V.status().tts, "browser voice");
});

test("server: /api/tts sends Kokoro's WAV; the Voices page can try a voice and keep it (and only here when shared)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-vpage-")), keys = path.join(dir, "keys.json");
  fs.writeFileSync(keys, "{}");
  const asked = [], fetchImpl = async (url) => (String(url).endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "x" }] }), { status: 200 }) : new Response("{}", { status: 200 }));
  const L = makeLocalTTS({ keysFile: keys, settingsFile: path.join(dir, "voices.json"), engine: fakeEngine(asked), log: quiet });
  const S = await createServer({ db: path.join(dir, "v.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, keysFile: keys, env: {}, localTTS: L, cloud: false });
  const base = `http://127.0.0.1:${S.port}`, post = (p, body) => fetch(`${base}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    let r = await post("/api/voice/try", { text: "Hi!", who: "mimi" });
    assert.equal(r.status, 503, "not ready yet: says so");
    await L.say("warm", { wait: true });
    r = await post("/api/tts", { text: "Hello there!", raw: "Hello there! *giggles*", who: "cocoa" });
    assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "audio/wav");
    assert.equal(asked.at(-1).voice, "am_puck");
    const info = await (await fetch(`${base}/api/voice/local`)).json();
    assert.equal(info.kokoro.state, "ready"); assert.equal(info.settings.mimi.voice, "af_bella"); assert.ok(info.voices.length > 10);
    assert.deepEqual(await (await fetch(`${base}/api/voice`)).json(), { tts: true, engine: "kokoro", stt: false });
    r = await post("/api/voice/try", { text: "Eep!", who: "mimi", voice: { voice: "bf_emma", pitch: 4 } });
    assert.equal(r.status, 200); assert.equal(asked.at(-1).voice, "bf_emma");
    r = await post("/api/voice/set", { who: "mimi", voice: { voice: "bf_emma", pitch: 4, rate: 1, vol: 1 } });
    assert.equal(r.status, 200); assert.equal((await r.json()).settings.mimi.voice, "bf_emma");
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "voices.json"), "utf8")).mimi.voice, "bf_emma", "kept next to keys.json");
    r = await post("/api/voice/set", { who: "pip", voice: null }); assert.equal(r.status, 400);
    r = await fetch(`${base}/voices`); assert.equal(r.status, 200); assert.match(await r.text(), /<title>Voices/);
  } finally { await S.close(); }
});

test("his voice tags: heard (reply.say), never shown or remembered (reply.text, his memory)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-tags-"));
  const fetchImpl = async (url) => (String(url).endsWith("/models") ? new Response(JSON.stringify({ data: [{ id: "x" }] }), { status: 200 })
    : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "{whisper}It's a secret.{/whisper} I like your hat! Mimi: \"{excited}Me too!\"" }, finish_reason: "stop" }] }), { status: 200 }));
  const S = await createServer({ db: path.join(dir, "t.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, keysFile: null, env: {}, cloud: false });
  try {
    const r = await (await fetch(`http://127.0.0.1:${S.port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "tell me a secret", id: "t1" }) })).json();
    assert.equal(r.reply.text, "It's a secret. I like your hat!");
    assert.equal(r.reply.say, "{whisper}It's a secret.{/whisper} I like your hat!");
    const f = (r.reply.friendSay || [])[0];
    if (f) { assert.equal(f.text, "Me too!"); assert.equal(f.say, "{excited}Me too!"); }
    const room = await (await fetch(`http://127.0.0.1:${S.port}/api/room`)).json();
    assert.ok(!JSON.stringify(room).includes("{whisper}"), "not kept in his memory");
  } finally { await S.close(); }
});
