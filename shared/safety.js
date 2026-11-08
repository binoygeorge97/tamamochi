// Deterministic crisis check. Runs on every message, in the page and on the server, BEFORE any model.
// When it fires: concerned face, no sulk, no taught phrases, no cheerful follow-ups, reply points to real help.
//
// *** STAND-IN. Replace this file with shared/safety.js from mochi-app-fixed.zip (the reviewed rule, see
// claude/feelings-review.md) and keep the last CRISIS entry below, which that version was missing. ***
// No regex lookbehind anywhere: the page imports this and older Safari can't parse it.

// Jokes and idioms that contain crisis words. They are cut out of the line before matching, so "I want to die for
// real" still fires (the "to die for" is removed and "i want  real" doesn't match, but the plain patterns below
// see the rest of the message) while "this cake is to die for" doesn't.
const JOKES = [
  /\bto\s+die\s+for\b(?!\s*(real|fr|frfr|seriously|honestly|sure|truly|actually)\b)/g,   // "the cake is to die for" yes; "i want to die for real" no /\bdying\s+(of|from)\s+(laughter|laughing|boredom|cringe|embarrassment)\b/g, /\bi'?m\s+dying\s*(lol|lmao|😂|haha)/g,
  /\bkill(ed|ing)?\s+(it|me|time|the\s+(vibe|mood|game|lights))\b/g, /\bdead\s+(tired|serious|inside\s+lol|lol|😂)\b/g, /\bdead\s+ass\b/g,
  /\bthat\s+killed\s+me\b/g, /\bi\s+could\s+(just\s+)?die\s+(of\s+)?(embarrassment|shame|cringe)\b/g,
];
// Harmless phrases each exclusion is for are named in the comment. Keep exclusions this narrow.
const EXCLUDE = [
  /\bend\s+(it|things)\s+with\s+(him|her|them|my\s+(bf|gf|boyfriend|girlfriend|partner|ex))\b/,   // breakups
  /\bcan'?t\s+go\s+on\s+(stage|camera|air|tour|the\s+trip|holiday|vacation)\b/,                   // stage fright, trips
  /\b(cut|burn(ed|t)?|hurt)\s+my(self)?\s+(finger|hand|arm|leg|thumb)\s+(while|when|on|with)\s+(cooking|shaving|the\s+(stove|oven|knife|pan)|at\s+the\s+gym)\b/,   // kitchen, shaving, gym
  /\bkill(ed|ing)?\s+(my|the)\s+(workout|set|deadline|exam|test|presentation|interview)\b/,         // "killed my interview" = did well/badly
];
export const CRISIS = [
  // The first six are the direct ones; order matters for the tests in the app. Append new patterns at the END.
  /\b(kill|hurt|harm|cut|end)\s+myself\b/,
  /\b(suicid(e|al)|self[\s-]?harm(ing)?)\b/,
  /\b(want|wanna|wish|going|gonna|plan(ning)?|ready|decided)\s+to\s+(die|be\s+dead|disappear\s+forever|end\s+(it|my\s+life|everything|it\s+all)|not\s+(exist|wake\s+up|be\s+here(\s+anymore)?))\b/,
  /\b(i|everyone|everybody|they|you)('?d|\s+would)\s+be\s+better\s+off\s+(without\s+me|if\s+i\s+(was|were)\s+(dead|gone))\b/,
  /\b(don'?t|do\s+not)\s+(want|wanna)\s+to\s+(be\s+(here|alive)|live|exist|wake\s+up)(\s+anymore|\s+any\s*more)?\b/,
  /\b(life\s+(isn'?t|is\s+not|ain'?t)\s+worth\s+(living|it)|no\s+reason\s+to\s+(live|go\s+on|keep\s+going)|(nothing|no\s+point)\s+(to\s+live\s+for|in\s+living))\b/,
  // more ways of saying it (feelings-review.md: missed methods/acts, typos)
  /\b(overdose|od)\s+on\b|\btake\s+(all\s+)?(the|my|these)\s+pills\b|\bjump\s+off\s+(a|the)\s+(bridge|building|roof)\b|\b(hang|shoot|drown)\s+myself\b/,
  /\b(wish|hope)\s+i\s+(was|were|wasn'?t)\s+(dead|never\s+born|alive)\b|\bwish\s+i\s+(could\s+)?(just\s+)?(disappear|vanish|stop\s+existing)\b/,
  /\bnobody\s+would\s+(even\s+)?(notice|care|miss\s+me)\s+if\s+i\s+(was\s+gone|disappeared|died|left)\b/,
  /\b(sui?cidal|suicdal|suicied|kil\s+myself|kms)\b/,
  // handoff doc: "i just don't see the point in going on". Keep LAST.
  /\b(don.?t|do\s+not|can.?t|cannot)\s+see\s+(the\s+|any\s+)?point\s+(in|of)\s+(living|being\s+alive|being\s+here|carrying\s+on|going\s+on(\s*$|\s*[.,!?…]|\s+(like\s+this|anymore|any\s*more)))/,
];

export function isCrisis(raw) {
  let t = String(raw || "").toLowerCase().replace(/[’‘]/g, "'");
  if (!t.trim()) return false;
  for (const j of JOKES) t = t.replace(j, " ");
  for (const x of EXCLUDE) if (x.test(t)) return false;
  return CRISIS.some((re) => re.test(t));
}

// The reply when the rule fires. Plain words, no cute effects. (US line; swap for the venue's country.)
export const CRISIS_REPLY = "I'm really glad you told me, and I'm staying right here with you. What you're feeling matters. Please reach out to someone who can help right now: in the US you can call or text 988 (the Suicide and Crisis Lifeline), any time. If you're somewhere else, tell me where and I'll find the number. Do you want to tell me what's been happening?";
