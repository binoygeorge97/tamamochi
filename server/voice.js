// Mochi's voice (Binoy, Nov 2: a cute voice, talking back, and "shoot this thing over here" + a tap).
//
// Speech out: ElevenLabs text-to-speech through the server (the key stays on the M5), streamed back as MP3; the page
// plays it and moves his mouth to it. No key, a voice the plan won't speak with, quota gone, offline: Kokoro on the
// M5's own CPU (localtts.js, Nov 6: three voices, and the acting: speed, loudness and pitch piece by piece); and if
// that isn't installed either, the page falls back to the browser's own voices, pitched up.
// keys.json "voice": {"engine": "auto" (the default: ElevenLabs when it can, else Kokoro) | "local" (Kokoro only) |
// "elevenlabs" (never Kokoro) | "browser"}.
// Speech in: ElevenLabs speech-to-text (Scribe) through the server; else a local Whisper-compatible endpoint if one is
// set up (faster-whisper-server, whisper.cpp server, LM Studio with a whisper model, anything OpenAI-shaped); else the
// page uses the browser's built-in recognition. The words then go through the normal chat path, so everything he does
// for typed words he does for spoken ones.
// Pointing: words that point ("shoot this", "throw it over there", "look at that", "go there") arm the page: you tap
// the spot and he does it there. pointIntent() finds them.
import { readKeysFile } from "./router.js";
import { makeLocalTTS } from "./localtts.js";
import { stripTags } from "../shared/speech.js";

export const ELEVEN = { tts: "https://api.elevenlabs.io/v1/text-to-speech", stt: "https://api.elevenlabs.io/v1/speech-to-text",
  // a bright, young voice; override with voice.voiceId in keys.json (any voice id from the account's library)
  voiceId: "jBpfuIE2acCO8z3wKNLl", model: "eleven_flash_v2_5", sttModel: "scribe_v2" };
const RESTS = { 429: 120000, 402: 24 * 3600000, 401: 24 * 3600000, 403: 24 * 3600000 };

/** the voice settings from keys.json ("voice": {...}) with defaults */
export function voiceConfig(keysFile, env = process.env) {
  const j = readKeysFile(keysFile), v = (j && j.voice) || {}, el = (j && j.elevenlabs) || {};
  const key = String(v.key || el.key || env.ELEVENLABS_API_KEY || "").trim();
  return {
    key, enabled: v.enabled !== false && !(j && j.off === true), engine: ["local", "elevenlabs", "browser"].includes(String(v.engine || "").toLowerCase()) ? String(v.engine).toLowerCase() : "auto",
    voiceId: String(v.voiceId || ELEVEN.voiceId), model: String(v.model || ELEVEN.model), sttModel: String(v.sttModel || ELEVEN.sttModel),
    settings: { stability: num(v.stability, 0.45), similarity_boost: num(v.similarity, 0.8), style: num(v.style, 0.35), use_speaker_boost: true, speed: num(v.speed, 1.05) },
    dailyChars: num(v.dailyChars, 60000), dailyStt: num(v.dailySttSeconds, 3600),
    friends: { mimi: v.friends && v.friends.mimi ? String(v.friends.mimi) : null, cocoa: v.friends && v.friends.cocoa ? String(v.friends.cocoa) : null },
    // a local Whisper-compatible server for the venue (no internet): { "url": "http://127.0.0.1:8000/v1", "model": "Systran/faster-whisper-small" }
    localStt: v.localStt && v.localStt.url ? { url: String(v.localStt.url).replace(/\/$/, ""), model: String(v.localStt.model || "whisper-1"), key: String(v.localStt.key || "") } : env.LOCAL_STT_URL ? { url: String(env.LOCAL_STT_URL).replace(/\/$/, ""), model: env.LOCAL_STT_MODEL || "whisper-1", key: "" } : null,
  };
}
const num = (v, d) => (v === undefined || v === null || v === "" || isNaN(+v) ? d : +v);

/** Speech for the page: ElevenLabs when it can, "fallback" when the page should use its own voices. */
export function makeVoice({ keysFile = null, env = process.env, fetchImpl = fetch, log = console, now = () => Date.now(), local = undefined, settingsFile = null, cacheDir = null } = {}) {
  // Kokoro, made on this computer (local: false for none, or one made already)
  const L = local === false ? null : local || makeLocalTTS({ keysFile, settingsFile, cacheDir, log, now });
  const st = { ttsUntil: 0, sttUntil: 0, day: "", chars: 0, seconds: 0, ttsOk: 0, ttsFail: 0, sttOk: 0, sttFail: 0, lastError: null };
  const today = () => new Date(now()).toLocaleDateString("en-CA");
  const roll = () => { if (st.day !== today()) { st.day = today(); st.chars = 0; st.seconds = 0; } };
  const cfg = () => voiceConfig(keysFile, env);
  // a voice ElevenLabs won't speak with on this account (Nov 5: library voices need a paid plan: "Free users cannot
  // use library voices via the API"): only that one character falls back to a browser voice; the others carry on
  const badVoices = new Map();   // voice id → why
  // keys.json changed (a new key, other voices): whatever was resting starts afresh, so a fix works at once
  let lastSig = null;
  function fresh(c) {
    const sig = `${c.key.length}|${c.key.slice(-4)}|${c.voiceId}|${c.friends.mimi}|${c.friends.cocoa}`;
    if (lastSig !== null && sig !== lastSig) { st.ttsUntil = 0; st.sttUntil = 0; badVoices.clear(); log.log && log.log("[voice] keys.json changed: trying ElevenLabs again"); }
    lastSig = sig;
  }
  function rest(kind, e) {
    const s = e.status || 0; st.lastError = `${kind}: ${String(e.message).slice(0, 120)}`;
    const ms = RESTS[s] || (s >= 500 ? 60000 : 30000);
    if (kind === "tts") st.ttsUntil = now() + ms; else st.sttUntil = now() + ms;
    log.warn(`[voice] ${kind} ${e.message}; resting ${Math.round(ms / 1000)} s`);
  }
  /** clean his reply for speaking: no brackets, no stage directions, no URLs; short */
  function sayable(text) {
    return stripTags(text).replace(/\[[^\]]*\]/g, " ").replace(/\*[^*\n]*\*/g, " ").replace(/https?:\/\/\S+/g, " ")
      .replace(/[_`#>]/g, "").replace(/\s{2,}/g, " ").trim().slice(0, 1200);
  }
  // short lines come round again and again ("Hehe!", "Everything's spinning…", "Coming~!"): kept, so they're paid for
  // once (Nov 5: every bubble is spoken now)
  const kept = new Map();
  /**
   * The line spoken: MP3 bytes from ElevenLabs or a WAV from Kokoro (either way .mime says which), or null to tell the
   * page to use its own voice. raw: the line as written, with its stage directions and {tags}, for Kokoro's acting.
   */
  async function tts(text, { signal, who = "mochi", raw = null } = {}) {
    const pref = cfg().engine;
    if (pref === "browser") return null;
    if (pref !== "local") { const b = await eleven(text, { signal, who }); if (b) return b; }
    if (pref === "elevenlabs" || !L || (signal && signal.aborted)) return null;
    // (wait: if Kokoro is still loading, a second or two after a restart, wait for it rather than send the page to the
    // browser's voice: Nov 7, Binoy heard "the phone voice" now and then, after each of the day's many updates)
    return L.say(String(raw || text).slice(0, 1200), { who, signal, wait: true });
  }
  async function eleven(text, { signal, who = "mochi" } = {}) {
    const c = cfg(), t = sayable(text);
    roll(); fresh(c);
    const ck = `${who}|${c.voiceId}|${(c.friends || {})[who] || ""}|${t}`;
    if (t.length <= 80 && kept.has(ck)) { const b = kept.get(ck); kept.delete(ck); kept.set(ck, b); return b; }
    // Mimi and Cocoa speak with ElevenLabs only if they have their own voice ("voice": {"friends": {"mimi": "<voice id>"}});
    // otherwise the page gives them a browser voice of their own, so nobody sounds like Mochi
    const voiceId = who === "mochi" ? c.voiceId : c.friends[who];
    if (!voiceId || badVoices.has(voiceId)) return null;
    if (!t || !c.key || !c.enabled || now() < st.ttsUntil || st.chars + t.length > c.dailyChars) return null;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(new Error("tts timed out")), 20000);
    if (signal) signal.addEventListener("abort", () => ctl.abort(signal.reason), { once: true });
    try {
      const res = await fetchImpl(`${ELEVEN.tts}/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`, { method: "POST", signal: ctl.signal,
        headers: { "xi-api-key": c.key, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text: t, model_id: c.model, voice_settings: c.settings }) });
      if (!res.ok) { const body = await res.text().catch(() => ""); const e = new Error(`ElevenLabs ${res.status}: ${body.slice(0, 160)}`); e.status = res.status; throw e; }
      const buf = Buffer.from(await res.arrayBuffer());
      buf.mime = "audio/mpeg";
      st.chars += t.length; st.ttsOk++;
      if (t.length <= 80) { kept.set(ck, buf); if (kept.size > 200) kept.delete(kept.keys().next().value); }
      return buf;
    } catch (e) {
      st.ttsFail++;
      if (signal && signal.aborted) return null;
      // this voice, not the account: it alone stops (paid-plan voices, a voice that's gone or not shared)
      if ((e.status === 402 || e.status === 404 || e.status === 400 || e.status === 403) && /paid_plan_required|library voices|voice_not_found|voice.*(?:not found|does not exist|not available)|voice_id/i.test(e.message)) {
        const why = /paid_plan_required|library voices/i.test(e.message) ? "a Voice Library voice: the API needs a paid ElevenLabs plan for those" : "ElevenLabs doesn't know this voice id on this account";
        badVoices.set(voiceId, why); st.lastError = `tts ${who}: ${why}`;
        log.warn(`[voice] ${who}'s voice (${voiceId}) can't be used: ${why}. ${who === "mochi" ? "He" : "They"}'ll use Kokoro (or the browser's voice) until keys.json changes.`);
        return null;
      }
      rest("tts", e); return null;
    }
    finally { clearTimeout(timer); }
  }
  /** { text } from audio bytes, or null (the page then uses the browser's recognition). ElevenLabs first, then a local Whisper. */
  async function stt(bytes, { mime = "audio/webm", seconds = 5, signal } = {}) {
    const c = cfg();
    roll(); fresh(c);
    const tries = [];
    if (c.key && c.enabled && now() >= st.sttUntil && st.seconds + seconds <= c.dailyStt) tries.push("eleven");
    if (c.localStt) tries.push("local");
    for (const which of tries) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(new Error("stt timed out")), 25000);
      if (signal) signal.addEventListener("abort", () => ctl.abort(signal.reason), { once: true });
      try {
        const form = new FormData(), ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : mime.includes("wav") ? "wav" : "webm";
        form.append("file", new Blob([bytes], { type: mime }), `clip.${ext}`);
        let res;
        if (which === "eleven") {
          form.append("model_id", c.sttModel); form.append("tag_audio_events", "false"); form.append("language_code", "en");
          res = await fetchImpl(ELEVEN.stt, { method: "POST", signal: ctl.signal, headers: { "xi-api-key": c.key }, body: form });
        } else {
          form.append("model", c.localStt.model); form.append("response_format", "json"); form.append("language", "en");
          res = await fetchImpl(`${c.localStt.url}/audio/transcriptions`, { method: "POST", signal: ctl.signal, headers: c.localStt.key ? { authorization: `Bearer ${c.localStt.key}` } : {}, body: form });
        }
        if (!res.ok) { const body = await res.text().catch(() => ""); const e = new Error(`${which === "eleven" ? "ElevenLabs" : "local whisper"} ${res.status}: ${body.slice(0, 160)}`); e.status = res.status; throw e; }
        const j = await res.json(), text = String(j.text || "").trim();
        if (which === "eleven") st.seconds += seconds;
        st.sttOk++;
        return { text, by: which };
      } catch (e) {
        st.sttFail++;
        if (signal && signal.aborted) return null;
        if (which === "eleven") rest("stt", e); else { st.lastError = `local stt: ${e.message}`; log.warn(`[voice] ${e.message}`); }
      } finally { clearTimeout(timer); }
    }
    return null;
  }
  function status() {
    const c = cfg(); roll();
    const ls = L ? L.status() : null;
    const el = c.engine === "local" || c.engine === "browser" ? null : !c.key ? "no key" : !c.enabled ? "off" : now() < st.ttsUntil ? `resting ${Math.round((st.ttsUntil - now()) / 1000)} s` : badVoices.has(c.voiceId) ? "his voice needs a paid plan" : "ok";
    const kokoro = c.engine !== "elevenlabs" && c.engine !== "browser" && ls ? ls.state : null;
    // what Mochi's next line will be spoken with
    const tts = c.engine === "browser" ? "browser voice" : el === "ok" ? "elevenlabs" : kokoro === "ready" ? "kokoro" : kokoro === "loading" ? "kokoro (loading)" : "browser voice";
    return { tts, engine: c.engine, elevenlabs: el, kokoro: ls, stt: c.key && c.enabled && now() >= st.sttUntil ? "elevenlabs" : c.localStt ? "local whisper" : "browser",
      localStt: !!c.localStt, voice: c.key ? c.voiceId : null, charsToday: st.chars, sttSecondsToday: Math.round(st.seconds), ok: st.ttsOk + st.sttOk, failed: st.ttsFail + st.sttFail, lastError: st.lastError };
  }
  /** get Kokoro going (its first fetch of the model takes a minute) unless it won't be used */
  const warm = () => { const e = cfg().engine; if (L && e !== "elevenlabs" && e !== "browser") L.warm(); };
  return { tts, stt, status, sayable, warm, local: L };
}

/* ------------------------------------------------------------------ pointing */
// "shoot this thing over here", "throw a snowball at that", "look at this", "go over there", "put it there": a thing
// to do where the finger goes next. Returns { do: "shoot"|"throw"|"look"|"go"|"put", thing } or null.
const HERE = /\b(this|that|these|those|here|there|over here|over there|right here|right there|where i('?m| am) (pointing|tapping|touching)|this (thing|one|spot|guy)|that (thing|one|spot|guy))\b/;
const VERBS = { shoot: "shoot|fire|blast|squirt|spray|zap|launch|aim|pop|nail|hit", throw: "throw|toss|chuck|lob|hurl|pelt", look: "look|see|check|peek|stare|watch", go: "go|walk|come|move|run|toddle|stand|get", put: "put|place|leave|drop|set" };
const DO = Object.entries(VERBS).map(([d, v]) => [d, new RegExp(`\\b(?:${v})\\b`), v]);
const NOT = /\b(don'?t|do not|stop|never|not)\b/;
const STORY = /\b(i|we|he|she|they|my|our)\s+(shot|threw|looked|went|put|was|were|had)\b/;
// "shoot Cocoa", "squirt Mimi with your water gun", "can you blast cocoa?": the friend is the target, no tap needed.
// Not "Cocoa, shoot Mochi" (Cocoa is the one asked) and not throws ("throw a snowball at Cocoa" is a soft-toy fight).
// (only clear shooting words: "hit Cocoa with a snowball" is a soft-toy throw, and "shoot Mimi a text" is a text: Nov 3)
const AT_VERBS = "shoot|squirt|spray|blast|zap|soak|splash|fire";
const AT_FRIEND = new RegExp(`\\b(?:${AT_VERBS})(?:\\s+(?:at|on))?\\s+(cocoa|mimi)\\b|\\b(?:${AT_VERBS})\\b[^.!?]{0,40}\\bat\\s+(cocoa|mimi)\\b`);
const NOT_A_SHOT = /\b(?:throw|toss|chuck|lob|hurl|pelt|snow ?balls?|balloons?|pillows?|foam ball|confetti ball)\b|\b(?:cocoa|mimi) (?:a|an) (?:text|message|email|dm|look|glance|smile|wink|selfie|photo|pic|note|line)\b|\b(?:a|the) (?:text|message|email|dm|look|glance|photo|pic)\b/;
export function pointIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!t || NOT.test(t) || STORY.test(t)) return null;
  const asks = /\b(can|could|would|will) you\b/.test(t), question = /\?\s*$/.test(t) && !asks;   // "did the snowball hit cocoa?" asks, it doesn't order
  const f = !question && !/^\s*(cocoa|mimi)\b\s*[,:!]/.test(t) && !NOT_A_SHOT.test(t) && AT_FRIEND.exec(t);
  if (f) {
    const m1 = t.match(/\b(?:with|using) (?:the |your |a |an |my )?([a-z][a-z ]{2,30}?)(?=[.!?,]|$| at\b| on\b)/);
    const m2 = t.match(new RegExp(`\\b(?:${VERBS.shoot}) (?:the |your |a |an |my )?([a-z][a-z ]{2,30}?)(?= at (?:cocoa|mimi)\\b)`));
    const raw = (m1 && m1[1]) || (m2 && m2[1]) || null;
    return { do: "shoot", thing: raw && !/^(it|this|that|him|her|them|something)$/.test(raw.trim()) ? raw.trim() : null, at: f[1] || f[2] };
  }
  if (!HERE.test(t)) return null;
  if (/\b(what|who|why|how)\b.*\?/.test(t) && !/\b(can|could|would|will) you\b/.test(t)) return null;   // "what is that?" isn't an order
  for (const [d, re, v] of DO) if (re.test(t)) {
    const m1 = t.match(/\b(?:with|using) (?:the |your |a |an )?([a-z][a-z ]{2,30}?)(?= at\b| over\b| there\b| here\b|[.!?,]|$)/);
    const m2 = d === "shoot" || d === "throw" ? t.match(new RegExp(`\\b(?:${v}) (?:the |your |a |an |some )?([a-z][a-z ]{2,30}?)(?= at\\b| to\\b| over\\b| there\\b| here\\b| on\\b|[.!?,]|$)`)) : null;
    const raw = (m1 && m1[1]) || (m2 && m2[1]) || null;
    const thing = raw && !/^(it|this|that|those|these|them|him|her|me|up|out|off|away|right|straight|over|there|here|something|anything|one)\b/.test(raw) ? raw.trim() : null;
    return { do: d, thing };
  }
  return null;
}
