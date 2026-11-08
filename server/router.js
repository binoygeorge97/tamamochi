// Cloud models for the crafter, with local Gemma as the floor (Binoy, Nov 2: "uses a mix of these apis and gemma 4,
// and if the api limits have run out then it falls back completely to the local gemma model").
//
// The crafter writes props and moves as code (JSON recipes). That's the slow, hard part for a local model, so those
// calls (and the critique of a render) go to whichever cloud models have keys: Claude (Anthropic's Messages API),
// GPT (OpenAI's Chat Completions) and Gemini (Google's OpenAI-compatible endpoint). Jobs are spread across them in
// turn. Quick checks (what kind of thing is this, the blind look at a render) stay on Gemma: they're fast locally
// and keep the bar the same. Chat never leaves the M5.
//
// When a cloud model can't answer, it rests and the next one takes over:
//   rate limited (429)            rests for its retry-after, else 2 min, 10 min, 1 h as it keeps happening
//   overloaded, 5xx, timeout,
//   network down                  rests 30 s, then 2 min, 10 min
//   out of credit / spend limit,
//   billing (402), bad key (401),
//   no access (403)               off until the keys file changes (or tomorrow, for a spend limit)
//   our own daily cap reached     off until tomorrow
// With none left, everything goes to local Gemma, which is always there.
//
// Keys live in data/keys.json on the M5 (never served, never logged, never sent to the page), or in the usual
// environment variables. The file is re-read when it changes, so keys can be added without a restart.
import fs from "node:fs";
import { extractJson } from "./llm.js";

export const DEFAULT_MODELS = { anthropic: "claude-sonnet-5-5", openai: "gpt-5.5", gemini: "gemini-3.6-flash" };
export const GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const CLOUD_TASKS = ["recipe", "fix", "remake", "move", "move-fix", "critique"];   // what goes to the cloud by default
const TIMEOUTS = { recipe: 75000, fix: 75000, remake: 75000, move: 60000, "move-fix": 60000, critique: 40000 };

/* ------------------------------------------------------------------ config */
/** Read the providers from a keys file and/or the environment. Returns { providers: [...], cloudFor: Set, dailyCalls } */
/** the keys file as an object ({} when there is none; { error } when it won't parse); cached by mtime */
let keysCache = { file: null, stamp: null, json: {} };
export function readKeysFile(file) {
  if (!file) return {};
  let stamp = "none";
  try { stamp = String(fs.statSync(file).mtimeMs); } catch (_) { return {}; }
  if (keysCache.file === file && keysCache.stamp === stamp) return keysCache.json;
  let j = {};
  try { j = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); } catch (e) { if (e.code !== "ENOENT") j = { error: `keys file: ${e.message}` }; }
  keysCache = { file, stamp, json: j };
  return j;
}
// What each provider does (Nov 7, the MLH "Best use of Gemini" track). `tasks`: the jobs it takes in turn (all the
// cloud jobs when not said); `backup`: jobs it takes only when every provider that leads on them couldn't (it never
// takes one from Gemma's floor when nobody leads). Gemini, by default, is the second pair of eyes: it does the
// critique (it sees the render and the drawing) and backs up the writer. `local`: on this computer (LM Studio's
// endpoint, or "local": true), so nothing leaves the house; `vision: false` for a text-only model (no critique).
const ROLES = { gemini: { tasks: ["critique"], backup: ["recipe", "fix", "remake", "move", "move-fix"] } };
export const isLocalUrl = (u) => /^https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|\[::1\])(?::\d+)?(?:\/|$)/i.test(String(u || ""));
const list = (x) => (Array.isArray(x) ? x.map(String) : typeof x === "string" ? x.split(",").map((t) => t.trim()).filter(Boolean) : null);
function roles(c, def, baseUrl) {
  const tasks = list(c.tasks) || (def && def.tasks) || null, backup = list(c.backup) || (def && def.backup) || null;
  // what to add to a request to switch its thinking off (a quick job: the scam check); Nemotron's chat template takes
  // enable_thinking, so it's set for it without asking
  const thinkOff = c.thinkOff && typeof c.thinkOff === "object" ? c.thinkOff : /nemotron/i.test(String(c.model || "")) ? { chat_template_kwargs: { enable_thinking: false } } : null;
  return { tasks, backup, local: c.local === true || (c.local !== false && isLocalUrl(baseUrl)), vision: c.vision !== false, ...(c.background === true ? { background: true } : {}), ...(c.always === true ? { always: true } : {}), ...(thinkOff ? { thinkOff } : {}) };
}
export function readKeys({ file = null, env = process.env } = {}) {
  const j = readKeysFile(file);
  const pick = (name, kind, envKey, extra = {}) => {
    const c = (j && j[name]) || {}, key = String(c.key || env[envKey] || (name === "gemini" ? env.GOOGLE_API_KEY || "" : "")).trim();
    if (!key || c.enabled === false) return null;
    const baseUrl = c.baseUrl || extra.baseUrl || null;
    return { name, kind, key, model: String(c.model || env[`${envKey.replace(/_API_KEY$/, "")}_MODEL`] || DEFAULT_MODELS[name]), baseUrl,
      effort: c.effort || c.reasoningEffort || "low", dailyCalls: +c.dailyCalls || +j.dailyCalls || 300, weight: Math.max(0, c.weight ?? 1), ...(+c.timeoutMs > 0 ? { timeoutMs: +c.timeoutMs } : {}), ...roles(c, ROLES[name], baseUrl) };
  };
  const providers = [pick("anthropic", "anthropic", "ANTHROPIC_API_KEY"), pick("openai", "openai", "OPENAI_API_KEY", { baseUrl: "https://api.openai.com/v1" }),
    pick("gemini", "openai", "GEMINI_API_KEY", { baseUrl: GEMINI_OPENAI_URL })].filter(Boolean).filter((p) => p.weight > 0);
  // any other OpenAI-compatible endpoint: "more": [{ "name", "baseUrl", "key", "model" }]
  for (const m of (Array.isArray(j.more) ? j.more : [])) if (m && m.name && m.baseUrl && (m.key || isLocalUrl(m.baseUrl)) && m.model && m.enabled !== false) providers.push({ name: String(m.name), kind: "openai", key: String(m.key || "lm-studio"), model: String(m.model), baseUrl: String(m.baseUrl), effort: m.effort || null, dailyCalls: +m.dailyCalls || (isLocalUrl(m.baseUrl) ? 100000 : 300), weight: Math.max(0, m.weight ?? 1), ...(m.temperature !== undefined ? { temperature: +m.temperature } : {}), ...(+m.timeoutMs > 0 ? { timeoutMs: +m.timeoutMs } : {}), ...roles(m, null, m.baseUrl) });
  const live = providers.filter((p) => p.weight > 0); providers.length = 0; providers.push(...live);
  const cloudFor = new Set(Array.isArray(j.cloudFor) ? j.cloudFor : String(env.MOCHI_CLOUD_TASKS || CLOUD_TASKS.join(",")).split(",").map((s) => s.trim()).filter(Boolean));
  // Gemma can take a share of the cloud work too ("local": { "weight": 1 } puts it in the turn with the others)
  const localWeight = Math.max(0, Math.round(+((j.local && j.local.weight) ?? 0) || 0));
  return { providers, cloudFor, localWeight, error: j.error || null, off: j.off === true || env.MOCHI_CLOUD === "off" };
}

/* ------------------------------------------------------------------ schemas */
// Anthropic's structured outputs take a subset of JSON Schema: every object closed, no numeric/length bounds, minItems
// only 0 or 1. What's dropped goes into the description so the model still knows, and our validator checks anyway.
export function anthropicSchema(s) {
  if (Array.isArray(s)) return s.map(anthropicSchema);
  if (!s || typeof s !== "object") return s;
  const out = {}, notes = [];
  for (const [k, v] of Object.entries(s)) {
    if (["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "pattern"].includes(k)) { notes.push(`${k} ${v}`); continue; }
    if (k === "maxItems") { if (s.minItems !== v) notes.push(`at most ${v} items`); continue; }
    if (k === "minItems") { if (v === s.maxItems && v > 1) notes.push(`exactly ${v} items`); else if (v > 1) notes.push(`at least ${v} items`); else out.minItems = v; continue; }
    out[k] = k === "properties" ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, anthropicSchema(pv)])) : k === "items" || k === "anyOf" || k === "allOf" ? anthropicSchema(v) : v;
  }
  if (out.type === "object" || out.properties) out.additionalProperties = false;
  if (notes.length) out.description = [out.description, notes.join(", ")].filter(Boolean).join(" (") + (out.description ? ")" : "");
  return out;
}

/* ------------------------------------------------------------------ adapters */
const dataUrlParts = (u) => { const m = /^data:([^;,]+);base64,(.*)$/s.exec(String(u)); return m ? { media: m[1], data: m[2] } : null; };
function httpError(name, res, text) {
  const e = new Error(`${name} ${res.status}: ${String(text).slice(0, 300)}`);
  e.status = res.status; e.body = text; e.retryAfter = +res.headers.get("retry-after") || null; return e;
}
function anthropicAdapter(p, fetchImpl) {
  const plain = new Set();   // schemas this model's structured outputs wouldn't take: asked for as plain JSON instead
  let effortOk = true;
  return async ({ system, user, images = [], schema = null, schemaName = "answer", maxTokens = 800, signal }) => {
    let res, text = "";
    for (let tries = 0; tries < 3; tries++) {
      const asText = schema && plain.has(schemaName);
      const content = [{ type: "text", text: asText ? `${user}\n\nReply with JSON only, matching this schema: ${JSON.stringify(schema)}` : user }];
      for (const u of images) { const d = dataUrlParts(u); if (d) content.push({ type: "image", source: { type: "base64", media_type: d.media, data: d.data } }); }
      const body = { model: p.model, max_tokens: Math.max(1024, maxTokens * 3 + 2000), messages: [{ role: "user", content }] };   // room for thinking
      if (system) body.system = system;
      const oc = {};
      if (schema && !asText) oc.format = { type: "json_schema", schema: anthropicSchema(schema) };
      if (p.effort && p.effort !== "default" && effortOk) oc.effort = p.effort;
      if (Object.keys(oc).length) body.output_config = oc;
      res = await fetchImpl("https://api.anthropic.com/v1/messages", { method: "POST", signal,
        headers: { "content-type": "application/json", "x-api-key": p.key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
      if (res.ok) break;
      text = await res.text().catch(() => "");
      if (res.status === 400 && /effort/i.test(text) && effortOk) { effortOk = false; continue; }
      if (res.status === 400 && schema && !asText && /schema|output_config|format/i.test(text)) { plain.add(schemaName); continue; }
      throw httpError("Claude", res, text);
    }
    if (!res.ok) throw httpError("Claude", res, text);
    const j = await res.json();
    const out = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    if (j.stop_reason === "refusal") { const e = new Error("Claude declined"); e.status = 0; e.soft = true; throw e; }
    return { text: out, usage: j.usage ? { prompt_tokens: j.usage.input_tokens, completion_tokens: j.usage.output_tokens } : null, finish: j.stop_reason || null };
  };
}
function openaiAdapter(p, fetchImpl) {
  // the newest GPT and Gemini models are reasoning models: no custom temperature, max_completion_tokens, an effort
  // level. Whatever an endpoint refuses (a 400 naming it) is dropped for that provider from then on.
  const drop = new Set(p.temperature !== undefined ? [] : ["temperature"]);   // (a model whose temperature is set in keys.json keeps it)
  let fmt = "json_schema";
  return async ({ system, user, images = [], schema = null, schemaName = "answer", maxTokens = 800, temperature, signal, think }) => {
    const content = images.length ? [{ type: "text", text: user }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))] : user;
    const messages = [...(system ? [{ role: "system", content: system }] : []), { role: "user", content }];
    const build = () => {
      const b = { model: p.model, messages };
      if (!drop.has("max_completion_tokens")) b.max_completion_tokens = Math.max(1024, maxTokens * 3 + 2000); else b.max_tokens = maxTokens;
      const temp = p.temperature !== undefined ? p.temperature : temperature;
      if (!drop.has("temperature") && temp !== undefined) b.temperature = temp;
      if (p.effort && !drop.has("reasoning_effort")) b.reasoning_effort = p.effort;
      if (think === false && p.thinkOff && !drop.has("thinkOff")) Object.assign(b, p.thinkOff);
      if (schema && fmt === "json_schema") b.response_format = { type: "json_schema", json_schema: { name: schemaName, strict: false, schema } };
      else if (schema && fmt === "json_object") b.response_format = { type: "json_object" };
      if (schema && fmt !== "json_schema") b.messages = [...messages.slice(0, -1), { role: "user", content: images.length ? [{ type: "text", text: `${user}\n\nReply with JSON only, matching this schema: ${JSON.stringify(schema)}` }, ...content.slice(1)] : `${user}\n\nReply with JSON only, matching this schema: ${JSON.stringify(schema)}` }];
      return b;
    };
    for (let tries = 0; ; tries++) {
      const res = await fetchImpl(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` }, body: JSON.stringify(build()) });
      if (res.ok) {
        const j = await res.json(), c = (j.choices && j.choices[0]) || {};
        return { text: String((c.message && c.message.content) ?? ""), usage: j.usage || null, finish: c.finish_reason || null };
      }
      const text = await res.text().catch(() => "");
      if (res.status === 400 && tries < 6) {   // learn what this endpoint won't take, and ask again
        if (/reasoning/i.test(text) && !drop.has("reasoning_effort")) { drop.add("reasoning_effort"); continue; }
        if (/chat_template_kwargs|enable_thinking/i.test(text) && !drop.has("thinkOff")) { drop.add("thinkOff"); continue; }
        if (/max_completion_tokens/i.test(text) && !drop.has("max_completion_tokens")) { drop.add("max_completion_tokens"); continue; }
        if (/temperature/i.test(text) && !drop.has("temperature")) { drop.add("temperature"); continue; }
        if (schema && /response_format|json_schema|schema/i.test(text) && fmt !== "none") { fmt = fmt === "json_schema" ? "json_object" : "none"; continue; }
        // a 400 that doesn't say what it won't take (Gemini 3.6 Flash, Nov 7: "Request contains an invalid argument."):
        // drop the optional extras one at a time, the most likely first (not an API key that isn't valid: that's said)
        if (!/api key|api_key|permission|unauthori[sz]ed/i.test(text)) {
          if (p.effort && !drop.has("reasoning_effort")) { drop.add("reasoning_effort"); continue; }
          if (schema && fmt === "json_schema") { fmt = "json_object"; continue; }
          if (!drop.has("max_completion_tokens")) { drop.add("max_completion_tokens"); continue; }
        }
      }
      throw httpError(p.name === "gemini" ? "Gemini" : p.name === "openai" ? "GPT" : p.name, res, text);
    }
  };
}

/* ------------------------------------------------------------------ the router */
const today = () => new Date().toLocaleDateString("en-CA");
// gate(p): may this provider be used right now? (index.js: models on this computer always; the cloud ones only while
// the cloud boost is on). A provider that's gated off is skipped and shown as "off: cloud boost off".
export function makeRouter({ local, keysFile = null, env = process.env, fetchImpl = fetch, log = console, now = () => Date.now(), timeouts = TIMEOUTS, gate = () => true } = {}) {
  let cfg = { providers: [], cloudFor: new Set(CLOUD_TASKS), off: false }, cfgStamp = null, checkedAt = 0, turn = 0;
  const state = new Map();   // name → { ok, fail, ms, until, offReason, strikes, day, used, lastError, call }
  function load(force = false) {
    if (!force && now() - checkedAt < 5000) return;
    checkedAt = now();
    let stamp = "env";
    if (keysFile) { try { stamp = String(fs.statSync(keysFile).mtimeMs); } catch (_) { stamp = "none"; } }
    if (!force && stamp === cfgStamp) return;
    cfgStamp = stamp; cfg = readKeys({ file: keysFile, env });
    for (const p of cfg.providers) {
      const s = state.get(p.name);
      const key = `${p.kind}|${p.model}|${p.key.slice(-6)}`;
      if (!s || s.key !== key) state.set(p.name, { key, ok: 0, fail: 0, ms: 0, until: 0, offReason: null, strikes: 0, day: today(), used: 0, lastError: null, call: (p.kind === "anthropic" ? anthropicAdapter : openaiAdapter)(p, fetchImpl) });
    }
    if (cfg.error) log.warn(`[models] ${cfg.error}`);
    log.log(`[models] cloud: ${cfg.providers.length ? cfg.providers.map((p) => `${p.name} (${p.model})`).join(", ") : "none"}${cfg.off ? " (switched off)" : ""}; local: ${local.model}`);
  }
  function usable(p, t) {
    const s = state.get(p.name);
    if (!s) return false;
    if (s.day !== today()) { s.day = today(); s.used = 0; if (s.offReason === "daily cap" || s.offReason === "spend limit") s.offReason = null; }
    if (s.offReason) return false;
    if (s.used >= p.dailyCalls) { s.offReason = "daily cap"; return false; }
    return t >= s.until;
  }
  function rest(p, e) {   // why it failed decides how long it rests
    const s = state.get(p.name), st = e.status || 0, body = String(e.body || e.message || "");
    s.fail++; s.lastError = String(e.message).slice(0, 160);
    if (st === 401 || st === 403) { s.offReason = st === 401 ? "bad key" : "no access"; return; }
    if (st === 402 || /insufficient_quota|billing|credit balance|payment/i.test(body)) { s.offReason = "out of credit"; return; }
    if (st === 400 && /spend limit|usage limit|quota/i.test(body)) { s.offReason = "spend limit"; return; }
    if (st === 404 && /model/i.test(body)) { s.offReason = "unknown model"; return; }
    s.strikes++;
    const ladder = st === 429 ? [120000, 600000, 3600000] : [30000, 120000, 600000];
    const wait = st === 429 && e.retryAfter ? Math.min(3600, e.retryAfter) * 1000 : ladder[Math.min(ladder.length - 1, s.strikes - 1)];
    s.until = now() + wait;
  }
  // who may do this job now: switched on, through the gate, and able to see the pictures if there are any
  const fits = (p, what, args) => (p.local || !cfg.off) && gate(p) && cfg.cloudFor.has(what) && !(args.images && args.images.length && p.vision === false);
  async function chat(args = {}) {
    load();
    const what = args.what || "call";
    // a bench can name one model ("only": "nemotron-api"): just that one for every cloud job it can do, switch or not
    // (it's a test someone started on this computer); Gemma when it can't
    // background work (practice.js: "background": true in keys.json): that model for whatever it can do, Gemma for the
    // rest; the owner chose it for this, so it doesn't wait for the cloud boost switch
    const only = args.only ? String(args.only) : args.background && cfg.providers.some((p) => p.background) ? cfg.providers.find((p) => p.background).name : null;
    const leads = cfg.providers.filter((p) => only ? p.name === only && (cfg.cloudFor.has(what) || args.anyTask) && !(args.images && args.images.length && p.vision === false) : fits(p, what, args) && (!p.tasks || p.tasks.includes(what)));
    const backs = only ? [] : cfg.providers.filter((p) => !leads.includes(p) && fits(p, what, args) && p.backup && p.backup.includes(what));
    if (!leads.length) return { ...(await local.chat(args)), provider: "local", model: local.model };
    // in turn: each job starts with the next provider (weights repeat a provider in the turn order)
    const LOCAL = { name: "local" };
    const ring = [...leads.flatMap((p) => Array(Math.max(1, Math.round(p.weight))).fill(p)), ...Array(cfg.localWeight || 0).fill(LOCAL)];
    const start = turn++ % ring.length, t = now(), tried = [];
    const order = [...ring.slice(start), ...ring.slice(0, start)].filter((p, i, a) => a.indexOf(p) === i);
    if (args.signal && args.signal.aborted) throw args.signal.reason || new Error("cancelled");
    for (const p of [...order, ...(backs.length ? [null] : []), ...backs]) {
      if (p === LOCAL) break;   // Gemma's turn
      if (p === null) continue;   // (the leads couldn't: now the backups, then Gemma)
      if (!usable(p, t)) continue;
      const s = state.get(p.name), ctl = new AbortController(), timeout = args.timeoutMs || p.timeoutMs || timeouts[what] || 45000;   // (a model that thinks first can be given longer: "timeoutMs" in keys.json)
      const timer = setTimeout(() => ctl.abort(Object.assign(new Error(`${p.name} timed out after ${timeout} ms`), { status: 0 })), timeout);
      const onAbort = () => ctl.abort(args.signal.reason);
      if (args.signal) args.signal.addEventListener("abort", onAbort, { once: true });
      const t0 = now();
      s.used++;
      try {
        const { only: _o, background: _b, anyTask: _a, timeoutMs: _t, ...ask } = args;
        const r = await s.call({ ...ask, signal: ctl.signal });
        const json = args.schema ? extractJson(r.text) : null;
        if (args.schema && !json) throw Object.assign(new Error(`${p.name} gave no JSON`), { status: 0, soft: true });
        s.ok++; s.ms += now() - t0; s.strikes = 0;
        local.calls && local.calls.push({ what, ms: now() - t0, ok: true, provider: p.name, tokensIn: (r.usage && r.usage.prompt_tokens) || 0, tokensOut: (r.usage && r.usage.completion_tokens) || 0 });
        return { text: r.text, json, ms: now() - t0, usage: r.usage, finish: r.finish, provider: p.name, model: p.model, tried, ...(backs.includes(p) ? { backup: true } : {}), ...(p.local ? { onThisComputer: true } : {}) };
      } catch (e) {
        const err = ctl.signal.aborted && !e.status ? ctl.signal.reason || e : e;
        if (args.signal && args.signal.aborted) throw err;   // the job itself was cancelled
        if (!err.soft) rest(p, err); else { s.fail++; s.lastError = String(err.message).slice(0, 160); }
        tried.push(`${p.name}: ${String(err.message).slice(0, 80)}`);
        log.warn(`[models] ${what} on ${p.name} failed (${String(err.message).slice(0, 120)}); ${state.get(p.name).offReason ? `off: ${state.get(p.name).offReason}` : state.get(p.name).until > now() ? `resting ${Math.round((state.get(p.name).until - now()) / 1000)} s` : "trying the next"}`);
      } finally { clearTimeout(timer); if (args.signal) args.signal.removeEventListener("abort", onAbort); }
    }
    const r = await local.chat(args);   // the floor: Gemma on the M5
    return { ...r, provider: "local", model: local.model, tried };
  }
  function status() {
    load();
    return { cloudFor: [...cfg.cloudFor], off: cfg.off, local: local.model, localWeight: cfg.localWeight || 0, providers: cfg.providers.map((p) => {
      const s = state.get(p.name) || {}, t = now();
      return { name: p.name, model: p.model, ok: s.ok || 0, failed: s.fail || 0, usedToday: s.used || 0, dailyCalls: p.dailyCalls, avgMs: s.ok ? Math.round(s.ms / s.ok) : null,
        local: !!p.local, tasks: p.tasks || [...cfg.cloudFor], backup: p.backup || [],
        state: !p.local && cfg.off ? "off: cloud off" : !gate(p) ? "off: cloud boost off" : s.offReason ? `off: ${s.offReason}` : s.until > t ? `resting ${Math.round((s.until - t) / 1000)} s` : "ready", lastError: s.lastError || null };
    }) };
  }
  load(true);
  return {
    chat, status, reload: () => load(true),
    models: () => local.models(), calls: local.calls,
    get vision() { return local.vision; }, set vision(v) { local.vision = v; },
    get structured() { return local.structured; },
    get model() { return local.model; },
  };
}
