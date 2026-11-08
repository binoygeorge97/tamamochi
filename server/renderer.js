// The crafter's camera: a hidden headless Chrome that loads /render and returns PNGs of prop recipes.
// No npm packages: it speaks the DevTools protocol directly, over a pipe (Chrome exits when this process does) or,
// if the pipe doesn't work, over a debugging port (a pid file lets the next start clean up after a hard restart).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = process.platform === "win32"
  ? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
     `${process.env.LOCALAPPDATA || ""}/Google/Chrome/Application/chrome.exe`, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"]
  : process.platform === "darwin" ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
export function findChrome(explicit) {
  for (const p of [explicit, process.env.CHROME_PATH, ...CANDIDATES]) if (p && fs.existsSync(p)) return p;
  return null;
}
const FLAGS = ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--disable-sync",
  "--disable-component-update", "--mute-audio", "--hide-scrollbars", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--disable-renderer-backgrounding", "--window-size=1024,1024",
  // Chrome refuses to run as root with its sandbox (Linux containers); never needed on the M5
  ...(process.platform === "linux" && process.getuid && process.getuid() === 0 ? ["--no-sandbox"] : [])];

class Cdp {   // request/response bookkeeping over any transport
  constructor(sendRaw) { this.sendRaw = sendRaw; this.id = 0; this.wait = new Map(); }
  call(method, params = {}, sessionId, ms = 30000) {
    const id = ++this.id;
    return new Promise((ok, bad) => {
      const t = setTimeout(() => { this.wait.delete(id); bad(new Error(`${method} timed out`)); }, ms);
      this.wait.set(id, { ok, bad, t, method });
      this.sendRaw(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  receive(text) {
    let m; try { m = JSON.parse(text); } catch (_) { return; }
    const w = m.id && this.wait.get(m.id);
    if (!w) return;
    this.wait.delete(m.id); clearTimeout(w.t);
    if (m.error) w.bad(new Error(`${w.method}: ${m.error.message}`)); else w.ok(m.result);
  }
  failAll(err) { for (const w of this.wait.values()) { clearTimeout(w.t); w.bad(err); } this.wait.clear(); }
}

export function makeRenderer({ url, chromePath, dataDir = os.tmpdir(), log = console, mode = "auto" }) {
  let state = null;           // { proc, cdp, session }
  let starting = null;
  const pidFile = path.join(dataDir, "render-chrome.pid");

  async function startPipe(exe, profile) {
    const proc = spawn(exe, [...FLAGS, "--remote-debugging-pipe", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"], windowsHide: true });
    const out = proc.stdio[3], inn = proc.stdio[4];
    for (const st of [out, inn]) st.on("error", () => { /* Chrome went away; the exit handler cleans up */ });
    proc.on("error", (e) => log.warn(`[render] ${e.message}`));
    const cdp = new Cdp((s) => out.write(s + "\0"));
    let buf = "";
    inn.on("data", (d) => { buf += d.toString("utf8"); let i; while ((i = buf.indexOf("\0")) >= 0) { cdp.receive(buf.slice(0, i)); buf = buf.slice(i + 1); } });
    proc.on("exit", () => { cdp.failAll(new Error("chrome exited")); if (state && state.proc === proc) state = null; });
    await cdp.call("Browser.getVersion", {}, undefined, 15000);
    return { proc, cdp };
  }
  async function startPort(exe, profile) {
    try {   // a Chrome left behind by a hard restart (node --watch on Windows can't run exit handlers)
      const old = JSON.parse(fs.readFileSync(pidFile, "utf8"));
      if (old && old.pid && Date.now() - old.at < 864e5) { try { process.kill(old.pid); log.warn(`[render] stopped an old Chrome (${old.pid})`); } catch (_) { /* gone */ } }
    } catch (_) { /* none */ }
    try { fs.rmSync(path.join(profile, "DevToolsActivePort"), { force: true }); } catch (_) { /* ignore */ }
    const proc = spawn(exe, [...FLAGS, "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
    proc.on("error", (e) => log.warn(`[render] ${e.message}`));
    try { fs.writeFileSync(pidFile, JSON.stringify({ pid: proc.pid, at: Date.now() })); } catch (_) { /* ignore */ }
    let port = null;
    for (let i = 0; i < 100 && !port; i++) {
      await new Promise((r) => setTimeout(r, 150));
      try { port = +fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch (_) { /* not yet */ }
    }
    if (!port) { proc.kill(); throw new Error("Chrome didn't open a debugging port"); }
    const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const ws = new WebSocket(ver.webSocketDebuggerUrl);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = () => bad(new Error("DevTools socket failed")); });
    const cdp = new Cdp((s) => ws.send(s));
    ws.onmessage = (e) => cdp.receive(typeof e.data === "string" ? e.data : Buffer.from(e.data).toString("utf8"));
    ws.onclose = () => { cdp.failAll(new Error("DevTools socket closed")); if (state && state.cdp === cdp) state = null; };
    proc.on("exit", () => { try { ws.close(); } catch (_) { /* ignore */ } if (state && state.proc === proc) state = null; });
    return { proc, cdp };
  }
  async function start() {
    const exe = findChrome(chromePath);
    if (!exe) throw new Error("no Chrome or Edge found for rendering (set CHROME_PATH)");
    const profile = path.join(dataDir, `render-chrome-${process.pid}`);
    // profiles left by earlier server runs (node --watch restarts on every deploy) would pile up: remove them
    try { for (const d of fs.readdirSync(dataDir)) if (/^render-chrome-\d+$/.test(d) && d !== path.basename(profile)) fs.rmSync(path.join(dataDir, d), { recursive: true, force: true, maxRetries: 2 }); } catch (_) { /* in use or gone */ }
    fs.mkdirSync(profile, { recursive: true });
    let s = null, lastErr = null;
    for (const m of mode === "auto" ? ["pipe", "port"] : [mode]) {
      try { s = m === "pipe" ? await startPipe(exe, profile) : await startPort(exe, profile); s.mode = m; break; }
      catch (e) { lastErr = e; log.warn(`[render] ${m} mode failed: ${e.message}`); }
    }
    if (!s) throw lastErr;
    const { targetId } = await s.cdp.call("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await s.cdp.call("Target.attachToTarget", { targetId, flatten: true });
    await s.cdp.call("Page.enable", {}, sessionId);
    await s.cdp.call("Page.navigate", { url }, sessionId);
    for (let i = 0; i < 120; i++) {
      const r = await s.cdp.call("Runtime.evaluate", { expression: "window.renderReady === true", returnByValue: true }, sessionId).catch(() => null);
      if (r && r.result && r.result.value === true) break;
      if (i === 119) throw new Error(`render page didn't load (${url})`);
      await new Promise((ok) => setTimeout(ok, 250));
    }
    s.session = sessionId;
    log.log(`[render] Chrome ready (${s.mode} mode): ${path.basename(exe)}`);
    process.once("exit", () => { try { s.proc.kill(); } catch (_) { /* ignore */ } });
    return s;
  }
  async function ensure() {
    if (state) return state;
    if (!starting) starting = start().then((s) => (state = s)).finally(() => { starting = null; });
    return starting;
  }
  async function render(recipe, opts = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const s = await ensure();
        const t0 = Date.now();
        const r = await s.cdp.call("Runtime.evaluate", { expression: `window.renderProp(${JSON.stringify(recipe)}, ${JSON.stringify(opts)})`, awaitPromise: true, returnByValue: true }, s.session, 45000);
        if (r.exceptionDetails) throw new Error(`render failed: ${r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text}`);
        const v = r.result.value;
        if (!v || !v.ok) return { ok: false, errors: (v && v.errors) || ["render returned nothing"], ms: Date.now() - t0 };
        return { ok: true, png: Buffer.from(v.png.split(",")[1], "base64"), dataUrl: v.png, warnings: v.warnings, bounds: v.bounds, ms: Date.now() - t0 };
      } catch (e) {
        log.warn(`[render] ${e.message}${attempt ? "" : "; restarting Chrome"}`);
        close();
        if (attempt) return { ok: false, errors: [e.message] };
      }
    }
  }
  function close() { if (state) { try { state.proc.kill(); } catch (_) { /* ignore */ } state = null; } }
  return { render, close, get mode() { return state && state.mode; } };
}
