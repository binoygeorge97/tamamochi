// The cloud boost (Nov 7, the MLH "Best use of Gemini" track): nothing leaves the computer until a grown-up switches
// the boost on (workshop page, only on this computer when he's shared). Then Gemini looks over each new prop (the
// critique: it sees the render and the drawing) and writes when the writer on this computer can't; the badge says
// "to the cloud: Gemini (critique, backup writer)". Models on this computer (LM Studio, "local") never need it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeRouter, readKeys, isLocalUrl } from "../router.js";
import { createServer, cloudRoles } from "../index.js";

const quiet = { log() {}, warn() {} };
function fakeLocal() {
  const calls = [];
  return { model: "google/gemma-4-26b-a4b", calls, vision: true, structured: true, async models() { return []; },
    async chat(a) { calls.push(a.what); return { text: '{"from":"gemma"}', json: { from: "gemma" }, ms: 1, usage: null, finish: "stop" }; } };
}
const ok = (who) => new Response(JSON.stringify({ choices: [{ message: { content: `{"from":"${who}"}` }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
function net(fail = {}) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    const who = url.includes("googleapis") ? "gemini" : url.includes("127.0.0.1:1234") ? "nemotron" : "other";
    seen.push({ who, body: JSON.parse(init.body), auth: init.headers.authorization });
    if (fail[who]) return new Response(JSON.stringify({ error: { message: "busy" } }), { status: fail[who], headers: { "content-type": "application/json" } });
    return ok(who);
  };
  return { fetchImpl, seen };
}
const keys = (o) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-boost-")), file = path.join(dir, "keys.json"); fs.writeFileSync(file, JSON.stringify({ geminiMore: false, ...o })); return file; };   // (the roles as they were; Gemini doing more: router.test.js)
const NEMO = { name: "nemotron", baseUrl: "http://127.0.0.1:1234/v1", model: "nvidia/nemotron-3-nano", vision: false, temperature: 0.2 };

test("on this computer or not: LM Studio's address is local, and a local model needs no key", () => {
  for (const u of ["http://127.0.0.1:1234/v1", "http://localhost:1234/v1", "http://[::1]:1234/v1"]) assert.ok(isLocalUrl(u), u);
  for (const u of ["https://generativelanguage.googleapis.com/v1beta/openai", "http://192.168.1.5:1234/v1", "http://127.0.0.1.evil.com/v1"]) assert.ok(!isLocalUrl(u), u);
  const k = readKeys({ file: keys({ gemini: { key: "AIza-1" }, more: [NEMO] }), env: {} });
  const by = Object.fromEntries(k.providers.map((p) => [p.name, p]));
  assert.equal(by.nemotron.local, true); assert.equal(by.nemotron.vision, false); assert.equal(by.nemotron.temperature, 0.2);
  assert.equal(by.gemini.local, false); assert.deepEqual(by.gemini.tasks, ["critique"]); assert.ok(by.gemini.backup.includes("recipe"));
  assert.equal(cloudRoles(by.gemini), "critique, backup writer");
  assert.equal(cloudRoles({ tasks: ["recipe", "critique"] }), "writing, critique");
  assert.equal(cloudRoles({ tasks: ["critique", "fix", "remake", "move-fix"], backup: ["recipe", "move"] }), "fixing props, critique");
  assert.equal(readKeys({ file: keys({ gemini: { key: "AIza-1", always: true } }), env: {} }).providers[0].always, true, "on without the switch");
});

test("the gate: with the boost off only models on this computer are asked; on, Gemini critiques and backs up the writer", async () => {
  let boost = false;
  const local = fakeLocal(), N = net(), file = keys({ gemini: { key: "AIza-1" }, more: [NEMO] });
  const R = makeRouter({ local, env: {}, keysFile: file, fetchImpl: N.fetchImpl, log: quiet, gate: (p) => p.local || boost });
  const img = ["data:image/png;base64,AAAA"];
  // off: Nemotron writes, the critique (pictures; Nemotron can't see) stays on Gemma; nothing goes to Google
  assert.equal((await R.chat({ what: "recipe", user: "a kite", schema: { type: "object" } })).provider, "nemotron");
  assert.equal((await R.chat({ what: "critique", user: "?", images: img, schema: { type: "object" } })).provider, "local");
  assert.ok(!N.seen.some((s) => s.who === "gemini"), "nothing left the computer");
  assert.equal(N.seen[0].body.temperature, 0.2, "Nemotron keeps its temperature");
  assert.equal(R.status().providers.find((p) => p.name === "gemini").state, "off: cloud boost off");
  // on: Gemini critiques; Nemotron still writes
  boost = true;
  const c = await R.chat({ what: "critique", user: "?", images: img, schema: { type: "object" } });
  assert.equal(c.provider, "gemini"); assert.equal(N.seen.at(-1).body.messages[0].content[1].image_url.url, img[0]);
  assert.equal((await R.chat({ what: "recipe", user: "a kite", schema: { type: "object" } })).provider, "nemotron");
  assert.equal(R.status().providers.find((p) => p.name === "gemini").state, "ready");
});

test("Gemini backs up the writer only when the writer here couldn't; with no writer here, Gemma writes", async () => {
  const local = fakeLocal(), N = net({ nemotron: 503 });
  const R = makeRouter({ local, env: {}, keysFile: keys({ gemini: { key: "AIza-1" }, more: [NEMO] }), fetchImpl: N.fetchImpl, log: quiet });
  const r = await R.chat({ what: "recipe", user: "a kite", schema: { type: "object" } });
  assert.equal(r.provider, "gemini"); assert.equal(r.backup, true); assert.match(r.tried[0], /nemotron/);
  // Gemini alone: it critiques, but the writing stays with Gemma (a backup never takes the floor's job)
  const local2 = fakeLocal(), N2 = net();
  const R2 = makeRouter({ local: local2, env: {}, keysFile: keys({ gemini: { key: "AIza-1" } }), fetchImpl: N2.fetchImpl, log: quiet });
  assert.equal((await R2.chat({ what: "recipe", user: "a kite", schema: { type: "object" } })).provider, "local");
  assert.equal((await R2.chat({ what: "critique", user: "?", schema: { type: "object" } })).provider, "gemini");
  // "off" in keys.json switches the cloud off, not the models on this computer
  const R3 = makeRouter({ local: fakeLocal(), env: {}, keysFile: keys({ off: true, gemini: { key: "AIza-1" }, more: [NEMO] }), fetchImpl: net().fetchImpl, log: quiet });
  assert.equal((await R3.chat({ what: "recipe", user: "a kite", schema: { type: "object" } })).provider, "nemotron");
  assert.equal((await R3.chat({ what: "critique", user: "?", images: ["data:image/png;base64,AAAA"], schema: { type: "object" } })).provider, "local");
});

test("the switch: off at first, remembered, and the badge names the cloud model and its job only while it's on", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-boost-")), file = keys({ gemini: { key: "AIza-secret-77" } });
  const fetchImpl = async () => new Response("{}", { status: 503 });
  const S = await createServer({ db: path.join(dir, "b.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, keysFile: file, env: {}, cloudFetch: net().fetchImpl, localTTS: false });
  try {
    const base = `http://127.0.0.1:${S.port}`, get = async (u) => (await fetch(base + u)).json();
    let b = await get("/api/cloud-boost");
    assert.equal(b.on, false); assert.deepEqual(b.cloud.map((c) => [c.name, c.roles, c.state]), [["Gemini", "critique, backup writer", "off: cloud boost off"]]);
    assert.deepEqual((await get("/api/growth")).cloud, [], "0 bytes to the cloud");
    b = await (await fetch(base + "/api/cloud-boost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: true }) })).json();
    assert.equal(b.on, true); assert.equal(b.cloud[0].state, "ready");
    assert.deepEqual((await get("/api/growth")).cloud, ["Gemini (critique, backup writer)"]);
    assert.ok(!JSON.stringify(await get("/api/cloud-boost")).includes("AIza"), "no key on the page");
    await fetch(base + "/api/cloud-boost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: false }) });
    assert.deepEqual((await get("/api/growth")).cloud, []);
  } finally { await S.close(); }
});

test("a bench can name one model: just that one writes and checks, switch or not; Gemma when it can't", async () => {
  const local = fakeLocal(), seen = [];
  const fetchImpl = async (url, init) => { seen.push(url); return ok(url.includes("nvidia") ? "nemotron-api" : "gemini"); };
  const R = makeRouter({ local, env: {}, keysFile: keys({ gemini: { key: "AIza-1" }, more: [{ name: "nemotron-api", baseUrl: "https://integrate.api.nvidia.com/v1", key: "nvapi-test", model: "nvidia/nemotron-x", vision: false }] }), fetchImpl, log: quiet, gate: (p) => p.local });
  assert.equal((await R.chat({ what: "recipe", user: "a kite", schema: { type: "object" } })).provider, "local", "boost off: not used");
  assert.equal((await R.chat({ what: "recipe", user: "a kite", schema: { type: "object" }, only: "nemotron-api" })).provider, "nemotron-api");
  assert.equal((await R.chat({ what: "critique", user: "?", images: ["data:image/png;base64,AAAA"], schema: { type: "object" }, only: "nemotron-api" })).provider, "local", "it can't see: Gemma looks");
  assert.ok(!seen.some((u) => u.includes("googleapis")), "Gemini not asked during it");
  assert.equal(readKeys({ file: keys({ more: [{ name: "slow", baseUrl: "http://x.test/v1", key: "k", model: "m", timeoutMs: 180000 }] }), env: {} }).providers[0].timeoutMs, 180000, "a slow thinker gets longer");
});

test("a 400 that doesn't say what's wrong: the extras are dropped one at a time until it answers (Gemini 3.6, Nov 7)", async () => {
  const bodies = [];
  const fetchImpl = async (url, init) => {
    const b = JSON.parse(init.body); bodies.push(b);
    if (b.reasoning_effort || (b.response_format && b.response_format.type === "json_schema")) return new Response(JSON.stringify([{ error: { code: 400, message: "Request contains an invalid argument.", status: "INVALID_ARGUMENT" } }]), { status: 400 });
    return ok("gemini-3.6");
  };
  const R = makeRouter({ local: fakeLocal(), env: {}, keysFile: keys({ more: [{ name: "gemini-3.6", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", key: "k", model: "gemini-3.6-flash", effort: "low", always: true }] }), fetchImpl, log: quiet });
  const r = await R.chat({ what: "recipe", user: "x", schema: { type: "object" } });
  assert.equal(r.provider, "gemini-3.6"); assert.equal(bodies.length, 3);
  assert.equal(bodies.at(-1).reasoning_effort, undefined); assert.equal(bodies.at(-1).response_format.type, "json_object");
});
