/* Props as code: a recipe (shared/craft.js) becomes a three.js group made of simple, soft parts.
 * The group's origin is the prop's grip (hand props), the top of the head (head props) or the ground (companions),
 * so the body can mount it without knowing what it is. Used by Mochi (src/mochi.js) and the crafter's renderer
 * (src/render.js), so what the crafter checks is exactly what he'll hold.
 *
 * Every shape is built like a soft vinyl toy, never like a low-poly placeholder: cylinders, discs and cones are
 * lathed from profiles with rounded rims and tips, boxes have rounded edges, open domes get a rolled rim, arcs get
 * round end caps, flat shapes (star, heart, leaf) are puffy with smooth normals, and curved surfaces get enough
 * segments that no facets show at the size he holds them. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const DEG = Math.PI / 180;
const WHITE = new THREE.Color(0xffffff);
const RADIAL = 64;   // segments around anything round
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------- lathed shapes, built at their real size so rounded edges stay round whatever the proportions */
function arc(pts, cx, cy, r, a0, a1, n) {   // points on a circle from angle a0 to a1 (radians), excluding the start
  for (let i = 1; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push(new THREE.Vector2(Math.max(0, cx + r * Math.cos(a)), cy + r * Math.sin(a))); }
}
function lathe(pts, w, d) {
  const g = new THREE.LatheGeometry(pts, RADIAL);
  if (Math.abs(d - w) > 1e-6) g.scale(1, 1, d / w);   // an oval cross-section: squash depth only
  return g;
}
// a cylinder (or a tapered one) with softly rounded rims: radius rb at the bottom, rt at the top, height h
function roundedCylinder(w, h, d, taper = 1) {
  const rb = w / 2, rt = Math.max(0.0005, (w / 2) * taper);
  const f = clamp(0.18 * Math.min(w, h), 0.003, 0.45 * Math.min(rb, h / 2));
  const fb = Math.min(f, 0.45 * rb), ft = Math.min(f, 0.45 * rt);
  const pts = [new THREE.Vector2(0, -h / 2)];
  // the side's outward normal angle, so both fillets meet it tangentially
  const ths = Math.atan2(-(rt - ft - (rb - fb)), h - fb - ft);
  pts.push(new THREE.Vector2(rb - fb, -h / 2));
  arc(pts, rb - fb, -h / 2 + fb, fb, -Math.PI / 2, ths, 6);
  pts.push(new THREE.Vector2(rt - ft + ft * Math.cos(ths), h / 2 - ft + ft * Math.sin(ths)));
  arc(pts, rt - ft, h / 2 - ft, ft, ths, Math.PI / 2, 6);
  pts.push(new THREE.Vector2(0, h / 2));
  return lathe(dedupe(pts), w, d);
}
// an open tube (a crown band, a cup, a vest, a collar): a sturdy wall with rounded lips top and bottom
function hollowCylinder(w, h, d, taper = 1) {
  const rb = w / 2, rt = Math.max(0.004, (w / 2) * taper);
  const lip = clamp(0.035 * Math.min(rb, rt) + 0.002, 0.004, Math.min(0.04, h / 4));   // the wall is two lips thick
  const pts = [], cb = [rb - lip, -h / 2 + lip], ct = [rt - lip, h / 2 - lip];
  for (let i = 0; i <= 10; i++) { const a = Math.PI + (Math.PI * i) / 10; pts.push(new THREE.Vector2(cb[0] + lip * Math.cos(a), cb[1] + lip * Math.sin(a))); }   // bottom lip, inside → outside
  for (let i = 0; i <= 10; i++) { const a = (Math.PI * i) / 10; pts.push(new THREE.Vector2(ct[0] + lip * Math.cos(a), ct[1] + lip * Math.sin(a))); }             // up the outside, over the top lip
  pts.push(pts[0].clone());                                                                                                                                         // down the inside
  // a pattern goes by height (Nov 4: the lathe spreads v along the outline, and the outside wall of a tube is one
  // short step of it, so a striped jumper or a dotted skirt came out one plain colour)
  const g = lathe(dedupe(pts), w, d), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, clamp((pos.getY(i) + h / 2) / h, 0, 1));
  uv.needsUpdate = true;
  return g;
}
// a cone with a rounded rim and a softly rounded tip
function roundedCone(w, h, d) {
  const r = w / 2, alpha = Math.atan2(r, h);                   // half-angle at the tip
  const rho = clamp(0.07 * Math.min(w, h), 0.003, 0.3 * r);    // tip roundness
  const fb = clamp(0.12 * Math.min(w, h), 0.003, 0.3 * Math.min(r, h / 2));
  const yc = h / 2 - rho / Math.sin(alpha);                    // the tip ball's centre, on the axis
  const ths = Math.atan2(r, h);                                // the side's outward normal angle (above horizontal)
  const L = Math.hypot(r, h), cbx = r - (fb * (L + r)) / h, cby = -h / 2 + fb;   // the rim fillet's centre: fb from the base and the side
  const pts = [new THREE.Vector2(0, -h / 2), new THREE.Vector2(cbx, -h / 2)];
  arc(pts, cbx, cby, fb, -Math.PI / 2, ths, 6);
  arc(pts, 0, yc, rho, ths, Math.PI / 2, 8);
  return lathe(dedupe(pts), w, d);
}
function dedupe(pts) { return pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-6); }

/* ---------- puffy flat shapes */
function extruded(shape, w, h, d, curveSegments = 40, bevelSize = 0.085) {   // sized to w × h, d deep, with a deep rounded bevel and smooth shading
  const g0 = new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.3, bevelSize, bevelSegments: 8, curveSegments });
  g0.computeBoundingBox();
  const b = g0.boundingBox, sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
  g0.translate(-(b.min.x + sx / 2), -(b.min.y + sy / 2), -(b.min.z + sz / 2));
  g0.scale(w / sx, h / sy, d / sz);
  const g = toCreasedNormals(g0, 75 * DEG);   // smooth across the bevel, no facets
  g0.dispose();
  return g;
}
function roundedPolygon(points, round) {   // a closed outline whose corners are rounded with quadratic curves
  const s = new THREE.Shape(), n = points.length, at = (i) => points[(i + n) % n];
  const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  for (let i = 0; i < n; i++) {
    const p = at(i), k = round(i), a = lerp2(p, at(i - 1), k), b = lerp2(p, at(i + 1), k);
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}
const STAR = (() => {
  const pts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.23 : 0.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return roundedPolygon(pts, (i) => (i % 2 ? 0.16 : 0.22));   // soft points, soft notches
})();
const HEART = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.45); s.bezierCurveTo(-0.12, -0.32, -0.5, -0.1, -0.5, 0.15); s.bezierCurveTo(-0.5, 0.43, -0.16, 0.52, 0, 0.27);
  s.bezierCurveTo(0.16, 0.52, 0.5, 0.43, 0.5, 0.15); s.bezierCurveTo(0.5, -0.1, 0.12, -0.32, 0, -0.45); return s;
})();
const LEAF = (() => { const s = new THREE.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(0.42, -0.25, 0.38, 0.25, 0, 0.5); s.bezierCurveTo(-0.38, 0.25, -0.42, -0.25, 0, -0.5); return s; })();

// Nov 4: more flat shapes, drawn in a unit box like the star and the heart
const CLOUD = (() => {
  const s = new THREE.Shape(); s.moveTo(-0.38, -0.22);
  s.bezierCurveTo(-0.56, -0.22, -0.56, 0.06, -0.36, 0.06); s.bezierCurveTo(-0.38, 0.28, -0.12, 0.34, -0.04, 0.2);
  s.bezierCurveTo(0.02, 0.44, 0.34, 0.4, 0.3, 0.14); s.bezierCurveTo(0.54, 0.16, 0.56, -0.22, 0.36, -0.22); s.closePath(); return s;
})();
const MOON = (() => {   // a fat crescent: the outer circle's left side, then the inner one's, with rounded horn tips
  const s = new THREE.Shape(); s.absarc(0, 0, 0.5, Math.PI * 0.3, Math.PI * 1.7, false);
  s.quadraticCurveTo(0.36, -0.42, 0.33, -0.3); s.absarc(0.3, 0, 0.36, Math.PI * 1.58, Math.PI * 0.42, true); s.quadraticCurveTo(0.36, 0.42, 0.29, 0.4); s.closePath(); return s;
})();
const BOLT = roundedPolygon([[0.08, 0.5], [-0.3, -0.02], [-0.02, -0.02], [-0.12, -0.5], [0.3, 0.06], [0.03, 0.06]], () => 0.12);
const DROP = (() => { const s = new THREE.Shape(); s.moveTo(0, 0.5); s.bezierCurveTo(0.12, 0.28, 0.36, 0.02, 0.36, -0.16); s.bezierCurveTo(0.36, -0.38, 0.18, -0.5, 0, -0.5); s.bezierCurveTo(-0.18, -0.5, -0.36, -0.38, -0.36, -0.16); s.bezierCurveTo(-0.36, 0.02, -0.12, 0.28, 0, 0.5); return s; })();
const FISH = (() => {   // a long oval body, a forked tail
  const s = new THREE.Shape(); s.moveTo(0.5, 0.02);
  s.bezierCurveTo(0.44, 0.24, 0.12, 0.3, -0.06, 0.16); s.bezierCurveTo(-0.14, 0.1, -0.2, 0.06, -0.26, 0.02);
  s.lineTo(-0.48, 0.24); s.quadraticCurveTo(-0.4, 0.02, -0.5, -0.22); s.lineTo(-0.26, -0.03);
  s.bezierCurveTo(-0.2, -0.07, -0.14, -0.11, -0.06, -0.16); s.bezierCurveTo(0.12, -0.3, 0.44, -0.24, 0.5, 0.02); return s;
})();
const PAW = (() => {
  const pad = new THREE.Shape(); pad.moveTo(0, 0.04); pad.bezierCurveTo(0.2, 0.04, 0.3, -0.18, 0.26, -0.3); pad.bezierCurveTo(0.22, -0.44, -0.22, -0.44, -0.26, -0.3); pad.bezierCurveTo(-0.3, -0.18, -0.2, 0.04, 0, 0.04);
  const toe = (x, y, r) => { const t = new THREE.Shape(); t.absellipse(x, y, r, r * 1.25, 0, Math.PI * 2, false, 0); return t; };
  return [pad, toe(-0.34, 0.1, 0.1), toe(-0.12, 0.32, 0.11), toe(0.12, 0.32, 0.11), toe(0.34, 0.1, 0.1)];
})();
const ARROW = roundedPolygon([[0.5, 0], [0.05, 0.42], [0.05, 0.16], [-0.5, 0.16], [-0.5, -0.16], [0.05, -0.16], [0.05, -0.42]], () => 0.14);
const NOTE = (() => {   // one outline (a head, a stem, a flag), so it puffs up as one piece instead of three lumps
  const s = new THREE.Shape(); s.moveTo(0.06, -0.3);
  s.bezierCurveTo(0.06, -0.48, -0.36, -0.52, -0.36, -0.32); s.bezierCurveTo(-0.36, -0.16, -0.06, -0.12, -0.02, -0.18);
  s.lineTo(-0.02, 0.5); s.lineTo(0.06, 0.5); s.bezierCurveTo(0.12, 0.36, 0.38, 0.3, 0.3, 0.02); s.bezierCurveTo(0.28, 0.2, 0.16, 0.26, 0.06, 0.28); s.closePath(); return s;
})();
const BURST = (() => {   // a sun's ring of rays (Nov 4: a sun came out as a star badge): 12 long soft points round a filled middle
  const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.31 : 0.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return roundedPolygon(pts, (i) => (i % 2 ? 0.08 : 0.06));   // pointed rays (round ones read as petals: a flower)
})();
const WEDGE = roundedPolygon([[-0.5, -0.5], [0.5, -0.5], [0, 0.5]], (i) => (i === 2 ? 0.1 : 0.08));
function wedgeGeom(w, h, d) {   // a soft triangular block: a shallow bevel so it reads as a block, not a pillow
  const g0 = new THREE.ExtrudeGeometry(WEDGE, { depth: 1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 4, curveSegments: 10 });
  g0.computeBoundingBox();
  const b = g0.boundingBox, sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
  g0.translate(-(b.min.x + sx / 2), -(b.min.y + sy / 2), -(b.min.z + sz / 2)); g0.scale(w / sx, h / sy, d / sz);
  const g = toCreasedNormals(g0, 50 * DEG); g0.dispose(); return g;
}
function tubeGeom(p) {   // a bendy tube through its points (validated: a path inside its box, its thickness a share of the box)
  const [w, h, d] = p.size, path = (p.path || [[0, -0.5, 0], [0, 0.5, 0]]).map((f) => new THREE.Vector3(f[0] * w, f[1] * h, f[2] * d));
  const r = Math.max(0.005, ((p.thick || 0.1) * Math.max(w, h, d)) / 2);
  const curve = path.length === 2 ? new THREE.LineCurve3(path[0], path[1]) : new THREE.CatmullRomCurve3(path, false, "centripetal");
  const g = new THREE.TubeGeometry(curve, 48, r, 16, false);
  const ends = [curve.getPoint(0), curve.getPoint(1)].map((v) => { const sph = new THREE.SphereGeometry(r, 16, 12); sph.translate(v.x, v.y, v.z); return sph; });
  const out = mergeGeometries([g, ...ends]); g.dispose(); ends.forEach((e) => e.dispose());
  return out;
}

function withCaps(g, R, tube, arcRad) {   // round caps on the open ends of a part-ring
  const caps = [0, arcRad].map((a) => { const s = new THREE.SphereGeometry(tube, 24, 16); s.translate(R * Math.cos(a), R * Math.sin(a), 0); return s; });
  const out = mergeGeometries([g, ...caps]);
  g.dispose(); caps.forEach((c) => c.dispose());
  return out;
}

export function partGeometry(p) {
  const [w, h, d] = p.size;
  switch (p.shape) {
    case "box": {
      const q = clamp((p.round ?? 0.15) * 2, 0.25, 0.98);   // never razor-sharp: toys have soft edges
      return new RoundedBoxGeometry(w, h, d, 6, Math.max(0.002, Math.min(w, h, d) * 0.5 * q));
    }
    case "cylinder": return p.hollow ? hollowCylinder(w, h, d, p.taper ?? 1) : roundedCylinder(w, h, d, p.taper ?? 1);
    case "disc": return roundedCylinder(w, h, d, 1);
    case "coin": { const g = roundedCylinder(w, d, h, 1); g.rotateX(Math.PI / 2); return g; }   // standing up, facing the viewer
    case "cone": return roundedCone(w, h, d);
    case "capsule": {
      const r = Math.min(w, d) / 2;
      if (h <= 2 * r + 1e-3) { const g = new THREE.SphereGeometry(0.5, RADIAL, 40); g.scale(w, h, d); return g; }
      const g = new THREE.CapsuleGeometry(r, h - 2 * r, 16, RADIAL); g.scale(w / (2 * r), 1, d / (2 * r)); return g;
    }
    case "dome": {   // open underneath (a canopy, a cap): a smooth shell with a little rolled rim so it never looks paper-thin
      const shell = new THREE.SphereGeometry(0.5, RADIAL, 28, 0, Math.PI * 2, 0, Math.PI / 2);
      shell.translate(0, -0.25, 0); shell.scale(w, h * 2, d);
      const tube = clamp(0.014 * Math.max(w, d), 0.004, 0.035);
      const rim = new THREE.TorusGeometry(0.5, tube / Math.max(w, d), 12, RADIAL * 2);
      rim.rotateX(Math.PI / 2); rim.scale(w, Math.max(w, d), d); rim.translate(0, -h / 2, 0);
      const g = mergeGeometries([shell, rim]); shell.dispose(); rim.dispose();
      return g;
    }
    case "torus": {
      const m = Math.min(w, h), tube = Math.min(d, m * 0.45) / 2, R = Math.max(tube * 1.05, (m - 2 * tube) / 2), arcDeg = p.arc ?? 360;
      let g = new THREE.TorusGeometry(R, tube, 24, 128, arcDeg * DEG);
      if (arcDeg < 359.5) g = withCaps(g, R, tube, arcDeg * DEG);
      g.scale(w / m, h / m, 1); return g;
    }
    case "star": return extruded(STAR, w, h, d, 14);
    case "heart": return extruded(HEART, w, h, d);
    case "leaf": return extruded(LEAF, w, h, d);
    case "wedge": return wedgeGeom(w, h, d);
    case "tube": return tubeGeom(p);
    case "cloud": return extruded(CLOUD, w, h, d);
    case "moon": return extruded(MOON, w, h, d);
    case "bolt": return extruded(BOLT, w, h, d, 12);
    case "drop": return extruded(DROP, w, h, d);
    case "fish": return extruded(FISH, w, h, d);
    case "paw": return extruded(PAW, w, h, d, 24);
    case "arrow": return extruded(ARROW, w, h, d, 12);
    case "note": return extruded(NOTE, w, h, d, 24);
    case "burst": return extruded(BURST, w, h, d, 6, 0.025);
    default: { const g = new THREE.SphereGeometry(0.5, RADIAL, 40); g.scale(w, h, d); return g; }
  }
}

let fuzz = null;   // a soft lumpy bump texture for "fluffy", shared
function fuzzTex() {
  if (fuzz || typeof document === "undefined") return fuzz;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1500; i++) {
    const x = r() * 256, y = r() * 256, rad = 2 + r() * 7, v = 90 + r() * 120, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${v},${v},${v},0.55)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  fuzz = new THREE.CanvasTexture(c); fuzz.wrapS = fuzz.wrapT = THREE.RepeatWrapping; fuzz.repeat.set(3, 3); fuzz.anisotropy = 4;
  return fuzz;
}
// Nov 4: patterns. A texture in the part's two colours, drawn once per (pattern, colours, direction) and shared.
// "stripes" go round a thing along its height (v), but across a ring or a bendy tube, which run along u.
const PATTERN_TEX = new Map();
function patternTex(kind, base, other, along) {
  if (typeof document === "undefined") return null;
  const key = `${kind}|${base}|${other}|${along}`;
  if (PATTERN_TEX.has(key)) return PATTERN_TEX.get(key);
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, N, N); g.fillStyle = other;
  const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  const bands = kind === "stripes" ? (along === "u" ? "u" : "v") : kind === "segments" ? (along === "u" ? "v" : "u") : null;
  if (bands === "v") for (let i = 0; i < 8; i += 2) g.fillRect(0, (i * N) / 8, N, N / 8);
  else if (bands === "u") for (let i = 0; i < 8; i += 2) g.fillRect((i * N) / 8, 0, N / 8, N);
  else if (kind === "dots") for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(((x + (y % 2) * 0.5 + 0.25) * N) / 4, ((y + 0.5) * N) / 4, N / 22, 0, Math.PI * 2); g.fill(); }
  else if (kind === "checks") for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { if ((x + y) % 2) g.fillRect((x * N) / 8, (y * N) / 8, N / 8, N / 8); }
  else if (kind === "stars") for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) star(((x + (y % 2) * 0.5 + 0.25) * N) / 4, ((y + 0.5) * N) / 4, N / 18);
  else if (kind === "zigzag") {   // a fat zigzag band round the middle, 6 teeth a repeat
    const T = 6, top = (i) => (i % 2 ? N * 0.6 : N * 0.3), band = N * 0.16;
    g.beginPath(); g.moveTo(0, top(0)); for (let i = 1; i <= T * 2; i++) g.lineTo((i * N) / (T * 2), top(i));
    for (let i = T * 2; i >= 0; i--) g.lineTo((i * N) / (T * 2), top(i) + band); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  PATTERN_TEX.set(key, t);
  return t;
}
// how often it repeats on each kind of shape (a sphere's u runs twice as far round as its v runs top to bottom)
const PATTERN_REPEAT = { sphere: [2, 1], dome: [2, 0.6], capsule: [2, 1], torus: [3, 1], tube: [2.5, 1], cylinder: [1.5, 1], disc: [1.5, 1], coin: [1.5, 1] };
// a big open tube he wears (a skirt, a jumper, a dress: Nov 4) is far longer round than it is tall, so at the usual
// repeat its dots came out as long smears: there it repeats by its own size, about one pattern cell per 0.27 each way
// (a whole number of times round, so there's no seam)
function sizedRepeat(p) {
  if (!p.size || Math.max(p.size[0], p.size[2]) < 0.9) return null;
  const [w, h, d] = p.size, step = (x) => Math.round(x * 100) / 100;
  if (p.shape === "cylinder" && p.hollow) {
    const round = Math.PI * ((w + d) / 2) * (1 + (p.taper ?? 1)) / 2;
    return [Math.max(1, Math.round(round / 1.1)), Math.max(0.25, step(h / 1.1))];
  }
  // a big dome (a dress's top, a jumper's): dots and stars the same size as on the skirt below (stripes and an
  // umbrella's segments keep the usual repeat)
  if (p.shape === "dome" && /^(dots|stars|checks)$/.test(p.pattern)) return [Math.max(2, Math.round((Math.PI * (w + d) / 2) / 1.1)), step(((Math.PI / 2) * ((w + d) / 4 + h) / 2) / 1.1)];
  return null;
}
export function partMaterial(material, color, pattern = null) {
  if (pattern && pattern.kind) {
    const m = partMaterial(material, "#ffffff"), t = patternTex(pattern.kind, color, pattern.color, pattern.along);
    if (!t) { m.color.set(color); return m; }
    const tex = t.clone(); tex.needsUpdate = true; const rep = pattern.repeat || PATTERN_REPEAT[pattern.shape] || [1, 1]; tex.repeat.set(rep[0], rep[1]);
    m.map = tex; m.userData.patternTex = tex;
    if (m.sheenColor) m.sheenColor.set(new THREE.Color(color).lerp(WHITE, 0.55));
    if (m.emissive && material === "glow") { m.emissive.set(color); m.emissiveMap = tex; }
    return m;
  }
  const c = new THREE.Color(color), soft = c.clone().lerp(WHITE, 0.55);
  const base = { color: c };
  switch (material) {
    case "cloth": return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.78, sheen: 1, sheenRoughness: 0.45, sheenColor: soft, side: THREE.DoubleSide });
    case "fluffy": return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.95, sheen: 1, sheenRoughness: 0.55, sheenColor: soft, bumpMap: fuzzTex(), bumpScale: 1.1 });
    case "metal": return new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.8, roughness: 0.24, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 1.25 });
    case "wood": return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.58, clearcoat: 0.25, clearcoatRoughness: 0.35 });
    case "glass": return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.04, transparent: true, opacity: 0.45, clearcoat: 1, specularIntensity: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 });
    case "rubber": return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.62, sheen: 0.25, sheenColor: soft });
    case "paper": return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.86, sheen: 0.2, sheenColor: soft, side: THREE.DoubleSide });
    case "glow": return new THREE.MeshPhysicalMaterial({ ...base, emissive: c, emissiveIntensity: 0.7, roughness: 0.35, clearcoat: 0.6 });
    case "candy": return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.3, sheenColor: soft, envMapIntensity: 1.15 });
    default: return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.32, envMapIntensity: 1.0 });   // plastic: soft-gloss vinyl
  }
}

// words on a prop (Nov 8, the "text" part: shared/craft.js): drawn on a canvas in his rounded toy font, with a soft
// outline in the opposite shade so they read on any colour, on a flat label at the front of the part's thin box
const lum = (hex) => { const n = parseInt(String(hex).replace("#", "").padEnd(6, "0").slice(0, 6), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
function textMesh(p) {
  const [w, h, d] = p.size, H = 128, W = Math.max(64, Math.min(1024, Math.round(H * (w / Math.max(0.005, h)))));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"), font = (px) => `800 ${px}px Fredoka, "Nunito Sans", "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif`;
  let px = 104; g.font = font(px);
  const m = g.measureText(p.text).width; if (m > W * 0.9) { px = Math.max(12, Math.floor(px * (W * 0.9) / m)); g.font = font(px); }
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = Math.max(3, px * 0.16); g.strokeStyle = lum(p.color) > 0.55 ? "rgba(40,30,60,0.85)" : "rgba(255,255,255,0.9)";
  g.strokeText(p.text, W / 2, H / 2 + px * 0.04); g.fillStyle = p.color; g.fillText(p.text, W / 2, H / 2 + px * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.userData.textTex = t;
  const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, 0, d / 2);
  return new THREE.Mesh(geo, mat);
}
/** Build a prop from a validated recipe. Returns a Group; group.userData = { recipe, muzzle (Vector3 or null) }. */
export function buildProp(recipe, { shadows = true } = {}) {
  const group = new THREE.Group(), mats = new Map();
  for (const p of recipe.parts || []) {
    if (p.shape === "text") {   // words on it (Nov 8)
      if (typeof document === "undefined" || !p.text) continue;
      const mesh = textMesh(p); mesh.position.set(p.at[0], p.at[1], p.at[2]);
      const r = p.rotate || [0, 0, 0]; mesh.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
      mesh.userData.label = String(p.label || "words").toLowerCase(); mesh.userData.part = p; mesh.renderOrder = 3;
      group.add(mesh); continue;
    }
    const pat = p.pattern ? { kind: p.pattern, color: p.pattern_color || "#fbf8f2", along: p.shape === "torus" || p.shape === "tube" ? "u" : "v", shape: p.shape, repeat: sizedRepeat(p) } : null;
    const key = `${p.material}|${p.color}${pat ? `|${pat.kind}|${pat.color}|${pat.shape}|${pat.repeat || ""}` : ""}`;
    if (!mats.has(key)) mats.set(key, partMaterial(p.material, p.color, pat));
    const mesh = new THREE.Mesh(partGeometry(p), mats.get(key));
    mesh.position.set(p.at[0], p.at[1], p.at[2]);
    const r = p.rotate || [0, 0, 0]; mesh.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
    mesh.castShadow = shadows; mesh.receiveShadow = shadows;
    if (p.material === "glass") mesh.renderOrder = 2;
    mesh.userData.label = String(p.label || "").toLowerCase(); mesh.userData.part = p;   // rides spin their wheels by label
    group.add(mesh);
  }
  group.userData = { recipe, muzzle: recipe.muzzle ? new THREE.Vector3(...recipe.muzzle) : null };
  group.name = `prop:${recipe.name}`;
  return group;
}
/** is it really on screen (it and everything it hangs from visible)? Raycasts hit hidden things too: the folded-away
 *  Santa hat, the bunny ears, the nightcap, the hood. */
export function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
export function disposeProp(group) {
  if (!group) return;
  const mats = new Set();
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) mats.add(o.material); });
  mats.forEach((m) => { if (m.userData && m.userData.patternTex) m.userData.patternTex.dispose(); if (m.userData && m.userData.textTex) m.userData.textTex.dispose(); if (m.dispose) m.dispose(); });   // (a pattern's own copy; the drawn canvas is shared)
  if (group.parent) group.parent.remove(group);
}
