// One Mochi per database (Nov 7, server/solo.js): the 8789 window ran beside 8788 on the same file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beat, unbeat, whoStays, FRESH_MS } from "../solo.js";

test("on the same database the lower port stays and the other steps aside; other files, dead or stale servers don't count", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-solo-")), db = path.join(dir, "mochi-test.sqlite");
  const alive = (pid) => pid !== 666, now = 1e12;
  beat({ dir, db, port: 8788, pid: 100, now });
  assert.equal(whoStays({ dir, db, port: 8789, pid: 200, now, alive }).port, 8788, "8789 sees 8788 and steps aside");
  beat({ dir, db, port: 8789, pid: 200, now });
  assert.equal(whoStays({ dir, db, port: 8788, pid: 100, now, alive }), null, "8788 stays");
  assert.equal(whoStays({ dir, db: path.join(dir, "public", "mochi-public.sqlite"), port: 8790, pid: 300, now, alive }), null, "the shared Mochi has its own database");
  assert.equal(whoStays({ dir, db, port: 8789, pid: 200, now: now + FRESH_MS + 1, alive }), null, "an old heartbeat: that server is gone");
  beat({ dir, db, port: 8788, pid: 666, now });
  assert.equal(whoStays({ dir, db, port: 8789, pid: 200, now, alive }), null, "its process is gone");
  beat({ dir, db, port: 8788, pid: 100, now });
  assert.equal(whoStays({ dir, db, port: 8788, pid: 101, now, alive }), null, "a restart on the same port is itself");
  unbeat({ dir, port: 8788, pid: 999 }); assert.ok(fs.existsSync(path.join(dir, "8788.json")), "only its own heartbeat is removed");
  unbeat({ dir, port: 8788, pid: 100 }); assert.ok(!fs.existsSync(path.join(dir, "8788.json")));
  if (process.platform === "win32") assert.equal(whoStays({ dir, db: db.toUpperCase(), port: 8789, pid: 200, now, alive }), null);
  assert.equal(whoStays({ dir: path.join(dir, "nothing"), db, port: 8789 }), null, "no heartbeats yet");
});
