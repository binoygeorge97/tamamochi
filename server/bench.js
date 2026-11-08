// The workbench bench: run a list of prop and move requests through the real crafter, time every step, keep every
// render, and write a report. Started by dropping a JSON file in data/inbox (the server picks it up), so it can run
// on the M5 without a shell:
//   { "name": "day3", "props": ["an umbrella", "make a gun", ...], "moves": ["a bow", ...], "repeat": 1 }
import fs from "node:fs";
import path from "node:path";
import { validateMove } from "../shared/craft.js";
import { skitMoment, writeSkit, skitLead } from "./skits.js";

const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const sec = (ms) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)} s`);

export async function runBench({ spec, crafter, llm, dir, log = console }) {
  fs.mkdirSync(dir, { recursive: true });
  const started = Date.now(), rows = [], moves = [];
  const props = [...(spec.props || [])], repeat = Math.max(1, Math.min(3, +spec.repeat || 1));
  let i = 0;
  for (let rep = 0; rep < repeat; rep++) for (const req of props) {
    i++;
    const t0 = Date.now(), callsBefore = llm.calls.length;
    let r;
    try { r = await crafter.craftProp({ request: req }); } catch (e) { r = { ok: false, error: e.message, attempts: [], timings: { total: Date.now() - t0 } }; }
    const file = `${String(i).padStart(2, "0")}-${String(req).replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`;
    if (r.png) fs.writeFileSync(path.join(dir, `${file}.png`), r.png);
    if (r.recipe) fs.writeFileSync(path.join(dir, `${file}.json`), JSON.stringify(r.recipe, null, 1));
    const row = { request: req, ok: r.ok, name: r.name, archetype: r.archetype, pattern: r.pattern || null, matched: !!r.matched, unsure: !!r.unsure, guess: r.guess || null, tries: (r.attempts || []).length,
      parts: r.recipe ? r.recipe.parts.length : 0, ammo: r.recipe && r.recipe.ammo, ms: r.timings ? r.timings.total : Date.now() - t0, timings: r.timings, attempts: r.attempts, error: r.error || null,
      calls: llm.calls.slice(callsBefore).map((c) => ({ what: c.what, ms: c.ms, out: c.tokensOut, in: c.tokensIn, ok: c.ok, err: c.error })), png: r.png ? `${file}.png` : null };
    rows.push(row);
    log.log(`[bench] ${req} → ${r.ok ? `${r.name} (${r.archetype}) ${r.matched ? "✓" : r.unsure ? "? " + r.guess : "·"}` : "FAILED " + r.error} in ${sec(row.ms)}`);
    fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ spec, rows, moves }, null, 1));
  }
  for (const req of spec.moves || []) {
    const t0 = Date.now(), callsBefore = llm.calls.length;
    let r;
    try { r = await crafter.craftMove({ request: req }); } catch (e) { r = { ok: false, error: e.message, timings: { total: Date.now() - t0 } }; }
    const v = r.recipe ? validateMove(r.recipe) : null;
    moves.push({ request: req, ok: r.ok, ms: r.timings ? r.timings.total : Date.now() - t0, tracks: r.recipe ? Object.keys(r.recipe.tracks) : [], duration: r.recipe && r.recipe.duration, prop: r.recipe && r.recipe.prop,
      events: r.recipe && r.recipe.events, warnings: v ? v.warnings : [], attempts: r.attempts, error: r.error || null, recipe: r.recipe || null,
      calls: llm.calls.slice(callsBefore).map((c) => ({ what: c.what, ms: c.ms, out: c.tokensOut, ok: c.ok, err: c.error })) });
    log.log(`[bench] move ${req} → ${r.ok ? `${Object.keys(r.recipe.tracks).length} tracks, ${r.recipe.duration} s` : "FAILED " + r.error} in ${sec(Date.now() - t0)}`);
    fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ spec, rows, moves }, null, 1));
  }
  // little scenes (Nov 4): what Gemma writes for a moment in the chat ({ said, reply }), one after another so each
  // knows the ones before (as in the chat, where it's told the recent ones to do something else)
  const skits = [], titles = [], shapes = [], lines = [];
  for (const k of spec.skits || []) {
    const t0 = Date.now(), callsBefore = llm.calls.length;
    const mom = skitMoment(k.said, k.reply, {}) || { need: "story", text: "they asked for a little story with his friends", who: null };
    const lead = skitLead(mom), moment = lead.both ? mom : { ...mom, who: lead.who, peeked: true };   // (as on the stage: they've peeked in)
    let sk; try { sk = await writeSkit({ llm, moment, userText: k.said, reply: k.reply, recent: titles, recentShapes: shapes, recentLines: lines, log }); } catch (e) { sk = { title: "", beats: [], from: "error: " + e.message }; }
    titles.push(sk.title); if (sk.shape) shapes.push(sk.shape); lines.push(...(sk.beats || []).filter((b) => b.line).slice(0, 3).map((b) => b.line));
    skits.push({ ...k, need: moment.need, ms: Date.now() - t0, ...sk, calls: llm.calls.slice(callsBefore).map((c) => ({ what: c.what, ms: c.ms, out: c.tokensOut, ok: c.ok, err: c.error })) });
    log.log(`[bench] scene for "${k.said}" (${moment.need}) → "${sk.title}" from ${sk.from}, ${sk.beats.length} beats in ${sec(Date.now() - t0)}`);
    fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ spec, rows, moves, skits }, null, 1));
  }
  // the report
  const okRows = rows.filter((r) => r.ok), times = okRows.map((r) => r.ms), first = okRows.filter((r) => r.tries === 1 && r.matched).map((r) => r.ms);
  const step = (k) => okRows.flatMap((r) => (r.timings && Array.isArray(r.timings[k]) ? r.timings[k] : r.timings && typeof r.timings[k] === "number" ? [r.timings[k]] : []));
  const summary = {
    model: llm.model, vision: llm.vision, structured: llm.structured, minutes: +((Date.now() - started) / 60000).toFixed(1),
    props: rows.length, made: okRows.length, recognised: okRows.filter((r) => r.matched).length, unsure: okRows.filter((r) => r.unsure).length,
    firstTry: okRows.filter((r) => r.tries === 1 && r.matched).length,
    time: { median: pct(times, 50), p90: pct(times, 90), max: Math.max(0, ...times), firstTryMedian: pct(first, 50) },
    steps: { classify: pct(step("classify"), 50), recipe: pct(step("recipes"), 50), render: pct(step("renders"), 50), look: pct(step("looks"), 50), judge: pct(step("judge"), 50), critique: pct(step("critiques"), 50) },
    tokensPerRecipe: pct(okRows.map((r) => (r.timings && r.timings.tokens) / Math.max(1, (r.timings.recipes || []).length)), 50),
    moves: moves.length, movesOk: moves.filter((m) => m.ok).length, moveMedian: pct(moves.filter((m) => m.ok).map((m) => m.ms), 50),
  };
  const md = [`# Workbench bench: ${spec.name || "run"}`, "", `${new Date().toISOString()} · model ${summary.model} · vision ${summary.vision} · structured output ${summary.structured} · ${summary.minutes} min`, "",
    `Props: ${summary.made}/${summary.props} made, ${summary.recognised} recognised by the blind look (${summary.firstTry} on the first try), ${summary.unsure} kept unsure.`,
    `Time per prop: median ${sec(summary.time.median)}, p90 ${sec(summary.time.p90)}, max ${sec(summary.time.max)}; first-try median ${sec(summary.time.firstTryMedian)}.`,
    `Steps (median): classify ${sec(summary.steps.classify)}, recipe ${sec(summary.steps.recipe)}, render ${sec(summary.steps.render)}, look ${sec(summary.steps.look)}, judge ${sec(summary.steps.judge)}, critique ${sec(summary.steps.critique)}; ~${Math.round(summary.tokensPerRecipe || 0)} tokens per recipe.`,
    `Moves: ${summary.movesOk}/${summary.moves} made, median ${sec(summary.moveMedian)}.`, "",
    "| request | made | as | parts | tries | blind look | time |", "|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.request} | ${r.ok ? "yes" : "**no**"} | ${r.name || ""} (${r.archetype || ""})${r.pattern ? `, ${r.pattern.mode === "base" ? "pattern" : "adapted from"} ${r.pattern.name}` : ""} | ${r.parts} | ${r.tries} | ${r.guess ? `${r.matched ? "✓" : "✗"} ${r.guess}` : "–"} | ${sec(r.ms)} |`),
    "", "| move | made | tracks | length | time | warnings |", "|---|---|---|---|---|---|",
    ...moves.map((m) => `| ${m.request} | ${m.ok ? "yes" : "**no**"} | ${m.tracks.join(", ")} | ${m.duration || ""} s | ${sec(m.ms)} | ${(m.warnings || []).slice(0, 3).join("; ")} |`),
    ...(skits.length ? ["", "## Scenes", "", ...skits.flatMap((k) => [`### "${k.said}" → ${k.need}: ${k.title} (${k.from}${k.shape ? `, ${k.shape}` : ""}, ${sec(k.ms)})`, "", ...k.beats.map((b) => `- ${b.who} ${b.do}${b.who2 ? ` → ${b.who2}` : ""}${b.with ? ` (${b.with})` : ""}${b.how ? ` [${b.how}]` : ""}${b.line ? `: ${b.line}` : ""}`), ""])] : [])].join("\n");
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 1));
  fs.writeFileSync(path.join(dir, "report.md"), md);
  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ spec, summary, rows, moves, skits }, null, 1));
  return { summary, rows, moves, skits };
}
