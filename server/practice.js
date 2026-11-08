// Practising while you're away (Nov 7, Binoy: "maybe nemotron can run parallelly with Gemma where it tracks some
// background information for later use while Gemma is doing most of the real time work"). Gemma does everything you
// wait for. When the room has been quiet for a while (nobody typing, no message, the workbench idle), Mochi takes a
// prop he made that didn't come out right (the blind check wasn't sure: "a windmill" that looked like a spinning top)
// and makes it again, taking his time: with the background model if keys.json names one ("background": true on a
// model on this computer, e.g. Nemotron in LM Studio; a cloud one only with the cloud boost on), else with Gemma.
// The blind check still decides: recognised this time, the new one replaces the old on his shelf and he tells you
// next time ("I practised my windmill while you were away!"); not, the old one stays and he tries again another day
// (twice at most). A message from you stops it at once: the next model call is refused, so he's all yours.
//
// Pure-ish: index.js gives it the memory, a crafter, when the room is quiet and what to do with a better prop.

export const PRACTICE = { quietMs: 3 * 60 * 1000, everyMs: 60 * 1000, againMs: 6 * 60 * 60 * 1000, maxTries: 2 };

/** the props worth another go: made by him (not from his pocket), not recognised, not tried too often or too lately */
export function practiceCandidates(rows, { now = Date.now(), againMs = PRACTICE.againMs, maxTries = PRACTICE.maxTries } = {}) {
  return rows.filter((p) => {
    const m = p.meta || {};
    if (p.source === "pocket" || !m.unsure || m.matched) return false;
    if ((m.practiceTries || 0) >= maxTries) return false;
    return !m.practisedAt || now - Date.parse(m.practisedAt) > againMs;
  }).sort((a, b) => (a.meta.practiceTries || 0) - (b.meta.practiceTries || 0) || b.id - a.id);   // (newest first, untried first)
}

/** an llm that refuses once they're back: a message since `since` ends the practice at its next call */
export function interruptible(llm, interrupted, extra = {}) {
  return Object.assign(Object.create(llm), {
    chat: (a) => { if (interrupted()) return Promise.reject(Object.assign(new Error("they're back: practice stopped"), { interrupted: true })); return llm.chat({ ...a, ...extra }); },
  });
}

/** what the brain is told the next time they talk (once) */
export function practiceNote(news) {
  if (!news || !news.length) return "";
  const n = news.slice(-2).map((x) => `your ${x.name}${x.was ? ` (it used to look like ${x.was})` : ""}`).join(" and ");
  return `\nWhile they were away you practised making ${n} again, and now it really looks right; it's on your shelf. If it fits, tell them in a few words, proudly (\"I practised my ${news.at(-1).name} while you were gone!\"). Just once.`;
}

export function makePractice({ memory, makeCrafter, llm, isQuiet, lastMessageAt, onBetter = () => {}, log = console, now = () => Date.now(), enabled = () => true }) {
  let running = null, timer = null;
  async function tick() {
    if (running || !enabled() || !isQuiet()) return null;
    const rows = memory.propsWithMeta ? memory.propsWithMeta() : [];
    const pick = practiceCandidates(rows, { now: now() })[0];
    if (!pick) return null;
    const started = now(), since = lastMessageAt();
    const pllm = interruptible(llm, () => lastMessageAt() > since, { background: true });
    const crafter = makeCrafter(pllm);
    const tries = (pick.meta.practiceTries || 0) + 1, at = new Date(started).toISOString();
    log.log(`[practice] ${pick.name}: another go (it looked like ${pick.meta.guess || "something else"}; try ${tries})`);
    running = { id: pick.id, name: pick.name, started };
    try {
      const req = (pick.recipe && pick.recipe.request) || pick.name;
      const r = await crafter.craftProp({ request: req, archetype: pick.archetype, name: pick.name });
      const models = (r.timings && r.timings.models) || [];
      if (lastMessageAt() > since) { memory.setPropMeta(pick.id, { practisedAt: at }); log.log(`[practice] ${pick.name}: stopped, they're back`); return { stopped: true }; }
      if (r.ok && r.matched) {
        memory.setPropRecipe(pick.id, { ...r.recipe, request: req });
        memory.setPropMeta(pick.id, { unsure: false, matched: true, guess: r.guess, was: pick.meta.guess || null, practisedAt: at, practiceTries: tries, models, ...(r.timings.checkers ? { checkers: r.timings.checkers } : {}), practised: true });
        log.log(`[practice] ${pick.name}: better now (${models[0] || "local"}, ${Math.round((now() - started) / 1000)} s)`);
        onBetter({ id: pick.id, name: pick.name, was: pick.meta.guess || null, models });
        return { better: true, id: pick.id };
      }
      memory.setPropMeta(pick.id, { practisedAt: at, practiceTries: tries });
      log.log(`[practice] ${pick.name}: still not right (looked like ${r.guess || "?"}); the old one stays`);
      return { better: false };
    } catch (e) {
      memory.setPropMeta(pick.id, { practisedAt: at });
      log.warn(`[practice] ${pick.name}: ${e.message}`);
      return { error: e.message };
    } finally { running = null; }
  }
  return {
    tick, start() { if (!timer) { timer = setInterval(() => { tick().catch(() => {}); }, PRACTICE.everyMs); timer.unref && timer.unref(); } },
    stop() { clearInterval(timer); timer = null; }, get running() { return running; },
  };
}
