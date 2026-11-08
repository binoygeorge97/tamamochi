/* Zero Day extras (Binoy, Nov 2):
 *   Mimi    neon cat-eye shades (dark lenses, a glowing magenta rim).
 *   Cocoa   a chunky gold chain with a little padlock, and a confident look: chin up, eyes half-lidded, brows set,
 *           a lopsided smirk.
 *   bed     not girly any more: a gunmetal frame with green light strips, a charcoal mattress and pillow, a dark quilt
 *           with a circuit-board pattern, a glowing power badge where the heart was, and a black-and-green beanie for
 *           a nightcap.
 * Everything fades in with the Zero Day switch (k: 0 normal, 1 Zero Day). Made once, the first time it's switched on. */
import * as THREE from "three";

const col = (h) => new THREE.Color(h);
function tex(size, draw) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function circuitQuilt() {   // dark quilt, green traces and pads, a few bright nodes
  const t = tex(256, (g, s) => {
    g.fillStyle = "#0d1714"; g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(57,255,122,0.18)"; g.lineWidth = 2;
    for (let i = 0; i <= s; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }   // the quilting
    g.strokeStyle = "#1fbf5b"; g.lineWidth = 3; g.lineCap = "round";
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 14; k++) {   // traces: straight runs with 45° bends, a pad at each end
      let x = Math.round(rnd() * 8) * 32, y = Math.round(rnd() * 8) * 32;
      g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 3; j++) { const d = 32 * (1 + Math.floor(rnd() * 2)), dir = Math.floor(rnd() * 4); if (dir === 0) x += d; else if (dir === 1) y += d; else if (dir === 2) { x += d; y += d; } else { x -= d; y += d; } g.lineTo(x, y); }
      g.stroke();
      g.fillStyle = k % 4 === 0 ? "#2fd8ff" : "#39ff7a"; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.4);
  return t;
}
function beanieStripes() {
  const t = tex(64, (g, s) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#121816" : "#39ff7a"; g.fillRect(0, (i * s) / 8, s, s / 8); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1.2);
  return t;
}

export class ZdExtras {
  constructor(m) {
    this.m = m; this.k = -1;
    const mesh = (parent, geo, mat) => { const o = new THREE.Mesh(geo, mat); parent.add(o); return o; };

    // ---- Mimi's shades: two cat-eye lenses tilted up at the outer corners, a bridge, little arms back to her ears
    this.shades = new THREE.Group(); this.shades.visible = false;
    if (m.mimiHead) {
      m.mimiHead.add(this.shades);
      const lens = new THREE.MeshPhysicalMaterial({ color: 0x14081a, roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
      const rim = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
      this.shades.position.set(0, -0.04, 0.56);
      for (const sd of [-1, 1]) {
        const L = mesh(this.shades, new THREE.SphereGeometry(1, 24, 14), lens); L.scale.set(0.13, 0.1, 0.035); L.position.set(sd * 0.178, 0, 0.0); L.rotation.z = -sd * 0.2;
        const R = mesh(this.shades, new THREE.TorusGeometry(1, 0.09, 6, 30), rim); R.scale.set(0.134, 0.104, 0.12); R.position.set(sd * 0.178, 0, 0.01); R.rotation.z = -sd * 0.2;
        const tip = mesh(this.shades, new THREE.ConeGeometry(0.028, 0.07, 8), rim); tip.position.set(sd * 0.31, 0.065, 0.0); tip.rotation.z = -sd * 1.0;   // the cat-eye flick
        const arm = mesh(this.shades, new THREE.CapsuleGeometry(0.009, 0.3, 4, 6), rim); arm.rotation.x = Math.PI / 2; arm.position.set(sd * 0.31, 0.02, -0.17);
      }
      const bridge = mesh(this.shades, new THREE.CapsuleGeometry(0.01, 0.06, 4, 6), rim); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, 0.02, 0.01);
    }

    // ---- Cocoa's chain: round links that hang lower in front, and a padlock pendant
    this.chain = new THREE.Group(); this.chain.visible = false;
    if (m.cocoaBody) {
      m.cocoaBody.add(this.chain);
      const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.22, clearcoat: 0.6, emissive: 0x3a2400, emissiveIntensity: 0.6 });
      const link = new THREE.TorusGeometry(0.046, 0.016, 6, 14), N = 24;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2, front = Math.max(0, Math.sin(a));
        const o = mesh(this.chain, link, gold);
        o.position.set(0.47 * Math.cos(a), 0.93 - 0.16 * front * front, 0.04 + 0.47 * Math.sin(a));
        o.lookAt(o.position.x * 2, o.position.y, (o.position.z - 0.04) * 2 + 0.04); o.rotateY(Math.PI / 2); o.rotateX(i % 2 ? Math.PI / 2 : 0);
      }
      const lock = new THREE.Group(); lock.position.set(0, 0.68, 0.53); lock.rotation.x = -0.2; this.chain.add(lock);
      const body = mesh(lock, new THREE.BoxGeometry(0.14, 0.12, 0.045), gold); body.position.y = -0.03;
      mesh(lock, new THREE.TorusGeometry(0.042, 0.013, 6, 16, Math.PI), gold).position.y = 0.03;
      const hole = mesh(lock, new THREE.CircleGeometry(0.017, 10), new THREE.MeshBasicMaterial({ color: 0x39ff7a })); hole.position.set(0, -0.03, 0.024);
    }
    this.cocoaMouthQ = m.cocoaMouth ? m.cocoaMouth.quaternion.clone() : null;
    this.cocoaMouthP = m.cocoaMouth ? m.cocoaMouth.position.clone() : null;
    this.browBase = (m.cocoaEyes || []).map((e) => (e.brow ? { z: e.brow.rotation.z, y: e.brow.position.y } : null));

    // ---- the bed
    const B = m.bedParts;
    this.bedColors = [];
    if (B) {
      this.bedColors = [[B.frame, "color", B.frame.color.clone(), col("#1b2320")], [B.soft, "color", B.soft.color.clone(), col("#2a3431")],
        [B.soft, "sheenColor", B.soft.sheenColor.clone(), col("#1f8f4f")], [B.quilt, "sheenColor", B.quilt.sheenColor.clone(), col("#39ff7a")]];
      this.quiltMap = B.quilt.map; this.quiltZd = circuitQuilt();
      this.capMap = m.capMat ? m.capMat.map : null; this.capZd = beanieStripes();
      // light strips along the headboard top and the side rail, and a power badge where the heart was
      const glow = new THREE.MeshBasicMaterial({ color: 0x39ff7a, transparent: true, opacity: 0.95 });
      this.bedGlow = new THREE.Group(); this.bedGlow.visible = false; m.bedGroup.add(this.bedGlow);
      mesh(this.bedGlow, new THREE.BoxGeometry(0.035, 0.035, 0.96), glow).position.set(-1.0, 1.5, 0);
      mesh(this.bedGlow, new THREE.BoxGeometry(1.86, 0.025, 0.02), glow).position.set(0, 0.4, 0.485);
      mesh(this.bedGlow, new THREE.BoxGeometry(1.86, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: 0x2fd8ff })).position.set(0, 0.24, 0.485);
      const badge = new THREE.Group(); badge.position.set(0, 0.32, 0.5); this.bedGlow.add(badge);
      mesh(badge, new THREE.CircleGeometry(0.1, 28), new THREE.MeshBasicMaterial({ color: 0x0b1210 })).position.z = 0.002;
      mesh(badge, new THREE.TorusGeometry(0.06, 0.012, 6, 28, Math.PI * 1.6), glow).rotation.z = Math.PI / 2 + Math.PI * 0.2;   // the power symbol: an open ring…
      const bar = mesh(badge, new THREE.BoxGeometry(0.022, 0.07, 0.01), glow); bar.position.set(0, 0.04, 0.004);              // …and its bar
    }
  }

  step(now, k) {
    const m = this.m, on = k > 0.5;
    // Mimi's shades and Cocoa's chain come with the switch
    this.shades.visible = on && !!(m.gf && m.mimi.visible);
    this.chain.visible = on && !!(m.bud && m.cocoa.visible);
    // Cocoa, confident: chin up, eyes a little lidded, brows set low and angled, a lopsided smirk
    if (m.bud && m.cocoa.visible && k > 0.01) {
      if (m.cocoaNeck) m.cocoaNeck.rotation.x -= 0.14 * k;
      (m.cocoaEyes || []).forEach((e, i) => {
        e.ball.scale.y *= 1 - 0.32 * k;
        const b = this.browBase[i]; if (e.brow && b) { const sd = i === 0 ? -1 : 1; e.brow.rotation.z = b.z - sd * 0.32 * k; e.brow.position.y = b.y - 0.022 * k; }
      });
      if (m.cocoaMouth && this.cocoaMouthQ) {
        (this.tmpQ || (this.tmpQ = new THREE.Quaternion())).setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.22 * k);
        m.cocoaMouth.quaternion.copy(this.cocoaMouthQ).multiply(this.tmpQ);
        m.cocoaMouth.position.copy(this.cocoaMouthP); m.cocoaMouth.position.x += 0.025 * k; m.cocoaMouth.position.y += 0.008 * k;
      }
    } else if (this.k > 0.01 && k <= 0.01) {   // switched off: back to his normal face
      (m.cocoaEyes || []).forEach((e, i) => { const b = this.browBase[i]; if (e.brow && b) { e.brow.rotation.z = b.z; e.brow.position.y = b.y; } });
      if (m.cocoaMouth && this.cocoaMouthQ) { m.cocoaMouth.quaternion.copy(this.cocoaMouthQ); m.cocoaMouth.position.copy(this.cocoaMouthP); }
    }
    // the bed, cross-faded with the switch (the patterns swap halfway)
    if (Math.abs(k - this.k) > 1e-4) {
      for (const [o, p, a, b] of this.bedColors) o[p].copy(a).lerp(b, k);
      const B = m.bedParts;
      if (B) {
        if (B.quilt.map !== (on ? this.quiltZd : this.quiltMap)) { B.quilt.map = on ? this.quiltZd : this.quiltMap; B.quilt.needsUpdate = true; }
        if (m.capMat && this.capMap && m.capMat.map !== (on ? this.capZd : this.capMap)) { m.capMat.map = on ? this.capZd : this.capMap; m.capMat.needsUpdate = true; }
        B.heart.visible = !on; this.bedGlow.visible = on;
      }
      this.k = k;
    }
    if (this.bedGlow && this.bedGlow.visible) this.bedGlow.children.forEach((c, i) => { if (c.material && c.material.opacity !== undefined && c.material.transparent) c.material.opacity = 0.75 + 0.25 * Math.sin(now / 400 + i); });
  }
}
