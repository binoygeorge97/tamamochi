/* Mochi talks and listens (Binoy, Nov 2).
 *   speak   his replies are spoken: ElevenLabs through the server when there's a key (/api/tts, MP3), else Kokoro on
 *           the M5's own CPU (a WAV, Nov 6), else the browser's own voice pitched up (free, offline). His mouth moves
 *           with the sound. A mute button, remembered.
 *   listen  tap the mic (or hold Space with nothing focused) and talk; the clip goes to /api/stt (ElevenLabs Scribe,
 *           or a local Whisper on the M5); if the server can't, the browser's built-in recognition does it. What you
 *           said goes through the chat exactly as if typed.
 *   point   "shoot this thing over here": the server says what to do, the page asks for a tap (a glowing cue, the
 *           stage under a crosshair), and the tap becomes the target: he fires, throws, looks or walks there. No tap
 *           in 8 s: straight ahead. Typed or spoken, both work.
 * Captions always stay on: it's a demo in a hall. */
(() => {
  const $ = (id) => document.getElementById(id), M = () => window.__mochi, PR = () => window.__mochiProps;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* no storage */ } } };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // a phone (Nov 4, Binoy on the Cloudflare link: "the audio option on my phone was not working"): sound only after a
  // real tap, and the tap that counts is the finger coming up, not going down
  const touchy = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  let serverStt = null;   // can the server turn speech into words (an ElevenLabs key, or a local Whisper)? null: not asked yet
  fetch("/api/voice").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) serverStt = !!j.stt; }).catch(() => { /* offline */ });

  /* ---------------------------------------------------------------- speaking */
  let muted = store.get("mochi.muted") === "1", audio = null, ctx = null, analyser = null, data = null, meterRAF = 0, speakSeq = 0, fallbackVoice = null;
  let player = null, unlocked = false, primedSpeech = false;   // (one audio element, started inside a tap, reused: phones let that one play later)
  const SILENT = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
  const muteBtn = $("mute");
  const paintMute = () => { if (!muteBtn) return; muteBtn.setAttribute("aria-pressed", String(muted)); muteBtn.textContent = muted ? "🔇 Voice off" : "🔊 Voice on"; muteBtn.title = muted ? "Mochi's voice is off (captions stay on)" : "Mochi speaks his replies"; };
  paintMute();
  if (muteBtn) muteBtn.addEventListener("click", () => { muted = !muted; store.set("mochi.muted", muted ? "1" : "0"); paintMute(); if (muted) { stopSpeaking(); if (window.PARTY_MUSIC) window.PARTY_MUSIC.stop(); } else unlockAudio(); });
  function unlockAudio() {   // browsers want a gesture before sound: a tap primes every path (a silent sound on each)
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== "running") ctx.resume();
      const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0);
    } catch (_) { ctx = null; }
    if (!player) { player = new Audio(); player.playsInline = true; player.setAttribute("playsinline", ""); player.preload = "auto"; }
    if (!unlocked && !talking) { try { player.src = SILENT; const p = player.play(); if (p && p.then) p.then(() => { unlocked = true; }).catch(() => { /* next tap */ }); else unlocked = true; } catch (_) { /* next tap */ } }
    if ("speechSynthesis" in window) try {
      speechSynthesis.getVoices();
      if (touchy && !primedSpeech) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); primedSpeech = true; }   // (iOS: the first one has to come from a tap)
    } catch (_) { /* fine */ }
  }
  // the finger coming up (or a click, or a key) is what lets a page make sound; keep trying until it took
  for (const ev of ["pointerup", "touchend", "click", "keydown"]) addEventListener(ev, () => { if (!unlocked || !ctx || ctx.state !== "running") unlockAudio(); }, { capture: true, passive: true });
  function meter() {   // his mouth follows the sound
    if (!analyser) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / data.length), level = Math.min(1, Math.max(0, (rms - 0.02) * 6));
    M() && M().speaking && M().speaking(level);
    meterRAF = requestAnimationFrame(meter);
  }
  // Mimi's and Cocoa's lines wait their turn after his (a little queue); each speaks in its own voice
  let queue = [], talking = false;
  const PITCH = { mochi: [1.7, 1.08], mimi: [1.95, 1.12], cocoa: [1.15, 1.06] };
  function done(seq) {
    if (seq !== speakSeq) return; talking = false;
    let n; while ((n = queue.shift()) && n.at && performance.now() - n.at > 7000) { /* too late now: the moment's gone */ }
    if (n) speak(n.text, { who: n.who, after: false, chained: true });
  }
  function stopSpeaking() {
    speakSeq++; queue = []; talking = false;
    if (audio) { try { audio.pause(); if (audio._src && audio !== player) audio._src.disconnect(); } catch (_) { /* fine */ } audio = null; }
    if ("speechSynthesis" in window) try { speechSynthesis.cancel(); } catch (_) { /* fine */ }
    cancelAnimationFrame(meterRAF); meterRAF = 0; M() && M().speaking && M().speaking(0);
  }
  function pickFallbackVoice() {
    if (fallbackVoice || !("speechSynthesis" in window)) return fallbackVoice;
    const vs = speechSynthesis.getVoices();
    const want = [/Samantha/i, /Zira/i, /Google US English/i, /Aria/i, /Jenny/i, /Ava/i, /en[-_]US/i, /en/i];
    for (const re of want) { const v = vs.find((x) => re.test(`${x.name} ${x.lang}`)); if (v) { fallbackVoice = v; break; } }
    return fallbackVoice;
  }
  function speakFallback(text, seq, who = "mochi") {   // the browser's voice, small and bright (Mimi higher, Cocoa lower)
    if (!("speechSynthesis" in window)) { done(seq); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = pickFallbackVoice(); if (v) u.voice = v;
    const [pitch, rate] = PITCH[who] || PITCH.mochi;
    u.pitch = pitch; u.rate = rate; u.volume = 1;
    let t0 = 0; const words = text.split(/\s+/).length, dur = Math.max(800, words * 330);
    const fake = () => {   // no audio stream to measure: a talky mouth for about as long as it speaks
      if (seq !== speakSeq || who !== "mochi") return;
      const el = performance.now() - t0; if (el > dur) { M() && M().speaking && M().speaking(0); return; }
      M() && M().speaking && M().speaking(0.35 + 0.45 * Math.abs(Math.sin(el / 95)) * (0.6 + 0.4 * Math.sin(el / 310)));
      meterRAF = requestAnimationFrame(fake);
    };
    u.onstart = () => { t0 = performance.now(); fake(); };
    u.onend = u.onerror = () => { if (seq === speakSeq) { cancelAnimationFrame(meterRAF); M() && M().speaking && M().speaking(0); } done(seq); };
    try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (_) { /* no voice */ }
  }
  // a line said a moment ago isn't said again: the page speaks some lines itself and puts them in a bubble too
  const recent = new Map(), keyOf = (who, t) => `${who}|${t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
  // the tone of a line of his, for his face while he says it (Nov 5: his mouth was a smile whatever he said). Words,
  // not a model: it costs nothing. First one that fits; "not sad" and the like don't count
  const TONES = [
    ["sad", /\b(sad|sadly|cry|crying|cried|tears?|sob|lonely|heartbroken|miss (?:you|her|him|them|it)|that'?s (?:awful|terrible|horrible|so sad)|passed away|died|lost (?:my|his|her|your)|boo-?hoo|sniff(?:le)?s?|it hurts?|i'?m hurt|feel(?:ing)? (?:down|blue|bad))\b|:\(|😢|😭|💔/i],
    ["scared", /\b(scared|scary|afraid|frightened|terrified|eek+|yikes|spooky|nervous|uh[- ]oh|gulp)\b/i],
    ["cross", /\b(hmph|humph|not fair|grr+|so mad|i'?m mad|angry|annoyed|that'?s mean|rude|meanie|how dare)\b/i],
    ["sorry", /\b(sorry|oops|whoops|my bad|apologi[sz]e|forgive me|i didn'?t mean|i messed up|i forgot)\b/i],
    ["worried", /\b(are you (?:ok|okay|alright|all right)|worried|i hope you'?re|feel better|take care|be careful|oh no|poor (?:you|thing))\b/i],
  ];
  function toneOf(text) {
    const t = String(text || "");
    // a voice tag says it outright ({sad}…, {sorry}…): his face goes with that
    const tag = /\{(sad|sorry|worried|scared|cross|angry)\}/i.exec(t);
    if (tag) return tag[1].toLowerCase() === "angry" ? "cross" : tag[1].toLowerCase();
    for (const [tone, re] of TONES) {
      const m = re.exec(t);
      if (m && !/\b(?:not|never|no longer|isn'?t|aren'?t|don'?t|won'?t|no need to)\s+(?:be\s+|feel\s+|so\s+|too\s+)?$/i.test(t.slice(Math.max(0, m.index - 22), m.index))) return tone;
    }
    return null;
  }
  /** say his reply out loud (no-op when muted) */
  async function speak(text, { who = "mochi", after = false, chained = false, at = 0 } = {}) {
    // his face goes with it, voice or no voice: as long as it takes to say (about a third of a second a word)
    if (who === "mochi" && !(after && talking) && M() && M().speakingTone) { const tone = toneOf(text); M().speakingTone(tone, 600 + String(text || "").split(/\s+/).length * 340); }
    // (no brackets, stage directions, hearts, notes, sparkles or emoji: they'd be read out as words)
    const clean = String(text || "").replace(/\{\/?[a-z]*(?:=[^{}\s]*)?\}/gi, " ").replace(/\[[^\]]*\]/g, " ").replace(/\*[^*\n]*\*/g, " ").replace(/[♡♥❤♪♫~★☆✨]|\p{Extended_Pictographic}|\uFE0F/gu, " ").replace(/\s{2,}/g, " ").replace(/\s+([!?.,…])/g, "$1").trim();
    if (muted || !clean || !/[a-z]/i.test(clean)) return;
    const k = keyOf(who, clean), now = performance.now();
    if (!chained) { if (now - (recent.get(k) || -1e9) < 5000) return; recent.set(k, now); if (recent.size > 60) recent.delete(recent.keys().next().value); }
    if (after && talking) {   // a friend's line, or one of his own little ones: after what's being said (a few at most)
      if (queue.length < 3) queue.push({ text: clean, who, at: now });
      return;
    }
    if (!chained) stopSpeaking();
    talking = true;
    const seq = speakSeq;
    let url = null;
    // (Nov 7: "sometimes the Kokoro voices are not used and the phone voice is used". A server that was restarting,
    // busy or briefly unreachable sent him straight to the browser's voice; now it's asked once more first. Only a
    // 204, "the server has no voice", goes to the browser's voice at once.)
    for (let tries = 0; tries < 2 && !url; tries++) {
      let st = 0;
      try {
        // (raw: as written, stage directions and all: the M5's own voice acts on them, "*whispers*", "(psst…)", "…")
        const r = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: clean, raw: String(text || "").slice(0, 1200), who }) });
        st = r.status; if (st === 200) url = URL.createObjectURL(await r.blob());
      } catch (_) { st = 0; /* offline or restarting */ }
      if (seq !== speakSeq) { if (url) URL.revokeObjectURL(url); return; }
      if (url || st === 204 || st === 400) break;
      if (tries === 0) await new Promise((ok) => setTimeout(ok, 1500));
      if (seq !== speakSeq) return;
    }
    if (!url) return speakFallback(clean, seq, who);
    // on a phone: the element a tap started, played straight out (through a sleeping AudioContext it would be silent);
    // his mouth moves for as long as it plays. Elsewhere a fresh one, through the analyser, so his mouth follows it
    const shared = touchy && player;
    const a = audio = shared ? player : new Audio(url);
    if (shared) a.src = url;
    let src = null;
    try {
      if (!shared && ctx && ctx.state === "running") {
        if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 512; data = new Uint8Array(analyser.fftSize); analyser.connect(ctx.destination); }
        src = ctx.createMediaElementSource(a); src.connect(analyser); a._src = src;
      }
    } catch (_) { src = null; }
    const talky = () => {   // no stream to measure: a talky mouth while it plays
      if (seq !== speakSeq || who !== "mochi" || a.paused || a.ended) { M() && M().speaking && M().speaking(0); return; }
      const el = performance.now(); M() && M().speaking && M().speaking(0.35 + 0.45 * Math.abs(Math.sin(el / 95)) * (0.6 + 0.4 * Math.sin(el / 310)));
      meterRAF = requestAnimationFrame(talky);
    };
    a.onplay = () => { if (who !== "mochi") return; if (src && analyser) meter(); else talky(); };
    a.onended = a.onerror = () => { if (seq === speakSeq) { cancelAnimationFrame(meterRAF); M() && M().speaking && M().speaking(0); } try { if (src) src.disconnect(); } catch (_) { /* gone */ } URL.revokeObjectURL(url); done(seq); };   // (unhooked, or every line stays wired up)
    try { await a.play(); } catch (e) {
      // the browser won't play sound before you've tapped the page: keep his own voice for your next tap (a few
      // seconds' grace) rather than switch to the browser's voice, which sounds like someone else
      if (e && e.name === "NotAllowedError") { if (heldClip) URL.revokeObjectURL(heldClip.url); heldClip = { url, at: performance.now() }; done(seq); return; }
      URL.revokeObjectURL(url); speakFallback(clean, seq, who);
    }
  }

  let heldClip = null;   // a clip the browser wouldn't play yet (no tap so far): played on the next tap if it's fresh
  const playPending = () => {
    const p = heldClip; heldClip = null; if (!p) return;
    if (performance.now() - p.at > 12000 || muted) { URL.revokeObjectURL(p.url); return; }
    const a = new Audio(p.url); a.onended = a.onerror = () => URL.revokeObjectURL(p.url); a.play().catch(() => URL.revokeObjectURL(p.url));
  };
  for (const ev of ["pointerdown", "keydown", "touchend"]) addEventListener(ev, playPending, { capture: true, passive: true });

  /* ---------------------------------------------------------------- listening */
  const mic = $("mic"), input = $("msg");
  let rec = null, chunks = [], recT0 = 0, listening = false, recog = null;
  // what you see while it listens (Nov 4: on his phone it wasn't clear it was recording, or that it had stopped): the
  // mic turns red with a stop square; a bar over the message box says it's listening, for how long, what it's heard so
  // far, and then that it's working it out, or what it heard, or that it didn't catch anything
  const bar = $("recbar"), barText = $("recText"), barTime = $("recTime"), barStop = $("recStop");
  let barT = 0, barHide = 0, barT0 = 0;
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* fine */ } };
  function paintBar(state, text = "") {
    if (!bar) return;
    clearInterval(barT); clearTimeout(barHide);
    if (state === "off") { bar.hidden = true; return; }
    bar.hidden = false; bar.dataset.state = state;
    if (state === "on") {
      barT0 = performance.now(); barText.textContent = text || "Listening… talk, then tap Stop"; barTime.textContent = "0:00";
      barT = setInterval(() => { const s2 = Math.floor((performance.now() - barT0) / 1000); barTime.textContent = `${Math.floor(s2 / 60)}:${String(s2 % 60).padStart(2, "0")}`; }, 250);
    } else {
      barTime.textContent = ""; barText.textContent = text;
      if (state === "done") barHide = setTimeout(() => { bar.hidden = true; }, 2600);
    }
  }
  if (barStop) barStop.addEventListener("click", () => stopListening());
  const paintMic = (state) => {
    if (!mic) return;
    const was = mic.dataset.state; mic.dataset.state = state;
    mic.title = state === "on" ? "Listening… tap to stop" : state === "busy" ? "Thinking…" : "Talk to Mochi (or hold Space)";
    mic.setAttribute("aria-label", state === "on" ? "Stop listening" : "Talk to Mochi");
    if (state === "on" && was !== "on") { paintBar("on"); buzz(30); }
    else if (state === "busy") { paintBar("busy", "Got it, working out what you said…"); if (was === "on") buzz([20, 60, 20]); }
    else if (state === "off" && was === "on") { buzz([20, 60, 20]); if (bar && !bar.hidden && bar.dataset.state === "on") paintBar("done", "Stopped"); }
  };
  let preferBrowser = false;   // the server couldn't do it last time: the browser listens, from the next tap
  async function startListening() {
    if (listening) return;
    unlockAudio();
    // the server can't turn speech into words (no key, no Whisper): the browser listens itself, straight from this tap
    // (a phone won't let it start later, after the clip has been sent and come back empty)
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR && (serverStt === false || preferBrowser)) { startRecognition(); return; }
    listening = true; paintMic("on");
    if (navigator.mediaDevices && window.MediaRecorder) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
        rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); chunks = []; recT0 = performance.now();
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); finishClip(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" })); };
        rec.start(250);
        stopSpeaking();   // he goes quiet while you talk
        return;
      } catch (e) { rec = null; }
    }
    startRecognition();   // no mic recording: the browser listens itself
  }
  function stopListening() {
    if (!listening) return;
    if (rec && rec.state !== "inactive") { rec.stop(); return; }
    if (recog) { try { recog.stop(); } catch (_) { /* fine */ } return; }
    listening = false; paintMic("off");
  }
  async function finishClip(blob) {
    const seconds = Math.max(1, Math.round((performance.now() - recT0) / 1000));
    rec = null;
    if (blob.size < 1200 || seconds < 1) { listening = false; paintMic("off"); paintBar("done", "That was too short: tap the mic, talk, then tap Stop"); return; }   // a tap, not a sentence
    paintMic("busy");
    let text = null;
    try {
      const r = await fetch("/api/stt", { method: "POST", headers: { "content-type": blob.type || "audio/webm", "x-seconds": String(seconds) }, body: blob });
      if (r.status === 200) text = (await r.json()).text || "";
    } catch (_) { /* offline */ }
    listening = false; paintMic("off");
    if (text === null) {   // the server can't transcribe: the browser's own recognition (on a phone, from the next tap)
      preferBrowser = true;
      if (touchy) { const can = !!(window.SpeechRecognition || window.webkitSpeechRecognition); paintBar("done", can ? "Tap the mic again and talk: I'll listen right here this time" : "I can't turn speech into words here: type instead"); bubble(can ? "[tap the mic again and talk: I'll listen right here this time]" : "[no microphone transcription available here; type instead]", "sys"); }
      else startRecognition();
      return;
    }
    if (text) { paintBar("done", `Heard: “${text.length > 60 ? `${text.slice(0, 60)}…` : text}”`); sendWords(text); } else { paintBar("done", "I didn't catch that: tap the mic and try again"); bubble("[I didn't catch that]", "sys"); }
  }
  function startRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { listening = false; paintMic("off"); bubble("[no microphone transcription available here; type instead]", "sys"); return; }
    try {
      recog = new SR(); recog.lang = "en-US"; recog.interimResults = true; recog.maxAlternatives = 1;
      listening = true; paintMic("on");
      let finalText = "";
      recog.onresult = (e) => { let s = ""; for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript; if (e.results[e.results.length - 1].isFinal) finalText = s; if (input) input.placeholder = s || input.placeholder; if (s && barText && bar && bar.dataset.state === "on") barText.textContent = `“${s}”`; };
      recog.onerror = (e) => { recog = null; listening = false; paintMic("off"); if (e && /not-allowed|service-not-allowed/.test(e.error || "")) { bubble("[the microphone isn't allowed: check this site's microphone permission]", "sys"); paintBar("done", "The microphone isn't allowed here"); } };
      recog.onend = () => {
        recog = null; listening = false; paintMic("off");
        if (input) input.placeholder = input.dataset.placeholder || (document.documentElement.dataset.mode === "zeroday" ? "> talk to Mochi" : "Talk to Mochi");
        const said = finalText.trim();
        if (said) { paintBar("done", `Heard: “${said.length > 60 ? `${said.slice(0, 60)}…` : said}”`); sendWords(said); } else paintBar("done", "I didn't catch that: tap the mic and try again");
      };
      recog.start();
    } catch (_) { recog = null; listening = false; paintMic("off"); }
  }
  function sendWords(text) {
    if (!input) return;
    input.value = text;
    const form = input.form; if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
  }
  if (mic) mic.addEventListener("click", () => (listening ? stopListening() : startListening()));
  addEventListener("keydown", (e) => { if (e.code === "Space" && !e.repeat && document.activeElement === document.body) { e.preventDefault(); startListening(); } });
  addEventListener("keyup", (e) => { if (e.code === "Space" && listening && rec) stopListening(); });
  function bubble(text, who) { const chat = $("chat"); if (!chat) return; const d = document.createElement("div"); d.className = `msg ${who}`; d.textContent = window.ZD && window.ZD.on() ? window.ZD.sys(text) : text; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; }

  /* ---------------------------------------------------------------- pointing */
  const stage = $("stage"), cue = $("pointcue");
  let pending = null;
  const LINES = { shoot: "Tap what I should shoot!", throw: "Tap where to throw it!", look: "Tap what to look at!", go: "Tap where I should go!", put: "Tap where to put it!" };
  /** the server says what he'll do; the next tap says where */
  function arm(p) {
    if (!p || !stage) return;
    disarm();
    pending = { ...p, t0: performance.now(), timer: setTimeout(() => { const q = pending; disarm(); if (q) resolve(q, null); }, 8000) };
    stage.classList.add("pointing");
    if (cue) { cue.textContent = LINES[p.do] || "Tap the spot!"; cue.classList.add("on"); }
    if (p.prop && PR() && (p.do === "shoot" || p.do === "throw")) PR().summon(p.prop, { ms: 30000 });   // out it comes, ready
    M() && M().play && M().play("excited", 1200);
  }
  function disarm() { if (pending) clearTimeout(pending.timer); pending = null; if (stage) stage.classList.remove("pointing"); if (cue) cue.classList.remove("on"); }
  function resolve(p, at) {
    const m = M(), pr = PR();
    if (!pr || !m) return;
    if (at && p.do === "look") { m.lookAt(at.x, at.y, 3000); return; }
    if (at && p.do === "go") { m.walkTo(at.x, at.y); return; }
    if (p.do === "put") { if (at && m.walkTo) m.walkTo(at.x, at.y); setTimeout(() => pr.putAway(), at ? 3200 : 400); return; }
    // shoot or throw: the prop is in his hoof (summoned when armed); aim at the tap, or straight ahead
    const fire = () => { if (at) pr.pointAt(at.x, at.y); else pr.fire(); };
    if (pr.current() && pr.current().name === (p.prop && p.prop.name)) fire(); else { if (p.prop) pr.summon(p.prop, { ms: 30000 }); setTimeout(fire, 700); }
  }
  if (stage) stage.addEventListener("pointerdown", (e) => {
    if (!pending) return;
    const p = pending; disarm();
    e.stopImmediatePropagation(); e.preventDefault();   // this tap is the target, not a tap on the stage
    resolve(p, { x: e.clientX, y: e.clientY });
  }, true);
  // a tap on him counts too (the kit's own box takes those): "look at this" + tapping his nose
  document.addEventListener("mochi:touch", (e) => { if (pending) { const p = pending; disarm(); const d = e.detail || {}; resolve(p, d.x !== undefined ? { x: d.x, y: d.y } : null); } });

  // everything said in a bubble over him, Mimi or Cocoa is said out loud too (Nov 5: "everything's spinning" when he's
  // dragged about, laughing when he's tickled, Mimi's and Cocoa's lines): the kit announces each one
  addEventListener("mochi:say", (e) => { const d = e.detail || {}; if (d.text) speak(d.text, { who: ["mimi", "cocoa"].includes(d.who) ? d.who : "mochi", after: true }); });
  window.VOICE = { speak, stop: stopSpeaking, listen: startListening, stopListening, arm, disarm, pending: () => pending && pending.do, muted: () => muted, setMuted: (v) => { muted = !!v; store.set("mochi.muted", muted ? "1" : "0"); paintMute(); } };
})();
