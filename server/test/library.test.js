// Deleting props, resetting the shelf and his saved props (Nov 7, Binoy: "make sure the delete props and reset button is
// available in the web app ... keep the good designed props somewhere in the backend"), the grown-up code that unlocks
// those buttons through the tunnel, and his days counted from a fixed moment.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../index.js";
import { loadShare } from "../share.js";

const fetchImpl = async (url) => {
  if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "google/gemma-4-26b-a4b" }] }), { status: 200 });
  return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] }), { status: 200 });
};
const recipe = (name, color = "#e0263a") => ({ name, archetype: "handheld_tool", parts: [{ shape: "sphere", size: [0.4, 0.4, 0.4], color, label: "body" }] });
const post = (base, p, body, headers = {}) => fetch(`${base}${p}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body || {}) });

test("remove one prop, clear the shelf, Day Zero: each is kept in his library first; one comes back", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-lib-"));
  const S = await createServer({ db: path.join(dir, "l.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null });
  const base = `http://127.0.0.1:${S.port}`;
  try {
    const a = S.memory.addProp({ name: "red ball", archetype: "handheld_tool", recipe: recipe("red ball"), origin: "you asked", source: "user", meta: { matched: true } });
    const b = S.memory.addProp({ name: "blue cup", archetype: "handheld_tool", recipe: recipe("blue cup", "#2255cc"), origin: "you asked", source: "user", meta: { matched: false } });
    S.memory.addProp({ name: "kite", archetype: "handheld_tool", recipe: recipe("kite"), origin: "pocket", source: "pocket" });
    let r = await (await post(base, `/api/props/${a}/remove`)).json();
    assert.equal(r.ok, true); assert.equal(r.removed, "red ball");
    assert.ok(!S.memory.props().some((p) => p.id === a), "off the shelf");
    let lib = (await (await fetch(`${base}/api/library`)).json()).props;
    assert.equal(lib.length, 1); assert.equal(lib[0].name, "red ball"); assert.equal(lib[0].good, 1, "Pip knew it: a good one");
    assert.equal((await post(base, "/api/props/999/remove")).status, 404);
    r = await (await post(base, "/api/props/clear")).json();
    assert.ok(r.cleared >= 1);
    lib = (await (await fetch(`${base}/api/library`)).json()).props;
    assert.ok(lib.some((p) => p.name === "blue cup"), "cleared ones are saved too");
    assert.ok(!lib.some((p) => p.name === "kite"), "pocket things aren't his designs");
    assert.equal(lib.filter((p) => p.name === "red ball").length, 1, "the same prop isn't saved twice");
    // Day Zero wipes his props, but not his library
    assert.equal((await (await post(base, "/api/reset-demo", { which: "zero" })).json()).ok, true);
    assert.equal(S.memory.props().length, 0);
    lib = (await (await fetch(`${base}/api/library`)).json()).props;
    assert.ok(lib.length >= 2, "the library survives Day Zero");
    const red = lib.find((p) => p.name === "red ball");
    r = await (await post(base, `/api/library/${red.id}/shelf`)).json();
    assert.equal(r.ok, true);
    assert.ok(S.memory.props().some((p) => p.name === "red ball"), "back on his shelf");
    assert.equal((await (await post(base, `/api/library/${red.id}/shelf`)).json()).already, true, "not twice");
    // his days, counted from a fixed moment
    const at = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
    assert.equal((await (await post(base, "/api/born", { at })).json()).ok, true);
    assert.equal((await (await fetch(`${base}/api/growth`)).json()).day, 2);
    await post(base, "/api/born", { at: null });
    assert.equal((await (await fetch(`${base}/api/whoami`)).json()).admin, true, "this computer: the grown-up buttons work");
  } finally { await S.close(); }
});

test("shared Mochi: the grown-up buttons need the grown-up code, not just the passcode", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-gate-"));
  const S = await createServer({ db: path.join(dir, "g.sqlite"), port: 0, host: "127.0.0.1", worker: false, renderer: null, fetchImpl, feelings: null, public: true });
  const base = `http://127.0.0.1:${S.port}`;
  try {
    const sh = loadShare(dir);
    assert.ok(sh.admin && sh.admin !== sh.passcode, "a grown-up code, different from the passcode");
    const visitor = { "x-forwarded-for": "203.0.113.9", cookie: `mochi_pass=${sh.token}` };
    assert.equal((await post(base, "/api/props/clear", {}, visitor)).status, 403, "the passcode alone can't clear his shelf");
    assert.equal((await (await fetch(`${base}/api/whoami`, { headers: visitor })).json()).admin, false);
    assert.equal((await post(base, "/api/grownup", { code: "nope" }, visitor)).status, 401);
    assert.equal((await post(base, "/api/grownup", { code: sh.passcode }, visitor)).status, 401, "the passcode isn't the grown-up code");
    const ok = await post(base, "/api/grownup", { code: sh.admin.toUpperCase() }, visitor);
    assert.equal(ok.status, 200);
    const set = ok.headers.get("set-cookie") || "";
    assert.match(set, /mochi_admin=[0-9a-f]{32}/); assert.match(set, /HttpOnly/);
    const admin = { ...visitor, cookie: `${visitor.cookie}; ${set.split(";")[0]}` };
    assert.equal((await post(base, "/api/props/clear", {}, admin)).status, 200, "with the grown-up code it works");
    assert.equal((await (await fetch(`${base}/api/whoami`, { headers: admin })).json()).admin, true);
    assert.equal((await post(base, "/api/props/clear", {}, { "x-forwarded-for": "203.0.113.9", cookie: "mochi_admin=" + set.split(";")[0].split("=")[1] })).status, 401, "still needs the passcode first");
  } finally { await S.close(); }
});
