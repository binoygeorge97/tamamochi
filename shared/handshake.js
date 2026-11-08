/* The secret handshake as data, shared by the kit (kit/src/handshake.js plays it) and the server (keeps it, tells the
 * brain about it). Gestures, named as you see him: L / R a tap on the hoof on your left / right, LS / RS a swipe
 * across that hoof (a slide), H a tap or stroke on his head, T a tap on his tummy. A handshake is [{ g, dt }]: dt is
 * the seconds since the step before, so he keeps your rhythm. */
export const HS_GESTURES = ["L", "R", "LS", "RS", "H", "T"];
export const HS_NAMES = { L: "left hoof", R: "right hoof", LS: "slide on the left hoof", RS: "slide on the right hoof", H: "head", T: "tummy" };
export const HS_MAX = 8;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** made safe: 2–8 known gestures, each 0.15–2 s after the last */
export function cleanHandshake(steps) {
  if (!Array.isArray(steps)) return null;
  const out = steps.slice(0, HS_MAX).filter((s) => s && HS_GESTURES.includes(s.g)).map((s, i) => ({ g: s.g, dt: i === 0 ? 0 : Math.round(clamp(+s.dt || 0.5, 0.15, 2) * 100) / 100 }));
  return out.length >= 2 ? out : null;
}
export const describeHandshake = (steps) => (steps || []).map((s) => HS_NAMES[s.g]).join(", then ");

/** "let's do our handshake" → "offer"; "let's make a secret handshake" → "teach"; else null */
export function handshakeIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!/\bhand ?shakes?\b|\bhandshake\b/.test(t)) return null;
  if (/(?<!why )\b(don'?t|do not|stop|no more|never|not now)\b/.test(t)) return null;
  if (/\b(teach|make|new|learn|create|invent|come up with|show you|change|another)\b/.test(t)) return "teach";
  if (/\b(do|let'?s|lets|our|wanna|want to|ready|time for|remember|again|secret|can we|shall we)\b/.test(t) || /^\W*(secret )?hand ?shake\W*$/.test(t)) return "offer";
  return null;
}

/* The other thing he learns by touch (Nov 4, Binoy: say it instead of pressing "Teach a move"): "I want to teach you a
 * cool move", "Mochi, want to learn a new move?", "let me show you a dance" → true, and the page opens the posing
 * lesson. A move with a name ("learn the moonwalk") is for the workbench, "teach me a move" is the other way round,
 * "teach Mimi the twirl" is his lesson for her, and a handshake has its own lesson. */
const THING = "(?:(?:a|an|some|my|one|another|this|cool|new|fun|little|awesome|funny|silly|special|secret|great|super|fancy|neat|dance|dancing|easy)\\s+)*(?:moves?|dances?|dance moves?|tricks?|poses?|steps?)\\b";
const TEACH_MOVE = new RegExp(`\\b(?:teach|show)(?:ing)?\\s+(?:you\\s+|ya\\s+|mochi\\s+)?${THING}|\\blearn(?:ing)?\\s+${THING}|\\bteach (?:you|mochi) (?:how )?to dance\\b`);
export function teachMoveIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (/\bhand ?shakes?\b|\b(mimi|cocoa)\b/.test(t)) return false;
  if (/\b(don'?t|do not|stop|no more|never|not now|no thanks)\b/.test(t)) return false;
  if (/\b(teach|show)(?:ing)? (me|us|them|him|her)\b|\b(make|invent|come up with|create|think of)\b/.test(t)) return false;
  return TEACH_MOVE.test(t);
}
