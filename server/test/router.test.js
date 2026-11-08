// Cloud models for the crafter, local Gemma as the floor (Binoy, Nov 2): recipes and critiques go to Claude, GPT or
// Gemini in turn; a model that's rate limited, out of credit, down or slow rests and the next takes over; with none
// left (or none set up) everything runs on Gemma. Keys come from a file or the environment and never leave the server.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeRouter, anthropicSchema, readKeys, GEMINI_OPENAI_URL } from "../router.js";
import { propSchema, moveSchema } from "../crafter.js";

const quiet = { log() {}, warn() {} };
function fakeLocal() {
  const calls = [];
  return { model: "google/gemma-4-26b-a4b", calls, vision: true, structured: true, async models() { return ["google/gemma-4-26b-a4b"]; },
    async chat(a) { calls.push({ what: a.what, local: true }); return { text: '{"from":"gemma"}', json: { from: "gemma" }, ms: 5, usage: null, finish: "stop" }; } };
}
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...headers } });
const ENV = { ANTHROPIC_API_KEY: "sk-ant-test-123456", OPENAI_API_KEY: "sk-openai-test-654321", GEMINI_API_KEY: "AIza-test-999999", MOCHI_GEMINI_MORE: "off" };   // (Gemini doing more: its own test below)
// a fake internet: answers like each API, or fails the way we tell it to
function cloud(fail = {}) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body), who = url.includes("anthropic") ? "anthropic" : url.includes("googleapis") ? "gemini" : "openai";
    seen.push({ who, url, body, headers: init.headers });
    const f = typeof fail[who] === "function" ? fail[who](body, seen.filter((s) => s.who === who).length) : fail[who];
    if (f === "hang") return new Promise((_, no) => init.signal.addEventListener("abort", () => no(init.signal.reason)));
    if (f) return json(f.body || { error: { message: f.msg || "nope" } }, f.status, f.headers || {});
    if (who === "anthropic") return json({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: `{"from":"claude"}` }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } });
    return json({ choices: [{ message: { content: `{"from":"${who}"}` }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  };
  return { fetchImpl, seen };
}
const schema = propSchema("launcher");

test("no keys: everything runs on Gemma", async () => {
  const local = fakeLocal(), R = makeRouter({ local, env: {}, fetchImpl: async () => { throw new Error("no internet"); }, log: quiet });
  const r = await R.chat({ what: "recipe", user: "a kite", schema });
  assert.equal(r.provider, "local"); assert.deepEqual(r.json, { from: "gemma" });
  assert.deepEqual(R.status().providers, []);
});

test("recipes go to Claude and GPT in turn (Gemini, by default, critiques and backs up), each spoken to in its own way; quick checks stay on Gemma", async () => {
  const local = fakeLocal(), C = cloud(), R = makeRouter({ local, env: ENV, fetchImpl: C.fetchImpl, log: quiet });
  const got = [];
  for (let i = 0; i < 2; i++) got.push((await R.chat({ what: "recipe", system: "you make toys", user: "a kite", schema, schemaName: "prop", maxTokens: 2600, temperature: 0.55 })).json.from);
  assert.deepEqual(got, ["claude", "openai"]);
  got.push((await R.chat({ what: "critique", user: "what's off?", schema })).json.from);   // (its turn in the critique ring)
  assert.deepEqual(got, ["claude", "openai", "gemini"]);
  const [a, o, g] = C.seen;
  assert.equal(a.url, "https://api.anthropic.com/v1/messages"); assert.equal(a.headers["x-api-key"], ENV.ANTHROPIC_API_KEY); assert.equal(a.headers["anthropic-version"], "2023-06-01");
  assert.equal(a.body.model, "claude-sonnet-5-5"); assert.equal(a.body.system, "you make toys"); assert.equal(a.body.output_config.format.type, "json_schema"); assert.equal(a.body.output_config.effort, "low");
  assert.ok(!JSON.stringify(a.body.output_config.format.schema).match(/maxItems|"minItems":3|minimum|maximum/), "only what Claude's structured outputs take");
  assert.equal(o.url, "https://api.openai.com/v1/chat/completions"); assert.equal(o.headers.authorization, `Bearer ${ENV.OPENAI_API_KEY}`);
  assert.equal(o.body.model, "gpt-5.5"); assert.equal(o.body.response_format.type, "json_schema"); assert.equal(o.body.response_format.json_schema.strict, false);
  assert.ok(o.body.max_completion_tokens >= 2600 && o.body.temperature === undefined && o.body.reasoning_effort === "low");
  assert.equal(g.url, `${GEMINI_OPENAI_URL}/chat/completions`); assert.equal(g.body.model, "gemini-3.6-flash");
  for (const what of ["classify", "look", "same", "pick"]) assert.equal((await R.chat({ what, user: "?" })).provider, "local", what);
  // images: data URLs become Claude's base64 blocks; GPT and Gemini take them as they are
  await R.chat({ what: "critique", user: "what's off?", images: ["data:image/png;base64,iVBORw0KGgo="], schema: { type: "object", properties: { fixes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 } } } });
  const im = C.seen.at(-1);
  assert.equal(im.who, "anthropic"); assert.deepEqual(im.body.messages[0].content[1], { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } });
});

test("rate limited, out of credit, bad key, down: it rests or goes off, the next one takes over, Gemma last", async () => {
  let t = 1_000_000;
  const local = fakeLocal();
  const C = cloud({ anthropic: { status: 429, headers: { "retry-after": "30" }, msg: "rate_limit_error" }, openai: { status: 429, body: { error: { message: "You exceeded your current quota", code: "insufficient_quota" } } }, gemini: { status: 503, msg: "overloaded" } });
  const R = makeRouter({ local, env: ENV, fetchImpl: C.fetchImpl, log: quiet, now: () => t });
  const r = await R.chat({ what: "recipe", user: "a kite", schema });
  assert.equal(r.provider, "local", "all three failed: Gemma made it"); assert.equal(r.tried.length, 3);
  const st = Object.fromEntries(R.status().providers.map((p) => [p.name, p.state]));
  assert.equal(st.anthropic, "resting 30 s"); assert.equal(st.openai, "off: out of credit"); assert.equal(st.gemini, "resting 30 s");
  // while they rest nobody is asked
  const before = C.seen.length; await R.chat({ what: "recipe", user: "a kite", schema }); assert.equal(C.seen.length, before);
  // 31 s later Claude and Gemini are back (GPT stays off: no credit)
  t += 31000;
  const C2 = cloud();
  const R2 = makeRouter({ local, env: ENV, fetchImpl: C2.fetchImpl, log: quiet, now: () => t });
  assert.equal((await R2.chat({ what: "recipe", user: "x", schema })).provider, "anthropic");
  // a bad key or a spend limit switches that one off; a 529 rests it
  const C3 = cloud({ anthropic: { status: 401, msg: "invalid x-api-key" }, openai: { status: 400, msg: "You have reached your specified API usage limits" }, gemini: { status: 529, msg: "overloaded" } });
  const R3 = makeRouter({ local, env: ENV, fetchImpl: C3.fetchImpl, log: quiet, now: () => t });
  assert.equal((await R3.chat({ what: "move", user: "a twirl", schema: moveSchema() })).provider, "local");
  const st3 = Object.fromEntries(R3.status().providers.map((p) => [p.name, p.state]));
  assert.equal(st3.anthropic, "off: bad key"); assert.equal(st3.openai, "off: spend limit"); assert.match(st3.gemini, /^resting/);
  assert.ok(!JSON.stringify(R3.status()).includes("sk-"), "no key in the status");
});

test("a model that's too slow is dropped for that call; a daily cap switches it off until tomorrow", async () => {
  const local = fakeLocal(), C = cloud({ anthropic: "hang" });
  const R = makeRouter({ local, env: ENV, fetchImpl: C.fetchImpl, log: quiet, timeouts: { recipe: 50 } });
  const r = await R.chat({ what: "recipe", user: "a kite", schema });
  assert.equal(r.provider, "openai"); assert.match(r.tried[0], /anthropic: .*timed out/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-keys-")), file = path.join(dir, "keys.json");
  fs.writeFileSync(file, JSON.stringify({ gemini: { key: "AIza-file-1", dailyCalls: 2, tasks: ["recipe", "critique"] } }));   // (its jobs can be set)
  const R2 = makeRouter({ local, env: {}, keysFile: file, fetchImpl: cloud().fetchImpl, log: quiet });
  const who = []; for (let i = 0; i < 3; i++) who.push((await R2.chat({ what: "recipe", user: "x", schema })).provider);
  assert.deepEqual(who, ["gemini", "gemini", "local"]); assert.equal(R2.status().providers[0].state, "off: daily cap");
});

test("the keys file: read, re-read when it changes, other OpenAI-compatible endpoints, switched off", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-keys-")), file = path.join(dir, "keys.json");
  assert.deepEqual(readKeys({ file, env: {} }).providers, []);
  fs.writeFileSync(file, JSON.stringify({ anthropic: { key: "sk-ant-x", model: "claude-opus-5-5" }, openai: { key: "" }, more: [{ name: "groq", baseUrl: "https://api.groq.com/openai/v1", key: "gsk", model: "llama" }], cloudFor: ["recipe"] }));
  const k = readKeys({ file, env: {} });
  assert.deepEqual(k.providers.map((p) => `${p.name}:${p.model}`), ["anthropic:claude-opus-5-5", "groq:llama"]); assert.deepEqual([...k.cloudFor], ["recipe"]);
  const local = fakeLocal(), R = makeRouter({ local, env: {}, keysFile: file, fetchImpl: cloud().fetchImpl, log: quiet });
  assert.equal(R.status().providers.length, 2);
  fs.writeFileSync(file, JSON.stringify({ off: true, anthropic: { key: "sk-ant-x" } })); R.reload();
  assert.equal(R.status().off, true);
  fs.writeFileSync(file, "{ not json"); assert.match(readKeys({ file, env: {} }).error, /keys file/);
});

test("OpenAI-style endpoints: whatever they refuse is dropped and asked again; Claude falls back to plain JSON", async () => {
  const local = fakeLocal();
  const C = cloud({ gemini: (b) => (b.reasoning_effort ? { status: 400, msg: "Unknown name \"reasoning_effort\"" } : b.response_format && b.response_format.type === "json_schema" ? { status: 400, msg: "Invalid JSON payload: response_format.json_schema" } : null) });
  const R = makeRouter({ local, env: { GEMINI_API_KEY: "AIza" }, fetchImpl: C.fetchImpl, log: quiet });
  const r = await R.chat({ what: "critique", user: "a kite", schema });
  assert.equal(r.provider, "gemini"); assert.deepEqual(r.json, { from: "gemini" });
  const last = C.seen.at(-1).body; assert.equal(last.reasoning_effort, undefined); assert.equal(last.response_format.type, "json_object");
  const C2 = cloud({ anthropic: (b) => (b.output_config && b.output_config.format ? { status: 400, msg: "output_config.format.schema: too complex" } : null) });
  const R2 = makeRouter({ local, env: { ANTHROPIC_API_KEY: "sk-ant" }, fetchImpl: C2.fetchImpl, log: quiet });
  assert.equal((await R2.chat({ what: "move", user: "a twirl", schema: moveSchema(), schemaName: "move" })).provider, "anthropic");
  assert.match(C2.seen.at(-1).body.messages[0].content[0].text, /Reply with JSON only/);
});

test("Claude's schemas: every object closed, no bounds it doesn't take (they become words)", () => {
  for (const s of [propSchema("launcher"), propSchema("ride"), moveSchema()]) {
    const a = anthropicSchema(s), txt = JSON.stringify(a);
    assert.ok(!/"(maxItems|minimum|maximum|minLength|maxLength)"/.test(txt));
    // ("pattern" the keyword is gone; "pattern" the part's property, Nov 4, stays)
    const walk = (o) => { if (!o || typeof o !== "object") return; if (o.type === "object" || o.properties) assert.equal(o.additionalProperties, false); if (o.type === "string") assert.equal(o.pattern, undefined); for (const v of Object.values(o)) walk(v); };
    walk(a);
    for (const m of txt.matchAll(/"minItems":(\d+)/g)) assert.ok(+m[1] <= 1);
  }
  assert.match(JSON.stringify(anthropicSchema(propSchema("launcher"))), /exactly 3 items/);
});

test("Gemma can take a turn too", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-keys-")), file = path.join(dir, "keys.json");
  fs.writeFileSync(file, JSON.stringify({ anthropic: { key: "sk-ant-1" }, local: { weight: 1 } }));
  const R = makeRouter({ local: fakeLocal(), env: {}, keysFile: file, fetchImpl: cloud().fetchImpl, log: quiet });
  const who = []; for (let i = 0; i < 4; i++) who.push((await R.chat({ what: "recipe", user: "x", schema })).provider);
  assert.deepEqual(who, ["anthropic", "local", "anthropic", "local"]);
});

test("Gemini does more of the workbench: first tries and Pip's checks, in turn with the other Gemini, Gemma the floor (Nov 8)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-gmore-")), file = path.join(dir, "keys.json");
  const G = (name) => ({ name, baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", key: "k-" + name, model: name === "gemini-3.6" ? "gemini-3.6-flash" : "gemini-3.8-flash", tasks: ["critique", "fix", "remake", "move-fix"], backup: ["recipe", "move"], always: true });
  fs.writeFileSync(file, JSON.stringify({ gemini: { key: "AIza-1", model: "gemini-3.8-flash", tasks: ["critique", "fix", "remake", "move-fix"], backup: ["recipe", "move"], always: true }, more: [G("gemini-3.6")] }));
  const k = readKeys({ file, env: {} });
  for (const p of k.providers) {
    for (const t of ["recipe", "move", "look", "same", "pick", "fit", "critique", "fix"]) assert.ok(p.tasks.includes(t), `${p.name} does ${t}`);
    assert.ok(!p.backup.includes("recipe"), "it leads on first tries now, not just backs up");
    assert.equal(p.dailyCalls, 2000, "room for several calls a prop");
  }
  assert.ok(k.cloudFor.has("look") && k.cloudFor.has("same"));
  // Pip's blind look goes to a Gemini, the two take turns, and Gemma answers when they can't
  const C = cloud();
  const R = makeRouter({ local: fakeLocal(), env: {}, keysFile: file, fetchImpl: C.fetchImpl, log: quiet });
  const img = ["data:image/png;base64,AAAA"];
  const a = await R.chat({ what: "look", user: "What object is it?", images: img, schema: { type: "object" }, schemaName: "look" });
  const b = await R.chat({ what: "look", user: "What object is it?", images: img, schema: { type: "object" }, schemaName: "look" });
  assert.deepEqual([a.provider, b.provider].sort(), ["gemini", "gemini-3.6"], "in turn");
  assert.equal((await R.chat({ what: "recipe", user: "x", schema })).provider.startsWith("gemini"), true, "Kit's first try too");
  assert.equal((await R.chat({ what: "classify", user: "x", schema: { type: "object" } })).provider, "local", "what kind of thing it is stays on Gemma");
  const down = cloud({ gemini: { status: 503, msg: "overloaded" } });
  const R2 = makeRouter({ local: fakeLocal(), env: {}, keysFile: file, fetchImpl: down.fetchImpl, log: quiet });
  assert.equal((await R2.chat({ what: "look", user: "?", images: img, schema: { type: "object" } })).provider, "local", "Gemma is still the floor");
  // switched off in keys.json: the roles as before
  fs.writeFileSync(file, JSON.stringify({ geminiMore: false, gemini: { key: "AIza-1", tasks: ["critique"], backup: ["recipe"] } }));
  const off = readKeys({ file, env: {} });
  assert.deepEqual(off.providers[0].tasks, ["critique"]); assert.ok(!off.cloudFor.has("look"));
});

test("a change they asked for goes to Gemini Flash whatever its roles say; Gemma when it can't or the cloud is off (Nov 8)", async () => {
  const local = fakeLocal(), C = cloud(), R = makeRouter({ local, env: ENV, fetchImpl: C.fetchImpl, log: quiet });
  // with Gemini only critiquing and backing up (MOCHI_GEMINI_MORE off), a remake still goes to Gemini
  for (let i = 0; i < 2; i++) assert.equal((await R.chat({ what: "remake", gemini: true, user: "make it green", schema })).json.from, "gemini");
  assert.ok(!("gemini" in C.seen.at(-1).body), "the flag isn't sent to the model");
  assert.equal((await R.chat({ what: "remake", user: "make it green", schema })).json.from === "gemini", false, "without the flag: the usual roles");
  const D = cloud({ gemini: { status: 500, msg: "down" } }), R2 = makeRouter({ local: fakeLocal(), env: ENV, fetchImpl: D.fetchImpl, log: quiet });
  assert.equal((await R2.chat({ what: "remake", gemini: true, user: "make it green", schema })).provider, "local", "Gemini down: Gemma");
  const R3 = makeRouter({ local: fakeLocal(), env: { ...ENV, MOCHI_CLOUD: "off" }, fetchImpl: C.fetchImpl, log: quiet });
  assert.equal((await R3.chat({ what: "remake", gemini: true, user: "make it green", schema })).provider, "local", "cloud off: Gemma");
  const R4 = makeRouter({ local: fakeLocal(), env: ENV, fetchImpl: C.fetchImpl, log: quiet, gate: (p) => p.local });
  assert.equal((await R4.chat({ what: "remake", gemini: true, user: "make it green", schema })).provider, "local", "cloud boost off: Gemma");
});

test("the scam check: Nemotron reads it; if it can't, Gemini before Gemma (Nov 8)", async () => {
  const NEM = { ...ENV, MOCHI_GEMINI_MORE: "off" };
  const keys = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mochi-keys-")), "keys.json");
  fs.writeFileSync(keys, JSON.stringify({ more: [{ name: "nemotron-brev", baseUrl: "https://brev.example/v1", key: "k", model: "nemotron", background: true }] }));
  const C = cloud({ openai: { status: 500, msg: "down" } });   // (the mock answers Brev as "openai")
  const R = makeRouter({ local: fakeLocal(), keysFile: keys, env: NEM, fetchImpl: C.fetchImpl, log: quiet });
  const r = await R.chat({ what: "scamcheck", user: "is this a scam?", schema, background: true, anyTask: true, thenGemini: true });
  assert.equal(r.provider, "gemini");
  const r2 = await makeRouter({ local: fakeLocal(), keysFile: keys, env: NEM, fetchImpl: C.fetchImpl, log: quiet }).chat({ what: "scamcheck", user: "?", schema, background: true, anyTask: true });
  assert.equal(r2.provider, "local", "without it: Gemma, as before");
});
