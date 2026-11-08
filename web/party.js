/* The dance party's music, and his sneeze (Nov 3): a little four-on-the-floor loop made right here in the browser (no files, no
 * network): kick, clap, hats, a bouncy bass and a soft arpeggio over C, G, Am, F at 120 bpm. It starts when the kit
 * says the party is on (mochi:party) and fades out when it ends. Muted when his voice is muted. */
(() => {
  let ctx = null, master = null, timer = null, nextAt = 0, step = 0, noise = null;
  const BPM = 120, S16 = 60 / BPM / 4;   // a sixteenth note
  const CHORDS = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];   // C, G, Am, F (MIDI)
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const muted = () => !!(window.VOICE && window.VOICE.muted && window.VOICE.muted());
  function setup() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); env(g, t, 0.004, 0.9, 0.2); o.connect(g).connect(master); o.start(t); o.stop(t + 0.22); }
  function hiss(t, dur, freq, q, peak, type = "highpass") { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q; env(g, t, 0.002, peak, dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.02); }
  function tone(t, note, dur, type, peak, cut = 2400) { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type; o.frequency.value = hz(note); f.type = "lowpass"; f.frequency.value = cut; env(g, t, 0.008, peak, dur); o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + 0.03); }
  function schedule() {
    while (nextAt < ctx.currentTime + 0.12) {
      const t = nextAt, s = step % 16, bar = Math.floor(step / 16), chord = CHORDS[bar % CHORDS.length];
      if (s % 4 === 0) kick(t);                                    // four on the floor
      if (s === 4 || s === 12) hiss(t, 0.12, 1400, 0.8, 0.32, "bandpass");   // clap
      if (s % 4 === 2) hiss(t, 0.05, 7000, 0.7, 0.12);             // open-ish hat on the off-beat
      else if (s % 2 === 1) hiss(t, 0.025, 9000, 0.7, 0.05);       // closed hats
      if (s % 2 === 0) tone(t, chord[0] - 12 + (s % 8 === 6 ? 12 : 0), S16 * 1.6, "triangle", 0.32, 900);   // bass, with a hop up
      tone(t, chord[(s % 3)] + 12 + (s % 8 > 3 ? 12 : 0), S16 * 0.9, "square", 0.045, 2600);               // soft arpeggio
      nextAt += S16; step++;
    }
  }
  function start() {
    if (muted() || !setup()) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    clearInterval(timer); step = 0; nextAt = ctx.currentTime + 0.05;
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.4);
    timer = setInterval(schedule, 25); schedule();
  }
  function stop() {
    if (!ctx || !timer) return;
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    const tm = timer; setTimeout(() => { clearInterval(tm); if (timer === tm) timer = null; }, 1300);
  }
  document.addEventListener("mochi:party", (e) => { if (e.detail && e.detail.on) start(); else stop(); });
  window.PARTY_MUSIC = { start, stop, playing: () => !!timer };
  // Nov 3: his sneeze, "…CHOO!": a breathy burst of noise through a mouth-ish filter, and a tiny squeak on top
  function sneeze() {
    if (muted() || !setup()) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime + 0.01, out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.28);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + 0.36);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.22);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.12, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(og).connect(out); o.start(t); o.stop(t + 0.26);
  }
  document.addEventListener("mochi:sneeze", sneeze);
  // Nov 3, his activity book: little made-up sounds for what he's doing (a strummed guitar, drums, a piano tune, a
  // hummed song, a sizzling pot, a camera click…), all synthesised here, no files. "mochi:sound" {kind, ms} from the kit.
  let live = [], beatOwned = false, beatTimer = null;
  function endBeat() { clearTimeout(beatTimer); if (beatOwned && !(window.__mochi && window.__mochi.partying && window.__mochi.partying())) stop(); beatOwned = false; }
  document.addEventListener("mochi:party", (e) => { if (e.detail && e.detail.on) { beatOwned = false; clearTimeout(beatTimer); } });   // a real party takes the music over
  function sfxOut(vol = 0.32) { const g = ctx.createGain(); g.gain.value = vol; g.connect(ctx.destination); live.push(g); setTimeout(() => { live = live.filter((x) => x !== g); }, 20000); return g; }
  function T(out, t, note, dur, type = "triangle", peak = 0.3, cut = 3000, a = 0.008) { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type; o.frequency.value = hz(note); f.type = "lowpass"; f.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05); return o; }
  function N(out, t, dur, freq, q, peak, type = "bandpass", to = null) { const sN = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); sN.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); f.Q.value = q; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); sN.connect(f).connect(g).connect(out); sN.start(t, Math.random() * 0.5); sN.stop(t + dur + 0.02); }
  function sweep(out, t, f0, f1, dur, type = "sine", peak = 0.3) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02); }
  const PENTA = [60, 62, 64, 67, 69, 72, 74, 76];
  const SFX = {
    guitar(o, t, d) { let k = 0; for (let x = 0; x < d - 0.3; x += 0.5, k++) { const ch = CHORDS[Math.floor(k / 2) % 4]; [...ch, ch[0] + 12].forEach((n, i) => T(o, t + x + i * 0.018, n + 12, 0.9, "triangle", 0.12, 2200)); } },
    piano(o, t, d) { let n = 2; for (let x = 0; x < d - 0.3; x += 0.32) { n = Math.max(0, Math.min(PENTA.length - 1, n + [-1, 1, 1, -2, 2, 0][Math.floor(Math.random() * 6)])); T(o, t + x, PENTA[n] + 12, 0.7, "sine", 0.18, 4000); if (Math.round(x / 0.32) % 4 === 0) T(o, t + x, PENTA[0] - 12 + (Math.round(x / 1.28) % 2 ? 7 : 0), 1.2, "sine", 0.12, 1500); } },
    drums(o, t, d) { for (let x = 0, i = 0; x < d - 0.2; x += 0.25, i++) { if (i % 4 === 0) sweep(o, t + x, 150, 45, 0.22, "sine", 0.6); if (i % 4 === 2) N(o, t + x, 0.14, 1800, 0.7, 0.35); if (i % 2 === 1) N(o, t + x, 0.04, 8000, 0.7, 0.08, "highpass"); if (i % 8 === 7) sweep(o, t + x, 220, 110, 0.2, "sine", 0.35); } },
    sing(o, t, d) { let n = 4; for (let x = 0; x < d - 0.3; x += 0.45) { n = Math.max(0, Math.min(PENTA.length - 1, n + [-1, 1, -1, 2, -2, 0][Math.floor(Math.random() * 6)])); const v = T(o, t + x, PENTA[n] + 12, 0.5, "triangle", 0.16, 1600, 0.05); const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 6; lfo.connect(lg).connect(v.frequency); lfo.start(t + x); lfo.stop(t + x + 0.55); } },
    trumpet(o, t, d) { const tune = [67, 72, 76, 79, 76, 79]; for (let x = 0, i = 0; x < d - 0.3; x += 0.36, i++) T(o, t + x, tune[i % tune.length], 0.34, "sawtooth", 0.1, 1700, 0.03); },
    trumpetFanfare(o, t) { [[67, 0, 0.18], [72, 0.2, 0.18], [76, 0.4, 0.18], [79, 0.6, 0.6], [76, 1.25, 0.18], [79, 1.45, 0.9]].forEach(([n, x, du]) => T(o, t + x, n, du, "sawtooth", 0.1, 1800, 0.03)); },
    maracas(o, t, d) { for (let x = 0, i = 0; x < d - 0.1; x += 0.125, i++) N(o, t + x, i % 4 === 0 ? 0.09 : 0.05, 6500, 0.6, i % 4 === 0 ? 0.2 : 0.1, "highpass"); },
    beat(o, t, d) {   // the party loop for a while (his DJ set, the robot): his own, so a real party isn't cut off by it
      if (timer && !beatOwned) return;
      if (!timer) start();
      beatOwned = true; clearTimeout(beatTimer);
      beatTimer = setTimeout(endBeat, d * 1000);
    },
    party(o, t, d) { SFX.pop(o, t); SFX.beat(o, t, d); },
    chime(o, t, d) { [84, 88, 91, 96].forEach((n, i) => T(o, t + i * 0.22, n, 1.6, "sine", 0.1, 8000)); if (d > 3) [91, 88, 84].forEach((n, i) => T(o, t + 2 + i * 0.3, n, 1.6, "sine", 0.08, 8000)); },
    splash(o, t, d) { for (let x = 0; x < Math.min(d, 6) - 0.2; x += 1.1) { N(o, t + x, 0.45, 900, 0.8, 0.25, "lowpass", 300); N(o, t + x + 0.05, 0.25, 3000, 1, 0.08, "bandpass", 1200); } },
    boing(o, t, d) { for (let x = 0; x < d - 0.3; x += 0.7) sweep(o, t + x, 180, 620, 0.35, "sine", 0.25); },
    whoosh(o, t) { N(o, t, 0.7, 400, 1.2, 0.3, "bandpass", 2600); },
    cheer(o, t) { N(o, t, 1.4, 1100, 0.5, 0.18, "bandpass", 1600); [72, 76, 79, 84].forEach((n, i) => T(o, t + 0.1 + i * 0.1, n, 0.3, "square", 0.04, 2400)); },
    swish(o, t) { N(o, t, 0.28, 2500, 0.8, 0.25, "highpass", 6000); },
    pock(o, t, d) { for (let x = 0; x < d - 0.2; x += 0.95) T(o, t + x, 81, 0.07, "sine", 0.35, 6000, 0.002); },
    strike(o, t) { for (let i = 0; i < 9; i++) N(o, t + i * 0.035 + Math.random() * 0.03, 0.12, 900 + Math.random() * 1800, 3, 0.3); sweep(o, t, 120, 50, 0.3, "sine", 0.4); },
    bleeps(o, t, d) { for (let x = 0; x < d - 0.1; x += 0.12) if (Math.random() < 0.7) T(o, t + x, 72 + Math.floor(Math.random() * 16), 0.09, "square", 0.05, 5000, 0.002); },
    click(o, t) { N(o, t, 0.02, 4000, 1, 0.4, "highpass"); N(o, t + 0.07, 0.04, 2500, 1, 0.3, "highpass"); },
    knock(o, t, d) { for (let x = 0; x < d - 0.2; x += 0.42) { sweep(o, t + x, 320, 160, 0.09, "sine", 0.35); N(o, t + x, 0.05, 900, 2, 0.15); } },
    sizzle(o, t, d) { for (let x = 0; x < d; x += 0.06) N(o, t + x, 0.08, 5500 + Math.random() * 2500, 0.7, 0.03 + Math.random() * 0.03, "highpass"); },
    ding(o, t) { T(o, t, 93, 1.4, "sine", 0.2, 9000, 0.002); T(o, t, 100, 0.9, "sine", 0.06, 9000, 0.002); },
    munch(o, t, d) { for (let x = 0; x < d - 0.2; x += 0.34) { N(o, t + x, 0.07, 1600, 1.2, 0.2); N(o, t + x + 0.09, 0.06, 1300, 1.2, 0.14); } },
    hmm(o, t) { const v = T(o, t, 55, 0.7, "triangle", 0.15, 900, 0.05); v.frequency.exponentialRampToValueAtTime(hz(52), t + 0.6); },
    coins(o, t) { for (let i = 0; i < 4; i++) { T(o, t + i * 0.16, 88, 0.08, "square", 0.05, 6000, 0.002); T(o, t + i * 0.16 + 0.07, 93, 0.3, "square", 0.05, 6000, 0.002); } },
    crackle(o, t, d) { for (let x = 0; x < d; x += 0.05) if (Math.random() < 0.45) N(o, t + x, 0.015, 2000 + Math.random() * 4000, 2, 0.05 + Math.random() * 0.12); },
    heartbeat(o, t, d) { for (let x = 0; x < d - 0.4; x += 0.85) { sweep(o, t + x, 70, 45, 0.14, "sine", 0.55); sweep(o, t + x + 0.2, 64, 42, 0.12, "sine", 0.4); } },
    rimshot(o, t) { sweep(o, t, 200, 150, 0.15, "sine", 0.45); sweep(o, t + 0.2, 150, 100, 0.18, "sine", 0.45); N(o, t + 0.42, 0.7, 7000, 0.6, 0.18, "highpass"); },
    brush(o, t, d) { for (let x = 0, i = 0; x < d - 0.1; x += 0.16, i++) N(o, t + x, 0.12, i % 2 ? 2600 : 3400, 1.5, 0.09); },
    pop(o, t) { N(o, t, 0.08, 1500, 0.8, 0.5); sweep(o, t, 700, 120, 0.15, "sine", 0.3); },
  };
  document.addEventListener("mochi:sound", (e) => {
    const d = e.detail || {}, fn = SFX[d.kind];
    if (!fn || muted() || !setup()) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    try { fn(sfxOut(), ctx.currentTime + 0.03, Math.min(14, Math.max(0.5, (d.ms || 2000) / 1000))); } catch (_) { /* a sound is never worth an error */ }
  });
  document.addEventListener("mochi:activity", (e) => {   // stopped part-way (a new activity, a tap): his sounds fade out too
    const d = e.detail || {};
    if (!d.interrupted || !ctx) return;
    for (const g of live) { try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3); } catch (_) { /* fine */ } }
    live = [];
    if (beatOwned) endBeat();
  });
  window.MOCHI_SOUNDS = { kinds: () => Object.keys(SFX) };
})();
