// One Mochi per database (Nov 7). An old 8789 window was still running beside 8788 on the same data: it took one of
// two benches dropped together (both ran twice as slow), put 8788's workbench jobs back in the queue when it
// restarted, and once kept 8788 from starting at all ("database is locked").
// Each server writes a heartbeat into <data>/servers/<port>.json every few seconds. When two run on the same
// database, the one on the lower port (8788 before 8789) stays; the other says so in its log and stops.
import fs from "node:fs";
import path from "node:path";

export const BEAT_MS = 10000, FRESH_MS = 35000;

export function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }   // (EPERM: it's there, just not ours)
}
const norm = (p) => { const r = path.resolve(p); return process.platform === "win32" ? r.toLowerCase() : r; };

/** write this server's heartbeat */
export function beat({ dir, db, port, pid = process.pid, now = Date.now() }) {
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${port}.json`), JSON.stringify({ port, pid, db: norm(db), at: now })); } catch (_) { /* best effort */ }
}
export function unbeat({ dir, port, pid = process.pid }) {
  try { const f = path.join(dir, `${port}.json`); const b = JSON.parse(fs.readFileSync(f, "utf8")); if (b.pid === pid) fs.rmSync(f); } catch (_) { /* gone */ }
}

/** another live server on the same database that should stay instead of this one (the lower port), or null */
export function whoStays({ dir, db, port, pid = process.pid, now = Date.now(), alive = isAlive }) {
  let files = []; try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch (_) { return null; }
  const mine = norm(db);
  for (const f of files) {
    let b; try { b = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (_) { continue; }
    if (!b || b.pid === pid || +b.port === +port || b.db !== mine) continue;
    if (now - b.at > FRESH_MS || !alive(b.pid)) continue;
    if (+b.port < +port) return b;
  }
  return null;
}
