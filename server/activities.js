// Activities he really does (Binoy, Nov 3: "what if I told mochi to do an activity like 'paint a picture' or 'juggle'
// or 'show me a cool party trick'? Would it look for props related to it and be able to do the activity? Would it
// pretend to do it while not being able to do it?" … "build all of these").
//
//   paint   an easel comes out, he paints with his brush and a simple picture of what you asked for builds up on the
//           canvas stroke by stroke (Gemma plans it as a few bold shapes; a hand-made one if the model is down). The
//           finished painting is saved: his scrapbook and the art wall in his workshop.
//   juggle  two or three balls loop between his hooves. He drops them at first and gets better every time.
//   trick   a party trick made from what he has: a magic trick with his star wand (something appears: one of his own
//           props, or one the workbench is still making), a confetti surprise, balancing a ball on his head, a
//           disappearing act, a hat trick, juggling.
// And no pretending: if his reply says he's doing or making something and nothing actually happened, the server does
// it (an activity) or makes the line honest.
import { PROP_EXAMPLES } from "../shared/craft.js";
import { bookIntent } from "./book.js";

const POCKET = Object.values(PROP_EXAMPLES).flat();
const NOT_HIM = /\b(?:i|we|my|mom|dad|she|he|they)\s+(?:painted|drew|draw|paint|am painting|was painting|juggled|juggle|did a)\b|\b(?:i|we)\s*(?:'m|am|'re|are)?\s*(?:want|wanna|need|have|going|gonna|plan(?:ning)?|will|'ll|should|might|like|love)\s+(?:to\s+)?(?:paint|draw|juggle|sketch)\b|\bmy (?:painting|drawing|picture|art)\b|\bi drew you\b/;
const NO = /\b(?:don'?t|do not|stop|no more|never)\s+(?:\w+\s+){0,2}(?:paint|draw|juggl|trick)/;
const PAINT = /\b(?:paint|painting|draw|drawing|sketch|doodle|colou?r in|make (?:me )?(?:a |an )?(?:picture|painting|drawing|portrait|masterpiece|art)|(?:a |an )?(?:picture|painting|drawing|portrait|masterpiece) (?:of|for)|art ?work|some art)\b/;
const JUGGLE = /\bjuggl(?:e|es|ing|er)\b/;
const TRICK = /\b(?:party tricks?|magic tricks?|cool tricks?|a tricks?|some tricks?|any tricks?|tricks?|magic show|some magic|do magic|abracadabra|balance (?:a|the|something)|disappear|vanish|pull (?:a|an|something) \w+ out of)\b/;
// asked: a request word, or an imperative ("paint a cat", "juggle!"); not just "!" ("nice painting!", "neat trick!")
const ASKY = /\b(?:can|could|will|would|wanna|want to|do you|let'?s|please|show me|show us|do a|do some|try|time to|time for|how about|now)\b|^\s*(?:paint|draw|juggle|sketch|doodle|pull|make|show|do|give|balance|disappear|vanish)\b/;
const QUESTION = /^\s*(?:what|which|who|whose|why|when|where|is|are|was|were|did|have you ever)\b(?!.*\b(?:can you|could you|will you)\b)/;

/** what activity they asked for: { kind: "paint", subject } | { kind: "juggle" } | { kind: "trick", ask } | null */
export function activityIntent(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t || NOT_HIM.test(t) || NO.test(t) || QUESTION.test(t)) return null;
  if (JUGGLE.test(t) && ASKY.test(t)) return { kind: "juggle" };
  if (PAINT.test(t) && ASKY.test(t) && !/\b(?:paint ?ball|draw (?:a )?(?:card|bath|breath|conclusion|line under)|drawing board|drawer)\b/.test(t)) return { kind: "paint", subject: paintSubject(t) };
  if (TRICK.test(t) && ASKY.test(t) && !/\b(?:trick or treat|tricky|trick question|tricked)\b/.test(t)) return { kind: "trick", ask: t };
  return null;
}
/** his last line asked what to paint, and this short reply says what: { kind: "paint", subject } */
export function paintAnswer(text, prev) {
  const t = String(text || "").trim().replace(/[.!?]+$/, "");
  if (!prev || !/\b(?:paint|draw|sketch)\b[^.!]*\?/i.test(prev) || !t || t.split(/\s+/).length > 7 || /^(?:no|nah|nope|nothing|never ?mind|not now|stop)\b/i.test(t)) return null;
  return { kind: "paint", subject: paintSubject(`paint ${t}`) || t.slice(0, 60) };
}
/** "paint me a picture of a red dragon" → "a red dragon"; "draw Mimi" → "Mimi"; "paint something" → null */
export function paintSubject(t) {
  const s = String(t || "").toLowerCase().replace(/[!?.]+$/g, "");
  if (/\b(?:paint|draw|sketch)\s+(?:me|myself|a picture of me|my portrait)\s*$/.test(s)) return "you";
  const m = /\b(?:picture|painting|drawing|portrait|sketch|art|masterpiece)\s+(?:of|for)\s+(.+)$/.exec(s)
    || /\b(?:paint|draw|sketch|doodle|colou?r in)\s+(?:me\s+|us\s+|for me\s+)?(?!(?:me|us|something|anything|a picture|a painting|a drawing|for me|it|that|this)\b)(.+)$/.exec(s);
  if (!m) return null;
  let x = m[1].replace(/\b(?:for me|for us|please|now|again|right now|on (?:the|your) (?:canvas|easel))\b/g, "").replace(/\s{2,}/g, " ").trim();
  x = x.replace(/^(?:me|us)\s+/, "").replace(/^(?:a picture of|a painting of|a drawing of)\s+/, "").replace(/\b(?:together|with me|with us)\b/g, "").replace(/\bmy\b/g, "your").replace(/\bmimi\b/g, "Mimi").replace(/\bcocoa\b/g, "Cocoa").replace(/\s{2,}/g, " ").slice(0, 60).trim();
  if (!x || /^(?:something|anything|whatever|a picture|a painting|a drawing|some art)$/.test(x)) return null;
  if (/^(?:me|myself)$/.test(x)) return "you";
  return x;
}

// ---- painting: a picture in a few bold shapes, on a 100 × 75 canvas, back to front ----
const SHAPES = ["circle", "ellipse", "rect", "triangle", "line", "star", "heart", "blob", "cloud"];
export const PAINT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string" }, background: { type: "string" },
    shapes: { type: "array", minItems: 5, maxItems: 24, items: { type: "object", additionalProperties: false,
      properties: { shape: { type: "string", enum: SHAPES }, x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" }, color: { type: "string" }, rotate: { type: "number" } },
      required: ["shape", "x", "y", "w", "h", "color", "rotate"] } },
  },
  required: ["title", "background", "shapes"],
};
const hex = (c, d) => { const s = String(c || "").trim().toLowerCase(); return /^#[0-9a-f]{6}$/.test(s) ? s : /^#[0-9a-f]{3}$/.test(s) ? "#" + s.slice(1).split("").map((x) => x + x).join("") : d; };
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export function cleanPainting(j, subject) {
  const shapes = (j && Array.isArray(j.shapes) ? j.shapes : []).slice(0, 24).map((s) => ({
    shape: SHAPES.includes(s.shape) ? s.shape : "blob", x: num(s.x, -10, 110, 50), y: num(s.y, -10, 85, 40), w: num(s.w, 1, 120, 10), h: num(s.h, 1, 90, 10),
    color: hex(s.color, "#ff8fb8"), rotate: num(s.rotate, -180, 180, 0) })).filter((s) => s.w * s.h > 2);
  return { title: String((j && j.title) || (subject ? `my painting of ${subject}` : "my painting")).replace(/["<>]/g, "").slice(0, 60), background: hex(j && j.background, "#bfe6ff"), shapes };
}
/** a hand-made picture for when the model can't plan one: a sunny day, and the subject as a happy blob */
export function fallbackPainting(subject) {
  const sheep = /\b(sheep|mochi|mimi|cocoa|lamb|me|you)\b/.test(String(subject || ""));
  const body = sheep ? "#ffffff" : ["#ff8fb8", "#ffd34d", "#7fd1ff", "#9be38b", "#c49bff"][Math.floor(Math.random() * 5)];
  return { title: subject ? `my painting of ${subject}` : "a sunny day", background: "#bfe6ff", shapes: [
    { shape: "rect", x: 50, y: 64, w: 100, h: 24, color: "#9be38b", rotate: 0 },
    { shape: "ellipse", x: 22, y: 58, w: 60, h: 22, color: "#7fcf6e", rotate: 0 },
    { shape: "circle", x: 84, y: 14, w: 16, h: 16, color: "#ffd34d", rotate: 0 },
    { shape: "cloud", x: 26, y: 16, w: 22, h: 10, color: "#ffffff", rotate: 0 },
    { shape: "blob", x: 52, y: 46, w: 30, h: 24, color: body, rotate: 0 },
    { shape: "circle", x: 46, y: 43, w: 3, h: 3, color: "#2a1d18", rotate: 0 },
    { shape: "circle", x: 57, y: 43, w: 3, h: 3, color: "#2a1d18", rotate: 0 },
    { shape: "line", x: 52, y: 50, w: 7, h: 1.4, color: "#2a1d18", rotate: 0 },
    { shape: "heart", x: 76, y: 52, w: 8, h: 8, color: "#ff6f91", rotate: -12 },
    { shape: "star", x: 12, y: 30, w: 6, h: 6, color: "#ffffff", rotate: 0 },
  ] };
}
export async function planPainting({ llm, subject, log = console }) {
  if (!llm) return fallbackPainting(subject);
  try {
    const r = await llm.chat({ what: "paint", maxTokens: 900, temperature: 0.6, schema: PAINT_SCHEMA, schemaName: "painting",
      system: "You are Mochi, a small cheerful sheep who paints with a big round brush. Plan a simple, bold, childlike painting a five-year-old would love: a clear subject in the middle, big shapes, bright colours, a simple background (sky and ground, or a plain colour). The canvas is 100 wide and 75 tall, (0,0) top left. Each shape: its centre x, y, its width w and height h, a colour #rrggbb, and a rotation in degrees. Shapes are painted in order, back to front, so the background goes first and small details (eyes, a smile, spots) last. Use 8 to 20 shapes. A blob is a soft lumpy round shape (good for bodies, bushes, wool); a cloud is a puffy cloud; a line is a thick stroke (w long, h thick).",
      user: `Paint: ${subject || "something happy you love"}.` });
    const j = r.json || (r.text ? JSON.parse(String(r.text).replace(/^```json|```$/g, "")) : null);
    const p = cleanPainting(j, subject);
    if (p.shapes.length >= 5) return p;
    log.warn && log.warn("[paint] the model's plan had too few shapes; painting a simple one");
  } catch (e) { log.warn && log.warn("[paint]", e.message); }
  return fallbackPainting(subject);
}
/** when they didn't say what: he picks something from what he knows */
export function ownSubject({ facts = [], props = [], r = Math.random } = {}) {
  const liked = facts.map((f) => /\b(?:loves?|likes?|favou?rite (?:\w+ )?is)\s+([a-z][a-z ]{2,24})/.exec(String(f.text || f).toLowerCase())).filter(Boolean).map((m) => m[1].trim());
  const pool = [...liked, "Mimi with her pink bow", "a big rainbow", "a sunflower", "you!", "me and my friends", "a sunny day at the beach", ...props.slice(-3).map((p) => `my ${p.name}`)];
  return pool[Math.floor(r() * pool.length)];
}

// ---- juggling: three balls, a skill that grows ----
export function juggleSpec(skills = {}) {
  const J = skills.juggle || { skill: 0.2, times: 0 };
  const balls = J.skill >= 0.55 ? 3 : J.times >= 1 ? 3 : 2;
  return { kind: "juggle", balls, skill: J.skill, times: J.times, ms: 7000 };
}
export function juggled(skills = {}, drops = 0) {
  const J = { skill: 0.2, times: 0, ...(skills.juggle || {}) };
  J.times += 1; J.skill = Math.min(0.97, J.skill + (drops ? 0.1 : 0.14));
  return { ...skills, juggle: J };
}

// ---- party tricks ----
export const TRICKS = ["magic", "confetti", "balance", "vanish", "hat", "juggle"];
const PROP_WORD = /\bpull (?:a|an|some|something|the)\s+([a-z]+(?: [a-z]+)?) out of\b|\bmake (?:a|an|the)\s+([a-z]+(?: [a-z]+)?) (?:appear|come out)\b/;
/** which trick: what they named, or one he hasn't done lately; a magic trick shows something (his own prop, or one
 *  the workbench will make: `make`) */
export function pickTrick({ ask = "", props = [], last = [], r = Math.random } = {}) {
  const t = String(ask).toLowerCase();
  let trick = /\bjuggl/.test(t) ? "juggle" : /\b(confetti|pop|popper|party popper)\b/.test(t) ? "confetti" : /\bbalanc/.test(t) ? "balance" : /\b(disappear|vanish|invisible)\b/.test(t) ? "vanish" : /\bhat\b(?! trick)/.test(t) && !PROP_WORD.test(t) ? "hat" : /\b(magic|abracadabra|wand|appear|pull)\b/.test(t) ? "magic" : null;
  if (!trick) { const fresh = TRICKS.filter((x) => !last.includes(x)); trick = (fresh.length ? fresh : TRICKS)[Math.floor(r() * (fresh.length || TRICKS.length))]; }
  const out = { kind: "trick", trick };
  if (trick === "magic") {
    const w = PROP_WORD.exec(t), want = w ? (w[1] || w[2]).replace(/^(?:little|cute|tiny|big)\s+/, "") : null;
    const owned = props.filter((p) => p.archetype !== "ride" && p.archetype !== "launcher");
    const mine = want ? owned.find((p) => String(p.name).toLowerCase().includes(want)) : null;
    const pocket = want ? POCKET.find((e) => e.name.includes(want) && e.archetype !== "ride" && e.archetype !== "launcher") : null;
    if (want && !mine && !pocket) out.make = want;   // not his yet: the workbench makes it, and he'll finish the trick then
    out.reveal = mine ? { id: mine.id, name: mine.name, archetype: mine.archetype, recipe: mine.recipe } : pocket ? { name: pocket.name, archetype: pocket.archetype, recipe: pocket } : !want && owned.length ? (({ id, name, archetype, recipe }) => ({ id, name, archetype, recipe }))(owned[Math.floor(r() * owned.length)]) : null;
    if (!out.reveal && !out.make) { const k = POCKET.find((e) => e.name === "kite"); out.reveal = k ? { name: k.name, archetype: k.archetype, recipe: k } : null; }
  }
  if (trick === "juggle") Object.assign(out, { balls: 3 });
  return out;
}
const pocketFor = (name) => { const e = POCKET.find((x) => x.name === name); return e ? { name: e.name, archetype: e.archetype, recipe: e } : null; };
/** the props a trick uses, from his pocket */
export function trickKit(trick) {
  return { wand: trick === "magic" ? pocketFor("star wand") : null, popper: trick === "confetti" ? pocketFor("confetti popper") : null, hat: trick === "hat" ? pocketFor("party hat") : null };
}

/** a ready-to-play activity (the page/kit spec) from { kind, subject, ask }; `make`: a trick prop he hasn't got yet */
export async function buildActivity(a, { memory, llm = null, log = console } = {}) {
  if (!a) return null;
  if (a.kind === "paint") {
    const subject = a.subject || ownSubject({ facts: memory.facts(20), props: memory.props() });
    const painting = await planPainting({ llm, subject, log });
    return { kind: "paint", subject, painting, brush: pocketFor("paintbrush") };
  }
  if (a.kind === "juggle") return juggleSpec(memory.get("skills", {}));
  if (a.kind === "trick") {
    const t = pickTrick({ ask: a.ask || "", props: memory.props(), last: memory.get("tricks.last", []) });
    memory.set("tricks.last", [...memory.get("tricks.last", []).slice(-3), t.trick]);
    if (t.trick === "juggle") Object.assign(t, juggleSpec(memory.get("skills", {})), { kind: "trick", trick: "juggle" });
    return { ...t, ...trickKit(t.trick) };
  }
  return null;
}

/** what the brain is told happened on screen */
export function activityNote(a) {
  if (!a) return "";
  if (a.kind === "paint") return `\nOn screen just now: your easel came out and you're painting ${a.subject} with your big brush, stroke by stroke (it takes a few seconds; the picture is a simple, bright one). Say something short and happy while you paint; don't describe the picture in detail, they can see it.`;
  if (a.kind === "juggle") return `\nOn screen just now: you're juggling ${a.balls} balls${a.times ? ` (you've juggled ${a.times} time${a.times === 1 ? "" : "s"} before; you're getting better)` : " for the very first time, so you'll probably drop one or two"}. Say something short and fun.`;
  if (a.kind === "trick") {
    const what = { magic: a.make ? `a magic trick with your star wand: you tried to make a ${a.make} appear, but it isn't made yet (it's on your workbench now), so out came sparkles instead` : `a magic trick with your star wand: abracadabra, and your ${a.reveal ? a.reveal.name : "kite"} appeared in a puff of sparkles`, confetti: "a confetti surprise: you popped your confetti popper", balance: "a balancing trick: a ball on your head, wobbling, then you bounced it up and caught it", vanish: "a disappearing act: poof, you vanished and popped up on the other side", hat: "a hat trick: you flipped your party hat up and it landed right on your head", juggle: `juggling ${a.balls || 3} balls` }[a.trick] || "a party trick";
    return `\nOn screen just now: you did ${what}. Say something short and showman-like (Ta-da!).`;
  }
  return "";
}

// ---- no pretending ----
// "I'm working on it right now, just stay tuned!" with nothing on the workbench and nothing on screen (M5, Nov 3: "can
// you paint something for me?" … "a sheep" → that, and two nods).
const CLAIM = /\b(?:i'?m (?:working on (?:it|that|this|one|yours?|something)|(?:making|painting|drawing|building|baking|cooking|crafting|creating) (?:it|that|this|one|yours?|you|something|that for you)|(?:painting|drawing|juggling) (?:a|an|the|some|for)\b|on it)\b|i'?ll (?:paint|draw|make|build|bake|cook|juggle|write|do) (?:it|that|this|one|you|a|an|the|some)\b[^.!?]{0,30}\b(?:right )?now\b|stay tuned|coming right up|(?:just )?give me (?:a|one) (?:sec|second|minute|moment)|(?:here|there) (?:it is|you go)\b|watch this|ta-?da)\b/i;
// "It's still bubbling away on my workbench!" with nothing on it (M5, Nov 3: "can you make a mini game?" → "let me see if
// I can figure something out on the workbench!", never queued; "did you get the minigame?" → "still bubbling away")
const BENCH_CLAIM = /\b(?:(?:on|at) (?:my|the) workbench|(?:still )?(?:bubbling|brewing|cooking|chugging) away|being (?:made|built)|let me (?:see if i can |try to )?(?:make|build|whip up|figure (?:something|it) out)|i'?ll (?:put|get) (?:it|that|one) (?:on|started on) (?:my|the) workbench|i'?ll (?:make|build) (?:it|that|one|you one)(?! (?:later|someday)))\b/i;
const NOT_PROP = /\b(?:mini ?-?games?|video ?games?|games?|apps?|websites?|programs?|software|code|videos?|movies?|songs?|music|stor(?:y|ies)|poems?|essays?|homework|spreadsheets?|e-?mails?|pictures? of me|real \w+)\b/;
/** "make me a red kite" → "red kite" */
export function makeWant(t) {
  const m = /\b(?:make|build|craft|create|whip up)\s+(?:me\s+|us\s+|you\s+)?(?:a|an|some|the|another)?\s*([a-z][a-z' -]{1,40}?)\s*(?:[?!.,]|$|\bfor\b|\bplease\b|\bwith\b|\bthat\b)/.exec(String(t || "").toLowerCase());
  const w = m ? m[1].trim() : null;
  return w && !/^(?:it|that|this|one|them|those|these|something|anything|stuff|things?|me one|you one)$/.test(w) ? w : null;   // ("can you make it?": not a thing called "it")
}
/** after a reply: did he say he's doing something with nothing behind it? → { activity } (do it), { queue } (put what
 *  they asked for on the workbench for real), { text } (honest) or null. pending: something really is on the workbench */
export function honesty({ text = "", userText = "", prev = "", did = false, pending = false } = {}) {
  const bench = BENCH_CLAIM.test(text);
  if (did || (!CLAIM.test(text) && !bench)) return null;
  const both = `${prev} ${userText} ${text}`.toLowerCase();
  // an activity he can really do: do it
  const asked = activityIntent(userText) || bookIntent(userText) || (PAINT.test(both) ? { kind: "paint", subject: paintSubject(String(userText).toLowerCase()) || paintSubject(text.toLowerCase()) || (String(userText).trim().split(/\s+/).length <= 4 ? String(userText).trim().replace(/[.!?]+$/, "") : null) } : JUGGLE.test(both) ? { kind: "juggle" } : /\b(trick|magic)\b/.test(both) ? { kind: "trick", ask: both } : null);
  if (asked) return { activity: asked };
  if (bench && !CLAIM.test(text)) {   // only the workbench was claimed
    if (pending) return null;   // something really is on it
    const want = makeWant(userText);
    if (want && !NOT_PROP.test(want)) return { queue: want };   // they asked for a thing and he forgot to start it: start it
  }
  // otherwise: keep what's true, swap the claim for an honest line
  const sentences = String(text).split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !CLAIM.test(s) && !BENCH_CLAIM.test(s)).join(" ").trim();
  if (bench && !CLAIM.test(text)) {
    const want = makeWant(userText);
    return { text: `${kept ? kept + " " : ""}${want ? "Hmm, my workbench can't make that one: only things I can hold, wear, ride, or sit beside me." : "Actually… there's nothing on my workbench right now."}`.trim() };
  }
  const honest = /\b(?:mak|build|bak|cook|craft|creat)/i.test(text) ? "I can't make that one yet… want me to put it on my workbench?" : "Hmm, I don't actually know how to do that yet. Want me to learn?";
  return { text: `${kept ? kept + " " : ""}${honest}`.trim() };
}
