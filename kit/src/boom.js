/* Big explosions (Binoy, Nov 2: "much bigger and intense", and in Zero Day "more cooler and zero day themed").
 * Normal: a firework. A white-hot flash that swells and fades, a shockwave ring, two waves of stars, confetti and
 * glitter flung out (the second a beat later), bright streamers that arc and fall trailing sparks, a camera shake
 * and a flash on the page.
 * Zero Day: a data burst. A cyan core, an expanding wireframe sphere, a scanline ring, glyphs (ｱ 0 1 { } <) blown
 * outward and tumbling, green sparks, a pixel-block "corruption" cloud, a glitch burst on the whole stage, and the
 * monitors flash.
 * Everything is pooled per effect and disposed when it's done; a cap keeps a volley from piling up. */
import * as THREE from "three";

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const emit = (name, detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent(name, { detail })); };
const PARTY = [0xff6f91, 0xffd25e, 0x5ec8ff, 0x7be08a, 0xb48cff, 0xffffff, 0xff9f43];
const HACK = [0x39ff7a, 0x2fd8ff, 0xd6ffe4, 0x1fbf5b, 0xff2bd6];
const GLYPHS = "ｱｲｳｵｶｷｸｹｻｼｽﾀﾁﾂﾃﾅﾆﾇﾈﾊﾋﾌﾍﾎﾏﾐﾑﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ01{}<>=*;";

export class Boom {
  constructor(m) {
    this.m = m; this.live = []; this.shake = { k: 0, t0: 0 };
    this.geo = { sphere: new THREE.SphereGeometry(1, 24, 16), wire: new THREE.IcosahedronGeometry(1, 2), ring: new THREE.RingGeometry(0.86, 1, 64), star: m.starGeo, confetti: m.confettiGeo, gem: new THREE.OctahedronGeometry(0.03, 0), box: new THREE.BoxGeometry(0.08, 0.08, 0.08), streamer: new THREE.CapsuleGeometry(0.02, 0.14, 4, 8) };
    this.glyphMats = null;
  }
  glyphs() {
    if (this.glyphMats) return this.glyphMats;
    this.glyphMats = [...GLYPHS].map((ch) => {
      const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
      g.font = "bold 46px ui-monospace, Consolas, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = "#39ff7a"; g.shadowBlur = 12; g.fillStyle = Math.random() < 0.2 ? "#2fd8ff" : "#b8ffd2"; g.fillText(ch, 32, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.SpriteMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    });
    return this.glyphMats;
  }
  /** a big one at `at` (world); size 1 = the launcher's, 0.5 = a splat on the glass */
  big(at, { size = 1, zeroDay = false } = {}) {
    if (this.live.length > 6) return;
    const m = this.m, r = m.r, S = size, now = performance.now();
    const E = { t0: now, dur: zeroDay ? 1900 : 2200, parts: [], zd: zeroDay, at: at.clone() };
    const add = (mesh, p) => { mesh.position.copy(at); m.scene.add(mesh); E.parts.push({ mesh, ...p }); return mesh; };
    const mat = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, ...o });
    if (!zeroDay) {
      // the flash and the shockwave
      add(new THREE.Mesh(this.geo.sphere, mat({ color: 0xfff4d6, blending: THREE.AdditiveBlending })), { kind: "flash", s0: 0.25 * S, s1: 1.9 * S, life: 420 });
      add(new THREE.Mesh(this.geo.sphere, mat({ color: 0xffb347, blending: THREE.AdditiveBlending, opacity: 0.55 })), { kind: "flash", s0: 0.4 * S, s1: 2.6 * S, life: 650 });
      const ring = add(new THREE.Mesh(this.geo.ring, mat({ color: 0xffffff, side: THREE.DoubleSide, opacity: 0.9 })), { kind: "ring", s0: 0.2 * S, s1: 4.2 * S, life: 700 });
      ring.lookAt(m.camera.position);
      // two waves of stars, confetti and glitter
      const wave = (n, speed, delay, cols) => { for (let i = 0; i < n; i++) {
        const k = r(), geo = k < 0.35 ? this.geo.star : k < 0.75 ? this.geo.confetti : this.geo.gem, sz = geo === this.geo.star ? 0.35 + r() * 0.3 : geo === this.geo.gem ? 1.2 + r() * 1.2 : 1.1 + r() * 0.5;
        const dir = new THREE.Vector3(r() - 0.5, r() - 0.3, r() - 0.5).normalize(), v = speed * (0.45 + r() * 0.9) * S;
        const mesh = add(new THREE.Mesh(geo, mat({ color: cols[Math.floor(r() * cols.length)], side: THREE.DoubleSide })), { kind: "bit", vel: dir.multiplyScalar(v), g: 2.2, drag: 1.1, spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(14), size: sz, life: 1500 + r() * 800, delay });
        mesh.scale.setScalar(0.001);
      } };
      wave(70, 5.2, 0, PARTY); wave(50, 3.6, 140, PARTY);
      // streamers that arc out and fall, each trailing sparks
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + r() * 0.5, dir = new THREE.Vector3(Math.cos(a), 0.9 + r() * 0.6, Math.sin(a) * 0.6).normalize();
        add(new THREE.Mesh(this.geo.streamer, mat({ color: PARTY[i % PARTY.length] })), { kind: "streamer", vel: dir.multiplyScalar((3.8 + r() * 1.6) * S), g: 4.5, drag: 0.6, life: 1500 + r() * 500, sparkAt: 0, size: 1 });
      }
    } else {
      // the core, the wireframe sphere, the scanline ring
      add(new THREE.Mesh(this.geo.sphere, mat({ color: 0x9dffd0, blending: THREE.AdditiveBlending })), { kind: "flash", s0: 0.2 * S, s1: 1.3 * S, life: 380 });
      add(new THREE.Mesh(this.geo.wire, new THREE.MeshBasicMaterial({ color: 0x39ff7a, wireframe: true, transparent: true, depthWrite: false, toneMapped: false })), { kind: "wire", s0: 0.1 * S, s1: 3.2 * S, life: 900 });
      add(new THREE.Mesh(this.geo.wire, new THREE.MeshBasicMaterial({ color: 0x2fd8ff, wireframe: true, transparent: true, depthWrite: false, toneMapped: false })), { kind: "wire", s0: 0.1 * S, s1: 2.2 * S, life: 1200, delay: 120 });
      const ring = add(new THREE.Mesh(this.geo.ring, mat({ color: 0x39ff7a, side: THREE.DoubleSide, opacity: 0.9 })), { kind: "ring", s0: 0.2 * S, s1: 5 * S, life: 800 });
      ring.lookAt(m.camera.position);
      const ring2 = add(new THREE.Mesh(this.geo.ring, mat({ color: 0xff2bd6, side: THREE.DoubleSide, opacity: 0.7 })), { kind: "ring", s0: 0.1 * S, s1: 3.4 * S, life: 1000, delay: 160 });
      ring2.lookAt(m.camera.position);
      // glyphs blown outward, tumbling; sparks; a corruption cloud of pixel blocks
      const G = this.glyphs();
      for (let i = 0; i < 46; i++) {
        const s = new THREE.Sprite(G[Math.floor(r() * G.length)]);
        const dir = new THREE.Vector3(r() - 0.5, r() - 0.35, r() - 0.5).normalize();
        add(s, { kind: "glyph", vel: dir.multiplyScalar((3.4 + r() * 3.4) * S), g: 0.6, drag: 1.4, size: 0.16 + r() * 0.2, life: 1300 + r() * 700, flick: r() * 10 });
        s.scale.setScalar(0.001);
      }
      for (let i = 0; i < 40; i++) {
        const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
        const mesh = add(new THREE.Mesh(this.geo.box, mat({ color: HACK[Math.floor(r() * HACK.length)] })), { kind: "bit", vel: dir.multiplyScalar((2 + r() * 4) * S), g: 0.4, drag: 1.8, spin: new THREE.Vector3(0, 0, 0), size: 0.6 + r() * 1.2, life: 900 + r() * 700, step: true });
        mesh.scale.setScalar(0.001);
      }
      for (let i = 0; i < 36; i++) {
        const dir = new THREE.Vector3(r() - 0.5, r() - 0.2, r() - 0.5).normalize();
        const mesh = add(new THREE.Mesh(this.geo.gem, mat({ color: 0xd6ffe4, blending: THREE.AdditiveBlending })), { kind: "bit", vel: dir.multiplyScalar((6 + r() * 4) * S), g: 1.5, drag: 1.2, spin: new THREE.Vector3(r(), r(), r()).multiplyScalar(20), size: 1 + r(), life: 600 + r() * 500 });
        mesh.scale.setScalar(0.001);
      }
      if (m.zd && m.zd.glitchNow) m.zd.glitchNow(260 * S, Math.min(1, 0.6 + 0.5 * S));
    }
    this.live.push(E);
    this.shake = { k: Math.min(1, 0.55 * S + 0.25), t0: now };
    emit("mochi:boom", { size: S, zeroDay, x: this.screen(at).x, y: this.screen(at).y });
    for (let i = 0; i < 4; i++) m.spawn(zeroDay ? "star" : i % 2 ? "star" : "confetti", 1200);
  }
  screen(at) {
    let x = 0.5, y = 0.5;
    if (this.m.canvas && this.m.canvas.getBoundingClientRect) { const p = at.clone().project(this.m.camera), r = this.m.canvas.getBoundingClientRect(); x = r.left + (p.x + 1) / 2 * r.width; y = r.top + (1 - p.y) / 2 * r.height; }
    return { x, y };
  }
  step(now, dt) {
    // camera shake: a quick decaying jitter (the camera is reset by resize; we only nudge it while shaking)
    // (a nudge on top of wherever the camera is: take the last nudge back first, unless a resize already put the
    // camera somewhere new, so a resize mid-shake isn't undone)
    const sh = this.shake;
    if (sh.k > 0) {
      const cam = this.m.camera.position;
      if (this.off && this.applied && cam.equals(this.applied)) cam.sub(this.off);
      const u = (now - sh.t0) / 520, k = u >= 1 ? 0 : sh.k * (1 - u) * (1 - u);
      if (k > 0 && !this.m.reduce) { (this.off || (this.off = cam.clone())).set((Math.random() - 0.5) * 0.12 * k, (Math.random() - 0.5) * 0.09 * k, 0); cam.add(this.off); this.applied = cam.clone(); }
      else { this.off = null; this.applied = null; sh.k = 0; }
    }
    for (let e = this.live.length - 1; e >= 0; e--) {
      const E = this.live[e], age = now - E.t0;
      let alive = 0;
      for (const p of E.parts) {
        const t = age - (p.delay || 0);
        if (t < 0) { alive++; continue; }
        const u = t / p.life;
        if (u >= 1) { if (p.mesh.parent) { this.m.scene.remove(p.mesh); if (!p.mesh.isSprite) p.mesh.material.dispose(); } continue; }
        alive++;
        const M = p.mesh;
        if (p.kind === "flash") { const s = p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - u, 3)); M.scale.setScalar(s); M.material.opacity = (M.material.opacity === undefined ? 1 : 1) * (1 - u) * (1 - u); }
        else if (p.kind === "ring") { const s = p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - u, 2)); M.scale.setScalar(s); M.material.opacity = 0.9 * (1 - u); }
        else if (p.kind === "wire") { const s = p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - u, 2)); M.scale.setScalar(s); M.rotation.y += dt * 1.5; M.rotation.x += dt * 0.7; M.material.opacity = 0.85 * (1 - u); }
        else if (p.kind === "glyph") {
          p.vel.y -= p.g * dt; p.vel.multiplyScalar(Math.exp(-p.drag * dt)); M.position.addScaledVector(p.vel, dt);
          const on = Math.sin(t / 40 + p.flick) > -0.6 ? 1 : 0.25;   // flickering
          M.scale.setScalar(p.size * Math.min(1, u * 6) * (1 - u * 0.5) * on);
        } else {   // bits and streamers
          p.vel.y -= p.g * dt; p.vel.multiplyScalar(Math.exp(-p.drag * dt));
          if (p.step) { if (Math.floor(t / 70) !== Math.floor((t - dt * 1000) / 70)) M.position.addScaledVector(p.vel, 0.07); }   // pixel blocks move in steps
          else M.position.addScaledVector(p.vel, dt);
          if (p.spin) { M.rotation.x += p.spin.x * dt; M.rotation.y += p.spin.y * dt; M.rotation.z += p.spin.z * dt; }
          if (p.kind === "streamer") {
            M.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.vel.clone().normalize());
            if ((p.sparkAt += dt) > 0.05 && this.m.craft) { p.sparkAt = 0; this.m.craft.burst("spark", M.position, p.vel.clone().negate().normalize(), 1, { spread: 0.6, speed: 0.4 }); }
          }
          M.scale.setScalar(p.size * Math.min(1, u * 8));
          M.material.opacity = u > 0.65 ? 1 - (u - 0.65) / 0.35 : 1;
        }
      }
      if (!alive) this.live.splice(e, 1);
    }
  }
}
