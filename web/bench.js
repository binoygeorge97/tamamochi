/* Mochi's workshop crew (Binoy, Nov 3: "a chibi fox and another cute animal where one acts as the software developer
 * (writing the code for the prop and the action) and the other acts as the software tester (testing the code that the
 * developer wrote)").
 *   Kit the fox writes the code: the recipe (parts, sizes, colours) for a prop, or the keyframes for a move.
 *   Pip the owl tests it blind: Pip is never told what was asked for, only shown the picture, and says what it looks
 *   like. If Pip names it, it ships to Mochi; if not, Pip says what to fix and Kit writes it again.
 * It is the crafter's real loop (server/crafter.js reports each step: plan, write, render, test, fix), not a cartoon
 * of it: Pip's words are the vision model's own guess.
 *   Crew.mount(el)   → the standing panel on the workshop page (only there: Binoy, Nov 3), idle between jobs, at work
 *                      during one, with Kit and Pip in 3D (kit/dist/crew.min.js) and these drawings as the fallback
 *   Crew.card(job)   → a one-job card (not used on the stage any more)
 * Events: the page dispatches "mochi:crew" with the server's "bench" and "workbench" messages; mount({ socket: true })
 * listens on its own socket instead. */
(() => {
  const css = `
  .crew { --c-card: var(--card, #fff); --c-ink: var(--label, #2a2430); --c-soft: var(--label-3, #8a8296); --c-pass: #2f9e5b; --c-fail: #d4573d;
    position: relative; background: var(--c-card); color: var(--c-ink); border-radius: 18px; box-shadow: var(--shadow, 0 4px 16px rgba(40,30,60,.12)); padding: 10px 12px 8px; width: min(440px, 100%); font: 13px/1.35 var(--ui, system-ui, sans-serif); }
  .msg.crewmsg { background: transparent; box-shadow: none; padding: 0; max-width: 100%; align-self: flex-start; white-space: normal; }
  .crew-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; margin: 0 2px 6px; }
  .crew-head b { font-weight: 700; }
  .crew-head .what { color: var(--c-soft); }
  .crew-head .try { margin-left: auto; font: 600 11px/1 var(--mono, ui-monospace, monospace); color: var(--c-soft); }
  .crew-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; }
  .crew-who { position: relative; display: flex; flex-direction: column; align-items: center; margin: 0; min-width: 0; }
  .crew-who svg { width: 96px; height: 96px; display: block; overflow: visible; }
  .crew-who figcaption { font-size: 11.5px; color: var(--c-soft); text-align: center; margin-top: 2px; }
  .crew-who figcaption b { color: var(--c-ink); }
  .crew-say { min-height: 2.7em; width: 100%; padding: 6px 9px; border-radius: 12px; background: color-mix(in srgb, var(--c-card) 88%, #8b7cf6 12%); font-size: 12.5px; margin-bottom: 6px; transition: background-color .3s; }
  .crew-kit .crew-say { background: color-mix(in srgb, var(--c-card) 86%, #f28c3c 14%); }
  .crew-code { width: 100%; height: 58px; overflow: hidden; border-radius: 8px; background: #1e1b2c; color: #c9f7d8; font: 10.5px/1.45 var(--mono, ui-monospace, monospace); padding: 4px 7px; margin-bottom: 4px; }
  .crew-code div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: crewline .3s ease-out both; }
  .crew-code .k { color: #ffb86b; } .crew-code .d { color: #8f88a8; }
  .crew-photo { position: relative; width: 100%; height: 58px; border-radius: 6px; background: #fff; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); margin-bottom: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; color: #b3abc2; font-size: 11px; }
  .crew-photo img { height: 100%; width: 100%; object-fit: contain; }
  .crew-stamp { position: absolute; right: 6px; top: 4px; font: 800 18px/1 var(--ui, system-ui); opacity: 0; transform: scale(1.8) rotate(-12deg); transition: opacity .2s, transform .35s cubic-bezier(.34,1.56,.64,1); }
  .crew[data-verdict="pass"] .crew-stamp { opacity: 1; transform: none; color: var(--c-pass); }
  .crew[data-verdict="fail"] .crew-stamp { opacity: 1; transform: none; color: var(--c-fail); }
  .crew-foot { margin: 6px 2px 0; font-size: 11.5px; color: var(--c-soft); min-height: 1.2em; }
  .crew-foot .pass { color: var(--c-pass); font-weight: 700; } .crew-foot .fail { color: var(--c-fail); font-weight: 700; }
  /* the fox types while writing; the owl peers through the glass while testing, hops on a pass, shakes on a fail */
  .crew .paw { transform-box: fill-box; transform-origin: center; }
  .crew[data-phase="write"] .paw.l { animation: crewtype .22s ease-in-out infinite alternate; }
  .crew[data-phase="write"] .paw.r { animation: crewtype .22s ease-in-out .11s infinite alternate; }
  .crew[data-phase="write"] .kit-head, .crew[data-phase="plan"] .kit-head { animation: crewbob 1.1s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 90%; }
  .crew .glass { transition: transform .5s cubic-bezier(.34,1.56,.64,1); transform-box: fill-box; transform-origin: center; }
  .crew[data-phase="test"] .glass, .crew[data-phase="render"] .glass { animation: crewpeer 1.4s ease-in-out infinite; }
  .crew[data-phase="test"] .pip-head, .crew[data-phase="render"] .pip-head { animation: crewtilt 1.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 80%; }
  .crew[data-verdict="pass"] .pip { animation: crewhop .5s ease-out 2; transform-box: fill-box; transform-origin: 50% 100%; }
  .crew[data-verdict="fail"] .pip-head { animation: crewno .45s ease-in-out 2; transform-box: fill-box; transform-origin: 50% 80%; }
  .crew .eye-happy { display: none; } .crew[data-verdict="pass"] .eye-happy { display: inline; } .crew[data-verdict="pass"] .eye-open { display: none; }
  .crew .sweat { opacity: 0; transition: opacity .3s; } .crew[data-verdict="fail"] .sweat { opacity: 1; }
  .crew[data-phase="idle"] .kit-head { animation: crewbob 3s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 90%; }
  .crew[data-phase="idle"] .zz { opacity: 1; } .crew .zz { opacity: 0; transition: opacity .4s; }
  @keyframes crewtype { from { transform: translateY(0); } to { transform: translateY(-3px); } }
  @keyframes crewbob { 50% { transform: rotate(-3deg) translateY(-1px); } }
  @keyframes crewpeer { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-6px, 3px); } }
  @keyframes crewtilt { 50% { transform: rotate(8deg); } }
  @keyframes crewhop { 50% { transform: translateY(-8px); } }
  @keyframes crewno { 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
  @keyframes crewline { from { opacity: 0; transform: translateX(-6px); } }
  :root[data-mode="zeroday"] .crew { --c-card: rgba(2, 14, 8, .9); --c-ink: #c9ffe0; --c-soft: #6fcf97; border-radius: 6px; box-shadow: 0 0 0 1px rgba(57,255,122,.4), 0 6px 20px rgba(0,0,0,.4); font-family: var(--mono, ui-monospace, monospace); }
  :root[data-mode="zeroday"] .crew-say { background: rgba(57, 255, 122, .08); box-shadow: inset 0 0 0 1px rgba(57,255,122,.25); }
  :root[data-mode="zeroday"] .crew-kit .crew-say { background: rgba(255, 150, 60, .08); box-shadow: inset 0 0 0 1px rgba(255,150,60,.3); }
  .crew.big { width: min(620px, 100%); padding: 14px 16px 10px; font-size: 14px; }
  .crew.big .crew-who svg { width: 128px; height: 128px; } .crew.big .crew-code, .crew.big .crew-photo { height: 84px; }
  /* in 3D (the workshop page, Nov 3): one little scene under the speech bubbles; the drawings stay as the fallback */
  .crew-stage, .crew-names { display: none; }
  .crew.three .crew-who svg, .crew.three .crew-who figcaption { display: none; }
  .crew.three .crew-stage { display: block; height: 210px; margin: 2px -6px 0; }
  .crew.big.three .crew-stage { height: 250px; }
  .crew.three .crew-names { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: center; font-size: 11.5px; color: var(--c-soft); margin-top: -2px; }
  .crew.three .crew-names b { color: var(--c-ink); }
  @media (max-width: 520px) { .crew.big.three .crew-stage { height: 200px; } }
  @media (prefers-reduced-motion: reduce) { .crew * { animation: none !important; } }`;
  if (!document.getElementById("crew-css")) { const st = document.createElement("style"); st.id = "crew-css"; st.textContent = css; document.head.appendChild(st); }

  // Kit: a chibi fox in a little green hoodie, at a laptop (original character)
  const FOX = `<svg viewBox="0 0 120 120" aria-hidden="true"><g class="kit">
    <path d="M86 92c16-2 26-14 22-30-3 10-10 16-19 17" fill="#f28c3c"/><path d="M106 63c2 6 1 11-3 15-3-4-4-9-3-14z" fill="#fff6ea"/>
    <ellipse cx="60" cy="96" rx="25" ry="16" fill="#6cc48a"/><path d="M48 84q12 8 24 0" fill="none" stroke="#4ea36d" stroke-width="2.5" stroke-linecap="round"/>
    <g class="kit-head">
      <path d="M30 34 L36 6 L52 26z" fill="#f28c3c"/><path d="M90 34 L84 6 L68 26z" fill="#f28c3c"/>
      <path d="M33 26 L36 10 L45 22z" fill="#4a2b1a"/><path d="M87 26 L84 10 L75 22z" fill="#4a2b1a"/>
      <ellipse cx="60" cy="50" rx="34" ry="30" fill="#f28c3c"/>
      <path d="M28 54c6 16 20 22 32 22s26-6 32-22c-8 6-18 4-24 1-4 4-12 4-16 0-6 3-16 5-24-1z" fill="#fff6ea"/>
      <ellipse cx="46" cy="50" rx="5" ry="6.5" fill="#2a1d18"/><ellipse cx="74" cy="50" rx="5" ry="6.5" fill="#2a1d18"/>
      <circle cx="47.6" cy="47.6" r="2" fill="#fff"/><circle cx="75.6" cy="47.6" r="2" fill="#fff"/>
      <ellipse cx="60" cy="61" rx="3.6" ry="2.6" fill="#2a1d18"/><path d="M55 65q2.5 3 5 0q2.5 3 5 0" fill="none" stroke="#2a1d18" stroke-width="1.6" stroke-linecap="round"/>
      <ellipse cx="38" cy="60" rx="5" ry="3" fill="#ff9fb0" opacity=".7"/><ellipse cx="82" cy="60" rx="5" ry="3" fill="#ff9fb0" opacity=".7"/>
      <path class="sweat" d="M92 36c3 4 3 7 0 8-3-1-3-4 0-8z" fill="#7cc6f2"/>
    </g>
    <path d="M34 100 h52 l6 12 h-64z" fill="#c9ced6"/><rect x="38" y="80" width="44" height="22" rx="3" fill="#9aa3ad"/><circle cx="60" cy="91" r="3" fill="#fff" opacity=".8"/>
    <ellipse class="paw l" cx="44" cy="103" rx="6" ry="4" fill="#fff6ea"/><ellipse class="paw r" cx="76" cy="103" rx="6" ry="4" fill="#fff6ea"/>
    <g class="zz" fill="#8f88a8" font-size="10" font-weight="700"><text x="94" y="20">z</text><text x="102" y="12">z</text></g>
  </g></svg>`;
  // Pip: a chibi owl with a magnifying glass (original character)
  const OWL = `<svg viewBox="0 0 120 120" aria-hidden="true"><g class="pip">
    <ellipse cx="62" cy="76" rx="32" ry="36" fill="#b9a6ee"/><ellipse cx="62" cy="86" rx="20" ry="22" fill="#efe8ff"/>
    <path d="M54 80l4 4 4-4M62 90l4 4 4-4M54 98l4 4 4-4" fill="none" stroke="#c9b9f2" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="34" cy="80" rx="9" ry="18" fill="#9f8ae0" transform="rotate(12 34 80)"/>
    <path d="M52 110l-4 6M56 110v7M68 110l4 6M64 110v7" stroke="#f2a33c" stroke-width="3" stroke-linecap="round"/>
    <g class="pip-head">
      <path d="M36 28 L40 12 L50 26z" fill="#9f8ae0"/><path d="M88 28 L84 12 L74 26z" fill="#9f8ae0"/>
      <ellipse cx="62" cy="44" rx="30" ry="24" fill="#b9a6ee"/>
      <circle cx="50" cy="44" r="12" fill="#fff"/><circle cx="74" cy="44" r="12" fill="#fff"/>
      <circle cx="50" cy="44" r="12" fill="none" stroke="#9f8ae0" stroke-width="2.5"/><circle cx="74" cy="44" r="12" fill="none" stroke="#9f8ae0" stroke-width="2.5"/>
      <g class="eye-open"><circle cx="47" cy="46" r="5.5" fill="#2a1d18"/><circle cx="71" cy="46" r="5.5" fill="#2a1d18"/><circle cx="48.6" cy="44" r="1.8" fill="#fff"/><circle cx="72.6" cy="44" r="1.8" fill="#fff"/></g>
      <g class="eye-happy" fill="none" stroke="#2a1d18" stroke-width="2.6" stroke-linecap="round"><path d="M43 47q4-5 8 0"/><path d="M67 47q4-5 8 0"/></g>
      <path d="M58 54 L66 54 L62 61z" fill="#f2a33c"/>
      <ellipse cx="40" cy="57" rx="4.5" ry="2.6" fill="#ff9fb0" opacity=".6"/><ellipse cx="84" cy="57" rx="4.5" ry="2.6" fill="#ff9fb0" opacity=".6"/>
    </g>
    <g class="glass"><line x1="26" y1="74" x2="14" y2="88" stroke="#7a5a3a" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="68" r="11" fill="#dff1ff" fill-opacity=".55" stroke="#d4a443" stroke-width="4"/></g>
  </g></svg>`;

  const NAME = (j) => String((j && (j.name || j.request)) || "something").split(":")[0].trim().replace(/^(a|an|the|some)\s+/i, "");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function build(big) {
    const el = document.createElement("div"); el.className = "crew" + (big ? " big" : ""); el.dataset.phase = "idle";
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.innerHTML = `<div class="crew-head"><b>Mochi's workshop</b><span class="what"></span><span class="try"></span></div>
      <div class="crew-row">
        <figure class="crew-who crew-kit"><div class="crew-say kit-say"></div><div class="crew-code"></div>${FOX}<figcaption><b>Kit</b> writes the code</figcaption></figure>
        <figure class="crew-who crew-pip"><div class="crew-say pip-say"></div><div class="crew-photo"><span>no picture yet</span><span class="crew-stamp"></span></div>${OWL}<figcaption><b>Pip</b> tests it, without being told what it is</figcaption></figure>
      </div><div class="crew-stage" aria-hidden="true"></div>
      <div class="crew-names"><span><b>Kit</b> writes the code</span><span><b>Pip</b> tests it, without being told what it is</span></div>
      <div class="crew-foot"></div>`;
    return el;
  }
  // one job's story, step by step (the same for a chat card and the standing panel)
  function apply(el, m) {
    const $ = (s) => el.querySelector(s), kit = (t) => { $(".kit-say").textContent = t; }, pip = (t) => { $(".pip-say").textContent = t; };
    const what = NAME(m), move = m.kind === "move" || m.move;
    const code = (lines, klass = "") => { const c = $(".crew-code"); c.innerHTML = lines.map((l) => `<div class="${klass}">${l}</div>`).join(""); };
    if (m.type === "workbench" && m.status === "working") {
      el.dataset.phase = "plan"; delete el.dataset.verdict; el.dataset.job = m.id;
      $(".what").textContent = `${move ? "learning" : "making"} ${what}`; $(".try").textContent = "";
      kit(move ? `A new move: “${what}”. Let me think…` : `Ooh, ${what}! Let me plan it.`); pip("I'll wait. Don't tell me what it is!");
      code([`<span class="d">// ${esc(what)}</span>`]); $(".crew-photo").innerHTML = `<span>${move ? "a move: it gets played, not photographed" : "no picture yet"}</span><span class="crew-stamp"></span>`; $(".crew-foot").textContent = "";
      return;
    }
    if (m.type === "bench") {
      if (el.dataset.job && String(el.dataset.job) !== String(m.id)) return;
      el.dataset.job = m.id;
      const tryN = typeof m.round === "number" ? m.round + 1 : null;
      if (tryN) $(".try").textContent = `try ${tryN}`;
      switch (m.phase) {
        case "planned":
          el.dataset.phase = "plan";
          kit(m.pattern ? (m.pattern.mode === "base" ? `We have a pattern for ${what}! Quick one.` : `Starting from our ${m.pattern.name} pattern…`) : `No pattern for this one: designing it from scratch.`);
          break;
        case "write":
          el.dataset.phase = "write"; delete el.dataset.verdict;
          kit(m.from === "fix" ? `Fixing it: ${String((m.fixes || []).slice(-1)[0] || "making it clearer").slice(0, 90)}` : m.from === "change" ? `Changing it: ${String((m.fixes || [])[0] || "").slice(0, 90)}` : move ? "Writing the keyframes…" : "Writing the code…");
          code([`<span class="k">prop</span> ${esc(what)} {`, `<span class="d">  …</span>`]);
          break;
        case "wrote":
          el.dataset.phase = "wrote";
          if (m.errors && m.errors.length && !m.parts) { kit(`Oops, that didn't compile: ${String(m.errors[0]).slice(0, 70)}`); break; }
          kit(`Done: ${m.parts} part${m.parts === 1 ? "" : "s"}. Your turn, Pip!`);
          code([`<span class="k">prop</span> ${esc(what)} {`, ...(m.shapes || []).slice(0, 6).map((s) => `  + ${esc(s)}`), "}"]);
          break;
        case "render":
          el.dataset.phase = "render";
          if (m.img) $(".crew-photo").innerHTML = `<img alt="Kit's ${esc(what)}, as Pip sees it" src="${m.img}"><span class="crew-stamp"></span>`;
          pip("Let me take a look…");
          break;
        case "critique": el.dataset.phase = "test"; pip("Hmm… here's what would help."); break;
        case "test":
          el.dataset.phase = "test";
          if (m.img) $(".crew-photo").innerHTML = `<img alt="the pattern, as Pip sees it" src="${m.img}"><span class="crew-stamp"></span>`;
          el.dataset.verdict = m.pass ? "pass" : "fail"; $(".crew-stamp").textContent = m.pass ? "✓" : "✗";
          if (move) pip(m.pass ? `It plays! ${m.guess}.` : `It won't play: ${String(m.guess).slice(0, 70)}`);
          else pip(m.pass ? `That's ${/^(a|an|the|some)\s/i.test(m.guess) ? "" : "a "}${m.guess}!` : `Hmm… looks like ${/^(a|an|the|some)\s/i.test(m.guess) ? "" : "a "}${m.guess} to me.`);
          kit(m.pass ? "Yay! Shipping it to Mochi." : "Back to the code!");
          break;
        case "photo":   // a page opened mid-job: the picture so far, without replaying a step
          if (m.img && !$(".crew-photo img")) $(".crew-photo").innerHTML = `<img alt="Kit's ${esc(what)}, as Pip sees it" src="${m.img}"><span class="crew-stamp">${el.dataset.verdict === "pass" ? "✓" : el.dataset.verdict === "fail" ? "✗" : ""}</span>`;
          break;
        case "fix":
          el.dataset.phase = "fix";
          pip(`Fix: ${String((m.fixes || []).slice(-1)[0] || "make it clearer").slice(0, 100)}`); kit("On it!");
          break;
      }
      return;
    }
    if (m.type === "workbench" && m.status === "dropped") { if (!el.dataset.job || String(el.dataset.job) === String(m.id)) idle(el); return; }   // a reset mid-job
    if (m.type === "reborn") { idle(el); return; }
    if (m.type === "workbench" && (m.status === "done" || m.status === "failed" || m.status === "queued")) {
      if (el.dataset.job && String(el.dataset.job) !== String(m.id)) return;
      const v = m.verdict || {}, s = Math.round((m.ms || 0) / 1000);
      el.dataset.phase = "done";
      if (m.status === "done") {
        if (m.thumb && !$(".crew-photo img")) $(".crew-photo").innerHTML = `<img alt="" src="${m.thumb}"><span class="crew-stamp"></span>`;
        if (v.fix) { kit("Changed it the way you said."); pip("Looks good to me!"); el.dataset.verdict = "pass"; }
        else if (move) { el.dataset.verdict = "pass"; }
        else if (v.matched) { el.dataset.verdict = "pass"; $(".crew-stamp").textContent = "✓"; }
        else if (v.unsure) { pip("I'm still not sure… Mochi will ask you."); kit("We kept our best try."); }
        $(".crew-foot").innerHTML = `${v.matched || v.fix || move ? `<span class="pass">Shipped</span>` : `<span>Kept the best try</span>`} · ${esc(m.name || what)} · ${s} s${v.matched && v.guess ? ` · Pip saw “${esc(v.guess)}”` : ""}`;
      } else if (m.status === "failed") { kit("That one beat us…"); pip("We'll try again another time."); $(".crew-foot").innerHTML = `<span class="fail">Couldn't make it</span> · ${s} s`; }
      else { kit("Taking a short break: one more try later."); $(".crew-foot").textContent = "Back in the queue."; }
      const job = el.dataset.job;   // only this job's result goes back to idle, not a newer one's (Nov 3 review)
      setTimeout(() => { if (el.dataset.phase === "done" && el.dataset.standing && el.dataset.job === job) idle(el); }, 9000);
    }
  }
  function idle(el) {
    el.dataset.phase = "idle"; delete el.dataset.verdict; delete el.dataset.job;
    el.querySelector(".what").textContent = ""; el.querySelector(".try").textContent = "";
    el.querySelector(".kit-say").textContent = "Nothing on the workbench. Ask Mochi for something!"; el.querySelector(".pip-say").textContent = "I'm ready to test whatever Kit makes.";
    el.querySelector(".crew-code").innerHTML = `<div class="d">// waiting…</div>`; el.querySelector(".crew-foot").textContent = "";
  }
  // the stage: one card per job, in the chat where it was asked for
  function card(m) { const el = build(false); apply(el, m); return el; }
  function mount(host, { big = true, socket = false } = {}) {
    const el = build(big); el.dataset.standing = "1"; idle(el); host.appendChild(el);
    // Kit and Pip in 3D, lit like Mochi (kit/src/crew.js); without WebGL the drawings stay
    import("/kit/dist/crew.min.js").then((mod) => { if (mod.mountCrew3D(el, el.querySelector(".crew-stage"))) el.classList.add("three"); }).catch(() => {});
    const on = (m) => { if (m && (m.type === "bench" || m.type === "workbench" || m.type === "reborn")) apply(el, m); };
    document.addEventListener("mochi:crew", (e) => on(e.detail));
    // a page opened mid-job: what's happened so far
    fetch("/api/bench").then((r) => r.json()).then((b) => {
      if (!b.current) return;
      on({ type: "workbench", status: "working", id: b.current.id, kind: b.current.kind, request: b.current.request });
      // the steps in order; then the picture, set as it is (a replayed "render" step showed "let me take a look" mid-fix)
      for (const s of b.current.steps || []) on({ type: "bench", id: b.current.id, kind: b.current.kind, request: b.current.request, ...s });
      if (b.current.img) on({ type: "bench", id: b.current.id, kind: b.current.kind, request: b.current.request, phase: "photo", img: b.current.img });
    }).catch(() => {});
    if (socket) {
      const open = () => {
        let ws; try { ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`); } catch (_) { return; }
        ws.onmessage = (e) => { let m = null; try { m = JSON.parse(e.data); } catch (_) { return; } on(m); };
        ws.onclose = () => setTimeout(open, 3000);
      };
      open();
    }
    return el;
  }
  window.Crew = { card, mount, apply };
})();
