// A small LM Studio client for the crafter: JSON answers (structured output with a JSON schema when the server
// supports it, plain prompting otherwise), image input for the vision check, and timings for every call.
// The chat brain keeps its own client (brain.js); both send the same per-request reasoning_effort.
import { CONFIG } from "./config.js";

export function extractJson(text) {   // the first complete {...} in a reply (fenced or not)
  const s = String(text || "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/<\|channel>thought[\s\S]*?(<channel\|>|$)/g, "");
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch (_) { return null; } }
  }
  return null;
}

export function makeLLM({ baseUrl = CONFIG.llm.baseUrl, model = CONFIG.llm.model, reasoningEffort = CONFIG.llm.reasoningEffort, timeoutMs = 120000, fetchImpl = fetch, log = console } = {}) {
  let seedOk = true;
  let sendEffort = reasoningEffort && reasoningEffort !== "off";
  let schemaOk = true;     // set false once the server refuses response_format
  let vision = null;       // null: unknown; true/false once an image call has been tried
  const calls = [];        // {what, ms, tokensIn, tokensOut, finish, ok}

  async function post(body, signal) {
    const res = await fetchImpl(`${baseUrl}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
    const text = res.ok ? null : await res.text().catch(() => "");
    return { res, text };
  }
  /** One chat call. Returns { text, json, ms, usage, finish }. Throws on HTTP or network errors (err.status, err.body). */
  async function chat({ what = "call", system, user, images = [], schema = null, schemaName = "answer", maxTokens = 800, temperature = 0.4, seed = null, signal, strictSchema = false } = {}) {
    const content = images.length ? [{ type: "text", text: user }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))] : user;
    const messages = [...(system ? [{ role: "system", content: system }] : []), { role: "user", content }];
    const body = { model, messages, temperature, max_tokens: maxTokens, stream: false };
    if (Number.isInteger(seed) && seedOk) body.seed = seed;   // (stories: a new one each time, variety.js)
    if (CONFIG.llm.ttl > 0 && baseUrl === CONFIG.llm.baseUrl) body.ttl = CONFIG.llm.ttl;   // LM Studio only (see config.js)
    if (sendEffort) body.reasoning_effort = reasoningEffort;
    if (schema && schemaOk) body.response_format = { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } };
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(new Error(`${what} timed out after ${timeoutMs} ms`)), timeoutMs);
    if (signal) signal.addEventListener("abort", () => ctl.abort(signal.reason), { once: true });
    const t0 = Date.now();
    try {
      let { res, text } = await post(body, ctl.signal);
      for (let tries = 0; !res.ok && res.status === 400 && tries < 2; tries++) {   // drop whatever the server doesn't take, once, for good
        if (body.reasoning_effort && /reasoning/i.test(text)) { sendEffort = false; delete body.reasoning_effort; log.warn("[llm] server rejected reasoning_effort; not sending it any more"); }
        else if (body.response_format && /response_format|json_schema|schema|grammar/i.test(text) && !strictSchema) { schemaOk = false; delete body.response_format; log.warn("[llm] no structured output; asking for plain JSON"); }
        else if (body.seed != null && /seed/i.test(text)) { seedOk = false; delete body.seed; log.warn("[llm] server rejected seed; not sending it any more"); }
        else break;
        ({ res, text } = await post(body, ctl.signal));
      }
      if (!res.ok) {
        if (images.length && res.status >= 400 && res.status < 500 && /image|vision|multimodal|mmproj|content/i.test(text)) vision = false;
        const e = new Error(`LM Studio ${res.status}: ${String(text).slice(0, 240)}`); e.status = res.status; e.body = text; throw e;
      }
      const j = await res.json();
      const c = (j.choices && j.choices[0]) || {}, m = c.message || {};
      const out = String(m.content ?? "");
      if (images.length) vision = true;
      const rec = { what, ms: Date.now() - t0, tokensIn: (j.usage && j.usage.prompt_tokens) || 0, tokensOut: (j.usage && j.usage.completion_tokens) || 0, finish: c.finish_reason || null, ok: true };
      calls.push(rec);
      return { text: out, json: schema ? extractJson(out) : null, ms: rec.ms, usage: j.usage || null, finish: rec.finish };
    } catch (e) {
      calls.push({ what, ms: Date.now() - t0, ok: false, error: e.message });
      throw e;
    } finally { clearTimeout(timer); }
  }
  async function models() {
    const res = await fetchImpl(`${baseUrl}/models`);
    if (!res.ok) throw new Error(`LM Studio ${res.status}`);
    return ((await res.json()).data || []).map((m) => m.id);
  }
  return { chat, models, calls, get vision() { return vision; }, set vision(v) { vision = v; }, get structured() { return schemaOk; }, model };
}
