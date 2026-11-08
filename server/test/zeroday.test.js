// Zero Day, the hacker edition (Binoy, Nov 2: glitches, a workbench of computers running code like the Matrix): the
// palette props are re-skinned in, and the code his monitors show for a prop he's made.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { themeRecipe, neonFor, NEON, PROP_EXAMPLES, validateProp } from "../../shared/craft.js";

const have = fs.existsSync(fileURLToPath(new URL("../../kit/node_modules/three/build/three.module.js", import.meta.url)));
const HX = have ? await import("../../kit/src/hacker.js") : null;

test("props in Zero Day: bodies deeper but never black, details glowing phosphor green, cyan, amber or magenta", () => {
  assert.deepEqual(Object.keys(NEON).sort(), ["amber", "cyan", "green", "magenta"]);
  assert.equal(neonFor("#7be08a"), NEON.green); assert.equal(neonFor("#5ec8ff"), NEON.cyan); assert.equal(neonFor("#ffcf5c"), NEON.amber); assert.equal(neonFor("#ff6f91"), NEON.magenta);
  const src = Object.values(PROP_EXAMPLES).flat().find((e) => e.name === "big confetti rocket launcher");
  const z = themeRecipe(validateProp(src).recipe, "zeroday");
  assert.equal(z.theme, "zeroday"); assert.equal(z.parts.length, src.parts.length);
  assert.ok(z.parts.some((p) => p.material === "glow" && Object.values(NEON).includes(p.color)), "some details glow");
  // Nov 7 (Binoy: "in the zero day mode some of the props look too black and so can't be seen"): every body part of
  // every hand-made prop is 28–55% light, keeps its own hue if it had one, and isn't metal (metal goes black under
  // Zero Day's dim lights)
  const hsl = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), mx = Math.max(...v), mn = Math.min(...v), d = mx - mn, l = (mx + mn) / 2;
    if (!d) return [0, 0, l]; let hue = mx === v[0] ? ((v[1] - v[2]) / d) % 6 : mx === v[1] ? (v[2] - v[0]) / d + 2 : (v[0] - v[1]) / d + 4; return [(hue * 60 + 360) % 360, d, l]; };
  let n = 0;
  for (const e of Object.values(PROP_EXAMPLES).flat()) {
    const r = validateProp(e).recipe; if (!r) continue;
    const t = themeRecipe(r, "zeroday");
    t.parts.forEach((p, i) => {
      if (p.material === "glow" || r.parts[i].material === "glass") return;
      n++;
      const [h, c, l] = hsl(p.color), [h0, c0] = hsl(r.parts[i].color);
      assert.ok(l >= 0.28 && l <= 0.55, `${e.name} ${p.label || p.shape}: ${r.parts[i].color} -> ${p.color}`);
      assert.notEqual(p.material, "metal", `${e.name}: no metal bodies`);
      if (c0 >= 0.12) assert.ok(Math.min(Math.abs(h - h0), 360 - Math.abs(h - h0)) < 12, `${e.name} ${p.label}: keeps its hue (${r.parts[i].color} -> ${p.color})`);
    });
  }
  assert.ok(n > 300, `${n} body parts checked`);
});

test("his monitors show a prop's real recipe, one part per line", { skip: !have }, () => {
  const r = validateProp(Object.values(PROP_EXAMPLES).flat().find((e) => e.name === "little blue umbrella")).recipe;
  const lines = HX.recipeLines(r);
  assert.equal(lines.length, Math.min(24, r.parts.length));
  assert.ok(lines.every((l) => /"shape": "\w+"/.test(l) && /"color": "#[0-9a-f]{6}"/i.test(l)));
  assert.equal(HX.recipeLines(null), null);
});
