// His activity book on the server (Nov 3): what you asked for → an entry (shared/activity-book.js) → a timed routine the
// kit plays (kind "routine"). Anything not in the book, Gemma improvises from the same pieces, and he remembers it.
import { BOOK, BOOK_BY_ID, CATEGORIES } from "../shared/activity-book.js";
import { JOB_WORDS, jobOf } from "../shared/jobs.js";
import { MOTIONS, MOTION_NAMES } from "../shared/motions.js";
import { PROP_EXAMPLES, ARCHETYPES } from "../shared/craft.js";

const POCKET = Object.values(PROP_EXAMPLES).flat();
const pocket = (name) => POCKET.find((e) => e.name === name) || null;
const asProp = (p) => p && { id: p.id || null, name: p.name, archetype: p.archetype, recipe: p.recipe || p };
export const FX = ["heart", "star", "confetti", "coin", "snow", "z", "bang", "orbit", "huff", "note"];
export const SOUNDS = ["guitar", "drums", "piano", "sing", "trumpet", "maracas", "beat", "chime", "splash", "boing", "whoosh", "cheer", "swish", "pock", "strike", "bleeps", "click", "knock", "sizzle", "ding", "munch", "hmm", "coins", "crackle", "heartbeat", "trumpetFanfare", "rimshot", "brush", "party", "pop"];
const FACES = ["happy", "excited", "superexcited", "proud", "shy", "laugh", "love", "thinking", "surprised", "showoff", "sleepy", "oops"];
const ROLES = ["hello", "showoff", "cheer", "dance", "comfort", "giggle", "huddle", "play", "ready"];

// ---- asking for it ----
const norm = (s) => String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
// asked: a request, an invitation, or the activity's own verb first ("sing!", "go fishing", "read me a story")
const ASK = /\b(?:can you|could you|will you|would you|can we|could we|shall we|should we|we should|you should|wanna|want to|do you want to|d'?you wanna|let'?s|lets|please|show me|show us|try|time to|time for|how about|what about|i want you to|i'd like you to|i'd love (?:it if you|you to)|why don'?t you|why not|go on|teach me|i dare you|it'?s time)\b/;
const VERB_FIRST = /^(?:(?:ok(?:ay)?|hey|so|now|mochi|yay|ooh|alright)[,!]?\s+)*(?:play|sing|do|go|read|cook|bake|make|eat|drink|have|take|brush|clean|tidy|build|fly|blow|plant|water|catch|kick|shoot|swim|stretch|meditate|write|tell|be|pretend|try|show|give|count|look|explore|march|hula|spin|bow|salute|race|hide|chase|camp|fish|garden|pitch|open|unwrap|set off|light|raise|toot|strum|bang|shake|conduct|listen|watch|put on|measure|investigate|solve|hammer|fix|dust|sweep|meditate|celebrate|chill|jump|hop|skip|dance|rock|beatbox|drop|cast|slay|save|blast|check|surprise|use|toss|throw|ride|bowl|kick|shoot|act|find|dig|search|roast|wash|blast|judge|rate|grade|score|dress|put on)\b/;
// them, not him: "I went swimming", "we had a picnic", "my mom bakes"
const NOT_HIM = /\b(?:i|my (?:\w+)|mom|mum|dad|she|he|they)\s*(?:'m|am|was|were|'ve|have|had|'ll|will|went|go|like|love|enjoy|hate|played|sang|cooked|baked|ate|did|want to|wanna|need to|gotta|'m going to|am going to|gonna|just|really|usually|always|never|used to)\b(?!\s+(?:see|watch|hear|you)\b)|\bwe (?:went|were|had|did|played|ate|love|like|always|usually|used to)\b/;
const NO = /\b(?:don'?t|do not|stop|no more|never|quit|not now|no)\s+(?:\w+\s+){0,2}?(?:play|sing|dance|cook|bake|eat|read|swim|drum|do|go)/;
const QUESTION = /^\s*(?:(?:mochi|hey|so)[,!]?\s+)?(?:what|which|who|whose|why|when|where|is|are|was|were|did|does|have you|has|do you(?! (?:want|wanna) to)|how (?:do|does|did|was|is))\b(?!.*\b(?:can you|could you|will you|let'?s|show me)\b)/;
// asking him for help with their own thing ("clean up my essay", "help me study", "investigate why my code crashes"):
// that's for his words, not an activity
const HELP = /\b(?:help me|help us|my (?:code|essay|homework|test|exam|boss|job|work|project|e-?mail|resume|cv|paper|report|app|website|computer|phone|car|plan|schedule|budget|notes)|(?:this|that|the) (?:code|essay|bug|error|text|paragraph|sentence|e-?mail|file|document|plan|options?|data|list|problem|issue)|why (?:my|does|is|do|did)|how (?:do|to|can|should) i|for (?:my|the) (?:test|exam|interview|meeting|boss|class))\b/;
// said, not asked, but plainly an invitation ("it's my birthday!", "say cheese!", "tag, you're it!", "I'm so bored")
const BARE = [[/\b(?:it'?s (?:my|your|mimi'?s|cocoa'?s) birthday(?! (?:tomorrow|next|soon|on|in|was))|happy birthday(?: (?:to )?(?:you|me|mochi|mimi|cocoa))?[!.]*$)/, "birthday"], [/^(?:\w+,? )?say cheese\b/, "photo"], [/\b(?:tag,? )?you'?re it\b/, "tag"], [/\b(?:it'?s snowing|let it snow|snow day)\b/, "snow"], [/^(?:it'?s )?(?:tea|cocoa) time\b/, "drink"], [/^(?:ugh,? )?(?:i'?m|i am|im) (?:so |really |super |very )?bored[!.]*$/, "anything"], [/\border in the court\b|^all rise\b/, "courtjudge"]];

/** "play the guitar", "let's have a tea party", "can you go fishing?" → { kind: "book", id, ask } | null
 *  Each sentence is judged on its own: "I'm bored, can you play a game?" and "can you sing? I love your voice" ask. */
// "judge my project", "rate our app" (Nov 7): their own thing, but asked to be judged: the hackathon judge, not help
const JUDGE_MINE = /\b(?:judge|rate|grade|score)\s+(?:my|our|this|the)\s+(?:project|hack|app|demo|pitch|startup|presentation|submission|idea)\b/;
export function bookIntent(text, { moves = [] } = {}) {
  const all = norm(text);
  if (!all || all.length > 220 || (HELP.test(all) && !JUDGE_MINE.test(all))) return null;
  const clauses = all.split(/(?<=[.!?;])\s+|,\s+(?=(?:can|could|will|would|let'?s|please|how about|maybe|so|and|then|now|mochi)\b)/).filter(Boolean);
  for (const t of clauses) { const r = clauseIntent(t, moves, all); if (r) return r; }
  return null;
}
// "dress up as a police officer", "can you dress like a doctor?", "put on your chef costume" (Nov 7, shared/jobs.js): the
// job's own entry
const DRESS = new RegExp(String.raw`\b(?:dress(?:ed)?(?: (?:yourself )?up)? (?:as|like)|(?:put on|wear) (?:a|an|the|your) (?:[a-z]+ )?(?:costume|outfit|uniform)|turn into|become) (?:a |an |the |our |my )?(${JOB_WORDS})\b|\b(${JOB_WORDS}) (?:costume|outfit|uniform)\b`);
const JOB_ENTRY = { doctor: "doctor", police: "police", engineer: "engineer", firefighter: "firefighter", chef: "chef", pilot: "pilot", farmer: "farmer", artist: "artist", detective: "detective", astronaut: "astronaut", teacher: "teacher", scientist: "scientist", judge: "courtjudge" };
function clauseIntent(t, moves, all) {
  if (NO.test(t)) return null;
  const dm = DRESS.exec(t);
  if (dm && !NOT_HIM.test(t) && !/\b(?:i|we|my \w+)\s+(?:dressed|was|were|went)\b/.test(t)) { const id = JOB_ENTRY[jobOf(dm[1] || dm[2])]; if (id && BOOK_BY_ID[id]) return { kind: "book", id, ask: all }; }
  for (const [re, id] of BARE) if (re.test(t)) return { kind: "book", id, ask: all };
  if (NOT_HIM.test(t) || QUESTION.test(t)) return null;
  if (!ASK.test(t) && !VERB_FIRST.test(t)) return null;
  if (moves.some((m) => m && m.name && m.source !== "builtin" && m.name.length > 2 && new RegExp(`\\b${String(m.name).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t))) return null;   // a move you taught him by that name
  // "make me a wizard hat", "can you build me a tent": that's his workbench (a prop to keep), not an activity, unless the
  // book's own words are about making ("make soup", "build a snowman", "bake a cake")
  const making = MAKING.test(t);
  let best = null;
  for (const e of BOOK) { const m = e.w.exec(t); if (m && (!making || /\b(?:make|build|bake|cook|write|plant|pitch|light)\b/.test(m[0])) && (!best || m[0].length > best.n)) best = { e, n: m[0].length }; }
  if (best) return { kind: "book", id: best.e.id, ask: all };
  // "do a rain dance", "show me a pirate routine": not in the book, but plainly a performance: he makes it up
  const mu = MAKE_UP.exec(t);
  if (!mu || moves.some((m) => m && String(m.name).toLowerCase() === mu[1].trim())) return null;   // ("do a happy dance": a move he knows)
  return { kind: "improvise", ask: mu[1].trim() };
}
const MAKE_UP = /\b(?:do|show me|show us|perform|try|invent|make up|put on)\s+(?:a|an|the|your|some|me a|us a)\s+((?:[a-z'-]+\s){1,3}(?:dance|routine|show|act|performance|ceremony|parade|ritual))\b/;
const MAKING = /\b(?:make|build|craft|create|design|draw|knit|sew)\s+(?:me|us|him|her|mimi|cocoa|you|yourself|myself)?\s*(?:a|an|some|the|another|my|your|his|her)\s/;
/** a book activity asked by name (the brain's tool: "go fishing") */
export function bookLookup(what) {
  const raw = norm(what), t = raw.replace(/^(?:to |go |a |an |the )/, "");
  if (!t) return null;
  const byName = BOOK.find((e) => !e.pickOne && (e.id === t || e.name === t || e.name === raw || e.ing === t));
  if (byName) return byName;
  let best = null;
  for (const e of BOOK) { const m = e.w.exec(raw) || e.w.exec(t); if (m && (!best || m[0].length > best.n)) best = { e, n: m[0].length }; }
  return best ? best.e : null;
}

// ---- an entry → a routine ----
const RIDES = /^(?:handheld_canopy|handheld_tool|launcher|throwable)$/;
/** his own version of a pocket thing if he has one (a rainbow guitar he made), else the pocket's */
function ownFirst(name, owned = []) {
  const exact = owned.find((p) => String(p.name).toLowerCase() === String(name).toLowerCase());   // one of his own, by name (made up activities pick these)
  const pat = pocket(name); if (!pat) return exact ? asProp(exact) : null;
  if (exact && exact.archetype === pat.archetype) return asProp(exact);
  const keys = name.split(/\s+/).filter((w) => w.length > 3 && !/^(?:little|magenta|round|reading|folded|wooden|small|desk|protective|night-vision|golden|potted|ball)$/.test(w));
  const mine = owned.find((p) => p.archetype === pat.archetype && keys.some((k) => new RegExp(`\\b${k.replace(/[^a-z0-9-]/g, "")}s?\\b`).test(String(p.name).toLowerCase())));   // (a "water balloon" isn't a foam ball)
  return asProp(mine || pat);
}
const setFor = (name, owned = []) => asProp(pocket(name) || owned.find((p) => String(p.name).toLowerCase() === String(name).toLowerCase()) || null);
function friendsFor(entry, ask) {
  const t = norm(ask).replace(/\b(?:hot|some|a cup of|cup of|mug of|drink|sip|warm)\s+cocoa\b|\bcocoa time\b/g, " ");   // ("hot cocoa" isn't Cocoa the bear)
  const needs = entry.steps ? [...new Set(entry.steps.filter((s) => ["fsay", "friend", "bye", "catch", "hug"].includes(s[0])).map((s) => s[1]))] : [];   // hide and seek needs Cocoa
  if (/\b(?:alone|by yourself|on your own|just (?:you|us|me)|only you|you and me)\b/.test(t)) return needs;
  if (/\b(?:everyone|everybody|your friends|the gang|all of you|both of them|mimi and cocoa|cocoa and mimi)\b/.test(t)) return ["mimi", "cocoa"];
  const named = ["mimi", "cocoa"].filter((w) => new RegExp(`\\b${w}\\b`).test(t));
  return [...new Set([...(entry.friends || []), ...needs, ...named])];
}
// how long things really take on the stage (the kit: a move's "performing" mood lasts 250 ms past it, standing up first
// adds 450; a walk there and back is stance.js walkToRoute at 0.62 a second, plus 650 to stand up)
const moveMs = (rec, first) => Math.round(rec.duration * 1000) + 350 + (first && rec.stand ? 450 : 0);
const walkMs = (x) => Math.round(650 + (0.4 + 0.5 + 2.2 + 0.5 + 0.5 + 2 * Math.max(0.3, Math.abs(x) / 0.62)) * 1000);
export const CATCH_ROUND_MS = 3300;   // kit/src/activities.js catchGame: throw, fly, a moment in their hooves, fly back, a breath
const DUR = { say: 1500, fsay: 1900, friend: 1300, bye: 1700, fx: 250, use: 1300, toss: 1600, knock: 900, hop: 650, hold: 650, set: 650, wear: 650, hug: 3600, sound: 0 };
/** the steps of a routine, with times: { at (ms), do, … } */
export function routineFor(entry, { ask = "", owned = [], r = Math.random, skill = 0.9 } = {}) {
  if (!entry) return null;
  if (entry.pickOne) {   // "play a game", "surprise me": one of these (or anything at all)
    const ids = entry.pickOne === "*" ? BOOK.filter((e) => !e.pickOne).map((e) => e.id) : entry.pickOne;
    return routineFor(BOOK_BY_ID[ids[Math.floor(r() * ids.length)]], { ask: "", owned, r, skill });
  }
  const t = norm(ask), steps = [], friends = friendsFor(entry, t);
  const motion = (name) => { const m = MOTIONS[name]; return m ? { ...m, ...(entry.stand ? { stand: true } : {}) } : null; };
  const holdName = (entry.pick || []).find(([re]) => re.test(t))?.[1] || entry.hold || null;
  let at = 0;
  if (entry.wear && entry.cat === "pretend") steps.push({ at: 0, do: "undress" });   // a job: the last one's hat or stethoscope comes off first (Nov 7)
  if (entry.wear) steps.push({ at: 0, do: "wear", prop: ownFirst(entry.wear, owned) });
  if (entry.set) steps.push({ at: 0, do: "set", prop: setFor(entry.set, owned) });
  if (holdName) steps.push({ at: 120, do: "hold", prop: ownFirst(holdName, owned) });
  friends.forEach((w, i) => steps.push({ at: 150 + i * 500, do: "friend", who: w, role: entry.role || "hello" }));
  at = 750;
  const [startLine, endLine] = entry.lines || [];
  if (startLine) steps.push({ at: 2200, do: "say", text: startLine });
  const t0 = at;
  let firstMove = null;
  if (entry.steps) {
    for (const s of entry.steps) {
      const [op, a, b] = s;
      if (op === "move") { const rec = motion(a); if (!rec) continue; steps.push({ at, do: "motion", recipe: rec, skill }); firstMove = firstMove || { at, rec, first: true }; at += moveMs(rec, firstMove.first && firstMove.rec === rec && firstMove.at === at); continue; }
      if (op === "wait") { at += Math.max(0, Math.min(5000, +a || 0)); continue; }
      if (op === "say") steps.push({ at, do: "say", text: String(a) });
      else if (op === "fsay") steps.push({ at, do: "fsay", who: a, text: String(b) });
      else if (op === "friend") steps.push({ at, do: "friend", who: a, role: b || "hello" });
      else if (op === "bye") steps.push({ at, do: "bye", who: a });
      else if (op === "fx") steps.push({ at, do: "fx", kind: a, n: b || 4 });
      else if (op === "face") { steps.push({ at, do: "face", name: a, ms: b || 1500 }); at += b || 1500; continue; }
      else if (op === "sound") steps.push({ at, do: "sound", kind: a, ms: b || 2200 });
      else if (op === "use") steps.push({ at, do: "use" });
      else if (op === "toss") steps.push({ at, do: "toss", to: a || "up" });
      else if (op === "knock") steps.push({ at, do: "knock" });
      else if (op === "catch") { const n = Math.max(1, Math.min(4, b || 2)); steps.push({ at, do: "catch", who: a || "cocoa", n }); at += n * CATCH_ROUND_MS + 400; continue; }
      else if (op === "walk") { const x = Math.max(-1.3, Math.min(1.3, +a || 1)); steps.push({ at, do: "walk", x }); at += walkMs(x); continue; }
      else if (op === "hop") steps.push({ at, do: "hop" });
      else if (op === "hug") steps.push({ at, do: "hug", who: a });
      else if (op === "hold" || op === "set" || op === "wear") steps.push({ at, do: op, prop: op === "set" ? setFor(a, owned) : ownFirst(a, owned) });
      at += DUR[op] ?? 600;
    }
  } else {
    for (const name of entry.moves || []) {
      const rec = motion(name); if (!rec) continue;
      steps.push({ at, do: "motion", recipe: rec, skill });
      if (entry.fx) steps.push({ at: at + 400, do: "fx", kind: entry.fx, n: 3 });
      const was = at; at += moveMs(rec, !firstMove);
      firstMove = firstMove || { at: was, rec };
    }
  }
  if (firstMove && friends.length && (entry.copy || (entry.cat === "dance" || entry.cat === "exercise")))   // they join in
    friends.forEach((w, i) => steps.push({ at: firstMove.at + 500 + i * 300, do: "fmove", who: w, recipe: firstMove.rec }));
  if (entry.fsay && friends.includes(entry.fsay[0])) steps.push({ at: Math.max(t0 + 1500, Math.round((t0 + at) / 2)), do: "fsay", who: entry.fsay[0], text: entry.fsay[1] });
  if (entry.sound) steps.push({ at: t0, do: "sound", kind: entry.sound, ms: Math.max(1500, at - t0) });
  steps.push({ at, do: "face", name: entry.end || "happy", ms: 1800 }, { at: at + 100, do: "fx", kind: entry.end === "superexcited" ? "confetti" : "star", n: 4 });
  if (endLine) steps.push({ at: at + 300, do: "say", text: endLine });
  const ms = at + 2400;
  steps.sort((a, b) => a.at - b.at);
  return { kind: "routine", id: entry.id, name: entry.name, ing: entry.ing, cat: entry.cat, learned: !!entry.learned, talk: !!entry.talk, ...(entry.brief ? { brief: entry.brief } : {}), friends, steps, ms };
}

// ---- improvising one that isn't in the book ----
const ABOUT = {
  strum: "strums a guitar", drum: "drums with both hooves", sing: "sings into a microphone", conduct: "waves a baton", clap: "claps", cheer: "cheers, hooves up",
  kick: "kicks a leg", shoot: "throws a ball up high with both hooves", swing: "swings a held thing side to side", throw: "throws overarm", catch: "catches with both hooves",
  stir: "stirs a pot", chop: "chops or hammers up and down", eat: "eats something in his hoof", drink: "drinks from a cup", read: "reads a book in both hooves",
  write: "writes or draws small", look: "looks around through something held up", phone: "talks on a phone at his ear", selfie: "takes a selfie", salute: "salutes",
  jacks: "jumping jacks", stretch: "stretches up and side to side", meditate: "sits calm, eyes closed", karate: "karate chops and a kick", swim: "swimming strokes",
  row: "rows a boat", fly: "arms out, swooping like flying", dig: "digs", water: "waters a plant", sweep: "sweeps or dusts side to side", brush: "brushes his teeth",
  think: "hoof on chin, thinking", count: "counts on his hoof", peekaboo: "covers his eyes, then peekaboo", sneak: "tiptoes, looking around", hula: "sways his hips",
  robot: "stiff robot moves", spin: "spins around once", bow: "takes a bow", climb: "climbs hand over hand", fish: "casts a fishing line and reels in", wave: "waves",
  shiver: "shivers from the cold", march: "marches", hop: "hops up and down", present: "holds something up proudly", shake: "shakes something in his hoof",
  piano: "plays keys in front of him", blow: "blows into something at his mouth", dj: "one hoof on his headphones, scratching", kite: "holds a string up high, looking up",
  gamepad: "taps a game controller fast", photo: "raises a camera to his eye", toast: "raises a cup", pat: "pats something in front of him",
};
const HAND = (owned) => [...POCKET.filter((e) => RIDES.test(e.archetype)).map((e) => e.name), ...owned.filter((p) => RIDES.test(p.archetype)).map((p) => p.name)];
const WEAR = (owned) => [...POCKET.filter((e) => /^(?:head|body)_wearable$/.test(e.archetype)).map((e) => e.name), ...owned.filter((p) => /^(?:head|body)_wearable$/.test(p.archetype)).map((p) => p.name)];
const SET = (owned) => [...POCKET.filter((e) => e.archetype === "companion").map((e) => e.name), ...owned.filter((p) => p.archetype === "companion").map((p) => p.name)];
export function improviseSchema(owned = []) {
  const uniq = (a) => [...new Set(a)].slice(0, 120);
  return {
    type: "object", additionalProperties: false,
    properties: {
      name: { type: "string" }, ing: { type: "string" },
      hold: { type: "string", enum: ["none", ...uniq(HAND(owned))] }, wear: { type: "string", enum: ["none", ...uniq(WEAR(owned))] }, set: { type: "string", enum: ["none", ...uniq(SET(owned))] },
      moves: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", enum: MOTION_NAMES } },
      fx: { type: "string", enum: ["none", ...FX] }, sound: { type: "string", enum: ["none", ...SOUNDS] },
      friends: { type: "string", enum: ["none", "mimi", "cocoa", "both"] },
      start: { type: "string" }, end_line: { type: "string" }, end_face: { type: "string", enum: FACES },
      need: { type: "string" },
    },
    required: ["name", "ing", "hold", "wear", "set", "moves", "fx", "sound", "friends", "start", "end_line", "end_face", "need"],
  };
}
const clip = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
/** the model's plan → a book-like entry (only things that exist) */
export function cleanImprov(j, ask, owned = []) {
  if (!j || typeof j !== "object") return null;
  const hand = HAND(owned), wear = WEAR(owned), set = SET(owned);
  const moves = (Array.isArray(j.moves) ? j.moves : []).filter((m) => MOTIONS[m]).slice(0, 3);
  if (!moves.length) return null;
  const name = clip(j.name, 40).toLowerCase() || clip(ask, 40).toLowerCase();
  const fr = j.friends === "both" ? ["mimi", "cocoa"] : j.friends === "mimi" || j.friends === "cocoa" ? [j.friends] : [];
  return {
    id: `learned:${name.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "thing"}`, cat: "learned", learned: true, name, ing: clip(j.ing, 60) || name,
    hold: hand.includes(j.hold) ? j.hold : null, wear: wear.includes(j.wear) ? j.wear : null, set: set.includes(j.set) ? j.set : null,
    moves, fx: FX.includes(j.fx) ? j.fx : null, sound: SOUNDS.includes(j.sound) ? j.sound : null, friends: fr, role: "cheer",
    lines: [clip(j.start, 50) || null, clip(j.end_line, 50) || null], end: FACES.includes(j.end_face) ? j.end_face : "proud",
    need: clip(j.need, 40).toLowerCase().replace(/^(?:none|nothing|n\/a|no)$/, "") || null,
  };
}
/** a plain one when the model can't: he gives it a go with a happy little dance */
export function fallbackImprov(ask) {
  const name = clip(String(ask || "something new").replace(/^(?:can you|could you|please|let'?s|try to|try)\s+/i, "").replace(/[?!.]+$/, ""), 40).toLowerCase() || "something new";
  return { id: `learned:${name.replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`, cat: "learned", learned: true, name, ing: `having a go at ${name}`, moves: ["think", "hop", "present"], fx: "star", lines: ["Hmm, like this?", "Ta-da! …I think?"], end: "proud", friends: [] };
}
/** Gemma plans a new activity from his pieces; kept in his book after (kv book.learned) */
export async function improvise({ llm, ask, memory, log = console }) {
  const owned = memory ? memory.props() : [];
  const key = norm(ask).replace(/^(?:(?:can|could|will|would) you|please|let'?s|try to|try|do|go|mochi,?|hey,?)\s+/g, "").replace(/^(?:(?:can|could|will|would) you|please|let'?s|try to|try|do|go)\s+/, "").replace(/^(?:a|an|some|the)\s+/, "").replace(/[?!.]+$/, "").slice(0, 60);
  const learned = memory ? memory.get("book.learned", {}) : {};
  if (key && Object.prototype.hasOwnProperty.call(learned, key) && learned[key] && learned[key].moves) return { entry: learned[key], fresh: false };
  let entry = null;
  if (llm) {
    try {
      const r = await llm.chat({ what: "improvise", maxTokens: 500, temperature: 0.5, schema: improviseSchema(owned), schemaName: "activity",
        system: "You plan a short, cute performance (about 8 seconds) for Mochi, a small round fluffy sheep on a little stage, who has just been asked to do an activity. He can only use what's listed: things to hold, wear, or set down beside him (choose the closest fits, or none), up to three motions in order, one little effect, one sound, and his friends Mimi (his girlfriend, a sheep) and Cocoa (his best buddy, a bear) who can join in. Pick motions that really look like the activity. start and end_line are very short things he says (under 8 words each, cheerful, no stage directions). need: if the activity really needs a thing that isn't in the hold, wear or set lists (a jump rope, a skateboard ramp), name it in 1–3 words; otherwise \"none\". Keep it gentle and harmless: weapons are only ever toys.\nMotions: " + Object.entries(ABOUT).map(([k, v]) => `${k} (${v})`).join(", "),
        user: `Mochi was asked: "${clip(ask, 140)}". Plan it.` });
      const j = r.json || (r.text ? JSON.parse(String(r.text).replace(/^```json|```$/g, "")) : null);
      entry = cleanImprov(j, ask, owned);
    } catch (e) { log.warn && log.warn("[book] improvise:", e.message); }
  }
  if (!entry) entry = fallbackImprov(ask);
  if (memory && key) { const all = memory.get("book.learned", {}); const keys = Object.keys(all); if (keys.length >= 40) delete all[keys[0]]; all[key] = entry; memory.set("book.learned", all); }
  return { entry, fresh: true };
}

// ---- what the brain is told; what the workshop shows ----
export function routineNote(a) {
  if (!a) return "";
  const who = (a.friends || []).map((w) => (w === "mimi" ? "Mimi" : "Cocoa")).join(" and ");
  if (a.talk) return `\nOn screen just now: you're ${a.ing}${who ? ` (${who} joined in)` : ""}. Your reply IS the thing they asked for (the story, the poem, the letter, the joke, the report): give it in full, short and sweet, in your own words, with no stage directions.${a.brief ? ` ${a.brief}` : ""}`;
  return `\nOn screen just now: you're ${a.ing}${who ? ` (${who} joined in)` : ""}. You really are doing it, right now, with your own hooves${a.learned ? " (it's new to you: you're making it up as you go)" : ""}. Say something short and happy that fits; don't describe it step by step, they can see it, and don't say you'll do it later.`;
}
export function bookPage(memory) {
  const done = memory ? memory.get("book.done", {}) : {}, learned = memory ? memory.get("book.learned", {}) : {};
  return {
    categories: CATEGORIES.map(([id, label]) => ({ id, label, items: BOOK.filter((e) => e.cat === id && !e.pickOne).map((e) => ({ id: e.id, name: e.name, times: (done[e.id] || {}).n || 0 })) })),
    learned: Object.values(learned).map((e) => ({ id: e.id, name: e.name, times: (done[e.id] || {}).n || 0, need: e.need || null })),
  };
}
/** only real activities count: the book's, or ones he made up (not whatever a page posts) */
export function knownId(memory, id) {
  if (typeof id !== "string" || !id || id.length > 60) return false;
  if (Object.prototype.hasOwnProperty.call(BOOK_BY_ID, id)) return true;
  return Object.values(memory.get("book.learned", {})).some((e) => e && e.id === id);
}
export function bookDone(memory, id) {
  if (!memory || !knownId(memory, id)) return false;
  const done = memory.get("book.done", {}); done[id] = { n: ((Object.prototype.hasOwnProperty.call(done, id) && done[id]) || {}).n + 1 || 1, at: new Date().toISOString() }; memory.set("book.done", done);
  return true;
}
/** you asked for it (not one he did on his own): his story builds on these */
export function bookAsked(memory, id) {
  if (!memory || !knownId(memory, id)) return;
  const asked = memory.get("book.asked", {}); asked[id] = new Date().toISOString(); memory.set("book.asked", asked);
}
export { BOOK, BOOK_BY_ID, CATEGORIES };
