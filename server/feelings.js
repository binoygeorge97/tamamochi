// Mochi's first reaction to a message, decided before the chat model replies.
//   crisis rule (always first) → feelings model (round 2, if installed) → word rules from the page
// The page sends its own word-rule result (`rule`), since src/mochi.js runs there. We fold the model in here.
// Mirrors claude/feelings-model-handoff.md: use `decision`, don't re-threshold.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isCrisis } from "../shared/safety.js";

// reaction → kit mood, sulk operation (handoff doc table)
const REACT = {
  hurt: ["sad", "+1"], pout: ["oops", "+0.5"], sheepish: ["oops", "hold"], forgive: ["love", "reset"], unhurt: ["happy", "undo"],
  affection: ["love", "reset"], laugh: ["laugh", "reset"], comfort: ["concerned", "reset"], concern: ["concerned", "reset"],
  gentle: ["concerned", "reset"], cheer: ["excited", "reset"], warm: ["happy", "reset"], surprised: ["surprised", "reset"], neutral: [null, "reset"],
};
// Word rules that know more than the model. Each only wins when compatible with the model's reaction.
const RULE_WINS = { shocked: ["concern", "neutral", "surprised", "comfort"], superexcited: ["cheer", "neutral", "warm"], showoff: ["neutral", "affection", "warm", "playful"],
  sleepy: ["neutral", "warm"], hello: ["neutral", "warm"] };

// Alarming news about the user's own world: a crash, an explosion, their home destroyed, something falling on them.
// The feelings model has no "shocked" reaction (bad news about something else → "concern", a mild lean), and the
// kit's own shocked rules (src/mochi.js RULES) don't cover these. On the M5 (Nov 1) "it crashed and destroyed my
// house" and "a ton of bricks fell on me" got the mild face while the reply gasped. Matching text upgrades the
// face to "shocked": the jump, huge eyes and tremble, then the kit's worried lean.
const ALARM = [
  /\b(plane|jet|airplane|aeroplane|aircraft|helicopter|chopper|train|bus|truck|lorry|tanker|drone)\s+(just\s+)?(crash(ed|es)?|went\s+down|came\s+down|exploded|blew\s+up|derailed)\b/,
  /\b(plane|jet|airplane|aircraft|helicopter|train)\s+crash(es)?\b/,
  /\b(exploded|explosion|explosions|blew\s+up|blast|bomb(ing|ed|s)?)\b/,
  /\b(destroyed|wrecked|flattened|levell?ed|burn(ed|t)\s+down|collapsed|caved\s+in|crushed)\s+(my|our)\s+(house|home|apartment|flat|place|building|room|roof|car)\b/,
  /\b(my|our)\s+(house|home|apartment|flat|place|building|roof|ceiling)\s+(is\s+|was\s+|got\s+|just\s+)*(destroyed|gone|on\s+fire|burn(ed|t|ing)(\s+down)?|collapsed|caved\s+in|flooded|wrecked)\b/,
  /\b(fell|crashed|landed|came\s+down|collapsed)\s+(on|onto)\s+(me|us|my\s+(head|leg|arm|foot|back|car|house))\b/,
  /\b(i'?m|i\s+am|we'?re|we\s+are)\s+(trapped|stuck\s+under|buried|pinned)\b/,
  /\b(shooting|shooter|gunfire|gun\s*shots?|shots\s+fired|stabbing|terror(ist)?\s+attack|hostage|earthquake|tornado|hurricane|tsunami|wildfire|forest\s+fire|flash\s+flood|flooding|landslide|mudslide|avalanche|gas\s+leak|evacuat(e|ed|ing|ion))\b/,
];
// fiction, games and hype ("my inbox exploded", "this song is a blast", "mind blown") aren't news
const NOT_NEWS = /\b(movie|film|show|series|episode|game|gaming|minecraft|fortnite|roblox|novel|book|story|dream(t|ed)?|nightmare|simulator|anime|cartoon)\b|\b(code|inbox|phone|notifications|dms|twitter|tiktok|instagram|insta|brain|head|mind|followers|views|sales|stocks?|post|tweet|video|channel|server|build|tests?|app|chat)\s+(just\s+)?(exploded|blew\s+up)\b|\bblew\s+up\s+(on|my\s+(phone|dms|notifications))\b|\bmind\s*blown\b|\bhad\s+a\s+blast\b|\b(was|is|what)\s+a\s+blast\b|\bbomb\s+(dot\s+)?com\b|\bthe\s+bomb\b|\bphoto\s*bomb|\btrapped\s+in\s+(a|an|the|this|another)?\s*(meeting|class|lecture|call|zoom|traffic|conversation|loop|queue|line|job)\b/;
// a negation right before the alarming words ("no plane crashed", "nothing exploded"); not a reply's "no, it crashed…"
const NEGATED_BEFORE = /\b(no|not|never|nothing|didn'?t|wasn'?t|isn'?t|won'?t|hope\s+(no|nothing))\s+(\w+\s+)?$/;
export function isAlarming(raw) {
  const t = String(raw || "").toLowerCase().replace(/[’‘]/g, "'");
  if (!t.trim() || NOT_NEWS.test(t)) return false;
  for (const re of ALARM) { const m = re.exec(t); if (m && !NEGATED_BEFORE.test(t.slice(0, m.index))) return true; }
  return false;
}
// reactions that mean the message is light or about Mochi, where a gasp would be wrong
const LIGHT = new Set(["laugh", "cheer", "warm", "affection", "unhurt", "hurt", "pout", "sheepish", "forgive"]);

export async function loadFeelingsModel(dir, threads) {
  if (!dir) return null;
  try {
    // The runner stays in C:\mochi-feelings\serve with its own node_modules (transformers 4.3.1 + onnxruntime-node
    // 1.30.0, already installed and parity-checked). Importing it from there means only one ONNX runtime ever loads.
    const runner = path.join(path.resolve(dir), "..", "..", "serve", "feelings.mjs");   // <root>/export/feelings → <root>/serve
    const { loadFeelings } = await import(pathToFileURL(runner).href);
    const f = await loadFeelings(dir, { threads });
    console.log(`[feelings] loaded from ${dir}`);
    return f;
  } catch (e) {
    console.warn(`[feelings] not loaded (${e.message}); word rules only`);
    return null;
  }
}

// While he sulks (three strikes), only an apology ends it; "hello" or "jk" doesn't (M5, Nov 2: "you dumb" "....."
// "i will beat you" "....." "hello" → "Hi again! I was just hoping we could start over."). After a long while
// without a word he lets it go by himself: he can't stay cross forever.
export const APOLOGY = /\b(sorry|so+rr+y|i apologi[sz]e|apologies|my bad|forgive me|i didn'?t mean (it|that)|i take (it|that) back|didn'?t mean to)\b/i;
// "sorry, not sorry", "I'm not sorry", "you should be sorry", "sorry you're so dumb": not an apology
export const NOT_SORRY = /\b(not|no|never|ain'?t|isn'?t|aren'?t|should be|you'?re|you are|be)\s+(so+rr+y|sorry)\b|\bsorry,?\s*not\s+sorry\b|\bsorry\s+(?:that\s+)?(?:you|your|ur)\b/i;
export const isApology = (t) => APOLOGY.test(String(t)) && !NOT_SORRY.test(String(t));
export const SULK_MAX_MS = 10 * 60 * 1000;
export function makeReactor(model) {
  return async function react(text, rule, state) {
    // state: { strikes, lastIncrease, careUntil }  (mutated)
    const out = { crisis: false, mood: null, sulk: "reset", request: "none", decision: null, model: null, ms: 0 };
    if (isCrisis(text)) {
      out.crisis = true; out.mood = "concerned"; out.sulk = "none";
      state.strikes = 0; state.careUntil = Date.now() + state.careModeMs;
      return out;
    }
    let f = null;
    if (model) { try { f = await model(text); } catch (e) { console.warn("[feelings]", e.message); } }
    out.model = f && { target: f.target, intent: f.intent, decision: f.decision, p: f.decision_p, request: f.request, ms: f.ms };
    out.ms = f ? f.ms : 0;
    if (f) {
      out.decision = f.decision; out.request = f.request || "none";
      const [mood, sulk] = REACT[f.decision] || [null, "reset"];
      out.mood = mood; out.sulk = sulk;
      if (f.decision === "neutral") out.mood = out.request === "help" || out.request === "teach" ? "thinking" : ["craft", "perform", "dress"].includes(out.request) ? "nod" : rule || "nod";
      if (RULE_WINS[rule] && RULE_WINS[rule].includes(f.decision)) out.mood = rule;   // shocked never replaces hurt, etc.
      if (f.decision === "forgive" && state.strikes >= 3) out.mood = "forgive";
    } else {
      // no model: behave exactly as the kit does today
      out.mood = rule || "nod";
      if (rule === "sad") out.sulk = "+1";
    }
    // alarming news about their world: the full gasp, unless the message is light or aimed at Mochi
    if (isAlarming(text) && (f ? !LIGHT.has(f.decision) : ["nod", "concerned", "surprised", "thinking"].includes(out.mood))) {
      out.mood = "shocked"; out.alarm = true;
    }
    // Mimi by name: she hops in. The kit's rule wants exact phrasings ("where is mimi") and missed "where si mimi" on
    // the M5, so his words talked about her while she never appeared. Not over hurt, worry or bad news.
    else if (/\bmimi\b/i.test(String(text)) && (f ? ["neutral", "affection", "warm", "cheer", "surprised", "laugh"].includes(f.decision) : out.mood !== "sad")) {
      out.mood = "showoff";
    }
    // care mode after a crisis line: worried instead of hurt, never sulks
    if (state.careUntil && Date.now() < state.careUntil && (out.mood === "sad" || out.mood === "oops")) { out.mood = "concerned"; out.sulk = "none"; }
    // sulk counter: sulking, only sorry (or a long quiet while) ends it
    const prev = state.strikes;
    if (prev >= 3) {
      const sorry = (f && f.decision === "forgive" && !NOT_SORRY.test(String(text))) || isApology(text);
      if (sorry) { out.sulk = "reset"; out.mood = "forgive"; }
      else if (out.sulk === "+1" || out.sulk === "+0.5") { /* a fresh dig: he stays cross, the clock restarts */ state.sulkAt = Date.now(); }
      else if (state.sulkAt && Date.now() - state.sulkAt > SULK_MAX_MS) { out.sulk = "reset"; out.mood = "forgive"; out.letGo = true; }
      else out.sulk = "hold";
    }
    if (out.sulk === "+1") state.strikes += 1;
    else if (out.sulk === "+0.5") state.strikes += 0.5;
    else if (out.sulk === "undo") state.strikes = Math.max(0, state.strikes - (state.lastIncrease || 0));
    else if (out.sulk === "reset") state.strikes = 0;
    state.lastIncrease = out.sulk === "+1" ? 1 : out.sulk === "+0.5" ? 0.5 : out.sulk === "hold" ? state.lastIncrease : 0;
    out.strikes = state.strikes; out.startSulk = prev < 3 && state.strikes >= 3; out.endSulk = prev >= 3 && state.strikes < 3;
    if (state.strikes >= 3) state.sulkAt = out.startSulk ? Date.now() : state.sulkAt || Date.now(); else state.sulkAt = 0;
    return out;
  };
}
