// The workbench: turns a request ("an umbrella", "a police helmet", "make a gun") into a prop or a move with the local
// model, and checks a prop before Mochi shows it to you.
//
// Prop:  classify (archetype, a short toy name, made safe) → recipe (JSON schema, 2 matching examples) → validate and
//        repair (shared/craft.js) → render two views in headless Chrome → a blind look by the vision model ("what is
//        this?") → does that match the request? → if not: a concrete critique of the picture → a new recipe; up to two
//        fix rounds within a 60 s budget, then the best try is kept. Without vision (or Chrome) the validator decides.
//        A request for something with a hand-made pattern starts from the pattern (see findPattern).
// Move:  recipe (JSON schema, 3 matching examples) → validate and repair → one retry with the errors if needed.
// Every step is timed; the timings go into the job log and the bench report.
import { BIG_LAUNCHER, ARCHETYPES, ARCHETYPE_NAMES, SHAPE_NAMES, MATERIAL_NAMES, PATTERN_NAMES, AMMO, PROP_LIMITS, PROP_EXAMPLES, MOVE_EXAMPLES, CHANNEL_NAMES, MOVE_LIMITS,
  validateProp, validateMove, propSpecText, moveSpecText, guessArchetype, normColor, JEWEL, NOT_JEWEL, hiddenInBody, asHeld, FIT_GUIDE, fitReport, fitKind, VEHICLE, FLYING, SAILING, vehicleGuide, turnParts } from "../shared/craft.js";

const n3 = { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 };
export function propSchema(archetype) {
  const A = ARCHETYPES[archetype];
  const part = { type: "object", additionalProperties: false, required: ["label", "shape", "size", "at", "color", "material"], properties: {
    label: { type: "string" }, shape: { enum: SHAPE_NAMES }, size: n3, at: n3, rotate: n3, color: { type: "string" }, material: { enum: MATERIAL_NAMES },
    round: { type: "number" }, taper: { type: "number" }, hollow: { type: "boolean" }, arc: { type: "number" },
    pattern: { enum: ["none", ...PATTERN_NAMES] }, pattern_color: { type: "string" },   // Nov 4: patterns, and the bendy tube's points
    points: { type: "array", minItems: 2, maxItems: 4, items: n3 }, thick: { type: "number" } } };
  const properties = { plan: { type: "string" }, name: { type: "string" }, parts: { type: "array", minItems: 1, maxItems: A.parts || PROP_LIMITS.parts, items: part } };
  const required = ["plan", "name", "parts"];
  if (A.slot === "hand" && archetype !== "throwable") properties.hold = { enum: ["upright", "along", "aim"] };
  if (archetype === "launcher") { properties.ammo = { enum: AMMO }; properties.muzzle = n3; required.push("ammo", "muzzle"); }
  if (archetype === "throwable") properties.ammo = { enum: AMMO };
  return { type: "object", additionalProperties: false, required, properties };
}
export function moveSchema() {
  const track = { type: "array", minItems: 2, maxItems: MOVE_LIMITS.keys, items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 } };
  return { type: "object", additionalProperties: false, required: ["plan", "name", "duration", "tracks"], properties: {
    plan: { type: "string" }, name: { type: "string" }, duration: { type: "number" },
    prop: { enum: ["none", "handheld_tool", "handheld_canopy", "launcher"] },
    tracks: { type: "object", additionalProperties: false, properties: Object.fromEntries(CHANNEL_NAMES.map((c) => [c, track])) },
    events: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["t", "do"], properties: { t: { type: "number" }, do: { enum: ["pop", "open", "close", "sparkle", "hearts"] } } } },
  } };
}
const CLASSIFY_SCHEMA = { type: "object", additionalProperties: false, required: ["archetype", "name", "kind"], properties: {
  archetype: { enum: ARCHETYPE_NAMES }, name: { type: "string" }, kind: { enum: ["prop", "move"] } } };
const LOOK_SCHEMA = { type: "object", additionalProperties: false, required: ["guess", "confidence"], properties: { guess: { type: "string" }, confidence: { type: "number" } } };
const SAME_SCHEMA = { type: "object", additionalProperties: false, required: ["same"], properties: { same: { type: "boolean" } } };
const FIX_SCHEMA = { type: "object", additionalProperties: false, required: ["features", "fixes"], properties: {
  features: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } }, fixes: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } } } };

const SAFETY = "Everything Mochi makes is a soft, harmless toy. Weapons and dangerous things become toys: a gun or rifle is a water pistol or bubble blaster, a sword is a foam sword, a bomb or grenade is a confetti ball he can throw, a knife is a toy spatula. Protective gear (helmets, vests, shields, goggles) is fine and keeps its name. Nothing sharp, scary or real-looking.";

/* ---------- words */
const STOP = new Set(["a", "an", "the", "of", "and", "with", "for", "to", "my", "your", "his", "little", "small", "big", "tiny", "cute", "toy", "new", "some", "one", "make", "me", "please", "that", "this", "like", "on", "in", "it", "is", "just"]);
const COLORS = /^(red|blue|green|yellow|pink|purple|orange|white|black|brown|gold|golden|silver|grey|gray|magenta|teal|cyan|navy|violet|lilac|dark|light|bright|shiny|glowing|neon)$/;
const stem = (w) => (w.length <= 3 ? w : w.replace(/ies$/, "y").replace(/([^s])s$/, "$1").replace(/^(.{4,}?)(ing|ed)$/, "$1"));
const split = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((w) => w && !STOP.has(w));
export const words = (s) => split(s).map(stem);
const GENERIC = /^(toy|object|thing|item|shape|figure|model|device|gadget|decoration|ornament|piece|prop|stuff|something|tool|accessory|design|sculpture|kind|sort|type|plastic|small|large|tiny|cute|round|colorful|colourful)$/;
/** A guess that names nothing ("a small blue and pink toy") can't confirm anything. */
export const vague = (guess) => !split(guess).filter((w) => !COLORS.test(w) && !GENERIC.test(stem(w)) && !GENERIC.test(w)).length;
/** Does a blind guess name the same thing as the request? A shared word (not just a colour) or a word inside another. */
// words that say what a thing is like, not what it is: "striped" socks aren't a striped scarf (M5, Nov 4)
const LIKE = /^(strip|stripy|stripey|stripe|spott|spotty|dott|dotty|polka|dot|check|checker|chequer|plaid|tartan|gingham|starry|zigzag|cozy|cosy|soft|fluffy|fuzzy|furry|warm|knit|knitt|woolly|wooly|long|short|tall|fat|thin|shiny|sparkly|glittery|pretty|fancy|giant|huge|mini|christma|xmas|festive|holiday|winter|summer|cuddly|squishy|happy|smiling|smil)$/;
// the kind of thing it is, which a guess may name instead (Nov 4 bench: a tutu seen as "a pink skirt", once yes, once no)
const KIND_OF = { tutu: "skirt", kilt: "skirt", sarong: "skirt", jumper: "sweater", pullover: "sweater", sweatshirt: "sweater", frock: "dress", gown: "dress", sundress: "dress", cloak: "cape" };
export function sameWords(want, guess) {
  const content = (s) => split(s).filter((w) => !COLORS.test(w)).map(stem).filter((w) => !LIKE.test(w));
  const a = content(want), b = content(guess), kind = (w) => KIND_OF[w] || w;
  // same word, or one is the end of a compound ("smartphone" / "phone", "sunflower" / "flower"); "ball" is not a "balloon"
  return a.some((x) => b.some((y) => x === y || kind(x) === kind(y) || (Math.min(x.length, y.length) >= 4 && (x.endsWith(y) || y.endsWith(x)))));
}
/** The guess names a plain shape the thing isn't ("a yellow star-shaped toy" for a sun): the model had said yes to that
 * one (M5, Nov 4), the sun being a star. A shape the request itself has ("a heart-shaped box" for a heart box) is fine. */
export function otherShape(want, guess) {
  const m = String(guess || "").toLowerCase().match(/\b(star|heart|cross|diamond|square|triangle|crescent|moon|flower|circle|ring)[- ]shaped\b|\bshaped like an? (star|heart|cross|diamond|square|triangle|crescent|moon|flower|circle|ring)\b/);
  return !!m && !sameWords(want, m[1] || m[2]);
}
function pickExamples(list, text, n, ride = false) {   // the examples that share the most words with the request, else the first ones
  // a vehicle: its other names count ("a spaceship" is the rocket ship), and one of its kind beats a bicycle (a "jet"
  // sees the plane and the rocket ship, a "pirate ship" the ship and the sailboat, a "fire truck" the car and the train)
  const fam = ride ? (FLYING.test(String(text).toLowerCase()) ? FLY_EX : SAILING.test(String(text).toLowerCase()) ? SAIL_EX : VEHICLE.test(text) ? DRIVE_EX : null) : null;
  const norm = ride ? vehicleWords : (x) => x, want = new Set(words(norm(text)));
  return list.map((e, i) => ({ e, i, s: words(norm(e.name)).filter((w) => want.has(w)).length + (fam && fam.includes(e.name) ? 0.5 + 0.1 * (fam.length - fam.indexOf(e.name)) : 0) }))
    .sort((x, y) => y.s - x.s || x.i - y.i).slice(0, n).map((x) => x.e);
}
/* ---------- patterns he learned himself (Nov 7, Binoy: "I like these ideas"): a prop he designed from scratch that Pip
 * recognised on the first look is kept as a pattern. The next one is made from it at once, recoloured if asked, and
 * Gemma sees it as an example. One that Pip later doesn't recognise is forgotten (index.js). */
const LEARNED = { list: [] };
/** what he's learned, as kept in his memory: [{ archetype, name, recipe, at, uses }] */
export function setLearned(list) {
  LEARNED.list = (Array.isArray(list) ? list : []).filter((l) => l && ARCHETYPES[l.archetype] && l.recipe && Array.isArray(l.recipe.parts) && l.name)
    .map((l) => ({ ...l.recipe, name: l.name, archetype: l.archetype, learned: true }));
}
export const learnedFor = (archetype) => LEARNED.list.filter((e) => e.archetype === archetype);
const examplesFor = (archetype) => [...(PROP_EXAMPLES[archetype] || []), ...learnedFor(archetype)];
/** Is this result worth keeping as a pattern? Designed by Gemma (not a hand-made pattern as it is), recognised on the
 * first look with some confidence, a name that says what it is, and no pattern of that name already. */
export function learnable(r) {
  if (!r || !r.ok || !r.matched || !r.recipe || (r.pattern && r.pattern.mode === "base")) return false;
  const first = (r.attempts || []).find((a) => a.match);
  if (!first || first.round !== 0 || (first.confidence ?? 1) < 0.5) return false;
  const name = String(r.recipe.name || r.name || "").trim();
  if (!name || vague(name) || name.split(/\s+/).length > 4) return false;
  const p = findPattern(r.recipe.archetype, name);
  return !(p && p.mode === "base");
}
const FLY_EX = ["airplane", "rocket ship", "helicopter"], SAIL_EX = ["speedboat", "ship", "pirate ship", "sailboat", "submarine"], DRIVE_EX = ["car", "train"];
/* ---------- patterns: start from a hand-made example when the request names one */
// On the M5 (Nov 2, stationery runs) Gemma, shown the matching example, still wrote its own version: a blank scroll for
// "a map" next to the folded-map example, a star wand for "a globe", a ruler with its tick marks turned on end. So a
// request for something the workshop has a pattern for starts from the pattern:
//  - "base": the request is just that thing, maybe in a colour ("a map", "a pair of scissors", "a red umbrella"): the
//    pattern itself (recoloured), no model call, then the usual blind look;
//  - "adapt": the request adds its own kind to the pattern's object ("a treasure map", "a metal ruler", "a police
//    helmet" from the protective helmet): the model edits the pattern instead of starting from nothing.
// A pattern whose name carries another kind is no start ("party hat" for a pirate hat): those are designed from scratch.
const PLAIN = new Set(["folded", "wooden", "desk", "safety", "protective", "round", "potted", "classic", "simple", "pair", "set", "regular", "normal", "plain", "real",
  "yummy", "delicious", "tasty", "hot", "warm", "steaming", "fresh", "nice", "pretty", "fancy", "special", "favorite", "favourite", "lovely", "beautiful", "cool", "awesome", "super", "mini", "colorful", "colourful", "handmade", "homemade", "cozy", "cosy", "adorable", "sweet",
  "little", "small", "tiny", "big", "toy", "hand", "drawn", "draw", "drawing", "doodle", "doodled", "sketch", "sketched", "crayon", "my", "friend's",
  "glowing", "sparkly", "sparkling", "shining", "smiling", "happy", "cheerful", "smiley",   // ("a bright, glowing yellow sun" is the sun)
  "christmas", "xmas", "festive", "holiday", "winter", "wintery", "knitted", "knit", "woolly", "wooly", "fuzzy", "snuggly", "comfy", "chunky",   // (a Christmas scarf is the scarf)
  "superhero", "hero", "magic", "magical", "royal", "dress-up", "costume",   // (a superhero cape is the cape)
  "ballet", "ballerina", "frilly", "twirly", "flowy", "swishy", "fluffy", "puffy", "pleated", "summer"].map(stem));   // (a frilly ballet tutu is the tutu; not "party": a party hat is its own kind of hat)
// other words for the things there are patterns for ("an ugly Christmas jumper" is the sweater, "a hula skirt" the grass one)
const SAME_AS = { jumper: "sweater", pullover: "sweater", sweatshirt: "sweater", frock: "dress", gown: "dress", sundress: "dress", hula: "grass" };
// "a striped scarf", "a polka dot umbrella": the pattern as it is, with that pattern on it
const PATTERN_ADJ = Object.fromEntries(Object.entries({ striped: "stripes", stripy: "stripes", stripey: "stripes", stripes: "stripes", spotted: "dots", spotty: "dots", dotted: "dots", dotty: "dots", polka: "dots", dot: "dots", dots: "dots",
  checked: "checks", checkered: "checks", chequered: "checks", checks: "checks", plaid: "checks", tartan: "checks", gingham: "checks", starry: "stars", zigzag: "zigzag" }).map(([w, k]) => [stem(w), k]));   // compared after stemming ("folded" → "fold")
const SHADES = new Set(["dark", "light", "bright", "shiny", "glowing", "neon"]);
// Nov 4: the vehicles' other names ("a spaceship" is the rocket ship, "a plane" the airplane, "a boat" the sailboat,
// "a steamboat" the ship, "a choo-choo" the train), for rides only ("a rocket launcher" stays the launcher)
const VEHICLE_WORDS = [
  [/\b(space ?ships?|rocket ?ships?|rocketships?|space rockets?|space shuttles?|rockets?(?![- ]?launch))\b/g, "rocketship"],
  [/\b((?:air|aero) ?planes?|propeller planes?|prop planes?|planes?)\b/g, "airplane"],
  [/\b(helicopters?|choppers?|helis?|copters?)\b/g, "helicopter"],
  [/\b(speed ?boats?|motor ?boats?|power ?boats?|jet ?boats?|racing boats?)\b/g, "speedboat"],
  [/\b(pirate ?ships?|pirate boats?|galleons?)\b/g, "pirateship"],
  [/\b(sail ?boats?|sailing boats?|boats?|yachts?|dinghy|dinghies)\b/g, "sailboat"],
  [/\b(ships?|steam ?boats?|ocean liners?|cruise ships?|ferry|ferries|tug ?boats?)\b/g, "ship"],
  [/\b(submarines?|subs?)\b/g, "submarine"],
  [/\b(steam trains?|train engines?|steam engines?|locomotives?|choo[- ]?choo(?: trains?)?|trains?)\b/g, "train"],
];
const vehicleWords = (s) => VEHICLE_WORDS.reduce((t, [re, w]) => t.replace(re, w), String(s).toLowerCase());
const isColour = (w) => COLORS.test(w) && !SHADES.has(w);
export function findPattern(archetype, name, request = "", { loose = false } = {}) {
  const vw = archetype === "ride" ? vehicleWords : (x) => x;
  const q = words(vw(name)).map((w) => SAME_AS[w] || w), all = q.filter((w) => !isColour(w) && !SHADES.has(w) && !PLAIN.has(w));
  const qn = all.filter((w) => !PATTERN_ADJ[w]);
  if (!qn.length) return null;
  // its colours and look: from the name, else from the words just before the thing in what they asked for ("Christmas
  // scarf: a bright red and white striped scarf" is red with white stripes; "an umbrella with a white handle" isn't white)
  const desc = words(vw(String(request).split(":").slice(1).join(" ")));
  const looks = (noun) => {
    const i = desc.indexOf(noun), pre = i > 0 ? desc.slice(Math.max(0, i - 6), i) : [];
    const tints = [...q.filter(isColour), ...(q.some(isColour) ? [] : pre.filter(isColour))].filter((c, k, arr) => arr.indexOf(c) === k);
    const look = all.map((w) => PATTERN_ADJ[w]).find(Boolean) || pre.map((w) => PATTERN_ADJ[w]).find(Boolean) || null;
    return { colour: tints[0] ? normColor(tints[0]) : null, colour2: tints[1] ? normColor(tints[1]) : null, look };
  };
  // "a bazooka", "a rocket launcher": the big confetti one, as it is (looked for from another kind, it has to say it's a
  // launcher: a "toy rocket" to hold isn't the bazooka)
  if (archetype === "launcher" && BIG_LAUNCHER.test(String(name)) && (!loose || /launch|bazooka|\brpg|missile|grenade|blaster|\bgun/i.test(String(name)))) {
    const e = (PROP_EXAMPLES.launcher || []).find((x) => x.heavy);
    if (e) return { example: e, mode: "base", extra: [], ...looks(qn.at(-1)), score: 200 };
  }
  let found = null;
  for (const e of examplesFor(archetype)) {
    const ew = words(vw(e.name)), en = ew.filter((w) => !isColour(w) && !SHADES.has(w) && !PLAIN.has(w));
    if (!en.length || !qn.includes(en.at(-1))) continue;   // its object must be the request's object
    if (en.some((w) => !qn.includes(w))) continue;         // and it mustn't be another kind of that object
    const extra = qn.filter((w) => !ew.includes(w)), mode = extra.length ? "adapt" : "base";
    const score = (mode === "base" ? 100 : 0) + en.length;
    if (!found || score > found.score) found = { example: e, mode, extra, ...looks(en.at(-1)), score };
  }
  return found;
}
/** a hand-made pattern for this name, as the workshop would make it with no model at all (recoloured from what was
 * asked for), validated; null if there's none to start from as it is */
export function patternRecipe(archetype, name, request = "", { only = null } = {}) {
  const pat = findPattern(archetype, name, request);
  if (!pat || pat.mode !== "base" || (only && !only(pat.example))) return null;
  const ex = JSON.parse(JSON.stringify(pat.example)), tinted = pat.colour ? recolour(ex, pat.colour) : ex;
  const v = validateProp({ ...withLook(tinted, pat.look, pat.colour2), name, archetype }, { request: name });
  return v.recipe ? { ...v.recipe, name, archetype, request: request || name } : null;
}
/** "a striped scarf": that pattern on the parts in its main colour (glass and lights aside), in a second colour */
export function withLook(recipe, look, other = null) {
  if (!look) return recipe;
  const vol = {};
  for (const p of recipe.parts) if (p.material !== "glass" && p.material !== "glow") vol[p.color] = (vol[p.color] || 0) + p.size[0] * p.size[1] * p.size[2];
  const main = (Object.entries(vol).sort((a, b) => b[1] - a[1])[0] || [])[0];
  if (!main) return recipe;
  const second = other && other.toLowerCase() !== main.toLowerCase() ? other : main.toLowerCase() === "#ffffff" ? "#e5484d" : "#ffffff";
  return { ...recipe, parts: recipe.parts.map((p) => (p.color === main ? { ...p, pattern: look, pattern_color: second } : p)) };
}
// "a red umbrella": the colour covering the most of the pattern (glass and lights aside) becomes the asked-for colour.
export function recolour(recipe, hex) {
  const vol = {};
  for (const p of recipe.parts) if (p.material !== "glass" && p.material !== "glow") vol[p.color] = (vol[p.color] || 0) + p.size[0] * p.size[1] * p.size[2];
  const main = Object.entries(vol).sort((a, b) => b[1] - a[1])[0], total = Object.values(vol).reduce((x, y) => x + y, 0);
  if (!hex || !main || main[0].toLowerCase() === hex.toLowerCase()) return recipe;
  if (Object.entries(vol).some(([c, v]) => near(c, hex) && v >= 0.25 * total)) return recipe;   // "a yellow sun": its face already is
  return { ...recipe, parts: recipe.parts.map((p) => (p.color === main[0] ? { ...p, color: hex } : p)) };
}
// your drawing's crayons (web/stage.html): their names for Gemma, and the ones that are colour (not the black outline)
export const CRAYON_NAMES = { "#1d1a22": "black", "#e5484d": "red", "#ff9f43": "orange", "#ffd34d": "yellow", "#4fbf68": "green", "#3d8bff": "blue", "#8f6bd6": "purple", "#ff8fb8": "pink", "#8f5b36": "brown" };
/** the colours a drawing asks for, most used first: the black is outline unless it's all there is (and then: none) */
export function drawnColours(drawing) {
  if (!drawing || !Array.isArray(drawing.colours)) return [];
  return drawing.colours.map((c, i) => ({ hex: c, share: (drawing.share || [])[i] ?? 0 })).filter((c) => c.hex !== "#1d1a22" && CRAYON_NAMES[c.hex]).filter((c, i) => i === 0 || c.share >= 12).slice(0, 3).map((c) => c.hex);
}
const rgb = (h) => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const near = (a, b) => { const [x, y, z] = rgb(a), [u, v, w] = rgb(b); return Math.hypot(x - u, y - v, z - w) < 60; };
/** a pattern in your drawing's colours: its biggest colour becomes your most used crayon, its next one your second */
export function recolourAll(recipe, hexes) {
  if (!hexes || !hexes.length) return recipe;
  const vol = {};
  for (const p of recipe.parts) if (p.material !== "glass" && p.material !== "glow") vol[p.color] = (vol[p.color] || 0) + p.size[0] * p.size[1] * p.size[2];
  const ranked = Object.entries(vol).sort((a, b) => b[1] - a[1]).map(([c]) => c), map = {};
  hexes.slice(0, 2).forEach((h, i) => { if (ranked[i]) map[ranked[i]] = h; });
  return { ...recipe, parts: recipe.parts.map((p) => (map[p.color] ? { ...p, color: map[p.color] } : p)) };
}
/** did it come out in the colour they drew? (if Gemma ignored it, its biggest colour becomes theirs) */
export function keepsColour(recipe, hexes) {
  if (!hexes || !hexes.length) return recipe;
  let all = 0, theirs = 0;   // (a little red tip on a blue umbrella isn't a red umbrella: a fifth of it, at least)
  for (const p of recipe.parts) { if (p.material === "glass" || p.material === "glow") continue; const v = p.size[0] * p.size[1] * p.size[2]; all += v; if (near(p.color, hexes[0])) theirs += v; }
  return all && theirs / all >= 0.2 ? recipe : recolour(recipe, hexes[0]);
}
// a finished part as Gemma would write it: a bendy tube's stored path (inside its box) goes back to the points it passes through
const r3 = (v) => Math.round(v * 1000) / 1000;
function asWritten(p) {
  if (p.shape !== "tube" || !Array.isArray(p.path)) return p;
  const { path, thick, size, at, ...rest } = p;
  return { ...rest, points: path.map((f) => f.map((v, k) => r3(at[k] + v * size[k]))), thick: r3((thick || 0.1) * Math.max(...size)), at, size };
}
/* ---------- the short recipe (Nov 7): each part as a list instead of an object with key names, about a third fewer
 * words for Gemma to write (37% fewer characters over the hand-made patterns). Off until the M5 bench says it's as
 * good: MOCHI_CRAFT_COMPACT=on, or "options": { "compact": true } in a bench file. */
const EXTRA_KEYS = ["rotate", "round", "taper", "hollow", "arc", "pattern", "pattern_color", "points", "thick"];
export const COMPACT_NOTE = `Write each part as a list, in this order: ["label", "shape", [w, h, d], [x, y, z], "#rrggbb", "material"] (size, then its centre), with an optional seventh item {…} for anything else it needs: ${EXTRA_KEYS.map((k) => `"${k}"`).join(", ")}.`;
export function compactPart(p) {
  const w = asWritten(p), ex = {};
  for (const k of EXTRA_KEYS) if (w[k] != null && !(k === "rotate" && Array.isArray(w[k]) && w[k].every((x) => !x)) && !(k === "pattern" && w[k] === "none")) ex[k] = w[k];
  return [w.label || w.shape, w.shape, w.size, w.at, w.color, w.material, ...(Object.keys(ex).length ? [ex] : [])];
}
export function expandPart(a) {
  if (!Array.isArray(a)) return a;
  const [label, shape, size, at, color, material, ex] = a;
  return { label, shape, size, at, color, material, ...(ex && typeof ex === "object" && !Array.isArray(ex) ? ex : {}) };
}
export const expandRecipe = (raw) => (raw && Array.isArray(raw.parts) ? { ...raw, parts: raw.parts.map(expandPart) } : raw);
export function compactSchema(archetype) {
  const full = propSchema(archetype), part = full.properties.parts.items;
  const extra = { type: "object", additionalProperties: false, properties: Object.fromEntries(EXTRA_KEYS.map((k) => [k, part.properties[k]])) };
  const item = { type: "array", prefixItems: [{ type: "string" }, part.properties.shape, n3, n3, { type: "string" }, part.properties.material, extra], minItems: 6, maxItems: 7 };
  return { ...full, properties: { ...full.properties, parts: { ...full.properties.parts, items: item } } };
}
/* ---------- building from parts (Nov 7, Binoy: "build from parts"): Gemma is weakest at placing shapes in 3D, so a
 * request that needs something the hand-made patterns already have (a wheelbarrow's wheel, a windmill's propeller, a
 * panda's head) is offered that piece, ready-made. It writes one part labelled "from: <piece>" with how big it should
 * be and where it goes; the piece's own parts arrive there, scaled and turned. Offered only when the request mentions
 * something it fits, so other requests see nothing new. */
const PIECES = [
  { name: "wheel", from: "car", lead: /^front wheel$/, keep: /wheel|hub/, when: /wheel|cart|wagon|barrow|trolley|stroller|pram|cannon|scooter|skates?\b|tractor|truck|\bbus\b|kart|roller|toy car|race ?car/ },
  { name: "bicycle wheel", from: "bicycle", lead: /^front wheel$/, keep: /^front (wheel|hub|spoke)$/, when: /bike|bicycle|cycle|wheelchair|spinning wheel|ferris|hamster/ },
  { name: "propeller", from: "airplane", turn: ["y", -90], lead: /^propeller$/, keep: /^(propeller|spinner)$/, when: /propell|\bfan\b|windmill|plane|beanie|drone|motor ?boat/ },
  { name: "rotor", from: "helicopter", lead: /^rotor$/, keep: /^rotor( hub)?$/, when: /helicopter|drone|rotor|copter/ },
  { name: "umbrella canopy", from: "little blue umbrella", lead: /^canopy$/, keep: /^(canopy|top|rib tip|sphere)$/, when: /umbrella|parasol|mushroom|lamp ?shade|jellyfish|gazebo|dome/ },
  { name: "star", from: "star wand", lead: /^star$/, keep: /^star$/, when: /\bstars?\b|wand|magic|sheriff|topper|night ?light/ },
  { name: "teddy head", from: "little teddy bear", lead: /^head$/, keep: /^(head|ear|inner ear|muzzle|nose|button eye|sphere)$/, when: /bear|teddy|panda|koala|plush|stuffed|puppet/ },
  { name: "lens", from: "magnifying glass", lead: /^lens$/, keep: /^(lens|rim)$/, when: /lens|telescope|binocular|spyglass|monocle|camera|microscope|porthole|periscope|glasses/ },
  { name: "bow", from: "present", lead: /^bow$/, keep: /^bow$/, when: /\bbow\b|gift|present|ribbon|hair ?clip/ },
  { name: "candle", from: "birthday cake", lead: /^candle$/, keep: /^(candle|flame)$/, when: /candle|birthday|lantern|torch|menorah|\bcake\b/ },
  { name: "nose cone", from: "rocket ship", turn: ["z", 90], lead: /^nose cone$/, keep: /^nose cone$/, when: /rocket|missile|spaceship|lighthouse|spire/ },
];
const pieceCache = new Map();
const extent = (parts) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const p of parts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.at[k] - p.size[k] / 2); hi[k] = Math.max(hi[k], p.at[k] + p.size[k] / 2); } return { lo, hi, size: hi.map((h, k) => h - lo[k]), mid: hi.map((h, k) => (h + lo[k]) / 2) }; };
/** a piece, built: its parts centred on [0, 0, 0] at their own size, and how big it is */
export function piece(name) {
  const P = PIECES.find((x) => x.name === String(name || "").toLowerCase().trim()) || PIECES.find((x) => String(name || "").toLowerCase().includes(x.name));
  if (!P) return null;
  if (pieceCache.has(P.name)) return pieceCache.get(P.name);
  const src = Object.values(PROP_EXAMPLES).flat().find((e) => e.name === P.from);
  const nm = (p) => String(p.label || p.shape || "");   // (some parts have no name: the wand's star is its shape)
  const lead = src && src.parts.find((p) => P.lead.test(nm(p)));
  if (!lead) return null;
  // what sits in the lead part's box, with a margin (a teddy's ears stick out of its head, a flame sits on its candle)
  const near = (p) => p.at.every((v, k) => Math.abs(v - lead.at[k]) <= lead.size[k] / 2 + Math.max(0.04, 0.45 * lead.size[k]));
  const parts = src.parts.filter((p) => p === lead || (P.keep.test(nm(p)) && near(p))).map((p) => asWritten(JSON.parse(JSON.stringify(p))));
  const e0 = extent(parts);
  let centred = parts.map((p) => ({ ...p, at: p.at.map((v, k) => round3(v - e0.mid[k])), ...(p.points ? { points: p.points.map((q) => q.map((v, k) => round3(v - e0.mid[k]))) } : {}) }));
  if (P.turn) centred = turnParts(centred, P.turn[0], P.turn[1]);   // every piece comes facing you, upright (a plane's propeller faced its way)
  const e = extent(centred), out = { name: P.name, parts: centred, size: e.size.map(round3) };
  pieceCache.set(P.name, out);
  return out;
}
const round3 = (v) => Math.round(v * 1000) / 1000;
/** the pieces worth offering for this request */
export const piecesFor = (text) => PIECES.filter((P) => P.when.test(String(text || "").toLowerCase())).slice(0, 3).map((P) => piece(P.name)).filter(Boolean);
/** "from: wheel" parts become the piece's own parts, scaled to the size asked, turned and put where asked */
export function expandBorrowed(raw) {
  if (!raw || !Array.isArray(raw.parts) || !raw.parts.some((p) => p && /^\s*from\s*:/i.test(String(p.label || "")))) return raw;
  const parts = [], used = [];
  for (const p of raw.parts) {
    const m = p && /^\s*from\s*:\s*(.+)$/i.exec(String(p.label || ""));
    const pc = m && piece(m[1]);
    if (!pc) { parts.push(m ? { ...p, label: m[1].trim() } : p); continue; }
    const want = Array.isArray(p.size) && p.size.every((v) => +v > 0) ? Math.max(...p.size.map(Number)) : Math.max(...pc.size);
    const k = want / Math.max(...pc.size), r = Array.isArray(p.rotate) ? p.rotate.map(Number) : [0, 0, 0], at = Array.isArray(p.at) ? p.at.map(Number) : [0, 0, 0];
    let ps = pc.parts.map((q) => ({ ...q, size: q.size.map((v) => round3(v * k)), at: q.at.map((v) => round3(v * k)), ...(q.points ? { points: q.points.map((x) => x.map((v) => round3(v * k))) } : {}), ...(q.thick ? { thick: round3(q.thick * k) } : {}) }));
    ps = turnParts(turnParts(turnParts(ps, "z", r[2] || 0), "y", r[1] || 0), "x", r[0] || 0);   // (XYZ order, as a part's own turn)
    parts.push(...ps.map((q) => ({ ...q, at: q.at.map((v, i) => round3(v + (at[i] || 0))), label: q.label ? `${pc.name} ${q.label}`.replace(new RegExp(`^${pc.name} ${pc.name}`), pc.name) : pc.name })));
    used.push(pc.name);
  }
  return { ...raw, parts, ...(used.length ? { borrowed: used } : {}) };
}
const pieceText = (pcs) => `You can borrow ready-made pieces from his workshop: ${pcs.map((pc) => `"from: ${pc.name}" (${pc.size.map((v) => v.toFixed(2)).join(" × ")} as it comes, facing you)`).join(", ")}. To use one, write a single part whose "label" is "from: ${pcs[0].name}", with "size" for how big it should be overall, "at" for where its centre goes and "rotate" to turn it (its "shape", "color" and "material" are ignored: it keeps its own). It arrives already built. Use one only where the thing really has that piece, and build the rest yourself.`;
const partLine = (p) => JSON.stringify(Object.fromEntries(Object.entries({ label: p.label || p.shape, ...asWritten(p) }).filter(([k, v]) => !(k === "rotate" && v && v.every((x) => !x)))));
function exampleText(e, compact = false) {
  const head = { name: e.name, ...(e.hold ? { hold: e.hold } : {}), ...(e.ammo ? { ammo: e.ammo, muzzle: e.muzzle } : {}) };
  const plan = `${e.name}: ${[...new Set(e.parts.map((p) => p.label).filter(Boolean))].join(", ")}`;
  return `{"plan": ${JSON.stringify(plan)}, ${JSON.stringify(head).slice(1, -1)}, "parts": [\n  ${e.parts.map(compact ? (p) => JSON.stringify(compactPart(p)) : partLine).join(",\n  ")}\n]}`;
}

// Up to two fix rounds (three tries, each one Pip looks at): on the M5 bench (Nov 2, first 18 props, 80 s budget) a
// second fix rescued 2 props and failing ones took 50–73 s. Since Nov 4 all three tries always happen (Binoy wanted
// Pip's three looks), inside 3 minutes; the 60 s budget is for any beyond that.
// A move asked for "with the umbrella" or "fire the confetti popper" must say what he holds, and a launcher move must
// fire: the M5 bench (Nov 2) got both moves without a prop (so no umbrella, no pop). Fill them in from the request.
export function repairMoveProp(raw, request) {
  const want = guessArchetype(request), A = ARCHETYPES[want];
  const usesProp = Object.keys(raw.tracks || {}).some((c) => c.startsWith("prop.")) || /\b(with|holding|using|fire|shoot|pop|twirl(s|ing)? (the|his|my|your))\b/i.test(request);
  if (!raw.prop && A && A.slot === "hand" && (want !== "handheld_tool" || usesProp)) raw.prop = want;
  if (raw.prop === "launcher" && !(raw.events || []).some((e) => (e.do || e[1]) === "pop")) {
    const k = (raw.tracks || {})["rightArm.raise"], d = +raw.duration || 2;
    const peak = Array.isArray(k) && k.length ? k.reduce((b, x) => (x[1] > b[1] ? x : b), k[0])[0] : d * 0.45;
    raw.events = [...(raw.events || []), { t: Math.max(0.2, Math.min(d - 0.2, +peak || d * 0.45)), do: "pop" }];
  }
  return raw;
}

export function makeCrafter({ llm, renderer = null, log = console, budgetMs = 60000, fixRounds = 2, minTries = 3, maxMs = 180000, views = ["front", "three-quarter"], viewSize = 320, parallel = 1, takesOn = "first", hand = true, compact = false } = {}) {
  let shortOk = !!compact;   // the short recipe, until LM Studio turns its schema down (then the usual one, for good)
  /* ---- 1. what is it? */
  async function classify(request, context, T) {
    const t0 = Date.now();
    try {
      const r = await llm.chat({ what: "classify", schema: CLASSIFY_SCHEMA, schemaName: "classification", maxTokens: 80, temperature: 0.1,
        system: `You sort requests for Mochi's workbench. Mochi is a cute cartoon sheep who makes his own toy props and learns moves. ${SAFETY}`,
        user: [`Request: "${request}"${context ? `\nWhat they said: "${context}"` : ""}`,
          `kind: "move" if it's something he does (a dance, a wave, a bow), else "prop".`,
          `archetype (for props): ${ARCHETYPE_NAMES.map((a) => `${a} = ${ARCHETYPES[a].about}`).join("; ")}.`,
          `name: 1 to 4 words using their own words for the thing ("an umbrella" → "umbrella", "a police helmet" → "police helmet", "a riot shield" → "riot shield"). Only rename it when it has to become a harmless toy (a gun → "water pistol").`].join("\n") });
      T.classify = Date.now() - t0;
      const j = r.json || {};
      if (ARCHETYPE_NAMES.includes(j.archetype) && j.name) return { archetype: j.archetype, name: String(j.name).slice(0, 40), kind: j.kind || "prop" };
    } catch (e) { T.classify = Date.now() - t0; log.warn(`[craft] classify: ${e.message}`); }
    return { archetype: guessArchetype(request), name: String(request).split(":")[0].slice(0, 40), kind: "prop" };
  }

  /* ---- 2. a recipe */
  async function propRecipe(o, T) {
    if (!shortOk) return propRecipe1(o, T, false);
    try { return await propRecipe1(o, T, true); }
    catch (e) {
      if (e.status !== 400) throw e;
      shortOk = false; log.warn(`[craft] the short recipe was turned down (${String(e.message).slice(0, 120)}); back to the usual one`);
      return propRecipe1(o, T, false);
    }
  }
  async function propRecipe1({ request, context, archetype, name, previous, guess, fixes, base = null, drawing = null, variant = 0 }, T, short) {
    const ex1 = (e) => exampleText(e, short), pcs = piecesFor(`${name} ${String(request).split(":")[0]}`);
    const A = ARCHETYPES[archetype], ex = pickExamples(examplesFor(archetype).filter((e) => e !== base), `${name} ${request}`, base ? 1 : 2, archetype === "ride");
    const vguide = archetype === "ride" ? vehicleGuide(`${name} ${String(request).split(":")[0]}`) : null;   // a vehicle: how one is put together
    const system = [
      `You design small 3D toy props for Mochi out of simple soft shapes. Reply with one JSON object only.`,
      propSpecText(archetype),
      vguide ? `Quality: use 12 to 30 parts. First get the real thing's proportions right (compare with the examples' sizes: they are good vehicles), then add the details that make it unmistakable. Parts touch or overlap; nothing floats. Keep it symmetric where the real thing is.` : `Quality: use 5 to 14 parts. First get the real thing's proportions right (compare with the examples' sizes), then add 2 to 4 details that make it unmistakable (a handle, a rim, stripes, buttons, a little face). Parts touch or overlap; nothing floats. Keep it symmetric where the real thing is.`,
      ...(vguide ? [vguide] : []),
      ...(short ? [COMPACT_NOTE] : []),
      ...(pcs.length ? [pieceText(pcs)] : []),
      `Write "plan" first: one short sentence listing the main parts${A.slot === "body" || A.slot === "head" ? `, then where it sits on him and how big it is next to him ("round his neck, 1.25 across, ends down his chest")` : ""}. Give every part a short "label".`,
      ...(A.slot === "body" ? [FIT_GUIDE.body] : A.slot === "head" ? [FIT_GUIDE.head] : []),
      SAFETY,
    ].join("\n");
    const lines = [`Examples of finished ${archetype.replace(/_/g, " ")} props:`, ...ex.map(ex1), "", `Make: "${name}" (asked for: ${request}).${context ? ` They said: "${context}".` : ""}`];
    if (A.slot === "hand") lines.push(`It is held by its grip at [0, 0, 0].`);
    if (base && !previous) lines.push("", `Start from this finished ${base.name} and turn it into "${name}": keep its parts, sizes and positions, and change only what makes it a ${name} (colours, materials, or swap or add up to 4 details). Don't rebuild it from scratch.`, ex1(base));
    const fitRound = previous && fixes && /^It's recognised/.test(fixes[0] || "");
    if (previous) lines.push("", fitRound ? `Your last try (below) is recognised as a ${name}, but it doesn't fit Mochi yet. Make these changes and keep everything else:` : `Your last try (below) looked like "${guess}" to someone who didn't know what it was meant to be. Make these changes and keep what was right:`, ...(fitRound ? fixes.slice(1) : fixes).map((f) => `- ${f}`), JSON.stringify({ name: previous.name, parts: previous.parts.map(short ? compactPart : asWritten) }));
    const brief = !previous && variant ? ["Make your own take on it: arrange the parts differently from the examples wherever that makes it more recognisable.", "Keep it simple and bold: fewer, bigger parts, with the one shape that defines it exaggerated.", "Focus on the silhouette: someone should know what it is from its outline alone."][(variant - 1) % 3] : null;
    if (brief) lines.push("", brief);
    const look = drawing && llm.vision !== false ? [drawing.png] : null, inks = drawnColours(drawing);
    if (drawing) lines.push("", `They drew it for you${look ? " (the picture)" : ""}. Follow their drawing: its overall shape and the features they drew${inks.length ? `, in their colours: ${inks.map((h) => `${CRAYON_NAMES[h]} ${h}`).join(", ")} (most used first)` : ""}. It's a quick crayon doodle, so make a neat toy version of it, not a copy of the wobbly lines.`);
    const t0 = Date.now();
    const r = await llm.chat({ what: previous ? "fix" : "recipe", system, user: lines.join("\n"), schema: short ? compactSchema(archetype) : propSchema(archetype), schemaName: "prop", maxTokens: 2600, temperature: previous ? 0.35 : 0.55 + 0.12 * Math.min(3, variant), ...(look ? { images: look } : {}), ...(short ? { strictSchema: true } : {}) });
    T.recipes.push(Date.now() - t0); T.tokens += (r.usage && r.usage.completion_tokens) || 0;
    (T.models || (T.models = [])).push(r.provider ? `${r.provider}${r.provider === "local" ? "" : ` ${r.model}`}` : "local");   // who wrote it
    if (!r.json) throw new Error(`no JSON in the recipe reply (finish=${r.finish}, ${String(r.text).slice(0, 80)})`);
    const out = expandBorrowed(short ? expandRecipe(r.json) : r.json);
    if (out.borrowed) log.log(`[craft] ${name}: borrowed ${out.borrowed.join(", ")} from the workshop`);
    return { ...out, archetype };
  }

  // what's worn on his back is seen from behind his shoulder too (from the front a cape was just "a red collar")
  const viewsFor = (name) => (fitKind(name) === "back" && views.includes("front") ? views.map((v) => (v === "front" ? "back" : v)) : views);
  // the shelf picture of something he holds is drawn again without the stand-in hoof Pip saw it in
  async function thumb(recipe, png) {
    if (!renderer || !hand || !HELD_LOOK.has(recipe.archetype) || recipe.heavy) return png;
    try { const rr = await renderer.render(recipe, { size: viewSize, views: viewsFor(recipe.name), standIn: true, hand: false }); return rr && rr.ok ? rr.png : png; } catch (_) { return png; }
  }
  /* ---- 3. look at it (things he holds are shown held by a stand-in hoof: kit/src/render.js, Nov 7) */
  const HELD_LOOK = new Set(["handheld_tool", "handheld_canopy", "launcher", "throwable"]);
  async function look(dataUrl, archetype, T, heavy = false) {
    const t0 = Date.now(), worn = archetype === "head_wearable" ? "head" : archetype === "body_wearable" ? "body" : null, held = hand && HELD_LOOK.has(archetype) && !heavy;   // (the big launcher is carried in both arms, no stand-in)
    const r = await llm.chat({ what: "look", images: [dataUrl], schema: LOOK_SCHEMA, schemaName: "look", maxTokens: 60, temperature: 0.1,
      user: `This picture shows ${views.length === 1 ? "one view" : `${views.length} views side by side`} of one small toy object on a plain background.${worn === "body" ? " It is shown worn on a plain white mannequin (a round body with a head on top, like a snowman); ignore the mannequin and say what it is wearing." : worn ? ` It is worn on a plain white ball that stands in for a ${worn}; ignore the ball.` : held ? " It is held by a plain stand-in arm with a brown hoof; ignore the arm and say what it is holding." : ""} What object is it? Reply as JSON: {"guess": "a few words", "confidence": 0 to 1}.` });
    T.looks.push(Date.now() - t0);
    const j = r.json || {};
    return { guess: String(j.guess || r.text || "").slice(0, 60).trim() || "something", confidence: Math.max(0, Math.min(1, +j.confidence || 0)) };
  }
  async function same(name, request, guess, T) {
    if (vague(guess)) return false;   // "a small toy" says nothing about what it is
    const what = `${name} ${String(request).split(":")[0]}`;   // the thing, not how they described it
    if (sameWords(what, guess)) return true;
    if (otherShape(what, guess)) return false;   // "a star-shaped toy" is a star, not a sun
    const t0 = Date.now();
    try {
      const r = await llm.chat({ what: "same", schema: SAME_SCHEMA, schemaName: "same", maxTokens: 20, temperature: 0,
        user: `Someone made a toy "${name}" (asked for: ${request}). A viewer who didn't know what it was meant to be looked at it and said: "${guess}". Does the viewer's answer name that object, a clear synonym, or a very close relative a child would happily accept (a "squirt gun" for a water pistol, a "parasol" for an umbrella, a "ukulele" for a guitar)? A different kind of object is false; so is a vague answer that doesn't say what it is. Go by what a child would call it, not by facts: the sun is a star, but a star shape is not a sun. Reply {"same": true} or {"same": false}.` });
      T.judge.push(Date.now() - t0);
      return !!(r.json && r.json.same);
    } catch (_) { T.judge.push(Date.now() - t0); return false; }
  }
  async function critique(name, request, guess, dataUrl, recipe, T, drawing = null) {
    const t0 = Date.now();
    try {
      const r = await llm.chat({ what: "critique", images: drawing ? [dataUrl, drawing.png] : [dataUrl], schema: FIX_SCHEMA, schemaName: "fixes", maxTokens: 220, temperature: 0.2,
        user: [`This toy is meant to be "${name}" (asked for: ${request}), but a viewer who didn't know thought it was "${guess}".`,
          ...(drawing ? [`The second picture is the crayon drawing they made of it: the toy should have what they drew, in their colours.`] : []),
          `Its parts: ${recipe.parts.map((p) => `${p.label || p.shape} (${p.shape} ${p.size.join("×")} at ${p.at.join(",")})`).join("; ")}.`,
          `First, "features": the 2 or 3 things that make any ${name} recognisable at a glance, overall shape and proportions first, colour last (a pirate hat: a three-cornered hat with its brim turned up; an umbrella: a wide shallow canopy on a long thin stick).`,
          `Then "fixes": the 1 to 3 most important changes to the parts so it has those features and stops looking like "${guess}". Be concrete: which part, and its new shape, size or position, or a part to add or remove. Shape before colour.`].join("\n") });
      T.critiques.push(Date.now() - t0);
      (T.checkers || (T.checkers = [])).push(r.provider ? `${r.provider}${r.provider === "local" ? "" : ` ${r.model}`}` : "local");   // who looked it over
      const j = r.json || {}, feats = (Array.isArray(j.features) ? j.features : []).map((x) => String(x).slice(0, 160)).filter(Boolean);
      const f = (Array.isArray(j.fixes) ? j.fixes : []).map((x) => String(x).slice(0, 200)).filter(Boolean);
      if (f.length) return feats.length ? [`What makes it "${name}": ${feats.join("; ")}.`, ...f] : f;
    } catch (e) { T.critiques.push(Date.now() - t0); log.warn(`[craft] critique: ${e.message}`); }
    return [`Make the feature that defines a ${name} bigger and clearer, and remove anything that makes it look like a ${guess}.`];
  }

  /* ---- the tester on the fit (Nov 4): worn on a stand-in shaped like him, is it his size and in the right place? */
  async function fitCheck(name, dataUrl, archetype, T) {
    const t0 = Date.now(), body = archetype === "body_wearable";
    try {
      const r = await llm.chat({ what: "fit", images: [dataUrl], maxTokens: 90, temperature: 0.1, schemaName: "fit",
        schema: { type: "object", additionalProperties: false, required: ["fits", "problem"], properties: { fits: { type: "boolean" }, problem: { type: "string" } } },
        user: `This is "${name}", worn by Mochi, a round little sheep. The plain white shape is ${body ? "his body (a round ball about 1.3 wide; the bottom of his head shows at the top)" : "his head"}. Look only at how it sits on him: is it a good size for him (not swamping him, not tiny), sitting on him (not floating off him, not sunk into him), and in the right place for what it is${body ? " (a scarf round his neck, a skirt round his bottom half, a cape on his back, a badge on his chest)" : " (a hat on top, glasses over the eyes)"}? Reply as JSON {"fits": true or false, "problem": "" or the one thing to change, in a short sentence with which piece and where it should go}.` });
      T.judge.push(Date.now() - t0);
      const j = r.json || {};
      return j.fits === false && j.problem ? String(j.problem).slice(0, 200) : null;
    } catch (e) { T.judge.push(Date.now() - t0); return null; }
  }

  // None recognised: ask which try looks most like the thing (later tries can drift: a globe became a walkie-talkie
  // after two critiques). One call with every picture; without an answer, the first try (closest to the examples).
  async function pickBest(name, request, tries, T) {
    if (tries.length < 2) return tries[0];
    const t0 = Date.now();
    try {
      const r = await llm.chat({ what: "pick", images: tries.map((t) => t.dataUrl), maxTokens: 20, temperature: 0, schemaName: "pick",
        schema: { type: "object", additionalProperties: false, required: ["best"], properties: { best: { type: "integer", minimum: 1, maximum: tries.length } } },
        user: `These ${tries.length} pictures, in order (1 to ${tries.length}), are attempts at a toy "${name}" (asked for: ${request}). Which one looks most like a ${name}? Reply {"best": its number}.` });
      T.judge.push(Date.now() - t0);
      const k = Math.round(+(r.json && r.json.best)) - 1;
      if (k >= 0 && k < tries.length) return tries[k];
    } catch (e) { T.judge.push(Date.now() - t0); log.warn(`[craft] pick: ${e.message}`); }
    return tries[0];
  }

  /** Make a prop. Returns { ok, recipe, png (Buffer|null), checked, unsure, attempts, timings, error }. */
  async function craftProp({ request, context = "", archetype: forced = null, name: forcedName = null, onStep = null, drawing = null }) {
    const inks = drawnColours(drawing);   // you drew it: its colours (and, for Gemma, the picture)
    const t0 = Date.now(), T = { classify: 0, recipes: [], renders: [], looks: [], judge: [], critiques: [], tokens: 0 }, attempts = [];
    const step = (s) => { try { if (onStep) onStep(s); } catch (_) { /* the show never stops the work */ } };
    step({ phase: "plan" });
    const cls = forced ? { archetype: forced, name: forcedName || request } : await classify(request, context, T);
    let archetype = ARCHETYPES[cls.archetype] ? cls.archetype : guessArchetype(request);
    let name = cls.name || request;
    // a ring, a bracelet, a gem: he holds it up to show it (Nov 5: the model made "a gold ring" something to wear round
    // his tummy, and it sat hidden inside his fleece)
    { const what = `${name} ${String(request).split(":")[0]}`.toLowerCase(); if (archetype === "body_wearable" && JEWEL.test(what) && !NOT_JEWEL.test(what)) archetype = "handheld_tool"; }
    // a short name: their word for the thing, not the whole description (M5, Nov 3: "bright neon blue and orange water
    // blaste", cut at 40 letters, for "water blaster: a bright neon blue and orange water blaster")
    if (String(name).trim().split(/\s+/).length > 4) { const head = String(request).split(":")[0].replace(/^(a|an|the|some)\s+/i, "").trim(); name = head.split(/\s+/).length <= 4 ? head : String(name).trim().split(/\s+/).slice(-3).join(" "); }
    // a car is something he drives, unless they asked for a toy one (M5, Nov 3: the model asked for a "toy car" and he
    // couldn't get in it)
    if (archetype === "companion" && /\b(cars?|trucks?|jeeps?|vans?|bus|taxis?|convertibles?|buggy|karts?|race ?cars?|tractors?|limos?|automobiles?)\b/i.test(`${name} ${request}`) && !/\b(toy|model|tiny|mini|matchbox|hot wheels|remote[- ]control|rc)\b/i.test(context || "")) {
      archetype = "ride"; name = String(name).replace(/^(?:little |tiny |small )?toy\s+/i, "");
    }
    // a vehicle is something he rides (M5, Nov 4: "a rocket ship" was filed as a launcher and came out as his confetti
    // bazooka), unless it's a toy one to hold or a paper plane
    const vehicleName = `${name} ${String(request).split(":")[0]}`, toyOne = /\b(toy|model|tiny|mini|matchbox|hot wheels|remote[- ]control|rc|paper|origami|lego|bath|hold)\b/i.test(`${context || ""} ${name}`);
    if (archetype !== "ride" && VEHICLE.test(vehicleName) && !BIG_LAUNCHER.test(name) && !/\bjet ?packs?\b/i.test(vehicleName) && !toyOne) {
      archetype = "ride"; name = String(name).replace(/^(?:little |tiny |small )?toy\s+/i, "");
    }
    let pat = findPattern(archetype, name, request);
    const isVehicle = archetype === "ride" && VEHICLE.test(vehicleName);   // (a hot air balloon stayed a balloon on a stick: M5 bench)
    if ((!pat || pat.mode !== "base") && !isVehicle) {   // an exact pattern of another kind beats the classifier ("a traffic cone" as a hat)
      let adapt = null;
      for (const a of ARCHETYPE_NAMES) {
        const p2 = a !== archetype && !(a === "ride" && toyOne) && findPattern(a, name, request, { loose: true });   // (a toy rocket to hold isn't one he rides)
        if (p2 && p2.mode === "base") { pat = p2; archetype = a; adapt = null; break; }
        if (p2 && !pat && (!adapt || p2.score > adapt.p.score)) adapt = { p: p2, a };
      }
      if (adapt && !pat) { pat = adapt.p; archetype = adapt.a; }   // and with nothing of its own kind, an adapted one of another kind beats a blank page
    }
    // Several takes at once (Nov 7): LM Studio runs 4 requests side by side, so the first round writes `parallel`
    // different recipes together, Pip looks at each, and the one he recognises wins. A hand-made pattern as it is
    // needs no takes. With takes, one fix round follows (Pip has already had several looks).
    const takes = pat && pat.mode === "base" ? 1 : Math.max(1, Math.min(4, Math.round(parallel) || 1));
    // when: "first", all at once from the start; "miss" (the M5 bench, Nov 7: takes doubled the time of easy props),
    // one try first, and only if Pip doesn't know it, the takes: a fix of that try plus fresh designs, side by side
    const onMiss = takesOn === "miss" && takes > 1;
    const takesAt = takes > 1 ? (onMiss ? 1 : 0) : -1;
    const rounds = pat && pat.mode === "base" ? 0 : takes > 1 && !onMiss ? Math.min(fixRounds, 1) : fixRounds;   // a hand-made pattern is kept as it is
    step({ phase: "planned", name, archetype, pattern: pat ? { name: pat.example.name, mode: pat.mode } : null, takes: takesAt === 0 ? takes : 1 });
    let best = null, previous = null, guess = null, fixes = null, fitted = null;
    const tries = [], wear = archetype === "body_wearable" || archetype === "head_wearable";
    let looked = 0;   // how many designs Pip has looked at
    // the renderer draws on one page: one picture at a time
    let drawing0 = Promise.resolve();
    const draw = (rec) => { const job = drawing0.then(() => renderer.render(rec, { size: viewSize, views: viewsFor(name), standIn: true, hand })); drawing0 = job.catch(() => null); return job; };
    // one recipe: checked, drawn, looked at blind. Returns { at, recipe?, r?, seen?, ok?, final? } (final: stop here with it)
    async function evaluate(raw, round, take = null) {
      const v = validateProp(raw, { request: name });
      const at = { round, ...(take != null ? { take: take + 1 } : {}), plan: raw.plan, parts: v.recipe ? v.recipe.parts.length : 0, warnings: v.warnings.slice(0, 6), errors: v.errors };
      if (round === 0 && pat) at.pattern = `${pat.mode === "base" ? "" : "adapted from "}${pat.example.name}${pat.colour ? `, recoloured ${pat.colour}` : ""}`;
      attempts.push(at);
      step({ phase: "wrote", round, take, parts: at.parts, plan: raw.plan || null, errors: v.errors.slice(0, 2), shapes: v.recipe ? v.recipe.parts.slice(0, 8).map((p) => p.label || p.shape) : [] });
      if (!v.recipe) return { at };
      const recipe = { ...v.recipe, name, archetype, request };
      if (!renderer) return { at, recipe, final: { recipe, png: null, matched: false } };   // validator only
      const r = await draw(recipe);
      T.renders.push(r.ms || 0);
      if (!r.ok) { at.render = r.errors; return { at, recipe, final: { recipe, png: null, matched: false } }; }
      at.renderMs = r.ms;
      step({ phase: "render", round, take, img: r.dataUrl && r.dataUrl.length < 400000 ? r.dataUrl : null });
      if (llm.vision === false) return { at, recipe, r, final: { recipe, png: r.png, matched: false } };
      let seen;
      try { seen = await look(r.dataUrl, archetype, T, !!recipe.heavy); }
      catch (e) { log.warn(`[craft] vision unavailable: ${e.message}`); if (/image|vision|mmproj|multimodal/i.test(e.message)) llm.vision = false; return { at, recipe, r, final: { recipe, png: r.png, matched: false } }; }
      looked++;
      const ok = await same(name, request, seen.guess, T);
      Object.assign(at, { guess: seen.guess, confidence: seen.confidence, match: ok });
      step({ phase: "test", round, take, guess: seen.guess, pass: ok });
      return { at, recipe, r, seen, ok };
    }
    for (let round = 0; round <= rounds; round++) {
      // Pip gets three looks (Nov 4, Binoy: "increase the number of tries for pip to reject to 3, currently it seems to
      // be 2"): the 60 s budget used to stop it after two on the M5 (~25 s a try with Gemma). The first three tries
      // always happen (unless it's been 3 minutes); the budget only decides about any more. Counted in looks, not
      // rounds (Nov 7): three takes are three looks, so after a round of takes he doesn't keep you waiting for more
      // (on the M5 a third round after the takes took hard props past two minutes)
      const late = Date.now() - t0 + (T.recipes.at(-1) || 20000) + 6000;
      if (round && (looked >= minTries ? late > budgetMs : late > maxMs)) { log.log(`[craft] ${name}: out of time after ${round} tries (${looked} looks)`); break; }
      let cands;
      step({ phase: "write", round, from: round ? "fix" : pat ? pat.mode : "scratch", fixes: round ? fixes : null, ...(round === takesAt && !fitted ? { takes } : {}) });
      if (round === 0 && pat && pat.mode === "base") {   // the pattern as it is, in the colour they asked for, or the colours they drew (no wait)
        const ex = JSON.parse(JSON.stringify(pat.example));
        const tinted = inks.length ? recolourAll(ex, inks) : pat.colour ? recolour(ex, pat.colour) : ex;   // what you drew, else what you said
        const raw = { ...withLook(tinted, pat.look, pat.colour2), name, archetype, plan: `the ${pat.example.name} pattern${inks.length && !pat.colour ? ` in the colours you drew` : ""}${pat.look ? `, with ${pat.look}` : ""}` };
        cands = [await evaluate(raw, round)];
      } else if (round === takesAt && !fitted) {   // (a fitting round for something to wear stays one take)
        const base = pat ? pat.example : null;
        // (on a miss, the first take fixes what Pip saw; the others start afresh)
        const raws = await Promise.all(Array.from({ length: takes }, (_, k) => propRecipe(round && k === 0 && previous ? { request, context, archetype, name, previous, guess, fixes, drawing } : { request, context, archetype, name, previous: null, base, drawing, variant: k }, T)
          .catch((e) => { attempts.push({ round, take: k + 1, error: e.message }); log.warn(`[craft] ${name} (take ${k + 1}): ${e.message}`); return null; })));
        cands = await Promise.all(raws.map((raw, k) => (raw ? evaluate(raw, round, k) : null)));
        cands = cands.filter(Boolean);
        if (!cands.length) continue;   // every take failed to write: a fix round has nothing to start from, so it starts over
      } else {
        let raw;
        try { raw = await propRecipe({ request, context, archetype, name, previous, guess, fixes, base: round === 0 && pat ? pat.example : null, drawing }, T); }
        catch (e) { attempts.push({ round, error: e.message }); log.warn(`[craft] ${name}: ${e.message}`); if (round === 0 && !best) continue; break; }
        cands = [await evaluate(raw, round)];
      }
      const usable = cands.filter((c) => c.recipe);
      if (!usable.length) { previous = null; continue; }
      if (!best) best = { recipe: usable[0].recipe, png: null, matched: false };
      const hits = usable.filter((c) => c.ok).sort((a, b) => (b.seen.confidence - a.seen.confidence) || (a.at.warnings.length - b.at.warnings.length));
      if (!hits.length) { const fin = usable.find((c) => c.final); if (fin) { best = fin.final; break; } }
      let lead = hits[0] || null;
      if (lead) {
        if (usable.length > 1) lead.at.kept = true;
        const { recipe, r, seen } = lead;
        best = { recipe, png: r.png, matched: true, guess: seen.guess };
        // something to wear, recognised: does it fit him? Measured (too big, floating, wrong place for what it is),
        // and the tester looks at it on him; one more round to fix that, keeping this one if the fix goes wrong
        if (!wear || fitted || round === rounds || Date.now() - t0 + (T.recipes.at(-1) || 20000) + 6000 > budgetMs) break;
        const notes = fitReport(recipe);
        if (!(round === 0 && pat && pat.mode === "base")) { const p = await fitCheck(name, r.dataUrl, archetype, T); if (p) notes.push(p); }
        lead.at.fit = notes;
        if (!notes.length) break;
        step({ phase: "fit", round, fixes: notes.slice(0, 3) });
        fitted = best; fixes = [`It's recognised as a ${name}; now make it fit him, keeping how it looks:`, ...notes]; previous = recipe; guess = seen.guess;
        continue;
      }
      if (fitted) { best = fitted; break; }   // the fit round lost it: the one before
      const misses = usable.filter((c) => c.r && c.seen);
      for (const c of misses) tries.push({ recipe: c.recipe, png: c.r.png, dataUrl: c.r.dataUrl, matched: false, guess: c.seen.guess, at: c.at });
      best = tries[0];
      // several takes, none recognised: the fix starts from the one most like the thing
      lead = misses.length > 1 ? await pickBest(name, request, misses.map((c) => ({ ...c, dataUrl: c.r.dataUrl })), T) : misses[0];
      if (!lead) break;
      // An adapted pattern that isn't recognised: is the pattern itself recognisable as the thing? (A protective helmet
      // already is a police helmet; on the M5 the edited one looked like "a small blue cap or lid".) One more look, ~2 s.
      if (round === 0 && pat && pat.mode === "adapt") {
        const pv = validateProp({ ...JSON.parse(JSON.stringify(pat.example)), name, archetype }, { request: name });
        const pr = pv.recipe && { ...pv.recipe, name, archetype, request }, rr = pr && await draw(pr);
        if (rr && rr.ok) {
          T.renders.push(rr.ms || 0);
          const s2 = await look(rr.dataUrl, archetype, T).catch(() => null);
          if (s2) {
            const ok2 = await same(name, request, s2.guess, T);
            step({ phase: "test", round: "pattern", guess: s2.guess, pass: ok2, img: rr.dataUrl && rr.dataUrl.length < 400000 ? rr.dataUrl : null });
            const at2 = { round: "pattern", plan: `the ${pat.example.name} pattern as it is`, pattern: pat.example.name, parts: pr.parts.length, guess: s2.guess, confidence: s2.confidence, match: ok2 };
            attempts.push(at2);
            if (ok2) { best = { recipe: pr, png: rr.png, matched: true, guess: s2.guess }; break; }
            tries.push({ recipe: pr, png: rr.png, dataUrl: rr.dataUrl, matched: false, guess: s2.guess, at: at2 });
          }
        }
      }
      if (round === rounds) break;
      step({ phase: "critique", round });
      fixes = await critique(name, request, lead.seen.guess, lead.r.dataUrl, lead.recipe, T, drawing); lead.at.fixes = fixes;
      step({ phase: "fix", round, fixes: fixes.slice(-3) });
      previous = lead.recipe; guess = lead.seen.guess;
    }
    if (best && !best.matched && tries.length > 1) { best = await pickBest(name, request, tries, T); if (best.at) best.at.kept = true; }
    if (best && inks.length) {   // in the colour they drew, even if Gemma forgot
      const kept = keepsColour(best.recipe, inks);
      if (kept !== best.recipe) {
        let png = null; if (renderer) { try { const rr = await renderer.render(kept, { size: viewSize, views: viewsFor(name), standIn: true, hand }); if (rr && rr.ok) png = rr.png; } catch (_) { /* its picture is redrawn later */ } }
        best = { ...best, recipe: kept, png }; attempts.push({ round: "colour", plan: `recoloured ${CRAYON_NAMES[inks[0]]}, the colour you drew` });
      }
    }
    if (drawing) attempts.push({ round: "drawing", plan: `followed your drawing${inks.length ? ` (${inks.map((h) => CRAYON_NAMES[h]).join(", ")})` : ""}` });
    if (best && best.png) best = { ...best, png: await thumb(best.recipe, best.png) };   // its shelf picture: on its own
    const ms = Date.now() - t0;
    const timings = { total: ms, classify: T.classify, recipes: T.recipes, renders: T.renders, looks: T.looks, judge: T.judge, critiques: T.critiques, tokens: T.tokens, models: T.models || (pat && pat.mode === "base" ? ["pattern"] : ["local"]), ...(T.checkers ? { checkers: T.checkers } : {}) };
    if (!best) return { ok: false, error: attempts.map((a) => a.error || a.errors && a.errors.join(", ")).filter(Boolean).join("; ") || "no usable recipe", attempts, timings, archetype, name };
    // something to wear that nothing of reaches past his body would be worn out of sight: he holds it up instead
    if (hiddenInBody(best.recipe)) { log.log(`[craft] ${name}: worn, it would be hidden inside him; he'll hold it up instead`); best.recipe = asHeld(best.recipe); archetype = "handheld_tool"; }
    return { ok: true, recipe: best.recipe, png: best.png, checked: llm.vision !== false && !!renderer, matched: best.matched, unsure: !best.matched && llm.vision !== false && !!renderer, guess: best.guess || null, attempts, timings, archetype, name, pattern: pat ? { name: pat.example.name, mode: pat.mode, ...(pat.example.learned ? { learned: true } : {}) } : null };
  }

  /** Make a move. Returns { ok, recipe, attempts, timings, error }. */
  // "the soup bowl is too plain, give it noodles": the prop they already have, changed the way they said and nothing
  // else. One recipe call from the current version (no look-and-fix rounds: they'll say if it still isn't right).
  async function remakeProp({ recipe, change, onStep = null }) {
    const t0 = Date.now(), T = { classify: 0, recipes: [], renders: [], looks: [], judge: [], critiques: [], tokens: 0 };
    const step = (s) => { try { if (onStep) onStep(s); } catch (_) { /* the show never stops the work */ } };
    // a vehicle that was made as something else (M5, Nov 4: the rocket ship, made as a launcher; "make it look more like
    // a real spaceship with windows and fins instead of a launcher" kept it one): made again as something he rides
    if (recipe.archetype !== "ride" && VEHICLE.test(String(recipe.name)) && !BIG_LAUNCHER.test(String(recipe.name)) && !/\b(toy|model|tiny|mini|paper|jet ?pack)\b/i.test(String(recipe.name))) {
      const r = await craftProp({ request: `${recipe.name}: ${String(change).slice(0, 160)}`, archetype: "ride", name: recipe.name, onStep });
      if (!r.ok) return { ok: false, error: r.error, timings: r.timings };
      return { ok: true, recipe: r.recipe, png: r.png, plan: `made it again as something he rides${r.pattern ? ` (from the ${r.pattern.name} pattern)` : ""}`, remade: true, matched: r.matched, guess: r.guess, timings: r.timings };
    }
    step({ phase: "write", round: 0, from: "change", fixes: [String(change).slice(0, 160)] });
    const archetype = ARCHETYPES[recipe.archetype] ? recipe.archetype : guessArchetype(recipe.name), A = ARCHETYPES[archetype], name = recipe.name;
    const system = [
      `You change small 3D toy props for Mochi, made of simple soft shapes. Reply with one JSON object only.`,
      propSpecText(archetype), ...(archetype === "body_wearable" ? [FIT_GUIDE.body] : archetype === "head_wearable" ? [FIT_GUIDE.head] : []),   // (something to wear still has to fit him)
      ...(archetype === "ride" && vehicleGuide(name) ? [vehicleGuide(name)] : []), SAFETY,   // (and a vehicle is still built like one)
    ].join("\n");
    const keep = { name, parts: recipe.parts.map(asWritten), ...(recipe.muzzle ? { muzzle: recipe.muzzle } : {}), ...(recipe.ammo ? { ammo: recipe.ammo } : {}), ...(recipe.hold ? { hold: recipe.hold } : {}), ...(recipe.heavy ? { heavy: true } : {}) };
    const user = [`Here is "${name}" as it is now:`, JSON.stringify(keep), "",
      `They looked at it and said: "${String(change).slice(0, 300)}".`,
      `Change it so that's fixed, and keep everything else as it is: the same parts, sizes, positions and colours unless the change needs them different. Write "plan" first: one short sentence saying what you changed. Reply with the whole prop.`,
      ...(A.slot === "hand" ? [`It is held by its grip at [0, 0, 0].`] : [])].join("\n");
    let raw;
    try {
      const r = await llm.chat({ what: "remake", system, user, schema: propSchema(archetype), schemaName: "prop", maxTokens: 2600, temperature: 0.3 });
      T.recipes.push(Date.now() - t0); T.tokens += (r.usage && r.usage.completion_tokens) || 0;
      T.models = [r.provider ? `${r.provider}${r.provider === "local" ? "" : ` ${r.model}`}` : "local"];
      if (!r.json) throw new Error(`no JSON in the remake (finish=${r.finish})`);
      raw = { ...r.json, archetype, name, ...(recipe.heavy ? { heavy: true } : {}) };   // the big launcher stays the big one
    } catch (e) { return { ok: false, error: e.message, timings: { total: Date.now() - t0, models: T.models || ["local"] } }; }
    const v = validateProp(raw, { request: name });
    if (!v.recipe) return { ok: false, error: v.errors.join(", ") || "no usable recipe", timings: { total: Date.now() - t0, models: T.models } };
    const out = { ...v.recipe, name, archetype, request: recipe.request || name };
    let png = null, dataUrl = null;
    step({ phase: "wrote", round: 0, parts: out.parts.length, plan: raw.plan || null, shapes: out.parts.slice(0, 8).map((p) => p.label || p.shape) });
    const pic = async (rec, round) => { if (!renderer) return null; try { const rr = await renderer.render(rec, { size: viewSize, views: viewsFor(name), standIn: true, hand }); T.renders.push(rr.ms || 0); if (rr.ok) { step({ phase: "render", round, img: rr.dataUrl && rr.dataUrl.length < 400000 ? rr.dataUrl : null }); return rr; } } catch (_) { /* no picture */ } return null; };
    const r0 = await pic(out, 0); if (r0) { png = r0.png; dataUrl = r0.dataUrl; }
    // Pip tests a fix too (Nov 4: the rocket ship's fix, a pole with its nose cone floating beside it, went out
    // untested): recognised, it's done; not, another go from what Pip saw (up to three tries); the first one Pip
    // recognises is kept, else the change as first made
    let best = { recipe: out, png, matched: null, guess: null };
    if (dataUrl && llm.vision !== false) {
      try {
        const seen = await look(dataUrl, archetype, T), ok = await same(name, recipe.request || name, seen.guess, T);
        best.matched = ok; best.guess = seen.guess;
        step({ phase: "test", round: 0, guess: seen.guess, pass: ok });
        // up to three tries, each one Pip looks at (Nov 4: it was two), inside 3 minutes
        let cur = out, curUrl = dataUrl, curGuess = seen.guess;
        for (let round = 1; !best.matched && round < minTries && Date.now() - t0 + 30000 < maxMs; round++) {
          const fixes = await critique(name, recipe.request || name, curGuess, curUrl, cur, T);
          step({ phase: "write", round, from: "critique", fixes: fixes.slice(0, 3) });
          const raw2 = await propRecipe({ request: `${name}: ${String(change).slice(0, 200)}`, context: "", archetype, name, previous: cur, guess: curGuess, fixes: [...fixes, `Keep the change they asked for: ${String(change).slice(0, 160)}`] }, T);
          const v2 = validateProp({ ...raw2, archetype, name, ...(recipe.heavy ? { heavy: true } : {}) }, { request: name });
          if (!v2.recipe) break;
          const out2 = { ...v2.recipe, name, archetype, request: recipe.request || name }, r2 = await pic(out2, round);
          if (!r2 || !r2.dataUrl) break;
          const s2 = await look(r2.dataUrl, archetype, T), ok2 = await same(name, recipe.request || name, s2.guess, T);
          step({ phase: "test", round, guess: s2.guess, pass: ok2 });
          if (ok2) best = { recipe: out2, png: r2.png, matched: true, guess: s2.guess };
          cur = out2; curUrl = r2.dataUrl; curGuess = s2.guess;
        }
      } catch (e) { log.warn(`[craft] testing the fix: ${e.message}`); }
    }
    return { ok: true, recipe: best.recipe, png: best.png ? await thumb(best.recipe, best.png) : null, plan: raw.plan || null, matched: best.matched, guess: best.guess, warnings: v.warnings, timings: { total: Date.now() - t0, recipes: T.recipes, renders: T.renders, looks: T.looks, judge: T.judge, critiques: T.critiques, tokens: T.tokens, models: T.models, ...(T.checkers ? { checkers: T.checkers } : {}) } };
  }

  async function craftMove({ request, context = "", onStep = null }) {
    const t0 = Date.now(), attempts = [], T = { recipes: [], tokens: 0 };
    const step = (s) => { try { if (onStep) onStep(s); } catch (_) { /* the show never stops the work */ } };
    const name = String(request).split(":")[0].trim().slice(0, 40) || "a move";
    const ex = pickExamples(MOVE_EXAMPLES, request, 3);
    const system = [`You choreograph short animations for Mochi. Reply with one JSON object only.`, moveSpecText(),
      `Write "plan" first: one short sentence (the beats and their timing). Use only the channels the move needs; leave the others out. Use "prop": "none" unless the move needs something in his hoof.`].join("\n");
    let errs = null;
    for (let round = 0; round < 2; round++) {
      const user = [`Examples:`, ...ex.map((e) => JSON.stringify({ plan: e.name, name: e.name, duration: e.duration, prop: e.prop || "none", tracks: e.tracks, ...(e.events ? { events: e.events.map(([t, d]) => ({ t, do: d })) } : {}) })),
        "", `Make the move: "${name}" (asked for: ${request}).${context ? ` They said: "${context}".` : ""}`, ...(errs ? ["", `Your last try was rejected: ${errs.join("; ")}. Fix that.`] : [])].join("\n");
      const s0 = Date.now();
      step({ phase: "write", round, from: round ? "fix" : "move", fixes: errs ? errs.slice(0, 2) : null });
      try {
        const r = await llm.chat({ what: round ? "move-fix" : "move", system, user, schema: moveSchema(), schemaName: "move", maxTokens: 1800, temperature: 0.5 });
        T.recipes.push(Date.now() - s0); T.tokens += (r.usage && r.usage.completion_tokens) || 0;
        (T.models || (T.models = [])).push(r.provider ? `${r.provider}${r.provider === "local" ? "" : ` ${r.model}`}` : "local");
        const raw = r.json || {};
        if (raw.prop === "none") delete raw.prop;
        repairMoveProp(raw, request);
        const v = validateMove({ ...raw, name }, { request: name });
        attempts.push({ round, plan: raw.plan, warnings: v.warnings.slice(0, 6), errors: v.errors, tracks: v.recipe ? Object.keys(v.recipe.tracks).length : 0 });
        step({ phase: "test", round, move: true, pass: !!v.recipe, guess: v.recipe ? `${Object.keys(v.recipe.tracks).length} channels, ${v.recipe.duration} s, all in range` : (v.errors[0] || "doesn't play") });
        if (v.recipe) return { ok: true, recipe: v.recipe, attempts, timings: { total: Date.now() - t0, recipes: T.recipes, tokens: T.tokens, models: T.models || ["local"] }, name };
        errs = v.errors;
      } catch (e) { T.recipes.push(Date.now() - s0); attempts.push({ round, error: e.message }); errs = [e.message]; }
    }
    return { ok: false, error: (errs || []).join("; ") || "no usable move", attempts, timings: { total: Date.now() - t0, recipes: T.recipes, tokens: T.tokens, models: T.models || ["local"] }, name };
  }

  return { classify: (r, c) => classify(r, c, { classify: 0 }), craftProp, remakeProp, craftMove };
}
