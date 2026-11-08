/* Money you can see and hear (Nov 8, Binoy: "make the money props more engaging … actions for how we want this money
 * part to move and show transactions"). Every transaction floats its amount over whoever it touches (+$3 green when
 * money comes in, −$2 coral when it goes out, gold into the piggy bank or Mochi Bank, pink ♡ when it's shared), plays a
 * little sound made right here (a clink, a cha-ching, a ding, a sparkle: no sound files), and drops coins, hearts or
 * confetti. The scenes call it through their "pay" beat (server/money.js); earning and saving call it directly.
 * Sounds follow the voice switch: off when Mochi's voice is off. */
(() => {
  const fmt = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = document.createElement("style");
  css.textContent = `
  .money-float { position: fixed; z-index: 60; pointer-events: none; transform: translate(-50%, -50%); font: 800 24px/1 Fredoka, "Nunito Sans", system-ui, sans-serif;
    padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.92); box-shadow: 0 4px 14px rgba(40,20,60,.18); white-space: nowrap; animation: moneyUp 2.6s ease-out forwards; }
  .money-float.small { font-size: 15px; padding: 3px 8px; }
  .money-float.plus { color: #1f8a4c; } .money-float.minus { color: #d4483b; } .money-float.gold { color: #b07a00; } .money-float.heart { color: #e0457b; }
  @keyframes moneyUp { 0% { opacity: 0; transform: translate(-50%, -20%) scale(.6); } 10% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
    22% { transform: translate(-50%, -60%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -190%) scale(.95); } }
  @media (prefers-reduced-motion: reduce) { .money-float { animation: moneyFade 1.6s ease-out forwards; } @keyframes moneyFade { 0%, 70% { opacity: 1; } 100% { opacity: 0; } } }`;
  document.head.appendChild(css);

  // ---- where: over Mochi's head, a friend, or the prop beside him
  function spot(who) {
    const m = window.__mochi, P = window.__mochiProps;
    try {
      if (who === "prop" && P && P.heldScreen) { const s = P.heldScreen("hand"); if (s && isFinite(s.x)) return { x: s.x, y: s.y - 10 }; }
      if (who === "cocoa" && m && m.screenOf) { const s = m.screenOf("cocoa"); if (s) return { x: s.x, y: s.y - 70 }; }
      const h = m && m.headPoint ? m.headPoint() : null;
      if (h && isFinite(h.x)) return who === "mimi" ? { x: h.x + Math.min(130, innerWidth * 0.15), y: h.y + 20 } : { x: h.x, y: h.y + 10 };   // (just over his face, so it rises past his head; Mimi stands on his right)
    } catch (_) { /* not ready */ }
    return { x: innerWidth / 2, y: innerHeight * 0.35 };
  }
  /** float a label: tone "plus" | "minus" | "gold" | "heart" */
  function float(text, { tone = "plus", who = "mochi", small = false, delay = 0 } = {}) {
    setTimeout(() => {
      const p = spot(who), el = document.createElement("div");
      el.className = `money-float ${tone}${small ? " small" : ""}`; el.textContent = text; el.setAttribute("aria-hidden", "true");
      el.style.left = `${Math.max(40, Math.min(innerWidth - 40, p.x))}px`; el.style.top = `${Math.max(56, p.y)}px`;
      document.body.appendChild(el); setTimeout(() => el.remove(), 2800);
    }, delay);
  }

  // ---- sounds, made here
  let ac = null, master = null;
  const muted = () => !!(window.VOICE && window.VOICE.muted && window.VOICE.muted());
  function ctx() {
    try {
      if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); }
      if (ac.state !== "running") ac.resume();
      return ac;
    } catch (_) { return null; }
  }
  addEventListener("pointerdown", () => { if (ac && ac.state !== "running") ac.resume(); }, { capture: true, passive: true });
  function tone(f, at, { dur = 0.25, type = "sine", vol = 0.5, slide = 0 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + dur + 0.02);
  }
  function noise(at, { dur = 0.12, vol = 0.3, hp = 3000 } = {}) {
    const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = b; f.type = "highpass"; f.frequency.value = hp; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(at);
  }
  /** kind: "clink" | "clinks" | "chaching" | "ding" | "sparkle" | "pop" */
  function sound(kind, n = 1) {
    if (muted() || !ctx()) return;
    const t = ac.currentTime + 0.01;
    if (kind === "clink" || kind === "clinks") for (let i = 0; i < Math.max(1, Math.min(6, n)); i++) { const at = t + i * 0.13; tone(2093 + (i % 2) * 300, at, { dur: 0.16, vol: 0.32 }); tone(3136 + (i % 3) * 120, at + 0.012, { dur: 0.12, vol: 0.18 }); }
    else if (kind === "chaching") { noise(t, { dur: 0.09, vol: 0.25 }); tone(880, t + 0.02, { dur: 0.08, type: "square", vol: 0.08 }); for (const [f, d] of [[1318, 0], [1661, 0.01], [1976, 0.02]]) tone(f, t + 0.14 + d, { dur: 0.7, vol: 0.22 }); }
    else if (kind === "ding") { tone(1568, t, { dur: 0.9, vol: 0.35 }); tone(3136, t, { dur: 0.5, vol: 0.12 }); }
    else if (kind === "sparkle") [1568, 1976, 2349, 3136].forEach((f, i) => tone(f, t + i * 0.07, { dur: 0.3, vol: 0.2 }));
    else if (kind === "pop") tone(600, t, { dur: 0.12, vol: 0.3, slide: 1.8 });
  }
  function drops(kind, n, every = 150) { const m = window.__mochi; for (let i = 0; i < n; i++) setTimeout(() => m && m.fx && m.fx(kind), i * every); }

  /** a "pay" beat from a scene: { kind, amount, wallet?, to?, from? }; returns a short line for the chat ("−$3 · $2 left") */
  function pay(b) {
    const a = Number(b.amount) || 0, coins = Math.max(1, Math.min(6, Math.round(a)));
    switch (b.kind) {
      case "spend": float(`−${fmt(a)}`, { tone: "minus" }); float(`+${fmt(a)}`, { tone: "plus", who: b.to || "mimi", small: true, delay: 350 }); sound("chaching"); break;
      case "lend": float(`−${fmt(a)}`, { tone: "minus" }); float(`+${fmt(a)}`, { tone: "plus", who: b.to || "cocoa", small: true, delay: 350 }); sound("clinks", coins); break;
      case "repay": float(`+${fmt(a)}`, { tone: "plus" }); sound("clinks", coins); drops("confetti", 6, 90); break;
      case "deposit": float(`+${fmt(a)}`, { tone: "gold", who: "prop" }); float(`−${fmt(a)} wallet`, { tone: "minus", small: true, delay: 300 }); sound("clinks", coins); drops("coin", coins); break;
      case "withdraw": float(`+${fmt(a)}`, { tone: "plus" }); sound("clinks", coins); break;
      case "interest": float(`+${fmt(a)} interest`, { tone: "gold", who: "prop" }); sound("ding"); setTimeout(() => sound("sparkle"), 450); drops("star", 4, 160); break;
      case "share": float(`♡ ${fmt(a)}`, { tone: "heart", who: "prop" }); sound("sparkle"); drops("heart", 5, 140); break;
      case "save": float(`+${fmt(a)} saved`, { tone: "gold", who: "prop" }); sound("clinks", coins); break;
      case "earn": default: float(`+${fmt(a)}`, { tone: "plus" }); sound("clinks", coins); drops("coin", coins, 170);
    }
    const left = b.wallet == null ? "" : ` · wallet ${fmt(b.wallet)}`;
    return { spend: `−${fmt(a)}${left}`, lend: `−${fmt(a)} lent${left}`, repay: `+${fmt(a)} paid back${left}`, deposit: `${fmt(a)} into Mochi Bank${left}`,
      withdraw: `+${fmt(a)} from Mochi Bank${left}`, interest: `+${fmt(a)} interest from Mochi Bank`, share: `♡ ${fmt(a)} shared`, save: `+${fmt(a)} in the piggy bank`, earn: `+${fmt(a)}${left}` }[b.kind] || `${fmt(a)}`;
  }

  /** what a tapped money prop says, from GET /api/money ({ …card, look }); null when it isn't one */
  function tapLine(name, c) {
    const L = (c && c.look) || {}, n = String(name || "");
    if (n === "piggy bank" || n === "savings jar") return L.goal ? (L.saved > 0 ? `Clink clink! ${fmt(L.saved)} in my ${n}${L.target ? ` of ${fmt(L.target)}` : ""} for ${/^(?:a|an|the|my)\b/.test(L.goal) ? L.goal : `the ${L.goal}`}.` : `My ${n} is empty. Let's save for ${/^(?:a|an|the|my)\b/.test(L.goal) ? L.goal : `the ${L.goal}`}!`)
      : `My ${n} is empty. What should we save up for?`;
    if (n === "little bank") return L.bank > 0 ? `Mochi Bank: ${fmt(L.bank)}, growing ${Math.round(((c.bank && c.bank.rate) || 0.05) * 100)}% a week (play money). See the star spin?` : "Mochi Bank is empty. Try \"put $3 in Mochi Bank\"!";
    if (n === "three money jars") return `Spend ${fmt(L.wallet)} · Save ${fmt(L.saved)} · Share ${fmt(L.shared)}.`;
    if (n === "cash register") return L.spentWeek > 0 ? `Cha-ching! This week we spent ${fmt(L.spentWeek)} on treats.` : "Nothing bought this week. The drawer's empty!";
    if (n === "growing money tree") return L.pays > 0 ? `Each coin on my money tree is a week my money grew in Mochi Bank: ${L.pays} so far!` : "My money tree grows a coin each week money sits in Mochi Bank.";
    if (n === "wallet" || n === "play money") return L.wallet > 0 ? `${fmt(L.wallet)} in my wallet.` : "My wallet's empty. Want to do a job together?";
    return null;
  }
  /** a tap on a money prop: the sound that goes with it (how full it is), then tapLine */
  function tapSound(name, c) {
    const L = (c && c.look) || {}, n = String(name || "");
    if (n === "piggy bank" || n === "savings jar") sound("clinks", Math.max(1, Math.min(6, Math.ceil((L.saved || 0) / 2))));
    else if (n === "cash register") sound("chaching");
    else if (n === "little bank") sound(L.bank > 0 ? "ding" : "pop");
    else if (n === "growing money tree") sound("sparkle");
    else if (n === "three money jars" || n === "wallet" || n === "play money") sound("clinks", 2);
  }
  window.MONEY_FX = { float, sound, pay, tapLine, tapSound, fmt };
})();
