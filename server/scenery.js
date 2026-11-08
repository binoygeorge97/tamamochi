// What his words put on the stage (Nov 5, Binoy, after a detective game: "there arent a lot of the props he says for
// the scene like bush or twig (wouldnt it be better if these generated for the story)").
//
// A line of his that puts something in front of him ("there's a tiny crumb right here near my hoof", "tracks leading
// toward the bushes", "blue fuzz caught on this twig") brings it on: the common outdoor things at once
// (shared/scenery.js), anything else from the ones made before, and otherwise it's made at the workbench in one quick
// go (no rounds with Pip: it's set dressing, and the story won't wait) and turns up a moment later, then kept for next
// time. Only when he's in the middle of a game or a story, or the line really points at it ("there's…", "look…",
// "this…"): "I love climbing trees" in a chat doesn't grow a tree.
import { sceneryIn } from "../shared/scenery.js";

const SCENE_MS = 5 * 60000;
// it's here, in front of him: the line points at it
const HERE = /\b(?:there'?s|there are|here'?s|here is|right here|over there|look(?:!|,| at| over)|i see|i found|found (?:a|an|some|the)|see (?:that|this|those|these)|this|these|that one|near|next to|behind|under(?:neath)?|beside|toward(?:s)?|caught on|on top of|in front of|watch out for|careful of|step(?:ped)? on)\b/i;
// "there's a shiny X", "I found an old X": a thing named after one of those, for the ones not ready-made
const NAMED = /\b(?:there'?s|there are|here'?s|i see|i found|found|look at|spotted|behind|under(?:neath)?|next to|near|beside|toward(?:s)?|caught on|on top of|in front of)\s+(?:a|an|the|this|that|some|these|those|two|three)\s+((?:(?:tiny|little|small|big|giant|huge|old|shiny|secret|mysterious|sparkly|glowing|wooden|golden|silver|red|blue|green|yellow|orange|purple|pink|brown|black|white|grey|gray|muddy|broken|open|closed|squishy)\s+){0,2})([a-z]{3,}(?:\s+[a-z]{3,})?)\b/gi;
// not things to put down: places, people, feelings, body parts, the sky, what he's holding, words that aren't objects
const NOT_A_THING = /^(?:way|time|moment|minute|second|idea|plan|clue|clues|mystery|case|game|story|thing|things|something|anything|lot|bit|piece|sound|noise|smell|feeling|friend|friends|buddy|mimi|cocoa|mochi|you|me|him|her|them|hoof|hooves|nose|ear|ears|tail|tummy|head|face|eyes|paw|paws|ground|floor|sky|air|moon|sun|stars?|world|planet|space|room|stage|screen|corner|side|left|right|top|bottom|middle|edge|end|start|path|trail|place|spot|area|other|one|ones|kind|sort|type|look|magnifying|glass|map|backpack|telescope|camera|book|clue|answer|question|surprise|adventure|treasure|detective|suspect|culprit|day|night|morning|evening|way)$/i;

export function makeScenery({ memory, crafter = null, broadcast = () => {}, log = console } = {}) {
  let making = null, made = [];   // one at a time; a few an hour
  const cache = () => memory.get("scenery.made", {});
  const scene = () => { const s = memory.get("scene", null); return s && Date.now() - s.at < SCENE_MS ? s : { at: 0, items: [] }; };
  const mark = (names) => { const s = scene(); memory.set("scene", { at: Date.now(), items: [...new Set([...s.items, ...names])].slice(-12) }); };
  const live = (playing) => playing || Date.now() - scene().at < SCENE_MS;

  /** the scenery one of his lines brings on now (and starts making anything new); playing: a game or story is on */
  function fromLine(text, { playing = false } = {}) {
    const t = String(text || ""), on = live(playing), have = scene().items, now = [];
    const sentences = t.split(/(?<=[.!?…])\s+/);
    for (const s of sentences) {
      if (!on && !HERE.test(s)) continue;
      for (const it of sceneryIn(s, { max: 3, skip: have.concat(now.map((x) => x.key)) })) now.push(it);
      // anything else it points at: made before (here at once), or made now (here in a moment)
      for (const m of s.matchAll(NAMED)) {
        const adj = (m[1] || "").trim(), noun = m[2].toLowerCase().replace(/\s+(?:right|here|there|near|by|on|in|at|to|of|with|leading|caught|over|and|or|but|that|which|who|behind|under|beside|next|toward|towards|from|is|was|looks|just|so|too|again)$/, "");
        const head = noun.split(/\s+/).pop();
        if (NOT_A_THING.test(head) || NOT_A_THING.test(noun) || now.some((x) => x.key === noun || x.key === head) || have.includes(noun) || sceneryIn(noun).length) continue;
        const c = cache()[noun];
        if (c) now.push({ name: noun, key: noun, at: c.at || "side", scale: /tiny|little|small/.test(adj) ? 0.75 : /big|giant|huge/.test(adj) ? 1.3 : 1, recipe: c.recipe });
        else make(`${adj ? `${adj} ` : ""}${noun}`, noun);
      }
    }
    const out = now.slice(0, 4);
    if (out.length) mark(out.map((x) => x.key));
    return out;
  }

  /** one quick go at the workbench for something not ready-made; it turns up if the story's still on */
  function make(what, key) {
    if (!crafter || making) return;
    made = made.filter((at) => Date.now() - at < 36e5);
    if (made.length >= 8) return;
    made.push(Date.now());
    making = key;
    const t0 = Date.now();
    crafter.craftProp({ request: `${what}: ${what}, sitting on the ground as set dressing for a pretend-play scene (simple, chunky, cute, about knee-high to a small sheep unless it's tiny)`, archetype: "companion", name: key })
      .then((r) => {
        if (!r || !r.ok || !r.recipe) return log.log && log.log(`[scenery] couldn't make "${what}"`);
        const big = (r.recipe.parts || []).reduce((h, p) => Math.max(h, (p.at ? p.at[1] : 0) + (p.size ? p.size[1] / 2 : 0)), 0);
        const at = big > 1.1 ? "back" : big > 0.45 ? "side" : "near";
        const all = cache(); all[key] = { recipe: { ...r.recipe, name: key }, at }; memory.set("scenery.made", Object.fromEntries(Object.entries(all).slice(-60)));
        log.log && log.log(`[scenery] made "${what}" in ${Math.round((Date.now() - t0) / 1000)} s${live(false) ? "; onto the stage" : " (kept for next time)"}`);
        if (live(false)) { mark([key]); broadcast({ type: "scenery", items: [{ name: key, key, at, scale: /tiny|little|small/.test(what) ? 0.75 : 1, recipe: all[key].recipe }] }); }
      })
      .catch((e) => log.warn && log.warn(`[scenery] ${what}: ${e.message}`))
      .finally(() => { making = null; });
  }

  /** a game or story started: the scene is on (anything it brings comes on without pointing) */
  const begin = () => mark([]);
  const clear = () => memory.set("scene", { at: 0, items: [] });
  return { fromLine, begin, clear, get making() { return making; } };
}
