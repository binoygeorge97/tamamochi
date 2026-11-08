// Hints about his friends (Nov 7, Binoy: "the more realistic response would be for mochi to confirm for himself if
// this is true by asking them"). "I think Mimi wants a piggyback ride", "Cocoa is looking at your food and wants
// some", "Mimi looks hungry": not an order but a guess about what a friend wants. So Mochi asks them ("Mimi, do you
// want a piggyback ride?"), they answer in their own voice, and only a yes leads to it. A plain request ("give Mimi a
// piggyback ride", "share your cookie with Cocoa") still happens at once, as before.
// They say no only when it makes sense: a piggyback ride or a snack they had in the last few minutes.
// Pure: index.js finds the hint, keeps when each friend last had one, and plays the yes; the page plays the asking.

const FRIEND = /\b(mimi|cocoa)\b/;
const NOT = /\b(?:don'?t|doesn'?t|do not|does not|never|stop|no more|isn'?t|is not|not hungry|full)\b/;
// he is told to, or asked: that's a request, not a hint (it goes the usual way)
const ORDER = /^(?:(?:ok(?:ay)?|hey|so|now|mochi|please)[,!]?\s+)*(?:give|share|let|carry|offer|hand|feed|can you|could you|will you|would you|why don'?t you|you should|go)\b|\b(?:can|could|will|would) you\b|\byou should\b|\blet'?s\b/;
// the friend wanting, looking, seeming: a guess about them
const GUESS = /\b(?:i think|i bet|i guess|i feel like|maybe|perhaps|probably|apparently|looks like|seems like|it seems)\b|\b(?:mimi|cocoa)\s+(?:said|says|told me)\b|\b(?:mimi|cocoa)\s+(?:really\s+|totally\s+|kinda\s+|kind of\s+|so\s+)?(?:wants?|would (?:like|love)|wanna|needs?|might want|could use|is (?:looking|staring|eyeing|drooling|hungry|starving|dying)|looks|seems|keeps (?:looking|staring|eyeing))\b/;
const PIGGY = /\bpigg(?:y|ie)[ -]?back\b|\bshoulder ride\b|\bride on (?:your|his|mochi'?s) (?:back|shoulders)\b|\bcarr(?:y|ied) on (?:your|his) back\b/;
const FOOD_WORDS = "food|snack|snacks|treat|treats|lunch|dinner|breakfast|cookie|cookies|cake|cupcake|pizza|apple|popcorn|ice cream|soup|sandwich|candy|lollipop|donut|doughnut|cocoa|tea|bite|piece|taste|some";
const HUNGRY = new RegExp(String.raw`\b(?:hungry|starving|peckish|drooling|eyeing|staring at (?:your|his|the|that)|looking at (?:your|his|the|that) (?:${FOOD_WORDS})|wants? (?:some|a bite|a piece|a taste|one|your (?:${FOOD_WORDS})|some of your)|would (?:like|love) (?:some|a bite|a piece|a taste|one)|could use a snack)\b`);

/** { who: "mimi" | "cocoa", want: "piggy" | "food", thing: a food they named or null } | null */
export function hintIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  if (!t || t.length > 200 || ORDER.test(t)) return null;
  const f = FRIEND.exec(t);
  if (!f || !GUESS.test(t)) return null;
  const subj = /\b(mimi|cocoa)\s+(?:really\s+|totally\s+|so\s+)?(?:wants?|would|wanna|needs?|might|could|is|looks|seems|keeps)\b/.exec(t);
  const who = subj ? subj[1] : f[1];   // (the one who wants it, if both are named)
  if (PIGGY.test(t)) return NOT.test(t) ? null : { who, want: "piggy", thing: null };
  if (HUNGRY.test(t) && !/\bcocoa\b.*\bhot cocoa\b/.test(t)) {
    if (/\b(?:isn'?t|is not|not|never|doesn'?t|don'?t) (?:hungry|want)/.test(t)) return null;
    const m = new RegExp(String.raw`\b(?:your|his|the|that|some of your|a bite of your|a piece of your)\s+((?:[a-z]+\s+)?(?:${FOOD_WORDS.split("|").filter((w) => !/^(?:food|snack|snacks|treat|treats|bite|piece|taste|some)$/.test(w)).join("|")}))\b`).exec(t);
    return { who, want: "food", thing: m ? m[1].trim() : null };
  }
  return null;
}

const NAME = { mimi: "Mimi", cocoa: "Cocoa" };
const LINES = {
  ask: {
    piggy: { mimi: ["Mimi, do you want a piggyback ride?", "Hey Mimi, want a ride on my back?"], cocoa: ["Cocoa, do you want a piggyback ride?", "Hey buddy, want a ride on my back?"] },
    food: { mimi: ["Mimi, are you hungry? Want some of my {food}?", "Mimi, would you like some {food}?"], cocoa: ["Cocoa, do you want some of my {food}?", "Hey buddy, want some {food}?"] },
  },
  yes: {
    piggy: { mimi: ["Yes please! Hehe!", "Ooh, yes! Can I?"], cocoa: ["Heck yeah, dude!", "Yes! Giddy-up, buddy!"] },
    food: { mimi: ["Mm-hmm… just a little bite?", "Yes please! It looks so yummy!"], cocoa: ["Dude… yes. Yes I do.", "You read my mind, buddy!"] },
  },
  no: {
    piggy: { mimi: ["Hehe, I just had one! Maybe later, Mochi.", "Aww, thank you, but I'm okay for now!"], cocoa: ["Nah, I'm good, dude. Just had one!", "Maybe later, buddy. My legs work fine!"] },
    food: { mimi: ["No thank you, I'm full! That last bite was yummy.", "I'm okay, Mochi, I just had some!"], cocoa: ["I'm stuffed, buddy. Maybe later!", "Nah, dude, I just ate. Thanks though!"] },
  },
};
export const RECENT_MS = 4 * 60 * 1000;
const pick = (list, r) => list[Math.floor(r() * list.length) % list.length];

/** What happens: { who, want, yes, ask, answer, why } (why: "just had one" when it's a no).
 * last: { piggy: { mimi: ms, cocoa: ms }, food: { … } } when each last had one; food: the name of what he'd share. */
export function hintPlan(h, { last = {}, food = null, now = Date.now(), r = Math.random } = {}) {
  if (!h || !NAME[h.who] || !LINES.ask[h.want]) return null;
  const had = ((last[h.want] || {})[h.who] || 0), yes = !(had && now - had < RECENT_MS);
  const ask = pick(LINES.ask[h.want][h.who], r).replace("{food}", food || "snack");
  const answer = pick(LINES[yes ? "yes" : "no"][h.want][h.who], r);
  return { who: h.who, want: h.want, yes, ask, answer, ...(yes ? {} : { why: h.want === "piggy" ? "just had a piggyback ride" : "just had a snack" }), ...(food ? { food } : {}) };
}

/** what the brain is told ("you" is Mochi) */
export function hintNote(p) {
  if (!p) return "";
  const N = NAME[p.who], she = p.who === "mimi" ? "she" : "he", her = p.who === "mimi" ? "her" : "him";
  const did = p.want === "piggy"
    ? (p.yes ? `${she} said yes ("${p.answer}") and hopped onto your back: you're carrying ${her} about${p.who === "cocoa" ? " (he's a bit heavy!)" : ""}` : `${she} said no ("${p.answer}"): ${she} ${p.why}`)
    : (p.yes ? `${she} said yes ("${p.answer}"), so you held out your ${p.food || "snack"} and ${she} took some and ate it up` : `${she} said no ("${p.answer}"): ${she} ${p.why}`);
  return `\nOn screen just now: they guessed ${N} wanted ${p.want === "piggy" ? "a piggyback ride" : "some of your food"}, so you asked ${her}, "${p.ask}", and ${did}. All of that already happened on screen, and ${N}'s answer was heard: your reply comes after it. Don't ask ${her} again and don't say ${N}'s line for ${her}; react to what's happening now (${p.yes ? (p.want === "piggy" ? `"Hold on tight! Wheee!"` : `"Here you go! Yummy, right?"`) : `"Okay, maybe later then!"`}), short and warm${p.yes ? "" : `, and be fine with ${p.who === "mimi" ? "her" : "his"} answer`}.`;
}

// Nov 7 (Binoy, on the M5: his reply asked "Hey Mimi, want a ride on my back?" again, and Mimi said yes twice): Gemma
// sometimes replays the question and the answer anyway. His reply loses any question to the friend about it, and the
// friend's own lines in it (their answer was already heard); if nothing's left, a short line that follows on.
const ASKED_AGAIN = /\?\s*$/;
export function hintClean(text, p) {
  if (!p) return String(text || "");
  const N = NAME[p.who].toLowerCase(), about = p.want === "piggy" ? /\b(?:ride|piggy|back|carry|hop on|climb)\b/i : /\b(?:some|bite|hungry|want|share|snack|food|cookie|have one|try)\b/i;
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const answerRe = new RegExp(`(?:${NAME[p.who]}\\s*:\\s*)?["“]?${esc(p.answer.replace(/[\s♡]+$/, ""))}["”]?\\s*♡?`, "gi");
  const parts = String(text || "").replace(answerRe, " ").replace(/\s{2,}/g, " ").trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
  const kept = parts.filter((s) => {
    const low = s.toLowerCase();
    if (ASKED_AGAIN.test(s) && (low.includes(N) || /\b(?:buddy|dude|you)\b/.test(low)) && about.test(s)) return false;   // the question, again
    if (low.includes(p.ask.toLowerCase().replace(/[?!.]+$/, "")) || low.includes(p.answer.toLowerCase().replace(/[?!.♡]+$/, "").trim())) return false;
    return true;
  });
  const out = kept.join(" ").trim();
  if (out) return out;
  return p.yes ? (p.want === "piggy" ? (p.who === "mimi" ? "Hold on tight, Mimi! Wheee!" : "Oof! Hold on, buddy! Here we go!") : (p.who === "mimi" ? "Here you go, Mimi! Yummy, right?" : "Here you go, buddy! Good, huh?")) : "Okay, maybe later then!";
}
