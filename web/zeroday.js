/* Zero Day, the hacker edition, on the page (the stage itself is the kit's: kit/src/zeroday.js and hacker.js).
 *   rain       the Matrix behind everything: columns of glyphs falling, each led by a bright one; now and then a
 *              column spells something (MOCHI, BAA, 0DAY…)
 *   glitches   when the stage tears (the kit sends mochi:glitch), the page tears with it: bands with their colours
 *              shifted, bright streaks shooting across, the interface jittering with a colour split, and his speech
 *              bubble scrambling into glyphs for a moment
 *   words      his bubble decrypts (glyphs resolving into his words); his replies type out with a block cursor; the
 *              bracketed status lines read like a log ("[+] build ok: umbrella.prop")
 *   workbench  what he's making goes up on his monitors as code, with a compiling bar and BUILD OK
 *   moments    a boot-up when it goes on (and an old-CRT switch-off), ACCESS GRANTED for the secret handshake, a gift
 *              that decrypts before it opens
 * Screen readers get the plain words: the effects are drawn over hidden copies of the real text. Reduced motion: no
 * rain motion (one still frame), no glitches, no typing, no boot. */
(() => {
  const root = document.documentElement, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const on = () => root.dataset.mode === "zeroday";
  const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789ABCDEF<>/*+=";
  const WORDS = ["MOCHI", "BAA", "0DAY", "HELLO", "HUGS", "FLUFF", "SUDO PAT", "COCOA", "MIMI", "SNACKS", "ROOT"];
  const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  const make = (tag, cls, parent = document.body) => { const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e; };
  const M = () => window.__mochi;

  /* ---------------------------------------------------------------- the rain */
  const rain = document.createElement("canvas"); rain.className = "zd-rain"; rain.setAttribute("aria-hidden", "true"); document.body.prepend(rain);
  const g = rain.getContext("2d");
  let cols = [], fs = 16, W = 0, H = 0, running = false, last = 0;
  function sizeRain() {
    W = rain.width = innerWidth; H = rain.height = innerHeight; fs = W < 640 ? 13 : 16;
    cols = Array.from({ length: Math.ceil(W / fs) }, () => ({ y: -Math.random() * (H / fs), v: 0.35 + Math.random() * 0.75, word: null, wi: 0, row: -1 }));
    g.fillStyle = "#010604"; g.fillRect(0, 0, W, H);
  }
  function tick() {
    g.fillStyle = "rgba(1, 6, 4, 0.11)"; g.fillRect(0, 0, W, H);
    g.font = `${fs}px ui-monospace, Consolas, monospace`; g.textBaseline = "top";
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i]; c.y += c.v;
      const row = Math.floor(c.y);
      if (row === c.row) continue;
      c.row = row;
      if (row < 0) continue;
      const inWord = !!c.word, ch = inWord ? c.word[c.wi++] : glyph();
      if (inWord && c.wi >= c.word.length) c.word = null;
      g.fillStyle = inWord ? "rgba(214, 255, 228, 0.95)" : "rgba(57, 255, 122, 0.7)";
      g.fillText(ch, i * fs, (row - 1) * fs);
      g.fillStyle = "rgba(214, 255, 228, 0.9)"; g.fillText(glyph(), i * fs, row * fs);
      if (row * fs > H && Math.random() > 0.96) { c.y = -Math.random() * 6; c.row = -1; c.v = 0.35 + Math.random() * 0.75; if (Math.random() < 0.07) { c.word = WORDS[Math.floor(Math.random() * WORDS.length)]; c.wi = 0; } }
    }
  }
  let raf = 0;
  function loop(t) { if (!running) { raf = 0; return; } raf = requestAnimationFrame(loop); if (t - last < 55) return; last = t; tick(); }
  function rainOn(v) {
    if (v && !W) sizeRain();
    if (v && !running) { running = true; if (reduce) { for (let i = 0; i < 60; i++) tick(); running = false; } else if (!raf) raf = requestAnimationFrame(loop); }
    if (!v) { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  }
  addEventListener("resize", () => { if (W) { sizeRain(); if (reduce && on()) for (let i = 0; i < 60; i++) tick(); } });

  /* ---------------------------------------------------------------- glitches */
  const fx = make("div", "zd-fx"); fx.setAttribute("aria-hidden", "true");
  document.addEventListener("mochi:glitch", (e) => tear(e.detail || {}));
  function tear({ ms = 160, k = 1 } = {}) {
    if (!on() || reduce) return;
    root.classList.add("zd-glitching"); clearTimeout(tear.t); tear.t = setTimeout(() => root.classList.remove("zd-glitching"), Math.min(ms, 260));
    const n = Math.round(2 + k * 5);
    for (let i = 0; i < n; i++) {
      const streak = Math.random() < 0.45, t = make("i", streak ? "zd-streak" : "zd-tear", fx);
      t.style.top = `${Math.random() * 100}%`;
      t.style.setProperty("--d", `${Math.round(ms * (0.8 + Math.random() * 0.6))}ms`);
      if (streak) {
        t.style.setProperty("--h", `${1 + Math.random() * 2.5}px`); t.style.setProperty("--w", `${30 + Math.random() * 60}vw`); t.style.setProperty("--x0", `${Math.random() * 40}vw`);
        t.style.setProperty("--c", ["#39ff7a", "#2fd8ff", "#ff2bd6"][Math.floor(Math.random() * 3)]);
      } else {
        t.style.setProperty("--h", `${3 + Math.random() * 38 * k}px`); t.style.setProperty("--dx", `${(Math.random() - 0.5) * 60 * k}px`);
        t.style.setProperty("--hue", `${[90, 180, 270][Math.floor(Math.random() * 3)]}deg`);
        t.style.setProperty("--tint", ["rgba(57,255,122,.10)", "rgba(255,43,214,.10)", "rgba(47,216,255,.10)"][Math.floor(Math.random() * 3)]);
      }
      setTimeout(() => t.remove(), ms * 1.5 + 80);
    }
    scramble(Math.min(ms, 220));
  }

  /* ---------------------------------------------------------------- his speech bubble decrypts */
  let mine = false;   // our own writes, so the observer leaves them alone
  function write(b, real, shown, typing) {
    mine = true;
    if (!b.zdLive) { b.zdLive = true; b.setAttribute("aria-live", "off"); clearTimeout(b.zdLiveT); }
    clearTimeout(b.zdLiveT); b.zdLiveT = setTimeout(() => { b.zdLive = false; b.removeAttribute("aria-live"); }, 700);
    b.textContent = "";
    const sr = make("span", "zd-sr", b); sr.textContent = real;
    const vis = make("span", "zd-scr", b); vis.setAttribute("aria-hidden", "true"); vis.textContent = shown;
    b.classList.toggle("zd-typing", !!typing);
    mine = false;
  }
  function decrypt(b, text) {
    if (!on() || reduce || !text) return;
    const id = (b.zdId = (b.zdId || 0) + 1), steps = Math.min(16, 6 + Math.ceil(text.length / 8));
    let i = 0;
    b.zdText = text;
    const go = () => {
      if (b.zdId !== id) return;
      const done = Math.floor((text.length * i) / steps);
      const shown = text.slice(0, done) + text.slice(done).replace(/\S/g, () => glyph());
      write(b, text, shown, false);
      if (i++ < steps) setTimeout(go, 32); else { mine = true; b.textContent = text; mine = false; }
    };
    go();
  }
  function scramble(ms) {   // a glitch while he's talking: some of his letters flip for a moment
    const b = document.querySelector("#mochi .mochi-say");
    if (!b || !b.zdText || !document.querySelector("#mochi.saying")) return;
    const text = b.zdText, id = (b.zdId = (b.zdId || 0) + 1);
    write(b, text, text.replace(/\S/g, (c) => (Math.random() < 0.3 ? glyph() : c)), false);
    setTimeout(() => { if (b.zdId === id) { mine = true; b.textContent = text; mine = false; } }, ms);
  }
  function watchBubble() {
    const host = document.getElementById("mochi");
    if (!host) return setTimeout(watchBubble, 300);
    new MutationObserver(() => {
      if (mine) return;
      const b = host.querySelector(".mochi-say");
      if (!b) return;
      const text = b.textContent;
      if (text && text !== b.zdText && !b.querySelector(".zd-sr")) { b.zdText = text; decrypt(b, text); }
    }).observe(host, { childList: true, subtree: true, characterData: true });
  }
  watchBubble();

  /* ---------------------------------------------------------------- typed replies and log lines */
  function type(d, text) {
    if (!on() || reduce || !text) { d.textContent = text; return; }
    d.textContent = "";
    const sr = make("span", "zd-sr", d); sr.textContent = text;
    const vis = make("span", "", d); vis.setAttribute("aria-hidden", "true");
    d.classList.add("zd-typing");
    const per = Math.max(8, Math.min(28, 1600 / text.length)), chat = d.parentElement;
    let i = 0;
    const go = () => {
      i = Math.min(text.length, i + (per < 12 ? 3 : 1));
      vis.textContent = text.slice(0, i);
      if (chat) chat.scrollTop = chat.scrollHeight;
      if (i < text.length) setTimeout(go, per);
      else setTimeout(() => d.classList.remove("zd-typing"), 900);
    };
    go();
  }
  const LOG = [
    [/^\[workbench: (.+?) (queued|→ someday list|already queued)\]$/, (m) => `[+] queued: ${file(m[1])}${m[2] === "→ someday list" ? " (someday)" : m[2] === "already queued" ? " (already queued)" : ""}`],
    [/^\[workbench: (.+?) ready in (\d+) s.*\]$/, (m) => `[+] build ok: ${file(m[1])} (${m[2]} s)`],
    [/^\[new prop: (.+?) — .*\]$/, (m) => `[+] deployed: ${file(m[1])}`],
    [/^\[new move: (.+?)\]$/, (m) => `[+] learned: ${m[1].replace(/\s+/g, "_")}.move`],
    [/^\[holds up (.+?)\]$/, (m) => `[*] mount ${file(m[1])}`],
    [/^\[(?:aims|fires) (.+?)\]$/, (m) => `[>] exec ${file(m[1])} --fire`],
    [/^\[rides (.+?)\]$/, (m) => `[>] exec ${file(m[1])} --ride`],
    [/^\[uses (.+?)\]$/, (m) => `[>] exec ${file(m[1])}`],
    [/^\[does (.+?)\]$/, (m) => `[>] run ${m[1].replace(/\s+/g, "_")}.move`],
    [/^\[a surprise he made on his own: (.+?)\]$/, (m) => `[+] decrypted gift: ${file(m[1])}`],
    [/^\[(.+)\]$/, (m) => `[*] ${m[1]}`],
  ];
  function file(name) { return `${String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}.prop`; }
  function sys(text) { if (!on()) return text; for (const [re, f] of LOG) { const m = re.exec(text); if (m) return f(m); } return text; }

  /* ---------------------------------------------------------------- boot-up, switch-off */
  const boot = make("div", "zd-boot"); boot.setAttribute("aria-hidden", "true");
  const BOOT = [
    ["MOCHI-OS v0.day  (c) 2026 baa-baa labs", ""], ["> mounting /dev/fleece ............ ok", ""], ["> loading neon.ko ................. ok", ""],
    ["> starting battlestation (6 screens)  ok", ""], ["> bypassing cuteness firewall ..... FAILED (too cute)", "bad"], ["ACCESS GRANTED", "big"],
  ];
  let booting = null;
  function bootUp(done) {
    if (reduce) { done && done(); return; }
    clearTimeout(booting); clearTimeout(bootUp.safety); boot.textContent = ""; boot.className = "zd-boot on";
    bootUp.safety = setTimeout(() => { if (boot.classList.contains("on")) bootOff(); }, 4000);   // whatever happens, it never stays in the way
    let i = 0;
    const finish = () => { clearTimeout(booting); boot.classList.add("flash"); booting = setTimeout(() => { boot.className = "zd-boot"; }, 440); done && done(); done = null; };
    boot.onclick = finish;
    const next = () => {
      if (i >= BOOT.length) { booting = setTimeout(finish, 260); return; }
      const [t, cls] = BOOT[i++], p = make("p", cls, boot); p.textContent = t;
      booting = setTimeout(next, i === BOOT.length - 1 ? 300 : 150 + Math.random() * 90);
    };
    next();
  }
  function bootOff() { clearTimeout(booting); boot.className = "zd-boot"; boot.onclick = null; }   // the boot screen, gone at once
  let offT = null;
  function powerOff(done) {
    bootOff();
    if (reduce || offT) { done(); return; }   // already switching off: just switch
    root.classList.add("zd-poweroff");
    offT = setTimeout(() => { offT = null; root.classList.remove("zd-poweroff"); done(); }, 360);
  }

  /* ---------------------------------------------------------------- ACCESS GRANTED and friends */
  const banner = make("div", "zd-banner"); banner.setAttribute("role", "status");
  function flashBanner(text, { sub = "", kind = "ok", ms = 1800 } = {}) {
    if (!on()) return;
    banner.className = `zd-banner${kind === "deny" ? " deny" : ""}`; void banner.offsetWidth;
    banner.textContent = text; if (sub) { const s = make("small", "", banner); s.textContent = sub; }
    banner.style.setProperty("--d", `${ms}ms`); banner.classList.add("on");
    clearTimeout(flashBanner.t); flashBanner.t = setTimeout(() => banner.classList.remove("on"), ms);
    if (M() && M().glitch) M().glitch(160, 0.6);
  }

  /* ---------------------------------------------------------------- the workbench on his monitors */
  const jobs = new Map();
  function workbench(m) {
    if (!m || m.kind === "move") return;
    const name = String(m.request || "").split(":")[0].trim();
    if (m.status === "working") { const j = { id: m.id, name, t0: performance.now(), expect: 16 }; jobs.set(m.id, j); M() && M().zdBench && M().zdBench(j); }
    else if (m.status === "done") { const j = jobs.get(m.id) || { id: m.id, name, t0: performance.now() - (m.ms || 0) }; jobs.delete(m.id); M() && M().zdBench && M().zdBench({ ...j, done: true, ms: m.ms }); }
    else { jobs.delete(m.id); M() && M().zdBench && M().zdBench(null); }
  }
  function reveal(m) {
    if (!m || m.kind !== "prop" || !m.prop) return;
    if (M() && M().zdBench) M().zdBench({ id: `reveal-${m.prop.name}`, name: m.prop.name, t0: performance.now() - 1000, done: true, ms: m.ms || 0, recipe: m.prop.recipe });
    if (m.gift) flashBanner("DECRYPTING GIFT", { sub: "▓▓▓▓▓▓▓▓▓▓ 100%", ms: 1500 });
  }

  /* ---------------------------------------------------------------- switching */
  /* ---------------------------------------------------------------- a ripple where you click (Nov 2) */
  // rings of green light spread out from the spot, the rain nearby splashes (its columns restart from there) and a few
  // glyphs scatter. Not on the controls, the chat or the message box.
  const NOT_HERE = "button, input, textarea, select, a, label, .chat, .composer, .controls, .shelf, .panel, [role=switch]";
  function ripple(x, y) {
    if (!on()) return;
    const r = make("div", "zd-ripple"); r.style.left = `${x}px`; r.style.top = `${y}px`; r.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) { const ring = make("i", "", r); ring.style.animationDelay = `${i * 110}ms`; }
    if (!reduce) for (let i = 0; i < 9; i++) {
      const s = make("b", "", r), a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, d = 40 + Math.random() * 50;
      s.textContent = glyph(); s.style.setProperty("--dx", `${Math.cos(a) * d}px`); s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    }
    setTimeout(() => r.remove(), 1300);
    if (!reduce && cols.length) {   // the rain splashes: the columns around the spot start again from there
      const c0 = Math.floor(x / fs), row = y / fs;
      for (let i = Math.max(0, c0 - 4); i <= Math.min(cols.length - 1, c0 + 4); i++) { const c = cols[i]; c.y = row - Math.abs(i - c0) * 0.6; c.row = -1; c.v = Math.max(c.v, 0.9 + Math.random() * 0.5); }
    }
  }
  addEventListener("pointerdown", (e) => { if (on() && !(e.target.closest && e.target.closest(NOT_HERE))) ripple(e.clientX, e.clientY); }, { capture: true, passive: true });

  function mode(next, animate) {
    rainOn(next === "zeroday");
    if (next !== "zeroday") { bootOff(); banner.classList.remove("on"); fx.textContent = ""; root.classList.remove("zd-glitching"); }
    if (next === "zeroday" && animate) bootUp();
  }
  window.ZD = { mode, type, sys, powerOff, banner: flashBanner, workbench, reveal, tear, on };
})();
