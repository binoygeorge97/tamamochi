// Mochi's own little story (Binoy, Nov 3: "not only does it just respond to the user but also has his own little things
// it wants to do and along the way make use of the props and the actions it knows and learns… his own exciting story
// that the user sees him live out while also being able to influence this story… not fixed but evolving with the
// conversations").
//
// Three layers, all kept in memory kv "story" (so the demo snapshot and Day Zero carry it):
//   wants    two or three small intentions at a time, picked from what he actually has and knows (a wobbly move to get
//            smooth, a prop he's never tried, something to show Mimi, a thing he doesn't know about you, his piggy
//            bank). On Day Zero there are none: his ambitions are made of what you taught him. The conversation can add
//            one ("you should show Cocoa your trophy") or drop one, through two brain tools.
//   beats    in a quiet moment he acts one beat of a want on the stage, with the kit's own moves and props (the page
//            plays it). Each beat is a line in his scrapbook and in the story log, and the brain hears about it.
//   chapter  two sentences, in his voice, about where his story is right now; rewritten (one short model call) when
//            something changes. Shown on the stage and the workshop page.
import { PROP_EXAMPLES } from "../shared/craft.js";
import { writeCaper, sceneLog, consequence, waterGuns, wetAgain, ambushFor, caperText } from "./capers.js";
import { momentOfDay, seedNow, wobble } from "./variety.js";
import { planWaterFight } from "../shared/scuffle.js";
import { buildActivity } from "./activities.js";
import { BOOK, BOOK_BY_ID } from "../shared/activity-book.js";
import { routineFor } from "./book.js";

const POCKET = Object.values(PROP_EXAMPLES).flat();
const BALL = POCKET.find((e) => e.name === "water balloon"), SHIELD = POCKET.find((e) => e.name === "toy shield");
const SCENES_PER_BEAT = 3;
const FRIEND_WORD = /\b(mimi|cocoa)\b/i, CAPER_VERB = /\b(shoot|squirt|spray|fire|throw|splash|surprise|prank|ambush|show|race|chase|scare|tickle|call|invite|hug|dance|teach|play|try|ride|wear|give)\b/i;
// making it up to a friend after a caper went wrong: a hand-written scene
const mendScenes = (who, thing) => [
  { who: "mochi", do: "call", who2: who, line: `${who === "mimi" ? "Mimi" : "Cocoa"}… can we talk?` },
  { who: "mochi", do: "say", line: `I'm sorry about the ${thing}. That was too much.` },
  { who, do: "react", how: "hug", line: who === "mimi" ? "…Okay. You're forgiven. ♡" : "We're cool, dude." },
  { who: "mochi", do: "say", line: "Phew." },
];
const MAX_OPEN = 3, DONE_KEEP = 40;
const Name = (w) => (w === "mimi" ? "Mimi" : "Cocoa");
const words = (s) => String(s || "").toLowerCase();
const uid = () => Math.random().toString(36).slice(2, 8);

const bare = (name) => String(name || "move").replace(/^(?:my|your|his|our)\s+/i, "");   // a move called "my move": "practised my move", not "my my move" (Nov 7)
export function makeStory({ memory, llm = null, log = console, now = () => Date.now() } = {}) {
  let LLM = llm;
  const load = () => { const s = memory.get("story", null) || {}; return { wants: s.wants || [], done: s.done || [], log: s.log || [], chapter: s.chapter || null, lastBeat: s.lastBeat || 0, pausedUntil: s.pausedUntil || 0, dirty: !!s.dirty, celebrate: s.celebrate || null }; };
  const save = (s) => memory.set("story", s);
  const note = (s, text, kind = "beat") => { s.log = [...s.log.slice(-29), { at: new Date(now()).toISOString(), text: String(text).slice(0, 160), kind }]; s.dirty = true; };
  const open = (s) => s.wants.filter((w) => !w.done);
  const recentlyHad = (s, key) => s.done.some((d) => d.key === key && now() - Date.parse(d.at) < 36e5 * 20) || s.wants.some((w) => w.key === key);

  // ---- wants from his state ----
  function candidates() {
    const out = [], props = memory.props(), moves = memory.moves(), facts = memory.facts(60).map((f) => words(f.text)), fm = memory.get("friendMoves", {});
    for (const m of moves.filter((m) => m.source === "posed" && m.skill < 0.85).sort((a, b) => a.skill - b.skill).slice(0, 2))
      out.push({ key: `practise:${m.id}`, kind: "practise", text: `get my ${bare(m.name)} smooth`, why: "you taught it to me", moveId: m.id, progress: m.skill, weight: 3 });
    const made = props.filter((p) => p.source !== "pocket" && p.kept !== 0);
    // a prop he just got, or a move he just learned, deserves a little story (a caper) with his friends
    const st0 = memory.get("story", null) || { done: [], wants: [] }, capered = new Set([...(st0.done || []), ...(st0.wants || [])].map((d) => d.key));
    for (const p of made.filter((p) => (p.uses || 0) <= 1).slice(-2)) if (!capered.has(`caper:${p.id}`)) out.push({ key: `caper:${p.id}`, kind: "caper", text: `do something fun with my ${p.name}`, why: "it's new!", propId: p.id, progress: 0, weight: 4 });
    for (const m of moves.filter((m) => m.source !== "builtin").slice(-1)) if (!capered.has(`caper-move:${m.id}`) && !made.some((p) => !capered.has(`caper:${p.id}`) && (p.uses || 0) <= 1)) out.push({ key: `caper-move:${m.id}`, kind: "caper", text: `show off my ${bare(m.name)}`, why: "I just learned it", moveId: m.id, progress: 0, weight: 2.8 });
    const shown = new Set((memory.get("story", null) || { done: [] }).done.filter((d) => d.kind === "show").map((d) => d.key));
    for (const p of made.filter((p) => p.uses > 0).slice(-3)) for (const who of ["mimi", "cocoa"]) { const key = `show:${p.id}:${who}`; if (!shown.has(key)) { out.push({ key, kind: "show", text: `show ${Name(who)} my ${p.name}`, why: `${Name(who)} hasn't seen it`, propId: p.id, who, progress: 0, weight: 1.5 }); break; } }
    const gaps = [["colour", /favou?rite colou?r|likes? (?:the colou?r )?(?:red|blue|green|pink|purple|yellow|orange|black|white)/], ["food", /favou?rite (?:food|snack|meal)|loves? (?:pizza|pasta|sushi|tacos|ramen|ice cream|chocolate|cake)/], ["animal", /favou?rite animal|has a (?:dog|cat|hamster|rabbit|bird|fish)|pet/]];
    const knowsYou = facts.length || made.length || moves.length;   // on Day Zero he has no plans at all, not even questions
    if (knowsYou) for (const [g, re] of gaps) if (!facts.some((f) => re.test(f))) { out.push({ key: `ask:${g}`, kind: "ask", text: `find out your favourite ${g}`, why: "I want to know you better", topic: g, progress: 0, weight: 1 }); break; }
    const pics = memory.get("paintings", []), sk = memory.get("skills", {});
    if (pics.length) for (const who of ["mimi", "cocoa"]) if (!capered.has(`caper-paint:${who}`)) { out.push({ key: `caper-paint:${who}`, kind: "caper", text: `paint ${Name(who)}'s portrait`, why: "I love painting now", premise: `paint ${Name(who)}'s portrait and give it to ${who === "mimi" ? "her" : "him"}`, progress: 0, weight: 2.2 }); break; }
    if (sk.juggle && sk.juggle.skill < 0.8) out.push({ key: "practise-juggle", kind: "practise-juggle", text: "get better at juggling", why: "I keep dropping the balls", progress: sk.juggle.skill, weight: 2 });
    // his activity book: he liked one thing you did together, so he wants to try the next one like it (Nov 3)
    // (only ones you asked for: things he did on his own don't count, or he'd work through the whole book by himself)
    const asked = Object.entries(memory.get("book.asked", {})).filter(([id]) => Object.prototype.hasOwnProperty.call(BOOK_BY_ID, id)).sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
    if (asked.length) {
      const liked = BOOK_BY_ID[asked[0][0]], tried = new Set([...asked.map(([id]) => id), ...Object.keys(memory.get("book.done", {}))]);
      const next = BOOK.find((e) => e.cat === liked.cat && !e.pickOne && !tried.has(e.id) && !capered.has(`book:${e.id}`));
      if (next) out.push({ key: `book:${next.id}`, kind: "book", bookId: next.id, text: next.name, why: `we did "${liked.name}" and I loved it`, progress: 0, weight: 2 });
    }
    // a water fight with Cocoa now and then, once you've had one with them or he's got a water gun of his own (Nov 4:
    // "it would be interesting if sometimes cocoa could pull out his own water gun ... I want to see these little side
    // stories happening"); Cocoa often starts it himself
    const wf = memory.get("waterfights", null) || { n: 0 }, wetGun = props.some((p) => p.archetype === "launcher" && p.recipe && p.recipe.ammo === "water");
    if (wf.n || wetGun) out.push({ key: `waterfight:${wf.n || 0}`, kind: "waterfight", text: "have a water fight with Cocoa", why: wf.n ? "Cocoa says he still owes me one" : "I've got a water gun now", progress: 0, weight: 2.5 });
    const sv = memory.get("savings", null);
    if (sv && sv.goal && (!sv.target || sv.saved < sv.target)) out.push({ key: `save:${sv.goal}`, kind: "save", text: `save up for ${sv.goal}`, why: "it's in my piggy bank", progress: sv.target ? Math.min(1, (sv.saved || 0) / sv.target) : 0.2, weight: 2 });
    const taughtAny = Object.values(fm).some((v) => v && v.length);
    if (moves.some((m) => m.source === "posed" && m.skill >= 0.6) && !taughtAny) { const m = moves.find((m) => m.source === "posed" && m.skill >= 0.6); out.push({ key: `teach:${m.id}`, kind: "teach", text: `teach Mimi my ${bare(m.name)}`, why: "I've nearly got it myself", moveId: m.id, who: "mimi", progress: 0, weight: 1.5 }); }
    return out;
  }
  /** keep 2–3 open wants: drop ones whose thing is gone, add the best new ones */
  function refresh() {
    const s = load(), props = memory.props(), moves = memory.moves();
    let changed = false;
    for (const w of open(s)) {
      const gone = (w.moveId && !moves.some((m) => m.id === w.moveId)) || (w.propId && !props.some((p) => p.id === w.propId && p.kept !== 0));
      if (gone) { w.done = new Date(now()).toISOString(); w.how = "gone"; changed = true; }
      if (w.kind === "practise" && w.moveId) { const m = moves.find((m) => m.id === w.moveId); if (m && m.skill !== w.progress) { w.progress = m.skill; changed = true; } if (m && m.skill >= 0.85 && !w.done) { finish(s, w, `my ${bare(m.name)} is smooth now!`); changed = true; } }
      if (w.kind === "save") { const sv = memory.get("savings", null); if (!sv || !sv.goal) { w.done = new Date(now()).toISOString(); w.how = "gone"; changed = true; } else if (sv.target && sv.saved >= sv.target && !w.done) { finish(s, w, `I saved up for ${sv.goal}!`); changed = true; } else if (sv.target) { const p = Math.min(1, sv.saved / sv.target); if (p !== w.progress) { w.progress = p; changed = true; } } }
    }
    if (open(s).length < 2) {
      const have = new Set(open(s).map((w) => w.kind));
      for (const c of candidates().filter((c) => !recentlyHad(s, c.key)).sort((a, b) => (have.has(a.kind) ? 1 : 0) - (have.has(b.kind) ? 1 : 0) || b.weight - a.weight)) {
        if (open(s).length >= MAX_OPEN) break;
        s.wants.push({ id: uid(), ...c, weight: undefined, since: new Date(now()).toISOString(), beats: 0, from: "him" }); have.add(c.kind); changed = true;
        note(s, `I decided: ${c.text} (${c.why})`, "want");
      }
    }
    s.wants = [...s.wants.filter((w) => !w.done), ...s.wants.filter((w) => w.done).slice(-6)];
    if (changed) save(s);
    return s;
  }
  function finish(s, w, how) {
    w.done = new Date(now()).toISOString(); w.how = how; w.progress = 1;
    s.done = [...s.done.slice(-(DONE_KEEP - 1)), { key: w.key, kind: w.kind, at: w.done, text: w.title ? `${w.title} (${w.text})` : w.text }];
    s.celebrate = { id: w.id, text: w.text, how, at: w.done };
    note(s, `done: ${w.text} (${how})`, "done");
    try { memory.scrap(`I did it: ${w.text}. ${how}`, "story"); } catch (_) { /* fine */ }
  }
  const findWant = (s, which) => {
    const q = words(which), qw = q.split(/\W+/).filter((x) => x.length > 3);
    return open(s).find((w) => w.id === q) || open(s).find((w) => words(w.text).includes(q) || q.includes(words(w.text)) || (w.title && words(w.title).includes(q)))
      || open(s).find((w) => { const tw = words(`${w.text} ${w.title || ""}`); const hit = qw.filter((x) => tw.includes(x)).length; return hit >= 2 || (qw.length === 1 && hit === 1); }) || null;
  };

  // ---- what the brain hears ----
  function context() {
    const s = refresh(), ws = open(s), lines = [];
    if (s.chapter && s.chapter.text) lines.push(`Your own little story right now (your words, earlier): ${s.chapter.text}`);
    if (ws.length) lines.push("Things you want to do on your own (your plans; bring one up naturally when there's a lull, ask for help if you need it, and don't list them all at once): " + ws.map((w) => `${w.text} (${w.why}${w.progress ? `, ${Math.round(w.progress * 100)}% there` : ""}${w.from === "you" ? ", their idea" : ""})`).join("; "));
    else lines.push("You don't have any plans of your own yet; they come from what you learn and make together.");
    const mid = ws.find((w) => w.kind === "caper" && w.scenes && (w.at || 0) > 0 && (w.at || 0) < w.scenes.length);
    if (mid) lines.push(`You're in the middle of a little story with your friends: "${mid.title}". So far: ${mid.scenes.slice(0, mid.at).map((sc) => sceneLog(sc, { prop: mid.propName ? { name: mid.propName, archetype: mid.propArch } : null, move: mid.moveName ? { name: mid.moveName } : null })).join(", ")}. Next you plan to: ${sceneLog(mid.scenes[mid.at], { prop: mid.propName ? { name: mid.propName, archetype: mid.propArch } : null, move: mid.moveName ? { name: mid.moveName } : null })}. If they say what should happen next, call steer_story.`);
    // a little scene that just played on his stage (skits.js): he knows what happened in it
    const sk = memory.get("lastSkit", null);
    if (sk && sk.text && now() - Date.parse(sk.at) < 20 * 60000) lines.push(`A few minutes ago, this happened on your stage with your friends: ${sk.text}. It really happened; you can mention it if it fits.`);
    const recent = s.log.filter((l) => l.kind === "beat").slice(-3);
    if (recent.length) lines.push("What you did on your own while they were away: " + recent.map((l) => l.text).join("; ") + ".");
    if (s.celebrate) { lines.push(`You just managed something you'd been trying to do: ${s.celebrate.text} (${s.celebrate.how}). Tell them, briefly and happily, then let it go.`); delete s.celebrate; save(s); }
    lines.push("If they suggest something you could do or try, or tell you to stop a plan, use the want / drop_want tools; it becomes part of your story.");
    return lines.join("\n");
  }
  const TOOLS = [
    { type: "function", function: { name: "want", description: "Add something to your own plans: a thing you decide to do, or that they suggested you do (try a prop, show a friend something, learn something, find something out).", parameters: { type: "object", properties: {
      text: { type: "string", description: "the plan in a few words, first person without 'I', e.g. 'fly my kite in the garden'" },
      why: { type: "string", description: "why, in a few words" } }, required: ["text"] } } },
    { type: "function", function: { name: "steer_story", description: "They told you what should happen next in the little story you're acting out with your friends (a caper): 'make Mimi block it with a shield', 'don't shoot her, give her the flowers instead'. The rest of the story is rewritten that way.", parameters: { type: "object", properties: {
      how: { type: "string", description: "what should happen next, in their words" } }, required: ["how"] } } },
    { type: "function", function: { name: "drop_want", description: "One of your plans is done, or they asked you to stop it, or you changed your mind.", parameters: { type: "object", properties: {
      which: { type: "string", description: "the plan, in its words" }, how: { type: "string", description: "'done' or why you dropped it" } }, required: ["which"] } } },
  ];
  function runTool(name, args, said = "") {
    args = args || {};
    const s = refresh();
    if (name === "want") {
      const text = String(args.text || "").replace(/^(i |i'll |i will |to )/i, "").replace(/[.!]+$/, "").trim().slice(0, 80);
      if (!text) return "no plan given";
      // "shoot the bazooka at Mimi", "show Cocoa your new hat": a little story with that idea, around that prop or move
      const prop = memory.props().filter((p) => p.kept !== 0).find((p) => words(text).includes(words(p.name)) || words(p.name).split(" ").some((k) => k.length > 3 && words(text).includes(k)));
      const mv = memory.moves().find((m) => words(text).includes(words(m.name)));
      const caper = (prop || mv) && (FRIEND_WORD.test(text) || CAPER_VERB.test(text));
      const auto = caper ? open(s).find((w) => w.kind === "caper" && !w.premise && !w.scenes && (prop ? w.propId === prop.id : w.moveId === mv.id)) : null;
      if (auto) {   // his own vague plan for it becomes their idea
        auto.premise = text; auto.text = text; auto.why = String(args.why || "it sounded fun").slice(0, 80); auto.from = "you";
        note(s, `their idea for my ${prop ? prop.name : mv.name}: ${text}`, "want"); save(s); return `that's the plan now: ${text}`;
      }
      if (findWant(s, text)) return "that's already one of your plans";
      if (open(s).length >= MAX_OPEN + 1) { const oldest = open(s).sort((a, b) => Date.parse(a.since) - Date.parse(b.since))[0]; oldest.done = new Date(now()).toISOString(); oldest.how = "made room"; }
      const w = { id: uid(), key: `free:${text}`, kind: "free", text, why: String(args.why || "it sounded fun").slice(0, 80), progress: 0, since: new Date(now()).toISOString(), beats: 0, from: /\byou\b|their|they said/i.test(args.why || "") || /you should|why don'?t you|you could|try/i.test(said) ? "you" : "him" };
      if (caper) { w.kind = "caper"; w.premise = text; w.key = `caper:${prop ? prop.id : "move-" + mv.id}:${uid()}`; if (prop) w.propId = prop.id; else w.moveId = mv.id; }
      s.wants.push(w); note(s, `new plan: ${text} (${w.why})`, "want"); save(s);
      return `added to your plans: ${text}`;
    }
    if (name === "steer_story") {
      const how = String(args.how || "").trim().slice(0, 120); if (!how) return "how?";
      const c = open(s).filter((w) => w.kind === "caper").sort((a, b) => (b.scenes ? 1 : 0) - (a.scenes ? 1 : 0) || Date.parse(b.since) - Date.parse(a.since))[0];
      if (!c) { return runTool("want", { text: how, why: "they asked for it" }, said); }
      c.redirect = how; c.from = "you"; if (c.scenes) { c.scenes = c.scenes.slice(0, c.at || 0); c.pendingScenes = true; }
      note(s, `they changed the story: ${how}`, "want"); save(s);
      return `the story will go that way next: ${how}`;
    }
    if (name === "drop_want") {
      const w = findWant(s, args.which); if (!w) return `you don't have a plan like "${args.which}"`;
      if (/done|did it|finished|managed/i.test(args.how || "")) finish(s, w, String(args.how || "done").slice(0, 80)); else { w.done = new Date(now()).toISOString(); w.how = String(args.how || "changed my mind").slice(0, 80); s.done = [...s.done.slice(-(DONE_KEEP - 1)), { key: w.key, kind: w.kind, at: w.done, text: w.text }]; note(s, `dropped: ${w.text} (${w.how})`, "want"); }
      save(s); return `ok: "${w.text}" is ${w.progress === 1 ? "done" : "dropped"}`;
    }
    return null;
  }
  /** things that happened in the chat: a move performed, a prop used, a fact learned: progress on wants */
  function onEvent(ev = {}) {
    const s = load(); let changed = false;
    for (const w of open(s)) {
      if (ev.kind === "performed" && w.moveId && ev.moveId === w.moveId) { w.beats++; changed = true; }
      if (ev.kind === "used" && w.propId && ev.propId === w.propId && w.kind === "try") { finish(s, w, "I tried it with you!"); changed = true; }
      if (ev.kind === "remembered" && w.kind === "ask" && w.topic && new RegExp(w.topic === "colour" ? "colou?r" : w.topic).test(words(ev.text))) { finish(s, w, `now I know: ${ev.text}`); changed = true; }
      if (ev.kind === "taught" && w.kind === "teach" && ev.who === w.who) { finish(s, w, `${Name(w.who)} learned it!`); changed = true; }
      if (ev.kind === "shown" && w.kind === "show" && ev.who === w.who && (!ev.propId || ev.propId === w.propId)) { finish(s, w, `${Name(w.who)} loved it`); changed = true; }
      if (ev.kind === "activity" && ev.id && w.kind === "book" && ev.id === w.bookId) { finish(s, w, "we did it together!"); changed = true; }
    }
    if (changed) save(s);
  }

  // ---- a beat on the stage ----
  /** the next thing he does on his own, as a message for the page; null if nothing fits */
  async function pickBeat({ cold = false } = {}) {
    const s = refresh(), ws = open(s);
    if (!ws.length || now() < s.pausedUntil) return null;
    const props = memory.props(), moves = memory.moves();
    // a story that's under way carries on first; then capers; then the rest, least-done first
    const order = ws.slice().sort((a, b) => (midway(b) ? 1 : 0) - (midway(a) ? 1 : 0) || (b.kind === "caper" || b.mend ? 1 : 0) - (a.kind === "caper" || a.mend ? 1 : 0) || (a.beats || 0) - (b.beats || 0) || Date.parse(a.since) - Date.parse(b.since));
    for (const w of order) {
      let beat = null;
      if (w.kind === "book") {   // something from his activity book he hasn't tried yet
        const e = BOOK_BY_ID[w.bookId]; if (!e) continue;
        const act = routineFor(e, { ask: "", owned: props });
        beat = { kind: "activity", act, line: "Ooh, let me try this…", log: `tried something new: ${e.name}` };
        finish(s, w, "That was fun!");
      } else if (w.kind === "waterfight") {   // Cocoa sneaks up with his water gun (or Mochi starts it): a little water fight
        const starter = Math.random() < 0.6 ? "cocoa" : "mochi", fight = planWaterFight({ starter, ambush: starter === "mochi" ? ambushFor(memory) : null }), g = waterGuns(memory);
        beat = { kind: "waterfight", fight, gun: g.gun.recipe, cocoaGun: g.cocoaGun, line: null,
          log: starter === "cocoa" ? "Cocoa snuck up on me with his water gun: water fight!" : "started a water fight with Cocoa" };
        wetAgain(memory); finish(s, w, "we're both soaked!");
      } else if (w.kind === "practise-juggle") {   // a little juggling practice on his own
        const act = await buildActivity({ kind: "juggle" }, { memory, llm: LLM, log });
        beat = { kind: "activity", act, line: w.beats ? "Again…" : "Let me practise my juggling.", log: `practised juggling (${Math.round((act.skill || 0) * 100)}%)` };
        if ((act.skill || 0) >= 0.8) finish(s, w, "I can juggle three now!");
      } else if (w.kind === "caper" || w.mend) {
        const p = w.propId ? props.find((p) => p.id === w.propId) : null, m = w.moveId ? moves.find((m) => m.id === w.moveId) : null;
        if (cold && p && (p.archetype === "launcher" || p.archetype === "throwable")) continue;   // not with a cold
        if (!w.scenes || w.pendingScenes) {
          const history = s.log.filter((l) => /caper|cross|stormed|forgiv|hug|block|threw/i.test(l.text)).slice(-4).map((l) => l.text);
          const facts = memory.facts(10).map((f) => f.text);
          const written = w.mend ? { title: `making it up to ${Name(w.who)}`, scenes: mendScenes(w.who, w.thing || "caper") } : await writeCaper({ llm: LLM, prop: p, move: m, premise: w.premise || "", history, facts, redirect: w.redirect || "", recent: memory.get("variety.capers", []), memory, log });
          if (written && !w.mend) memory.set("variety.capers", [...memory.get("variety.capers", []), caperText(written)].slice(-6));   // (the next one steers away from it)
          w.scenes = [...(w.scenes || []), ...written.scenes]; w.title = w.title && !w.pendingScenes ? w.title : written.title; w.at = w.at || 0; w.pendingScenes = false; w.redirect = "";
          w.propName = p ? p.name : undefined; w.propArch = p ? p.archetype : undefined; w.moveName = m ? m.name : undefined; w.thing = String(p ? p.name : m ? m.name : w.thing || "").replace(/^(my|your|his|the)\s+/i, "") || w.thing;
          if (!w.beats) note(s, `a little story: ${w.title}`, "want");
        }
        const part = w.scenes.slice(w.at, w.at + SCENES_PER_BEAT), last = w.at + part.length >= w.scenes.length;
        if (!part.length) { finish(s, w, "the end"); continue; }
        for (const sc of part) if (sc.do === "activity" && !sc.act) { try { sc.act = await buildActivity({ kind: sc.how, subject: sc.how === "paint" ? sc.line || null : null, ask: sc.how === "trick" ? sc.line || "" : "" }, { memory, llm: LLM, log }); } catch (e) { log.warn && log.warn("[story] activity:", e.message); } }
        const logs = part.map((sc) => sceneLog(sc, { prop: p, move: m }));
        beat = { kind: "caper", title: w.title, scenes: part, part: [w.at + 1, w.scenes.length], last, prop: p || null, move: m ? { id: m.id, name: m.name, recipe: m.recipe, skill: m.skill } : null, ball: BALL, shield: SHIELD, line: null, log: `${w.at ? "" : `"${w.title}": `}${logs.join(", ")}` };
        w.at += part.length; if (p && part.some((sc) => sc.do === "use" || sc.do === "use_on")) memory.usedProp(p.id);
        if (last) {
          finish(s, w, w.mend ? "all forgiven" : `${logs.at(-1)}.`);
          const c = consequence({ ...w, id: w.id }); if (c && !recentlyHad(s, c.key)) { s.wants.push({ id: uid(), ...c, thing: w.thing, progress: 0, since: new Date(now()).toISOString(), beats: 0, from: "him" }); note(s, `I decided: ${c.text} (${c.why})`, "want"); }
        }
      } else if (w.kind === "practise" && w.moveId) { const m = moves.find((m) => m.id === w.moveId); if (m && !cold) { memory.practised(m.id, 0.1); const after = memory.moveById(m.id); beat = { kind: "practise", move: { id: m.id, name: m.name, recipe: m.recipe, skill: m.skill }, line: w.beats ? ["Again…", "Almost!", "Smoother that time?", "One more go."][w.beats % 4] : "Let me practise this.", log: `practised my ${bare(m.name)} (${Math.round(after.skill * 100)}%)` }; w.progress = after.skill; if (after.skill >= 0.85) finish(s, w, `my ${bare(m.name)} is smooth now!`); } }
      else if (w.kind === "try" && w.propId) { const p = props.find((p) => p.id === w.propId); if (p) { memory.usedProp(p.id); beat = { kind: "try", prop: p, mood: ["thinking", "excited", "surprised"][w.beats % 3], line: w.beats ? "Hmm, like this?" : "Let me see how this works…", log: `tried out my ${p.name}` }; if (w.beats >= 1) finish(s, w, "I think I've got the hang of it!"); } }
      else if (w.kind === "show" && w.propId) { const p = props.find((p) => p.id === w.propId); if (p) { beat = { kind: "show", prop: p, who: w.who, line: `${Name(w.who)}, look what I've got!`, friendLine: w.who === "mimi" ? "Ooh, that's so cute! ♡" : "Whoa, dude. Nice.", log: `showed ${Name(w.who)} my ${p.name}` }; finish(s, w, `${Name(w.who)} loved it`); } }
      else if (w.kind === "teach" && w.moveId) { const m = moves.find((m) => m.id === w.moveId); if (m && !cold) { beat = { kind: "teach", who: w.who, move: { id: m.id, name: m.name, recipe: m.recipe, skill: m.skill }, line: w.beats ? `One more time, ${Name(w.who)}!` : `${Name(w.who)}, want to learn my ${m.name}?`, log: `${w.beats ? "kept" : "started"} teaching ${Name(w.who)} my ${m.name}` }; if (w.beats >= 1) finish(s, w, `${Name(w.who)} is getting it!`); } }
      else if ((w.kind === "ask" || w.kind === "free") && w.beats >= 1) continue;   // one note is enough: these move on in conversation
      else if (w.kind === "ask") beat = { kind: "note", line: `Note to self: ask about their favourite ${w.topic}.`, log: `wrote in my notepad: ask about their favourite ${w.topic}` };
      else if (w.kind === "save") { const pig = POCKET.find((e) => e.name === "piggy bank"), sv = memory.get("savings", null) || {}; beat = { kind: "save", prop: pig, line: sv.target ? `$${sv.saved || 0} of $${sv.target}… getting there.` : `Still saving up!`, log: `counted my piggy bank for ${sv.goal}` }; }
      else if (w.kind === "free") beat = { kind: "note", line: `Thinking about how to ${w.text}…`, log: `planned how to ${w.text}` };
      if (!beat) continue;
      w.beats = (w.beats || 0) + 1; s.lastBeat = now();
      note(s, beat.log, "beat");
      try { memory.scrap(`on my own: ${beat.log}`, "story"); } catch (_) { /* fine */ }
      save(s);
      return { type: "beat", want: { id: w.id, text: w.text }, ...beat };
    }
    return null;
  }
  const midway = (w) => w.kind === "caper" && w.scenes && (w.at || 0) > 0 && (w.at || 0) < w.scenes.length && !w.done;
  const ongoing = () => open(load()).some(midway);   // a story under way: the next beat comes sooner
  const pause = (ms = 15 * 60000) => { const s = load(); s.pausedUntil = now() + ms; save(s); };

  // ---- the chapter: two sentences in his voice, rewritten when the story moved ----
  function fallbackChapter(s) {
    const ws = open(s); if (!ws.length) return "Nothing much yet. Teach me something and I'll have ideas.";
    const last = s.log.filter((l) => l.kind === "beat").slice(-1)[0];
    return `Right now I want to ${ws[0].text}${ws[1] ? `, and then ${ws[1].text}` : ""}. ${last ? `Earlier I ${last.text}.` : "I haven't started yet!"}`;
  }
  async function chapter({ force = false } = {}) {
    const s = refresh();
    if (!force && s.chapter && !s.dirty) return s.chapter;
    let text = fallbackChapter(s);
    const ws = open(s);
    if (LLM && ws.length) {
      try {
        const r = await LLM.chat({ what: "story", maxTokens: 90, temperature: wobble(0.75), seed: seedNow(),
          system: "You write two short sentences in the first person as Mochi, a small cheerful sheep who lives on someone's screen and has his own little plans. Plain words a child would use, playful and concrete, no questions, no emoji, no quotes, nothing about being an AI. Only use the notes given.",
          user: `My plans: ${ws.map((w) => `${w.text} (${w.why}${w.progress ? `, ${Math.round(w.progress * 100)}% done` : ""})`).join("; ")}.\nWhat happened lately: ${s.log.slice(-5).map((l) => l.text).join("; ") || "nothing yet"}.\n${momentOfDay()}${s.chapter && s.chapter.text ? `\nLast time you wrote (say it a new way): ${s.chapter.text}` : ""}\nWrite the two sentences.` });
        const t = String(r.text || "").replace(/\s+/g, " ").trim();
        if (t.length > 20 && t.length < 320 && !/\bAI\b|language model/i.test(t)) text = t;
      } catch (e) { log.warn && log.warn("[story] chapter:", e.message); }
    }
    const s2 = load(); s2.chapter = { text, at: new Date(now()).toISOString() }; s2.dirty = false; save(s2);
    return s2.chapter;
  }
  const state = () => { const s = refresh(); return { chapter: s.chapter, wants: open(s).map(({ id, kind, text, why, progress, beats, from, since, title, scenes, at }) => ({ id, kind, text, why, progress: progress || 0, beats: beats || 0, from, since, title: title || null, scene: scenes ? [at || 0, scenes.length] : null })), recent: s.log.filter((l) => l.kind !== "done").slice(-8).reverse(), done: s.wants.filter((w) => w.done && w.how !== "gone" && w.how !== "made room").slice(-4).map((w) => ({ text: w.text, how: w.how, at: w.done })) }; };
  const dirty = () => !!load().dirty;
  return { refresh, context, tools: TOOLS, runTool, onEvent, pickBeat, pause, chapter, state, dirty, ongoing, set llm(v) { LLM = v; }, get llm() { return LLM; } };
}
