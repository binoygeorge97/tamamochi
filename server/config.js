// Everything that differs between the dev laptop and the M5 lives here. Override with env vars.
import { fileURLToPath } from "node:url";
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== "" ? process.env[k] : d);

export const CONFIG = {
  port: +env("MOCHI_PORT", 8787),
  host: env("MOCHI_HOST", "0.0.0.0"),
  // LM Studio's OpenAI-compatible server. Localhost only; the app server is the only thing on the LAN.
  llm: {
    baseUrl: env("LLM_URL", "http://127.0.0.1:1234/v1"),
    model: env("LLM_MODEL", "google/gemma-4-26b-a4b"),
    temperature: +env("LLM_TEMP", 0.8),
    maxTokens: +env("LLM_MAX_TOKENS", 400),
    timeoutMs: +env("LLM_TIMEOUT_MS", 60000),
    // Set to "tags" if the loaded model can't do OpenAI tool calling: the brain then asks for <tool>…</tool> blocks.
    toolMode: env("LLM_TOOL_MODE", "auto"),
    // Sent with every chat request. On the M5 (LM Studio 0.4.26, Gemma 4 26B A4B) "none" turns hidden thinking off for
    // Mochi's requests only (0 reasoning tokens, ~0.8 s instead of 4–6 s; probed Nov 1). Other apps on the same model
    // (Thali) keep their own setting. Set LLM_REASONING_EFFORT=off to not send the field at all.
    reasoningEffort: env("LLM_REASONING_EFFORT", "none"),
    // Seconds LM Studio keeps the model after a request if it was loaded just-in-time (its default is 60 min idle, and
    // the M5 saw "Model is unloaded" on Nov 3). Sent as `ttl` with every request; LLM_TTL=0 doesn't send it.
    ttl: +env("LLM_TTL", 6 * 3600),
  },
  db: env("MOCHI_DB", fileURLToPath(new URL("../data/mochi.sqlite", import.meta.url))),
  // cloud models for the crafter (Claude, GPT, Gemini): keys in this file on the M5 (see server/router.js); none → Gemma only
  keysFile: env("MOCHI_KEYS", fileURLToPath(new URL("../data/keys.json", import.meta.url))),
  // The feelings model (claude/feelings-model-handoff.md). Leave empty to run on word rules only.
  feelingsDir: env("FEELINGS_DIR", process.platform === "win32" ? "C:/mochi-feelings/export/feelings" : ""),
  feelingsThreads: +env("FEELINGS_THREADS", 2),
  // how long a page must be quiet before a background reveal (prop ready, follow-up) is shown
  quietMs: +env("MOCHI_QUIET_MS", 8000),
  storyEvery: env("MOCHI_STORY_EVERY", "1-3"),   // his own story (story.js): a beat of it after every 1–3 conversations
  // a gift he made on his own waits this long after it's ready (or until its day comes), so it feels like a surprise
  giftDelayMs: +env("MOCHI_GIFT_DELAY_MS", 120000),
  // the workbench writes this many takes at once on a new prop and Pip picks (LM Studio runs 4 requests side by side;
  // one slot stays free for the chat). 1 = one at a time, as before Nov 7
  craftParallel: +env("MOCHI_CRAFT_PARALLEL", 3),
  // when the takes happen: "miss" = one try first, and the takes only if Pip doesn't know it (easy props stay fast;
  // the M5 bench, Nov 7: takes from the start doubled the time of props Pip knew first go); "first" = from the start
  craftTakesOn: env("MOCHI_CRAFT_TAKES", "miss") === "first" ? "first" : "miss",
  // Pip sees things he holds held by a stand-in hoof (Nov 7). Off: on the M5 bench it didn't help Pip (10 of 12 known
  // with it, 11 without, same props, back to back); MOCHI_CRAFT_HAND=on to try it again
  craftHand: env("MOCHI_CRAFT_HAND", "off") === "on",
  // the cloud boost (Gemini and the other cloud models) before anyone flips the switch on the workshop page
  cloudBoost: env("MOCHI_CLOUD_BOOST", "off") === "on",
  // practising a prop that didn't come out right while nobody's talking (practice.js)
  practice: env("MOCHI_PRACTICE", "on") === "on",
  // the short recipe (each part a list: about a third fewer words for Gemma). Off until the M5 bench says it's as good
  craftCompact: env("MOCHI_CRAFT_COMPACT", "off") === "on",
  careModeMs: 30 * 60 * 1000,   // after a crisis line: no sulking for 30 minutes
};
