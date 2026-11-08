/* Zero Day, the hacker edition (Binoy, Nov 2: "animated glitches (streaks etc) happening here and there randomly" and
 * "lots of computers in the work bench loading codes like the matrix movie").
 *   Glitch   every few seconds the stage tears: horizontal bands slide sideways, the colours split into ghosts, a few
 *            blocks jump, bright streaks shoot across, static. A post pass that only runs during a burst (the rest of
 *            the time the scene draws straight to the screen, so it costs nothing).
 *   Rig      his battlestation, on the stage to his left: a desk piled with mismatched monitors (a wide one, an old
 *            CRT with a small screen on top, a tall one turned on its side, a laptop), a glowing keyboard, a tower with
 *            blinking lights, cables. Every screen runs code like the Matrix: falling glyphs, scrolling code, a hex
 *            dump, a wireframe globe tracing a route, meters. When he's making a prop on his workbench, the big screen
 *            writes it (props ARE code: shapes, sizes, colours) with a compiling bar, and says BUILD OK when it's done.
 *   Hood     a black hoodie: the hood up round his face (his ears poke out), neon piping, drawstrings, dark sleeves.
 * Everything here is built once, the first time Zero Day goes on, and hidden when it goes off. */
import * as THREE from "three";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
export const HX = { green: "#39ff7a", bright: "#d6ffe4", dim: "#0f7a3a", cyan: "#2fd8ff", amber: "#ffcf5c", magenta: "#ff2bd6", bg: "#010604" };
const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789ABCDEF<>{}[]=+*";
const pick = (s, r) => s[Math.floor(r() * s.length)];

/* ------------------------------------------------------------------ glitch */
const GLITCH_FS = /* glsl */ `
  uniform sampler2D tDiffuse; uniform float seed; uniform float amount; uniform float time; uniform vec2 res;
  varying vec2 vUv;
  float rnd(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233)) + seed * 43.17) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // tear bands: the picture is cut into bands of different heights; some slide sideways
    float rows = mix(6.0, 22.0, rnd(vec2(3.1, 7.7)));
    float band = floor(uv.y * rows);
    float r1 = rnd(vec2(band, 2.0));
    float shift = r1 > 1.0 - 0.38 * amount ? (rnd(vec2(band, 3.0)) - 0.5) * 0.16 * amount : 0.0;
    // hairline tears
    float hair = step(0.982, rnd(vec2(floor(uv.y * res.y / 2.0), floor(time * 40.0))));
    shift += hair * (rnd(vec2(uv.y, time)) - 0.5) * 0.05 * amount;
    uv.x += shift;
    // a few blocks show a piece of somewhere else
    vec2 blk = floor(vUv * vec2(18.0, 10.0));
    if (rnd(blk + 7.0) > 1.0 - 0.05 * amount) uv += (vec2(rnd(blk + 1.0), rnd(blk + 2.0)) - 0.5) * 0.1;
    // colour split: red one way, blue the other
    float split = (0.004 + 0.016 * amount * (0.4 + r1)) * (rnd(vec2(band, 9.0)) > 0.5 ? 1.0 : -1.0);
    vec4 cr = texture2D(tDiffuse, uv + vec2(split, 0.002 * amount));
    vec4 cg = texture2D(tDiffuse, uv);
    vec4 cb = texture2D(tDiffuse, uv - vec2(split, 0.0));
    vec4 col = vec4(cr.r, cg.g, cb.b, max(max(cr.a, cg.a), cb.a));
    // a band now and then flips to neon green
    if (shift != 0.0 && r1 > 0.965) col.rgb = col.a * vec3(0.14, 1.0, 0.42) - col.rgb * 0.35;
    // streaks: bright lines shooting across, cyan or green or magenta
    float sRow = floor(vUv.y * res.y / 3.0), sOn = step(1.0 - 0.012 * amount, rnd(vec2(sRow, floor(time * 24.0))));
    float sFade = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.55, vUv.x + rnd(vec2(sRow, 4.0)) * 0.5);
    vec3 sCol = rnd(vec2(sRow, 5.0)) > 0.66 ? vec3(1.0, 0.17, 0.84) : rnd(vec2(sRow, 6.0)) > 0.5 ? vec3(0.18, 0.85, 1.0) : vec3(0.22, 1.0, 0.48);
    float s = sOn * sFade * (0.55 + 0.45 * rnd(vec2(sRow, 8.0)));
    col.rgb += sCol * s; col.a = max(col.a, s * 0.85);
    // scanlines and static where there's something
    col.rgb *= 0.9 + 0.1 * sin(vUv.y * res.y * 1.7);
    col.rgb += (rnd(vUv * res + time) - 0.5) * 0.18 * amount * col.a;
    gl_FragColor = col;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Glitch {
  constructor(renderer, r) {
    this.R = renderer; this.r = r; this.rt = null; this.burst = null; this.nextAt = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, amount: { value: 0 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: GLITCH_FS, blending: THREE.NoBlending, depthTest: false, depthWrite: false, transparent: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.size = new THREE.Vector2();
  }
  /** a burst now: ms long, strength 0..1 */
  hit(ms = 180, strength = 1) { const now = performance.now(); this.burst = { t0: now, until: now + ms, k: strength }; return this.burst; }
  /** random bursts while on; returns true when this frame should be drawn glitched */
  tick(now, on, calm) {
    if (!on || calm) { this.burst = null; this.nextAt = now + 2500; return false; }
    if (!this.burst && now > this.nextAt) {
      const r = this.r, big = r() < 0.22;
      this.hit(big ? 220 + r() * 160 : 70 + r() * 120, big ? 1 : 0.45 + r() * 0.4);
      this.nextAt = now + (r() < 0.25 ? 260 + r() * 300 : 3800 + r() * 6200);   // sometimes a second one right after
      if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:glitch", { detail: { ms: this.burst.until - now, k: this.burst.k } }));
    }
    if (this.burst && now > this.burst.until) this.burst = null;
    return !!this.burst;
  }
  render(scene, camera, now) {
    const R = this.R, B = this.burst;
    R.getDrawingBufferSize(this.size);
    const w = Math.max(2, Math.round(this.size.x * 0.75)), h = Math.max(2, Math.round(this.size.y * 0.75));
    if (!this.rt || this.rt.width !== w || this.rt.height !== h) { if (this.rt) this.rt.dispose(); this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }); }
    R.setRenderTarget(this.rt); R.clear(); R.render(scene, camera); R.setRenderTarget(null);
    const u = this.mat.uniforms, f = (now - B.t0) / Math.max(1, B.until - B.t0);
    u.tDiffuse.value = this.rt.texture; u.time.value = now / 1000; u.res.value.set(w, h);
    if (!this.seedAt || now - this.seedAt > 45) { this.seedAt = now; u.seed.value = this.r() * 100; }
    u.amount.value = B.k * (0.55 + 0.45 * Math.sin(Math.PI * clamp(f, 0, 1))) * (0.7 + 0.3 * this.r());
    R.render(this.qs, this.qc);
  }
  dispose() { if (this.rt) this.rt.dispose(); this.mat.dispose(); this.quad.geometry.dispose(); }
}

/* ------------------------------------------------------------------ screens */
// What the screens say: bits of a hacker movie and bits of him (props are code, he's a sheep, he naps a lot).
const CODE = [
  "$ ssh mochi@fluffy-mainframe", "Password: ********", "[ OK ] baa.service started", "$ sudo apt install more-cuddles",
  "const prop = await craft(\"umbrella\");", "for (const part of recipe.parts)", "  build(part, { glow: true });", "if (pat.isHead()) mochi.happy++;",
  "$ ping cocoa", "64 bytes: 1 hoof bump  t=12ms", "$ whoami", "mochi (root)", "while (awake) { nap(); }", "// TODO: more fluff",
  "$ git commit -m \"extra fluffy\"", "$ hack --the-planet", "decrypting... ▓▓▓▓▓▓▓▓ 100%", "ACCESS GRANTED", "$ nmap cuteness.local",
  "PORT 443/tcp  open  hugs", "PORT 8080/tcp open  snacks", "$ cat ~/.secret_handshake", "tap, tap, swipe, boop", "0xBAA 0xBAA 0xBAA",
  "> injecting confetti.dll", "[ OK ] firewall: too cute", "$ ./zero_day --gentle", "mochi.mood = \"cool\";", "export default sheep;",
  "$ top -o fluff", "  PID  CMD      FLUFF", "  42   mochi    99.9%", "$ tail -f /var/log/snacks", "grass... grass... grass...",
  "const twirl = sampleMove(t);", "renderer.render(scene, cam);", "$ sudo pat --gentle", "[+] payload: hugs.bin", "Connection established.",
];
const KEYWORDS = /\b(const|let|await|for|of|if|while|export|default|return|new|sudo|ssh|git|cat|ping|top|tail)\b/g;

class Screen {
  constructor(w, h, mode, r) {
    this.w = w; this.h = h; this.mode = mode; this.r = r; this.c = document.createElement("canvas"); this.c.width = w; this.c.height = h;
    this.g = this.c.getContext("2d"); this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.at = 0; this.every = 70 + r() * 40; this.lines = []; this.cur = ""; this.idx = Math.floor(r() * CODE.length); this.typed = 0; this.drops = null; this.hexAt = 0;
    this.fill();
  }
  fill() { const g = this.g; g.fillStyle = HX.bg; g.fillRect(0, 0, this.w, this.h); }
  overlay() {   // CRT: scanlines and a dark edge, and a glow on the text
    const g = this.g;
    if (!this.scan) {
      const s = document.createElement("canvas"); s.width = this.w; s.height = this.h; const q = s.getContext("2d");
      q.fillStyle = "rgba(0,0,0,0.28)"; for (let y = 0; y < this.h; y += 3) q.fillRect(0, y, this.w, 1);
      const v = q.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)"); q.fillStyle = v; q.fillRect(0, 0, this.w, this.h);
      this.scan = s;
    }
    g.drawImage(this.scan, 0, 0);
  }
  draw(now, job) {
    if (now - this.at < this.every) return false;
    const dt = now - (this.at || now); this.at = now;
    const mode = job && this.main ? "build" : this.flash && now < this.flash ? "static" : this.mode;
    if (mode !== this.last) { this.fill(); this.last = mode; this.drops = null; }
    this.g.shadowColor = "rgba(57,255,122,0.85)"; this.g.shadowBlur = 5;
    this[mode](now, dt, job);
    this.g.shadowBlur = 0;
    this.overlay();
    this.tex.needsUpdate = true;
    return true;
  }
  rain() {   // the Matrix: columns of glyphs falling, each led by a bright one
    const g = this.g, fs = 14, cols = Math.ceil(this.w / fs), r = this.r;
    if (!this.drops) this.drops = Array.from({ length: cols }, () => -Math.floor(r() * 20));
    g.fillStyle = "rgba(1,6,4,0.2)"; g.fillRect(0, 0, this.w, this.h);
    g.font = `${fs}px ui-monospace, Consolas, monospace`; g.textBaseline = "top";
    for (let i = 0; i < cols; i++) {
      const y = this.drops[i] * fs;
      if (y >= 0) { g.fillStyle = HX.green; g.fillText(pick(GLYPHS, r), i * fs, y - fs); g.fillStyle = HX.bright; g.fillText(pick(GLYPHS, r), i * fs, y); }
      this.drops[i]++;
      if (y > this.h && r() > 0.93) this.drops[i] = -Math.floor(r() * 8);
    }
  }
  code(now) {   // a terminal: lines typed out one character at a time, scrolling up
    const g = this.g, fs = 14, lh = 17, maxL = Math.floor((this.h - 6) / lh);
    if (this.typed >= CODE[this.idx].length) { this.lines.push(CODE[this.idx]); if (this.lines.length > maxL - 1) this.lines.shift(); this.idx = (this.idx + 1 + Math.floor(this.r() * 3)) % CODE.length; this.typed = 0; }
    this.typed = Math.min(CODE[this.idx].length, this.typed + 2 + Math.floor(this.r() * 4));
    g.fillStyle = HX.bg; g.fillRect(0, 0, this.w, this.h);
    g.font = `${fs}px ui-monospace, Consolas, monospace`; g.textBaseline = "top";
    const all = [...this.lines, CODE[this.idx].slice(0, this.typed)];
    all.forEach((ln, i) => this.codeLine(ln, 5, 4 + i * lh));
    if (Math.floor(now / 380) % 2) { const last = all.at(-1), x = 5 + g.measureText(last).width; g.fillStyle = HX.green; g.fillRect(x + 1, 4 + (all.length - 1) * lh, 6, fs); }
  }
  codeLine(ln, x, y) {   // a little syntax colouring
    const g = this.g;
    const col = /^\$/.test(ln) ? HX.cyan : /ACCESS GRANTED|\[ OK \]|\[\+\]|established/.test(ln) ? HX.bright : /^\/\/|^#/.test(ln) ? HX.dim : /0x|\d+%|PORT/.test(ln) ? HX.amber : HX.green;
    g.fillStyle = col;
    if (col !== HX.green) { g.fillText(ln, x, y); return; }
    let cx = x, last = 0; KEYWORDS.lastIndex = 0; let m;
    while ((m = KEYWORDS.exec(ln))) { g.fillStyle = HX.green; g.fillText(ln.slice(last, m.index), cx, y); cx += g.measureText(ln.slice(last, m.index)).width; g.fillStyle = HX.cyan; g.fillText(m[0], cx, y); cx += g.measureText(m[0]).width; last = m.index + m[0].length; }
    g.fillStyle = HX.green; g.fillText(ln.slice(last), cx, y);
  }
  hex(now) {   // a hex dump scrolling by, with the text on the right ("MOCHI BAA")
    const g = this.g, fs = 10, lh = 12, r = this.r, words = ["MOCHI", "BAA..", "FLUFF", "HUGS!", "COCOA", "MIMI<3", "0DAY.", "SNACK"];
    g.drawImage(this.c, 0, -lh);
    g.fillStyle = HX.bg; g.fillRect(0, this.h - lh - 2, this.w, lh + 2);
    g.font = `${fs}px ui-monospace, Consolas, monospace`; g.textBaseline = "top";
    this.addr = (this.addr || 0x1f00) + 8;
    const bytes = Array.from({ length: 6 }, () => Math.floor(r() * 256).toString(16).padStart(2, "0").toUpperCase()).join(" ");
    g.fillStyle = HX.dim; g.fillText(this.addr.toString(16).padStart(4, "0").toUpperCase(), 4, this.h - lh);
    g.fillStyle = HX.green; g.fillText(bytes, 36, this.h - lh);
    g.fillStyle = HX.amber; g.fillText(words[Math.floor(r() * words.length)], this.w - 38, this.h - lh);
  }
  globe(now) {   // a wireframe globe turning, a route being traced between blinking nodes
    const g = this.g, cx = this.w * 0.5, cy = this.h * 0.46, R = Math.min(this.w, this.h) * 0.36, t = now / 1000;
    g.fillStyle = HX.bg; g.fillRect(0, 0, this.w, this.h);
    g.strokeStyle = "rgba(57,255,122,0.55)"; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 6; k++) { const a = ((k / 6) * Math.PI + t * 0.6) % Math.PI, rx = Math.abs(Math.cos(a)) * R; g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx), R, 0, 0, Math.PI * 2); g.stroke(); }
    for (let k = 1; k < 4; k++) { const y = (k / 4) * 2 - 1; g.beginPath(); g.ellipse(cx, cy + y * R * 0.9, R * Math.sqrt(1 - y * y * 0.81), R * 0.12, 0, 0, Math.PI * 2); g.stroke(); }
    const nodes = this.nodes || (this.nodes = Array.from({ length: 6 }, () => ({ a: this.r() * Math.PI * 2, b: (this.r() - 0.5) * 2.2 })));
    const P = nodes.map((n) => { const x = Math.cos(n.b * 0.7) * Math.sin(n.a + t * 0.6); return { x: cx + x * R, y: cy + Math.sin(n.b * 0.7) * R * 0.9, front: Math.cos(n.a + t * 0.6) > 0 }; });
    const hop = Math.floor(t * 1.5) % (P.length - 1);
    g.strokeStyle = HX.amber; g.lineWidth = 1.5; g.beginPath(); g.moveTo(P[0].x, P[0].y); for (let i = 1; i <= hop + 1; i++) g.lineTo(P[i].x, P[i].y); g.stroke();
    for (const p of P) { g.fillStyle = p.front ? HX.bright : HX.dim; g.fillRect(p.x - 2, p.y - 2, 4, 4); }
    g.font = "10px ui-monospace, Consolas, monospace"; g.textBaseline = "top"; g.fillStyle = HX.green;
    g.fillText(`TRACE fluffy-mainframe  hop ${hop + 1}/${P.length - 1}`, 5, this.h - 14);
  }
  meters(now) {   // meters and a wave
    const g = this.g, t = now / 1000, labels = ["CPU", "FLUFF", "CUTE", "BAA/s", "SNACK"];
    g.fillStyle = HX.bg; g.fillRect(0, 0, this.w, this.h);
    g.font = "10px ui-monospace, Consolas, monospace"; g.textBaseline = "top";
    const rows = Math.min(labels.length, Math.floor((this.h - 40) / 14));
    for (let i = 0; i < rows; i++) {
      const v = labels[i] === "CUTE" ? 1 : clamp(0.5 + 0.45 * Math.sin(t * (0.7 + i * 0.4) + i * 2) + (this.r() - 0.5) * 0.1, 0.05, 1);
      g.fillStyle = HX.dim; g.fillText(labels[i], 4, 6 + i * 14);
      g.fillStyle = v > 0.92 ? HX.amber : HX.green; g.fillRect(44, 7 + i * 14, (this.w - 80) * v, 8);
      g.fillStyle = HX.green; g.fillText(labels[i] === "CUTE" ? "MAX" : `${Math.round(v * 100)}%`, this.w - 32, 6 + i * 14);
    }
    g.strokeStyle = HX.cyan; g.lineWidth = 1.2; g.beginPath();
    for (let x = 0; x < this.w; x += 3) { const y = this.h - 18 + Math.sin(x / 9 + t * 6) * 7 * Math.sin(t * 1.3 + x / 50); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  static() {   // a glitch: noise
    const g = this.g, r = this.r;
    for (let i = 0; i < 40; i++) { g.fillStyle = r() > 0.5 ? HX.green : r() > 0.5 ? HX.magenta : "#ffffff"; g.globalAlpha = 0.25 + r() * 0.5; g.fillRect(r() * this.w, r() * this.h, 2 + r() * 40, 1 + r() * 3); }
    g.globalAlpha = 1;
  }
  build(now, dt, job) {   // making a prop: its code, written out, and a compiling bar; BUILD OK when it's done
    const g = this.g, fs = 13, lh = 16, name = String(job.name || "prop").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "prop";
    if (this.jobId !== job.id) {
      this.jobId = job.id; this.btyped = 0; this.jobAt = now; this.fake = fakeParts(job.name, this.r);
      this.blines = job.done && job.lines ? [`$ cat ${name}.prop`, ...job.lines] : [`$ craft "${job.name}"`, "[gemma] planning the parts..."];
    }
    const src = job.lines || this.fake;
    if (!job.done && this.r() < 0.5) {
      const next = src[this.blines.length % src.length];
      if (this.btyped >= next.length) { this.blines.push(next); this.btyped = 0; if (this.blines.length > 8) this.blines.splice(2, 1); }
      else this.btyped = Math.min(next.length, this.btyped + 5 + Math.floor(this.r() * 6));
    }
    g.fillStyle = HX.bg; g.fillRect(0, 0, this.w, this.h);
    g.font = `${fs}px ui-monospace, Consolas, monospace`; g.textBaseline = "top";
    const show = [...this.blines]; if (!job.done) { const nx = src[this.blines.length % src.length]; show.push(nx.slice(0, this.btyped)); }
    const maxL = Math.floor((this.h - 38) / lh);
    // the finished recipe scrolls by, slowly; while it's being written, the newest lines
    const view = job.done && job.lines ? show.slice(Math.floor((now - this.jobAt) / 450) % Math.max(1, show.length - maxL + 1)).slice(0, maxL) : show.slice(-maxL);
    view.forEach((ln, i) => this.codeLine(ln, 5, 4 + i * lh));
    // the bar
    const el = (now - job.t0) / 1000, p = job.done ? 1 : clamp(el / Math.max(6, job.expect || 16), 0, 0.95), y = this.h - 32;
    g.strokeStyle = HX.green; g.strokeRect(5, y, this.w - 10, 13);
    g.fillStyle = job.done ? HX.bright : HX.green; g.fillRect(7, y + 2, (this.w - 14) * p, 9);
    g.fillStyle = job.done ? HX.bright : HX.green; g.font = `bold 13px ui-monospace, Consolas, monospace`;
    g.fillText(job.done ? `BUILD OK ${name}.prop ${((job.ms || el * 1000) / 1000).toFixed(1)}s` : `compiling ${name}.prop ${Math.round(p * 100)}%`, 5, this.h - 15);
  }
}
// what the code of a prop looks like while it's being written (the real recipe takes its place when it's done)
function fakeParts(name, r) {
  const shapes = ["dome", "cylinder", "box", "sphere", "cone", "torus", "capsule", "coin", "star"], cols = ["#39ff7a", "#2fd8ff", "#ffcf5c", "#ff8fb8", "#ffffff", "#7be08a"];
  const words = String(name || "prop").toLowerCase().split(/\s+/).filter(Boolean);
  return Array.from({ length: 10 }, (_, i) => `{ "shape": "${shapes[Math.floor(r() * shapes.length)]}", "label": "${words[i % words.length]}${i ? ` ${i}` : ""}", "size": [${(0.1 + r() * 0.8).toFixed(2)}, ${(0.1 + r() * 0.8).toFixed(2)}], "color": "${cols[Math.floor(r() * cols.length)]}" }`);
}
/** the real recipe as screen lines: one part per line */
export function recipeLines(recipe) {
  if (!recipe || !Array.isArray(recipe.parts)) return null;
  return recipe.parts.slice(0, 24).map((p) => `{ "shape": "${p.shape}", "label": "${p.label || p.shape}", "size": [${(p.size || []).map((v) => +(+v).toFixed(2)).join(", ")}], "color": "${p.color || "#ffffff"}" }`);
}

/* ------------------------------------------------------------------ the battlestation */
export class Rig {
  constructor(m) {
    this.m = m; const r = m.r;
    const G = this.group = new THREE.Group(); G.name = "rig";
    G.position.set(-2.2, 0, -0.7); G.rotation.y = 0.48; G.scale.setScalar(1.4); this.size = 1.4;
    (m.furniture || m.scene).add(G); G.visible = false;
    const metal = new THREE.MeshStandardMaterial({ color: 0x161b1f, roughness: 0.45, metalness: 0.65 });
    const plastic = new THREE.MeshStandardMaterial({ color: 0x1c2224, roughness: 0.6, metalness: 0.15 });
    const beige = new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 0.7 });   // the old CRT, gone grey in the dark
    const glowG = new THREE.MeshBasicMaterial({ color: 0x39ff7a }), glowC = new THREE.MeshBasicMaterial({ color: 0x2fd8ff });
    this.mats = [metal, plastic, beige];
    const box = (w, h, d, mat, x, y, z, parent = G) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; parent.add(b); return b; };
    // the desk
    box(1.76, 0.06, 0.66, metal, 0, 0.72, 0);
    for (const [x, z] of [[-0.82, -0.27], [0.82, -0.27], [-0.82, 0.27], [0.82, 0.27]]) box(0.05, 0.72, 0.05, metal, x, 0.36, z);
    box(1.66, 0.04, 0.04, glowG, 0, 0.695, 0.33);   // a neon strip along the front edge
    // the screens: [w, h, canvas w, canvas h, mode, where, bezel]
    this.screens = [];
    const monitor = (sw, sh, cw, ch, mode, pos, rotY, bezelMat, depth = 0.05, main = false) => {
      const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = rotY; G.add(g);
      box(sw + 0.06, sh + 0.06, depth, bezelMat, 0, 0, -depth / 2 - 0.002, g);
      const S = new Screen(cw, ch, mode, r); S.main = main;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: S.tex, toneMapped: false }));
      scr.position.z = 0.001; g.add(scr);
      this.screens.push(S); return g;
    };
    // the big one in the middle, on a stand
    const big = monitor(0.78, 0.44, 288, 162, "code", [0, 1.12, -0.12], 0, plastic, 0.05, true);
    box(0.06, 0.3, 0.05, plastic, 0, -0.33, -0.06, big); box(0.3, 0.02, 0.18, plastic, 0, -0.47, -0.02, big);
    // an old CRT on the left, a small screen on top of it
    const crt = monitor(0.34, 0.27, 192, 152, "rain", [-0.62, 0.93, -0.06], 0.32, beige, 0.06);
    box(0.44, 0.38, 0.36, beige, 0, 0, -0.22, crt);
    monitor(0.3, 0.19, 176, 112, "meters", [-0.62, 1.25, -0.14], 0.28, plastic);
    monitor(0.34, 0.21, 176, 108, "code", [-0.26, 1.56, -0.24], 0.12, plastic);   // up high, next to the globe
    const tab = monitor(0.2, 0.28, 96, 136, "meters", [-0.47, 0.89, 0.1], 0.3, plastic, 0.02); tab.rotation.x = -0.35;   // a tablet propped on the desk
    // a tall one on the right, turned on its side
    const tall = monitor(0.26, 0.44, 112, 192, "hex", [0.6, 1.08, -0.1], -0.38, plastic);
    box(0.05, 0.22, 0.05, plastic, 0, -0.33, -0.05, tall);
    // one up high on an arm, and a laptop on the desk
    monitor(0.36, 0.22, 192, 118, "globe", [0.22, 1.56, -0.2], -0.12, plastic);
    box(0.03, 0.5, 0.03, metal, 0.5, 1.25, -0.28); box(0.86, 0.03, 0.03, metal, 0.0, 1.43, -0.32);   // the arm they hang from
    const lap = new THREE.Group(); lap.position.set(0.5, 0.755, 0.14); lap.rotation.y = -0.5; G.add(lap);
    box(0.36, 0.018, 0.25, metal, 0, 0, 0, lap);
    const lid = new THREE.Group(); lid.position.set(0, 0.01, -0.12); lid.rotation.x = -0.32; lap.add(lid);
    box(0.36, 0.24, 0.012, metal, 0, 0.12, -0.007, lid);
    const ls = new Screen(160, 104, "rain", r); this.screens.push(ls);
    const lsm = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), new THREE.MeshBasicMaterial({ map: ls.tex, toneMapped: false })); lsm.position.set(0, 0.12, 0.0); lid.add(lsm);
    // keyboard (glowing keys), mouse, a mug
    const kb = box(0.52, 0.022, 0.17, plastic, 0.0, 0.762, 0.19); kb.rotation.y = 0.05;
    const keys = document.createElement("canvas"); keys.width = 256; keys.height = 84; const kg = keys.getContext("2d");
    kg.fillStyle = "#06120b"; kg.fillRect(0, 0, 256, 84);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 14; x++) { kg.fillStyle = r() < 0.12 ? "#2fd8ff" : "#1f9c52"; kg.fillRect(4 + x * 18 + (y % 2) * 4, 4 + y * 20, 14, 15); }
    const kt = new THREE.CanvasTexture(keys); kt.colorSpace = THREE.SRGBColorSpace;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.15), new THREE.MeshBasicMaterial({ map: kt, toneMapped: false })); top.rotation.x = -Math.PI / 2; top.position.y = 0.0115; kb.add(top);
    box(0.06, 0.02, 0.09, plastic, 0.3, 0.76, 0.2);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 18), new THREE.MeshStandardMaterial({ color: 0x0c0f0e, roughness: 0.4 })); mug.position.set(-0.55, 0.805, 0.18); G.add(mug);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16), glowG); ring.position.set(-0.6, 0.81, 0.18); ring.rotation.y = Math.PI / 2; G.add(ring);
    // the tower under the desk, lights blinking
    box(0.26, 0.5, 0.5, metal, 0.55, 0.25, -0.02);
    box(0.02, 0.4, 0.012, glowC, 0.43, 0.27, 0.235);
    this.leds = [0, 1, 2, 3, 4].map((i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x39ff7a : 0xffcf5c })); l.position.set(0.6 + (i % 2) * 0.04, 0.42 - Math.floor(i / 2) * 0.04, 0.235); G.add(l); return l; });
    // cables hanging down behind
    const cable = new THREE.MeshStandardMaterial({ color: 0x0a0c0d, roughness: 0.8 });
    for (const [a, b] of [[[-0.62, 0.8, -0.3], [-0.3, 0.02, -0.4]], [[0, 0.85, -0.2], [0.2, 0.02, -0.45]], [[0.6, 0.85, -0.2], [0.55, 0.5, -0.3]], [[0.22, 1.4, -0.3], [0.4, 0.02, -0.45]]]) {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), mid = A.clone().lerp(B, 0.5); mid.z -= 0.15; mid.y -= 0.12;
      const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([A, mid, B]), 20, 0.012, 6, false), cable); G.add(t);
    }
    // a green glow on the floor under it all
    const c = document.createElement("canvas"); c.width = c.height = 128; const q = c.getContext("2d"), gr = q.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(57,255,122,0.55)"); gr.addColorStop(0.5, "rgba(47,216,255,0.18)"); gr.addColorStop(1, "rgba(0,0,0,0)"); q.fillStyle = gr; q.fillRect(0, 0, 128, 128);
    const ft = new THREE.CanvasTexture(c); ft.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ map: ft, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.006, 0.1); G.add(floor);
    this.k = 0; this.job = null; this.slot = 0;
  }
  /** what's on the workbench: { id, name, t0, expect } while it's being made; { …, done: true, ms, lines } when it's ready; null */
  setJob(job) {
    if (job && job.recipe && !job.lines) job = { ...job, lines: recipeLines(job.recipe) };
    this.job = job; if (job && job.done) this.doneAt = performance.now();
  }
  flash(ms = 160) { const until = performance.now() + ms; for (const S of this.screens) if (!S.main || !this.job) S.flash = until; }
  step(now, k) {
    const G = this.group;
    this.k = k;
    G.visible = k > 0.02;
    if (!G.visible) return;
    const s = this.size * (0.6 + 0.4 * ease(k)); G.scale.setScalar(s); G.position.y = -0.4 * (1 - ease(k));
    if (this.job && this.job.done && now - (this.doneAt || 0) > 6000) this.job = null;   // BUILD OK stays up a few seconds
    // two screens a frame, in turn (each one still updates ~12 times a second)
    for (let i = 0; i < 2; i++) { const S = this.screens[this.slot++ % this.screens.length]; S.draw(now, this.job); }
    const main = this.screens.find((S) => S.main); if (this.job && main) main.draw(now, this.job);
    this.leds.forEach((l, i) => { l.visible = Math.sin(now / (90 + i * 37) + i * 2) > -0.2; });
  }
}

/* ------------------------------------------------------------------ the hoodie */
export class Hood {
  constructor(m) {
    this.m = m;
    const fabric = this.fabric = new THREE.MeshPhysicalMaterial({ color: 0x0b0f0d, roughness: 0.94, sheen: 0.55, sheenRoughness: 0.6, sheenColor: 0x1d5a39, side: THREE.DoubleSide });
    fabric.userData.rim = true;   // matte cloth: no neon edge glow (it made the hood look like a glass helmet)
    const G = this.group = new THREE.Group(); G.name = "hood"; m.head.add(G); G.visible = false;
    // a shell round his head, open at the face and underneath (his ears poke out of the sides)
    const sph = new THREE.SphereGeometry(1, 48, 32), pos = sph.attributes.position, idx = sph.index.array, keep = [];
    const inWindow = (x, y, z) => z > 0.12 && (x / 0.66) ** 2 + ((y + 0.06) / 0.62) ** 2 < 1;
    for (let i = 0; i < idx.length; i += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cx += pos.getX(idx[i + k]); cy += pos.getY(idx[i + k]); cz += pos.getZ(idx[i + k]); }
      cx /= 3; cy /= 3; cz /= 3;
      if (inWindow(cx, cy, cz) || cy < -0.78) continue;
      keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    sph.setIndex(keep);
    // cloth, not a ball: soft folds round it, a little peak at the back of the top, a slightly fuller back
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(x, z);
      const k = 1 + 0.022 * Math.sin(a * 7 + y * 4) * (1 - Math.abs(y)) + 0.1 * Math.max(0, y - 0.2) * Math.max(0, -z) + 0.04 * Math.max(0, -z);
      pos.setXYZ(i, x * k, y * k, z * k);
    }
    sph.computeVertexNormals();
    const shell = new THREE.Mesh(sph, fabric); shell.scale.set(0.7, 0.69, 0.66); shell.position.set(0, 0.03, -0.04); shell.castShadow = true; G.add(shell);
    // neon piping round the opening, and the drawstrings
    const glow = new THREE.MeshBasicMaterial({ color: 0x39ff7a });
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 64), glow); pipe.scale.set(0.47, 0.43, 0.9); pipe.position.set(0, -0.02, 0.46); pipe.rotation.x = -0.12; G.add(pipe);
    this.strings = [-1, 1].map((s) => {
      const g = new THREE.Group(); g.position.set(s * 0.17, -0.42, 0.52); G.add(g);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 6), new THREE.MeshStandardMaterial({ color: 0xd6ffe4, roughness: 0.6 })); c.position.y = -0.13; g.add(c);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.05, 8), glow); tip.position.y = -0.28; g.add(tip);
      return g;
    });
    // a front pocket on his tummy
    const pk = new THREE.SphereGeometry(1, 32, 20), pp = pk.attributes.position, pi = pk.index.array, pkeep = [];
    for (let i = 0; i < pi.length; i += 3) {
      let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += pp.getX(pi[i + k]); cy += pp.getY(pi[i + k]); cz += pp.getZ(pi[i + k]); }
      cx /= 3; cy /= 3; cz /= 3;
      if (cz > 0.55 && Math.abs(cx) < 0.42 && cy > -0.55 && cy < -0.12) pkeep.push(pi[i], pi[i + 1], pi[i + 2]);
    }
    pk.setIndex(pkeep);
    this.pocket = new THREE.Mesh(pk, fabric); this.pocket.scale.set(0.67, 0.69, 0.64); this.pocket.position.y = 0.56; m.body.add(this.pocket); this.pocket.visible = false;
    this.sleeves = m.arms.map((a) => a.children.find((c) => c.isMesh && c.geometry && c.geometry.type === "CapsuleGeometry")).filter(Boolean);
    this.sleeveMat = this.sleeves.length ? this.sleeves[0].material : null;
    this.on = false;
  }
  step(now, k, headProp) {
    const show = k > 0.5 && !headProp && Math.max(0, this.m.P.bed.x) < 0.3 && !this.m.costume;
    this.group.visible = show; this.pocket.visible = show;
    if (show !== this.on) { this.on = show; for (const s of this.sleeves) s.material = show ? this.fabric : this.sleeveMat; }
    if (!show) return;
    const sway = Math.sin(now / 520) * 0.08 * (this.m.reduce ? 0.3 : 1);
    this.strings.forEach((g, i) => { g.rotation.z = sway * (i ? 1 : -1) * 0.6; g.rotation.x = -this.m.neck.rotation.x * 0.8 + 0.1; });
  }
}

/* ------------------------------------------------------------------ the holo keyboard (instead of his phone) */
// While he thinks he'd type on his little phone; as a hacker he types on a keyboard of light floating under his hooves,
// keys lighting up as he hits them, ones and zeros drifting up off it.
export class HoloKeys {
  constructor(m) {
    this.m = m;
    const G = this.group = new THREE.Group(); G.name = "holokeys"; m.body.add(G);
    G.position.set(0, 0.6, 0.84); G.rotation.x = -0.85; G.visible = false;
    const c = this.c = document.createElement("canvas"); c.width = 512; c.height = 180; this.g = c.getContext("2d");
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.board = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.32), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    G.add(this.board);
    this.keys = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) this.keys.push({ x: 14 + x * 40 + (y % 2) * 10, y: 18 + y * 38, w: 32, h: 30, lit: 0 });
    this.keys.push({ x: 120, y: 170 - 18, w: 260, h: 14, lit: 0 });   // the space bar
    // ones and zeros floating up
    const glyph = (ch) => { const k = document.createElement("canvas"); k.width = k.height = 64; const q = k.getContext("2d"); q.font = "bold 48px ui-monospace, Consolas, monospace"; q.textAlign = "center"; q.textBaseline = "middle"; q.shadowColor = "#39ff7a"; q.shadowBlur = 10; q.fillStyle = "#b8ffd2"; q.fillText(ch, 32, 34); const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return new THREE.SpriteMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); };
    this.glyphMats = ["0", "1", "{", "}", "<", ">", ";"].map(glyph);
    this.bits = []; this.at = 0; this.drawAt = 0;
  }
  draw(now, typing) {
    const g = this.g, W = this.c.width, H = this.c.height;
    g.clearRect(0, 0, W, H);
    g.shadowColor = "#39ff7a"; g.shadowBlur = 10;
    g.fillStyle = "rgba(57,255,122,0.10)"; g.fillRect(4, 4, W - 8, H - 8);
    g.strokeStyle = "rgba(120,255,170,1)"; g.lineWidth = 7; g.strokeRect(6, 6, W - 12, H - 12);
    if (typing && Math.random() < 0.8) for (let i = 0; i < 2; i++) this.keys[Math.floor(Math.random() * this.keys.length)].lit = 1;
    for (const k of this.keys) {
      g.fillStyle = `rgba(57,255,122,${0.32 + 0.68 * k.lit})`; g.fillRect(k.x, k.y, k.w, k.h);
      g.strokeStyle = "rgba(150,255,190,0.95)"; g.lineWidth = 4; g.strokeRect(k.x, k.y, k.w, k.h);
      k.lit *= 0.55;
    }
    g.shadowBlur = 0;
    this.tex.needsUpdate = true;
  }
  step(now, k) {
    const m = this.m, ph = clamp(m.P.phone.x, 0, 1), on = k > 0.5;
    if (on) m.phone.visible = false;   // no phone: the keyboard of light instead
    const show = on && ph > 0.05;
    this.group.visible = show || this.bits.length > 0;
    if (!this.group.visible) return;
    this.board.visible = show;
    this.group.scale.setScalar(Math.max(0.001, ph));
    this.board.material.opacity = 0.9 + 0.1 * Math.sin(now / 90) * Math.sin(now / 37);
    const typing = m.mood === "typing" || m.mood === "thinking" || m.mood === "working";
    if (show && now - this.drawAt > 90) { this.drawAt = now; this.draw(now, typing); }
    if (show && typing && now - this.at > 170 && !m.reduce) {
      this.at = now;
      const s = new THREE.Sprite(this.glyphMats[Math.floor(Math.random() * this.glyphMats.length)]);
      s.position.set((Math.random() - 0.5) * 0.7, 0.02, 0.05); s.scale.setScalar(0.09); this.group.add(s);
      this.bits.push({ s, t0: now });
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i], u = (now - b.t0) / 1100;
      if (u >= 1 || !show) { this.group.remove(b.s); this.bits.splice(i, 1); continue; }
      b.s.position.y = 0.02 + 0.06 * u; b.s.position.z = 0.05 + 0.32 * u;   // up off the keys (the board is tipped back)
      b.s.material.opacity = 1;   // shared material: fade with the scale instead
      b.s.scale.setScalar(0.09 * (1 - u * 0.6));
    }
  }
}

/* ------------------------------------------------------------------ props download in */
// A new prop in Zero Day arrives as a green wireframe drawn from the bottom up, then turns solid with a flash.
export class Download {
  constructor(m) { this.m = m; this.jobs = []; }
  start(group) {
    if (!group || this.m.reduce) return;
    this.m.renderer.localClippingEnabled = true;
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);   // keeps what's below its height
    const mat = new THREE.LineBasicMaterial({ color: 0xb8ffd2, transparent: true, opacity: 1, clippingPlanes: [plane], toneMapped: false });
    const holo = new THREE.MeshBasicMaterial({ color: 0x39ff7a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: [plane], toneMapped: false });
    const edges = [], solids = [];
    group.traverse((o) => { if (o.isMesh && o.geometry && o.parent) solids.push(o); });
    for (const o of solids) {   // the lines sit beside each part (same place, same turn), so hiding the part keeps them
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), mat); e.renderOrder = 5;
      const h = new THREE.Mesh(o.geometry, holo); h.renderOrder = 4; h.userData.shared = true;   // a glowing green ghost of the part
      for (const x of [e, h]) { x.position.copy(o.position); x.quaternion.copy(o.quaternion); x.scale.copy(o.scale); o.parent.add(x); edges.push(x); }
      o.userData.dlVis = o.visible; o.visible = false;
    }
    this.jobs.push({ group, edges, solids, mat, holo, plane, t0: performance.now(), box: new THREE.Box3() });
  }
  step(now) {
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      const J = this.jobs[i], u = (now - J.t0) / 900;
      // the wireframe is drawn up from the bottom (0 → 0.55), then the solid snaps in and the lines fade (→ 1)
      J.group.updateWorldMatrix(true, true); J.box.setFromObject(J.group);   // where it is now (it moves and grows as it comes out)
      J.plane.constant = lerp(J.box.min.y - 0.05, J.box.max.y + 0.05, ease(u / 0.55));
      const solid = u > 0.55;
      for (const o of J.solids) o.visible = solid && o.userData.dlVis !== false;
      J.mat.opacity = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45);
      J.holo.opacity = (u < 0.55 ? 0.55 : 0.55 * Math.max(0, 1 - (u - 0.55) / 0.3)) * (0.85 + 0.15 * Math.sin(now / 25));
      if (u >= 1 || !J.group.parent) {
        for (const e of J.edges) { if (e.parent) e.parent.remove(e); if (!e.userData.shared) e.geometry.dispose(); }
        for (const o of J.solids) o.visible = o.userData.dlVis !== false;
        J.mat.dispose(); J.holo.dispose(); this.jobs.splice(i, 1);
      }
    }
  }
}
