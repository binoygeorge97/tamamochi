/* How a line is said (Nov 6, Binoy: "a good local tts ... that can not only give us 3 different voices but also have
 * emotion, rate, and volume control mid sentence").
 *
 * parseSpeech() turns a line into pieces, each said at its own speed, loudness and pitch, with a pause after it.
 * Most of it comes from the words themselves, so Gemma doesn't have to do anything:
 *  - the tone of each sentence (sad, scared, cross, sorry, worried, excited, happy): a sad sentence is slower,
 *    softer and lower; an excited one quicker, louder and higher; a plain "!" gets a little lift;
 *  - a stage direction in the middle of a line colours what comes after it, to the end of that sentence:
 *    "*whispers* it's a secret" is whispered, "*sniffles*" makes it sad, "*gasps*", "*sighs*", "*yawns*"…;
 *  - an aside in brackets "(psst, don't tell Cocoa)" is said softly, a bit quicker;
 *  - a trailing "…" leaves a real pause ("Well… okay.");
 *  - a SHOUTED word lifts its sentence (and is said as a word, not spelled out);
 * and anyone writing a line by hand can say exactly how: {whisper}…{/whisper}, {soft} {loud} {slow} {fast} {high}
 * {low} {happy} {excited} {sad} {sorry} {worried} {scared} {cross} {sleepy} {shy} {proud}, {pause}, and numbers:
 * {rate=0.8} {vol=0.5} {pitch=+2} (semitones). A tag lasts until its {/tag} (or {/} for all), else to the end.
 *
 * speakable() also fixes what the speech model would say wrong: "Mochi" (it says "MAH-chai"), shouted words (it
 * spells "WOW" out as W-O-W), "Mmm", "Shh", "Grr", "Sooo", "~" (it reads "tilde"), and the like.
 * No Node or browser APIs: the server uses it, and so can a page. */

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** rate and loudness multiply, pitch (semitones) adds */
export const PRESETS = {
  happy: { rate: 1.05, vol: 1.08, pitch: 0.8 },
  excited: { rate: 1.12, vol: 1.18, pitch: 1.5 },
  sad: { rate: 0.86, vol: 0.72, pitch: -1.2 },
  sorry: { rate: 0.92, vol: 0.8, pitch: -0.6 },
  worried: { rate: 0.95, vol: 0.85, pitch: 0.4 },
  scared: { rate: 1.12, vol: 0.85, pitch: 1.6 },
  cross: { rate: 1.04, vol: 1.22, pitch: -0.7 },
  sleepy: { rate: 0.82, vol: 0.7, pitch: -1 },
  shy: { rate: 0.94, vol: 0.68, pitch: 0.6 },
  proud: { rate: 0.98, vol: 1.12, pitch: 0.3 },
  whisper: { rate: 0.92, vol: 0.42, pitch: 0 },
  soft: { vol: 0.62 },
  loud: { rate: 1.03, vol: 1.4, pitch: 0.4 },
  slow: { rate: 0.8 },
  fast: { rate: 1.25 },
  high: { pitch: 2 },
  low: { pitch: -2 },
  aside: { rate: 1.04, vol: 0.7, pitch: -0.3 },
  lift: { rate: 1.03, vol: 1.06, pitch: 0.5 },
};
const ALIAS = { angry: "cross", mad: "cross", grumpy: "cross", quiet: "soft", gentle: "soft", shout: "loud", yell: "loud", giggle: "happy", cheerful: "happy", glad: "happy", nervous: "scared", afraid: "scared", tired: "sleepy", whispering: "whisper", upset: "sad", bashful: "shy" };
const presetOf = (name) => PRESETS[ALIAS[name] || name] || null;
const EMOTIONS = new Set(["happy", "excited", "sad", "sorry", "worried", "scared", "cross", "sleepy", "shy", "proud", "whisper"]);

// a stage direction's word → how the rest of that sentence is said
const CUES = [
  [/whisper|psst|hush|murmur|under (?:his|her|my) breath|quietly|softly/i, "whisper"],
  [/sniff|sob|cr(?:y|ies|ied)|tear|sad|droop|sniffle|lip wobble|pout(?:s|ing)? sadly/i, "sad"],
  [/gasp|eep|eek|shiver|trembl|gulp|hide|hides|nervous|scared|squeak/i, "scared"],
  [/sigh/i, "sigh"],
  [/yawn|sleepy|drowsy|rubs? (?:his|her|my)? ?eyes/i, "sleepy"],
  [/shout|yell|cheer|holler|roar|call(?:s|ing)? out|loudly/i, "loud"],
  [/mumbl|mutter|grumbl/i, "mumble"],
  [/huff|hmph|stomp|cross(?:es)? (?:his|her|my)? ?arms|glare|frown|pouts?\b|grr/i, "cross"],
  [/blush|bashful|shy|fidget|shuffl|looks? away|hides? (?:his|her) face/i, "shy"],
  [/giggl|laugh|hehe|chuckl|grin|beam|smil|snicker/i, "happy"],
  [/bounc|hop|jump|spin|twirl|wiggl|wags?|clap|squeal|excit|dance|cheer/i, "excited"],
  [/sorry|apologi|sheepish/i, "sorry"],
  [/puff(?:s|ed)? (?:up|out)|proud|chest out|salut/i, "proud"],
];
const CUE_EXTRA = { sigh: { rate: 0.88, vol: 0.78, pitch: -0.6 }, mumble: { rate: 1.06, vol: 0.6, pitch: -0.6 } };
const cueOf = (words) => { for (const [re, name] of CUES) if (re.test(words)) return CUE_EXTRA[name] ? { name, p: CUE_EXTRA[name] } : { name, p: PRESETS[name] }; return null; };

// the tone of a sentence from its words (the same ones his face goes by, web/voice.js), then excitement and joy;
// "not sad" and the like don't count
const TONES = [
  ["sad", /\b(sad|sadly|cry|crying|cried|tears?|sob|lonely|heartbroken|miss (?:you|her|him|them|it)|that'?s (?:awful|terrible|horrible|so sad)|passed away|died|lost (?:my|his|her|your)|boo-?hoo|sniff(?:le)?s?|it hurts?|i'?m hurt|feel(?:ing)? (?:down|blue|bad))\b|:\(/i],
  ["scared", /\b(scared|scary|afraid|frightened|terrified|eek+|yikes|spooky|nervous|uh[- ]oh|gulp)\b/i],
  ["cross", /\b(hmph|humph|not fair|grr+|so mad|i'?m mad|angry|annoyed|that'?s mean|rude|meanie|how dare)\b/i],
  ["sorry", /\b(sorry|oops|whoops|my bad|apologi[sz]e|forgive me|i didn'?t mean|i messed up|i forgot)\b/i],
  ["worried", /\b(are you (?:ok|okay|alright|all right)|worried|i hope you'?re|feel better|take care|be careful|oh no|poor (?:you|thing))\b/i],
  ["excited", /\b(yay+|woo+(?:hoo+)?|wow+|hooray|whee+|yippee|ta-?da+|let'?s go+|amazing|awesome|incredible|best day|can'?t wait|so excited)\b/i],
  ["happy", /\b(hehe+|haha+|teehee|giggles?|love (?:it|you|this|that)|yummy|so cute|so happy|fun|delicious|cozy|hugs?)\b|♡|♥|<3/i],
];
const NEGATED = /\b(?:not|never|no longer|isn'?t|aren'?t|don'?t|won'?t|no need to)\s+(?:be\s+|feel\s+|so\s+|too\s+)?$/i;
export function toneOf(text) {
  const t = String(text || "");
  for (const [tone, re] of TONES) {
    const m = re.exec(t);
    if (m && !NEGATED.test(t.slice(Math.max(0, m.index - 22), m.index))) return tone;
  }
  return null;
}

/* ------------------------------------------------------------------ saying words right */
const ACRONYMS = new Set(["TV", "DJ", "UFO", "ABC", "ABCS", "DNA", "USA", "UK", "OK", "LOL", "BFF", "BFFS", "ID", "PJ", "PJS", "TNT", "AI", "VIP", "DIY", "ASAP", "GPS", "CD", "DVD", "PS", "PE", "MVP", "OMG"]);
const RESPELL = [
  [/^mochi$/, "moe-chee"], [/^mochis$/, "moe-chees"], [/^mochi's$/, "moe-chee's"], [/^tamamochi$/, "tama-moe-chee"],
  [/^m{2,}$/, "hmm"], [/^h+m{2,}$|^hm$/, "hmm"], [/^h+m+p+h+$|^hmf$|^humph+$/, "humph"],
  [/^g+r{2,}$/, "gurr"], [/^p+f{2,}t*$|^p+f+t+$|^p+s+h+$/, "pfuh"], [/^s*h{2,}$|^sh$/, "shush"], [/^z{3,}$/, ""],
  [/^b+r{2,}$/, "burr"], [/^a{2,}h*$|^a+h{2,}$/, "aah"], [/^e{2,}k+$/, "eek"], [/^o{3,}h*$/, "ooh"], [/^o+h{2,}$/, "oh"],
  [/^e+w{2,}$/, "ew"], [/^a+w{2,}$/, "aw"], [/^o+w{2,}$/, "ow"], [/^ba{2,}$/, "baa"], [/^wo{3,}$/, "woo"], [/^whe{3,}$/, "whee"],
  [/^we{3,}$/, "wee"], [/^e(?:he)+h?$/, "heh heh"], [/^u+h{2,}$|^u{2,}h+$/, "uh"], [/^u+m{2,}$/, "um"], [/^u+g+h{2,}$/, "ugh"],
  [/^h+u+h{2,}$/, "huh"], [/^lo{3,}ve$/, "love"], [/^mwa+h*$/, "mwah"],
];
/** a word the speech model can say: { w, loud, long } (loud: it was SHOUTED; long: "sooo") */
function sayWord(w) {
  let loud = false, long = false;
  if (w.length >= 2 && /[A-Z]{2}/.test(w) && w === w.toUpperCase() && !ACRONYMS.has(w.replace(/['’].*$/, ""))) { w = w.toLowerCase(); loud = true; }
  const cap = /^[A-Z]/.test(w), lw = w.toLowerCase();
  let out = null;
  for (const [re, to] of RESPELL) if (re.test(lw)) { out = to; break; }
  if (out === null && /([a-z])\1\1/.test(lw)) {
    long = true;
    // a stretched word ("sooo", "yaaay", "pleeease", "gooood"): back to its letters (an "ee" or "oo" in the middle
    // stays double), else it's read out letter by letter
    out = lw.replace(/([a-z])\1{2,}/g, (m, ch, off) => ((ch === "e" || ch === "o") && off + m.length < lw.length && !/[aeiouy]/.test(lw[off + m.length]) ? ch + ch : ch));
  }
  if (out === null) return { w, loud, long };
  return { w: cap && out ? out[0].toUpperCase() + out.slice(1) : out, loud, long };
}
/** the line as the speech model should read it, and what it says about how (shouted, stretched) */
export function speakable(text) {
  let loud = 0, long = 0;
  let t = String(text || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\bm+-?hm+\b/gi, (m) => (m[0] === "M" ? "Uh-huh" : "uh-huh"))
    .replace(/(^|\s)[:;=]-?[)(DPpO3]+(?=\s|$)/g, "$1")                         // :) ;D
    .replace(/<3/g, " ")
    .replace(/[♡♥❤♪♫★☆✨_`#>]|\p{Extended_Pictographic}|️|‍/gu, " ")
    .replace(/~+/g, " ")                                                         // (it reads "tilde")
    .replace(/&/g, " and ")
    .replace(/\.{3,}/g, "…");
  t = t.replace(/[A-Za-z]+(?:['’][A-Za-z]+)?/g, (w) => { const r = sayWord(w); if (r.loud) loud++; if (r.long) long++; return r.w; });
  t = t.replace(/\s+([!?.,…;:])/g, "$1").replace(/([!?])\1+/g, "$1").replace(/\s{2,}/g, " ").trim();
  return { text: t, loud, long };
}

/** the line without any {tags} (what's shown, and what another voice gets) */
export const stripTags = (text) => (!/\{\/?[a-z]*(?:=[^{}\s]*)?\}/i.test(String(text || "")) ? String(text || "") : String(text || "").replace(/\{\/?[a-z]*(?:=[^{}\s]*)?\}/gi, " ").replace(/\s{2,}/g, " ").replace(/\s+([!?.,…])/g, "$1").trim());

/* ------------------------------------------------------------------ the pieces */
const TOKEN = /\{\/?[a-z]*(?:=[-+]?\d*\.?\d+)?\}|\*[^*\n]{1,80}\*|\[[^\]\n]{1,80}\]|\([^()\n]{1,200}\)/gi;
// close enough to say in one go (each separate piece is another trip through the model: Nov 6, a short line of three
// slightly different pieces took 3 s on the M5); a light lift or a happy note blends in, a sad or excited one doesn't
const same = (a, b) => Math.abs(a.rate - b.rate) < 0.06 && Math.abs(a.vol - b.vol) < 0.15 && Math.abs(a.pitch - b.pitch) < 0.9;
const apply = (p, q) => (q ? { rate: p.rate * (q.rate || 1), vol: p.vol * (q.vol || 1), pitch: p.pitch + (q.pitch || 0) } : p);

/**
 * [{ text, rate, vol, pitch, pause }]: say text at that speed (×), loudness (×) and pitch (semitones), then wait
 * pause ms. Pieces said the same way next to each other are one piece, so most lines are one or two.
 */
export function parseSpeech(line, { maxPiece = 240 } = {}) {
  const src = String(line || "").replace(/\r/g, "").replace(/\.{3,}/g, "…");
  // tokens: tags, stage directions, asides, and the words between
  const toks = [];
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    if (m.index > last) toks.push({ k: "text", v: src.slice(last, m.index) });
    const v = m[0];
    if (v[0] === "{") {
      const mm = /^\{(\/?)([a-z]*)(?:=([-+]?\d*\.?\d+))?\}$/i.exec(v), close = mm[1] === "/", name = mm[2].toLowerCase(), num = mm[3] !== undefined ? +mm[3] : null;
      toks.push(close ? { k: "close", v: name } : { k: "open", v: name, num });
    } else if (v[0] === "(") toks.push({ k: "aside", v: v.slice(1, -1) });
    else toks.push({ k: "cue", v: v.slice(1, -1) });
    last = m.index + v.length;
  }
  if (last < src.length) toks.push({ k: "text", v: src.slice(last) });

  const tags = [];   // [{ name, p }] open now
  let cue = null, cueUsed = false, prevPiece = null;
  const raw = [];    // { text, p, pause, end }
  const tagP = () => {
    let p = { rate: 1, vol: 1, pitch: 0 }, emotion = false;
    for (const t of tags) { p = apply(p, t.p); if (EMOTIONS.has(ALIAS[t.name] || t.name)) emotion = true; }
    return { p, emotion };
  };
  const pushText = (text, { aside = false } = {}) => {
    // split into sentences, and at a "…" inside one (a real pause there)
    const parts = String(text).split(/(?<=[.!?…]["”’)]?)\s+/);
    for (let part of parts) {
      if (!part.trim()) continue;
      const { p: base, emotion } = tagP();
      const said = speakable(part);
      const end = /[.!?]["”’)]?\s*$/.test(part), dots = /…["”’)]?\s*$/.test(part);
      let p = base, tone = null;
      if (aside) p = apply(p, PRESETS.aside);
      if (cue) { p = apply(p, cue.p); cueUsed = true; tone = cue.name; }
      else if (!emotion && !aside) {
        tone = toneOf(part);
        if (tone) p = apply(p, PRESETS[tone]);
        else if (/!["”’)]?\s*$|~/.test(part)) p = apply(p, PRESETS.lift);   // (a "~": playful)
      }
      if (said.loud) p = apply(p, { vol: 1.12, pitch: 0.4 });
      if (said.long) p = apply(p, { rate: 0.95 });
      const piece = { text: said.text, p, tone, pause: dots ? 300 : end ? 140 : 0, end: end || dots };
      raw.push(piece); prevPiece = piece;
      if (end) { if (cue && cueUsed) cue = null; }
    }
  };
  for (const t of toks) {
    if (t.k === "text") pushText(t.v);
    else if (t.k === "aside") {
      // "(psst, don't tell Cocoa)": softly, with a breath either side
      if (prevPiece && !prevPiece.pause) prevPiece.pause = 90;
      pushText(t.v, { aside: true });
      if (prevPiece && !prevPiece.pause) prevPiece.pause = 90;
    } else if (t.k === "cue") {
      const c = cueOf(t.v);
      if (!c) continue;
      if (prevPiece && !prevPiece.end) prevPiece.pause = Math.max(prevPiece.pause, 80);
      cue = c; cueUsed = false;
    } else if (t.k === "open") {
      if (t.v === "pause" || t.v === "break") { if (prevPiece) prevPiece.pause = Math.max(prevPiece.pause, t.num ? clamp(t.num * (t.num < 10 ? 1000 : 1), 50, 3000) : 400); continue; }
      let p = presetOf(t.v);
      if (t.num !== null && /^(rate|speed)$/.test(t.v)) p = { rate: clamp(t.num, 0.5, 2) };
      else if (t.num !== null && /^(vol|volume)$/.test(t.v)) p = { vol: clamp(t.num, 0, 2) };
      else if (t.num !== null && t.v === "pitch") p = { pitch: clamp(t.num, -6, 6) };
      if (!p) continue;
      if (prevPiece && !prevPiece.end) prevPiece.pause = Math.max(prevPiece.pause, 40);
      tags.push({ name: t.v, p });
    } else if (t.k === "close") {
      if (!t.v) tags.length = 0;
      else { for (let i = tags.length - 1; i >= 0; i--) if (tags[i].name === t.v || (t.v === "rate" && tags[i].name === "speed") || (t.v === "vol" && tags[i].name === "volume")) { tags.splice(i, 1); break; } }
      if (prevPiece && !prevPiece.end) prevPiece.pause = Math.max(prevPiece.pause, 40);
    }
  }
  // a stage direction at the very end ("I miss you. *sniffles*") colours the sentence before it
  // (unless it's already said that way: "I miss you. *sniffles*" is sad once, not twice over)
  if (cue && !cueUsed && prevPiece && prevPiece.tone !== cue.name) prevPiece.p = apply(prevPiece.p, cue.p);

  // pieces said the same way, side by side, become one (the speech model phrases a whole sentence better than bits)
  const out = [];
  for (const r of raw) {
    if (!/[a-z0-9]/i.test(r.text)) { if (out.length) out[out.length - 1].pause = Math.max(out[out.length - 1].pause, r.pause); continue; }
    const p = { rate: clamp(r.p.rate, 0.55, 1.7), vol: clamp(r.p.vol, 0.15, 1.9), pitch: clamp(r.p.pitch, -5, 6) };
    const prev = out[out.length - 1];
    if (prev && same(prev, p) && prev.pause <= 140 && prev.text.length + r.text.length < maxPiece) {
      // the two said as one, somewhere between (by how much of it each is)
      const a = prev.text.length, b = r.text.length, mix = (k) => (prev[k] * a + p[k] * b) / (a + b);
      prev.rate = mix("rate"); prev.vol = mix("vol"); prev.pitch = mix("pitch");
      prev.text += ` ${r.text}`; prev.pause = r.pause; continue;
    }
    out.push({ text: r.text, ...p, pause: r.pause });
  }
  if (out.length) out[out.length - 1].pause = 0;
  return out.map((s) => ({ text: s.text, rate: +s.rate.toFixed(3), vol: +s.vol.toFixed(3), pitch: +s.pitch.toFixed(2), pause: Math.round(s.pause) }));
}

/* ---------- a friend narrating instead of acting (Nov 7, Binoy: "Cocoa said his action instead of acting it out":
 * "Cocoa starts laughing so hard he can't stop, dude!"). A line that starts with the speaker's own name and a verb is a
 * stage direction: it's acted out (a giggle, a cheer, a dance…) and shown as a note, not said. "Mochi looks amazing!"
 * from Mimi is still words: only their own name counts. */
const NARR = /^[\s*(\[]*(mimi|cocoa|mochi)\s+(?:(?:just|then|suddenly|happily|quickly|slowly|really)\s+)?(?:starts?|begins?|bursts?|breaks?|laughs?|laughing|giggles?|giggling|chuckles?|snorts?|smiles?|grins?|beams?|jumps?|hops?|bounces?|runs?|races?|walks?|wanders?|waves?|hugs?|dances?|dancing|spins?|twirls?|nods?|shrugs?|sighs?|gasps?|blushes|cries|sniffles|claps?|cheers?|looks?|stares?|peeks?|rolls?|falls?|tumbles?|leaves|heads?|comes?|winks?|bows?|pouts?|frowns?|squeals?|screams?|yawns?|stretches|wiggles?|throws?|grabs?|holds?|takes?|gives?|hands?|puts?|pulls?|pushes|sits?|stands?|lies|flops?|high-fives?|fist-bumps?|pats?|pokes?|tickles?|kisses|boops?|nuzzles?|cuddles?|snuggles?|is\s+(?:laughing|giggling|dancing|crying|smiling|jumping|spinning|hiding))\b/i;
const ACT_OF = [[/laugh|giggl|chuckl|snort/i, "laugh"], [/hug/i, "hug"], [/danc|spin|twirl|wiggl/i, "dance"], [/cheer|clap|jump|hop|bounc|squeal|high-five|fist-bump/i, "cheer"], [/wave|leave|heads? (?:home|off|out)/i, "wave"], [/cr(?:y|ies)|sniffl|sigh|pout|frown/i, "sad"]];
/** { act, note } when the line is the speaker narrating themselves, else null */
export function narrated(line, who) {
  const t = String(line || "").trim(), m = NARR.exec(t);
  if (!m || (who && m[1].toLowerCase() !== String(who).toLowerCase())) return null;
  const act = (ACT_OF.find(([re]) => re.test(t)) || [null, "hello"])[1];
  const note = t.replace(/^[\s*(\[]+|[\s*)\]]+$/g, "").replace(/,?\s*\b(?:dude|bro|lol)\b[!.]*$/i, "").replace(/[!.]+$/, "").trim();
  return { act, note };
}
