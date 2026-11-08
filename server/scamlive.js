// New scams for the T-Mobile games, written on the fly (Nov 8, Binoy: "for tmobile skits, make use of Gemini flash to
// get a on the fly skit and for any other important parts of the tmobile demo"). Gemini Flash (3.8 or 3.6; Gemma
// when the cloud is off) writes a fresh made-up scam in the same shape as the hand-written ones:
//   - a scam message for the scam-spotting game: a friend reads out a text (or a call they got), Mochi asks "what looks
//     fishy?";
//   - a scam call for the scam-call game: Cocoa in his silly disguise phones Mimi, Mochi pauses it, three choices, and
//     the lines for each.
// Code decides what's right, not the model: the warning signs in a message are found by Mochi's own rules (scams.js
// TELLS), so the answer key always matches the words; the three choices of a call must read back as hang up / share /
// ask (gradeChoice); and nothing real: no company names, no real web addresses, no phone numbers, kind words only.
// One that fails a check is thrown away; the game falls back to the hand-written ones. index.js keeps a few ready.
import { TELLS, TELL_IDS, gradeChoice } from "./scams.js";

const BRANDS = /\b(?:t-?mobile|verizon|at&t|apple|icloud|amazon|paypal|venmo|cash ?app|zelle|roblox|fortnite|minecraft|epic games|xbox|playstation|nintendo|steam|netflix|disney|youtube|tiktok|instagram|snapchat|facebook|whatsapp|google|gmail|microsoft|usps|fedex|ups|dhl|irs|social security|chase|wells fargo|bank of america|citi(?:bank)?|pnc|capital one|walmart|target|costco|visa|mastercard|amex)\b/i;
const REAL_WEB = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|gov|edu|us|io|co\.uk)\b/i;
const PHONE_NO = /\d[\d\s().-]{6,}\d/;
const UNKIND = /\b(?:kill|die|dead|blood|gun|knife|drugs?|sex\w*|hate|stupid|idiot|dumb|shut up)\b/i;
const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const Name = (w) => (w === "mimi" ? "Mimi" : "Cocoa");
/** a line a kid can hear: short, made up, kind; null when it isn't */
export function okLine(s, max = 150) {
  const t = clip(s, 400);
  if (!t || t.length > max || BRANDS.test(t) || REAL_WEB.test(t) || PHONE_NO.test(t) || UNKIND.test(t)) return null;
  return t;
}
/** the warning signs these words really carry (Mochi's own rules decide the answer key, not the model) */
export function tellsIn(lines, declared = []) {
  const t = lines.join(" ").toLowerCase().replace(/[’`]/g, "'");
  const found = TELL_IDS.filter((id) => TELLS[id].re.test(t));
  return [...declared.filter((id) => found.includes(id)), ...found.filter((id) => !declared.includes(id))].slice(0, 4);
}

// ---- the scam message for the spotting game
export const SCENE_SCHEMA = { type: "object", properties: { kind: { type: "string", enum: ["text", "call"] }, lines: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 }, tells: { type: "array", items: { type: "string", enum: TELL_IDS } }, idea: { type: "string" } }, required: ["kind", "lines", "tells"] };
export function scenePrompt(who, avoid = []) {
  const voice = who === "mimi" ? "Mimi (a sweet sheep; she ends some lines with ♡)" : "Cocoa (Mochi's laid-back best buddy; he says \"bro\" and \"dude\")";
  return `Write a new made-up scam for a kids' game that teaches spotting scams (ages 7 to 12). ${voice} got a scam ${"text message or phone call"} and reads it out to Mochi in exactly 3 short lines: line 1 says they got it (from a number they don't know, or someone pretending to be someone), line 2 is the scam itself in quotes, line 3 is the trick and their question ("Should I…?").
Use 3 or 4 of these warning signs, clearly, in words a kid would notice: ${TELL_IDS.map((id) => `${id} (${TELLS[id].name})`).join("; ")}.
Rules: made up only: no real company, game, shop, bank or app names (say "Game Support", "the bank", "Piggy Bank", "the parcel company"); no web addresses or phone numbers ("this link" is fine); nothing scary or unkind; each line under 120 characters.
${avoid.length ? `Make it different from these: ${avoid.slice(-6).join("; ")}.\n` : ""}Reply in JSON: {"kind": "text" or "call", "lines": [3 lines], "tells": [the signs you used], "idea": "the scam in 4 words"}.`;
}
/** a checked scene (the shape scams.js plays), or { problems } */
export function checkScene(j, who, now = Date.now()) {
  const problems = [];
  if (!j || typeof j !== "object") return { problems: ["no JSON"] };
  const lines = (Array.isArray(j.lines) ? j.lines : []).slice(0, 3).map((l) => okLine(l, 150));
  if (lines.length !== 3) problems.push("not 3 lines");
  if (lines.some((l) => !l)) problems.push("a line too long, unkind, or with something real in it");
  const tells = lines.every(Boolean) ? tellsIn(lines, Array.isArray(j.tells) ? j.tells : []) : [];
  if (tells.length < 3) problems.push(`only ${tells.length} warning signs a kid can find in it`);
  if (problems.length) return { problems };
  return { scene: { id: `gen-${now.toString(36)}`, who, kind: j.kind === "call" ? "call" : "text", tells, lines: { [who]: lines }, gen: true, idea: clip(j.idea, 40) } };
}

// ---- the scam call for the call game (Cocoa in disguise phones Mimi)
const LINE = { type: "string" };
export const CALL_SCHEMA = { type: "object", properties: {
  title: LINE, scammer: { type: "array", items: LINE, minItems: 2, maxItems: 2 }, mimi: LINE,
  hang: LINE, share: LINE, ask: LINE,
  hangSay: LINE, hangLesson: LINE, askSay: LINE, dodge: LINE, shareSay: LINE, shareLesson: LINE, unmask: LINE,
}, required: ["title", "scammer", "mimi", "hang", "share", "ask", "hangSay", "hangLesson", "askSay", "dodge", "shareSay", "shareLesson", "unmask"] };
export function callPrompt(avoid = []) {
  return `Write a new made-up scam phone call for a kids' game that teaches spotting scams (ages 7 to 12). Cocoa (Mochi's buddy) wears a silly disguise and phones Mimi (a sweet sheep), pretending to be someone else, to trick her into giving away a secret (a code, a password) or money (gift cards). Mochi pauses the call and the kid chooses what Mimi does.
Write:
- "title": a few words, e.g. a call from "Pet Shop Prizes";
- "scammer": 2 lines Cocoa says in the call (starting "Ring ring!"), with a rush and the ask;
- "mimi": Mimi unsure what to do (ends with ♡ or "…");
- the three choices, each under 60 characters: "hang": the safe one (hang up, say no, or call back on a real number); "share": giving what he asks (read the code, tell the password, buy the gift cards); "ask": asking him a question first;
- "hangSay": Mimi doing the safe thing; "hangLesson": Mochi saying why it's right, in one short sentence;
- "askSay": Mimi's question; "dodge": Cocoa dodging it, still pushing;
- "shareSay": Mimi starting to give it ("Okay, it's…"); "shareLesson": Mochi's one-sentence lesson after stopping her;
- "unmask": Cocoa taking off the disguise, cheerful ("Busted! It was me, Cocoa!").
Rules: made up only: no real company, game, shop, bank or app names; no web addresses or phone numbers; kind and funny, never scary; each line under 120 characters.
${avoid.length ? `Make it different from these: ${avoid.slice(-6).join("; ")}.\n` : ""}Reply in JSON with exactly those keys.`;
}
/** a checked call (the shape scams.js plays), or { problems } */
export function checkCall(j, now = Date.now(), rnd = Math.random) {
  if (!j || typeof j !== "object") return { problems: ["no JSON"] };
  const problems = [], L = (k, max = 150) => { const v = okLine(j[k], max); if (!v) problems.push(`"${k}" missing, too long, unkind or real`); return v; };
  const scammer = (Array.isArray(j.scammer) ? j.scammer : []).slice(0, 2).map((l) => okLine(l, 150));
  if (scammer.length !== 2 || scammer.some((l) => !l)) problems.push("the scammer's 2 lines");
  const c = { title: L("title", 60), mimi: L("mimi"), options: { hang: L("hang", 70), code: L("share", 70), ask: L("ask", 70) },
    say: { hangSay: L("hangSay"), hangLesson: L("hangLesson"), askSay: L("askSay"), dodge: L("dodge"), codeSay: L("shareSay"), codeLesson: L("shareLesson"), reveal: null }, unmask: L("unmask") };
  if (problems.length) return { problems };
  // the choices have to mean what they say: each one, said by a kid, reads back as itself (scams.js gradeChoice)
  const order = ["hang", "code", "ask"].sort(() => rnd() - 0.5);
  for (const k of ["hang", "code", "ask"]) { const got = gradeChoice(c.options[k], { order }); if (got !== k) problems.push(`the "${k}" choice reads as ${got || "nothing"}`); }
  if (!/\b(?:code|password|pin|gift ?cards?|money|numbers?)\b/i.test(`${scammer.join(" ")} ${c.options.code}`)) problems.push("the trick isn't a code, a password or money");
  if (problems.length) return { problems };
  c.say.reveal = `Here's what I'd do: ${c.options.hang[0].toLowerCase()}${c.options.hang.slice(1).replace(/[.!]?$/, ".")}`;
  return { call: { id: `gencall-${now.toString(36)}`, title: c.title.replace(/^a call from\s+/i, "a call from "), lines: scammer, mimi: c.mimi, options: c.options, order, unmask: c.unmask, say: c.say, gen: true } };
}

/**
 * write one: kind "scene" (who: "mimi" | "cocoa") or "call". { ok, scene | call, by, ms, problems }. Gemini first
 * (router: gemini: true), Gemma when it can't.
 */
export async function writeScam({ llm, kind = "scene", who = "mimi", avoid = [], log = console }) {
  const t0 = Date.now();
  try {
    const r = await llm.chat({ what: "scamskit", gemini: true, schema: kind === "call" ? CALL_SCHEMA : SCENE_SCHEMA, schemaName: kind === "call" ? "call" : "scene",
      user: kind === "call" ? callPrompt(avoid) : scenePrompt(who, avoid), maxTokens: 900, temperature: 0.9, think: false, timeoutMs: 45000 });
    const by = r.provider === "local" ? "Gemma" : /gemini/i.test(`${r.provider} ${r.model}`) ? "Gemini" : r.provider;
    const c = kind === "call" ? checkCall(r.json) : checkScene(r.json, who);
    if (c.problems) return { ok: false, problems: c.problems, by, ms: Date.now() - t0 };
    const x = c.scene || c.call; x.by = by;
    return { ok: true, [kind === "call" ? "call" : "scene"]: x, by, ms: Date.now() - t0 };
  } catch (e) { log.warn && log.warn(`[scams] writing a new ${kind}: ${e.message}`); return { ok: false, problems: [e.message], ms: Date.now() - t0 }; }
}
export { Name };
