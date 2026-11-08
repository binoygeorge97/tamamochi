// Kit and Pip in 3D (Binoy, Nov 3: "I want the owl and the fox to be only staying in the work bench page. also can you
// make them 3d and animated too like mochi?").
// Two original chibi characters built from code, lit and shaded like Mochi (the same lights, sheen and soft room
// reflections), standing at the workshop's bench:
//   Kit the fox, in a green hoodie, writes the code at a laptop: little code symbols float up while he types.
//   Pip the owl tests it blind: eyes shut and head turned away while Kit writes ("don't tell me what it is!"), then the
//   picture flies from Kit's laptop to Pip's easel and Pip peers at it through a magnifying glass. A pass: a hop, a
//   green tick, happy eyes. A miss: a head shake, a red cross, Kit's ears droop.
// It follows the crew panel (web/bench.js): its data-phase and data-verdict, and the picture in its .crew-photo.
//   mountCrew3D(panel, host) → { dispose } or null (no WebGL: the panel keeps its drawings)
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, to, k, dt) => cur + (to - cur) * (1 - Math.exp(-k * dt));
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

function ball(r, mat, sx = 1, sy = 1, sz = 1, seg = 32) {
  const S = Math.max(24, seg * 2);                                   // high-poly (Nov 3): smooth silhouettes up close
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, S, Math.round(S * 0.75)), mat);
  m.scale.set(sx, sy, sz); return m;
}
function at(m, x, y, z, parent) { m.position.set(x, y, z); if (parent) parent.add(m); return m; }
// a soft, slightly puffy cone (ears, cheek ruffs, tufts, the beak): a lathe with a rounded profile instead of flat sides.
// `from` makes just the top part (an ear's dark tip), `grow` makes it a hair bigger so it sits on top.
const softProfile = (t) => Math.pow(1 - t, 0.9) * (1 + 0.15 * Math.sin(Math.PI * t));
// Kit's original straight-sided ears
function straightCone(r, h, mat, seg = 48) { const g = new THREE.ConeGeometry(r, h, seg, 4); g.translate(0, h / 2, 0); return new THREE.Mesh(g, mat); }
function cone(r, h, mat, seg = 24, { from = 0, grow = 1 } = {}) {
  const pts = [new THREE.Vector2(0, h * from)], N = 24;
  for (let i = 0; i <= N; i++) { const t = from + (1 - from) * (i / N); pts.push(new THREE.Vector2(Math.max(1e-4, r * grow * softProfile(t)), h * t)); }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, Math.max(32, seg * 2)), mat);
}
function arc(r, tube, mat) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 16, 48, Math.PI), mat); }
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// fine fur strands and overlapping feathers, as bump maps (texture without extra geometry)
function bumpTex(kind) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
  if (kind === "fur") {
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, l = 4 + Math.random() * 9, a = Math.PI / 2 + (Math.random() - 0.5) * 0.6, v = Math.floor(70 + Math.random() * 120);
      g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.lineWidth = 1 + Math.random(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  } else {
    for (let row = -1; row < 19; row++) for (let col = -1; col < 15; col++) {
      const x = col * 20 + (row % 2 ? 10 : 0), y = row * 14, gr = g.createRadialGradient(x, y, 2, x, y, 12);
      gr.addColorStop(0, "#a8a8a8"); gr.addColorStop(0.8, "#7c7c7c"); gr.addColorStop(1, "#4a4a4a");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 12, 0, Math.PI); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
// an iris: a limbal ring, fibres radiating out, a darker edge, and the pupil (a fox's slit, an owl's big round one)
function irisTex(inner, outer, pupil, pr = 62) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, inner); gr.addColorStop(0.72, outer); gr.addColorStop(0.9, "#3a2412"); gr.addColorStop(1, "#1a0e06");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * TAU, r0 = 30 + Math.random() * 20, r1 = 80 + Math.random() * 30;
    g.strokeStyle = Math.random() < 0.5 ? "rgba(255,240,190,.28)" : "rgba(90,45,10,.25)"; g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); g.stroke();
  }
  g.fillStyle = "#0b0605"; g.beginPath();
  if (pupil === "slit") g.ellipse(128, 128, 22, 78, 0, 0, TAU); else g.arc(128, 128, pr, 0, TAU);
  g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function materials() {
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const furB = bumpTex("fur"), featherB = bumpTex("feather");
  return {
    fur: P({ color: 0xf28c3c, roughness: 0.72, sheen: 0.9, sheenRoughness: 0.5, sheenColor: 0xffc79a }),
    cream: P({ color: 0xfff3e4, roughness: 0.7, sheen: 0.8, sheenRoughness: 0.45, sheenColor: 0xffffff }),
    rim: P({ color: 0x1e120b, roughness: 0.5 }),
    cornea: P({ color: 0xffffff, roughness: 0, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
    tear: P({ color: 0x6b3a1e, roughness: 0.8, transparent: true, opacity: 0.75 }),
    whisker: new THREE.MeshStandardMaterial({ color: 0x4a3c35, roughness: 0.6, transparent: true, opacity: 0.8 }),
    face: P({ color: 0xece4fb, roughness: 0.75, sheen: 0.8, sheenColor: 0xffffff, bumpMap: featherB, bumpScale: 0.8 }),
    brow: P({ color: 0xfdfbff, roughness: 0.7, sheen: 0.9, sheenColor: 0xffffff, bumpMap: furB, bumpScale: 0.8 }),
    horn: P({ color: 0x5f554f, roughness: 0.32, clearcoat: 0.7 }),
    sock: P({ color: 0x5a3522, roughness: 0.65, sheen: 0.5, sheenColor: 0xa77a5c }),
    hoodie: P({ color: 0x6cc48a, roughness: 0.88, sheen: 1, sheenRoughness: 0.6, sheenColor: 0xdaffe6 }),
    hoodieDark: P({ color: 0x55ad74, roughness: 0.9, sheen: 0.8, sheenColor: 0xc8f5d6 }),
    eye: P({ color: 0x1d1512, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }),
    ink: new THREE.MeshBasicMaterial({ color: 0x2a1d18 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    blush: new THREE.MeshBasicMaterial({ color: 0xff9fb0, transparent: true, opacity: 0.5, depthWrite: false }),
    nose: P({ color: 0x2a1d18, roughness: 0.25, clearcoat: 0.8 }),
    sweat: P({ color: 0x8fd3ff, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }),
    owl: P({ color: 0xb9a6ee, roughness: 0.78, sheen: 0.9, sheenRoughness: 0.5, sheenColor: 0xf1eaff, bumpMap: featherB, bumpScale: 0.9 }),
    owlDark: P({ color: 0x9a85dc, roughness: 0.78, sheen: 0.7, sheenColor: 0xe0d6ff, bumpMap: featherB, bumpScale: 0.9 }),
    belly: P({ color: 0xf1eaff, roughness: 0.75, sheen: 0.8, sheenColor: 0xffffff, bumpMap: featherB, bumpScale: 0.7 }),
    white: P({ color: 0xffffff, roughness: 0.35, clearcoat: 0.4 }),
    beak: P({ color: 0xf2a33c, roughness: 0.4, clearcoat: 0.5 }),
    gold: P({ color: 0xd9a845, metalness: 0.85, roughness: 0.3 }),
    glass: P({ color: 0xe6f6ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.32, depthWrite: false }),
    wood: P({ color: 0xb98a55, roughness: 0.7, sheen: 0.2 }),
    kraft: P({ color: 0xd9b37a, roughness: 0.8 }),
    laptop: P({ color: 0xc9ced6, metalness: 0.55, roughness: 0.32, clearcoat: 0.3 }),
    laptopDark: P({ color: 0x9aa3ad, metalness: 0.5, roughness: 0.4 }),
  };
}

function eye(M, r, { glossy = true } = {}) {
  const g = new THREE.Group();
  const open = new THREE.Group(); g.add(open);
  open.add(ball(r, M.eye, 1, 1.18, 0.55));
  if (glossy) { at(ball(r * 0.31, M.shine, 1, 1, 1, 12), r * 0.33, r * 0.45, r * 0.5, open); at(ball(r * 0.14, M.shine, 1, 1, 1, 10), -r * 0.25, -r * 0.35, r * 0.52, open); }
  const happy = arc(r * 0.72, r * 0.17, M.ink); happy.position.z = r * 0.35; happy.visible = false; g.add(happy);          // ^ ^
  const shut = arc(r * 0.72, r * 0.17, M.ink); shut.rotation.z = Math.PI; shut.position.z = r * 0.35; shut.visible = false; g.add(shut);   // ‿ ‿
  return { g, open, happy, shut };
}
// a more lifelike eye: a dark lid line, a textured iris with its pupil, a glassy cornea with a glint
function realEye(M, r, tex, { sx = 1, sy = 1, glint = 1 } = {}) {
  const g = new THREE.Group(), open = new THREE.Group(); g.add(open); open.scale.set(sx, sy, 1); open.userData.sy = sy;
  open.add(ball(r * 1.14, M.rim, 1, 1, 0.4));
  const iris = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 })); iris.position.z = r * 0.47; open.add(iris);
  at(ball(r, M.cornea, 1, 1, 0.36), 0, 0, r * 0.3, open);
  at(ball(r * 0.17 * glint, M.shine, 1, 1, 1, 12), r * 0.3, r * 0.34, r * 0.66, open);
  at(ball(r * 0.08 * glint, M.shine, 1, 1, 1, 10), -r * 0.28, -r * 0.3, r * 0.64, open);
  const happy = arc(r * 0.8, r * 0.16, M.ink); happy.position.z = r * 0.5; happy.visible = false; g.add(happy);
  const shut = arc(r * 0.8, r * 0.16, M.ink); shut.rotation.z = Math.PI; shut.position.z = r * 0.5; shut.visible = false; g.add(shut);
  return { g, open, happy, shut };
}

// ---------- Kit the fox ----------
function makeFox(M) {
  const root = new THREE.Group(); root.name = "kit";
  const torso = new THREE.Group(); root.add(torso);
  at(ball(0.4, M.hoodie, 1.05, 1.0, 0.95), 0, 0.4, 0, torso);
  at(ball(0.15, M.hoodieDark, 1.5, 0.62, 0.42), 0, 0.27, 0.34, torso);                        // the hoodie's pocket
  at(ball(0.13, M.cream, 1.15, 1.0, 0.6), 0, 0.66, 0.27, torso);                              // chest fluff at the neckline
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.075, 24, 64), M.hoodie); hood.rotation.x = Math.PI / 2; at(hood, 0, 0.75, -0.02, torso);
  at(ball(0.2, M.hoodie, 1.2, 0.8, 0.7), 0, 0.74, -0.25, torso);                               // the hood, down
  for (const s of [-1, 1]) at(ball(0.12, M.sock, 1, 0.7, 1.35), 0.19 * s, 0.07, 0.25, root);  // little dark socks
  // the tail: a fluffy curl with a white tip
  const tail = new THREE.Group(); at(tail, -0.25, 0.16, -0.26, root);
  [[0, 0, 0, 0.12], [-0.13, 0.08, -0.04, 0.16], [-0.27, 0.2, -0.06, 0.185], [-0.37, 0.36, -0.05, 0.165], [-0.42, 0.52, -0.02, 0.115]]
    .forEach(([x, y, z, r], i) => at(ball(r, i === 4 ? M.cream : M.fur, 1, 1, 0.9, 20), x, y, z, tail));
  // arms: a sleeve and a dark paw; each points at a target (typing, waving, cheering)
  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group(); at(g, 0.34 * s, 0.6, 0.05, root);
    const sl = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.17, 12, 32), M.hoodie); sl.geometry.translate(0, -0.17, 0); g.add(sl);
    at(ball(0.082, M.sock, 1, 1, 1, 20), 0, -0.31, 0, g);
    return g;
  });
  // head
  const head = new THREE.Group(); at(head, 0, 0.78, 0.02, root);
  const H = new THREE.Group(); H.position.y = 0.36; head.add(H);
  // Kit's original face (Binoy, Nov 3: "revert back to the original fox 3d model you had. these ones look scary")
  at(ball(0.46, M.fur, 1.12, 0.94, 1.0), 0, 0, 0, H);
  for (const s of [-1, 1]) at(ball(0.17, M.cream, 1.05, 0.8, 0.85), 0.31 * s, -0.15, 0.18, H);   // cheek fluff
  at(ball(0.2, M.cream, 1.25, 0.8, 0.95), 0, -0.14, 0.31, H);                                     // muzzle
  at(ball(0.05, M.nose, 1.35, 0.9, 1), 0, -0.075, 0.5, H);
  for (const s of [-1, 1]) { const m = arc(0.032, 0.008, M.ink); m.rotation.z = Math.PI; at(m, 0.032 * s, -0.135, 0.497, H); }
  const eyes = [-1, 1].map((s) => { const e = eye(M, 0.085); at(e.g, 0.17 * s, 0.06, 0.41, H); return e; });
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.055, 40), M.blush); b.rotation.y = 0.55 * s; at(b, 0.27 * s, -0.06, 0.395, H); }
  const ears = [-1, 1].map((s) => {
    const g = new THREE.Group(); at(g, 0.27 * s, 0.27, -0.02, H); g.rotation.z = -0.32 * s; g.userData.s = s;
    const o = straightCone(0.17, 0.38, M.fur); o.scale.z = 0.55; g.add(o);
    const i = straightCone(0.105, 0.25, M.cream); i.scale.z = 0.4; i.position.set(0, 0.02, 0.045); g.add(i);
    const tip = straightCone(0.17 * 0.43 * 1.04, 0.38 * 0.43, M.sock); tip.scale.z = 0.58; tip.position.y = 0.38 * 0.57; g.add(tip);
    return g;
  });
  const sweat = at(ball(0.045, M.sweat, 1, 1.35, 1, 16), 0.42, 0.25, 0.22, H); sweat.visible = false;
  return { root, torso, head, H, arms, tail, eyes, ears, sweat, hop: 0 };
}

// ---------- Pip the owl ----------
function makeOwl(M) {
  const root = new THREE.Group(); root.name = "pip";
  const torso = new THREE.Group(); root.add(torso);
  at(ball(0.5, M.owl, 1.0, 1.0, 0.92), 0, 0.5, 0, torso);
  at(ball(0.34, M.belly, 1, 1.12, 0.55), 0, 0.44, 0.3, torso);
  for (const [x, y] of [[-0.09, 0.56], [0.09, 0.56], [0, 0.42], [-0.13, 0.32], [0.13, 0.32]]) { const v = arc(0.035, 0.009, M.owlDark); v.rotation.z = Math.PI; at(v, x, y, 0.485, torso); }
  for (const s of [-1, 1]) for (const d of [-0.05, 0, 0.05]) at(ball(0.045, M.beak, 1, 0.7, 1.4, 12), 0.15 * s + d, 0.03, 0.4, root);
  const wings = [-1, 1].map((s) => {
    const g = new THREE.Group(); at(g, 0.47 * s, 0.72, 0, root);
    const w = ball(0.24, M.owlDark, 0.42, 1, 0.75); w.position.y = -0.2; g.add(w);
    return g;
  });
  const head = new THREE.Group(); at(head, 0, 0.92, 0, root);
  const H = new THREE.Group(); H.position.y = 0.3; head.add(H);
  at(ball(0.47, M.owl, 1.15, 0.9, 0.95), 0, 0, 0, H);
  // the facial disc: two pale feathered bowls with a darker rim, meeting at the beak in a heart shape
  for (const s of [-1, 1]) {
    at(ball(0.215, M.face, 1, 1.08, 0.27), 0.165 * s, -0.02, 0.375, H);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.017, 14, 80, Math.PI * 1.35), M.owlDark);
    rim.rotation.z = s > 0 ? -0.675 * Math.PI : 0.325 * Math.PI; rim.scale.y = 1.08; at(rim, 0.165 * s, -0.02, 0.36, H);
  }
  // big forward-facing eyes: golden irises, round black pupils
  const owlIris = irisTex("#fff07a", "#f2a91c", "round");
  const eyes = [-1, 1].map((s) => {
    const g = new THREE.Group(); at(g, 0.165 * s, 0.0, 0.405, H);
    const e = realEye(M, 0.088, owlIris); g.add(e.g);
    at(ball(0.094, M.owl, 1.04, 0.36, 0.5), 0, 0.096, 0.03, g);                                   // an owl's upper lid
    return { ...e, box: g };
  });
  // bristly feathers above a little horn beak
    at(ball(0.038, M.face, 1, 1.5, 0.5), 0, 0.02, 0.44, H);                                       // bristly feathers above the beak
  const beak = cone(0.042, 0.11, M.horn); beak.scale.z = 0.8; beak.rotation.x = Math.PI - 0.12; at(beak, 0, -0.035, 0.47, H);
  // ear tufts: three feathers each
  for (const s of [-1, 1]) [[0.09, 0.27], [0.075, 0.2]].forEach(([r, h], j) => {
    const t = cone(r, h, M.owlDark, 10); t.scale.z = 0.45; t.rotation.z = -(0.4 + 0.22 * j) * s; at(t, (0.28 + 0.05 * j) * s, 0.26 - 0.03 * j, -0.02 - 0.03 * j, H);
  });
  return { root, torso, head, H, wings, eyes, hop: 0 };
}

function makeMagnifier(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 20, 80), M.gold));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.12, 64), M.glass));
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.22, 24), M.wood); h.position.y = -0.24; g.add(h);
  return g;
}

function makeLaptop(M) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 0.38), M.laptop); base.position.y = 0.0175; g.add(base);
  const lid = new THREE.Group(); lid.position.set(0, 0.035, -0.19); lid.rotation.x = -0.28; g.add(lid);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.37, 0.022), M.laptop); panel.position.y = 0.185; lid.add(panel);
  // a sticker on the back: a tiny sheep (Mochi), the crew's boss
  const sticker = canvasTex(128, 128, (c) => {
    c.fillStyle = "#ffffff"; for (const [x, y, r] of [[64, 40, 26], [38, 56, 24], [90, 56, 24], [44, 84, 24], [84, 84, 24], [64, 92, 24], [64, 64, 30]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.fillStyle = "#f9e1d1"; c.beginPath(); c.ellipse(64, 70, 22, 19, 0, 0, TAU); c.fill();
    c.fillStyle = "#2a1d18"; for (const x of [56, 72]) { c.beginPath(); c.arc(x, 68, 3.6, 0, TAU); c.fill(); }
    c.fillStyle = "#ff9fb0"; for (const x of [48, 80]) { c.beginPath(); c.arc(x, 76, 4, 0, TAU); c.fill(); }
  });
  const st = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshBasicMaterial({ map: sticker, transparent: true }));
  st.rotation.y = Math.PI; st.position.set(0, 0.2, -0.0125); lid.add(st);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.33), new THREE.MeshBasicMaterial({ color: 0x1e1b2c }));
  screen.position.set(0, 0.185, 0.0115); lid.add(screen);
  return { g, lid };
}

function makeEasel(M, cardTex) {
  const easel = new THREE.Group();
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.78, 8), M.wood); leg.position.set(0.2 * s, 0.37, 0); leg.rotation.z = 0.12 * s; easel.add(leg); }
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.76, 8), M.wood); back.position.set(0, 0.36, -0.16); back.rotation.x = -0.4; easel.add(back);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 0.07), M.wood); ledge.position.set(0, 0.27, 0.04); easel.add(ledge);
  const card = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.025), M.kraft); card.add(frame);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), new THREE.MeshBasicMaterial({ map: cardTex, toneMapped: false })); paper.position.z = 0.0135; card.add(paper);
  return { easel, card };
}

function blobShadow(tex, w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.002; m.renderOrder = -1; return m;
}

// little floating sprites: code symbols while Kit types, sparkles on a pass, a heart when poked
function spritePool(scene, n) {
  const pool = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); s.visible = false; scene.add(s); pool.push({ s, t0: 0, life: 1, v: new THREE.Vector3(), base: 1 }); }
  return pool;
}
const glyphCache = new Map();
function glyph(text, color) {
  const k = text + color; if (glyphCache.has(k)) return glyphCache.get(k);
  const t = canvasTex(128, 64, (c, w, h) => { c.font = "700 40px ui-monospace, Menlo, Consolas, monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.lineWidth = 7; c.strokeStyle = "rgba(255,255,255,.95)"; c.strokeText(text, w / 2, h / 2 + 2); c.fillStyle = color; c.fillText(text, w / 2, h / 2 + 2); });
  glyphCache.set(k, t); return t;
}

export function mountCrew3D(panel, host) {
  let renderer;
  try {
    const cv = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (_) { return null; }
  const R = renderer;
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 1.0;
  R.setClearColor(0x000000, 0);
  const cv = R.domElement; cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "display:block;width:100%;height:100%;touch-action:manipulation;cursor:pointer";
  host.appendChild(cv);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; pm.dispose();
  const key = new THREE.DirectionalLight(0xfff1e2, 2.4); key.position.set(-2.2, 4, 4.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.7); rim.position.set(2.6, 2.6, -3.5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff8f0, 0xe7d6cf, 0.55));
  const glow = new THREE.PointLight(0x9fe6ff, 0, 1.4, 2); scene.add(glow);   // the laptop screen, lighting Kit's face

  const camera = new THREE.PerspectiveCamera(26, 2.6, 0.1, 40);
  const M = materials();
  const shadowTex = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(70,45,30,.38)"); g.addColorStop(0.55, "rgba(70,45,30,.16)"); g.addColorStop(1, "rgba(70,45,30,0)"); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });

  // the picture card: Kit's render, then Pip's stamp
  const cardCanvas = document.createElement("canvas"); cardCanvas.width = cardCanvas.height = 256;
  const cardTex = new THREE.CanvasTexture(cardCanvas); cardTex.colorSpace = THREE.SRGBColorSpace;
  let cardImg = null, cardNote = "?", cardStamp = "";
  function paintCard() {
    const c = cardCanvas.getContext("2d"); c.fillStyle = "#ffffff"; c.fillRect(0, 0, 256, 256);
    if (cardImg && cardImg.complete && cardImg.naturalWidth) {
      const k = Math.min(232 / cardImg.naturalWidth, 232 / cardImg.naturalHeight), w = cardImg.naturalWidth * k, h = cardImg.naturalHeight * k;
      c.drawImage(cardImg, (256 - w) / 2, (256 - h) / 2, w, h);
    } else {
      c.fillStyle = "#c9c0d6"; c.font = "700 110px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(cardNote, 128, 134);
    }
    if (cardStamp) {
      const ok = cardStamp === "pass"; c.save(); c.translate(196, 58); c.rotate(-0.2);
      c.lineWidth = 7; c.strokeStyle = ok ? "#2f9e5b" : "#d4573d"; c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.stroke();
      c.lineWidth = 12; c.lineCap = "round"; c.beginPath();
      if (ok) { c.moveTo(-20, 2); c.lineTo(-5, 18); c.lineTo(22, -16); } else { c.moveTo(-16, -16); c.lineTo(16, 16); c.moveTo(16, -16); c.lineTo(-16, 16); }
      c.stroke(); c.restore();
    }
    cardTex.needsUpdate = true;
  }
  paintCard();

  const fox = makeFox(M), owl = makeOwl(M), lap = makeLaptop(M), mag = makeMagnifier(M), { easel, card } = makeEasel(M, cardTex);
  fox.root.position.set(-1.32, 0, -0.08); fox.root.rotation.y = 0.22; scene.add(fox.root);
  lap.g.position.set(-1.12, 0, 0.6); lap.g.rotation.y = Math.PI + 0.22; scene.add(lap.g);
  owl.root.position.set(1.32, 0, -0.04); owl.root.rotation.y = -0.3; scene.add(owl.root);
  easel.position.set(0.18, 0, 0.12); easel.rotation.y = 0.28; scene.add(easel);
  const CARD_HOME = new THREE.Vector3(0, 0.56, 0.06); easel.add(card); card.position.copy(CARD_HOME); card.rotation.x = -0.12;
  scene.add(mag);
  for (const [x, z, w, d] of [[-1.3, 0, 1.25, 1.0], [-1.12, 0.6, 0.9, 0.6], [1.32, 0, 1.25, 1.0], [0.18, 0.12, 0.9, 0.6]]) { const b = blobShadow(shadowTex, w, d); b.position.x = x; b.position.z = z; scene.add(b); }
  const sprites = spritePool(scene, 18);
  function emit(tex, pos, { v = [0, 0.35, 0], life = 1.4, size = 0.16, spread = 0.12 } = {}) {
    const p = sprites.find((q) => !q.s.visible) || sprites[0];
    p.s.material.map = tex; p.s.material.needsUpdate = true; p.s.visible = true;
    p.s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y, pos.z + (Math.random() - 0.5) * spread * 0.5);
    p.v.set(v[0] + (Math.random() - 0.5) * 0.12, v[1], v[2]); p.t0 = clock; p.life = life; p.base = size;
  }

  // ---- following the panel ----
  const S = { phase: "", since: 0, verdict: "", vSince: 0, blink: [2, 3.1], nextGlyph: 0, flight: null, swivel: 9, zd: false };
  let clock = 0, photoSrc = "";
  const photoEl = () => panel.querySelector(".crew-photo img");
  function readPhoto() {
    const img = photoEl(), src = img ? img.getAttribute("src") : "";
    const span = panel.querySelector(".crew-photo span:not(.crew-stamp)"); cardNote = span && /move/i.test(span.textContent) ? "♪" : "?";
    if (src === photoSrc) { paintCard(); return; }
    photoSrc = src;
    if (!src) { cardImg = null; paintCard(); return; }
    const im = new Image(); im.decoding = "async";
    im.onload = () => { if (photoSrc !== src) return; cardImg = im; paintCard(); S.flight = { t0: clock }; };
    im.src = src;
  }
  const mo = new MutationObserver(() => readPhoto());
  const ph = panel.querySelector(".crew-photo"); if (ph) mo.observe(ph, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  readPhoto();

  // a poke makes them hop
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  cv.addEventListener("pointerdown", (e) => {
    const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([fox.root, owl.root], true)[0]; if (!hit) return;
    let o = hit.object; while (o && o !== fox.root && o !== owl.root) o = o.parent;
    const who = o === fox.root ? fox : owl; who.hop = clock; who.poked = clock;
    emit(glyph("♥", "#ff74a6"), new THREE.Vector3(who.root.position.x, 1.85, who.root.position.z + 0.2), { v: [0, 0.3, 0], life: 1.2, size: 0.2, spread: 0.05 });
  });

  // ---- sizing: both always in view, phone to desktop ----
  function fit() {
    const w = host.clientWidth || 600, h = host.clientHeight || 220; R.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), needH = 1.08, needW = 2.05;
    const d = Math.max(needH / t, needW / (t * camera.aspect)) + 0.4;
    camera.position.set(0, 1.25, d); camera.lookAt(0, 0.86, 0); camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(fit); ro.observe(host); fit();
  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es[0] ? es[0].isIntersecting : true; }); io.observe(host);
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  // ---- the animation ----
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0), q = new THREE.Quaternion();
  function point(limb, parent, targetLocal, k, dt) {
    tmpV.copy(targetLocal).sub(limb.position).normalize();
    q.setFromUnitVectors(DOWN, tmpV); limb.quaternion.slerp(q, 1 - Math.exp(-k * dt));
  }
  function blinkStep(e, slot, closed) {
    let sy = 1;
    if (clock > S.blink[slot]) { const u = (clock - S.blink[slot]) / 0.14; sy = u < 1 ? Math.abs(1 - 2 * u) * 0.9 + 0.1 : 1; if (u >= 1) S.blink[slot] = clock + 2.2 + Math.random() * 3.2; }
    for (const x of e) { x.open.scale.y = (closed ? 0.0001 : sy) * (x.open.userData.sy || 1); }
  }
  const hopY = (who, n = 1) => { const u = (clock - who.hop) / 0.42; if (u < 0 || u >= n) return 0; return Math.sin((u % 1) * Math.PI) * 0.16; };

  const laptopTop = new THREE.Vector3(), eyeW = new THREE.Vector3(), cardW = new THREE.Vector3(), magRest = new THREE.Vector3(), magTo = new THREE.Vector3();
  const magQ = new THREE.Quaternion(), magRestQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, -0.3, 0.25));
  const look = new THREE.Object3D(); scene.add(look);

  function frame(dt) {
    clock += dt;
    const phase = panel.dataset.phase || "idle", verdict = panel.dataset.verdict || "";
    if (phase !== S.phase) { S.phase = phase; S.since = clock; }
    if (verdict !== S.verdict) {
      S.verdict = verdict; S.vSince = clock; cardStamp = verdict; paintCard();
      if (verdict === "pass") { owl.hop = clock; fox.hop = clock + 0.15; S.party = clock; }
    }
    const inPhase = clock - S.since, inV = clock - S.vSince, k = calm.matches ? 0.35 : 1;
    const testing = phase === "render" || phase === "test" || phase === "critique";
    const busy = ["plan", "write", "wrote", "fix"].includes(phase) && !verdict;
    if (Math.floor(clock) !== Math.floor(clock - dt)) S.zd = document.documentElement.dataset.mode === "zeroday";
    rim.color.setHex(S.zd ? 0x39ff7a : 0xdfe8ff); rim.intensity = S.zd ? 2.6 : 1.7;

    // --- Kit ---
    const F = fox;
    F.torso.scale.set(1 - 0.008 * Math.sin(clock * 2.2), 1 + 0.018 * Math.sin(clock * 2.2), 1);
    let yaw = 0.12 * Math.sin(clock * 0.45), pitch = 0.04, roll = 0.06 * Math.sin(clock * 0.7);
    let armT = [new THREE.Vector3(-0.42, 0.22, 0.18), new THREE.Vector3(0.42, 0.22, 0.18)], earDroop = 0, happy = false;
    if (phase === "idle" && (clock % 10) > 7.5) yaw = 0.75;                                // a look at Pip now and then
    if (phase === "plan") { roll = 0.2; pitch = -0.12; yaw = 0.1 + 0.05 * Math.sin(clock * 1.3); armT[1] = new THREE.Vector3(0.12, 0.95, 0.42); }   // paw on chin, thinking
    if (phase === "write" || (phase === "fix" && inPhase > 1.4)) {
      pitch = 0.24 + 0.03 * Math.sin(clock * 9) * k; yaw = 0.0; roll = 0.04 * Math.sin(clock * 3.5);
      const tap = (o) => Math.max(0, Math.sin(clock * 15 + o)) * 0.07 * k;
      armT = [new THREE.Vector3(-0.13, 0.1 + tap(0), 0.62), new THREE.Vector3(0.13, 0.1 + tap(Math.PI), 0.62)];
      if (clock > S.nextGlyph) { S.nextGlyph = clock + 0.32 + Math.random() * 0.25; laptopTop.set(0.62, 1.0, 0.3); F.root.localToWorld(laptopTop);   // beside his head, drifting up
        const g = ["{ }", "</>", ";", "( )", "=>", "+", "[ ]", "#"][Math.floor(Math.random() * 8)];
        emit(glyph(g, S.zd ? "#1aa64a" : (Math.random() < 0.5 ? "#4ea36d" : "#e8744f")), laptopTop, { v: [0, 0.32, 0.05], life: 1.5, size: 0.17, spread: 0.3 }); }
    }
    if (phase === "wrote" || (testing && !verdict)) { yaw = 0.8; pitch = 0; roll = 0.1 * Math.sin(clock * 1.8);
      if (phase === "wrote" && inPhase < 1.6) armT[1] = new THREE.Vector3(0.5, 1.0 + 0.08 * Math.sin(clock * 12), 0.25); }   // "your turn, Pip!"
    if (phase === "fix" && inPhase <= 1.4) { yaw = 0.8; pitch = 0.1 + 0.14 * Math.sin(inPhase * 9) * k; }   // nodding: "on it!"
    if (verdict === "pass") { happy = inV < 3.5 || phase === "done"; yaw = 0.5; pitch = -0.08;
      if (inV < 2.4) armT = [new THREE.Vector3(-0.38, 1.25 + 0.08 * Math.sin(clock * 10), 0.15), new THREE.Vector3(0.38, 1.25 + 0.08 * Math.sin(clock * 10 + 1), 0.15)]; }
    if (verdict === "fail" && phase !== "write") { earDroop = 1; pitch = 0.16; yaw = 0.6; }
    if (phase === "done" && verdict !== "fail" && inPhase < 3.5) armT[1] = new THREE.Vector3(0.5, 1.05 + 0.1 * Math.sin(clock * 11), 0.3);   // wave bye
    if (F.poked && clock - F.poked < 1.1) { happy = true; yaw = 0; pitch = -0.1; }
    F.head.rotation.y = damp(F.head.rotation.y, yaw, 6, dt); F.head.rotation.x = damp(F.head.rotation.x, pitch, 6, dt); F.head.rotation.z = damp(F.head.rotation.z, roll, 5, dt);
    F.arms.forEach((a, i) => point(a, F.root, armT[i], 9, dt));
    F.ears.forEach((e, i) => { const s = e.userData.s, tw = (clock % 4.3) < 0.18 ? 0.15 : 0; e.rotation.z = damp(e.rotation.z, (-0.32 - 0.65 * earDroop - tw) * s, 7, dt); e.rotation.x = damp(e.rotation.x, -0.35 * earDroop, 7, dt); });
    const wag = phase === "write" ? [3.4, 0.2] : verdict === "pass" && inV < 3 ? [9, 0.42] : earDroop ? [1, 0.05] : [1.7, 0.26];
    F.tail.rotation.y = Math.sin(clock * wag[0]) * wag[1] * k; F.tail.rotation.z = 0.08 * Math.sin(clock * wag[0] * 0.5);
    F.sweat.visible = verdict === "fail" && phase !== "write" && inV < 6; if (F.sweat.visible) F.sweat.position.y = 0.25 - ((clock * 0.25) % 0.12);
    F.eyes.forEach((e) => { e.happy.visible = happy; });
    blinkStep(F.eyes, 0, happy);
    F.root.position.y = hopY(F, verdict === "pass" && inV < 1.5 ? 2 : 1) * k;
    // the screen glows on his face while he works
    lap.lid.getWorldPosition(tmpW); glow.position.set(tmpW.x - 0.08, 0.55, tmpW.z - 0.25);
    glow.intensity = damp(glow.intensity, phase === "write" || phase === "fix" ? 1.6 + 0.4 * Math.sin(clock * 23) : busy || testing ? 0.6 : 0.25, 4, dt);

    // --- the card: a new picture flies from Kit's laptop to Pip's easel ---
    if (S.flight) {
      const u = clamp((clock - S.flight.t0) / 0.9, 0, 1), e = ease(u);
      lap.lid.getWorldPosition(laptopTop); laptopTop.y += 0.25; easel.worldToLocal(laptopTop);
      card.position.lerpVectors(laptopTop, CARD_HOME, e); card.position.y += Math.sin(Math.PI * e) * 0.55;
      card.scale.setScalar(0.35 + 0.65 * e); card.rotation.y = (1 - e) * TAU; card.rotation.x = -0.12;
      if (u >= 1) { S.flight = null; card.scale.setScalar(1); card.rotation.y = 0; }
    }

    // --- Pip ---
    const O = owl;
    O.torso.scale.set(1 - 0.01 * Math.sin(clock * 1.9 + 1), 1 + 0.02 * Math.sin(clock * 1.9 + 1), 1);
    let oy = 0.18 * Math.sin(clock * 0.5), op = 0, orr = 0.1 * Math.sin(clock * 0.8), shut = false, oh = false;
    let wingT = [new THREE.Vector3(-0.6, 0.32, 0.12), new THREE.Vector3(0.6, 0.32, 0.12)], peer = false;
    if (phase === "idle") { const c = clock % 13; if (c > 10.5 && c < 12.3) oy = 1.25 * Math.sin((c - 10.5) / 1.8 * Math.PI) * k; }   // an owl's big head swivel
    if (busy && phase !== "fix") { shut = true; oy = 0.85; orr = 0.15; wingT[0] = new THREE.Vector3(-0.3, 1.05, 0.55); }   // no peeking while Kit writes
    if (testing && !verdict) { peer = true; oy = -0.55; orr = 0.16 * Math.sin(clock * 2.2) * k; op = 0.08; }
    if (testing && !verdict && phase === "critique") { wingT[1] = new THREE.Vector3(0.5, 0.95, 0.4); }
    if (verdict === "pass") { oh = inV < 3.5 || phase === "done"; oy = -0.2; op = -0.1;
      if (inV < 1.6) { const f = Math.sin(clock * 16) * 0.25; wingT = [new THREE.Vector3(-0.85, 0.85 + f, 0.1), new THREE.Vector3(0.85, 0.85 - f, 0.1)]; } }
    if (verdict === "fail") { const d = Math.max(0, 1 - inV / 1.2); oy = -0.4 + 0.45 * Math.sin(inV * 15) * d * k; op = 0.05; peer = inV < 4 && phase !== "write" && phase !== "fix"; }
    if (phase === "fix") { oy = -0.7; wingT[0] = new THREE.Vector3(-0.85, 0.75, 0.35); }   // pointing at what to fix
    if (phase === "done" && verdict !== "fail" && inPhase < 3.5) wingT[1] = new THREE.Vector3(0.75, 1.0 + 0.12 * Math.sin(clock * 10), 0.25);
    if (O.poked && clock - O.poked < 1.1) { oh = true; oy = 0; op = -0.1; }
    O.head.rotation.y = damp(O.head.rotation.y, oy, 5, dt); O.head.rotation.x = damp(O.head.rotation.x, op, 5, dt); O.head.rotation.z = damp(O.head.rotation.z, orr, 5, dt);
    O.eyes.forEach((e) => { e.happy.visible = oh; e.shut.visible = shut && !oh; });
    blinkStep(O.eyes, 1, oh || shut);
    O.root.position.y = hopY(O, verdict === "pass" && inV < 1.5 ? 2 : 1) * k;
    // the magnifying glass: at his side, or up between his eye and the picture
    O.root.updateMatrixWorld(); easel.updateMatrixWorld();
    magRest.set(-0.62, 0.42, 0.32); O.root.localToWorld(magRest);
    if (peer) {
      O.eyes[0].box.getWorldPosition(eyeW); card.getWorldPosition(cardW);
      magTo.lerpVectors(cardW, eyeW, 0.4); magTo.z += 0.16; magTo.x += 0.03 * Math.sin(clock * 2.2) * k; magTo.y += 0.03 * Math.cos(clock * 1.7) * k;
      look.position.copy(magTo); look.lookAt(eyeW); magQ.copy(look.quaternion);
    } else { magTo.copy(magRest); magQ.copy(O.root.quaternion).multiply(magRestQ); }
    mag.position.lerp(magTo, 1 - Math.exp(-6 * dt)); mag.quaternion.slerp(magQ, 1 - Math.exp(-6 * dt));
    tmpW.set(0, -0.3, 0).applyQuaternion(mag.quaternion).add(mag.position); O.root.worldToLocal(tmpW);
    wingT[0] = (busy && phase !== "fix") || phase === "fix" ? wingT[0] : tmpW.clone();                 // his right wing holds the glass
    O.wings.forEach((w, i) => point(w, O.root, wingT[i], 8, dt));

    // sparkles on a pass
    if (S.party && clock - S.party < 1.0 && Math.random() < 0.5) { card.getWorldPosition(cardW); cardW.y += 0.15; emit(glyph("✦", Math.random() < 0.5 ? "#f2a33c" : "#2f9e5b"), cardW, { v: [(Math.random() - 0.5) * 0.9, 0.5, 0.1], life: 1.1, size: 0.14, spread: 0.4 }); }
    for (const p of sprites) {
      if (!p.s.visible) continue;
      const u = (clock - p.t0) / p.life; if (u >= 1) { p.s.visible = false; continue; }
      p.s.position.addScaledVector(p.v, dt); p.s.material.opacity = u < 0.15 ? u / 0.15 : 1 - Math.pow((u - 0.15) / 0.85, 2);
      const sz = p.base * (0.8 + 0.3 * Math.min(1, u * 4)); p.s.scale.set(sz * 2, sz, 1);
    }
  }

  let last = performance.now(), raf = 0, dead = false;
  function loop(now) {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) { last = now; return; }
    if (now - last < 24) return;                     // ~40 fps is plenty, and kind to the M5
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    frame(dt); R.render(scene, camera);
  }
  raf = requestAnimationFrame(loop);
  const api = {
    fox, owl, scene, camera, renderer: R,
    step(sec, n = 1) { for (let i = 0; i < n; i++) frame(sec); R.render(scene, camera); },   // tests
    dispose() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect(); R.dispose(); cv.remove(); },
  };
  window.__crew3d = api;
  return api;
}
