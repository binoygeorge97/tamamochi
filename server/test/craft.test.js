// The crafting language: repairs what a model writes, refuses what can't be fixed, keeps everything harmless.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProp, validateMove, sampleMove, sampleKeys, simplifyTrack, PROP_EXAMPLES, MOVE_EXAMPLES, propBounds, partBounds, propSpecText, moveSpecText, ARCHETYPE_NAMES, guessArchetype, themeRecipe, neonFor, NEON } from "../../shared/craft.js";

test("every built-in example is clean", () => {
  for (const [arch, list] of Object.entries(PROP_EXAMPLES)) for (const ex of list) {
    const v = validateProp(ex);
    assert.equal(v.ok, true, `${ex.name}: ${v.errors}`);
    assert.deepEqual(v.warnings, [], `${ex.name} warnings: ${v.warnings.join("; ")}`);
    assert.equal(v.recipe.archetype, arch);
  }
  for (const ex of MOVE_EXAMPLES) {
    const v = validateMove(ex);
    assert.equal(v.ok, true, `${ex.name}: ${v.errors}`);
    assert.deepEqual(v.warnings, [], `${ex.name} warnings: ${v.warnings.join("; ")}`);
  }
});

test("a messy model prop gets repaired, not rejected", () => {
  const v = validateProp({
    name: "Umbrella!!", archetype: "umbrella",
    parts: [
      { shape: "half-sphere", size: [3, 1, 3], at: [0, 2.5, 0], color: "sky blue", material: "fabric" },
      { type: "stick", scale: [0.05, 2.6], position: { x: 0, y: 1.3, z: 0 }, colour: "#fff" },
      { shape: "hook", size: 0.3, at: [0, 0, 0], arc: 180, material: "gold" },
      "nonsense",
    ],
  });
  assert.equal(v.ok, true, v.errors.join());
  const r = v.recipe;
  assert.equal(r.archetype, "handheld_canopy");
  assert.deepEqual(r.parts.map((p) => p.shape), ["dome", "cylinder", "torus"]);
  assert.equal(r.parts[0].color, "#8cc8ff"); assert.equal(r.parts[0].material, "cloth");
  assert.equal(r.parts[1].color, "#ffffff"); assert.equal(r.parts[2].material, "metal");
  assert.ok(Math.max(...propBounds(r.parts).size) <= 2.0 + 1e-6, "scaled into the canopy size class");
  assert.ok(v.warnings.some((w) => /scaled to fit/.test(w)));
  assert.equal(r.hold, "upright");
});

test("launchers can only ever shoot harmless things", () => {
  const v = validateProp({ name: "rocket launcher", archetype: "launcher", ammo: "rockets", parts: [{ shape: "cylinder", size: [0.2, 0.8, 0.2], at: [0.4, 0.1, 0], rotate: [0, 0, -90] }] });
  assert.equal(v.recipe.ammo, "confetti");
  assert.ok(v.warnings.some((w) => /made safe/.test(w)));
  assert.ok(Array.isArray(v.recipe.muzzle), "a muzzle is filled in");
  assert.equal(validateProp({ name: "x", archetype: "launcher", ammo: "soap", parts: [{ shape: "box", size: 0.3 }] }).recipe.ammo, "bubbles");
});

test("companions stand on the ground; empty props are refused", () => {
  const v = validateProp({ name: "robot", archetype: "companion", parts: [{ shape: "box", size: [0.5, 0.6, 0.4], at: [0, 0.6, 0] }] });
  assert.equal(propBounds(v.recipe.parts).lo[1], 0);
  assert.equal(validateProp({ name: "nothing", parts: [] }).ok, false);
  assert.equal(validateProp("{not json").ok, false);
  assert.equal(validateProp({ recipe: { name: "wrapped", archetype: "handheld_tool", parts: [{ shape: "sphere", size: 0.2 }] } }).ok, true, "{plan, recipe} wrapper accepted");
});

test("moves: aliases, reserved channels, rest at both ends, whole turns, 4 s cap", () => {
  const v = validateMove({
    name: "spin dance", duration: 6,
    tracks: {
      "armR.spread": [[0.5, 0.8], [3, 0.8]],
      "body.spin": [[0, 0], [5, 0.9]],
      "face.puff": [[0, 1]],
      "tail.wag": [[0, 1]],
      hop: [[1, 0.5], [2, 0]],
    },
    events: [[1, "pop"], [2, "sparkle"]],
  });
  assert.equal(v.ok, true, v.errors.join());
  const t = v.recipe.tracks;
  assert.ok(t["rightArm.spread"] && t["body.spin"] && t["body.hop"]);
  assert.equal(t["face.puff"], undefined); assert.equal(t["tail.wag"], undefined);
  assert.equal(v.recipe.duration, 4);
  assert.deepEqual(t["rightArm.spread"][0], [0, 0]); assert.equal(t["rightArm.spread"].at(-1)[1], 0);
  assert.equal(t["body.spin"].at(-1)[1], 1, "spin rounded to one whole turn");
  assert.deepEqual(v.recipe.events, [[2, "sparkle"]], "pop needs a launcher");
  assert.ok(v.warnings.some((w) => /reserved/.test(w)));
  assert.equal(validateMove({ tracks: { "head.nod": [[0, 0], [1, 0.05]] } }).ok, false, "a twitch isn't a move");
});

test("sampling is smooth, stays in range and wobbles less with skill", () => {
  const rec = validateMove(MOVE_EXAMPLES[0]).recipe;
  let prev = 0, maxJump = 0;
  for (let t = 0; t <= rec.duration; t += 0.01) { const v = sampleMove(rec, t)["rightArm.spread"]; maxJump = Math.max(maxJump, Math.abs(v - prev)); prev = v; assert.ok(v >= -1 && v <= 1); }
  assert.ok(maxJump < 0.12, `no jumps (${maxJump})`);
  const dev = (skill) => { let s = 0; for (let t = 0.3; t < 1.8; t += 0.05) s += Math.abs(sampleMove(rec, t, { skill, seed: "a" })["head.tilt"] - sampleMove(rec, t, { skill: 1 })["head.tilt"]); return s; };
  assert.ok(dev(0.1) > dev(0.8) && dev(1) === 0);
  assert.equal(sampleMove(rec, 0, { skill: 0, seed: "x" })["rightArm.spread"], 0, "no wobble at the very start");
});

test("simplify keeps the shape in 12 keys", () => {
  const keys = Array.from({ length: 40 }, (_, i) => [i * 0.1, Math.sin(i * 0.3)]);
  const s = simplifyTrack(keys, 12);
  assert.equal(s.length, 12); assert.deepEqual(s[0], keys[0]); assert.deepEqual(s.at(-1), keys.at(-1));
});

test("spec text mentions every archetype's essentials", () => {
  for (const a of ARCHETYPE_NAMES) assert.match(propSpecText(a), /origin \[0, 0, 0\]/);
  assert.match(propSpecText("launcher"), /muzzle/); assert.match(moveSpecText(), /rightArm.raise/);
});

test("which kind of prop: whole words only, protective gear and sponsor-themed things", () => {
  const cases = {
    "a thing that shoots bubbles": "handheld_tool", "a capsule toy": "handheld_tool", "an escape key": "handheld_tool",   // "that", "capsule", "escape" aren't hats or capes
    "police helmet": "head_wearable", "night vision goggles": "head_wearable", "magenta headphones": "head_wearable",
    "bulletproof vest": "body_wearable", "a red cape": "body_wearable", "gold medal": "body_wearable", "life jacket": "body_wearable",
    "riot shield": "handheld_tool", "walkie talkie": "handheld_tool", "flashlight": "handheld_tool",
    "piggy bank": "companion", "traffic cone": "companion", "a little cell tower": "companion", "toy tank": "companion",
    "make a gun": "launcher", "a grenade": "throwable", "a snowball": "throwable", "water gun": "launcher", "flag": "handheld_canopy", "umbrella": "handheld_canopy",
  };
  for (const [t, want] of Object.entries(cases)) assert.equal(guessArchetype(t), want, t);
});

test("body props, hollow tubes and coin ammo", () => {
  const vest = validateProp({ name: "vest", archetype: "body_wearable", parts: [{ shape: "cylinder", size: [1.38, 0.78, 1.32], at: [0, 0, 0], color: "navy", material: "cloth", hollow: true }] });
  assert.equal(vest.ok, true); assert.equal(vest.recipe.parts[0].hollow, true);
  const notHollow = validateProp({ name: "pole", archetype: "handheld_tool", parts: [{ shape: "cylinder", size: [0.05, 1, 0.05], at: [0, 0.4, 0], color: "white", material: "metal", hollow: "maybe" }] });
  assert.equal(notHollow.recipe.parts[0].hollow, undefined, "only true makes it hollow");
  const coins = validateProp({ name: "coin popper", archetype: "launcher", ammo: "money", parts: [{ shape: "cylinder", size: [0.2, 0.5, 0.2], at: [0.3, 0.1, 0], rotate: [0, 0, -90], color: "gold", material: "metal" }] });
  assert.equal(coins.recipe.ammo, "coins");
});

test("bounds use three.js's rotation order (z, then y, then x)", () => {
  // a long box along y, turned 90° about z (now along x), then 90° about x: still along x
  const b = partBounds({ shape: "box", size: [0.1, 1, 0.1], at: [0, 0, 0], rotate: [90, 0, 90] });
  assert.ok(b.hi[0] - b.lo[0] > 0.95 && b.hi[1] - b.lo[1] < 0.15 && b.hi[2] - b.lo[2] < 0.15, JSON.stringify(b));
});

test("interpolation: never overshoots, eases out of rest, velocity has no kinks at keys", () => {
  const keys = [[0, 0], [0.3, 1], [0.35, 1], [1.2, -0.4], [1.3, 0.9], [2, 0]];
  for (let t = 0; t <= 2; t += 0.005) {
    const v = sampleKeys(keys, t);
    const i = keys.findIndex((k, j) => j < keys.length - 1 && t >= k[0] && t <= keys[j + 1][0]);
    if (i >= 0) { const lo = Math.min(keys[i][1], keys[i + 1][1]), hi = Math.max(keys[i][1], keys[i + 1][1]); assert.ok(v >= lo - 1e-9 && v <= hi + 1e-9, `t=${t.toFixed(3)} v=${v} outside [${lo}, ${hi}]`); }
  }
  const h = 1e-6, vel = (t) => (sampleKeys(keys, t + h) - sampleKeys(keys, t - h)) / (2 * h);
  assert.ok(Math.abs(vel(1e-4)) < 0.05, "starts from rest");
  // C1: just before and just after every key, the velocity is the same (a kink would leave a jump however close you look)
  for (const [tk] of keys.slice(1, -1)) assert.ok(Math.abs(vel(tk - 1e-4) - vel(tk + 1e-4)) < 0.2, `no kink at ${tk}: ${vel(tk - 1e-4).toFixed(3)} vs ${vel(tk + 1e-4).toFixed(3)}`);
});

test("wobbly first tries still start and end exactly at rest", () => {
  for (const mv of MOVE_EXAMPLES) {
    const r = validateMove(mv).recipe;
    for (const skill of [0, 0.2, 0.6]) {
      const a = sampleMove(r, 0, { skill, seed: "x" }), z = sampleMove(r, r.duration, { skill, seed: "x" });
      for (const [ch, v] of Object.entries(a)) assert.ok(Math.abs(v) < 1e-9, `${mv.name} ${ch} starts at ${v}`);
      for (const [ch, v] of Object.entries(z)) assert.ok(Math.abs(v - Math.round(v)) < 1e-9 && (/spin/.test(ch) || Math.abs(v) < 1e-9), `${mv.name} ${ch} ends at ${v}`);
    }
  }
});

test("snaps are softened: nothing faster than the whole range in a sixth of a second", () => {
  const v = validateMove({ name: "flick", tracks: { "rightArm.raise": [[0, 0], [0.5, 0], [0.52, 1], [1.5, 1], [1.55, 0], [2, 0]] } });
  assert.ok(v.warnings.some((w) => /too fast/.test(w)), v.warnings.join("; "));
  const k = v.recipe.tracks["rightArm.raise"];
  for (let i = 1; i < k.length; i++) assert.ok(Math.abs(k[i][1] - k[i - 1][1]) <= (2 / 0.16) * (k[i][0] - k[i - 1][0]) + 1e-6, `segment ${i}`);
});

test("Zero Day re-skin: a deeper body that can still be seen, neon details, same shape, original untouched", () => {
  const src = validateProp(PROP_EXAMPLES.companion.find((e) => e.name === "piggy bank")).recipe;
  const before = JSON.stringify(src), z = themeRecipe(src, "zeroday");
  assert.equal(JSON.stringify(src), before, "pure");
  assert.equal(z.parts.length, src.parts.length);
  z.parts.forEach((p, i) => { assert.deepEqual(p.size, src.parts[i].size); assert.deepEqual(p.at, src.parts[i].at); });
  assert.notEqual(z.parts[0].material, "glow", "the body stays solid");
  const light = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return (Math.max(...v) + Math.min(...v)) / 2; };
  assert.ok(light(z.parts[0].color) >= 0.28 && light(z.parts[0].color) <= 0.55, `deeper, never black (${z.parts[0].color}; Nov 7: "too black")`);
  assert.ok(z.parts.some((p) => p.material === "glow" && Object.values(NEON).includes(p.color)), "neon details");
  assert.equal(themeRecipe(src, "normal"), src);
  assert.equal(neonFor("#e5484d"), NEON.magenta); assert.equal(neonFor("#8cc8ff"), NEON.cyan); assert.equal(neonFor("#62c46b"), NEON.green); assert.equal(neonFor("#ffd34d"), NEON.amber);
});

test("a tube written lying down is turned on its side instead of becoming an oval drum", () => {
  const v = validateProp({ name: "blaster", archetype: "launcher", ammo: "bubbles", muzzle: [0.6, 0.25, 0], parts: [
    { shape: "cylinder", size: [0.6, 0.3, 0.3], at: [0.3, 0.25, 0], color: "blue", material: "plastic" },
    { shape: "capsule", size: [0.1, 0.1, 0.5], at: [0, 0, 0.2], color: "blue", material: "plastic" },
    { shape: "cylinder", size: [0.8, 0.3, 0.8], at: [0, 0, 0], color: "pink", material: "candy" } ] });
  assert.deepEqual(v.recipe.parts[0].size, [0.3, 0.6, 0.3]); assert.deepEqual(v.recipe.parts[0].rotate, [0, 0, 90]);
  assert.deepEqual(v.recipe.parts[1].size, [0.1, 0.5, 0.1]); assert.deepEqual(v.recipe.parts[1].rotate, [90, 0, 0]);
  assert.deepEqual(v.recipe.parts[2].size, [0.8, 0.3, 0.8], "a round cake stays a cake");
  const b = partBounds(v.recipe.parts[0]); assert.ok(b.hi[0] - b.lo[0] > 0.55, "still 0.6 long along x");
});

test("floating bits are moved to touch the rest; far-off ones are left alone", () => {
  const v = validateProp({ name: "phone", archetype: "handheld_tool", parts: [
    { shape: "box", size: [0.38, 0.66, 0.07], at: [0, 0.26, 0], color: "#e20074", material: "plastic", label: "case" },
    { shape: "torus", size: [0.07, 0.07, 0.016], at: [-0.3, -0.25, 0], color: "#f2c14e", material: "metal", label: "charm ring" },
    { shape: "star", size: [0.1, 0.1, 0.03], at: [-0.32, -0.35, 0], color: "#f2c14e", material: "metal", label: "charm" } ] });
  assert.ok(v.warnings.some((w) => /charm ring floated/.test(w)) && v.warnings.some((w) => /charm floated/.test(w)), v.warnings.join("; "));
  const B = v.recipe.parts.map(partBounds);
  const touching = (a, b) => [0, 1, 2].every((k) => a.lo[k] <= b.hi[k] + 0.02 && b.lo[k] <= a.hi[k] + 0.02);
  assert.ok(touching(B[1], B[0]) || touching(B[1], B[2])); assert.ok(touching(B[2], B[0]) || touching(B[2], B[1]));
  const far = validateProp({ name: "x", archetype: "companion", parts: [{ shape: "sphere", size: [0.5, 0.5, 0.5], at: [0, 0.25, 0], color: "#fff", material: "plastic" }, { shape: "sphere", size: [0.1, 0.1, 0.1], at: [1.4, 0.05, 0], color: "#fff", material: "plastic" }] });
  assert.ok(!far.warnings.some((w) => /floated/.test(w)), "more than 0.6 away: on purpose, left alone");
});

test("coins stand up facing the viewer; buried face gear comes forward, head straps and shells stay", () => {
  const coin = validateProp({ name: "coin", archetype: "handheld_tool", parts: [{ shape: "badge", size: [0.5, 0.5, 0.06], at: [0, 0.3, 0], color: "gold", material: "metal" }] });
  assert.equal(coin.recipe.parts[0].shape, "coin");
  const b = partBounds(coin.recipe.parts[0]); assert.ok(b.hi[2] - b.lo[2] < 0.1 && b.hi[1] - b.lo[1] > 0.45, "thin along z, tall along y");
  const g = validateProp({ name: "goggles", archetype: "head_wearable", parts: [
    { shape: "torus", size: [1.3, 1.25, 0.05], at: [0, -0.45, 0], rotate: [90, 0, 0], color: "#334", material: "cloth", label: "strap" },
    { shape: "cylinder", size: [0.17, 0.2, 0.17], at: [-0.2, -0.55, 0.3], rotate: [90, 0, 0], color: "#353", material: "metal", label: "tube" },
    { shape: "cylinder", size: [0.17, 0.2, 0.17], at: [0.2, -0.55, 0.3], rotate: [90, 0, 0], color: "#353", material: "metal" },
    { shape: "coin", size: [0.15, 0.15, 0.02], at: [-0.2, -0.55, 0.41], color: "#3f8", material: "glow", label: "lens" } ] });
  assert.ok(g.warnings.some((w) => /inside his face/.test(w)), g.warnings.join("; "));
  assert.deepEqual(g.recipe.parts[0].at, [0, -0.45, 0], "the strap stays round his head");
  assert.ok(g.recipe.parts[1].at[2] > 0.55 && g.recipe.parts[3].at[2] > g.recipe.parts[1].at[2], "tubes and lens out in front, still in order");
  const helmet = validateProp(PROP_EXAMPLES.head_wearable.find((e) => e.name === "protective helmet"));
  assert.deepEqual(helmet.warnings, [], "a helmet shell is meant to go round his head");
});

test("helmets: a sunken shell is lifted, chin straps and padding are left where they are", () => {
  const h = validateProp({ name: "army helmet", archetype: "head_wearable", parts: [
    { shape: "dome", size: [1.1, 0.45, 1.05], at: [0, -0.35, 0], color: "#4b5320", material: "plastic", label: "shell" },
    { shape: "box", size: [0.06, 0.4, 0.06], at: [-0.55, -0.55, 0.05], color: "#333", material: "rubber", label: "strap" },
    { shape: "box", size: [0.5, 0.2, 0.4], at: [0, -0.45, 0.0], color: "#4b5320", material: "cloth", label: "padding" } ] });
  assert.ok(h.warnings.some((w) => /sat inside his head; lifted/.test(w)), h.warnings.join("; "));
  assert.ok(partBounds(h.recipe.parts[0]).hi[1] > 0.25, "the shell's top shows above the wool");
  assert.ok(!h.warnings.some((w) => /inside his face/.test(w)), "straps and padding are not face gear");
  assert.equal(h.recipe.parts[1].at[2], 0.05, "the strap didn't jump forward");
});

test("garbled colour codes keep their colour instead of turning sky blue", () => {
  const v = validateProp({ name: "goggles", archetype: "handheld_tool", parts: [
    { shape: "box", size: [0.3, 0.3, 0.3], at: [0, 0.15, 0], color: "#2d3lin34", material: "plastic" },
    { shape: "box", size: [0.3, 0.3, 0.3], at: [0, 0.45, 0], color: "#2d3arr", material: "plastic" },
    { shape: "box", size: [0.3, 0.3, 0.3], at: [0, 0.75, 0], color: "#1e272e99", material: "plastic" },
    { shape: "box", size: [0.3, 0.3, 0.3], at: [0, 1.05, 0], color: "#zz", material: "plastic" } ] });
  const c = v.recipe.parts.map((p) => p.color);
  const dark = (h) => [1, 3, 5].every((k) => parseInt(h.slice(k, k + 2), 16) < 0x60);
  assert.ok(dark(c[0]) && dark(c[1]), `garbled dark greys stay dark: ${c}`);
  assert.equal(c[2], "#1e272e", "an 8-digit code keeps its colour");
  assert.equal(c[3], "#8cc8ff", "nothing left to read: the material's colour");
  assert.ok(v.warnings.some((w) => /"#2d3lin34" read as #2d33/.test(w)), v.warnings.join("; "));
});

test("worn props: rings round him lie flat, his head holds straps and arms, badges face the viewer", () => {
  const g = validateProp({ name: "night vision goggles", archetype: "head_wearable", parts: [
    { shape: "torus", size: [1.3, 1.2, 0.06], at: [0, -0.45, -0.1], color: "#2d3436", material: "cloth", label: "strap" },
    { shape: "cylinder", size: [0.2, 0.2, 0.2], at: [-0.25, -0.5, 0.62], rotate: [90, 0, 0], color: "#2d3436", material: "plastic", label: "tube" },
    { shape: "cylinder", size: [0.2, 0.2, 0.2], at: [0.25, -0.5, 0.62], rotate: [90, 0, 0], color: "#2d3436", material: "plastic" } ] });
  const strap = g.recipe.parts[0];
  assert.deepEqual(strap.rotate, [90, 0, 0], g.warnings.join("; "));
  assert.ok(Math.abs(strap.at[2] + 0.1) < 0.01 && Math.abs(strap.at[1] + 0.45) < 0.01, `it goes round his head where it was, not pulled forward to the tubes: ${strap.at}`);
  const b = partBounds(strap); assert.ok(b.hi[1] - b.lo[1] < 0.1 && b.hi[2] - b.lo[2] > 1.1, "flat round his head");
  const rim = validateProp({ name: "army helmet", archetype: "head_wearable", parts: [
    { shape: "dome", size: [1.3, 0.8, 1.2], at: [0, -0.2, 0], color: "#6b8e23", material: "plastic", label: "shell" },
    { shape: "torus", size: [1.4, 0.3, 0.3], at: [0, -0.2, 0], color: "#556b2f", material: "rubber", label: "rim" },
    { shape: "disc", size: [0.5, 0.05, 0.4], at: [0, 0.1, 0.5], color: "#3e4d26", material: "cloth", label: "patch_main" } ] });
  const r = rim.recipe.parts[1], rb = partBounds(r);
  assert.deepEqual(r.rotate, [90, 0, 0]); assert.ok(rb.hi[2] - rb.lo[2] > 1.1 && rb.hi[1] - rb.lo[1] <= 0.31, `a round rim: ${JSON.stringify(rb)}`);
  const patch = rim.recipe.parts[2];
  assert.equal(patch.shape, "coin"); assert.deepEqual(patch.size, [0.5, 0.4, 0.05], "the patch stands up on the front");
  const s = validateProp({ name: "sunglasses", archetype: "head_wearable", parts: [
    { shape: "torus", size: [0.35, 0.35, 0.1], at: [-0.25, -0.5, 0.66], color: "#ff69b4", material: "plastic", label: "rim" },
    { shape: "torus", size: [0.35, 0.35, 0.1], at: [0.25, -0.5, 0.66], color: "#ff69b4", material: "plastic" },
    { shape: "capsule", size: [0.1, 0.4, 0.1], at: [0, -0.5, 0.66], rotate: [0, 0, 90], color: "#ff69b4", material: "plastic", label: "bridge" },
    { shape: "capsule", size: [0.05, 0.6, 0.05], at: [-0.444, -0.5, 0.2], color: "#ff69b4", material: "plastic", label: "arm_left" },
    { shape: "capsule", size: [0.05, 0.6, 0.05], at: [0.444, -0.5, 0.2], color: "#ff69b4", material: "plastic", label: "arm_right" } ] });
  assert.ok(!s.warnings.some((w) => /floated/.test(w)), `arms by his ears are held by his head: ${s.warnings.join("; ")}`);
  const arm = s.recipe.parts[3], ab = partBounds(arm), frame = partBounds(s.recipe.parts[0]);
  assert.deepEqual(arm.rotate, [90, 0, 0], "written standing up like an antenna, laid back towards his ears");
  assert.ok(Math.abs(ab.hi[2] - frame.lo[2]) < 0.03 && ab.hi[1] - ab.lo[1] < 0.06, `runs back from the frame: ${JSON.stringify(ab)}`);
  const phones = validateProp({ name: "headphones", archetype: "head_wearable", parts: [
    { shape: "torus", size: [1.3, 1.3, 0.08], at: [0, -0.5, 0], arc: 180, color: "#e20074", material: "plastic", label: "band" },
    { shape: "capsule", size: [0.05, 0.5, 0.05], at: [-0.6, -0.5, 0], color: "#333", material: "plastic", label: "arm" } ] });
  assert.deepEqual(phones.recipe.parts[1].rotate, [0, 0, 0], "only glasses and goggles have arms that go back to his ears");
  const lens = validateProp({ name: "sunglasses", archetype: "head_wearable", parts: [
    { shape: "disc", size: [0.3, 0.3, 0.05], at: [-0.25, -0.5, 0.7], color: "#aaddff", material: "glass", label: "lens_left" },
    { shape: "cylinder", size: [0.3, 0.28, 0.04], at: [0.25, -0.5, 0.7], color: "#aaddff", material: "glass" },
    { shape: "cylinder", size: [0.3, 0.3, 0.3], at: [0, -0.2, 0.62], color: "#333", material: "plastic" } ] });
  assert.deepEqual(lens.recipe.parts.map((p) => p.shape), ["coin", "coin", "cylinder"], lens.warnings.join("; "));
  assert.deepEqual(lens.recipe.parts[0].size, [0.3, 0.3, 0.05], "already written facing the viewer: same size");
  const small = validateProp({ name: "glasses", archetype: "head_wearable", parts: [
    { shape: "torus", size: [0.3, 0.3, 0.04], at: [-0.2, -0.5, 0.66], color: "#333", material: "plastic" },
    { shape: "disc", size: [0.12, 0.03, 0.12], at: [0, -0.2, 0.62], color: "#333", material: "plastic", label: "button" } ] });
  assert.deepEqual(small.recipe.parts[0].rotate, [0, 0, 0], "glasses rims are small rings facing the viewer: untouched");
  assert.equal(small.recipe.parts[1].shape, "disc", "a button may lie flat");
  const light = validateProp({ name: "flashlight", archetype: "handheld_tool", hold: "along", parts: [
    { shape: "cylinder", size: [0.16, 0.5, 0.16], at: [0.2, 0, 0], rotate: [0, 0, 90], color: "#333", material: "metal" },
    { shape: "disc", size: [0.14, 0.02, 0.14], at: [0.46, 0, 0], color: "#ffe27a", material: "glow", label: "lens" } ] });
  assert.equal(light.recipe.parts[1].shape, "disc", "on a prop held pointing forward a lens isn't turned to the viewer");
  const vest = validateProp({ name: "life ring", archetype: "body_wearable", parts: [
    { shape: "torus", size: [1.4, 1.4, 0.3], at: [0, -0.1, 0], color: "#ff6b35", material: "plastic", label: "ring" } ] });
  assert.deepEqual(vest.recipe.parts[0].rotate, [90, 0, 0], "round his middle, not a hoop in front of him");
});

test("the riot shield example: a tall clear panel, held by a handle at the hoof", () => {
  const e = PROP_EXAMPLES.handheld_tool.find((x) => x.name === "riot shield");
  const v = validateProp(e);
  assert.deepEqual(v.warnings, []);
  const b = propBounds(v.recipe.parts);
  assert.ok(b.size[1] > 1.1 && b.size[1] <= 1.4 && b.size[0] < 0.9, `tall and narrow: ${b.size}`);
});

test("helmets: chin straps written sideways are trimmed, not the whole helmet shrunk", () => {
  const h = validateProp({ name: "police helmet", archetype: "head_wearable", parts: [
    { shape: "dome", size: [1.2, 0.7, 1.1], at: [0, -0.15, 0], color: "#2c3e50", material: "plastic", label: "cap_dome" },
    { shape: "cylinder", size: [1.3, 0.15, 1.2], at: [0, -0.4, 0], color: "#1a252f", material: "plastic", label: "cap_rim" },
    { shape: "capsule", size: [0.05, 0.8, 0.05], at: [-0.5, -0.7, 0.2], rotate: [0, 0, 90], color: "#1a252f", material: "rubber", label: "strap_left" },
    { shape: "capsule", size: [0.05, 0.8, 0.05], at: [0.5, -0.7, 0.2], rotate: [0, 0, 90], color: "#1a252f", material: "rubber", label: "strap_right" } ] });
  assert.ok(h.warnings.some((w) => /trimmed to fit/.test(w)) && !h.warnings.some((w) => /scaled to fit/.test(w)), h.warnings.join("; "));
  assert.equal(h.recipe.parts[0].size[0], 1.2, "the shell keeps its size, big enough for his head");
  assert.ok(propBounds(h.recipe.parts).size[0] <= 1.4 + 1e-9);
  const big = validateProp({ name: "giant hat", archetype: "head_wearable", parts: [
    { shape: "dome", size: [1.3, 0.7, 1.2], at: [0, -0.15, 0], color: "#2c3e50", material: "plastic" },
    { shape: "box", size: [0.8, 0.3, 0.3], at: [1.0, -0.2, 0], color: "#2c3e50", material: "plastic" },
    { shape: "capsule", size: [0.05, 0.8, 0.05], at: [-0.5, -0.7, 0.2], rotate: [0, 0, 90], color: "#1a252f", material: "rubber" } ] });
  assert.ok(big.warnings.some((w) => /scaled to fit/.test(w)), "solid parts too wide themselves: still scaled down");
  const brim = validateProp({ name: "pirate hat", archetype: "head_wearable", parts: [
    { shape: "dome", size: [1.2, 0.6, 1.1], at: [0, 0.05, 0], color: "#222", material: "cloth", label: "crown" },
    { shape: "disc", size: [1.8, 0.06, 1.6], at: [0, 0.06, 0], color: "#222", material: "cloth", label: "brim" } ] });
  assert.ok(!brim.warnings.some((w) => /scaled/.test(w)) && brim.recipe.parts[0].size[0] === 1.2, `a wide brim doesn't shrink the hat: ${brim.warnings.join("; ")}`);
});

test("building blocks (Nov 4): wedge, bendy tube, flat shapes, patterns", async () => {
  const { validateProp, resizeRecipe, themeRecipe, SHAPE_NAMES, PATTERN_NAMES, propSpecText } = await import("../../shared/craft.js");
  for (const sh of ["wedge", "tube", "cloud", "moon", "bolt", "drop", "fish", "paw", "arrow", "note"]) assert.ok(SHAPE_NAMES.includes(sh), sh);
  assert.deepEqual(PATTERN_NAMES, ["stripes", "segments", "dots", "checks", "stars", "zigzag"]);
  const v = validateProp({ name: "mug", archetype: "handheld_tool", parts: [
    { shape: "cylinder", size: [0.3, 0.32, 0.3], at: [0, 0.16, 0], color: "pink", material: "plastic", pattern: "polka dots" },
    { shape: "tube", points: [[0.15, 0.26, 0], [0.27, 0.2, 0], [0.27, 0.1, 0], [0.15, 0.06, 0]], thick: 0.05, size: [9, 9, 9], at: [5, 5, 5], color: "pink", material: "plastic" },
    { shape: "triangle", size: [0.2, 0.2, 0.05], at: [0, 0.36, 0], color: "#ffd34d", material: "glass", pattern: "stripes" },
    { shape: "lightning bolt", size: [0.1, 0.12, 0.03], at: [0, 0.2, 0.16], color: "#ffd34d", material: "plastic", pattern: "tartan", pattern_color: "#ffd34d" },
    { shape: "tube", size: [0.05, 0.3, 0.05], at: [0, 0.2, 0], color: "#ffd34d", material: "plastic" }] });
  const [cup, handle, wedge, bolt, straight] = v.recipe.parts;
  assert.equal(cup.pattern, "dots"); assert.equal(cup.pattern_color, "#fbf8f2", "white dots on pink");
  assert.deepEqual(handle.at, [0.21, 0.16, 0], "its box comes from its points"); assert.equal(handle.path.length, 4); assert.ok(handle.thick > 0 && handle.thick < 1);
  assert.equal(wedge.shape, "wedge"); assert.equal(wedge.pattern, undefined, "no pattern on glass");
  assert.equal(bolt.shape, "bolt"); assert.equal(bolt.pattern, "checks"); assert.notEqual(bolt.pattern_color, "#ffd34d", "a second colour that shows");
  assert.equal(straight.shape, "cylinder", "a tube with no points is a straight one");
  const big = resizeRecipe(v.recipe, 1.5).recipe.parts[1];
  assert.deepEqual(big.path, handle.path, "resizing keeps the tube's shape"); assert.ok(big.size[1] > handle.size[1]);
  assert.ok(themeRecipe(v.recipe, "zeroday").parts[0].pattern_color, "Zero Day keeps the pattern, in neon");
  assert.match(propSpecText("handheld_tool"), /"pattern"[^]*checks/);
});

