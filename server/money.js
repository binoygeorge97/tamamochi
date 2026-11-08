// Mochi's Money World (Nov 8, the PNC track: "help someone see their whole financial picture, make sense of it and
// feel confident about their next move"; a PNC sponsor: "an interactive, gamified environment where kids learn about
// saving, budgeting, banking, credit and responsible spending … virtual money … AI mentors").
//
// Play money only. The kid earns play dollars by doing jobs and chores with Mochi, keeps them in a wallet, saves them
// in his piggy bank (the savings goal from Nov 3: `savings` in memory), buys treats at Mimi's stand, and can lend to
// Cocoa, who pays back a dollar extra for waiting. Mochi is the coach:
//   - the money card: the whole picture in one place (wallet, piggy bank and goal, what Cocoa owes),
//   - three health indicators in kid words (saving habit, spend/save balance, goal progress),
//   - a forecast worked out from what they really saved ("at about $3 a save, 2 more saves to the kite"), never a
//     made-up date,
//   - "what if": both futures acted out by Mochi and Mimi before the kid decides; the pick is applied for real,
//   - teaching Mimi a money rule, which she remembers and uses next time (learning by teaching, as with scams).
// Pure: index.js keeps the state in memory (kv "money" and "savings") and plays the scenes.

const Name = (w) => (w === "mimi" ? "Mimi" : "Cocoa");
export const fmt = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };   // ($0.50, $3, $16.29)
const DAY = 86400000;
/** "kite" → "the kite" ("a new bike", "my bike" stay as they are) */
export const the = (g) => (/^(?:a|an|the|my|your|his|her|our|some)\b/i.test(String(g || "")) ? String(g) : `the ${g}`);

// Mimi's stand: play prices, and the pocket pattern that's handed over (so it's on stage at once)
export const PRICES = [
  { re: /cupcakes?|muffins?/, name: "cupcake", price: 3, prop: "cupcake", food: true },
  { re: /cookies?|biscuits?/, name: "cookie", price: 1, prop: "cookie", food: true },
  { re: /ice ?creams?|ice cream cones?|sundaes?/, name: "ice cream", price: 3, prop: "ice cream cone", food: true },
  { re: /popcorn/, name: "popcorn", price: 2, prop: "popcorn", food: true },
  { re: /pizza(?: slices?)?/, name: "pizza slice", price: 3, prop: "pizza slice", food: true },
  { re: /apples?/, name: "apple", price: 1, prop: "apple", food: true },
  { re: /hot cocoa|hot chocolate/, name: "hot cocoa", price: 2, prop: "hot cocoa", food: true },
  { re: /candy|candies|sweets|lollipops?|gum/, name: "candy", price: 1, prop: "cookie", food: true },
  { re: /balloons?/, name: "balloon", price: 2, prop: "red balloon" },
  { re: /books?|comics?|comic books?/, name: "comic book", price: 5, prop: "book" },
  { re: /stickers?/, name: "sticker", price: 1, prop: null },
  { re: /teddy(?: bear)?|plush(?:ie)?|stuffed animal/, name: "teddy bear", price: 6, prop: "little teddy bear" },
  { re: /video games?|games?/, name: "video game", price: 15, prop: "present" },
  { re: /toys?|toy cars?|action figures?|dolls?|lego|legos/, name: "toy", price: 8, prop: "present" },
  { re: /bows?|sparkly bows?|hair clips?/, name: "sparkly bow", price: 4, prop: "present" },
];
const SMALL = { name: "cookie", price: 1, prop: "cookie", food: true };   // the smaller treat (choice 3)
const PLURAL = { popcorn: "popcorn", "hot cocoa": "cups of hot cocoa", candy: "candies", treat: "treats" };
export const plural = (n) => PLURAL[n] || (/(?:s|sh|ch|x)$/.test(n) ? `${n}es` : `${n}s`);

// "$5", "5 dollars", "five bucks"
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifteen: 15, a: 1 };
export function amountIn(text) {
  const t = String(text || "").toLowerCase();
  let m = /\$\s?(\d{1,4}(?:\.\d{1,2})?)/.exec(t) || /\b(\d{1,4}(?:\.\d{1,2})?)\s*(?:dollars?|bucks?|coins?)\b/.exec(t);
  if (m) return Math.round(Number(m[1]) * 100) / 100;
  m = /\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+(?:dollars?|bucks?|coins?)\b/.exec(t);
  return m ? NUM[m[1]] : null;
}
export function treatIn(text) {
  const t = String(text || "").toLowerCase();
  for (const p of PRICES) { const m = new RegExp(`\\b(?:${p.re.source})\\b`).exec(t); if (m) return { ...p, said: m[0] }; }
  return null;
}

/** the state kept in memory ("money"), filled in */
export function moneyState(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return { wallet: Math.max(0, Number(s.wallet) || 0), log: Array.isArray(s.log) ? s.log.slice(-60) : [], loan: s.loan || null, allowance: Number(s.allowance) || null,
    pending: s.pending || null, mimi: s.mimi || { rule: null }, earnedAt: Number(s.earnedAt) || 0, started: s.started || null,
    skits: s.skits && typeof s.skits === "object" ? s.skits : { recent: [], played: 0, right: 0 }, skitAt: Number(s.skitAt) || 0,
    bank: s.bank && typeof s.bank === "object" ? { balance: Math.max(0, Number(s.bank.balance) || 0), paidAt: Number(s.bank.paidAt) || Date.now(), interest: Number(s.bank.interest) || 0 } : null,
    shared: Math.max(0, Number(s.shared) || 0) };
}
export function logIt(s, kind, amount, what, now = Date.now()) {
  s.log = [...s.log, { at: new Date(now).toISOString(), kind, amount: Math.round(amount * 100) / 100, what: String(what || "").slice(0, 60) }].slice(-60);
  if (!s.started) s.started = new Date(now).toISOString();
  return s;
}

// ---- Mochi Bank: money kept there earns interest, 5% a week (a play rate, said so on the card), paid once a week
export const BANK_RATE = 0.05;
const WEEK = 7 * 86400000;
const r2 = (n) => Math.round(n * 100) / 100;
/** interest owed since it was last paid (whole weeks only); returns what was added */
export function accrue(s, now = Date.now()) {
  if (!s.bank || !(s.bank.balance > 0)) return 0;
  const weeks = Math.floor((now - s.bank.paidAt) / WEEK);
  if (weeks <= 0) return 0;
  const before = s.bank.balance;
  s.bank.balance = r2(before * Math.pow(1 + BANK_RATE, Math.min(weeks, 52))); s.bank.paidAt += weeks * WEEK;
  const gain = r2(s.bank.balance - before); s.bank.interest = r2((s.bank.interest || 0) + gain);
  if (gain > 0) logIt(s, "interest", gain, "Mochi Bank interest", now);
  return gain;
}
/** the forecast chart: the same money in the piggy bank (stays put) and in Mochi Bank (grows), week by week */
export function growth(amount, weeks, rate = BANK_RATE) {
  const a = Math.max(1, Math.min(10000, Number(amount) || 10)), w = Math.max(1, Math.min(52, weeks || 8));
  const bank = Array.from({ length: w + 1 }, (_, i) => r2(a * Math.pow(1 + rate, i)));
  return { amount: a, weeks: w, rate, bank, piggy: a, end: bank[w], interest: r2(bank[w] - a) };
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---- what they said
const T = (text) => String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
/**
 * moneyIntent(text, state) → null, or one of:
 *   { kind: "card" }                         "how's my money?", "show me my wallet", "what's my budget?"
 *   { kind: "whatif", treat, price }         "what if I buy the cupcake?", "should I buy a toy for $8?"
 *   { kind: "whatif_save", amount }          "what if I save $2 every time?"
 *   { kind: "buy", treat, price }            "buy a cupcake from Mimi", "can I get the ice cream?"
 *   { kind: "allowance", amount }            "here's my allowance", "I get $5 a week"
 *   { kind: "save_all" }                     "put my money in the piggy bank", "save my wallet"
 *   { kind: "lend", who, amount }            "lend Cocoa $5", "Cocoa wants to borrow money"
 *   { kind: "earn_how" }                     "how can I earn money?", "I want to earn money"
 *   { kind: "teach_money" }                  "teach me about money", "play the money game"
 *   { kind: "pick", n }                      the answer to a waiting what-if / loan / Mimi question
 */
export function moneyIntent(text, state = moneyState(null), now = Date.now()) {
  const t = T(text); if (!t || t.length > 240) return null;
  const p = state.pending && now - (state.pending.at || 0) < 10 * 60000 ? state.pending : null;
  const asking = /\bwhat if\b|\bshould i\b|\bwhat (?:would|will) happen\b/.test(t);   // (a new question is a new what-if, not the pick: Nov 8)
  if (p && !asking) {   // a question is waiting: the pick
    const pick = pickOf(t, p);
    if (pick) return { kind: "pick", n: pick, pending: p };
  }
  if (/\b(?:scams?|scammers?|phishing)\b/.test(t)) return null;   // (the scam game and checker)
  // Mochi Bank (Nov 8): "what if I keep $10 in the bank for 8 weeks?" (the growth chart), "put $5 in the bank",
  // "take $3 out of the bank", "open a bank account"; giving: "donate $1 to the animal shelter"
  const bankWord = /\b(?:mochi bank|the bank|my bank|a bank|bank account|savings account)\b/.test(t) && !/\bpiggy\b/.test(t);
  if (bankWord && /\b(?:what if|how much (?:will|would|could)|grow|if i (?:keep|leave|put))\b/.test(t) && /\b(?:weeks?|months?|years?|grow|interest)\b/.test(t)) {
    const n = /\b(\d{1,3})\s*(weeks?|months?|years?)\b/.exec(t), unit = n ? n[2][0] : "w";
    const weeks = n ? Math.min(52, Math.max(1, Number(n[1]) * (unit === "m" ? 4 : unit === "y" ? 52 : 1))) : 8;
    return { kind: "grow", amount: amountIn(t), weeks };
  }
  if (bankWord && /\b(?:take|get|withdraw|pull)\b.{0,30}\bout\b|\bwithdraw\b/.test(t)) return { kind: "withdraw", amount: amountIn(t), all: /\b(?:all|everything)\b/.test(t) };
  if (bankWord && (/\b(?:put|deposit|save|keep|move)\b/.test(t) || /\bopen (?:a|my) (?:bank|savings) account\b/.test(t)) && !/\b(?:what if|should)\b/.test(t)) return { kind: "deposit", amount: amountIn(t), all: /\b(?:all|everything|my money|my wallet)\b/.test(t) && !amountIn(t) };
  if (/\b(?:give|donate|share)\b.{0,30}\b(?:to|with) (?:the )?(?:animal shelter|shelter|charity|someone in need|people in need|food bank|share jar)\b|\b(?:put|drop)\b.{0,20}\bin(?:to)? (?:the |my )?share jar\b|\bdonate\b/.test(t)) return { kind: "share", amount: amountIn(t) || 1 };
  // what if: only about money (Nov 8: "what if you get sick?", "what if we save the princess?" were money scenes):
  // a treat from Mimi's stand, an amount, or a money word
  if (/\bwhat if (?:i|we)\b|\bshould (?:i|we) (?:buy|get|spend|save)\b|\bis it (?:ok(?:ay)?|smart|a good idea) (?:to|if i) (?:buy|get|spend)\b|\bwhat (?:would|will) happen if (?:i|we)\b/.test(t)) {
    const a = amountIn(t), money = /\b(?:money|dollars?|bucks|coins|cash|allowance|wallet|piggy ?bank|savings?)\b/.test(t);
    if (/\b(?:save|saving|put)\b.*\b(?:every|each|a week|weekly|per)\b/.test(t) && !/\b(?:buy|spend)\b/.test(t) && (a || money)) return { kind: "whatif_save", amount: a || 2 };
    const tr = treatIn(t), spend = /\b(?:buy|spend|purchase|afford)\b/.test(t), all = /\b(?:all|every(?:thing| bit)?(?: of)?) (?:my|of my|our) (?:money|coins|dollars|wallet)\b/.test(t);
    if (tr && (spend || /\bget\b/.test(t) || a)) return { kind: "whatif", treat: tr, price: a || tr.price };
    if (spend && (a || all)) { const item = itemIn(t); return { kind: "whatif", treat: { name: item || "treat", price: a || 0, prop: "present" }, price: a || 0, all }; }
    if (spend && !tr) { const item = itemIn(t); if (item) return { kind: "whatif_price", item }; }   // "should I buy a new bike?": how much is it?
    if (/\b(?:save|skip)\b/.test(t) && (a || money)) return { kind: "whatif_save", amount: a || 2 };
  }
  if (/\b(?:how'?s|how is|how am i doing with|show(?: me)?|check|see|look at|open|what'?s(?: in)?|what is(?: in)?|tell me about)\b.{0,12}\bmy (?:money|wallet|budget|finances|savings|money card)\b(?! (?:for|on) )/.test(t)
    || /\bhow much money (?:do i|have i)\b|\bmoney (?:card|check(?:-?up)?|picture)\b|\bhow am i doing with (?:my )?(?:money|saving)/.test(t)) return { kind: "card" };
  if (/\b(?:lend|loan|borrow(?:s|ing)?)\b/.test(t) && (/\b(?:money|dollars?|bucks|coins|cash)\b/.test(t) || amountIn(t)) && !/\b(?:borrowed|lent)\b/.test(t)) {   // (money only: "can Mimi borrow your umbrella?" isn't a loan)
    const who = /\bmimi\b/.test(t) ? "mimi" : "cocoa";
    return { kind: "lend", who, amount: amountIn(t), asked: /\b(?:wants? to|asks? to|asked to|needs? to) borrow\b|\bcan (?:cocoa|mimi) borrow\b/.test(t) ? "them" : "you" };
  }
  if (/\b(?:allowance|pocket money)\b/.test(t) && !/\b(?:no|not|don'?t|didn'?t|doesn'?t|never|stopped|took away|lost|without)\b/.test(t)
    && /\b(?:here'?s|here is|got|get|gets|give me|gave me|it'?s|allowance day|my allowance|pocket money)\b/.test(t)) return { kind: "allowance", amount: amountIn(t) };
  if (/\b(?:how (?:can|do) i|i want to|let'?s|help me|can i|ways to)\s+(?:earn|make)\s+(?:some )?(?:money|dollars|coins|cash)\b|\bearn (?:some )?money\b/.test(t)) return { kind: "earn_how" };
  if (moneySkitAsk(t, state)) return { kind: "skit", topic: skitTopic(t.replace(/\b(?:money|skits?|scenes?|story|game)\b/g, "")) };
  if (/\b(?:teach me about|learn about|play the|start the)\s+(?:money|saving|budget(?:ing)?|banks?|banking)(?: game| world)?\b|\bmoney (?:game|world)\b/.test(t) || MONEY_SKILL_ASK.test(t)) return { kind: "teach_money" };
  if (/\b(?:put|save|move)\b.{0,12}\b(?:my|all my|the|all the)\s+(?:money|wallet|coins|dollars|cash)\b.{0,25}\b(?:piggy ?bank|savings?|save)?/.test(t) && !amountIn(t)) return { kind: "save_all" };
  // buying: said with "buy" (or from Mimi's stand); "can I have a cookie?" is asking him for one, not shopping
  const buy = /\b(?:buy|purchase|pay for)\b/.test(t) || (/\b(?:get|have|take)\b/.test(t) && /\b(?:from mimi|mimi'?s stand|at the stand|from the stand|with my (?:money|coins|wallet))\b/.test(t));
  if (buy && !/\b(?:don'?t|not|never|bought)\b/.test(t)) { const tr = treatIn(t); if (tr) { const a = amountIn(t); return { kind: "buy", treat: tr, price: a || tr.price }; } }
  return null;
}
/** the thing in "should I buy a new bike?", "what if I spend $12 on shoes?" (a few words, or null) */
export function itemIn(t) {
  const m = /\b(?:buy|purchase|afford|spend [^ ]+ on|spend (?:all )?(?:my|our) (?:money|coins) on|spend it on)\s+(?:a |an |the |some |my |those |these |that |this )?([a-z][a-z' -]{1,24}?)(?=\s+(?:for|with|now|today|instead|from|at)\b|[?!.,]|$)/.exec(t);
  if (!m) return null;
  const w = m[1].trim();
  return /^(?:it|that|this|them|one|something|stuff|things?|all|everything)$/.test(w) ? null : w;
}
function pickOf(t, p) {
  const m = /^\s*(?:(?:i (?:pick|choose|want)|number|option|let'?s (?:do|go with))\s*)?([1-3])\b/.exec(t);
  if (m) return Number(m[1]);
  if (p.kind === "whatif") {
    if (/\b(?:smaller|cheaper|little|cookie|half)\b/.test(t)) return 3;
    if (/\b(?:save|saving|don'?t buy|skip|no(?: thanks)?|keep (?:it|my money)|wait)\b/.test(t)) return 2;
    if (/\b(?:buy|yes|get it|take it|i want it|treat)\b/.test(t)) return 1;
  }
  if (p.kind === "loan") {
    if (/\$\s?[12]\b|\b(?:one|two|1|2) (?:dollars?|bucks)\b/.test(t)) return 3;   // ("no, just $2": the amount says it)
    if (/\b(?:know|sure|maybe)\b/.test(t) && /\b(?:don'?t|not)\b/.test(t)) return null;   // ("I don't know", "not sure": no answer yet)
    if (/\b(?:no|not|don'?t|sorry|nope|can'?t)\b/.test(t)) return 2;
    if (/\b(?:less|smaller|half|a little)\b/.test(t)) return 3;
    if (/\b(?:yes|sure|ok(?:ay)?|lend|here you go|of course|fine)\b/.test(t)) return 1;
  }
  if (p.kind === "mimi") return ruleOf(t) ? 9 : null;   // (her question: any answer that teaches a rule)
  if (p.kind === "quiz") return quizPick(t, p);   // (a money skit's question)
  return null;
}

// ---- Mimi's money rules (what the kid teaches her)
export const RULES = {
  half: { name: "save some, spend some", say: "save some and spend a little", re: /\b(?:half|split|both|a little of each|spend a little|some (?:now|for (?:the )?(?:bow|treat)))\b/ },
  goal: { name: "goal first", say: "save for your goal first, then treat yourself", re: /\b(?:goal|bike|save|saving|piggy|wait|later|patient|don'?t buy|skip)\b/ },
  cheaper: { name: "look for a cheaper one", say: "pick a cheaper one", re: /\b(?:cheaper|smaller|less|cheap|sale|compare)\b/ },
  need: { name: "needs before wants", say: "ask yourself if you need it or just want it", re: /\b(?:need|want|really need|do you need)\b/ },
  treat: { name: "a treat now and then is fine", say: "a little treat is okay sometimes", re: /\b(?:buy|get it|get the|treat yourself|yes|go for it|you deserve)\b/ },
};
export function ruleOf(t) {
  t = T(t);
  for (const [id, r] of Object.entries(RULES)) if (r.re.test(t)) return id;
  return null;
}

// ---- the picture: three indicators, the forecast, one next move
export function moneyCard(money, savings, now = Date.now()) {
  const s = moneyState(money), sv = savings && savings.goal ? savings : null;
  const week = s.log.filter((e) => now - Date.parse(e.at) < 7 * DAY);
  const saves = week.filter((e) => e.kind === "save"), spends = week.filter((e) => e.kind === "spend" || e.kind === "lend");
  const saved = saves.reduce((a, e) => a + e.amount, 0), spent = spends.filter((e) => e.kind === "spend").reduce((a, e) => a + e.amount, 0);
  const fc = forecast(s, sv);
  const habit = saves.length >= 3 ? { level: "good", face: "🌟", text: `Great habit: you saved ${saves.length} times this week` }
    : saves.length ? { level: "ok", face: "🙂", text: `Getting there: you saved ${saves.length === 1 ? "once" : "twice"} this week` }
    : { level: "low", face: "🌱", text: "No saving yet this week: even $1 counts" };
  const balance = saved + spent === 0 ? { level: "ok", face: "🙂", text: "Nothing saved or spent yet" }
    : saved >= spent ? { level: "good", face: "⚖️", text: `You saved ${fmt(saved)} and spent ${fmt(spent)}: nicely balanced` }
    : saved >= spent / 2 ? { level: "ok", face: "🧁", text: `A bit treat-heavy: ${fmt(spent)} on treats, ${fmt(saved)} saved` }
    : { level: "low", face: "🍭", text: `Mostly treats lately: ${fmt(spent)} spent, ${fmt(saved)} saved` };
  const goal = !sv ? { level: "low", face: "🎯", text: "No goal yet: what would you like to save up for?" }
    : sv.target && sv.saved >= sv.target ? { level: "good", face: "🏆", text: `Goal reached: ${the(sv.goal)}!` }
    : !sv.target ? { level: "ok", face: "🎯", text: `Saving for ${the(sv.goal)} (how much does it cost?)` }
    : fc && fc.steps <= 3 ? { level: "good", face: "🚀", text: `On track: ${fmt(sv.target - sv.saved)} to go for ${the(sv.goal)}` }
    : { level: fc ? "ok" : "low", face: "🐢", text: `${fmt(sv.target - sv.saved)} to go for ${the(sv.goal)}${fc ? "" : ": start saving to get moving"}` };
  const next = s.loan ? `${Name(s.loan.who)} owes you ${fmt(s.loan.back)}; ${s.loan.who === "mimi" ? "she'll" : "he'll"} pay you back soon.`
    : !sv ? "Tell Mochi what you'd like to save up for, and how much it costs."
    : sv.target && sv.saved >= sv.target ? "You did it! Pick a new goal, or keep a little for a treat."
    : !saves.length ? `Next time you earn, put ${fmt(Math.min(2, s.wallet || 2))} in the piggy bank.`
    : balance.level !== "good" ? "Try a smaller treat next time, and save the rest."
    : s.wallet > 0 ? `You have ${fmt(s.wallet)} in your wallet: saving some gets you to ${the(sv.goal)} sooner.` : "Do a job with Mochi to earn a little more.";
  accrue(s, now);
  const up = [];   // coming up: what's owed to them, the next interest, the allowance, the goal (Nov 8: "forecast … financial obligations")
  if (s.loan) up.push(`${Name(s.loan.who)} pays you back ${fmt(s.loan.back)} (you lent ${fmt(s.loan.amount)})`);
  if (s.bank && s.bank.balance > 0) up.push(`Mochi Bank adds interest on ${DAYS[new Date(s.bank.paidAt + WEEK).getDay()]}: about +${fmt(r2(s.bank.balance * BANK_RATE))}`);
  if (s.allowance) up.push(`Allowance: ${fmt(s.allowance)} each week`);
  if (fc && fc.steps > 0) up.push(`Your goal: ${fc.steps} more save${fc.steps === 1 ? "" : "s"} to ${the(sv.goal)}`);
  return { wallet: s.wallet, piggy: sv ? { goal: sv.goal, target: sv.target || null, saved: sv.saved || 0 } : null, loan: s.loan ? { who: s.loan.who, back: s.loan.back } : null,
    bank: s.bank && (s.bank.balance > 0 || s.bank.interest > 0) ? { balance: s.bank.balance, interest: s.bank.interest || 0, rate: BANK_RATE } : null, shared: s.shared || 0, upcoming: up,
    indicators: [{ id: "habit", name: "Saving habit", ...habit }, { id: "balance", name: "Spend and save", ...balance }, { id: "goal", name: "Goal", ...goal }],
    forecast: fc ? fc.text : null, next, recent: s.log.slice(-4).reverse().map((e) => ({ kind: e.kind, amount: e.amount, what: e.what })), play: true };
}
/** how long to the goal, from what they really saved: the average of their last few saves (or their allowance) */
export function forecast(s, sv, extra = 0) {
  if (!sv || !sv.target) return null;
  const left = Math.max(0, sv.target - (sv.saved || 0) - extra);
  if (left <= 0) return { steps: 0, per: 0, left: 0, text: `That's enough for ${the(sv.goal)}!` };
  const saves = s.log.filter((e) => e.kind === "save").slice(-5);
  if (!saves.length) return null;
  const per = Math.max(0.5, saves.reduce((a, e) => a + e.amount, 0) / saves.length), steps = Math.ceil(left / per);
  const text = `At about ${fmt(per)} a save, ${steps} more save${steps === 1 ? "" : "s"} to ${the(sv.goal)}${s.allowance ? ` (if you save that much from each week's allowance, about ${steps} week${steps === 1 ? "" : "s"})` : ""}.`;
  return { steps, per, left, text };
}

// ---- what if: both futures, worked out from the real numbers (the scene says them; the pick applies them)
export function whatIf(money, savings, { treat, price }) {
  const s = moneyState(money), sv = savings && savings.goal ? savings : null, p = Math.max(0.5, Number(price) || treat.price || 4);
  const can = s.wallet >= p, put = can ? p : s.wallet;   // (what they could really save now: never more than the wallet)
  const reached = !!(sv && sv.target && (sv.saved || 0) >= sv.target), left = sv && sv.target && !reached ? sv.target - (sv.saved || 0) : null;
  const now = forecast(s, sv), ifSave = left != null && put > 0 ? forecast(logIt(moneyState(s), "save", put, "what if"), { ...sv, saved: (sv.saved || 0) + put }) : null;
  const sooner = now && ifSave && now.steps > ifSave.steps ? now.steps - ifSave.steps : 0;
  const buyLine = !can ? `You have ${fmt(s.wallet)}, so you'd need ${fmt(p - s.wallet)} more for the ${treat.name}.`
    : `If you buy it: your wallet goes from ${fmt(s.wallet)} to ${fmt(s.wallet - p)}${left != null ? `, and ${the(sv.goal)} is still ${fmt(left)} away` : ""}.`;
  const saveLine = put <= 0 ? "Your wallet is empty right now: a job with me earns $3, and then you can choose."
    : !sv ? `If you save ${can ? "it" : `your ${fmt(put)}`} instead: ${fmt(put)} goes in the piggy bank, ready for something you really want.`
    : reached ? `You already have enough for ${the(sv.goal)}! Saving it would start your next goal.`
    : left != null ? (put >= left ? `If you save ${can ? "it" : `your ${fmt(put)}`} instead: that's enough for ${the(sv.goal)}!`
      : `If you save ${can ? "it" : `your ${fmt(put)}`} instead: the piggy bank goes to ${fmt((sv.saved || 0) + put)}, and ${the(sv.goal)} is only ${fmt(left - put)} away${sooner ? `: ${sooner} save${sooner === 1 ? "" : "s"} sooner` : ""}.`)
    : `If you save it instead: ${fmt(put)} more for ${the(sv.goal)}.`;
  const choices = can ? [{ n: 1, text: `Buy the ${treat.name} (${fmt(p)})` }, { n: 2, text: `Save the ${fmt(p)} instead` }, ...(p > SMALL.price ? [{ n: 3, text: `Get a smaller treat (a cookie, ${fmt(SMALL.price)})` }] : [])]
    : [{ n: 1, text: "Do a job to earn the rest" }, { n: 2, text: put > 0 ? `Save my ${fmt(put)} for now` : `Save up for the ${treat.name}` }, ...(s.wallet >= SMALL.price ? [{ n: 3, text: `Get a cookie for ${fmt(SMALL.price)}` }] : [])];
  return { treat: { name: treat.name, prop: treat.prop || null, food: !!treat.food }, price: p, can, buyLine, saveLine, choices, wallet: s.wallet };
}

// ---- the scenes (hand-written, so the numbers are always right)
export function whatIfScene(w, { rule = null } = {}) {
  const beats = [
    { do: "arrive", who: "mimi", with: w.treat.prop || undefined },
    { do: "friend_say", who: "mimi", line: w.treat.name === "treat" ? `Welcome to Mimi's stand! This one's ${fmt(w.price)}! ♡` : `Welcome to Mimi's stand! ${plural(w.treat.name)[0].toUpperCase() + plural(w.treat.name).slice(1)}, only ${fmt(w.price)}${/^(?:popcorn|cups of)/.test(plural(w.treat.name)) ? "" : " each"}! ♡` },
    { do: "say", who: "mochi", line: "Ooh! Let's look at both ways before we decide…" },
    { do: "aside", who: "mochi", line: w.buyLine },
    { do: "aside", who: "mochi", line: w.saveLine },
  ];
  if (rule && RULES[rule.id]) beats.push({ do: "friend_say", who: "mimi", line: `I remember what you taught me: ${RULES[rule.id].say}! ♡` });
  beats.push({ do: "say", who: "mochi", line: "What do you want to do?" }, { do: "say", who: "mochi", line: "", choices: w.choices });
  return { title: `what if: the ${w.treat.name}`, beats, waits: "choice" };
}
/** apply a pick: returns { money, savingsAdd, scene, note, earned } (index.js saves them) */
export function applyPick(money, savings, n, now = Date.now()) {
  const s = moneyState(money), p = s.pending; s.pending = null;
  if (!p) return null;
  if (p.kind === "whatif" && p.w && p.w.treat) {
    const goal = savings && savings.goal ? savings.goal : null;
    const w = { ...p.w, can: s.wallet >= p.w.price };   // (the wallet as it is now, not as it was when they asked)
    if (w.can && n === 1) {
      s.wallet = Math.round((s.wallet - w.price) * 100) / 100; logIt(s, "spend", w.price, w.treat.name, now);
      return { money: s, savingsAdd: 0, bought: w.treat, scene: buyScene(w.treat, w.price),
        note: `They chose to buy the ${w.treat.name} for ${fmt(w.price)} (wallet now ${fmt(s.wallet)}). Mimi hands it over. Be happy for them, no nagging; one short line.` };
    }
    if (n === 3 && (w.can || s.wallet >= SMALL.price)) {
      s.wallet = Math.round((s.wallet - SMALL.price) * 100) / 100; logIt(s, "spend", SMALL.price, "cookie (smaller treat)", now);
      const keep = w.can ? Math.round((w.price - SMALL.price) * 100) / 100 : 0;
      if (keep > 0 && goal && s.wallet >= keep) { s.wallet = Math.round((s.wallet - keep) * 100) / 100; logIt(s, "save", keep, `saved instead of the ${w.treat.name}`, now); }
      return { money: s, savingsAdd: keep > 0 && goal ? keep : 0, bought: SMALL, scene: buyScene(SMALL, SMALL.price, { saved: keep > 0 && goal ? keep : 0 }),
        note: `They chose a smaller treat: a cookie for ${fmt(SMALL.price)}${keep > 0 && goal ? `, and ${fmt(keep)} went in the piggy bank for ${the(goal)}` : ""}. Say that was a clever middle way; short.` };
    }
    if (n === 2 || (!w.can && n === 3)) {
      const amt = w.can ? w.price : Math.min(s.wallet, w.price);
      if (amt > 0 && goal) { s.wallet = Math.round((s.wallet - amt) * 100) / 100; logIt(s, "save", amt, `saved instead of the ${w.treat.name}`, now); }
      return { money: s, savingsAdd: amt > 0 && goal ? amt : 0, scene: saveScene(amt, goal),
        note: `They chose to save instead of buying the ${w.treat.name}${amt > 0 && goal ? `: ${fmt(amt)} went in the piggy bank for ${the(goal)}` : " (no goal yet: ask what they're saving for)"}. Be proud of them; short.` };
    }
    if (!w.can && n === 1) return { money: s, savingsAdd: 0, scene: null, note: "They want to do a job to earn the rest. Suggest one fun job you can do together right now (be a chef, a farmer, a doctor, or help tidy up), short." };
  }
  if (p.kind === "loan") {
    const amt = n === 3 ? Math.min(2, p.amount) : p.amount;
    if ((n === 1 || n === 3) && s.wallet >= amt) {
      s.wallet = Math.round((s.wallet - amt) * 100) / 100; logIt(s, "lend", amt, `lent to ${Name(p.who)}`, now);
      s.loan = { who: p.who, amount: amt, back: amt + 1, at: now, turns: 0 };
      return { money: s, savingsAdd: 0, scene: lendScene(p.who, amt), note: `They lent ${Name(p.who)} ${fmt(amt)}; ${p.who === "mimi" ? "she" : "he"} promised to pay back ${fmt(amt + 1)} (a dollar extra for waiting, like a bank's interest). Say it's kind and that you'll see if ${p.who === "mimi" ? "she" : "he"} keeps the promise; short.` };
    }
    if (n === 1 || n === 3) return { money: s, savingsAdd: 0, scene: null, note: `They wanted to lend ${fmt(amt)} but the wallet only has ${fmt(s.wallet)}. Say so kindly: you can't lend money you don't have; short.` };
    return { money: s, savingsAdd: 0, scene: { title: "a kind no", beats: [{ do: "friend_say", who: p.who, line: p.who === "cocoa" ? "No worries, bro! I'll save up for it myself." : "That's okay! I'll save up ♡" }, { do: "feel", who: p.who, how: "happy" }] },
      note: `They said no to lending ${Name(p.who)} money. That's okay: say it's fine to say no kindly, and that ${Name(p.who)} isn't upset; short.` };
  }
  return { money: s, savingsAdd: 0, scene: null, note: "" };
}
function buyScene(treat, price, { saved = 0 } = {}) {
  const beats = [{ do: "give", who: "mimi", with: treat.prop || undefined }, { do: "friend_say", who: "mimi", line: `Here you go! That's ${fmt(price)}. Thank you for shopping! ♡` }];
  if (treat.food && treat.prop) beats.push({ do: "eat", who: "mochi", with: treat.prop });
  if (saved) beats.push({ do: "aside", who: "mochi", line: `And ${fmt(saved)} went in the piggy bank. Best of both!` });
  beats.push({ do: "feel", who: "mochi", how: "happy" });
  return { title: `bought: ${treat.name}`, beats };
}
function saveScene(amt, goal) {
  return { title: "saved it", beats: [{ do: "friend_say", who: "mimi", line: "Ooh, saving! That's so smart ♡" }, { do: "aside", who: "mochi", line: amt > 0 && goal ? `Clink! ${fmt(amt)} in the piggy bank for ${the(goal)}.` : "Let's pick a goal to save for!" }, { do: "feel", who: "mochi", how: "proud" }] };
}
function lendScene(who, amt) {
  return { title: `lent ${Name(who)} ${fmt(amt)}`, beats: [{ do: "friend_say", who, line: who === "cocoa" ? `Thanks, bro! I'll pay you back ${fmt(amt + 1)}, promise!` : `Thank you! I'll pay you back ${fmt(amt + 1)} ♡` }, { do: "hug", who }] };
}
export function loanAskScene(who, amount) {
  const thing = who === "cocoa" ? "a new kite string" : "a sparkly bow";
  return { title: `${Name(who)} wants to borrow`, waits: "choice", beats: [
    { do: "arrive", who },
    { do: "friend_say", who, line: who === "cocoa" ? `Bro! Can I borrow ${fmt(amount)} for ${thing}? I'll pay you back ${fmt(amount + 1)} next time: one extra for waiting!` : `Mochi, can I borrow ${fmt(amount)} for ${thing}? I'll pay you back ${fmt(amount + 1)} ♡` },
    { do: "aside", who: "mochi", line: `Lending is like what a bank does: you get it back, plus a little extra for waiting.` },
    { do: "say", who: "mochi", line: "Should we lend it?" },
    { do: "say", who: "mochi", line: "", choices: [{ n: 1, text: `Lend ${fmt(amount)}` }, { n: 2, text: "Say no, kindly" }, ...(amount > 2 ? [{ n: 3, text: "Lend just $2" }] : [])] },
  ] };
}
/** Cocoa (or Mimi) pays back, with the extra dollar: due two turns and 90 s after the loan */
export function loanDue(money, now = Date.now()) {
  const s = moneyState(money);
  return !!(s.loan && s.loan.turns >= 2 && now - s.loan.at >= 90000);
}
export function repay(money, now = Date.now()) {
  const s = moneyState(money), L = s.loan; if (!L) return null;
  s.wallet = Math.round((s.wallet + L.back) * 100) / 100; logIt(s, "repay", L.back, `${Name(L.who)} paid back`, now); s.loan = null;
  return { money: s, scene: { title: `${Name(L.who)} pays back`, beats: [
    { do: "arrive", who: L.who },
    { do: "friend_say", who: L.who, line: L.who === "cocoa" ? `Bro! Here's your ${fmt(L.amount)} back, plus ${fmt(L.back - L.amount)} for waiting. A promise is a promise!` : `Here's your ${fmt(L.amount)} back, and ${fmt(L.back - L.amount)} extra for waiting ♡` },
    { do: "aside", who: "mochi", line: `${fmt(L.back)} back in your wallet! That extra dollar is called interest: it's why banks pay you for keeping money with them.` },
    { do: "hug", who: L.who },
  ] }, line: `${Name(L.who)} paid back ${fmt(L.back)}` };
}
/** after a what-if, Mimi sometimes asks the kid for advice (once, until a rule is taught) */
export function mimiAskScene() {
  return { title: "Mimi asks for money advice", waits: "choice", beats: [
    { do: "friend_say", who: "mimi", line: "Um… can I ask you something? ♡" },
    { do: "friend_say", who: "mimi", line: "I really want a sparkly bow for $4… but I'm saving up for a bike. What should I do?" },
  ] };
}
export function mimiLearned(text, now = Date.now()) {
  const id = ruleOf(text);
  if (!id) return null;
  return { rule: { id, said: String(text).slice(0, 120), at: new Date(now).toISOString() },
    scene: { title: "Mimi learned a money rule", beats: [{ do: "friend_say", who: "mimi", line: `Ohh! ${RULES[id].say[0].toUpperCase() + RULES[id].say.slice(1)}. I'm going to remember that! ♡` }, { do: "hug", who: "mimi" }] } };
}

// ---- money skits (Nov 8, Binoy: "can you add a couple of skits related to this"): hand-written, so what he teaches
// is always right. Mimi and Cocoa act out a money moment, then Mochi asks the kid; the answer is explained either way
// (right or not), and a right one earns $1. "do a money skit", "show me a skit about saving"; "again" for another.
const Q = (n, text) => ({ n, text });
export const MONEY_SKITS = [
  { id: "needs", title: "needs and wants",
    beats: [
      { do: "arrive", who: "cocoa", with: "kite" },
      { do: "friend_say", who: "cocoa", line: "Dude! I've got $5 from helping my grandma!" },
      { do: "friend_say", who: "cocoa", line: "My kite string snapped, and a new one is $4… but there's a GIANT candy bar for $5!" },
      { do: "say", who: "mochi", line: "Ooh, tricky! One of those is a need, and one is a want." },
      { do: "say", who: "mochi", line: "Which one does Cocoa need?" },
    ],
    choices: [Q(1, "The kite string"), Q(2, "The giant candy bar")], right: 1, words: { 1: /\b(?:string|kite)\b/, 2: /\b(?:candy|chocolate|sweets?|bar)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! He needs the string to fly his kite. The candy is a want: yummy, but he doesn't need it." }, { do: "friend_say", who: "cocoa", line: "String it is! And I'll keep the extra $1 for later, bro." }, { do: "feel", who: "cocoa", how: "happy" }],
    no: { 2: [{ do: "aside", who: "mochi", line: "Hmm, the candy's yummy, but it's a want. He needs the string, or there's no kite flying at all!" }, { do: "friend_say", who: "cocoa", line: "Oh yeah… no string, no kite. String it is, dude! And $1 left over." }, { do: "feel", who: "cocoa", how: "happy" }] },
    reveal: "I think it's the kite string: he needs it to fly his kite. The candy is a want.", lesson: "needs before wants" },
  { id: "stand", title: "Mimi's cookie stand",
    beats: [
      { do: "show", who: "mochi", with: "lemonade stand" },
      { do: "arrive", who: "mimi", with: "cookie" },
      { do: "friend_say", who: "mimi", line: "I baked cookies to sell! $1 each ♡" },
      { do: "friend_say", who: "cocoa", line: "One for me, and one for my brother! Here's $2!" },
      { do: "aside", who: "mochi", line: "By lunchtime, Mimi sold 6 cookies. That's $6 she earned!" },
      { do: "friend_say", who: "mimi", line: "I want to save half for my bike, and spend the rest on a treat ♡" },
      { do: "say", who: "mochi", line: "How much goes in Mimi's piggy bank?" },
    ],
    choices: [Q(1, "$6"), Q(2, "$3"), Q(3, "$0")], right: 2, words: { 2: /\b(?:three|3|half)\b/, 1: /\b(?:six|6|all)\b/, 3: /\b(?:zero|0|none|nothing)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! Half of $6 is $3: $3 saved for the bike, $3 for a treat. That's a budget!" }, { do: "friend_say", who: "mimi", line: "Clink! Bike, here I come ♡" }, { do: "dance", who: "mimi" }],
    no: { 0: [{ do: "aside", who: "mochi", line: "Close! Half of $6 is $3: $3 in the piggy bank for the bike, and $3 for a treat. Planning it like that is called a budget." }, { do: "friend_say", who: "mimi", line: "Clink! ♡" }, { do: "feel", who: "mimi", how: "happy" }] },
    reveal: "Half of $6 is $3: $3 saved, $3 for a treat. That's a budget!", lesson: "making a budget" },
  { id: "patient", title: "a little every day",
    beats: [
      { do: "arrive", who: "cocoa" },
      { do: "arrive", who: "mimi" },
      { do: "aside", who: "mochi", line: "Cocoa and Mimi both get $2 every day." },
      { do: "friend_say", who: "cocoa", line: "I spend mine on candy, every single day, bro!" },
      { do: "friend_say", who: "mimi", line: "I put mine in my piggy bank ♡" },
      { do: "aside", who: "mochi", line: "Then on Saturday… a kite sale! Kites are $10." },
      { do: "friend_say", who: "mimi", line: "I have $10! ♡" },
      { do: "friend_say", who: "cocoa", line: "I have… $0. Aw, man." },
      { do: "say", who: "mochi", line: "What could Cocoa do next week?" },
    ],
    choices: [Q(1, "Save a little every day"), Q(2, "Spend it all again"), Q(3, "Borrow from Mimi every time")], right: 1, words: { 1: /\b(?:save|saving|piggy|little)\b/, 3: /\b(?:borrow|mimi)\b/, 2: /\b(?:spend|candy)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! A little every day adds up: $2 a day for 5 days is $10." }, { do: "friend_say", who: "cocoa", line: "Piggy bank, here I come! Next Saturday, that kite is mine, dude!" }, { do: "hug", who: "cocoa" }],
    no: { 2: [{ do: "aside", who: "mochi", line: "Then he'd have $0 again next Saturday! A little every day adds up: $2 a day for 5 days is $10." }, { do: "friend_say", who: "cocoa", line: "Okay, okay: piggy bank this week, bro!" }, { do: "hug", who: "cocoa" }],
      3: [{ do: "aside", who: "mochi", line: "Borrowing every time means paying back every time. Saving a little every day is better: $2 a day for 5 days is $10." }, { do: "friend_say", who: "cocoa", line: "Got it: save first, bro!" }, { do: "hug", who: "cocoa" }] },
    reveal: "Saving a little every day adds up: $2 a day for 5 days is $10.", lesson: "saving a little at a time" },
  { id: "deal", title: "the better deal",
    beats: [
      { do: "arrive", who: "mimi", with: "cookie" },
      { do: "friend_say", who: "mimi", line: "Cookies! One for $1, or a pack of 3 for $2 ♡" },
      { do: "friend_say", who: "cocoa", line: "Bro, I want 3 cookies. Which way is cheaper?" },
      { do: "say", who: "mochi", line: "Let's think! Which is the better deal for 3 cookies?" },
    ],
    choices: [Q(1, "3 single cookies"), Q(2, "The pack of 3")], right: 2, words: { 2: /\b(?:pack|bundle|box)\b/, 1: /\b(?:single|singles|separate|each|one at a time)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! 3 single cookies cost $3, but the pack is $2. Cocoa saves $1!" }, { do: "friend_say", who: "cocoa", line: "Sweet! A whole dollar saved, dude!" }, { do: "feel", who: "cocoa", how: "happy" }],
    no: { 1: [{ do: "aside", who: "mochi", line: "Let's count: 3 single cookies cost $3, and the pack is only $2. The pack saves $1!" }, { do: "friend_say", who: "cocoa", line: "Whoa. Math is money, bro!" }, { do: "feel", who: "cocoa", how: "happy" }] },
    reveal: "3 single cookies cost $3, and the pack is $2: the pack saves $1!", lesson: "comparing prices" },

  // (Nov 8, more: Binoy "add some more skits", with the bank props)
  { id: "interest", title: "the bank pays you",
    beats: [
      { do: "show", who: "mochi", with: "little bank", line: "This is Mochi Bank! You can keep your money here." },
      { do: "arrive", who: "cocoa", with: "money bag" },
      { do: "friend_say", who: "cocoa", line: "I'm putting my $10 in the bank, bro!" },
      { do: "friend_say", who: "mimi", line: "I'm keeping my $10 under my bed ♡" },
      { do: "aside", who: "mochi", line: "One week later… the bank adds a little extra to Cocoa's money for keeping it there: $1!" },
      { do: "say", who: "mochi", line: "Who has more money now?" },
    ],
    choices: [Q(1, "Cocoa (the bank)"), Q(2, "Mimi (under the bed)"), Q(3, "They have the same")], right: 1, words: { 1: /\b(?:cocoa|bank|eleven|11)\b/, 2: /\b(?:mimi|bed)\b/, 3: /\b(?:same|equal|both)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! Cocoa has $11. That extra $1 is called interest: the bank pays you for keeping your money with it." }, { do: "friend_say", who: "cocoa", line: "Free dollar, dude! Well… a waiting dollar." }, { do: "friend_say", who: "mimi", line: "Maybe my $10 should go in the bank too ♡" }],
    no: { 0: [{ do: "aside", who: "mochi", line: "Cocoa has $11 now: the bank added $1 for keeping his money there. That's called interest. Mimi's $10 under the bed stays $10." }, { do: "friend_say", who: "mimi", line: "Ooh! My money can grow in the bank? ♡" }, { do: "feel", who: "mimi", how: "surprised" }] },
    reveal: "Cocoa has $11: the bank added $1 for keeping his money there. That's interest!", lesson: "interest" },
  { id: "rainy", title: "the rainy-day jar",
    beats: [
      { do: "arrive", who: "mimi" },
      { do: "friend_say", who: "mimi", line: "Oh no! My bike tire popped, and fixing it costs $4!" },
      { do: "show", who: "mochi", with: "savings jar", line: "Don't you have your rainy-day jar?" },
      { do: "friend_say", who: "mimi", line: "Yes! I put a little in every week. There's $5 in it ♡" },
      { do: "friend_say", who: "cocoa", line: "My ball popped yesterday and I had nothing saved, bro…" },
      { do: "say", who: "mochi", line: "Why is a rainy-day jar a good idea?" },
    ],
    choices: [Q(1, "For surprises that cost money"), Q(2, "For buying more candy"), Q(3, "It isn't a good idea")], right: 1, words: { 1: /\b(?:surprise|surprises|emergenc|accident|broke|break|fix|unexpected|just in case)\w*\b/, 2: /\b(?:candy|sweets|treat)\b/, 3: /\b(?:isn'?t|not|no|bad)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! Surprises happen, like a popped tire. A rainy-day jar means you're ready for them." }, { do: "friend_say", who: "cocoa", line: "Starting my rainy-day jar today, dude!" }, { do: "hug", who: "mimi" }],
    no: { 0: [{ do: "aside", who: "mochi", line: "A rainy-day jar is for surprises that cost money, like Mimi's popped tire. She was ready, and she didn't have to worry!" }, { do: "friend_say", who: "cocoa", line: "Okay, I'm starting one today, bro." }, { do: "hug", who: "mimi" }] },
    reveal: "A rainy-day jar is for surprises that cost money, like a popped tire!", lesson: "a rainy-day fund" },
  { id: "share", title: "spend, save, share",
    beats: [
      { do: "show", who: "mochi", with: "three money jars", line: "Look: three jars! Spend, save and share." },
      { do: "arrive", who: "mimi", with: "play money" },
      { do: "friend_say", who: "mimi", line: "I got $6! $2 to spend, $3 to save, and $1 to share ♡" },
      { do: "friend_say", who: "cocoa", line: "Share? What's the share jar for, bro?" },
      { do: "say", who: "mochi", line: "What do you think the share jar is for?" },
    ],
    choices: [Q(1, "Helping others"), Q(2, "More candy"), Q(3, "Paying for games")], right: 1, words: { 1: /\b(?:help|helping|others|give|giving|donat\w*|charity|shelter|kind|friends?|people|animals?)\b/, 2: /\b(?:candy|sweets|treat)\b/, 3: /\b(?:games?)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! The share jar is for helping others, like giving to the animal shelter." }, { do: "friend_say", who: "mimi", line: "My $1 is for the puppies ♡" }, { do: "friend_say", who: "cocoa", line: "Then my first dollar goes in the share jar too, dude!" }],
    no: { 0: [{ do: "aside", who: "mochi", line: "The share jar is for helping others, like giving a little to the animal shelter. It feels good!" }, { do: "friend_say", who: "mimi", line: "My $1 is for the puppies ♡" }, { do: "feel", who: "cocoa", how: "happy" }] },
    reveal: "The share jar is for helping others, like the animal shelter!", lesson: "spend, save and share" },
  { id: "trial", title: "the \"free\" game",
    beats: [
      { do: "arrive", who: "cocoa", with: "magenta smartphone" },
      { do: "friend_say", who: "cocoa", line: "Bro! This game says FREE! It just wants a card number to start." },
      { do: "show", who: "mochi", with: "magnifying glass", line: "Let me read the small print…" },
      { do: "aside", who: "mochi", line: "It says: free for 7 days, then $5 every week until you stop it. That's not really free!" },
      { do: "say", who: "mochi", line: "What should Cocoa do before he taps \"Start free trial\"?" },
    ],
    choices: [Q(1, "Ask a grown-up and read the small print"), Q(2, "Tap it fast before it's gone"), Q(3, "Type in the card number")], right: 1, words: { 1: /\b(?:ask|grown ?-?up|parent|mom|dad|read|small print|check)\b/, 2: /\b(?:tap|fast|quick)\b/, 3: /\b(?:card|number|type)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! \"Free\" can turn into paying every week. Read the small print and ask a grown-up first." }, { do: "friend_say", who: "cocoa", line: "Phew! $5 every week would've eaten my whole allowance, bro." }, { do: "feel", who: "cocoa", how: "happy" }],
    no: { 0: [{ do: "aside", who: "mochi", line: "Careful! After 7 days it would cost $5 every week. Always read the small print and ask a grown-up first." }, { do: "friend_say", who: "cocoa", line: "Whoa. Asking my mom first, dude." }, { do: "feel", who: "cocoa", how: "surprised" }] },
    reveal: "\"Free\" can turn into paying every week: read the small print and ask a grown-up first!", lesson: "free trials and small print" },
  { id: "tradeoff", title: "you can't have both",
    beats: [
      { do: "arrive", who: "cocoa", with: "play money" },
      { do: "friend_say", who: "cocoa", line: "I've got $8! Skateboard wheels are $8… and a movie with popcorn is $8 too!" },
      { do: "friend_say", who: "cocoa", line: "Can I get both, bro?" },
      { do: "show", who: "mochi", with: "calculator", line: "Let's see… $8 plus $8 is $16. You have $8." },
      { do: "say", who: "mochi", line: "If Cocoa picks the movie, what does he give up?" },
    ],
    choices: [Q(1, "The skateboard wheels"), Q(2, "Nothing"), Q(3, "The movie")], right: 1, words: { 1: /\b(?:wheels?|skateboard|board)\b/, 2: /\b(?:nothing|none)\b/, 3: /\b(?:movie|popcorn)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! Choosing one thing means giving up the other. That's a trade-off." }, { do: "friend_say", who: "cocoa", line: "Wheels this time, movie next time. Deal, dude!" }, { do: "feel", who: "cocoa", how: "happy" }],
    no: { 0: [{ do: "aside", who: "mochi", line: "He'd give up the skateboard wheels: with $8 he can only pick one. Choosing one means giving up the other. That's a trade-off." }, { do: "friend_say", who: "cocoa", line: "Hmm… wheels now, movie next time!" }, { do: "feel", who: "cocoa", how: "happy" }] },
    reveal: "With $8 he can only pick one: choosing the movie means giving up the wheels. That's a trade-off!", lesson: "trade-offs" },
  { id: "receipt", title: "check the receipt",
    beats: [
      { do: "arrive", who: "mimi", with: "cookie" },
      { do: "friend_say", who: "mimi", line: "I bought 2 cookies. They're $1 each ♡" },
      { do: "show", who: "mochi", with: "receipt", line: "Let's check the receipt! It says… $3." },
      { do: "say", who: "mochi", line: "Is the receipt right?" },
    ],
    choices: [Q(1, "No, it should be $2"), Q(2, "Yes, $3 is right")], right: 1, words: { 1: /\b(?:no|nope|wrong|two|2|mistake)\b/, 2: /\b(?:yes|yep|right|three|3|correct)\b/ },
    yes: [{ do: "aside", who: "mochi", line: "Yes! 2 cookies at $1 each is $2. Good thing we checked!" }, { do: "friend_say", who: "mimi", line: "I'll ask the shop to fix it. Thank you! ♡" }, { do: "hug", who: "mimi" }],
    no: { 0: [{ do: "aside", who: "mochi", line: "Let's count: 2 cookies at $1 each is $2, not $3. Checking your receipt catches mistakes!" }, { do: "friend_say", who: "mimi", line: "Ooh! I'll ask them to fix it ♡" }, { do: "hug", who: "mimi" }] },
    reveal: "2 cookies at $1 each is $2, not $3: always check the receipt!", lesson: "checking receipts" },
];
const SKIT = Object.fromEntries(MONEY_SKITS.map((k) => [k.id, k]));
// skits Nemotron wrote and Gemma checked (skitgen.js), kept in memory by index.js
let EXTRA = [];
export function setExtraSkits(list) { EXTRA = Array.isArray(list) ? list.filter((k) => k && k.id && Array.isArray(k.beats)) : []; }
export const extraSkits = () => EXTRA;
const skitOf = (id) => SKIT[id] || EXTRA.find((k) => k.id === id) || null;
const SKIT_WORDS = /\b(?:money|saving|savings|spend(?:ing)?|banks?|banking|budget(?:ing)?|allowance|piggy ?banks?|needs? (?:and|vs\.?|or) wants?|deals?|coins|dollars|cookie stand|interest|receipts?|trade-?offs?|free trials?|rainy[- ]day|share jar|sharing|giving|donat\w*|charity)\b/;
/** "do a money skit", "show me a skit about saving", "play the money game"; "again" right after one */
export function moneySkitAsk(t, state) {
  if (/\b(?:skits?|scenes?|act(?: it)? out|play (?:a|the) (?:money )?game|money game|story about|show me (?:a|how))\b/.test(t) && SKIT_WORDS.test(t)) return true;
  return !!(state && state.skitAt && Date.now() - state.skitAt < 10 * 60000 && /^\s*(?:(?:do |play |show me )?(?:it |that )?again|another(?: one)?|one more|more please|next one)\b/.test(t));
}
// a topic named picks its skit ("do a skit about interest" is the bank one; Nov 8, for testing and demos)
const SKIT_TOPICS = [["interest", /\b(?:interest|banks?|banking|mochi bank)\b/], ["rainy", /\b(?:rainy[- ]?day|emergenc\w*|surprises?)\b/], ["share", /\b(?:shar(?:e|ing)|giv(?:e|ing)|donat\w*|charity|share jar|three jars)\b/],
  ["trial", /\b(?:free trials?|trials?|subscriptions?|small print|free game)\b/], ["tradeoff", /\b(?:trade-?offs?|can'?t have both|choos\w+)\b/], ["receipt", /\b(?:receipts?|checking)\b/],
  ["needs", /\bneeds?\b|\bwants?\b/], ["stand", /\b(?:budget(?:ing)?|cookie stand|lemonade stand|stand|selling)\b/], ["patient", /\b(?:every day|a little at a time|little by little|patien\w+|save a little)\b/], ["deal", /\b(?:deals?|cheaper|compar\w+|prices?)\b/]];
export function skitTopic(text) { const t = String(text || "").toLowerCase(); const hit = SKIT_TOPICS.find(([, re]) => re.test(t)); return hit ? hit[0] : null; }
/** the next skit: the one whose topic they named, else a new one Nemotron wrote (not played yet), else one not played lately */
export function pickSkit(recent = [], rnd = Math.random, topic = null, played = []) {
  if (topic && SKIT[topic]) return SKIT[topic];
  const newOnes = EXTRA.filter((k) => !played.includes(k.id) && !recent.includes(k.id));
  if (newOnes.length) return newOnes[0];
  const fresh = MONEY_SKITS.filter((k) => !recent.includes(k.id)), pool = fresh.length ? fresh : MONEY_SKITS;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}
export function skitScene(k) {
  return { title: k.gen ? `${k.title} (written by ${k.by || "Nemotron"}, checked by ${k.checkedBy || "Gemma"})` : k.title, waits: "choice", beats: [...k.beats, { do: "say", who: "mochi", line: "", choices: k.choices }] };
}
function quizPick(t, p) {
  const k = skitOf(p.id); if (!k) return null;
  const m = /^\s*(?:(?:i (?:pick|choose|think|say)|number|option|it'?s)\s*)?([1-4])\b/.exec(t);
  if (m && Number(m[1]) <= k.choices.length) return Number(m[1]);
  for (const [n, re] of Object.entries(k.words)) if (re.test(t)) return Number(n);
  return null;
}
/** their answer: the scene that explains it (right or not) */
export function skitAnswer(id, n) {
  const k = skitOf(id); if (!k) return null;
  const right = n === k.right, pickText = (k.choices.find((c) => c.n === n) || {}).text || "";
  const beats = right ? k.yes : k.no[n] || k.no[0] || Object.values(k.no)[0];
  return { right, lesson: k.lesson, scene: { title: `${k.title}: the answer`, beats }, pickText };
}
/** nobody answered: Mochi says it himself (every scene ends) */
export function skitReveal(id) {
  const k = skitOf(id); if (!k) return null;
  return { title: `${k.title}: the answer`, beats: [{ do: "aside", who: "mochi", line: k.reveal }, ...k.yes.slice(1)] };
}

// ---- his money skill pack (Nov 8, Binoy: "similar to how on day zero when someone asks about scams mochi downloads
// that skill, I want all these new bank related skills to be shown to be downloaded"): on day zero he knows nothing
// about money; the first time it comes up he downloads "money smarts" (the card over the stage, the items ticking in),
// then he helps. Until then a job is just fun: it pays nothing, because he doesn't know what money is yet.
export const MONEY_SKILL = { id: "money", name: "money smarts", items: ["earning with jobs", "a wallet and a piggy bank", "saving for a goal", "needs and wants", "what if: both ways", "lending and paying back", "interest: a little extra for waiting"],
  before: "Hmm… I don't know anything about money yet. Let me learn first!", after: "Got it! Now I know about earning, saving, spending and lending." };
export const skillDownload = () => ({ skill: MONEY_SKILL.name, items: MONEY_SKILL.items, before: MONEY_SKILL.before, after: MONEY_SKILL.after });
export const SKILL_NOTE = "\nRight before this, a card on screen showed you downloading your \"money smarts\" skill pack (on day zero you knew nothing about money; now you know about earning, saving, spending and lending). Don't explain the download again; just answer, short.";
export const MONEY_SKILL_ASK = /\b(?:download|install|upload|load|learn|study)\b[^.?!]{0,40}\b(?:money|banking|banks?|saving|budget(?:ing)?|finances?|money smarts)\b/i;

// ---- earning: a job or a chore with Mochi pays a little (at most once a minute, so it isn't a slot machine)
export const PAY = { job: 3, chore: 2, scam: 2, allowance: 5, quiz: 1 };
export function earn(money, kind, what, now = Date.now(), amount = null) {
  const s = moneyState(money);
  if (kind !== "allowance" && now - s.earnedAt < 60000) return null;
  const amt = kind === "allowance" ? Math.min(100, amount || s.allowance || PAY.allowance) : PAY[kind] || 2;
  s.wallet = Math.round((s.wallet + amt) * 100) / 100; s.earnedAt = now; logIt(s, kind === "allowance" ? "allowance" : "earn", amt, what, now);
  return { money: s, amount: amt };
}
export function earnNote(e, what) {
  return `\nOn screen just now: coins jingled into their wallet: they earned ${fmt(e.amount)} ${what} (play money in Mochi's world; wallet now ${fmt(e.money.wallet)}). Mention it in a few happy words.`;
}

// ---- what he's told (so his words match the numbers)
export function moneyNote(card) {
  const ind = card.indicators.map((i) => `${i.name}: ${i.text}`).join("; ");
  return `\nTheir money card is on screen (play money in your little world): wallet ${fmt(card.wallet)}${card.piggy ? `, piggy bank ${fmt(card.piggy.saved)}${card.piggy.target ? ` of ${fmt(card.piggy.target)}` : ""} for ${the(card.piggy.goal)}` : ", no savings goal yet"}${card.bank ? `, Mochi Bank ${fmt(card.bank.balance)}${card.bank.interest ? ` (${fmt(card.bank.interest)} of it interest)` : ""}` : ""}${card.loan ? `, ${Name(card.loan.who)} owes them ${fmt(card.loan.back)}` : ""}${card.shared ? `, shared ${fmt(card.shared)} so far` : ""}. ${ind}.${card.forecast ? ` ${card.forecast}` : ""} Next move: ${card.next} Say it like a kind coach in two short sentences: one thing going well, and the next move. Don't repeat every number (the card shows them). Never give real financial advice.`;
}
export const TEACH_NOTE = "\nThey want to learn about money. In your little world they earn play dollars by doing jobs and chores with you (be a chef, a farmer, a doctor, tidy up), save them in your piggy bank for a goal, buy treats at Mimi's stand, and can lend to Cocoa. Explain that in two short, excited sentences, and suggest the first step: pick something to save up for (\"help me save $20 for a kite\") or do a job together.";
export const EARN_NOTE = "\nThey asked how to earn money in your little world. Say they earn play dollars by doing jobs with you (dress up as a chef, a farmer, a doctor: $3) or chores (tidy up, water the plants: $2). Offer one to do right now, short.";
