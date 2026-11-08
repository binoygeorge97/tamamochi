// Money props that show what's inside (Nov 8, Binoy: "make the money props more engaging and detailed so that it is
// more fun for kids to play with it and also finds value in it"). The hand-made money patterns (pocket-money.js, the
// piggy bank in craft.js) are drawn FULL; moneyLook() shrinks or takes away the parts that hold money so the prop on
// stage matches the real numbers:
//   - savings jar, piggy bank: how much is saved for the goal (the coin pile; a sparkle when the goal is reached),
//   - three money jars: spend = the wallet, save = the piggy bank, share = what they've given,
//   - little bank (Mochi Bank): the money behind its door, and its star spins while money is growing in there,
//   - cash register: cash in the drawer once something was bought this week,
//   - growing money tree: one more coin for each time Mochi Bank paid interest,
//   - wallet: play money peeking out only when there's money in it.
// Pure, and only by label: a part is kept, shrunk from the bottom up, moved, or relabelled (so it stops spinning or
// starts sparkling). Nothing is added, so a dressed prop never has more parts than the validated pattern.

/** how full, 0 (empty) to 4 (full): `full` is the amount that fills it */
export function fillLevel(have, full) {
  const h = Number(have) || 0, f = Number(full) || 0;
  if (h <= 0) return 0;
  if (!(f > 0)) return 2;
  return Math.max(1, Math.min(4, Math.ceil((h / f) * 4)));
}

/** the numbers the props show, from the money state (money.js moneyState) and the savings goal */
export function lookState(money, savings, now = Date.now()) {
  const s = money && typeof money === "object" ? money : {}, sv = savings && savings.goal ? savings : null, log = Array.isArray(s.log) ? s.log : [];
  const week = log.filter((e) => now - Date.parse(e.at) < 7 * 86400000);
  return {
    wallet: Math.max(0, Number(s.wallet) || 0),
    saved: sv ? Math.max(0, Number(sv.saved) || 0) : 0, target: sv && sv.target ? Number(sv.target) : null, goal: sv ? sv.goal : null,
    bank: s.bank ? Math.max(0, Number(s.bank.balance) || 0) : 0,
    shared: Math.max(0, Number(s.shared) || 0),
    spentWeek: Math.round(week.filter((e) => e.kind === "spend").reduce((a, e) => a + (Number(e.amount) || 0), 0) * 100) / 100,
    pays: log.filter((e) => e.kind === "interest").length,
  };
}

const copy = (r) => ({ ...r, parts: r.parts.map((p) => ({ ...p, size: [...p.size], at: [...p.at] })) });
/** shrink a part from its bottom up to `k` (0..1) of its height; returns its new top */
function shrink(p, k) {
  const bottom = p.at[1] - p.size[1] / 2;
  p.size[1] = Math.max(0.02, p.size[1] * k); p.at[1] = bottom + p.size[1] / 2;
  return bottom + p.size[1];
}
const L = (p) => String(p.label || "");

/** the prop dressed for the numbers (a copy); props it doesn't know come back as they are */
export function moneyLook(recipe, st) {
  if (!recipe || !Array.isArray(recipe.parts) || !st) return recipe;
  const name = String(recipe.name || "");
  const savedFull = st.target || 20, goalDone = !!(st.target && st.saved >= st.target);
  if (name === "savings jar") {
    const r = copy(recipe), lv = fillLevel(st.saved, savedFull);
    let top = null;
    r.parts = r.parts.filter((p) => {
      if (L(p) === "coin pile") { if (!lv) return false; top = shrink(p, lv / 4); return true; }
      if (L(p) === "sparkle") return goalDone;
      return true;
    });
    r.parts = r.parts.filter((p) => !(L(p).startsWith("top coin") && top == null));
    for (const p of r.parts) if (L(p).startsWith("top coin") && top != null) p.at[1] = top + p.size[1] * 0.3;
    return r;
  }
  if (name === "piggy bank") {
    const r = copy(recipe);
    r.parts = r.parts.filter((p) => !(L(p) === "coin" && !(st.saved > 0)));
    for (const p of r.parts) if (L(p) === "coin" && goalDone) p.label = "coin sparkle";
    return r;
  }
  if (name === "three money jars") {
    const r = copy(recipe), lv = { "spend money": fillLevel(st.wallet, 10), "save money": fillLevel(st.saved, savedFull), "share money": fillLevel(st.shared, 5) };
    r.parts = r.parts.filter((p) => { const k = lv[L(p)]; if (k === undefined) return true; if (!k) return false; shrink(p, k / 4); return true; });
    return r;
  }
  if (name === "little bank") {
    const r = copy(recipe), lv = fillLevel(st.bank, 20);
    r.parts = r.parts.filter((p) => { if (L(p) !== "money inside") return true; if (!lv) return false; shrink(p, lv / 4); return true; });
    if (!(st.bank > 0)) for (const p of r.parts) if (L(p) === "star spinner") p.label = "star";
    return r;
  }
  if (name === "cash register") {
    const r = copy(recipe);
    if (!(st.spentWeek > 0)) r.parts = r.parts.filter((p) => L(p) !== "drawer cash");
    return r;
  }
  if (name === "growing money tree") {
    const r = copy(recipe), n = Math.min(5, 1 + (st.pays || 0));
    let i = 0;
    r.parts = r.parts.filter((p) => (L(p) === "money coin" ? i++ < n : L(p) === "sparkle" ? (st.pays || 0) >= 3 : true));
    return r;
  }
  if (name === "wallet") {
    const r = copy(recipe);
    r.parts = r.parts.filter((p) => !((L(p) === "play money peeking out" && !(st.wallet > 0)) || (L(p) === "second bill" && !(st.wallet >= 5))));
    return r;
  }
  return recipe;
}
/** the money props moneyLook dresses (the page's taps on these say the numbers) */
export const LOOK_PROPS = ["savings jar", "piggy bank", "three money jars", "little bank", "cash register", "growing money tree", "wallet", "play money", "safe", "money machine", "lemonade stand"];
