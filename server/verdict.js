import { vague } from "./crafter.js";

// "Does it look right?" (Nov 7): when Pip wasn't sure about a prop, Mochi says what Pip thought it looked like and asks.
// Your answer counts: yes confirms it (and he learns the pattern, as if Pip had known it at first sight); no, and he
// asks what to change (a change you describe goes to the workbench as a fix, as before).

const YES = /^(?:(?:oh|omg|aww+|ooh+|hey|haha|lol|mochi)[ ,!.]+)*(?:y(?:es+|eah+|ep+|up+|a+)|sure|of course|it does|it is|it totally does|totally|absolutely|definitely|correct|right|exactly|perfect|great|awesome|amazing|love it|i love it|i like it|nailed it|spot on|100 ?%|(?:it |that |this )?looks? (?:right|good|great|perfect|amazing|awesome|cute|nice|fine|correct|lovely|just like (?:a|an|one|it))|(?:that'?s|that is|it'?s|it is|this is) (?:it|right|perfect|great|correct|exactly it|good|just right|cute|adorable|amazing|awesome|lovely|so cute|really cute|great))\b/;
const NO = /^(?:(?:oh|hmm+|um+|uh+|well|haha|lol|mochi|sorry)[ ,!.]+)*(?:no+|nope|nah|not really|not quite|not at all|not exactly|it doesn'?t|doesn'?t|it does ?n'?t|it'?s not|it is not|that'?s not|that is not|that isn'?t|this is not|it isn'?t|kind of not|not yet|wrong|it looks like an?\b|looks more like)\b/;
const BUT = /\b(but|except|although|though|however)\b/;

/** "yes" | "no" | null for an answer to "does it look right?". A yes with a "but" is a no (there's something to change). */
export function revealVerdict(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t || t.length > 200) return null;
  if (NO.test(t)) return "no";
  if (YES.test(t)) return BUT.test(t) ? "no" : "yes";
  return null;
}

/** What he says when Pip wasn't sure: what Pip thought it looked like, and the question. */
export function unsureLine(name, guess) {
  const g = String(guess || "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim().slice(0, 40).replace(/[.!?]+$/, "");
  const like = g && !vague(g) ? ` Pip thought it looked a bit like ${/^(a|an|the|some)\s/i.test(g) ? g : `a ${g}`}…` : " …I think.";
  return `I made the ${name} you asked for!${like} Does it look right to you?`;
}
