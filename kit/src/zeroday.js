/* Zero Day mode: Mochi the hacker. A switch, not a costume: everything he is changes together.
 *   look     dark fleece with a phosphor-green sheen under a black hoodie (hood up, ears poking out, neon piping),
 *            a pale mint face, glowing green ears, green glints in his eyes, a green rim light, and a neon edge glow on
 *            every material in the scene (a small shader patch: a fresnel term added to the emissive light, green at
 *            the bottom, cyan at the top). A holo pad glows under him; his battlestation of code monitors stands to his
 *            left; every few seconds the picture glitches (hacker.js).
 *   face     confident: lids a little lowered, brows set, a small sure smile, chin up, ears perked. Startling news gets
 *            an alert, steady face instead of a fright (no gasp hop, no tremble, no sweat, no tears).
 *   stance   hooves on his hips while he waits.
 *   props    re-skinned by themeRecipe (shared/craft.js): dark gunmetal bodies, glowing neon details.
 * Switching cross-fades everything over about half a second, with a little spin and a burst of neon sparks. */
import * as THREE from "three";
import { Glitch, Rig, Hood, HoloKeys, Download } from "./hacker.js";
import { ZdExtras } from "./zdextras.js";

export const ZD_FACES = {
  idle: { eyeOpen: 0.84, smile: 0.32, mouthW: 0.8, brow: 0.55, browY: 0.15, browSad: -0.45, ear: 0.45, pitch: -0.07, blush: 0.25, lookX: 0.1 },
  nod: { eyeOpen: 0.84, smile: 0.5, mouthW: 0.85, brow: 0.5, browSad: -0.35, ear: 0.5, pitch: -0.05, blush: 0.3 },
  present: { eyeOpen: 0.86, smile: 0.55, mouthOpen: 0.08, brow: 0.5, browSad: -0.35, blush: 0.3, ear: 0.5, pitch: -0.08 },
  hello: { eyeOpen: 0.9, smile: 0.7, mouthOpen: 0.18, brow: 0.6, browY: 0.45, browSad: -0.25, ear: 0.6, blush: 0.4 },
  happy: { eyeHappy: 0.8, smile: 0.9, mouthOpen: 0.32, blush: 0.55, ear: 0.6, brow: 0.4, browSad: -0.2 },
  love: { eyeHappy: 0.9, smile: 0.85, mouthOpen: 0.15, blush: 0.9, ear: 0.4, tilt: 0.1, brow: 0.3, browSad: -0.1 },
  excited: { eyeScale: 1.1, smile: 1, mouthOpen: 0.5, blush: 0.6, ear: 0.9, brow: 0.55, browY: 0.5, browSad: -0.2 },
  superexcited: { eyeScale: 1.15, eyeHappy: 0.3, smile: 1, mouthOpen: 0.7, blush: 0.7, ear: 1.1, brow: 0.5, browY: 0.6, lines: 0.6 },
  proud: { eyeOpen: 0.76, smile: 0.7, blush: 0.4, ear: 0.6, pitch: -0.2, lean: -0.9, brow: 0.6, browSad: -0.4 },
  surprised: { eyeScale: 1.12, eyeOpen: 1.0, brow: 0.8, browY: 0.9, browSad: -0.2, smile: 0.25, mouthOpen: 0.32, mouthW: 0.6, ear: 0.8 },
  shocked: { eyeScale: 1.15, eyeOpen: 1.04, brow: 1, browY: 0.6, browSad: -0.6, smile: -0.1, mouthOpen: 0.3, mouthW: 0.55, ear: 1.1, pitch: -0.1, lean: 0.45, blush: 0.15 },
  concerned: { eyeOpen: 0.95, brow: 1, browSad: -0.05, browY: 0.2, smile: 0.06, mouthW: 0.75, ear: 0.4, lean: 0.85, tilt: 0.08, blush: 0.4 },
  oops: { eyeOpen: 0.86, smile: 0.25, mouthW: 0.7, brow: 0.6, browY: 0.4, browSad: -0.2, ear: 0.2, tilt: 0.1 },
  sad: { eyeOpen: 0.8, lookY: -0.3, brow: 0.9, browSad: 0.55, smile: -0.3, mouthW: 0.8, blush: 0.2, ear: -0.35, pitch: 0.12, slump: 0.4 },
  shy: { eyeOpen: 0.86, lookX: -0.45, lookY: -0.2, smile: 0.5, mouthW: 0.65, blush: 1.0, ear: 0.1, tilt: 0.12, brow: 0.4, browSad: -0.1 },
  thinking: { eyeOpen: 0.78, lookX: 0.5, lookY: 0.4, brow: 0.8, browSad: -0.4, smile: 0.15, mouthW: 0.65, tilt: -0.1, ear: 0.3 },
  held: { held: 1, eyeOpen: 0.86, smile: 0.5, brow: 0.5, browSad: -0.3, ear: 0.5, blush: 0.5 },
  yanked: { held: 1, eyeScale: 1.1, eyeOpen: 1.0, brow: 0.8, browY: 0.6, smile: 0.35, mouthOpen: 0.4, mouthW: 0.6, ear: 1.0, blush: 0.3 },
  dizzy: { eyeClosed: 0.5, smile: 0.3, mouthW: 0.7, brow: 0.5, browSad: 0.1, blush: 0.5, ear: 0.1, tilt: 0.1 },
  performing: { smile: 0.55, eyeOpen: 0.88, brow: 0.5, browSad: -0.3, blush: 0.4, ear: 0.45 },
  posing: { smile: 0.45, eyeOpen: 0.9, brow: 0.55, browSad: -0.25, browY: 0.3, blush: 0.4, ear: 0.4 },
};
const STANCE = new Set(["idle", "nod", "present", "thinking"]);   // hooves on hips while he waits
const NEON_FX = { heart: 0xff2bd6, star: 0x39ff7a, confetti: [0x39ff7a, 0x2fd8ff, 0xd6ffe4, 0x1fbf5b, 0xff2bd6] };

// the neon edge glow: one shared set of uniforms, patched into every lit material once
const RIM = { rimStrength: { value: 0 }, rimColor: { value: new THREE.Color("#39ff7a") }, rimColor2: { value: new THREE.Color("#2fd8ff") }, rimPower: { value: 2.4 } };
export function rimify(mat) {
  if (!mat || !mat.isMeshStandardMaterial || mat.userData.rim) return;
  mat.userData.rim = true;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, RIM);
    sh.fragmentShader = "uniform float rimStrength; uniform vec3 rimColor; uniform vec3 rimColor2; uniform float rimPower;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      if (rimStrength > 0.001) {
        float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), rimPower);
        totalEmissiveRadiance += mix(rimColor, rimColor2, clamp(normal.y * 0.5 + 0.5, 0.0, 1.0)) * rimF * rimStrength;
      }`);
  };
  mat.customProgramCacheKey = () => "mochi-rim";
  mat.needsUpdate = true;
}

class Spring {
  constructor(v, k = 60, zeta = 0.95) { this.x = v; this.t = v; this.v = 0; this.k = k; this.c = 2 * Math.sqrt(k) * zeta; }
  step(dt) { const a = this.k * (this.t - this.x) - this.c * this.v; this.v += a * dt; this.x += this.v * dt; }
}
const col = (h) => new THREE.Color(h);

export class ZeroDay {
  constructor(m) {
    this.m = m; this.on = false; this.k = new Spring(0, 55, 0.95); this.fx = NEON_FX;
    const M = m.mat;
    // every themed colour: [object, property, normal value, zero-day value]
    this.colors = [
      [M.wool, "color", M.wool.color.clone(), col("#191d1c")], [M.wool, "sheenColor", M.wool.sheenColor.clone(), col("#1f8f4f")],
      [M.face, "color", M.face.color.clone(), col("#d8eee2")], [M.face, "sheenColor", M.face.sheenColor.clone(), col("#a8ffd0")],
      [M.leg, "color", M.leg.color.clone(), col("#b9d8c6")], [M.hoof, "color", M.hoof.color.clone(), col("#0f1513")],
      [M.innerEar, "color", M.innerEar.color.clone(), col("#39ff7a")], [M.innerEar, "emissive", M.innerEar.emissive.clone(), col("#0e6b32")],
      [M.nose, "color", M.nose.color.clone(), col("#48f0a0")], [M.mouth, "color", M.mouth.color.clone(), col("#0f3b24")],
      [M.brow, "color", M.brow.color.clone(), col("#1f3a2c")], [M.shine, "color", M.shine.color.clone(), col("#8dffb8")],
      [M.blush, "color", M.blush.color.clone(), col("#5ef0d0")],
      [m.key, "color", m.key.color.clone(), col("#c8ffe0")], [m.rimLight, "color", m.rimLight.color.clone(), col("#39ff7a")],
      [m.fill, "color", m.fill.color.clone(), col("#0f4d2c")], [m.fill, "groundColor", m.fill.groundColor.clone(), col("#010805")],
      // Cocoa, Mochi's buddy, in his own midnight brown
      ...(m.cocoaMat ? [[m.cocoaMat.wool, "color", m.cocoaMat.wool.color.clone(), col("#3a3026")], [m.cocoaMat.wool, "sheenColor", m.cocoaMat.wool.sheenColor.clone(), col("#ffcf5c")],
        [m.cocoaMat.face, "color", m.cocoaMat.face.color.clone(), col("#e6d6c0")], [m.cocoaMat.leg, "color", m.cocoaMat.leg.color.clone(), col("#a8957a")],
        [m.cocoaMat.band, "color", m.cocoaMat.band.color.clone(), col("#39ff7a")], [m.cocoaMat.horn, "color", m.cocoaMat.horn.color.clone(), col("#cfe8d8")]] : []),
    ].filter(([o]) => o);
    this.nums = [[m.rimLight, "intensity", m.rimLight ? m.rimLight.intensity : 0, 3.4], [m.fill, "intensity", m.fill ? m.fill.intensity : 0, 0.75],
      [m.scene, "environmentIntensity", m.scene.environmentIntensity, 0.38], [M.innerEar, "emissiveIntensity", M.innerEar.emissiveIntensity ?? 1, 0.7]].filter(([o]) => o);
    // the holo pad under him
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 40, 128, 128, 126);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.62, "rgba(57,255,122,0.0)"); gr.addColorStop(0.78, "rgba(57,255,122,0.85)"); gr.addColorStop(0.86, "rgba(47,216,255,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(57,255,122,0.5)"; g.lineWidth = 2; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.arc(128, 128, 112, a, a + 0.12); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.pad = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.pad.rotation.x = -Math.PI / 2; this.pad.position.y = 0.008; this.pad.visible = false; (m.actor || m.scene).add(this.pad);
  }
  rimAll() { this.m.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(rimify); }); }
  set(on, animate = true) {
    on = !!on;
    if (on === this.on) return;
    this.on = on; this.k.t = on ? 1 : 0;
    if (on) { this.hackerSetup(); this.rimAll(); }
    if (!animate) { this.k.x = this.k.t; this.k.v = 0; }
    const m = this.m;
    if (animate && !m.reduce) { m.spinAt = performance.now(); m.wearNext = m.wearNext ?? m.costume; m.hop(0.14, 320, 0); }
    if (animate) for (let i = 0; i < 6; i++) m.spawn(i % 2 ? "star" : "confetti", 1300);
    m.setFace(m.mood);
    if (m.craft) m.craft.retheme();   // what he holds, and what he only wears
    if (m.floor && m.floor.retheme) m.floor.retheme();
    if (m.friendMoves && m.friendMoves.retheme) m.friendMoves.retheme();
    if (m.cold && m.cold.retheme) m.cold.retheme();   // his scarf
    if (m.shelf) m.shelf.retheme();
  }
  hackerSetup() {   // his battlestation, his hoodie and the glitches: made once, the first time
    const m = this.m;
    if (this.rig) return;
    try { this.glitch = new Glitch(m.renderer, m.r); } catch (e) { this.glitch = null; }
    this.rig = new Rig(m); this.hood = new Hood(m); this.keys = new HoloKeys(m); this.dl = new Download(m);
    try { this.extras = new ZdExtras(m); } catch (e) { this.extras = null; }   // Mimi's shades, Cocoa's chain, a cool bed
    if (this.pendingJob !== undefined) this.rig.setJob(this.pendingJob);
  }
  /** a prop just came out: in Zero Day it downloads in (a green wireframe drawn up from the bottom, then solid) */
  materialize(group) { if (this.on && this.dl && this.k.x > 0.9) this.dl.start(group); }
  /** what's being made on his workbench (the big screen writes it): { id, name, t0, expect } | { …, done, ms, lines } | null */
  bench(job) { if (this.rig) this.rig.setJob(job); else this.pendingJob = job; }
  /** a glitch right now (the page's own glitches can ask for one), or the random ones while it's on */
  glitchNow(ms = 200, k = 1) { if (this.glitch && this.on) { this.glitch.hit(ms, k); if (this.rig) this.rig.flash(ms); if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mochi:glitch", { detail: { ms, k } })); } }
  /** draw the frame: glitched during a burst, straight otherwise */
  render(now) {
    const m = this.m, G = this.glitch;
    const calm = m.reduce || !this.on || this.k.x < 0.9 || m.inBed || this.noGlitch;
    if (G && G.tick(now, this.on, calm)) {
      if (!this.wasGlitch && this.rig) this.rig.flash(G.burst.until - now);
      this.wasGlitch = true;
      try { G.render(m.scene, m.camera, now); return; } catch (e) { this.glitch = null; try { m.renderer.setRenderTarget(null); } catch (_) { /* gone */ } }
    }
    this.wasGlitch = false;
    m.renderer.render(m.scene, m.camera);
  }
  shelfLeds(now, k) {   // his shelf, as a little server rack: status lights blinking down its side
    const sh = this.m.shelf;
    if (!sh || !sh.group) return;
    if (!this.leds && k > 0.5) {
      this.leds = [];
      for (let i = 0; i < 6; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: i % 3 === 2 ? 0xffcf5c : 0x39ff7a }));
        l.position.set(0.61, 0.95 - i * 0.16, 0.2); sh.group.add(l); this.leds.push(l);
      }
    }
    if (!this.leds) return;
    for (let i = 0; i < this.leds.length; i++) this.leds[i].visible = k > 0.5 && sh.group.visible && Math.sin(now / (120 + i * 53) + i * 1.7) > -0.3;
  }
  face(name) { return this.on ? ZD_FACES[name] : null; }
  stance(now, t) {   // hooves on hips while waiting (blended in with the switch)
    const m = this.m, w = Math.max(0, Math.min(1, this.k.x));
    if (w < 0.01 || !STANCE.has(m.mood) || m.inBed || m.held) return;
    m.arms.forEach((a) => {
      const s = a.userData.side;
      a.rotation.x += (-0.34 + Math.sin(t * 2.1) * 0.015 - a.rotation.x) * w;
      a.rotation.z += (s * 0.98 - a.rotation.z) * w;
    });
  }
  step(dt, t) {
    this.k.step(dt);
    const k = Math.max(0, Math.min(1, this.k.x)), now = t * 1000;
    if (this.rig) this.rig.step(now, k);
    if (this.hood) this.hood.step(now, k, !!(this.m.craft && this.m.craft.headProp && this.m.craft.headProp()));
    if (this.keys) this.keys.step(now, k);
    if (this.dl) this.dl.step(now);
    if (this.extras) this.extras.step(now, k);
    this.shelfLeds(now, k);
    if (Math.abs(k - (this.lastK ?? -1)) > 1e-4) {
      this.lastK = k;
      for (const [o, p, a, b] of this.colors) o[p].copy(a).lerp(b, k);
      for (const [o, p, a, b] of this.nums) o[p] = a + (b - a) * k;
      RIM.rimStrength.value = 0.95 * k;
    }
    this.pad.visible = k > 0.01;
    if (this.pad.visible) {
      const m = this.m;
      this.pad.material.opacity = 0.85 * k * (0.85 + 0.15 * Math.sin(t * 2.2));
      this.pad.rotation.z = t * 0.25;
      this.pad.position.x = m.ground.position.x + m.root.position.x * 0;
      this.pad.scale.setScalar(m.ground.scale.x);
      this.pad.visible = Math.max(0, m.P.bed.x) < 0.5;
    }
  }
}
