// Bank and money props for Mochi's Money World (Nov 8, the PNC track; Binoy: "add a lot of default bank related
// props"). Hand-made patterns like the rest of his pocket: ready at once ("take out your wallet", the skits, the
// money card), and examples the workbench learns from. No logos or wordmarks on any of them (the standing rule), and
// the money is play money: no real banknote designs. craft.js adds these to PROP_EXAMPLES (validated with the rest).
const p = (shape, size, at, color, material, more = {}) => ({ shape, size, at, color, material, ...more });
const GOLD = "#f2c14e", GOLD2 = "#e0a93a", BILL = "#7cc47f", BILL2 = "#4f9a5a";

export const MONEY_PROPS = {
  handheld_tool: [{
    name: "wallet", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.56, 0.4, 0.09], [0, 0.22, 0], "#9a5b34", "cloth", { round: 0.3, label: "wallet" }),
      p("box", [0.5, 0.18, 0.02], [0, 0.31, 0.05], "#b8723f", "cloth", { round: 0.35, label: "flap" }),
      p("box", [0.44, 0.14, 0.03], [0.02, 0.44, -0.01], BILL, "paper", { round: 0.1, label: "play money peeking out" }),
      p("box", [0.4, 0.12, 0.03], [-0.03, 0.46, -0.025], "#9bd69c", "paper", { round: 0.1, label: "second bill" }),
      p("coin", [0.09, 0.09, 0.03], [0, 0.26, 0.065], GOLD, "metal", { label: "snap button" }),
      p("box", [0.5, 0.015, 0.01], [0, 0.1, 0.048], "#e8c9a0", "cloth", { round: 0.4, label: "stitching" }),
    ],
  }, {
    name: "play money", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.66, 0.32, 0.015], [0.03, 0.3, -0.02], BILL2, "paper", { round: 0.06, label: "bill behind" }),
      p("box", [0.66, 0.32, 0.015], [0, 0.28, 0], BILL, "paper", { round: 0.06, label: "play bill" }),
      p("box", [0.58, 0.25, 0.01], [0, 0.28, 0.009], "#a9dcaa", "paper", { round: 0.06, label: "border" }),
      p("coin", [0.17, 0.17, 0.012], [0, 0.28, 0.014], BILL2, "paper", { label: "middle circle" }),
      p("star", [0.11, 0.11, 0.012], [0, 0.28, 0.022], "#e9f7e3", "paper", { label: "star" }),
      p("coin", [0.06, 0.06, 0.01], [-0.24, 0.39, 0.014], BILL2, "paper", { label: "corner" }),
      p("coin", [0.06, 0.06, 0.01], [0.24, 0.17, 0.014], BILL2, "paper"),
    ],
  }, {
    name: "stack of coins", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("disc", [0.34, 0.06, 0.34], [0, 0.04, 0], GOLD2, "metal", { label: "stack" }),
      p("disc", [0.34, 0.06, 0.34], [0.015, 0.1, 0], GOLD, "metal"),
      p("disc", [0.34, 0.06, 0.34], [-0.01, 0.16, 0], GOLD2, "metal"),
      p("disc", [0.34, 0.06, 0.34], [0.01, 0.22, 0], GOLD, "metal"),
      p("coin", [0.3, 0.3, 0.05], [0.04, 0.42, 0.06], GOLD, "metal", { rotate: [0, 0, -12], label: "coin standing up" }),
      p("star", [0.13, 0.13, 0.03], [0.04, 0.42, 0.09], "#ffd86b", "metal", { rotate: [0, 0, -12] }),
      p("star", [0.07, 0.07, 0.02], [0.22, 0.58, 0.08], "#ffffff", "glow", { label: "sparkle" }),
    ],
  }, {
    name: "money bag", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("sphere", [0.56, 0.5, 0.5], [0, 0.3, 0], "#d9b98a", "cloth", { label: "sack" }),
      p("cone", [0.24, 0.16, 0.24], [0, 0.6, 0], "#d9b98a", "cloth", { rotate: [180, 0, 0], label: "neck" }),
      p("torus", [0.2, 0.2, 0.05], [0, 0.58, 0], "#8a5a33", "cloth", { rotate: [90, 0, 0], label: "tie" }),
      p("dome", [0.3, 0.12, 0.3], [0, 0.64, 0], "#d9b98a", "cloth", { label: "top" }),
      p("coin", [0.24, 0.24, 0.04], [0, 0.3, 0.25], GOLD, "metal", { label: "coin badge" }),
      p("star", [0.12, 0.12, 0.03], [0, 0.3, 0.275], "#ffd86b", "metal"),
      p("coin", [0.1, 0.1, 0.025], [0.2, 0.62, 0.05], GOLD, "metal", { rotate: [0, 0, 20], label: "coin peeking out" }),
    ],
  }, {
    name: "bank card", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.6, 0.38, 0.025], [0, 0.26, 0], "#2fb8a6", "plastic", { round: 0.18, label: "card" }),
      p("box", [0.6, 0.06, 0.012], [0, 0.39, -0.012], "#1d2a3a", "plastic", { round: 0.1, label: "stripe" }),
      p("box", [0.11, 0.09, 0.012], [-0.17, 0.27, 0.014], GOLD, "metal", { round: 0.25, label: "chip" }),
      p("box", [0.32, 0.03, 0.008], [-0.03, 0.17, 0.014], "#d9fff8", "plastic", { round: 0.5, label: "number line" }),
      p("star", [0.1, 0.1, 0.012], [0.19, 0.33, 0.014], "#ffd34d", "plastic", { label: "star" }),
      p("coin", [0.08, 0.08, 0.01], [0.2, 0.15, 0.014], "#ff8fb8", "plastic", { label: "circle" }),
      p("coin", [0.08, 0.08, 0.01], [0.25, 0.15, 0.016], "#ffd34d", "plastic"),
    ],
  }, {
    name: "calculator", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.42, 0.6, 0.08], [0, 0.3, 0], "#5b6b8c", "plastic", { round: 0.2, label: "calculator" }),
      p("box", [0.32, 0.13, 0.02], [0, 0.5, 0.042], "#c9f2c0", "glow", { round: 0.15, label: "screen" }),
      ...[0, 1, 2].flatMap((c) => [0, 1, 2, 3].map((r) => p("box", [0.075, 0.06, 0.03], [-0.1 + c * 0.1, 0.36 - r * 0.075, 0.045], c === 2 && r === 3 ? "#ff8a3d" : "#eef1f7", "plastic", { round: 0.35, ...(c === 0 && r === 0 ? { label: "keys" } : {}) }))),
    ],
  }, {
    name: "receipt", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.32, 0.7, 0.012], [0, 0.4, 0], "#fbfbf6", "paper", { round: 0.02, label: "receipt" }),
      ...[0, 1, 2, 3, 4].map((i) => p("box", [i === 4 ? 0.12 : 0.22, 0.022, 0.006], [i === 4 ? 0.06 : -0.02, 0.65 - i * 0.08, 0.008], "#9aa0ab", "paper", { round: 0.5, ...(i === 0 ? { label: "lines" } : {}) })),
      p("box", [0.24, 0.035, 0.006], [0, 0.24, 0.008], "#2b2f3a", "paper", { round: 0.5, label: "total line" }),
      ...[0, 1, 2, 3].map((i) => p("wedge", [0.08, 0.05, 0.012], [-0.12 + i * 0.08, 0.03, 0], "#fbfbf6", "paper", { rotate: [0, 0, 180], ...(i === 0 ? { label: "torn edge" } : {}) })),
    ],
  }, {
    name: "price tag", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.32, 0.4, 0.02], [0, 0.3, 0], "#ffd34d", "paper", { round: 0.12, label: "tag" }),
      p("wedge", [0.32, 0.14, 0.02], [0, 0.56, 0], "#ffd34d", "paper", { label: "pointed top" }),
      p("torus", [0.07, 0.07, 0.02], [0, 0.55, 0.012], "#c98a0c", "metal", { label: "hole" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#e5484d", "cloth", { points: [[0, 0.56, 0.01], [0.08, 0.68, 0.02], [0.2, 0.7, 0.02]], thick: 0.018, label: "string" }),
      p("coin", [0.14, 0.14, 0.012], [0, 0.32, 0.014], "#ffffff", "paper", { label: "price circle" }),
      p("star", [0.08, 0.08, 0.01], [0, 0.32, 0.022], "#e5484d", "paper"),
      p("box", [0.2, 0.025, 0.006], [0, 0.17, 0.013], "#c98a0c", "paper", { round: 0.5 }),
    ],
  }, {
    name: "gold bar", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.5, 0.18, 0.26], [0, 0.1, 0], GOLD2, "metal", { round: 0.12, taper: 0.8, label: "gold bar" }),
      p("box", [0.38, 0.06, 0.16], [0, 0.21, 0], GOLD, "metal", { round: 0.2, label: "top" }),
      p("star", [0.1, 0.1, 0.02], [0, 0.1, 0.135], "#ffe9a3", "metal", { label: "stamp" }),
      p("star", [0.08, 0.08, 0.02], [0.17, 0.25, 0.06], "#ffffff", "glow", { label: "sparkle" }),
    ],
  }, {
    name: "shopping bag", archetype: "handheld_tool", hold: "upright",
    parts: [
      p("box", [0.5, 0.48, 0.24], [0, 0.26, 0], "#ff8fb8", "paper", { round: 0.06, label: "bag" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#c9407a", "cloth", { points: [[-0.12, 0.49, 0.12], [-0.08, 0.66, 0.12], [0.08, 0.66, 0.12], [0.12, 0.49, 0.12]], thick: 0.03, label: "handle" }),
      p("tube", [1, 1, 1], [0, 0, 0], "#c9407a", "cloth", { points: [[-0.12, 0.49, -0.12], [-0.08, 0.66, -0.12], [0.08, 0.66, -0.12], [0.12, 0.49, -0.12]], thick: 0.03 }),
      p("heart", [0.18, 0.16, 0.02], [0, 0.26, 0.125], "#ffffff", "paper", { label: "heart" }),
      p("box", [0.2, 0.12, 0.03], [0.1, 0.52, 0], "#7cc47f", "paper", { round: 0.2, label: "something inside" }),
    ],
  }],

  companion: [{
    name: "savings jar", archetype: "companion",
    parts: [
      p("cylinder", [0.46, 0.56, 0.46], [0, 0.28, 0], "#cfeeff", "glass", { hollow: true, label: "glass jar" }),
      p("cylinder", [0.48, 0.08, 0.48], [0, 0.6, 0], "#3fae6a", "metal", { label: "lid" }),
      p("box", [0.1, 0.012, 0.025], [0, 0.645, 0], "#1f3a2a", "rubber", { round: 0.4, label: "coin slot" }),
      // (Nov 8: drawn full; money-look.js shrinks the pile to what's really saved and sets the top coins on it)
      p("cylinder", [0.38, 0.44, 0.38], [0, 0.24, 0], GOLD2, "metal", { label: "coin pile" }),
      p("coin", [0.16, 0.16, 0.04], [-0.07, 0.49, 0.04], GOLD, "metal", { rotate: [0, 0, 25], label: "top coin" }),
      p("coin", [0.16, 0.16, 0.04], [0.08, 0.49, -0.04], GOLD, "metal", { rotate: [0, 0, -30], label: "top coin 2" }),
      p("box", [0.36, 0.14, 0.02], [0, 0.34, 0.235], "#fff4cf", "paper", { round: 0.2, label: "label" }),
      p("star", [0.09, 0.09, 0.015], [0, 0.34, 0.25], "#3fae6a", "paper"),
      p("star", [0.12, 0.12, 0.02], [0.16, 0.68, 0], "#fff3a0", "glow", { label: "sparkle" }),
    ],
  }, {
    name: "three money jars", archetype: "companion",
    parts: [
      p("box", [1.3, 0.05, 0.42], [0, 0.025, 0], "#c99a62", "wood", { round: 0.3, label: "tray" }),
      ...[["#ff8a3d", "heart"], ["#3fae6a", "star"], ["#5ec8ff", "coin"]].flatMap(([lid, mark], i) => {
        const x = -0.42 + i * 0.42;
        return [
          p("cylinder", [0.32, 0.46, 0.32], [x, 0.28, 0], "#e6f6ff", "glass", { hollow: true, ...(i === 0 ? { label: "jar: spend" } : i === 1 ? { label: "jar: save" } : { label: "jar: share" }) }),
          p("cylinder", [0.34, 0.07, 0.34], [x, 0.54, 0], lid, "metal", { label: "lid" }),
          p("cylinder", [0.26, 0.4, 0.26], [x, 0.27, 0], GOLD, "metal", { label: ["spend money", "save money", "share money"][i] }),   // (drawn full: money-look.js)
          p(mark, [0.12, 0.12, 0.02], [x, 0.35, 0.165], lid, "paper", { label: "sign" }),
        ];
      }),
    ],
  }, {
    name: "cash register", archetype: "companion",
    parts: [
      p("box", [0.8, 0.3, 0.6], [0, 0.15, 0], "#ff6f91", "plastic", { round: 0.12, label: "base" }),
      p("box", [0.7, 0.1, 0.34], [0, 0.12, 0.15], "#ffd34d", "plastic", { round: 0.2, label: "drawer" }),   // (slides out when tapped: moving.js)
      p("coin", [0.06, 0.06, 0.02], [0, 0.12, 0.33], "#5a2a14", "plastic", { label: "drawer knob" }),
      p("box", [0.5, 0.03, 0.2], [0, 0.185, 0.1], BILL, "paper", { round: 0.1, label: "drawer cash" }),
      p("wedge", [0.6, 0.22, 0.4], [0, 0.4, 0.06], "#ff8fb0", "plastic", { rotate: [0, 90, 0], label: "keyboard slope" }),
      ...[0, 1, 2].flatMap((c) => [0, 1].map((r) => p("box", [0.1, 0.03, 0.08], [-0.16 + c * 0.16, 0.36 + r * 0.06, 0.16 - r * 0.08], ["#ffffff", "#ffd34d", "#7cc47f"][c], "plastic", { round: 0.4, ...(c === 0 && r === 0 ? { label: "keys" } : {}) }))),
      p("cylinder", [0.06, 0.3, 0.06], [0, 0.44, -0.2], "#3a3550", "plastic", { label: "screen post" }),
      p("box", [0.36, 0.2, 0.1], [0, 0.66, -0.15], "#3a3550", "plastic", { round: 0.25, label: "screen box" }),
      p("box", [0.28, 0.12, 0.02], [0, 0.67, -0.095], "#bff0c7", "glow", { round: 0.2, label: "screen" }),
      p("star", [0.07, 0.07, 0.01], [0, 0.67, -0.083], "#2b8a4a", "glow"),
    ],
  }, {
    name: "little bank", archetype: "companion",
    parts: [
      p("box", [1.0, 0.08, 0.6], [0, 0.04, 0], "#d8d2c4", "plastic", { round: 0.2, label: "bottom step" }),
      p("box", [0.9, 0.08, 0.52], [0, 0.12, 0], "#e8e3d6", "plastic", { round: 0.2, label: "top step" }),
      p("box", [0.78, 0.5, 0.4], [0, 0.41, -0.04], "#f5efe0", "plastic", { round: 0.06, label: "building" }),
      ...[-0.32, -0.11, 0.11, 0.32].map((x, i) => p("cylinder", [0.1, 0.5, 0.1], [x, 0.41, 0.2], "#ffffff", "plastic", { ...(i === 0 ? { label: "columns" } : {}) })),
      p("box", [0.9, 0.07, 0.5], [0, 0.69, 0], "#e8e3d6", "plastic", { round: 0.2, label: "ledge" }),
      p("wedge", [0.92, 0.28, 0.46], [0, 0.86, 0], "#5ec8ff", "plastic", { label: "roof" }),
      p("coin", [0.16, 0.16, 0.03], [0, 0.82, 0.235], GOLD, "metal", { label: "coin emblem" }),
      p("star", [0.12, 0.12, 0.02], [0, 0.82, 0.26], "#ffd86b", "metal", { label: "star spinner" }),   // (spins while money grows in there: money-look.js)
      p("box", [0.16, 0.28, 0.02], [0, 0.3, 0.17], BILL, "paper", { round: 0.1, label: "money inside" }),
      p("box", [0.18, 0.3, 0.02], [0, 0.3, 0.19], "#8a5a33", "wood", { round: 0.3, label: "door" }),
      p("coin", [0.03, 0.03, 0.01], [0.05, 0.3, 0.205], GOLD, "metal", { label: "door knob" }),
    ],
  }, {
    name: "safe", archetype: "companion",
    parts: [
      p("box", [0.66, 0.7, 0.56], [0, 0.37, 0], "#6b7a90", "metal", { round: 0.12, label: "safe" }),
      p("box", [0.54, 0.58, 0.04], [0, 0.37, 0.28], "#7f8ea6", "metal", { round: 0.1, label: "door" }),
      p("coin", [0.24, 0.24, 0.05], [0, 0.45, 0.31], "#c9ced6", "metal", { label: "dial" }),
      p("coin", [0.12, 0.12, 0.06], [0, 0.45, 0.33], "#2b2f3a", "metal", { label: "dial knob" }),
      p("box", [0.02, 0.05, 0.01], [0, 0.55, 0.335], "#e5484d", "plastic", { round: 0.3, label: "dial mark" }),
      p("capsule", [0.05, 0.22, 0.05], [0.17, 0.25, 0.32], "#c9ced6", "metal", { rotate: [0, 0, 90], label: "handle" }),
      p("box", [0.06, 0.14, 0.04], [-0.27, 0.56, 0.3], "#4d5a6e", "metal", { round: 0.3, label: "hinge" }),
      p("box", [0.06, 0.14, 0.04], [-0.27, 0.18, 0.3], "#4d5a6e", "metal", { round: 0.3 }),
      p("cylinder", [0.08, 0.05, 0.08], [-0.24, 0.025, -0.2], "#2b2f3a", "rubber", { label: "foot" }),
      p("cylinder", [0.08, 0.05, 0.08], [0.24, 0.025, -0.2], "#2b2f3a", "rubber"),
    ],
  }, {
    name: "money machine", archetype: "companion",
    parts: [
      p("box", [0.62, 1.0, 0.44], [0, 0.5, 0], "#3f7fd6", "plastic", { round: 0.12, label: "money machine (ATM)" }),
      p("box", [0.5, 0.12, 0.06], [0, 0.94, 0.2], "#2f63ad", "plastic", { round: 0.3, label: "top light" }),
      p("box", [0.4, 0.26, 0.03], [0, 0.72, 0.222], "#bff0ff", "glow", { round: 0.12, label: "screen" }),
      p("coin", [0.1, 0.1, 0.01], [0, 0.73, 0.24], "#3f7fd6", "glow"),
      ...[0, 1, 2].flatMap((c) => [0, 1, 2].map((r) => p("box", [0.07, 0.05, 0.03], [-0.09 + c * 0.09, 0.5 - r * 0.07, 0.235], c === 2 && r === 2 ? "#3fae6a" : "#eef1f7", "plastic", { round: 0.35, ...(c === 0 && r === 0 ? { label: "keypad" } : {}) }))),
      p("box", [0.22, 0.03, 0.04], [0.16, 0.3, 0.23], "#1d2a3a", "plastic", { round: 0.5, label: "card slot" }),
      p("box", [0.36, 0.04, 0.05], [0, 0.18, 0.23], "#1d2a3a", "plastic", { round: 0.5, label: "money slot" }),
      p("box", [0.2, 0.1, 0.012], [0, 0.13, 0.25], BILL, "paper", { round: 0.1, label: "play money" }),
    ],
  }, {
    name: "lemonade stand", archetype: "companion",
    parts: [
      p("box", [1.1, 0.6, 0.45], [0, 0.3, 0], "#f4d38a", "wood", { round: 0.06, label: "counter" }),
      p("box", [1.12, 0.06, 0.5], [0, 0.62, 0], "#d9a95b", "wood", { round: 0.2, label: "counter top" }),
      p("box", [0.9, 0.18, 0.02], [0, 0.36, 0.23], "#ffffff", "paper", { round: 0.2, label: "sign" }),
      p("drop", [0.1, 0.13, 0.02], [-0.3, 0.36, 0.245], "#ffd34d", "paper", { label: "lemon" }),
      p("star", [0.09, 0.09, 0.02], [0, 0.36, 0.245], "#ff8a3d", "paper"),
      p("heart", [0.1, 0.09, 0.02], [0.3, 0.36, 0.245], "#ff6f91", "paper"),
      p("cylinder", [0.06, 0.62, 0.06], [-0.5, 0.95, -0.15], "#c99a62", "wood", { label: "post" }),
      p("cylinder", [0.06, 0.62, 0.06], [0.5, 0.95, -0.15], "#c99a62", "wood"),
      p("box", [1.2, 0.08, 0.5], [0, 1.28, -0.05], "#ff6f91", "cloth", { rotate: [14, 0, 0], round: 0.3, pattern: "stripes", pattern_color: "#ffffff", label: "striped awning" }),
      p("cylinder", [0.14, 0.24, 0.14], [0.28, 0.77, 0.05], "#fff6a8", "glass", { label: "pitcher" }),
      p("cylinder", [0.09, 0.12, 0.09], [-0.1, 0.71, 0.08], "#fff6a8", "glass", { label: "cup" }),
      p("cylinder", [0.09, 0.12, 0.09], [-0.28, 0.71, 0.08], "#fff6a8", "glass"),
      p("disc", [0.12, 0.03, 0.12], [-0.42, 0.66, 0.1], GOLD, "metal", { label: "pile of money" }),
    ],
  }, {
    name: "growing money tree", archetype: "companion",
    parts: [
      p("cylinder", [0.36, 0.28, 0.36], [0, 0.14, 0], "#d8743f", "plastic", { taper: 1.25, label: "pot" }),
      p("disc", [0.34, 0.03, 0.34], [0, 0.29, 0], "#6b4a2a", "rubber", { label: "soil" }),
      p("cylinder", [0.08, 0.5, 0.08], [0, 0.52, 0], "#8a5a33", "wood", { label: "trunk" }),
      p("sphere", [0.62, 0.48, 0.5], [0, 0.88, 0], "#5bbf6a", "fluffy", { label: "leaves" }),
      ...[[-0.2, 0.92, 0.22], [0.16, 1.02, 0.2], [0.04, 0.78, 0.25], [0.24, 0.82, 0.12], [-0.12, 1.07, 0.12]].map((at) => p("coin", [0.12, 0.12, 0.03], at, GOLD, "metal", { label: "money coin" })),   // (one more for each interest payment: money-look.js)
      p("star", [0.07, 0.07, 0.02], [0.3, 1.1, 0.15], "#ffffff", "glow", { label: "sparkle" }),
    ],
  }],
};
