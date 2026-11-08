// Sharing Mochi beyond this computer (Nov 3: "safely host this and make it accessible even on other networks for the
// judges and also for me to show others to test the app and give feedback").
// A second Mochi (its own memory) runs with MOCHI_PUBLIC=1 on 127.0.0.1 only; a Cloudflare tunnel carries visitors
// to it (scripts\share-mochi.cmd). Nothing on this computer listens to the network, and here:
//   - every page, file and socket needs the passcode (data\share.json, made on first start); a link with ?code=… lets
//     a judge in with one tap and is then dropped from the address bar;
//   - the grown-up buttons (reset, Day Zero, demo snapshot, forget, clear the shelf) only work on this computer, or
//     after the grown-up code (also in data\share.json, not the passcode) is entered on his workshop page (Nov 7);
//   - each visitor gets a fair share of the model (messages, drawings, voice per minute).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const WORDS = ["kite", "cocoa", "mochi", "piggy", "cupcake", "teacup", "sneeze", "disco", "wand", "scarf", "globe", "puff", "pip", "kit"];
const ADMIN = [/^\/api\/reset-demo/, /^\/api\/demo-snapshot/, /^\/api\/forget/, /^\/api\/props\/clear/, /^\/api\/props\/restore/, /^\/api\/props\/\d+\/remove/, /^\/api\/library\/\d+\/shelf/, /^\/api\/born/, /^\/api\/review$/, /^\/api\/voice\/set/, /^\/api\/cloud-boost/];
const LIMITS = [[/^\/api\/chat$/, 14], [/^\/api\/doodle$/, 4], [/^\/api\/tts$/, 90], [/^\/api\/voice\/try$/, 10], [/^\/api\/stt$/, 12], [/^\/api\/feedback$/, 5], [/^\/api\/props\/adjust$/, 20], [/^\/api\/moves$/, 10], [/^\/api\/handshake$/, 6], [/^\/api\/paintings$/, 6], [/^\/api\/activity\/done$/, 20]];

export function loadShare(dataDir) {
  const file = path.join(dataDir, "share.json");
  let j = {};
  try { j = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")); } catch (_) { /* first start */ }
  if (!j.passcode) {
    // two words and four digits (~1.7 million codes; wrong guesses are also limited, below)
    const w = () => WORDS[crypto.randomInt(WORDS.length)];
    j.passcode = `${w()}-${w()}-${crypto.randomInt(1000, 10000)}`;
    j.salt = crypto.randomBytes(12).toString("hex");
    j._how = "The passcode people need to open the shared Mochi. Change it here (any words) and restart the shared Mochi; everyone has to enter the new one.";
    try { fs.writeFileSync(file, JSON.stringify(j, null, 2)); } catch (_) { /* read-only: still works this run */ }
  }
  if (!j.salt) j.salt = "mochi";
  // the grown-up code (Nov 7, Binoy: the reset and delete buttons from his Chromebook): a second code, not the passcode,
  // that unlocks the grown-up buttons through the tunnel; judges get the passcode only
  if (!j.admin) {
    const w = () => WORDS[crypto.randomInt(WORDS.length)];
    j.admin = `${w()}-${w()}-${crypto.randomInt(10000, 100000)}`;
    j._adminHow = "The grown-up code: unlocks reset, Day Zero, clearing and deleting props from another computer (his workshop page asks for it). Keep it to yourself.";
    try { fs.writeFileSync(file, JSON.stringify(j, null, 2)); } catch (_) { /* read-only: still works this run */ }
  }
  const token = crypto.createHash("sha256").update(`${j.passcode}|${j.salt}`).digest("hex").slice(0, 32);
  const adminToken = crypto.createHash("sha256").update(`admin|${j.admin}|${j.salt}`).digest("hex").slice(0, 32);
  return { passcode: String(j.passcode), token, admin: String(j.admin), adminToken, file };
}

// a malformed cookie ("mochi_pass=%") must not throw: on the socket upgrade that crashed the whole server (Nov 3 review)
const cookieOf = (req, name) => { const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie || ""); if (!m) return null; try { return decodeURIComponent(m[1]); } catch (_) { return null; } };
// Express matches routes ignoring case and a trailing slash, so the checks here must too ("/API/RESET-DEMO/")
const norm = (p) => (String(p || "/").toLowerCase().replace(/\/+$/, "") || "/");
const local = (req) => !req.headers["cf-connecting-ip"] && !req.headers["x-forwarded-for"] && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
export const visitorOf = (req) => String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();

const PAGE = (bad, slow) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tamamochi: born on day zero</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4efe6;font:16px/1.45 system-ui,sans-serif;color:#2a2430}
form{background:#fff;padding:28px 26px;border-radius:22px;box-shadow:0 10px 30px rgba(40,30,60,.12);width:min(340px,calc(100vw - 32px))}
h1{font-size:22px;margin:0 0 4px}p{margin:0 0 16px;color:#6b6377}input{width:100%;box-sizing:border-box;font:inherit;padding:12px 14px;border-radius:14px;border:1px solid #ddd5c8;margin-bottom:12px}
button{width:100%;font:600 16px system-ui;padding:12px;border:0;border-radius:14px;background:#e8744f;color:#fff;cursor:pointer}.bad{color:#c0392b;margin:-6px 0 12px;font-size:14px}</style></head>
<body><form method="post" action="/pass"><h1>Tamamochi</h1><p>Mochi is born on day zero and grows only with you. Enter the passcode you were given.</p>
${slow ? '<div class="bad">Too many tries. Wait a minute, then try again.</div>' : bad ? '<div class="bad">That passcode didn\'t work. Check it and try again.</div>' : ""}<input name="code" autocomplete="off" autocapitalize="none" placeholder="passcode" aria-label="Passcode" autofocus required><button>Meet Mochi</button></form></body></html>`;

/** the gate, as express middleware (mount it before everything else); also checks the socket upgrade */
export function makeGate({ dataDir, log = console }) {
  const S = loadShare(dataDir), hits = new Map();
  log.log(`[share] public mode: passcode "${S.passcode}" (in ${S.file}); the grown-up buttons work on this computer, or with the grown-up code (in the same file)`);
  const ok = (req) => cookieOf(req, "mochi_pass") === S.token;
  const isAdmin = (req) => local(req) || cookieOf(req, "mochi_admin") === S.adminToken;
  const setCookie = (res) => res.setHeader("set-cookie", `mochi_pass=${S.token}; Path=/; Max-Age=${60 * 60 * 24 * 14}; HttpOnly; SameSite=Lax${res.req && res.req.headers["cf-connecting-ip"] ? "; Secure" : ""}`);
  const limited = (req) => {
    const rule = LIMITS.find(([re]) => re.test(norm(req.path))); if (!rule || req.method !== "POST") return false;
    const key = `${visitorOf(req)}|${rule[0]}`, now = Date.now(), h = (hits.get(key) || []).filter((t) => now - t < 60000);
    if (h.length >= rule[1]) { hits.set(key, h); return true; }
    h.push(now); hits.set(key, h); if (hits.size > 5000) hits.clear();
    return false;
  };
  // wrong passcodes: 8 a minute per visitor, then a short wait (a script can't just try them all through the tunnel)
  const guesses = new Map();
  const lockedOut = (req) => { const k = visitorOf(req), now = Date.now(), g = (guesses.get(k) || []).filter((t) => now - t < 60000); guesses.set(k, g); return g.length >= 8; };
  const wrong = (req) => { const k = visitorOf(req); guesses.set(k, [...(guesses.get(k) || []), Date.now()]); if (guesses.size > 5000) guesses.clear(); log.warn(`[share] wrong passcode from ${k}`); };
  function middleware(req, res, next) {
    // on this computer itself (its own browser, the workbench's hidden camera loading /render): no passcode
    if (local(req)) return next();
    // the passcode: a form post, or a shared link's ?code=… (then the address bar drops it)
    if (norm(req.path) === "/pass") {
      if (req.method === "POST") {
        if (lockedOut(req)) return res.status(429).type("html").send(PAGE(true, true));
        let body = ""; req.on("data", (d) => { body += d; if (body.length > 2000) req.destroy(); });
        req.on("end", () => {
          const code = new URLSearchParams(body).get("code") || "";
          if (code.trim().toLowerCase() === S.passcode.toLowerCase()) { setCookie(res); res.redirect(303, "/"); }
          else { wrong(req); res.status(401).type("html").send(PAGE(true)); }
        });
        return;
      }
      return res.type("html").send(PAGE(false));
    }
    if (typeof req.query.code === "string" && !ok(req)) {
      if (lockedOut(req)) return res.status(429).type("html").send(PAGE(true, true));
      if (req.query.code.trim().toLowerCase() === S.passcode.toLowerCase()) {
        setCookie(res); const u = new URL(req.originalUrl, "http://x"); u.searchParams.delete("code");
        return res.redirect(303, "/" + u.pathname.replace(/^[\/\\]+/, "") + (u.search || ""));   // always this site ("//evil.com" isn't)
      }
      wrong(req);
    }
    if (!ok(req)) {
      if (req.method === "GET" && req.accepts("html") && !req.path.startsWith("/api/")) return res.status(401).type("html").send(PAGE(false));
      return res.status(401).json({ error: "passcode needed" });
    }
    // the grown-up code: POST /api/grownup {"code": …}; wrong ones count like wrong passcodes
    if (norm(req.path) === "/api/grownup" && req.method === "POST") {
      if (lockedOut(req)) return res.status(429).json({ ok: false, error: "Too many tries. Wait a minute." });
      let body = ""; req.on("data", (d) => { body += d; if (body.length > 2000) req.destroy(); });
      req.on("end", () => {
        let code = ""; try { code = String(JSON.parse(body).code || ""); } catch (_) { code = new URLSearchParams(body).get("code") || ""; }
        if (code.trim().toLowerCase() === S.admin.toLowerCase()) {
          res.setHeader("set-cookie", `mochi_admin=${S.adminToken}; Path=/; Max-Age=${60 * 60 * 24 * 3}; HttpOnly; SameSite=Lax${req.headers["cf-connecting-ip"] ? "; Secure" : ""}`);
          log.log(`[share] grown-up code entered by ${visitorOf(req)}`);
          return res.json({ ok: true });
        }
        wrong(req); res.status(401).json({ ok: false, error: "That's not the grown-up code." });
      });
      return;
    }
    if (ADMIN.some((re) => re.test(norm(req.path))) && req.method !== "GET" && !isAdmin(req)) return res.status(403).json({ error: "only on Binoy's computer, or with the grown-up code" });
    if (limited(req)) return res.status(429).json({ error: "Mochi needs a little breather. Try again in a few seconds!", text: "Phew, that's a lot of messages! Give me a few seconds to catch up?" });
    res.setHeader("x-robots-tag", "noindex");
    next();
  }
  return { middleware, wsAllowed: (req) => local(req) || ok(req), passcode: S.passcode, isPublic: true, isAdmin };
}
