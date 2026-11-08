// 8090 Software Factory (Nov 3; see claude/sponsor-8090.md): the one confirmed endpoint, feedback items. Mochi files
// one when the workbench isn't sure a prop came out right, when someone asks for a prop to be fixed, and for the
// "learn from today" review. The key lives in data/keys.json ("eightyninety": { "key", "email", "baseUrl" }) or the
// environment (EIGHTYNINETY_API_KEY, EIGHTYNINETY_EMAIL); it is never logged, served or sent to the page.
import { readKeysFile } from "./router.js";

const BASE = "https://api.factory.8090.dev/v2/external-api";

export function factoryConfig(keysFile, env = process.env) {
  const j = readKeysFile(keysFile), c = (j && (j.eightyninety || j["8090"])) || {};
  const key = String(c.key || env.EIGHTYNINETY_API_KEY || "").trim(), email = String(c.email || env.EIGHTYNINETY_EMAIL || "").trim();
  return { key, email, enabled: !!key && !!email && c.enabled !== false, baseUrl: String(c.baseUrl || env.EIGHTYNINETY_URL || BASE).replace(/\/$/, ""), dailyItems: +c.dailyItems || 40 };
}

export function makeFactory({ keysFile = null, env = process.env, fetchImpl = fetch, log = console, now = () => Date.now() } = {}) {
  const st = { sent: 0, failed: 0, today: 0, day: null, lastError: null, lastAt: 0, items: [] };
  const cfg = () => factoryConfig(keysFile, env);
  const roll = () => { const d = new Date(now()).toISOString().slice(0, 10); if (st.day !== d) { st.day = d; st.today = 0; } };
  /** file a feedback item: { title, markdown, kind } → { ok, id } | { ok: false, why } (never throws) */
  async function feedback({ title, markdown, kind = "note" }) {
    const c = cfg(); roll();
    if (!c.enabled) return { ok: false, why: "off" };
    if (st.today >= c.dailyItems) return { ok: false, why: "daily cap" };
    const body = { end_user_email: c.email, title: String(title || "Mochi").slice(0, 200), content_markdown: String(markdown || "").slice(0, 20000) };
    try {
      const r = await fetchImpl(`${c.baseUrl}/feedback/items`, { method: "POST", headers: { "content-type": "application/json", "X-API-Key": c.key }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      st.today++; st.lastAt = now();
      if (!r.ok) { st.failed++; st.lastError = `${r.status}`; log.warn(`[8090] feedback item refused: HTTP ${r.status}`); return { ok: false, why: `HTTP ${r.status}` }; }
      let id = null; try { id = (await r.json()).id || null; } catch (_) { /* no body */ }
      st.sent++; st.lastError = null; st.items.unshift({ at: new Date(now()).toISOString(), kind, title: body.title, id }); st.items.length = Math.min(st.items.length, 30);
      log.log(`[8090] filed: ${body.title}`);
      return { ok: true, id };
    } catch (e) { st.failed++; st.lastError = String(e.message).slice(0, 120); log.warn(`[8090] feedback failed: ${st.lastError}`); return { ok: false, why: st.lastError }; }
  }
  function status() { const c = cfg(); roll(); return { on: c.enabled, sent: st.sent, failed: st.failed, today: st.today, dailyItems: c.dailyItems, lastError: st.lastError, recent: st.items.slice(0, 8) }; }
  return { feedback, status, enabled: () => cfg().enabled };
}

/** the markdown for a prop the blind check wasn't sure about (what was asked, what it saw, which model, how long) */
export function unsureNote(job, r, prop) {
  const m = (r && r.timings && r.timings.models) || [];
  return [`**Request:** ${job.request}`, `**Made:** ${prop ? prop.name : "(nothing)"} (${r && r.recipe ? `${r.recipe.archetype}, ${r.recipe.parts.length} parts` : "no recipe"})`,
    `**Blind check saw:** ${r && r.guess ? r.guess : "nothing it could name"}`, `**Models:** ${[...new Set(m)].join(", ") || "local"}; **attempts:** ${r && r.attempts != null ? r.attempts : "?"}; **time:** ${r && r.timings ? `${(r.timings.total / 1000).toFixed(1)} s` : "?"}`,
    "", "Filed by Mochi's workbench: the vision check could not confirm the prop matches the request. A pattern for this object would make it in ~2 s next time."].join("\n");
}
