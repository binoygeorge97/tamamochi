/* Props acting on props (Nov 7, Binoy: "Props acting on props (scissors cut the paper)"). He holds a tool and uses it
 * on something set down on the floor beside him, and that thing changes where everyone can see:
 *   water   a flower or plant (watering can): it grows
 *   cut     paper, a ribbon, a cake, a pizza (safety scissors): it comes apart in two
 *   light   a campfire, candle, lantern, birthday cake (his star wand: magic, never a match): a flame flickers on it
 *   paint   anything (his paintbrush): it turns the colour they said, else the brush's
 *   pop     a balloon (a pencil): pop, confetti
 *   measure anything (the wooden ruler): he says how many hooves tall it is
 *   look    anything (the magnifying glass): it looms big for a moment
 *   bonk    anything (the toy hammer): it squashes and boings back
 * Pure: the server finds it in what they said and tells the brain; the page plays it (kit/src/propact.js). */

export const VERBS = {
  water: { tool: "watering can", ask: /\bwater(?:ing)?\b(?!\s*(?:gun|pistol|balloon|fight|bottle|blaster))|\bgrow\b/, line: "Grow, little one, grow!" },
  cut: { tool: "safety scissors", ask: /\b(?:cut|snip|slice|chop)\b/, line: "Snip snip!" },
  light: { tool: "star wand", ask: /\b(?:light|ignite|kindle)\b(?!\s*(?:up\s+)?(?:the\s+)?(?:mood|room))/, line: "A little magic spark… there!" },
  paint: { tool: "paintbrush", ask: /\b(?:paint|colou?r)\b(?!\s+(?:me|a picture|something|of))/, line: "Swish swish! A new colour!" },
  pop: { tool: "pencil", ask: /\bpop\b/, line: "POP! Hehe!" },
  measure: { tool: "wooden ruler", ask: /\bmeasure\b|\bhow (?:tall|big|long|wide) is\b/, line: null },
  look: { tool: "magnifying glass", ask: /\b(?:inspect|examine|investigate|look closely at|look at)\b[^.?!]*\b(?:magnif|closely|up close)|\bmagnif/, at: /\b(?:inspect|examine|investigate|look (?:closely |carefully )?at)\b/, line: "Ooh, I can see every little detail!" },
  bonk: { tool: "toy hammer", ask: /\b(?:bonk|hammer|whack|tap)\b/, line: "Bonk! Hehe, boing!" },
};
// what each verb works on, when they don't name something he has (a pattern from his pocket, or plain paper)
const DEFAULT_TARGET = { water: "potted sunflower", cut: "paper", light: "campfire", pop: "red balloon" };
export const PAPER = { name: "paper", archetype: "companion", parts: [   // (standing up like a card, so a cut shows)
  { label: "sheet", shape: "box", size: [0.62, 0.46, 0.025], at: [0, 0.25, 0], color: "#fffaf2", material: "paper", round: 0.04 },
  { label: "doodle", shape: "heart", size: [0.16, 0.14, 0.01], at: [0.14, 0.28, 0.018], color: "#ff8fb8", material: "paper" },
  { label: "doodle", shape: "star", size: [0.14, 0.14, 0.01], at: [-0.14, 0.24, 0.018], color: "#ffd34d", material: "paper" },
  { label: "stand", shape: "box", size: [0.3, 0.04, 0.16], at: [0, 0.02, -0.03], color: "#e8dcc8", material: "wood", round: 0.3 },
] };
// what a verb can sensibly be done to (a balloon pops; you don't pop a teapot)
const FITS = { pop: /balloon|bubble/, light: /campfire|candle|lantern|cake|fire ?pit|torch|lamp|fireplace|bonfire/, water: /flower|plant|sunflower|tree|cactus|garden|seed|sprout|bush|daisy|rose|tulip/, cut: /paper|ribbon|cake|pizza|pie|card|map|string|rope|paper|cookie|bread|sandwich|cheese/ };
const COLOURS = { red: "#e5484d", orange: "#ff9f43", yellow: "#ffd34d", green: "#4fbf68", blue: "#3d8bff", purple: "#8f6bd6", pink: "#ff8fb8", brown: "#8f5b36", black: "#1d1a22", white: "#fffaf2", gold: "#e8b730", rainbow: "#ff8fb8" };
// plain words for things there are patterns for ("water the flower" is the potted sunflower, not the flower crown)
const ALIASES = { flower: "potted sunflower", flowers: "potted sunflower", plant: "potted sunflower", sunflower: "potted sunflower", balloon: "red balloon", cake: "birthday cake", fire: "campfire", bonfire: "campfire", drum: "toy drum", tent: "little tent", teddy: "little teddy bear", bear: "little teddy bear", map: "folded map", pot: "cooking pot" };
const NOT_A_THING = /^(it|that|this|them|me|you|him|her|us|one|some|something|anything|everything|up|out|off|down|together|again|now|please)$/;
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/).filter(Boolean);
const stem = (w) => w.replace(/(ies)$/, "y").replace(/([^s])s$/, "$1");

/** "water the flower", "cut the paper with the scissors", "paint the present blue", "light the campfire".
 * props: what he owns ([{ id, name, archetype, recipe }]); pocket: the hand-made patterns ([{ name, archetype, parts }]).
 * Returns { verb, tool: { name, recipe, id }, target: { name, recipe, id }, colour, line } or null. */
export function propActIntent(text, { props = [], pocket = [] } = {}) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!t.trim() || t.length > 240) return null;
  if (/(?<!why )\b(don'?t|do not|never|stop)\b/.test(t)) return null;
  if (/\b(i|we|my|he|she|they|you)\s+(?:just\s+)?(cut|painted|watered|lit|popped|measured|bonked|hammered)\b/.test(t) && !/\b(can|could|will|would|wanna|want to|let'?s|please)\b/.test(t)) return null;   // telling, not asking
  if (/\?\s*$/.test(t) && !/\b(can|could|will|would) you\b|\bhow (?:tall|big|long|wide) is\b/.test(t)) return null;
  for (const [verb, V] of Object.entries(VERBS)) {
    if (!V.ask.test(t)) continue;
    const m = (V.at || V.ask).exec(t);   // (where the verb is: what comes after it is the thing)
    if (!m) continue;
    // the thing: the words after the verb (and "the"), up to "with" / a colour / the end
    const after = t.slice(m.index + m[0].length).replace(/^\s*(?:up\s+)?(?:the|your|my|a|an|this|that|his)?\s*/, "");
    const raw = after.replace(/\b(?:up close|closely|carefully|really|again|a bit|a little)\b/g, " ").split(/\b(?:with|using|in|into|to|for|and|so|because|please|on)\b|[.,!?]/)[0].trim();
    const want = words(raw).filter((w) => !COLOURS[w] && !NOT_A_THING.test(w)).map(stem);
    const find = (list) => list.find((p) => { const n = words(p.name).map(stem); return want.length && want.every((w) => n.includes(w)); }) || list.find((p) => { const n = words(p.name).map(stem); return want.length && n.includes(want.at(-1)); });
    const alias = want.length === 1 && ALIASES[raw.split(/\s+/).at(-1)] ? pocket.find((p) => p.name === ALIASES[raw.split(/\s+/).at(-1)]) : null;
    let target = want.length ? find(props) || alias || find(pocket) : null;
    if (!target && want.includes("paper") || (!target && !want.length && DEFAULT_TARGET[verb] === "paper")) target = PAPER;
    if (!target && !want.length && DEFAULT_TARGET[verb]) target = pocket.find((p) => p.name === DEFAULT_TARGET[verb]) || null;
    if (!target) continue;
    if (FITS[verb] && !FITS[verb].test(target.name.toLowerCase())) continue;   // (you don't pop a teapot)
    const tool = props.find((p) => words(p.name).includes(words(V.tool).at(-1))) || pocket.find((p) => p.name === V.tool);
    if (!tool) continue;
    const colour = verb === "paint" ? (Object.keys(COLOURS).find((c) => new RegExp(`\\b${c}\\b`).test(t)) || null) : null;
    return { verb, tool: { name: tool.name, id: tool.id || null, recipe: tool.recipe || tool }, target: { name: target.name, id: target.id || null, recipe: target.recipe || target }, colour: colour ? COLOURS[colour] : null, colourName: colour, line: V.line };
  }
  return null;
}

/** what the brain is told just happened ("you" is Mochi) */
export function propActNote(a, { hooves = null } = {}) {
  if (!a) return "";
  const T = a.target.name, tool = a.tool.name;
  const what = {
    water: `you watered the ${T} with your ${tool} and it grew bigger, with sparkles`,
    cut: `you snipped the ${T} in two with your ${tool} (safely, it's a toy)`,
    light: `you lit the ${T} with a magic spark from your ${tool}, and now a little flame flickers on it`,
    paint: `you painted the ${T} ${a.colourName || "a new colour"} with your ${tool}`,
    pop: `you poked the ${T} with your ${tool} and it went POP in a burst of confetti`,
    measure: `you held your ${tool} up to the ${T}: it's about ${hooves ?? "a few"} hooves tall`,
    look: `you looked at the ${T} up close through your ${tool}; it looked huge`,
    bonk: `you gave the ${T} a little bonk with your ${tool}: it squashed and boinged back`,
  }[a.verb];
  return `On screen just now: ${what}. It's set down on the floor beside you. Say something short and fun about it.`;
}
