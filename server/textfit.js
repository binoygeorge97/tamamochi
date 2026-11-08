// Words on a prop (Nov 8, Binoy: "what if the user asks for a certain word or letters or numbers on a prop. like for
// example, writing out PNC on the bank … can you use Gemini flash 3.8 or 3.6 to do this and fit it in the right
// spot?"). Three steps, like the workbench (write, draw, check blind):
//   1. where: the prop's flat spots are listed by code (the front of each part, the top of a flat one; how much room;
//      whether something sits in front of it), and Gemini Flash (3.8, then 3.6; Gemma if the cloud is off) picks the
//      one where a person would expect words, and a colour that reads on it, or asks for a little sign;
//   2. fit: code sizes the words to the room, lays them flat on that face (never floating, never off the edge), checks
//      the colour stands out (else dark or white), and puts up a cream sign behind them when the spot is too small;
//   3. check: it's drawn, and Gemini reads it without being told what it should say. If it reads the words back,
//      it's kept; if not, a second try with a bigger sign.
// Only short, kind words: shared/craft.js cleanText (12 characters; no rude words, no phone numbers). Plain letters in
// his own font: never a company's logo.
import { cleanText, validateProp, TEXT_MAX } from "../shared/craft.js";

const r3 = (n) => Math.round(n * 1000) / 1000;
const lum = (hex) => { const n = parseInt(String(hex || "#888888").replace("#", "").padEnd(6, "0").slice(0, 6), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const CHAR = 0.62;   // a rounded bold letter is about this wide for its height
const DARK = "#2b2140", LIGHT = "#ffffff", SIGN = "#fff6df";

// ---- what they asked: "write PNC on the bank", "make the bank say PNC", "put the letters ABC on your car"
const Q = String.raw`"[^"]{1,24}"|“[^”]{1,24}”|'[^']{1,24}'`;
const THE = String.raw`(?:the|your|my|his|this|that|a|an)\s+`;
const MARK = String.raw`(?:(?:the\s+)?(?:words?|letters?|numbers?|name|text|initials)\s+)`;
const TARGET = String.raw`([a-z][a-z' \-]{0,32}?)`;
const END = String.raw`\s*(?:please|for me|now)?\s*[.!?]*\s*$`;
const RES = [
  new RegExp(String.raw`\b(?:write|print|spell(?:\s+out)?|engrave|letter)\s+(?:out\s+)?${MARK}?(${Q}|\S.{0,22}?)\s+(?:on|onto|across)\s+(?:${THE})?${TARGET}${END}`, "i"),
  new RegExp(String.raw`\b(?:put|paint|add|stick|draw)\s+${MARK}(${Q}|\S.{0,22}?)\s+(?:on|onto|across|to)\s+(?:${THE})?${TARGET}${END}`, "i"),
  new RegExp(String.raw`\b(?:put|paint|add|stick|draw)\s+(${Q})\s+(?:on|onto|across|to)\s+(?:${THE})?${TARGET}${END}`, "i"),
];
const SAY = new RegExp(String.raw`\b(?:make|have|let)\s+(?:the|your|my|his|this|that)\s+${TARGET}\s+(?:say|read|spell)\s+(${Q}|\S.{0,22}?)${END}`, "i");
const unq = (s) => String(s || "").trim().replace(/^["“']|["”']$/g, "").trim();
/** null, or { text, target, raw }: text already cleaned (null when it can't be written: too long, unkind) */
export function textIntent(input) {
  const t = String(input || "").replace(/[’`]/g, "'").trim();
  if (!t || t.length > 160) return null;
  let raw = null, target = null;
  for (const re of RES) { const m = re.exec(t); if (m) { raw = unq(m[1]); target = m[2]; break; } }
  if (!raw) { const m = SAY.exec(t); if (m) { target = m[1]; raw = unq(m[2]); } }
  if (!raw || !target) return null;
  target = target.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(?:paper|board|wall|screen|chat|note|card|letter|page)$/.test(target)) return null;   // (writing on paper: not a prop)
  if (/^(?:a |an )?(?:story|poem|song|letter|note|list|essay)\b/i.test(raw)) return null;
  const mine = /^(?:your|his) name$/i.test(raw) ? "MOCHI" : null;
  return { raw, text: mine || cleanText(raw), target, askName: /^my name$/i.test(raw) };
}

// ---- where words could go: the front of each part (and the top of a flat one), with how much room
const ROOM = {   // the share of a part's front that's flat enough for words: [width, height], and how far in front it sits
  box: [0.86, 0.72, 1], wedge: [0.5, 0.4, 1], cylinder: [0.6, 0.7, 1], coin: [0.64, 0.42, 1], sphere: [0.52, 0.3, 0.94], capsule: [0.5, 0.5, 1],
  star: [0.42, 0.24, 1], heart: [0.46, 0.26, 1], cloud: [0.6, 0.34, 1], leaf: [0.34, 0.3, 1], dome: [0.5, 0.26, 0.9], cone: [0.34, 0.26, 0.6],
};
const flat0 = (p) => !(p.rotate || []).some((d) => Math.abs(d) > 2);
const overlap = (c1, s1, c2, s2) => Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
const small = (q) => q.size[0] * q.size[1] < 0.012;   // a little decoration (a star on a label, a knob)
export function spots(recipe) {
  const parts = (recipe && recipe.parts) || [], out = [];
  const front = (p) => p.at[2] + p.size[2] / 2;
  parts.forEach((p, i) => {
    if (p.shape === "text" || !flat0(p) || !ROOM[p.shape]) return;
    const [w, h, d] = p.size, [kw, kh, kz] = ROOM[p.shape];
    const fw = w * kw, fh = h * kh, z = p.at[2] + (d / 2) * kz, cy = p.at[1] - (p.shape === "wedge" ? h * 0.18 : 0);
    // covered: another part in front of the middle of this face
    // covered: the share of this face that bigger parts in front of it hide (the bank's columns hide its wall); little
    // decorations sitting on it (a star on a label) don't count: fitText takes them off under the words
    const hidden = parts.reduce((sum, q, j) => (j === i || q.shape === "text" || !(front(q) > z + 0.005 && q.at[2] - q.size[2] / 2 < z + 0.6) || small(q) ? sum
      : sum + overlap(q.at[0], q.size[0], p.at[0], fw) * overlap(q.at[1], q.size[1], cy, fh)), 0);
    const blocked = hidden > 0.2 * fw * fh;
    // in front of whatever covers it: where a sign has to stand to be seen (in front of the bank's columns)
    const clear = blocked ? Math.max(z, ...parts.filter((q, j) => j !== i && q.shape !== "text" && front(q) > z && overlap(q.at[0], q.size[0], p.at[0], fw) > 0 && overlap(q.at[1], q.size[1], cy, fh) > 0).map(front)) : z;
    out.push({ i, label: p.label || `${p.shape} ${i + 1}`, side: "front", color: p.color, w: r3(fw), h: r3(fh), at: [p.at[0], cy, z], blocked, clear: r3(clear) });
    if ((p.shape === "box" || p.shape === "disc" || (p.shape === "cylinder" && !p.hollow)) && h < 0.35 * Math.min(w, d)) {   // the top of something flat (a tray, a table)
      const y = p.at[1] + h / 2, under = parts.some((q, j) => j !== i && q.shape !== "text" && q.at[1] - q.size[1] / 2 > y - 0.03 && Math.abs(q.at[0] - p.at[0]) < (q.size[0] + w * 0.5) / 2 && Math.abs(q.at[2] - p.at[2]) < (q.size[2] + d * 0.4) / 2);
      if (!under) out.push({ i, label: p.label || `${p.shape} ${i + 1}`, side: "top", color: p.color, w: r3(w * 0.8), h: r3(d * 0.6), at: [p.at[0], y, p.at[2]], blocked: false });   // (not under something: the bank's ledge is under its roof)
    }
  });
  return out.map((s, n) => ({ n: n + 1, ...s }));
}
/** words of `len` letters in a w × h room: [width, height] */
export function wordSize(len, w, h) { const th = Math.min(h, w / (CHAR * Math.max(1, len))); return [r3(th * CHAR * Math.max(1, len)), r3(th)]; }
const bounds = (parts) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const p of parts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.at[k] - p.size[k] / 2); hi[k] = Math.max(hi[k], p.at[k] + p.size[k] / 2); } return { lo, hi, big: Math.max(...hi.map((v, k) => v - lo[k])) }; };
const readable = (color, on) => (/^#[0-9a-f]{6}$/i.test(color || "") && Math.abs(lum(color) - lum(on)) >= 0.38 ? color : lum(on) > 0.5 ? DARK : LIGHT);
/**
 * the prop with the words on it: { recipe, sign } (sign: a cream plate was put up behind them). `spot` from spots();
 * `sign`: true to use a plate; `grow`: a bigger plate (the second try). Words go first in the parts, so a prop at its
 * part limit drops its last decoration rather than the words.
 */
export function fitText(recipe, spot, text, { color = null, sign = false, grow = 1 } = {}) {
  const parts = recipe.parts.filter((p) => p.label !== "words" && p.label !== "word sign"), B = bounds(parts), len = text.length;
  const minH = 0.075 * B.big;   // smaller than this, nobody can read it at his size
  let [tw, th] = wordSize(len, spot.w, spot.h);
  const useSign = sign || spot.blocked || th < minH || grow > 1;
  const top = spot.side === "top", add = [];
  if (!useSign) {
    const z = spot.at[2] + 0.004;
    add.push({ shape: "text", text, size: [tw, th, 0.01], at: top ? [spot.at[0], spot.at[1] + 0.004, spot.at[2]] : [spot.at[0], spot.at[1], z], rotate: top ? [-90, 0, 0] : [0, 0, 0], color: readable(color, spot.color), material: "plastic", label: "words" });
  } else {
    const H = Math.min(0.2, Math.max(minH, 0.14 * B.big)) * grow, maxW = 0.9 * B.big;   // (big enough to read beside him on stage)
    [tw, th] = wordSize(len, maxW, H);
    const pw = r3(tw + th * 0.9), ph = r3(th * 1.6), pd = 0.03;
    const at = top ? [spot.at[0], spot.at[1] + pd / 2, spot.at[2]] : [spot.at[0], spot.at[1], r3((spot.clear ?? spot.at[2]) + pd / 2 - 0.004)];
    add.push({ shape: "box", size: [pw, ph, pd], at, rotate: top ? [-90, 0, 0] : [0, 0, 0], color: SIGN, material: "wood", round: 0.3, label: "word sign" });
    add.push({ shape: "text", text, size: [tw, th, 0.01], at: top ? [at[0], at[1] + pd / 2 + 0.003, at[2]] : [at[0], at[1], r3(at[2] + pd / 2 + 0.001)], rotate: top ? [-90, 0, 0] : [0, 0, 0], color: readable(color, SIGN), material: "plastic", label: "words" });
  }
  // little decorations right under the words come off (the star on the jar's label)
  // (straight on the face only: a sign stands in front of everything; "on it" = its back within 0.02 of the face, smaller
  // than a quarter of the face: the lemon on the stand's sign, the star on the jar's label; never the bank's columns)
  const T = add[add.length - 1], face = spot.w * spot.h, under = (q) => !useSign && !top && q !== parts[spot.i] && q.size[0] * q.size[1] < Math.max(0.012, 0.25 * face)
    && Math.abs((q.at[2] - q.size[2] / 2) - spot.at[2]) < 0.02 && overlap(q.at[0], q.size[0], T.at[0], T.size[0]) > 0 && overlap(q.at[1], q.size[1], T.at[1], T.size[1]) > 0;
  const kept = parts.filter((q) => !under(q));
  const out = { ...recipe, parts: [...add, ...kept] };
  const v = validateProp(out);
  return { recipe: v.ok ? v.recipe : out, sign: useSign, warnings: v.warnings };
}
/** did they read it back? (letters and numbers only, any case) */
export function readsAs(answer, text) {
  const k = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const a = k(answer), t = k(text);
  return !!t && a.includes(t);
}

export const SPOT_SCHEMA = { type: "object", properties: { spot: { type: "integer" }, sign: { type: "boolean" }, color: { type: "string" }, why: { type: "string" } }, required: ["spot", "sign", "color"] };
export const READ_SCHEMA = { type: "object", properties: { text: { type: "string" }, sure: { type: "number" } }, required: ["text"] };
export function spotPrompt(recipe, text, list) {
  const parts = recipe.parts.filter((p) => p.shape !== "text").map((p, i) => `- ${p.label || p.shape} (${p.shape}, ${p.color}) at [${p.at.map(r3).join(", ")}], size [${p.size.map(r3).join(", ")}]`).join("\n");
  const sp = list.map((s) => `${s.n}. the ${s.side} of the "${s.label}" (${s.color}): room for words ${s.w} wide × ${s.h} tall${s.blocked ? " (something sits in front of it)" : ""}`).join("\n");
  return `A child asked Mochi (a cute 3D toy sheep) to write "${text}" on his toy "${recipe.name}". The toy is made of these parts (x to the right, y up, z toward the viewer; sizes are width, height, depth):
${parts}

Flat spots where the words could go:
${sp}

Pick the spot where a person would expect to see words on a real ${recipe.name}: a sign, a label, a band over a door, the front of a building, a flag or banner, the side of a car, the lid of a box. It should face the viewer, be big enough to read, and not be covered. If the best place is too small to read, set "sign": true and Mochi will put up a little sign there. Pick a colour for the letters that stands out on that part's colour, as "#rrggbb". Answer in JSON: {"spot": number, "sign": true or false, "color": "#rrggbb", "why": "a few words"}.`;
}
export const READ_PROMPT = "This picture shows a small toy on a plain background. Are any letters, words or numbers written on it? Answer in JSON: {\"text\": exactly what is written (\"\" if nothing is written), \"sure\": 0 to 1}.";

/**
 * write `text` on `recipe`: { ok, recipe, spot, sign, by, read, readAs, tries, ms }. llm: the router (chat); renderer:
 * the prop drawer (null: no check); both optional (tests).
 */
export async function writeOn(recipe, text, { llm = null, renderer = null, log = console } = {}) {
  const t0 = Date.now(), list = spots(recipe);
  if (!list.length) return { ok: false, why: "nowhere flat to write on" };
  const B = bounds(recipe.parts.filter((p) => p.shape !== "text"));
  // the code's own guess (biggest uncovered front that faces the viewer): the floor when no model answers
  const SIGNISH = /sign|label|plate|banner|flag|screen|board|band|ledge|frieze|front|body|building|tag|box|wallet|sail|hull|trunk|card/;
  const score = (x) => wordSize(text.length, x.w, x.h)[1] * (x.blocked ? 0.3 : 1) * (SIGNISH.test(x.label) ? 2 : 1) * (x.side === "front" ? 1 : 0.5) * (/knob|button|eye|nostril|cheek|ear|leg|foot|wheel|handle/.test(x.label) ? 0.2 : 1);
  const guess = [...list].sort((a, b) => score(b) - score(a))[0];
  let pick = { spot: guess, sign: false, color: null }, by = "code";
  if (llm) {
    try {
      const r = await llm.chat({ what: "textspot", schema: SPOT_SCHEMA, schemaName: "spot", maxTokens: 120, temperature: 0.2, think: false, user: spotPrompt(recipe, text, list) });
      const j = r.json || {}, s = list.find((x) => x.n === Number(j.spot));
      if (s) { pick = { spot: s, sign: j.sign === true, color: typeof j.color === "string" ? j.color.trim() : null }; by = r.provider === "local" ? "Gemma" : r.model || r.provider; }
    } catch (e) { log.warn(`[words] where: ${e.message}`); }
  }
  let tries = 0, best = null;
  for (const grow of [1, 1.35]) {
    tries++;
    const f = fitText(recipe, pick.spot, text, { color: pick.color, sign: pick.sign || grow > 1, grow });
    let read = null, readAs = null;
    if (renderer && llm) {
      try {
        const rr = await renderer.render(f.recipe, { size: 420, views: ["front"], standIn: false, hand: false });
        if (rr && rr.ok && rr.dataUrl) {
          const a = await llm.chat({ what: "textread", images: [rr.dataUrl], schema: READ_SCHEMA, schemaName: "read", maxTokens: 40, temperature: 0, think: false, user: READ_PROMPT });
          readAs = String((a.json && a.json.text) || a.text || "").slice(0, 40); read = readsAs(readAs, text);
        }
      } catch (e) { log.warn(`[words] check: ${e.message}`); }
    }
    best = { ok: true, recipe: f.recipe, spot: pick.spot, sign: f.sign, by, read, readAs, tries, ms: Date.now() - t0, big: B.big };
    if (read !== false) break;   // read back (or no check possible): done
  }
  return best;
}
export { TEXT_MAX };
