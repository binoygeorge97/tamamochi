// Voices made on the M5 itself (Nov 6, Binoy: "find a good local tts we can use that can not only give us 3 different
// voices but also have emotion, rate, and volume control mid sentence? If running the local model on the bosgame would
// significantly slow it down lmk", then "let's use kokoro for now").
//
// Kokoro-82M (Apache-2.0, ~90 MB at 8-bit) through kokoro-js, on the CPU, inside this server: Gemma has the GPU to
// itself, and a line takes a fraction of a second on the Ryzen's cores (a few threads, one line at a time). The model
// comes down once from Hugging Face the first time and is kept in data\models.
//
// Each friend has their own voice (one of Kokoro's English voices), pitch and pace; the acting comes from
// shared/speech.js: the line is cut into pieces said at their own speed, loudness and pitch, then joined back up
// with real pauses. Pitch without chipmunk tempo: a piece is made slower by the pitch ratio, then played back faster
// by the same ratio (a clean windowed-sinc resample), so it ends up higher at the speed it should be.
// Not installed (`npm install` in server\), or anything goes wrong: null, and the page uses the browser's voice.
import fs from "node:fs";
import { parseSpeech } from "../shared/speech.js";
import { readKeysFile } from "./router.js";

// fp32 (~325 MB): on the M5's Ryzen the 8-bit one (q8, ~90 MB) was slower than real time (Nov 6: 1.6 s of speech
// took 2 s, a short line 3 s); its on-the-fly unpacking costs more than it saves on x86. keys.json can pick another:
// "voice": {"local": {"dtype": "q8" | "fp16" | "q4" | "fp32", "threads": 8}}
export const KOKORO = { model: "onnx-community/Kokoro-82M-v1.0-ONNX", dtype: "fp32", sampleRate: 24000 };
const DTYPES = ["fp32", "fp16", "q8", "q4", "q4f16"];
/** who sounds like what, unless keys.json ("voice": {"local": {...}}) or the Voices page says otherwise */
export const DEFAULTS = {
  mochi: { voice: "af_heart", pitch: 2.5, rate: 1.0, vol: 1 },    // a bright little voice
  mimi: { voice: "af_bella", pitch: 3.5, rate: 1.04, vol: 1 },    // sweeter, higher, a touch quicker
  cocoa: { voice: "am_puck", pitch: 2, rate: 1.0, vol: 1 },       // a goofy boy
};
/** Kokoro's English voices, best first (the model card's grades) */
export const VOICES = [
  ["af_heart", "American girl, warm (best)"], ["af_bella", "American girl, bright (very good)"], ["af_nicole", "American girl, breathy (good)"],
  ["bf_emma", "British girl (good)"], ["af_aoede", "American girl, light"], ["af_kore", "American girl, clear"], ["af_sarah", "American girl, soft"],
  ["am_puck", "American boy, playful"], ["am_fenrir", "American boy, deep"], ["am_michael", "American boy, steady"],
  ["af_nova", "American girl, crisp"], ["af_alloy", "American girl, flat"], ["bf_isabella", "British girl, low"], ["bm_fable", "British boy, storyteller"],
  ["bm_george", "British boy, gentle"], ["af_sky", "American girl, airy"], ["bf_alice", "British girl, plain"], ["bf_lily", "British girl, quiet"],
  ["am_echo", "American boy, echoey"], ["am_eric", "American boy, plain"], ["am_liam", "American boy, young"], ["am_onyx", "American boy, low"],
  ["bm_lewis", "British boy, low"], ["bm_daniel", "British boy, plain"], ["af_jessica", "American girl, rough"], ["af_river", "American girl, rough"],
];
const IDS = new Set(VOICES.map(([id]) => id));
const WHO = ["mochi", "mimi", "cocoa"];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const num = (v, d) => (v === undefined || v === null || v === "" || isNaN(+v) ? d : +v);
/** one friend's settings, tidied (anything odd falls back to what it was) */
export function tidyVoice(v = {}, d = DEFAULTS.mochi) {
  return { voice: IDS.has(v.voice) ? v.voice : d.voice, pitch: clamp(num(v.pitch, d.pitch), -6, 8), rate: clamp(num(v.rate, d.rate), 0.7, 1.4), vol: clamp(num(v.vol, d.vol), 0.3, 1.6) };
}

/* ------------------------------------------------------------------ sound */
const sinc = (x) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const kernels = new Map();
/** play x back r times faster (r > 1: higher and shorter), band-limited so nothing aliases */
export function resample(x, r) {
  if (!x.length || Math.abs(r - 1) < 1e-3) return x;
  const H = 8, P = 256, key = r.toFixed(4);
  let tab = kernels.get(key);
  if (!tab) {
    const fc = Math.min(1, 1 / r) * 0.94;
    tab = new Float32Array(P * 2 * H);
    for (let p = 0; p < P; p++) {
      let sum = 0;
      for (let j = 0; j < 2 * H; j++) { const d = p / P + H - 1 - j, w = Math.abs(d) < H ? fc * sinc(fc * d) * sinc(d / H) : 0; tab[p * 2 * H + j] = w; sum += w; }
      for (let j = 0; j < 2 * H; j++) tab[p * 2 * H + j] /= sum || 1;
    }
    if (kernels.size > 64) kernels.clear();
    kernels.set(key, tab);
  }
  const n = Math.floor((x.length - 1) / r) + 1, y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i * r, k0 = Math.floor(pos), p = Math.min(P - 1, Math.floor((pos - k0) * P)), base = p * 2 * H;
    let s = 0;
    for (let j = 0; j < 2 * H; j++) { const k = k0 - H + 1 + j; if (k >= 0 && k < x.length) s += tab[base + j] * x[k]; }
    y[i] = s;
  }
  return y;
}
/** without the silence either end (the pauses are put back where the line wants them) */
export function trim(x, sr, { thr = 0.006, lead = 0.02, tail = 0.05 } = {}) {
  let a = 0, b = x.length - 1;
  while (a < x.length && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  if (a >= b) return new Float32Array(0);
  return x.slice(Math.max(0, a - Math.round(lead * sr)), Math.min(x.length, b + 1 + Math.round(tail * sr)));
}
const soft = (v) => { const a = Math.abs(v); return a <= 0.75 ? v : Math.sign(v) * (0.75 + 0.25 * Math.tanh((a - 0.75) / 0.25)); };
/** pieces [{ x, vol, pause }] → one clip: evened out (a steady loudness whatever the voice), each piece at its own
 * loudness, gentle edges, a soft ceiling, the pauses in between */
export function join(parts, sr, { target = 0.085 } = {}) {
  let e = 0, n = 0;
  for (const p of parts) for (let i = 0; i < p.x.length; i++) { const v = p.x[i]; if (Math.abs(v) > 0.01) { e += v * v; n++; } }
  const base = n ? clamp(target / Math.sqrt(e / n), 0.5, 4) : 1, lead = Math.round(0.02 * sr), tail = Math.round(0.06 * sr), fade = Math.round(0.006 * sr);
  let len = lead + tail;
  for (const [i, p] of parts.entries()) len += p.x.length + (i < parts.length - 1 ? Math.round(Math.max(40, p.pause || 0) / 1000 * sr) : 0);
  const out = new Float32Array(len);
  let at = lead;
  for (const [i, p] of parts.entries()) {
    const g = base * (p.vol || 1), L = p.x.length;
    for (let j = 0; j < L; j++) { const f = Math.min(1, j / fade, (L - 1 - j) / fade); out[at + j] = soft(p.x[j] * g * Math.max(0, f)); }
    at += L + (i < parts.length - 1 ? Math.round(Math.max(40, p.pause || 0) / 1000 * sr) : 0);
  }
  return out;
}
/** 16-bit mono WAV */
export function toWav(x, sr) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(clamp(x[i], -1, 1) * 32767), 44 + i * 2);
  b.mime = "audio/wav";
  return b;
}

/* ------------------------------------------------------------------ Kokoro */
/** the real engine: { voices, say(text, { voice, speed }) → { audio, rate } } */
async function kokoroEngine({ cacheDir, threads, dtype = KOKORO.dtype, log }) {
  const K = await import("kokoro-js");
  let tr = null;
  try { tr = await import("@huggingface/transformers"); } catch (_) { /* kokoro-js's own copy will do */ }
  for (const env of [K.env, tr && tr.env]) if (env && cacheDir) { fs.mkdirSync(cacheDir, { recursive: true }); env.cacheDir = cacheDir; }
  let shown = -1;
  const progress_callback = (p) => {
    if (!p || p.status !== "progress" || !/\.onnx$/.test(p.file || "")) return;
    const step = Math.floor((p.progress || 0) / 25) * 25;
    if (step > shown) { shown = step; log.log(`[voice] fetching Kokoro's voice model (once): ${step}%`); }
  };
  let tts = null;
  // some of the cores (the default is every one, and Gemma's own loop wants a few), if this copy of transformers takes them
  if (tr && tr.StyleTextToSpeech2Model && tr.AutoTokenizer && K.KokoroTTS) {
    try {
      const [model, tok] = await Promise.all([
        tr.StyleTextToSpeech2Model.from_pretrained(KOKORO.model, { dtype, device: "cpu", progress_callback, session_options: { intraOpNumThreads: threads, interOpNumThreads: 1 } }),
        tr.AutoTokenizer.from_pretrained(KOKORO.model, { progress_callback }),
      ]);
      tts = new K.KokoroTTS(model, tok);
    } catch (e) { log.warn(`[voice] Kokoro with ${threads} threads didn't load (${e.message}); trying its own way`); tts = null; }
  }
  if (!tts) tts = await K.KokoroTTS.from_pretrained(KOKORO.model, { dtype, device: "cpu", progress_callback });
  const voices = new Set(Object.keys(tts.voices || {}));
  return {
    voices,
    async say(text, { voice, speed }) { const a = await tts.generate(text, { voice, speed }); return { audio: a.audio, rate: a.sampling_rate || KOKORO.sampleRate }; },
  };
}

/**
 * makeLocalTTS({ keysFile, settingsFile, cacheDir, engine }) → { say, warm, status, settings, set, voices }
 * engine: a stand-in for Kokoro (tests): async () => ({ voices, say(text, { voice, speed }) })
 */
export function makeLocalTTS({ keysFile = null, settingsFile = null, cacheDir = null, engine = null, log = console, now = () => Date.now() } = {}) {
  let eng = null, loading = null, state = "idle", error = null, retryAt = 0, loadMs = 0, test = null, lines = 0, spoken = 0, busyMs = 0, told = null;
  const conf = () => { const j = readKeysFile(keysFile); return (j && j.voice && j.voice.local) || {}; };
  let saved = { at: -1, v: {} };
  const savedNow = () => {
    if (!settingsFile) return {};
    try { const t = fs.statSync(settingsFile).mtimeMs; if (t !== saved.at) saved = { at: t, v: JSON.parse(fs.readFileSync(settingsFile, "utf8")) || {} }; } catch (_) { saved = { at: -1, v: {} }; }
    return saved.v;
  };
  /** what each friend sounds like now: the defaults, then keys.json, then the Voices page */
  function settings() {
    const c = conf(), s = savedNow(), out = {};
    for (const w of WHO) out[w] = tidyVoice({ ...DEFAULTS[w], ...(c[w] || {}), ...(s[w] || {}) }, DEFAULTS[w]);
    return out;
  }
  /** keep a friend's voice from the Voices page (null: back to the default) */
  function set(who, v) {
    if (!WHO.includes(who) || !settingsFile) return null;
    const s = { ...savedNow() };
    if (v) s[who] = tidyVoice(v, settings()[who]); else delete s[who];
    fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2));
    cache.clear();
    return settings()[who];
  }
  const enabled = () => conf().enabled !== false;

  async function load() {
    if (eng) return eng;
    if (loading) return loading;
    if (!enabled() || now() < retryAt) return null;
    state = "loading"; const t0 = now();
    loading = (async () => {
      try {
        const threads = clamp(Math.round(num(conf().threads, 8)), 1, 32), dtype = DTYPES.includes(conf().dtype) ? conf().dtype : KOKORO.dtype;
        eng = engine ? await engine() : await kokoroEngine({ cacheDir, threads, dtype, log });
        eng.how = `${dtype}, ${threads} threads`;
        loadMs = now() - t0; state = "ready"; error = null;
        // one line to be sure it speaks, and how quick it is here
        const t1 = now(), w = await synth("Hi! I'm Mochi.", settings().mochi);
        if (!w || !w.x.length) throw new Error("the test line came out silent");
        test = { ms: now() - t1, seconds: +(w.seconds).toFixed(2) };
        log.log(`[voice] Kokoro ready in ${(loadMs / 1000).toFixed(1)} s, on the CPU, ${eng.how} (a test line: ${test.seconds} s of speech made in ${(test.ms / 1000).toFixed(2)} s)`);
        return eng;
      } catch (e) {
        eng = null;
        const missing = /Cannot find (?:package|module)|ERR_MODULE_NOT_FOUND/.test(`${e.code} ${e.message}`);
        state = missing ? "missing" : "failed"; error = String(e.message).slice(0, 200);
        // the model file still being written by the other server (both share data\models; Windows says "system
        // error number 13" while it's open): again in a moment, by itself
        const busy = !missing && /error number 13|EBUSY|EACCES|EPERM/.test(error);
        retryAt = now() + (missing ? 60000 : busy ? 20000 : 5 * 60000);
        if (busy) { const t = setTimeout(() => warm(), 21000); if (t.unref) t.unref(); }
        if (told !== state || !missing) log.warn(missing ? "[voice] Kokoro isn't installed yet: run \"npm install\" in C:\\mochi\\server (until then the page uses the browser's voice)" : `[voice] Kokoro didn't start: ${error} (trying again in ${busy ? "20 seconds" : "5 minutes"}; the browser's voice speaks meanwhile)`);
        told = state;
        return null;
      } finally { loading = null; }
    })();
    return loading;
  }
  /** start loading now (the model's first fetch takes a while; better before anyone's talking) */
  const warm = () => { if (enabled()) load(); };

  // one line at a time: they'd only fight over the same cores
  let chain = Promise.resolve();
  const lock = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

  /** the line made into a clip: { x (Float32Array), sr, seconds } */
  async function synth(line, v, { signal } = {}) {
    const segs = parseSpeech(line);
    if (!segs.length) return null;
    const parts = [];
    let sr = KOKORO.sampleRate;
    for (const s of segs) {
      if (signal && signal.aborted) return null;
      const pitch = v.pitch + s.pitch, r = 2 ** (pitch / 12), rate = v.rate * s.rate;
      const speed = clamp(rate / r, 0.5, 2);   // slower by the pitch ratio, then sped back up by it
      const voice = eng.voices && eng.voices.size && !eng.voices.has(v.voice) ? "af_heart" : v.voice;
      const out = await eng.say(s.text, { voice, speed });
      sr = out.rate || sr;
      const x = resample(trim(out.audio, sr), r);
      if (x.length) parts.push({ x, vol: s.vol * v.vol, pause: s.pause });
    }
    if (!parts.length) return null;
    const x = join(parts, sr);
    return { x, sr, seconds: x.length / sr, pieces: parts.length };
  }

  // short lines come round again and again ("Hehe!", "Coming~!", "Everything's spinning…"): kept
  const cache = new Map();
  /**
   * a WAV (Buffer, .mime "audio/wav") of the line in this friend's voice, or null (not ready, nothing to say, a
   * problem: the page speaks it itself). wait: wait for the model if it's still loading (the Voices page);
   * voice: try a voice other than the saved one ({ voice, pitch, rate, vol }).
   */
  async function say(line, { who = "mochi", signal, wait = false, voice = null } = {}) {
    if (!WHO.includes(who)) who = "mochi";
    if (!eng) {
      const p = load();
      if (!wait || !p) return null;
      if (!(await p)) return null;
    }
    const v = voice ? tidyVoice(voice, settings()[who]) : settings()[who];
    const text = String(line || "").slice(0, 1200), key = `${who}|${v.voice}|${v.pitch}|${v.rate}|${v.vol}|${text}`;
    if (!voice && text.length <= 160 && cache.has(key)) { const b = cache.get(key); cache.delete(key); cache.set(key, b); return b; }
    try {
      return await lock(async () => {
        const t0 = now(), c = await synth(text, v, { signal });
        if (!c) return null;
        const wav = toWav(c.x, c.sr);
        lines++; spoken += c.seconds; busyMs += now() - t0;
        if (lines <= 12 || lines % 50 === 0) log.log(`[voice] ${who}: ${c.seconds.toFixed(1)} s of speech in ${((now() - t0) / 1000).toFixed(2)} s (${c.pieces} piece${c.pieces === 1 ? "" : "s"})`);
        if (!voice && text.length <= 160) { cache.set(key, wav); if (cache.size > 300) cache.delete(cache.keys().next().value); }
        return wav;
      });
    } catch (e) {
      error = String(e.message).slice(0, 200);
      log.warn(`[voice] Kokoro couldn't say that (${who}): ${error}`);
      return null;
    }
  }
  function status() {
    return { state: enabled() ? state : "off", error, loadSeconds: loadMs ? +(loadMs / 1000).toFixed(1) : null, test, lines, secondsSpoken: Math.round(spoken),
      speed: spoken ? +(spoken / Math.max(0.001, busyMs / 1000)).toFixed(1) : null };   // (speed: seconds of speech per second of work)
  }
  return { say, warm, status, settings, set, voices: VOICES, get ready() { return !!eng; } };
}
