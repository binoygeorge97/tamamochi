// Mochi's memory: one SQLite file. Facts, phrases, props, moves, the scrapbook and the craft queue.
// Nothing here knows about models; it's plain storage plus the few queries the brain and the worker need.
// Uses Node's built-in SQLite (node:sqlite, Node 22.13+), so there is nothing native to install or compile.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  text TEXT NOT NULL,            -- "has an interview Thursday"
  kind TEXT NOT NULL DEFAULT 'fact',   -- fact | event | like | dislike | person | pet
  when_date TEXT,                -- ISO date the fact is about, for follow-ups
  weight REAL NOT NULL DEFAULT 0.5,    -- how much it matters (0..1); gifts and follow-ups look at this
  followed_up INTEGER NOT NULL DEFAULT 0,
  forgotten INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS phrases (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  phrase TEXT NOT NULL UNIQUE, meaning TEXT,
  stage TEXT NOT NULL DEFAULT 'heard',   -- heard | guessed | known
  action TEXT,                   -- optional: a move/combo to play when the phrase is said
  uses INTEGER NOT NULL DEFAULT 1, last_used TEXT
);
CREATE TABLE IF NOT EXISTS props (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL, archetype TEXT NOT NULL, recipe TEXT NOT NULL,   -- JSON
  origin TEXT NOT NULL,          -- in character: "the day you told me it was storming"
  source TEXT NOT NULL DEFAULT 'user',   -- user | mochi | gift | doodle
  kept INTEGER NOT NULL DEFAULT 1, uses INTEGER NOT NULL DEFAULT 0, last_used TEXT
);
CREATE TABLE IF NOT EXISTS moves (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL, recipe TEXT NOT NULL,   -- JSON motion recipe
  prop_archetype TEXT,           -- the slot the move expects, or NULL
  origin TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'user',   -- user | posed | mochi
  skill REAL NOT NULL DEFAULT 0.2,     -- 0 wobbly .. 1 smooth; pats and performances raise it
  uses INTEGER NOT NULL DEFAULT 0, last_used TEXT
);
CREATE TABLE IF NOT EXISTS scrapbook (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  entry TEXT NOT NULL,           -- "Oct 26: you taught me the umbrella twirl"
  ref_table TEXT, ref_id INTEGER
);
CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL,            -- prop | move
  request TEXT NOT NULL,         -- what was asked, in words
  source TEXT NOT NULL DEFAULT 'user',   -- user | mochi
  priority REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'queued',   -- queued | working | done | failed | someday | cancelled
  attempts INTEGER NOT NULL DEFAULT 0, result_id INTEGER, error TEXT, revealed INTEGER NOT NULL DEFAULT 0,
  reason TEXT                    -- why Mochi made it (for source=mochi gifts)
);
CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  role TEXT NOT NULL, text TEXT NOT NULL, meta TEXT   -- JSON: feelings, actions, crisis
);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
-- his saved props (Nov 7, Binoy: "keep the good designed props somewhere in the backend to be accessed later"): a copy of
-- each prop he made, taken before a shelf clear, a delete, a reset or Day Zero. Nothing resets this table.
CREATE TABLE IF NOT EXISTS library (
  id INTEGER PRIMARY KEY, saved_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL, archetype TEXT NOT NULL, recipe TEXT NOT NULL, origin TEXT, source TEXT, meta TEXT,
  good INTEGER NOT NULL DEFAULT 0, why TEXT, hash TEXT UNIQUE
);
`;

// who made a prop (Nov 7, the cloud boost): the models that wrote it and the ones that looked it over, by name
// ("gemini gemini-3.6-flash" → "Gemini", "local" → "Gemma"); null for the old ones that didn't say
const MODEL_NAMES = { local: "Gemma", anthropic: "Claude", openai: "GPT", gemini: "Gemini", nemotron: "Nemotron", pattern: "his patterns" };
const nameOf = (m) => { const w = String(m).split(" ")[0]; return MODEL_NAMES[w] || w.replace(/^./, (c) => c.toUpperCase()); };
function madeBy(meta) {
  if (!meta || !Array.isArray(meta.models)) return {};
  const uniq = (l) => [...new Set(l.map(nameOf))];
  return { madeBy: { wrote: uniq(meta.models), checked: Array.isArray(meta.checkers) ? uniq(meta.checkers) : [], ...(meta.practised ? { practised: true, was: meta.was || null } : {}) } };
}
export function openMemory(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // wait for the lock first (Nov 7): set the other way round, a server restarting while another one on the same file
  // was writing failed at once with "database is locked" (8788 stayed down after a deploy while an 8789 window ran)
  db.exec("PRAGMA busy_timeout = 8000; PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  const q = (sql) => db.prepare(sql);
  // day 3: older files get the new columns (thumbnails, job logs and timings)
  const has = (t, c) => q(`PRAGMA table_info(${t})`).all().some((x) => x.name === c);
  for (const [t, c, type] of [["props", "thumb", "TEXT"], ["props", "meta", "TEXT"], ["queue", "context", "TEXT"], ["queue", "log", "TEXT"], ["queue", "ms", "INTEGER"], ["queue", "finished_at", "TEXT"]])
    if (!has(t, c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${type}`);
  // the local calendar date (YYYY-MM-DD). toISOString() is UTC: from 6 PM in Chicago it already says tomorrow, so a
  // Thursday interview would get "how did it go?" on Wednesday evening.
  const localDate = (ms = Date.now()) => { const d = new Date(ms); return new Date(ms - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const today = () => localDate();

  const M = {
    db,
    // ---- facts
    remember(text, { kind = "fact", when = null, weight = 0.5 } = {}) {
      const r = q("INSERT INTO facts (text, kind, when_date, weight) VALUES (?, ?, ?, ?)").run(text, kind, when, weight);
      return r.lastInsertRowid;
    },
    forget(text) {   // "forget that": the most recent fact mentioning the words
      return q("UPDATE facts SET forgotten = 1 WHERE id = (SELECT id FROM facts WHERE forgotten = 0 AND text LIKE ? ORDER BY id DESC LIMIT 1)").run(`%${text}%`).changes;
    },
    facts(limit = 40) {
      return q("SELECT id, created_at, text, kind, when_date, weight FROM facts WHERE forgotten = 0 ORDER BY weight DESC, id DESC LIMIT ?").all(limit);
    },
    // Dated facts whose day has passed and that Mochi hasn't asked about yet: "how did the interview go?"
    followUps() {
      return q("SELECT id, text, when_date, weight FROM facts WHERE forgotten = 0 AND followed_up = 0 AND when_date IS NOT NULL AND when_date <= ? ORDER BY when_date DESC LIMIT 3").all(today());
    },
    markFollowedUp(id) { q("UPDATE facts SET followed_up = 1 WHERE id = ?").run(id); },
    // Emotionally weighted upcoming events: the crafter may make an unrequested gift for them
    upcoming(days = 3) {
      const until = localDate(Date.now() + days * 864e5);
      return q("SELECT id, text, when_date, weight FROM facts WHERE forgotten = 0 AND when_date BETWEEN ? AND ? AND weight >= 0.7 ORDER BY when_date").all(today(), until);
    },
    // ---- phrases
    heard(phrase, { meaning = null, stage = "heard", action = null } = {}) {
      q(`INSERT INTO phrases (phrase, meaning, stage, action, last_used) VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(phrase) DO UPDATE SET uses = uses + 1, last_used = datetime('now'),
           meaning = COALESCE(excluded.meaning, phrases.meaning), action = COALESCE(excluded.action, phrases.action),
           stage = CASE WHEN excluded.stage = 'known' OR phrases.stage = 'known' THEN 'known'
                        WHEN excluded.stage = 'guessed' OR phrases.stage = 'guessed' THEN 'guessed' ELSE 'heard' END`)
        .run(phrase.toLowerCase().trim(), meaning, stage, action);
    },
    phrases() { return q("SELECT phrase, meaning, stage, action, uses FROM phrases ORDER BY uses DESC, id DESC LIMIT 60").all(); },
    triggers() { return q("SELECT phrase, action FROM phrases WHERE action IS NOT NULL").all(); },
    // ---- props and moves
    addProp(p) {
      const r = q("INSERT INTO props (name, archetype, recipe, origin, source, thumb, meta) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(p.name, p.archetype, JSON.stringify(p.recipe), p.origin, p.source || "user", p.thumb || null, p.meta ? JSON.stringify(p.meta) : null);
      M.scrap(`${p.source === "mochi" ? "I made" : "I made you"} ${p.name}: ${p.origin}`, "props", r.lastInsertRowid);
      return r.lastInsertRowid;
    },
    props() { return q("SELECT id, name, archetype, recipe, origin, source, uses, created_at, thumb, meta FROM props WHERE kept = 1 ORDER BY id").all().map((p) => { const meta = p.meta ? JSON.parse(p.meta) : null; delete p.meta; return { ...p, recipe: JSON.parse(p.recipe), useMove: (meta && meta.use) || null, ...madeBy(meta) }; }); },
    // the props with their notes (practice.js: which ones didn't come out right)
    propsWithMeta() { return q("SELECT id, name, archetype, recipe, source, meta FROM props WHERE kept = 1 ORDER BY id").all().map((p) => ({ ...p, recipe: JSON.parse(p.recipe), meta: p.meta ? JSON.parse(p.meta) : {} })); },
    // a way you taught him to use a prop (a move he plays whenever he uses it)
    teachUse(propId, moveId) {
      const row = q("SELECT meta, name FROM props WHERE id = ?").get(propId);
      if (!row) return false;
      const meta = { ...(row.meta ? JSON.parse(row.meta) : {}), use: moveId };
      q("UPDATE props SET meta = ? WHERE id = ?").run(JSON.stringify(meta), propId);
      const mv = M.moveById(moveId);
      M.scrap(`you taught me how to use my ${row.name}: ${mv ? mv.name : "a new move"}`, "props", propId);
      return true;
    },
    setPropMeta(propId, patch) {   // merge into a prop's notes (Nov 7: you said it looks right)
      const row = q("SELECT meta FROM props WHERE id = ?").get(propId);
      if (!row) return false;
      q("UPDATE props SET meta = ? WHERE id = ?").run(JSON.stringify({ ...(row.meta ? JSON.parse(row.meta) : {}), ...patch }), propId);
      return true;
    },
    propUse(propId) {
      const row = propId && q("SELECT meta FROM props WHERE id = ?").get(propId);
      const meta = row && row.meta ? JSON.parse(row.meta) : null;
      return meta && meta.use ? M.moveById(meta.use) : null;
    },
    moveById(id) { const m = q("SELECT id, name, recipe, prop_archetype, origin, skill FROM moves WHERE id = ?").get(id); return m && { ...m, recipe: JSON.parse(m.recipe) }; },
    setPropThumb(id, thumb) { q("UPDATE props SET thumb = ? WHERE id = ?").run(thumb, id); },
    setPropRecipe(id, recipe) { q("UPDATE props SET recipe = ?, archetype = COALESCE(?, archetype) WHERE id = ?").run(JSON.stringify(recipe), recipe && recipe.archetype ? String(recipe.archetype) : null, id); },   // (a fix can make it another kind: Nov 4, the rocket ship became a ride)
    // ---- his saved props (the library): kept through clears, deletes, resets and Day Zero
    saveToLibrary(ids, why = "saved") {   // ids: prop ids (or "all" for every prop he made, on the shelf or put away)
      const rows = ids === "all" ? q("SELECT id, name, archetype, recipe, origin, source, meta FROM props WHERE source != 'pocket'").all()
        : (Array.isArray(ids) ? ids : [ids]).map((id) => q("SELECT id, name, archetype, recipe, origin, source, meta FROM props WHERE id = ? AND source != 'pocket'").get(+id)).filter(Boolean);   // (pocket things are hand-made patterns: always there)
      let n = 0;
      for (const r of rows) {
        let meta = {}; try { meta = r.meta ? JSON.parse(r.meta) : {}; } catch (_) { /* old row */ }
        const good = meta.matched || meta.approved || meta.liked || meta.adjusted ? 1 : 0;
        const hash = createHash("sha1").update(`${String(r.name).toLowerCase()}|${r.recipe}`).digest("hex");
        n += q(`INSERT INTO library (name, archetype, recipe, origin, source, meta, good, why, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(hash) DO UPDATE SET good = MAX(library.good, excluded.good), saved_at = datetime('now')`)
          .run(r.name, r.archetype, r.recipe, r.origin, r.source, r.meta, good, why, hash).changes;
      }
      return n;
    },
    library() { return q("SELECT id, saved_at, name, archetype, origin, source, good, why FROM library ORDER BY good DESC, saved_at DESC, id DESC LIMIT 300").all(); },
    libraryItem(id) { const r = q("SELECT * FROM library WHERE id = ?").get(+id); return r && { ...r, recipe: JSON.parse(r.recipe), meta: r.meta ? JSON.parse(r.meta) : {} }; },
    removeProp(id) { return q("UPDATE props SET kept = 0 WHERE id = ? AND kept = 1").run(+id).changes; },   // off the shelf (a copy is in the library first)
    clearProps() {   // off the shelf (kept = 0), not deleted: restoreProps brings them back
      const ids = q("SELECT id FROM props WHERE kept = 1").all().map((r) => r.id);
      if (ids.length) q("UPDATE props SET kept = 0 WHERE kept = 1").run();
      return ids;
    },
    cancelFixes() { return q("UPDATE queue SET status = 'cancelled' WHERE status IN ('queued','someday') AND context LIKE 'fix:%'").run().changes; },   // the props they were for are gone
    restoreProps(ids) { let n = 0; for (const id of ids) n += q("UPDATE props SET kept = 1 WHERE id = ? AND kept = 0").run(id).changes; return n; },
    findProp(words) {   // reuse before crafting: name or archetype match
      const w = `%${String(words).toLowerCase()}%`;
      const p = q("SELECT id, name, archetype, recipe, origin FROM props WHERE kept = 1 AND (lower(name) LIKE ? OR archetype LIKE ?) ORDER BY uses DESC, id DESC LIMIT 1").get(w, w);
      return p && { ...p, recipe: JSON.parse(p.recipe) };
    },
    usedProp(id) { q("UPDATE props SET uses = uses + 1, last_used = datetime('now') WHERE id = ?").run(id); },
    addMove(m) {
      const r = q("INSERT INTO moves (name, recipe, prop_archetype, origin, source, skill) VALUES (?, ?, ?, ?, ?, ?)")
        .run(m.name, JSON.stringify(m.recipe), m.prop_archetype || null, m.origin, m.source || "user", m.skill ?? 0.2);
      M.scrap(`you taught me ${m.name}: ${m.origin}`, "moves", r.lastInsertRowid);
      return r.lastInsertRowid;
    },
    moves() { return q("SELECT id, name, recipe, prop_archetype, origin, source, skill, uses, created_at FROM moves ORDER BY id").all().map((m) => ({ ...m, recipe: JSON.parse(m.recipe) })); },
    findMove(words) {
      const w = `%${String(words).toLowerCase()}%`;
      const m = q("SELECT id, name, recipe, prop_archetype, origin, skill FROM moves WHERE lower(name) LIKE ? ORDER BY uses DESC, id DESC LIMIT 1").get(w);
      return m && { ...m, recipe: JSON.parse(m.recipe) };
    },
    practised(id, by = 0.12) {   // a performance or a pat after one: the move gets smoother
      q("UPDATE moves SET skill = min(1.0, skill + ?), uses = uses + 1, last_used = datetime('now') WHERE id = ?").run(by, id);
    },
    // ---- scrapbook
    scrap(entry, ref_table = null, ref_id = null) {
      const d = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
      q("INSERT INTO scrapbook (entry, ref_table, ref_id) VALUES (?, ?, ?)").run(`${d}: ${entry}`, ref_table, ref_id);
    },
    scrapbook() { return q("SELECT id, created_at, entry, ref_table, ref_id FROM scrapbook ORDER BY id DESC LIMIT 100").all(); },
    // ---- queue (the worker takes one job at a time; the brain only enqueues)
    enqueue({ kind, request, source = "user", priority = 0.5, reason = null, context = null }) {
      const dup = q("SELECT id FROM queue WHERE kind = ? AND status IN ('queued','working') AND lower(request) = lower(?)").get(kind, request);
      if (dup) return { id: dup.id, duplicate: true };
      const active = q("SELECT count(*) AS n FROM queue WHERE status IN ('queued','working')").get().n;
      const lastHour = q("SELECT count(*) AS n FROM queue WHERE created_at > datetime('now', '-1 hour') AND source = 'mochi'").get().n;
      // the active queue holds ~5; the 5-an-hour cap is for his own ideas (Nov 4: you'd asked for 5 things in 6
      // minutes, so "snack toss" and the cookie you asked for went on the someday list, and sat there)
      let status = "queued";
      if (active >= 5 || (source === "mochi" && lastHour >= 5)) status = "someday";
      const r = q("INSERT INTO queue (kind, request, source, priority, status, reason, context) VALUES (?, ?, ?, ?, ?, ?, ?)").run(kind, request, source, priority, status, reason, context ? String(context).slice(0, 400) : null);
      if (status === "someday") {   // keep the wishlist short: drop Mochi's own oldest low-priority ideas first
        q("DELETE FROM queue WHERE status = 'someday' AND id IN (SELECT id FROM queue WHERE status = 'someday' ORDER BY (source = 'mochi') DESC, priority ASC, id ASC LIMIT max(0, (SELECT count(*) FROM queue WHERE status = 'someday') - 10))").run();
      }
      return { id: r.lastInsertRowid, status };
    },
    cancelJob(id) { return q("UPDATE queue SET status = 'cancelled' WHERE id = ? AND status IN ('queued','someday')").run(id).changes; },
    cancel(words) { return q("UPDATE queue SET status = 'cancelled' WHERE status IN ('queued','someday') AND lower(request) LIKE ?").run(`%${String(words).toLowerCase()}%`).changes; },
    nextJob() {   // long-waiting jobs slowly lose priority
      // the bench free and nothing waiting: the someday list's turn (it was a list nothing ever took from), what you
      // asked for first, then his own ideas (those still 5 an hour)
      if (!q("SELECT count(*) AS n FROM queue WHERE status IN ('queued','working')").get().n) {
        const lastHour = q("SELECT count(*) AS n FROM queue WHERE created_at > datetime('now', '-1 hour') AND source = 'mochi'").get().n;
        const s = q(`SELECT id FROM queue WHERE status = 'someday' ${lastHour >= 5 ? "AND source != 'mochi'" : ""} ORDER BY (source = 'mochi') ASC, priority DESC, id ASC LIMIT 1`).get();
        if (s) q("UPDATE queue SET status = 'queued' WHERE id = ?").run(s.id);
      }
      return q("SELECT * FROM queue WHERE status = 'queued' ORDER BY (priority - (julianday('now') - julianday(created_at)) * 0.2) DESC, id ASC LIMIT 1").get();
    },
    setJob(id, patch) {
      const keys = Object.keys(patch);
      q(`UPDATE queue SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(...keys.map((k) => patch[k]), id);
    },
    unrevealed() { return q("SELECT * FROM queue WHERE status IN ('done','failed') AND revealed = 0 ORDER BY id LIMIT 1").get(); },
    unrevealedAll() { return q("SELECT * FROM queue WHERE status IN ('done','failed') AND revealed = 0 ORDER BY id LIMIT 20").all(); },
    // surprises he's making on his own and hasn't given yet (the brain keeps them secret)
    secretGifts() { return q("SELECT id, request, reason, status FROM queue WHERE source = 'mochi' AND revealed = 0 AND status IN ('queued','working','done')").all(); },
    factById(id) { return q("SELECT id, text, kind, when_date, weight, forgotten FROM facts WHERE id = ?").get(id); },
    today: () => today(),
    queue() { return q("SELECT id, kind, request, source, priority, status, attempts, created_at, finished_at, ms, error, result_id FROM queue ORDER BY id DESC LIMIT 50").all(); },
    job(id) { return q("SELECT * FROM queue WHERE id = ?").get(id); },
    // jobs left "working" by a restart go back in the queue (once; then they fail)
    requeueStale() { return q("UPDATE queue SET status = CASE WHEN attempts >= 2 THEN 'failed' ELSE 'queued' END, error = CASE WHEN attempts >= 2 THEN 'interrupted twice' ELSE error END WHERE status = 'working'").run().changes; },
    // ---- conversation
    turn(role, text, meta = null) { q("INSERT INTO turns (role, text, meta) VALUES (?, ?, ?)").run(role, text, meta && JSON.stringify(meta)); },
    recentTurns(n = 12) { return q("SELECT role, text FROM turns ORDER BY id DESC LIMIT ?").all(n).reverse(); },
    get(k, d = null) { const r = q("SELECT v FROM kv WHERE k = ?").get(k); return r ? JSON.parse(r.v) : d; },
    set(k, v) { q("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, JSON.stringify(v)); },
    close() { db.close(); },
  };
  return M;
}
