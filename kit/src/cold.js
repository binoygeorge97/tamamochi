/* Sneezes and a little cold (Binoy, Nov 3: "can mochi sneeze? what if the story goes to a point where he catches a
 * cold?").
 *   sneeze()  "Ah… ah… ACHOO!": his head tips back twice, eyes screwed up, then snaps forward with a little spray and a
 *             hop back; ears flap. Then a sniff, and sometimes "excuse me!"
 *   start()   a cold: a red nose, a stripy knitted scarf, droopy eyes and brows, a sniffle every few seconds and a
 *             sneeze now and then (only when he isn't busy). Remembered by the server; ends on its own at `until`.
 *   stop()    all better: the scarf comes off with a sparkle, "I feel better!"
 * Zero Day: a black scarf with green stripes and a glowing red nose. */
import * as THREE from "three";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const emit = (name, detail) => { if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent(name, { detail })); };
const ease = (u) => u * u * (3 - 2 * u);

function stripes(a, b, n, vertical) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = vertical ? 8 : 128; c.height = vertical ? 128 : 8;
  const g = c.getContext("2d");
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; if (vertical) g.fillRect(0, (i * 128) / n, 8, 128 / n + 1); else g.fillRect((i * 128) / n, 0, 128 / n + 1, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export class Cold {
  constructor(m) { this.m = m; this.on = false; this.k = 0; this.until = 0; this.sn = null; this.drops = []; this.nextSneeze = 0; this.nextSniff = 0; this.sniff = 0; }
  /** catch a cold (until: ms since the epoch when it goes by itself; 0: until stop()) */
  start({ until = 0, quiet = false } = {}) {
    const m = this.m, now = performance.now();
    this.until = until ? until - Date.now() + now : 0;
    if (this.on) return false;
    this.build(); this.on = true; this.nap = 0;
    this.nextSneeze = now + (quiet ? 9000 : 1400); this.nextSniff = now + 5000;
    if (!quiet) { m.touch(); m.note("caught_cold"); this.sneeze({ first: true }); }
    emit("mochi:cold", { on: true });
    return true;
  }
  stop({ quiet = false, nap = false } = {}) {
    const m = this.m;
    if (!this.on) return false;
    this.on = false; this.until = 0; this.nap = 0;
    if (!quiet) {
      m.touch(); m.note("cold_better");
      m.run([["happy", 1800]]);
      for (let i = 0; i < 4; i++) m.spawn(i % 2 ? "star" : "confetti", 1500);
      m.say(nap ? "That nap fixed me right up! I feel better!" : ["I feel better! Thank you!", "All better! Hehe!", "My nose works again!"][Math.floor(m.r() * 3)]);
    }
    if (m.mood) m.setFace(m.mood);   // the droopy eyes and brows go back to whatever face he's making
    emit("mochi:cold", { on: false });
    return true;
  }
  build() {
    if (this.scarf) return;
    const m = this.m;
    // his nose gets its own material (Mimi's shares the old one), so only his goes red
    if (m.nose && !this.noseMat) { this.noseMat = m.nose.material = m.nose.material.clone(); this.noseBase = this.noseMat.color.clone(); this.noseScale = m.nose.scale.clone(); }
    const S = this.scarf = new THREE.Group(); S.name = "scarf"; S.visible = false;
    this.texRing = stripes("#e2453c", "#fbf3e6", 14, false); this.texTail = stripes("#e2453c", "#fbf3e6", 7, true);
    this.texRingZd = stripes("#0d1a12", "#39ff7a", 14, false); this.texTailZd = stripes("#0d1a12", "#39ff7a", 7, true);
    this.mat = new THREE.MeshStandardMaterial({ map: this.texRing, roughness: 0.95 });
    this.matTail = new THREE.MeshStandardMaterial({ map: this.texTail, roughness: 0.95 });
    // the wrap round his neck: a fat squashed ring, knitted stripes going round
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.115, 14, 44), this.mat);
    ring.rotation.x = Math.PI / 2 - 0.12; ring.scale.set(1, 1.1, 0.95); ring.castShadow = true; S.add(ring);   // tipped forward a touch, so the front shows under his chin
    // the knot and the two ends hanging down in front, a little to one side
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), this.mat); knot.position.set(0.15, -0.06, 0.44); knot.scale.set(1, 0.9, 0.75); S.add(knot);
    const tailGeo = new THREE.BoxGeometry(0.14, 0.36, 0.05, 1, 4, 1); tailGeo.translate(0, -0.18, 0);
    this.tails = [[0.19, -0.1, 0.46, 0.22], [0.1, -0.1, 0.47, -0.1]].map(([x, y, z, r]) => {
      const t = new THREE.Mesh(tailGeo, this.matTail); t.position.set(x, y, z); t.rotation.set(-0.25, 0, r); t.castShadow = true; S.add(t);
      // a fringe at the end
      for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 4), this.matTail); f.position.set(-0.045 + i * 0.03, -0.37, 0); t.add(f); }
      return t;
    });
    // round his neck: the neck joint, in the body (so it bobs and leans with him)
    S.position.set(0, 0.97, 0.05); (m.body || m.root).add(S);
    this.retheme();
  }
  retheme() {
    if (!this.mat) return;
    const zd = !!(this.m.zd && this.m.zd.on);
    this.mat.map = zd ? this.texRingZd : this.texRing; this.matTail.map = zd ? this.texTailZd : this.texTail;
    this.mat.emissive = new THREE.Color(zd ? 0x0a3a1c : 0x000000); this.matTail.emissive = this.mat.emissive;
    this.mat.needsUpdate = this.matTail.needsUpdate = true;
  }
  /** "Ah… ah… ACHOO!" (works with or without a cold) */
  sneeze({ first = false } = {}) {
    const m = this.m;
    if (this.sn || m.inBed || m.mood === "sleep" || m.held) return false;
    if (m.craft && (m.craft.posing || m.craft.perf)) return false;
    this.sn = { t0: performance.now(), first, boomed: false, said: false };
    m.touch(); m.cur = null; m.queue = [];
    m.run([["achooIn", 950], ["achoo", 650]]);
    m.say("Ah… ah…");
    return true;
  }
  busy() { return !!this.sn; }
  step(now, dt) {
    const m = this.m;
    this.k = clamp(this.k + (this.on ? dt / 0.8 : -dt / 0.6), 0, 1);
    if (this.on && this.until && now > this.until) this.stop();
    // a nap in his bed makes it better: half a minute asleep, and he wakes up well
    if (this.on && (m.inBed || m.mood === "sleep")) this.nap = (this.nap || 0) + dt;
    else if (this.on && this.nap > 25) { this.nap = 0; this.stop({ nap: true }); }
    // the look: scarf, red nose, droopy face
    if (this.scarf) {
      this.scarf.visible = this.k > 0.01;
      const s = 0.6 + 0.4 * ease(this.k); this.scarf.scale.setScalar(s);
      if (this.tails) this.tails.forEach((t, i) => { t.rotation.x = -0.32 + Math.sin(now / 600 + i) * 0.05 - (this.sn && this.sn.boomed ? 0.4 * Math.max(0, 1 - (now - this.sn.boomAt) / 500) : 0); });
    }
    if (this.noseMat) {
      const zd = !!(m.zd && m.zd.on);
      this.noseMat.color.copy(this.noseBase).lerp(new THREE.Color(0xff3f45), 0.85 * this.k);
      if (this.noseMat.emissive) this.noseMat.emissive.setHex(zd && this.k > 0.5 ? 0x5a0008 : 0x000000);
      const pulse = 1 + 0.18 * this.k + 0.1 * this.sniff;
      m.nose.scale.set(this.noseScale.x * pulse, this.noseScale.y * pulse, this.noseScale.z * pulse);
    }
    if (this.on && m.P && !this.sn && m.mood !== "sleep" && m.mood !== "bed") {   // a bit droopy (on top of whatever face)
      const P = m.P;
      if (P.eyeOpen.t > 0.84) P.eyeOpen.t = 0.84;
      if (P.brow.t < 0.45) P.brow.t = 0.45;
      if (P.browSad.t < 0.4) P.browSad.t = 0.4;
      if (P.blush.t < 0.9) P.blush.t = 0.9;
    }
    // a sniffle every few seconds; a sneeze now and then (not while he's busy)
    this.sniff = Math.max(0, this.sniff - dt * 5);
    const idle = !m.held && !m.inBed && m.mood !== "sleep" && !m.sulking && !(m.craft && (m.craft.perf || m.craft.posing)) && !(m.dance && m.dance.on) && !(m.hs && m.hs.gest);
    if (this.on && idle && !this.sn && now > this.nextSniff) { this.nextSniff = now + 6500 + m.r() * 6000; this.sniff = 1; }
    if (this.on && idle && now > this.nextSneeze) { this.nextSneeze = now + 24000 + m.r() * 26000; if (now - (m.saidAt || 0) > 2500) this.sneeze(); }
    if (m.neck && this.sniff > 0) m.neck.rotation.x -= 0.08 * Math.sin(this.sniff * Math.PI);
    // the sneeze itself
    const S = this.sn;
    if (S && m.neck) {
      const t = (now - S.t0) / 1000;
      let pitch = 0;
      if (t < 0.55) pitch = -0.2 * ease(t / 0.55);                                   // ah…
      else if (t < 0.7) pitch = -0.2 + 0.06 * ease((t - 0.55) / 0.15);               // (a breath)
      else if (t < 0.95) pitch = -0.14 - 0.24 * ease((t - 0.7) / 0.25);              // ah…!
      else if (t < 1.03) pitch = -0.38 + 0.72 * ease((t - 0.95) / 0.08);             // CHOO!
      else pitch = 0.34 * Math.max(0, 1 - (t - 1.03) / 0.55) * (1 + 0.15 * Math.sin((t - 1.03) * 30) * Math.max(0, 1 - (t - 1.03) * 3));
      m.neck.rotation.x += pitch;
      // knocked back a little (z isn't reset each frame: apply the change from last frame's offset)
      const back = t > 0.95 && t < 1.5 ? -0.06 * Math.sin(clamp((t - 0.95) / 0.55, 0, 1) * Math.PI) : 0;
      if (m.root) { m.root.position.z += back - (this.zOff || 0); this.zOff = back; }
      if (t >= 0.97 && !S.boomed) {
        S.boomed = true; S.boomAt = now;
        m.say(["ACHOO!", "AH-CHOO!", "ACHOOO!"][Math.floor(m.r() * 3)]);
        if (!m.reduce) m.hop(0.07, 260, 0);
        this.spray();
        m.note("sneezed");
        emit("mochi:sneeze", {});
      }
      if (t > 1.9 && !S.said) {
        S.said = true;
        const L = this.on ? ["*sniff* …ugh, my nose.", "Excuse me! *sniff*", "Oof… *sniff*"] : ["Excuse me! Hehe.", "Oops! Bless me!", "Hehe… that tickled my nose!"];
        if (S.first && this.on) m.say("Uh oh… I think I caught a cold…");
        else if (m.r() < 0.75) m.say(L[Math.floor(m.r() * L.length)]);
      }
      if (t > 2.2) { this.sn = null; if (m.root && this.zOff) { m.root.position.z -= this.zOff; this.zOff = 0; } }
    }
    // the spray: little droplets flying out at you, falling and fading
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i], u = (now - d.t0) / d.life;
      if (u >= 1) { d.mesh.removeFromParent(); d.mesh.material.dispose(); this.drops.splice(i, 1); continue; }
      d.v.y -= 2.2 * dt; d.mesh.position.addScaledVector(d.v, dt);
      d.mesh.material.opacity = 0.85 * (1 - u); d.mesh.scale.setScalar(d.s * (1 + u * 0.6));
    }
  }
  spray() {
    const m = this.m; if (!m.nose || m.reduce) return;
    const zd = !!(m.zd && m.zd.on);
    m.nose.updateWorldMatrix(true, false);
    const at = m.nose.getWorldPosition(new THREE.Vector3()), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(m.head.getWorldQuaternion(new THREE.Quaternion()));
    for (let i = 0; i < 16; i++) {
      const mat = i % 5 === 0
        ? new THREE.SpriteMaterial({ map: m.snowTex, color: zd ? 0x9dffc4 : 0xffffff, transparent: true, depthWrite: false, opacity: 0.8 })   // a puff
        : new THREE.SpriteMaterial({ color: zd ? 0x39ff7a : 0xbfe3ff, transparent: true, depthWrite: false, opacity: 0.85 });       // a droplet
      const s = new THREE.Sprite(mat), big = i % 5 === 0;
      const v = fwd.clone().multiplyScalar(1.4 + m.r() * 1.2).add(new THREE.Vector3((m.r() - 0.5) * 1.3, 0.2 + (m.r() - 0.4) * 0.9, (m.r() - 0.5) * 0.4));
      s.position.copy(at); m.scene.add(s);
      this.drops.push({ mesh: s, v, t0: performance.now(), life: big ? 700 : 520 + m.r() * 250, s: big ? 0.16 + m.r() * 0.08 : 0.028 + m.r() * 0.02 });
    }
  }
}
