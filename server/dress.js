// "Mimi, dress up as a doctor", "can Cocoa be a police officer?", "let's all dress up as chefs", "dress Mimi as a pilot
// and Cocoa as a firefighter" (Nov 7, Binoy: "allow the other two characters mimi and cocoa to also dress up as any of
// these professions correctly"). Who dresses up as what (shared/jobs.js). Just him ("dress up as a doctor") is his
// activity book's; a scene ("do a skit where Mimi is a doctor") is skits.js's dress beat.
import { JOBS, jobsIn, outfit } from "../shared/jobs.js";
import { PROP_EXAMPLES } from "../shared/craft.js";

const POCKET = Object.values(PROP_EXAMPLES).flat();
const T = (s) => String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ");
const DRESS_WORDS = /\b(?:dress(?:ed|es)?|costumes?|outfits?|uniforms?|be|become|as (?:a|an|the)|turn into|put on|wear|make (?:mimi|cocoa|them|everyone|everybody|both))\b/;
const SCENE = /\b(?:skit|scene|story|play pretend|pretend play|act (?:it )?out|put on a (?:show|play))\b/;
const NOT = /\b(?:don'?t|do not|never|stop|no more|take off|undress)\b/;
const ALL = /\b(?:let'?s all|you all|all of you|everyone|everybody|all three|the three of you|you guys|the gang|all of us|we all|y'?all)\b/;
const BOTH = /\b(?:your friends|both of them|the two of them|mimi and cocoa|cocoa and mimi|them both)\b/;
// who each part of the sentence is about
const SUBJ = /\b(mimi|cocoa|you|yourself|mochi)\b/g;

/** [{ who: "mochi" | "mimi" | "cocoa", job }] when a friend is in it, else null */
export function dressIntent(text) {
  const t = T(text);
  if (!t || t.length > 240 || NOT.test(t) || SCENE.test(t) || !DRESS_WORDS.test(t)) return null;
  if (/\b(?:i|we)\s+(?:dressed|was|were|went|wore)\b/.test(t)) return null;
  const jobs = jobsIn(t);
  if (!jobs.length) return null;
  const out = [];
  const add = (who, job) => { if (!out.some((o) => o.who === who)) out.push({ who, job }); };
  if (ALL.test(t)) { for (const w of ["mochi", "mimi", "cocoa"]) add(w, jobs[0].id); }
  else if (BOTH.test(t) && jobs.length === 1) { add("mimi", jobs[0].id); add("cocoa", jobs[0].id); if (/\byou and\b|\band you\b/.test(t)) add("mochi", jobs[0].id); }
  else {
    // each job goes to the name said last before it ("dress Mimi as a pilot and Cocoa as a firefighter"); a job
    // before any name goes to the first name after it ("a doctor? Mimi, you be one")
    const names = []; for (let m; (m = SUBJ.exec(t));) names.push({ who: m[1] === "mimi" || m[1] === "cocoa" ? m[1] : "mochi", at: m.index });
    SUBJ.lastIndex = 0;
    const firstFriend = names.find((n) => n.who !== "mochi");
    if (!firstFriend) return null;
    // "Mimi, dress up as a doctor": she's who it's about, even though "up" or "you" follows
    const vocative = /^(?:hey |ok |okay |so )?(mimi|cocoa)\b[,!:]/.exec(t);
    for (const j of jobs) {
      let who = null;
      for (const n of names) if (n.at < j.at && (n.who !== "mochi" || !vocative)) who = n.who;
      if (!who) { const after = names.find((n) => n.at > j.at); who = after ? after.who : vocative ? vocative[1] : firstFriend.who; }
      if (vocative && who === "mochi") who = vocative[1];
      const both = new RegExp(`\\b(?:you and ${who === "mimi" ? "mimi" : "cocoa"}|${who === "mimi" ? "mimi" : "cocoa"} and you)\\b`).test(t);
      add(who, j.id); if (both) add("mochi", j.id);
    }
    if (/\byou and (mimi|cocoa)\b|\b(mimi|cocoa) and you\b/.test(t)) for (const o of [...out]) add("mochi", o.job);
  }
  return out.some((o) => o.who !== "mochi") ? out : null;
}

const recipeOf = (name) => { const e = POCKET.find((x) => x.name === name); return e ? { name: e.name, archetype: e.archetype, recipe: e } : null; };
/** each one with the patterns the page puts on them */
export function dressPlan(list) {
  return (list || []).map(({ who, job }) => { const o = outfit(job); return o && { who, job, title: JOBS[job].name, wear: o.wear.map(recipeOf).filter(Boolean), hold: o.hold ? recipeOf(o.hold) : null }; }).filter(Boolean);
}
const NAME = { mochi: "you", mimi: "Mimi", cocoa: "Cocoa" };
/** what the brain is told ("you" is Mochi) */
export function dressNote(plan) {
  if (!plan || !plan.length) return "";
  const bits = plan.map((p) => `${NAME[p.who]} ${p.who === "mochi" ? "put on" : "put on"} ${[...p.wear.map((w) => `a ${w.name}`), ...(p.hold ? [`${p.who === "mochi" ? "your" : p.who === "mimi" ? "her" : "his"} ${p.hold.name}`] : [])].join(" and ")}: ${p.who === "mochi" ? "you're" : p.who === "mimi" ? "she's" : "he's"} dressed up as a ${p.title}`);
  return `\nOn screen just now: ${bits.join("; ")}. Say something short and fun about it (a line in the part, like "Officer Mimi reporting for duty!" from you about them); don't describe the outfit at length, and don't call any tools: it's all on already.`;
}
