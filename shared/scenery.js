// Scenery for the stories he tells (Nov 5, Binoy: "there arent a lot of the props he says for the scene like bush or
// twig (wouldnt it be better if these generated for the story)"). The detective game had him say "a tiny crumb right
// here near my hoof", "tiny little brown tracks leading toward the bushes", "blue fuzz caught on this twig", and none of
// it was there.
//
// Common outdoor things are ready-made here (on the stage at once); anything else he mentions is made at the workbench
// in one quick go (server/scenery.js) and kept, so the next time it's here at once too. Each recipe sits on the ground
// (y = 0 is the floor), in prop units like the others (Mochi is about 2.2 tall).

const P = (shape, size, at, color, material = "plastic", more = {}) => ({ shape, size, at, color, material, ...more });

/** each: [what he might call it, name, recipe parts, how big it looks next to him (1 = as made), where it goes] */
export const SCENERY = [
  [/\b(?:bush|bushes|shrubs?|hedges?|shrubbery)\b/, "bush", () => [
    P("sphere", [0.9, 0.7, 0.7], [0, 0.35, 0], "#5aa35e", "fluffy"), P("sphere", [0.6, 0.55, 0.55], [-0.38, 0.3, 0.08], "#4f9654", "fluffy"),
    P("sphere", [0.62, 0.58, 0.55], [0.4, 0.3, 0.05], "#64b067", "fluffy"), P("sphere", [0.5, 0.45, 0.45], [0.05, 0.62, 0.05], "#6cba6e", "fluffy"),
    P("sphere", [0.09, 0.09, 0.09], [0.2, 0.55, 0.32], "#e2547a", "candy"), P("sphere", [0.08, 0.08, 0.08], [-0.25, 0.4, 0.3], "#e2547a", "candy")], 1, "back"],
  [/\b(?:trees?|oak|pine ?trees?)\b/, "tree", () => [
    P("cylinder", [0.32, 1.3, 0.32], [0, 0.65, 0], "#8b5e3c", "wood", { taper: 0.75 }),
    P("sphere", [1.3, 1.0, 1.0], [0, 1.6, 0], "#5aa35e", "fluffy"), P("sphere", [0.9, 0.8, 0.8], [-0.5, 1.35, 0.1], "#4f9654", "fluffy"), P("sphere", [0.9, 0.8, 0.8], [0.5, 1.4, 0.05], "#64b067", "fluffy"),
    P("sphere", [0.7, 0.6, 0.6], [0, 2.05, 0], "#6cba6e", "fluffy")], 1, "back"],
  [/\b(?:twigs?|sticks?|branch(?:es)?)\b/, "twig", () => [
    P("cylinder", [0.05, 0.75, 0.05], [0, 0.04, 0], "#7a5233", "wood", { rotate: [0, 0, 90] }),
    P("cylinder", [0.035, 0.28, 0.035], [0.12, 0.1, 0], "#7a5233", "wood", { rotate: [0, 0, 50] }),
    P("leaf", [0.12, 0.17, 0.02], [-0.3, 0.1, 0.02], "#6cba6e", "plastic", { rotate: [0, 0, 60] })], 1, "front"],
  [/\b(?:leaf|leaves)\b/, "leaves", () => [
    P("leaf", [0.22, 0.3, 0.02], [-0.15, 0.02, 0], "#e0913c", "plastic", { rotate: [-90, 0, 30] }),
    P("leaf", [0.2, 0.28, 0.02], [0.15, 0.02, 0.08], "#d9563a", "plastic", { rotate: [-90, 0, -40] }),
    P("leaf", [0.18, 0.25, 0.02], [0.02, 0.03, -0.12], "#e8c045", "plastic", { rotate: [-90, 0, 100] })], 1, "front"],
  [/\b(?:rocks?|stones?|boulders?)\b/, "rock", () => [
    P("sphere", [0.6, 0.38, 0.48], [0, 0.17, 0], "#9a9aa3", "rubber"), P("sphere", [0.32, 0.22, 0.28], [0.34, 0.1, 0.08], "#8a8a93", "rubber")], 1, "side"],
  [/\b(?:pebbles?)\b/, "pebbles", () => [
    P("sphere", [0.12, 0.08, 0.1], [-0.15, 0.04, 0], "#a3a3ab", "rubber"), P("sphere", [0.1, 0.07, 0.09], [0.08, 0.035, 0.08], "#b3aea3", "rubber"), P("sphere", [0.09, 0.06, 0.08], [0.2, 0.03, -0.06], "#8f8f98", "rubber")], 1, "front"],
  [/\b(?:flowers?|daisy|daisies|tulips?)\b/, "flowers", () => [
    ...[[-0.2, 0, "#ff8fb1"], [0.05, 0.05, "#ffd34d"], [0.25, -0.03, "#b48cff"]].flatMap(([x, z, c]) => [
      P("cylinder", [0.03, 0.4, 0.03], [x, 0.2, z], "#62c46b"), P("sphere", [0.16, 0.16, 0.06], [x, 0.42, z + 0.01], c, "cloth"), P("sphere", [0.06, 0.06, 0.04], [x, 0.42, z + 0.04], "#ffe9a8", "candy")])], 1, "front"],
  [/\b(?:mushrooms?|toadstools?)\b/, "mushroom", () => [
    P("cylinder", [0.14, 0.24, 0.14], [0, 0.12, 0], "#f3ead8", "rubber"), P("dome", [0.38, 0.2, 0.38], [0, 0.24, 0], "#e04a3f", "rubber"),
    P("sphere", [0.06, 0.03, 0.06], [0.07, 0.36, 0.08], "#ffffff", "rubber"), P("sphere", [0.05, 0.03, 0.05], [-0.09, 0.33, 0.04], "#ffffff", "rubber")], 1, "front"],
  [/\b(?:puddles?)\b/, "puddle", () => [P("disc", [0.9, 0.02, 0.5], [0, 0.01, 0], "#7fb8e6", "glass")], 1, "front"],
  [/\b(?:logs?|tree ?stumps?|stumps?)\b/, "log", () => [
    P("cylinder", [0.32, 0.9, 0.32], [0, 0.16, 0], "#8b5e3c", "wood", { rotate: [0, 0, 90] }), P("coin", [0.3, 0.3, 0.02], [0.46, 0.16, 0], "#d9b07a", "wood", { rotate: [0, 90, 0] })], 1, "side"],
  [/\b(?:crumbs?)\b/, "crumbs", () => [
    P("sphere", [0.05, 0.035, 0.045], [-0.06, 0.02, 0], "#d99a4e", "candy"), P("sphere", [0.035, 0.03, 0.035], [0.05, 0.015, 0.04], "#c98a3e", "candy"), P("sphere", [0.03, 0.025, 0.03], [0.1, 0.015, -0.03], "#d99a4e", "candy")], 1, "near"],
  [/\b(?:tracks?|footprints?|paw ?prints?|hoof ?prints?|prints)\b/, "tracks", () => [
    ...[0, 1, 2, 3, 4, 5].map((i) => P("disc", [0.1, 0.012, 0.14], [-0.6 + i * 0.25, 0.006, (i % 2 ? 0.07 : -0.07)], "#8a6040", "rubber"))], 1, "trail"],
  [/\b(?:feathers?)\b/, "feather", () => [P("leaf", [0.12, 0.42, 0.02], [0, 0.03, 0], "#f2f2f2", "cloth", { rotate: [-80, 0, 30] }), P("cylinder", [0.015, 0.4, 0.015], [0, 0.035, 0], "#d8d8d8", "plastic", { rotate: [-80, 0, 30] })], 1, "near"],
  [/\b(?:fuzz|fluff|tufts?|fibers?|fibres?|threads?)\b/, "fuzz", () => [P("sphere", [0.13, 0.1, 0.11], [0, 0.06, 0], "#7aa6e6", "fluffy"), P("sphere", [0.08, 0.07, 0.07], [0.08, 0.05, 0.03], "#7aa6e6", "fluffy")], 1, "near"],
  [/\b(?:craters?)\b/, "crater", () => [P("torus", [0.9, 0.5, 0.12], [0, 0.04, 0], "#b9b4c4", "rubber", { rotate: [90, 0, 0] }), P("disc", [0.7, 0.01, 0.4], [0, 0.01, 0], "#8d889a", "rubber")], 1, "front"],
  [/\b(?:moon ?rocks?)\b/, "moon rock", () => [P("sphere", [0.4, 0.28, 0.34], [0, 0.13, 0], "#c9c4d6", "rubber"), P("sphere", [0.08, 0.04, 0.08], [0.06, 0.25, 0.1], "#a9a3b8", "rubber")], 1, "side"],
  [/\b(?:fences?)\b/, "fence", () => [
    ...[-0.6, -0.2, 0.2, 0.6].map((x) => P("box", [0.1, 0.7, 0.06], [x, 0.35, 0], "#e9d8b4", "wood", { round: 0.2 })),
    P("box", [1.4, 0.08, 0.05], [0, 0.5, 0.03], "#e0cda6", "wood"), P("box", [1.4, 0.08, 0.05], [0, 0.22, 0.03], "#e0cda6", "wood")], 1, "back"],
  [/\b(?:sign ?posts?|signs?)\b/, "signpost", () => [P("cylinder", [0.07, 0.9, 0.07], [0, 0.45, 0], "#8b5e3c", "wood"), P("box", [0.6, 0.28, 0.05], [0, 0.82, 0.04], "#e9d8b4", "wood", { round: 0.15 })], 1, "side"],
  [/\b(?:treasure chests?|chests?)\b/, "treasure chest", () => [
    P("box", [0.62, 0.36, 0.4], [0, 0.18, 0], "#9a6a3e", "wood", { round: 0.1 }), P("cylinder", [0.4, 0.62, 0.4], [0, 0.36, 0], "#a8744a", "wood", { rotate: [0, 0, 90], hollow: false }),
    P("box", [0.1, 0.12, 0.05], [0, 0.34, 0.21], "#ffd34d", "metal")], 1, "side"],
  [/\b(?:boxes|box|crates?)\b/, "box", () => [P("box", [0.5, 0.42, 0.42], [0, 0.21, 0], "#c99a62", "paper", { round: 0.05 }), P("box", [0.5, 0.04, 0.12], [0, 0.42, 0], "#b3874f", "paper")], 1, "side"],
  [/\b(?:pine ?cones?|acorns?)\b/, "pinecone", () => [P("sphere", [0.16, 0.22, 0.16], [0, 0.11, 0], "#8b5e3c", "wood"), P("dome", [0.17, 0.08, 0.17], [0, 0.2, 0], "#6b4529", "wood")], 1, "near"],
  [/\b(?:sea ?shells?|shells?)\b/, "seashell", () => [P("dome", [0.26, 0.14, 0.22], [0, 0.0, 0], "#ffd1c2", "plastic"), P("sphere", [0.06, 0.05, 0.05], [0, 0.03, 0.11], "#ffb9a3", "plastic")], 1, "near"],
  [/\b(?:holes?|burrows?)\b/, "hole", () => [P("disc", [0.5, 0.01, 0.28], [0, 0.008, 0], "#4a3426", "rubber"), P("torus", [0.52, 0.3, 0.05], [0, 0.02, 0], "#8b6a4a", "rubber", { rotate: [90, 0, 0] })], 1, "front"],
  [/\b(?:grass|tufts? of grass)\b/, "grass", () => [
    ...[-0.12, -0.04, 0.04, 0.12].map((x, i) => P("leaf", [0.07, 0.3 + (i % 2) * 0.08, 0.02], [x, 0.15, 0], "#62c46b", "plastic", { rotate: [0, 0, (x * 120)] }))], 1, "front"],
  [/\b(?:snow ?drifts?|snow ?piles?|piles? of snow)\b/, "snow pile", () => [P("sphere", [0.8, 0.35, 0.5], [0, 0.12, 0], "#ffffff", "fluffy"), P("sphere", [0.45, 0.28, 0.4], [0.3, 0.12, 0.05], "#f5f8ff", "fluffy")], 1, "side"],
];

export const COLORS = { red: "#e04a3f", blue: "#5b8fe0", green: "#5aa35e", yellow: "#ffd34d", orange: "#f08a3c", purple: "#a77ce0", pink: "#ff8fb1", brown: "#8b5e3c", black: "#3a3a40", white: "#f6f6f6", grey: "#9a9aa3", gray: "#9a9aa3", golden: "#f2c04a", gold: "#f2c04a", silver: "#c8ccd4" };

/** the scenery things one of his lines mentions: [{ name, recipe, at, scale }] (at most `max`) */
export function sceneryIn(text, { max = 3, skip = [] } = {}) {
  const t = ` ${String(text || "").toLowerCase().replace(/[’`]/g, "'")} `, out = [];
  for (const [re, name, parts, scale, at] of SCENERY) {
    if (out.length >= max) break;
    const m = re.exec(t);
    if (!m || skip.includes(name) || out.some((o) => o.name === name)) continue;
    const before = t.slice(Math.max(0, m.index - 30), m.index);
    if (/\b(?:no|not|never|without|isn't|aren't|wasn't)\s+(?:a |an |any |the )?(?:\w+ ){0,2}$/.test(before)) continue;   // "there's no bush here"
    const near = before.split(/[,.;!?]/).pop().trim().split(/\s+/).slice(-3);   // the few words right before it
    const adj = [null, near.find((w) => /^(?:tiny|little|small|teeny|big|giant|huge|enormous)$/.test(w)) || "", near.find((w) => COLORS[w]) || ""];
    let ps = parts();
    const col = adj[2] && COLORS[adj[2]];
    if (col && /fuzz|feather|flowers|rock|box|leaves|tracks|mushroom|fence|signpost|seashell/.test(name)) ps = ps.map((p, i) => (i === 0 || /fuzz|tracks/.test(name) ? { ...p, color: col } : p));
    const sz = /tiny|little|small|teeny/.test(adj[1] || "") ? 0.75 : /big|giant|huge|enormous/.test(adj[1] || "") ? 1.35 : 1;
    out.push({ name: col ? `${adj[2]} ${name}` : name, key: name, at, scale: scale * sz, recipe: { name: col ? `${adj[2]} ${name}` : name, archetype: "companion", parts: ps } });
  }
  return out;
}
