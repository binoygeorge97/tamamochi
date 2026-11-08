/* The crafter's camera: renders a prop recipe on its own, in Mochi's lighting, for the vision check and for
 * thumbnails. Loaded by web/render.html in a headless browser the server drives (server/renderer.js).
 *   window.renderProp(recipe, { size, views, background }) → { ok, png (data URL), warnings, bounds }  */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildProp, disposeProp } from "./props.js";
import { validateProp } from "../../shared/craft.js";

const canvas = document.createElement("canvas");
const R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 1.0;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
const S = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(R); S.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; S.environmentIntensity = 0.55; pm.dispose(); }
const key = new THREE.DirectionalLight(0xfff1e2, 2.4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 4; key.shadow.bias = -0.0006;
const rim = new THREE.DirectionalLight(0xdfe8ff, 1.7), fill = new THREE.HemisphereLight(0xfff8f0, 0xe7d6cf, 0.55);
S.add(key, key.target, rim, fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 200);
const VIEWS = { front: [0, 0.16, 1], "three-quarter": [0.62, 0.36, 0.86], side: [1, 0.2, 0.12], top: [0.1, 1, 0.35], back: [0.72, 0.3, -0.8] };   // (back: a cape or a backpack, from behind his shoulder)
// Worn props are hard to read floating in space (a hat alone looked like "a character toy" to the vision check), so
// they can be shown on a plain stand-in: a soft white ball where his head or body would be.
const STAND_IN = new THREE.MeshPhysicalMaterial({ color: 0xf4f1ec, roughness: 0.9, sheen: 0.6, sheenColor: 0xffffff });
const HEAD_IN = (() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), STAND_IN); m.scale.set(0.64, 0.6, 0.56); m.position.set(0, -0.5, 0); m.castShadow = m.receiveShadow = true; return m; })();
const BODY_IN = (() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), STAND_IN); m.scale.set(0.64, 0.64, 0.6); m.castShadow = m.receiveShadow = true; return m; })();
// and his head sitting on it (Nov 4: so the tester sees where his neck is and how big a thing is next to him); left
// out of the framing, so the picture is still about the thing and the head shows at the top
// With two eyes on it and two little feet under him (Nov 4: a grass skirt at his hips was "a green leaf necklace", a
// jumper "a striped hat": with a plain ball on a plain ball the tester couldn't tell which was his head)
const HEAD_ON = (() => {
  const g = new THREE.Group(), m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), STAND_IN);
  m.scale.set(0.64, 0.62, 0.57); m.position.set(0, 1.02, 0.09); m.castShadow = m.receiveShadow = true; g.add(m);
  const eye = new THREE.MeshPhysicalMaterial({ color: 0x2b2b33, roughness: 0.2, clearcoat: 1 }), hoof = new THREE.MeshPhysicalMaterial({ color: 0x8a6552, roughness: 0.6 });
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), eye); e.scale.set(0.075, 0.095, 0.04); e.position.set(sd * 0.2, 1.0, 0.63); g.add(e);
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), hoof); f.scale.set(0.13, 0.07, 0.15); f.position.set(sd * 0.27, -0.57, 0.2); f.castShadow = true; g.add(f);
  }
  return g;
})();

// Things he holds read better held (Nov 7: a riot shield on its own was "a square picture frame", in his hoof a
// shield): a plain stand-in arm and hoof at the grip ([0, 0, 0]), coming in from below his side like his own. Left out
// of the framing too, so the picture is still about the thing.
const HAND_SLOT = new Set(["handheld_tool", "handheld_canopy", "launcher", "throwable"]);
const HAND_IN = (() => {
  const g = new THREE.Group(), wool = new THREE.MeshPhysicalMaterial({ color: 0xf0d6c6, roughness: 0.8, sheen: 0.5, sheenColor: 0xffffff }), hoof = new THREE.MeshPhysicalMaterial({ color: 0x8a6552, roughness: 0.55, clearcoat: 0.2 });
  const dir = new THREE.Vector3(0.42, -0.86, -0.28).normalize(), len = 0.5;
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, len, 8, 24), wool);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); arm.position.copy(dir).multiplyScalar(len / 2 + 0.06);
  const h = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), hoof); h.scale.set(0.11, 0.1, 0.11); h.position.copy(dir).multiplyScalar(0.03);
  for (const m of [arm, h]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  return g;
})();
export const heldStandIn = (archetype) => HAND_SLOT.has(archetype);

window.renderProp = async (input, opts = {}) => {
  const { size = 448, views = ["front", "three-quarter"], background = "#ebe7f2", ssaa = 2, standIn = false } = opts;
  const v = validateProp(input);
  if (!v.recipe) return { ok: false, errors: v.errors, warnings: v.warnings };
  const g = buildProp(v.recipe);
  if (standIn && v.recipe.archetype === "head_wearable") g.add(HEAD_IN);
  if (standIn && v.recipe.archetype === "body_wearable") g.add(BODY_IN);
  S.add(g);
  S.background = new THREE.Color(background);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  if (standIn && v.recipe.archetype === "body_wearable") g.add(HEAD_ON);
  const held = standIn && HAND_SLOT.has(v.recipe.archetype) && opts.hand !== false && !v.recipe.heavy;   // (the big launcher is carried in both arms: no one hoof)
  if (held) { HAND_IN.scale.setScalar(Math.max(0.45, Math.min(1, (0.12 * Math.max(sz.x, sz.y, sz.z)) / 0.11))); g.add(HAND_IN); }   // a hoof sized to the thing, not a blob under a small one
  const rad = Math.max(0.05, sz.length() / 2);
  ground.position.set(c.x, box.min.y - 0.003, c.z); ground.scale.setScalar(rad * 8);
  key.position.set(c.x - rad * 2.2, c.y + rad * 4, c.z + rad * 4.5); key.target.position.copy(c);
  Object.assign(key.shadow.camera, { left: -rad * 2, right: rad * 2, top: rad * 2, bottom: -rad * 2, near: 0.01, far: rad * 20 }); key.shadow.camera.updateProjectionMatrix();
  rim.position.set(c.x + rad * 2.6, c.y + rad * 2.6, c.z - rad * 3.5);
  R.setPixelRatio(Math.max(1, Math.min(3, ssaa))); R.setSize(size, size, false);   // drawn bigger, then shrunk: clean edges
  const out = document.createElement("canvas"); out.width = size * views.length; out.height = size;
  const ctx = out.getContext("2d"); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  views.forEach((name, i) => {
    const d = new THREE.Vector3(...(VIEWS[name] || VIEWS.front)).normalize();
    const dist = (rad / Math.sin((cam.fov * Math.PI) / 360)) * 1.06;
    cam.position.copy(c).addScaledVector(d, dist); cam.near = dist / 50; cam.far = dist * 4; cam.lookAt(c); cam.updateProjectionMatrix();
    R.render(S, cam);
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, i * size, 0, size, size);
  });
  g.remove(HEAD_IN); g.remove(BODY_IN); g.remove(HEAD_ON); g.remove(HAND_IN);   // shared stand-ins: keep them for the next render
  disposeProp(g);
  return { ok: true, png: out.toDataURL("image/png"), warnings: v.warnings, recipe: v.recipe, bounds: { min: box.min.toArray(), max: box.max.toArray() } };
};
window.renderReady = true;
