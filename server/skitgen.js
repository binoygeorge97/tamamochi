// Money skits written on the fly (Nov 8, Binoy: "what are the possibilities for it to even make skits on the fly
// using Nemotron … to refer to its knowledge base?", then "start the skits on fly code").
//
// The lesson comes from us, the story from Nemotron, and nothing reaches a child unchecked:
//   1. the knowledge base: lesson cards written by hand (a money idea in kid words, the right answer, the numbers);
//   2. Nemotron (the background model, on Brev) writes a skit from ONE card, in the same shape as the hand-written
//      money skits (scenes, a question with 2-3 buttons, the right answer, explanations), with only props he owns;
//   3. code checks it: the shape, the props, line lengths, no real brands, nothing unkind, and the arithmetic: every
//      sum is written out in `math` and worked out here, and every $ amount said must come from the card or a sum;
//   4. Gemma answers its question blind (like Pip with props: not told the answer); a different answer, or a problem
//      it names, and the skit is thrown away;
//   5. kept skits go into a library (memory "money.genskits") and are served instantly: "do a money skit" prefers a
//      new one; it's labelled "written by Nemotron, checked by Gemma".
// Written while the room is quiet (index.js), so nobody waits for it. Pure: index.js gives it the models and memory.

const Name = (w) => (w === "mimi" ? "Mimi" : "Cocoa");
const FRIENDS = `Mimi is Mochi's girlfriend: sweet and caring, a big pink bow; now and then she says "eep!" or adds a ♡. Cocoa is his best buddy: a brown sheep with a teal bandana, sporty and goofy; now and then he says "dude" or "bro". Mochi is a small cheerful chibi sheep who is learning about money with the child watching.`;

// ---- the knowledge base: one money idea each, in words a 6-9 year old understands, with numbers to use
export const LESSON_CARDS = [
  { id: "interest", name: "interest", fact: "A bank pays you a little extra, called interest, for keeping your money there.", idea: "a friend keeps money in Mochi Bank and gets a little extra", numbers: [10, 1, 11, 20, 2, 22] },
  { id: "compound", name: "interest on interest", fact: "Interest earns interest too, so money in the bank grows a little faster the longer you leave it.", idea: "watching savings grow week by week", numbers: [10, 1, 11, 12] },
  { id: "budget", name: "making a budget", fact: "A budget is a plan for your money before you spend it: some to save, some to spend.", idea: "planning birthday money", numbers: [10, 5, 4, 1, 6] },
  { id: "needs", name: "needs and wants", fact: "Needs are things you must have; wants are nice extras that can wait.", idea: "choosing between something needed for a plan and a fun extra", numbers: [3, 5, 2] },
  { id: "unit", name: "price for one", fact: "A bigger pack can cost less for each one: compare the price for one before you buy.", idea: "two packs of the same snack at different sizes", numbers: [1, 4, 3, 2] },
  { id: "goal", name: "saving for a goal", fact: "Saving a little often adds up to something big.", idea: "saving a bit each week for something special", numbers: [2, 5, 10] },
  { id: "wait", name: "waiting a day", fact: "Waiting a day before buying something helps you know if you really want it.", idea: "a shiny thing in a shop window", numbers: [6, 8] },
  { id: "borrow", name: "borrowing", fact: "When you borrow money you must pay it back, and sometimes a little extra.", idea: "a friend borrows and pays back", numbers: [5, 1, 6, 3, 4] },
  { id: "rainy", name: "a rainy-day fund", fact: "A rainy-day fund is money saved for surprises, like something breaking.", idea: "something breaks and needs fixing", numbers: [4, 5, 3] },
  { id: "giving", name: "giving", fact: "Sharing some money to help others is part of a good money plan.", idea: "putting a little in a share jar for an animal shelter", numbers: [1, 2, 6] },
  { id: "earning", name: "earning", fact: "Money comes from work: doing jobs and helping out.", idea: "doing chores or selling lemonade to earn", numbers: [1, 2, 3, 6] },
  { id: "tradeoff", name: "trade-offs", fact: "When money can only buy one thing, choosing it means giving up the other.", idea: "two things that cost the same and enough money for only one", numbers: [8, 5] },
  { id: "change", name: "getting change", fact: "If you pay with more than the price, you get the extra back as change.", idea: "paying for a snack with a bigger bill", numbers: [5, 3, 2, 10, 4, 6] },
  { id: "ads", name: "ads", fact: "Ads try to make you want things; ask yourself if you really need it.", idea: "a loud ad for a toy that looks better than it is", numbers: [12, 15] },
  { id: "monthly", name: "costs that repeat", fact: "Some things cost money every week or month, and it adds up.", idea: "a game that costs a little every week", numbers: [2, 4, 8] },
  { id: "card", name: "bank cards", fact: "A bank card spends real money from an account, just like cash; it isn't free money.", idea: "a friend thinks a card means free money", numbers: [5, 10] },
  { id: "shops", name: "comparing shops", fact: "The same thing can cost different amounts in different shops.", idea: "the same ball at two different stands", numbers: [6, 4, 2] },
  { id: "receipt", name: "checking receipts", fact: "Check your receipt or change to catch mistakes.", idea: "a receipt with a wrong total", numbers: [2, 1, 3] },
];
const CARD = Object.fromEntries(LESSON_CARDS.map((c) => [c.id, c]));

// props a generated scene may use (his own, so they're on stage at once)
export const GEN_PROPS = ["little bank", "three money jars", "savings jar", "piggy bank", "wallet", "play money", "stack of coins", "money bag", "bank card", "calculator", "receipt", "price tag",
  "shopping bag", "lemonade stand", "money machine", "big gold coin", "cookie", "cupcake", "apple", "popcorn", "ice cream cone", "pizza slice", "present", "kite", "red balloon", "little teddy bear",
  "soccer ball", "book", "magenta smartphone", "magnifying glass"];
const DO = { arrive: "a friend (who: mimi or cocoa) comes by; with = a prop they carry, or empty", friend_say: "a friend (who) speaks", say: "Mochi speaks (who: mochi)",
  aside: "Mochi talks to the child watching (who: mochi)", show: "Mochi holds up or sets out a prop (who: mochi, with = the prop)", feel: "someone (who) shows a feeling (how: happy, surprised, thinking, proud, sad, love)",
  hug: "a friend (who) hugs Mochi", dance: "someone (who) dances" };
const FEELS = ["happy", "surprised", "thinking", "proud", "sad", "love", "excited", "shy", "laugh"];
// Nemotron names props loosely ("a price tag", "share jar", "lemonade stand sign", "basket of apples"): the nearest of his
const PROP_ALIASES = { "share jar": "three money jars", "spend jar": "three money jars", "save jar": "three money jars", "jars": "three money jars", "jar": "savings jar", "coins": "stack of coins", "coin": "big gold coin",
  "money": "play money", "bills": "play money", "dollar": "play money", "dollars": "play money", "cash": "play money", "bank": "little bank", "mochi bank": "little bank", "atm": "money machine", "card": "bank card",
  "ball": "soccer ball", "balloon": "red balloon", "teddy": "little teddy bear", "phone": "magenta smartphone", "stand": "lemonade stand", "lemonade": "lemonade stand", "tag": "price tag", "bag": "shopping bag", "piggy": "piggy bank", "ice cream": "ice cream cone", "pizza": "pizza slice", "gift": "present", "toy": "present" };
export function propName(w) {
  let t = String(w || "").toLowerCase().replace(/^(?:a|an|the|some|his|her|my|their|two|three|second|first)\s+/g, "").replace(/^(?:a|an|the|some|second|first)\s+/, "").trim();
  if (!t) return null;
  if (GEN_PROPS.includes(t)) return t;
  const sing = t.replace(/(?<=[a-z])s$/, "");
  if (GEN_PROPS.includes(sing)) return sing;
  const inside = GEN_PROPS.filter((p) => new RegExp(`\\b${p}s?\\b`).test(t)).sort((a, b) => b.length - a.length)[0];   // "lemonade stand sign" → lemonade stand
  if (inside) return inside;
  const alias = Object.keys(PROP_ALIASES).sort((a, b) => b.length - a.length).find((k) => new RegExp(`\\b${k}\\b`).test(t));
  return alias ? PROP_ALIASES[alias] : null;
}
// "Mochi: \"Wow!\"" → "Wow!"
const unname = (s) => String(s || "").replace(/^\s*(?:mochi|mimi|cocoa)\s*:\s*/i, "").replace(/^["“'](.*)["”']$/s, "$1").trim();
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const beatSchema = { type: "object", properties: { do: { type: "string", enum: Object.keys(DO) }, who: { type: "string", enum: ["mochi", "mimi", "cocoa"] }, with: { type: "string" }, how: { type: "string" }, line: { type: "string", description: "the words said, without the speaker's name or quotes" } }, required: ["do", "who", "line"] };
export const GEN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    beats: { type: "array", items: beatSchema, minItems: 3, maxItems: 8 },
    question: { type: "string" },
    choices: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
    answer: { type: "string", description: "the right choice, copied word for word from choices" },
    right: { type: "integer", description: "the number of the right choice: 1 for the first, 2 for the second, 3 for the third" },
    yes: { type: "array", items: beatSchema, minItems: 1, maxItems: 3, description: "what happens when they pick the right one: Mochi says why it's right, a friend reacts" },
    no: { type: "array", items: beatSchema, minItems: 1, maxItems: 3, description: "what happens when they pick a wrong one: Mochi kindly explains the right answer" },
    reveal: { type: "string", description: "one line Mochi says if nobody answers: the right answer and why" },
    math: { type: "array", items: { type: "string" }, description: "every sum the scene uses, written like 10 + 1 = 11 or 3 * 2 = 6" },
  },
  required: ["title", "beats", "question", "choices", "answer", "right", "yes", "no", "reveal", "math"],
};

const EXAMPLE = { title: "the better deal", beats: [{ do: "arrive", who: "mimi", with: "cookie", line: "Cookies! One for $1, or a pack of 3 for $2 ♡" }, { do: "friend_say", who: "cocoa", line: "Bro, I want 3 cookies. Which way is cheaper?" }, { do: "say", who: "mochi", line: "Let's think it through!" }],
  question: "Which is the better deal for 3 cookies?", choices: ["3 single cookies", "The pack of 3"], answer: "The pack of 3", right: 2,
  yes: [{ do: "aside", who: "mochi", line: "Yes! 3 single cookies cost $3, but the pack is $2. Cocoa saves $1!" }, { do: "friend_say", who: "cocoa", line: "Sweet! A whole dollar saved, dude!" }],
  no: [{ do: "aside", who: "mochi", line: "Let's count: 3 single cookies cost $3, and the pack is only $2. The pack saves $1!" }],
  reveal: "3 single cookies cost $3, and the pack is $2: the pack saves $1!", math: ["1 + 1 + 1 = 3", "3 - 2 = 1"] };
/** a lesson not used lately (cards made recently go to the back) */
export function pickCard(recentCards = [], rnd = Math.random) {
  const fresh = LESSON_CARDS.filter((c) => !recentCards.includes(c.id)), pool = fresh.length ? fresh : LESSON_CARDS;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

export function genPrompt(card, { titles = [], goal = null } = {}) {
  const system = `You write tiny stage scenes that teach a child (6 to 9 years old) one money idea. ${FRIENDS}
The scene is acted out on screen beat by beat, then Mochi asks the child ONE question with 2 or 3 answer buttons; exactly one answer is right, the one that matches the lesson, and the others are clearly wrong (not just a different amount someone might also choose: ask about the idea, not a matter of taste). After they answer, Mochi explains kindly (right: why it's right; wrong: the right answer, never making them feel bad).
Beats (do): ${Object.entries(DO).map(([k, v]) => `${k}: ${v}`).join("; ")}.
Rules: plain short sentences (under 140 characters a line); small play-money amounts (under $30) written like $5; the money is play money in Mochi's world; no real companies, brands, apps, games or banks (Mochi Bank is fine); nothing scary or unkind; a friend can make a mistake and learn. Props (with) only from: ${GEN_PROPS.join(", ")}; leave with empty if none fits. Every sum you use goes in "math", written like 10 + 1 = 11; don't use any amount that isn't in the lesson's numbers or one of your sums. 4 to 7 beats before the question. Don't put the question in the beats: it goes in "question". Copy the right choice word for word into "answer", and give its number (1, 2 or 3) in "right".`;
  const user = `The lesson: ${card.name}. The fact to teach: ${card.fact}
An idea for the scene: ${card.idea}. Amounts you may use: ${card.numbers.map((n) => `$${n}`).join(", ")} (and sums of them).${goal ? `\nThe child is saving up for ${goal}: you may mention it once.` : ""}${titles.length ? `\nDon't repeat these scenes: ${titles.slice(-8).join("; ")}.` : ""}
Write the scene as JSON. An example of the shape (a different lesson; write your own scene):
${JSON.stringify(EXAMPLE)}`;
  return { system, user };
}

// ---- the code checks
const BRANDS = /\b(?:amazon|walmart|target|costco|apple pay|google|venmo|paypal|cash ?app|zelle|visa|mastercard|amex|chase|pnc|wells fargo|bank of america|citi(?:bank)?|capital one|t-?mobile|verizon|roblox|fortnite|minecraft|nintendo|xbox|playstation|disney|youtube|tiktok|netflix|mcdonald'?s|starbucks|lego|barbie|pokemon|pokémon)\b/i;
const UNKIND = /\b(?:stupid|dumb|idiot|hate|kill|die|dead|blood|gun|weapon|steal|stole|rob|loser|ugly|shut up|crime|police|jail|gamble|gambling|bet|lottery|casino|crypto|bitcoin|stock market|loan shark)\b/i;
const num = (s) => Math.round(Number(s) * 100) / 100;
/** "10 + 1 = 11" → true when it's right; anything that isn't a plain sum → false */
export function sumOk(s) {
  const c = /^\s*\$?(\d+(?:\.\d+)?)\s*(<|>|<=|>=)\s*\$?(\d+(?:\.\d+)?)\s*$/.exec(String(s || ""));   // ("6 > 4": Nemotron writes comparisons too)
  if (c) { const a = Number(c[1]), b = Number(c[3]); return c[2] === "<" ? a < b : c[2] === ">" ? a > b : c[2] === "<=" ? a <= b : a >= b; }
  const m = /^\s*\$?([\d.\s+\-*/()x×÷$]+?)\s*=\s*\$?(\d+(?:\.\d+)?)\s*$/.exec(String(s || ""));
  if (!m) return false;
  const expr = m[1].replace(/\$/g, "").replace(/[x×]/g, "*").replace(/÷/g, "/");
  if (!/^[\d.\s+\-*/()]+$/.test(expr)) return false;
  try { const v = Function(`"use strict"; return (${expr});`)(); return Number.isFinite(v) && Math.abs(v - Number(m[2])) < 0.011; } catch (_) { return false; }
}
const amounts = (s) => [...String(s || "").matchAll(/\$\s?(\d+(?:\.\d{1,2})?)/g)].map((m) => num(m[1]));
const sumNumbers = (s) => [...String(s || "").matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => num(m[1]));
const cleanLine = (s) => String(s || "").replace(/\s+/g, " ").trim();
const STOP = new Set(["the", "and", "for", "with", "that", "this", "your", "you", "his", "her", "them", "they", "then", "than", "from", "have", "just", "more", "less", "some", "into", "what", "will", "should", "would", "about", "only", "every", "time"]);
/** words that pick an answer when they type instead of tapping (its own distinctive words) */
export function choiceWords(choices) {
  const words = {};
  choices.forEach((c, i) => {
    const mine = String(c).toLowerCase().match(/[a-z]{4,}/g) || [];
    const others = new Set(choices.filter((_, j) => j !== i).flatMap((o) => String(o).toLowerCase().match(/[a-z]{4,}/g) || []));
    const own = [...new Set(mine.filter((w) => !STOP.has(w) && !others.has(w)))].slice(0, 4);
    const nums = (String(c).match(/\d+/g) || []).filter((n) => !choices.some((o, j) => j !== i && new RegExp(`\\b${n}\\b`).test(o)));
    const alts = [...own.map((w) => w.replace(/[^a-z]/g, "")), ...nums];
    if (alts.length) words[i + 1] = new RegExp(`\\b(?:${alts.join("|")})\\b`);
  });
  return words;
}

/** the model's JSON → a skit in money.js's shape, or the problems that keep it out */
export function validateGen(j, card, { pocket = new Set(GEN_PROPS) } = {}) {
  const problems = [];
  if (!j || typeof j !== "object") return { ok: false, problems: ["no JSON"] };
  const beat = (b0, where) => {
    if (!b0 || !DO[b0.do]) { problems.push(`${where}: a beat that isn't one we can play`); return null; }
    const b = { ...b0 }, line0 = cap(unname(cleanLine(b.line)));
    // the speaker decides the kind of line (Nemotron gave Cocoa a "say", Mochi's kind)
    if ((b.do === "say" || b.do === "aside" || (b.do === "show" && line0)) && (b.who === "mimi" || b.who === "cocoa")) { b.do = "friend_say"; b.with = ""; }
    if (b.do === "friend_say" && b.who === "mochi") b.do = "say";
    // a prop he doesn't have: the nearest one of his, else the line is just said
    const w = cleanLine(b.with) ? propName(b.with) : null;
    if (b.do === "show" && !w) { if (!line0) return null; b.do = "aside"; }
    const who = b.do === "say" || b.do === "aside" || b.do === "show" ? "mochi" : ["mimi", "cocoa", "mochi"].includes(b.who) ? b.who : null;
    if (!who || ((b.do === "arrive" || b.do === "friend_say" || b.do === "hug") && who === "mochi")) { problems.push(`${where}: ${b.do} by ${b.who}`); return null; }
    const out = { do: b.do, who };
    if (w && pocket.has(w)) out.with = w;
    if (b.do === "show" && !out.with) { problems.push(`${where}: show needs a prop`); return null; }
    if (b.do === "feel") out.how = FEELS.includes(String(b.how)) ? b.how : "happy";
    const line = line0;
    if (line) { if (line.length > 170) problems.push(`${where}: a line too long`); out.line = line.slice(0, 170); }
    if ((b.do === "friend_say" || b.do === "say" || b.do === "aside") && !out.line) { problems.push(`${where}: ${b.do} with nothing to say`); return null; }
    return out;
  };
  const split = (list) => list.flatMap((b) => (b.do === "arrive" && b.line ? [{ do: "arrive", who: b.who, ...(b.with ? { with: b.with } : {}) }, { do: "friend_say", who: b.who, line: b.line }] : [b]));
  const beats = split((Array.isArray(j.beats) ? j.beats : []).map((b, i) => beat(b, `beat ${i + 1}`)).filter(Boolean));
  const yes = split((Array.isArray(j.yes) ? j.yes : []).map((b, i) => beat(b, `yes ${i + 1}`)).filter(Boolean));
  const no = split((Array.isArray(j.no) ? j.no : []).map((b, i) => beat(b, `no ${i + 1}`)).filter(Boolean));
  // Mochi explains the answer: if the model left that out, his reveal line does it
  const reveal0 = cap(unname(cleanLine(j.reveal)));
  for (const list of [yes, no]) if (reveal0 && !list.some((b) => (b.do === "aside" || b.do === "say") && b.line)) list.unshift({ do: "aside", who: "mochi", line: reveal0.slice(0, 170) });
  const choices = (Array.isArray(j.choices) ? j.choices : []).map((c) => cleanLine(c).slice(0, 60)).filter(Boolean);
  const question = cap(unname(cleanLine(j.question))), reveal = reveal0, title = cleanLine(j.title).slice(0, 50) || card.name;
  if (beats.length < 3 || beats.length > 10) problems.push(`${beats.length} beats`);
  if (beats.filter((b) => b.line).length < 3) problems.push("hardly anything said");
  if (!beats.some((b) => b.who !== "mochi")) problems.push("no friend in it");
  if (!question || !question.endsWith("?")) problems.push("no question");
  if (choices.length < 2 || choices.length > 3 || new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) problems.push("2 or 3 different choices");
  // which one is right: the answer copied out (Nov 8, the first real try gave a number that wasn't 1-3), else the number
  // (counted from 1; a 0 means it counted from 0). Gemma's blind answer still has to agree.
  const said = cleanLine(j.answer).toLowerCase().replace(/[.!]$/, ""), byText = said ? choices.findIndex((c) => c.toLowerCase().replace(/[.!]$/, "") === said) : -1;
  let right = byText >= 0 ? byText + 1 : typeof j.right === "string" ? (choices.findIndex((c) => c.toLowerCase() === j.right.trim().toLowerCase()) + 1 || Number(String(j.right).replace(/\D/g, ""))) : Number(j.right);
  if (byText < 0 && right === 0 && choices.length) right = 1;
  if (!Number.isInteger(right) || right < 1 || right > choices.length) problems.push(`the right answer isn't one of the choices (${JSON.stringify(j.right)}${j.answer ? `, "${String(j.answer).slice(0, 40)}"` : ""})`);
  if (!yes.length || !no.length) problems.push("no explanation for an answer");
  if (!yes.some((b) => b.do === "aside" || b.do === "say") || !no.some((b) => b.do === "aside" || b.do === "say")) problems.push("Mochi doesn't explain the answer");
  if (!reveal) problems.push("no reveal line");
  const all = [title, question, reveal, ...choices, ...[...beats, ...yes, ...no].map((b) => b.line || "")].join(" \n ");
  if (BRANDS.test(all)) problems.push(`a real brand (${(BRANDS.exec(all) || [])[0]})`);
  if (UNKIND.test(all)) problems.push(`a word we don't use with kids (${(UNKIND.exec(all) || [])[0]})`);
  if (/https?:|www\.|\.com\b/i.test(all)) problems.push("a web address");
  // the arithmetic: every sum right, and every $ said comes from the card or a sum
  const math = (Array.isArray(j.math) ? j.math : []).map(cleanLine).filter(Boolean).slice(0, 8);
  const badSum = math.find((s) => !sumOk(s));
  if (badSum) problems.push(`a sum that's wrong or isn't a sum: "${badSum}"`);
  const known = new Set([...card.numbers.map(num), ...math.flatMap(sumNumbers)]);
  const stray = [...new Set(amounts(all))].filter((a) => !known.has(a));
  if (stray.length) problems.push(`amounts with no sum behind them: ${stray.map((a) => `$${a}`).join(", ")}`);
  if (problems.length) return { ok: false, problems };
  const id = `gen-${card.id}-${Date.now().toString(36)}`;
  return { ok: true, problems: [], skit: { id, title, gen: true, card: card.id, lesson: card.name,
    beats: [...beats, { do: "say", who: "mochi", line: question }], choices: choices.map((text, i) => ({ n: i + 1, text })), right, words: choiceWords(choices), yes, no: { 0: no }, reveal, math } };
}

// ---- Gemma's blind check: the question and the scene, not the answer
export const CHECK_SCHEMA = { type: "object", properties: { pick: { type: "integer" }, ok: { type: "boolean" }, problem: { type: "string" } }, required: ["pick", "ok"] };
export function checkPrompt(skit, card) {
  const lines = skit.beats.map((b) => `${b.who === "mochi" ? "Mochi" : Name(b.who)}${b.do === "show" ? ` shows the ${b.with}` : b.do === "arrive" ? ` comes by${b.with ? ` with a ${b.with}` : ""}` : ""}${b.line ? `: "${b.line}"` : ""}`).join("\n");
  return { system: "You check short money lessons for young children before they see them. You're careful and fair.",
    user: `A scene for a 6-9 year old, about ${card.name} (the fact it should teach: ${card.fact}):\n${lines}\nThe choices:\n${skit.choices.map((c) => `${c.n}. ${c.text}`).join("\n")}\nWhich choice is right? Answer with its number in "pick". Then "ok": true only if the scene is kind, clear for a young child, its money facts are true, and exactly one choice is right while every other choice is clearly wrong (if another choice could also be a fair answer, that's a problem); false otherwise, with the "problem" in a few words.` };
}

/** write one: Nemotron writes, code checks, Gemma checks blind. → { ok, skit?, by, problems, ms } */
export async function generateSkit({ writer, checker, card, titles = [], goal = null, log = console }) {
  const t0 = Date.now(), { system, user } = genPrompt(card, { titles, goal });
  let r;
  try { r = await writer.chat({ what: "skitgen", system, user, schema: GEN_SCHEMA, schemaName: "money_skit", maxTokens: 1400, temperature: 0.7, background: true, anyTask: true, think: false, timeoutMs: 90000 }); }
  catch (e) { return { ok: false, problems: [`writer: ${e.message}`], ms: Date.now() - t0 }; }
  const by = r.provider === "local" ? "Gemma" : /nemotron/i.test(`${r.provider} ${r.model}`) ? "Nemotron" : /gemini/i.test(`${r.provider} ${r.model}`) ? "Gemini" : r.provider || "a model";
  let j = r.json;
  if (!j && r.text) { try { j = JSON.parse(String(r.text).replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1")); } catch (_) { j = null; } }
  const v = validateGen(j, card);
  if (!v.ok) return { ok: false, by, problems: v.problems, ms: Date.now() - t0, raw: j ? JSON.stringify(j).slice(0, 2500) : String(r.text || "").slice(0, 1200) };
  let c;
  try { const p = checkPrompt(v.skit, card); c = await checker.chat({ what: "skitcheck", ...p, schema: CHECK_SCHEMA, schemaName: "skit_check", maxTokens: 200, temperature: 0 }); }
  catch (e) { return { ok: false, by, problems: [`checker: ${e.message}`], ms: Date.now() - t0 }; }
  const cj = c.json || (() => { try { return JSON.parse(String(c.text || "").replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1")); } catch (_) { return null; } })();
  if (!cj) return { ok: false, by, problems: ["the checker gave no answer"], ms: Date.now() - t0 };
  if (Number(cj.pick) !== v.skit.right) return { ok: false, by, problems: [`the checker picked ${cj.pick}, the scene says ${v.skit.right}`], ms: Date.now() - t0 };
  if (cj.ok === false) return { ok: false, by, problems: [`the checker: ${String(cj.problem || "not okay").slice(0, 120)}`], ms: Date.now() - t0 };
  const checkedBy = c.provider === "local" || !c.provider ? "Gemma" : c.provider;
  return { ok: true, by, checkedBy, skit: { ...v.skit, by, checkedBy, at: new Date().toISOString() }, problems: [], ms: Date.now() - t0 };
}

// stored as JSON: the answer words are kept as their source
export const toStore = (sk) => ({ ...sk, words: Object.fromEntries(Object.entries(sk.words || {}).map(([k, re]) => [k, re instanceof RegExp ? re.source : String(re)])) });
export const fromStore = (sk) => ({ ...sk, words: Object.fromEntries(Object.entries(sk.words || {}).map(([k, src]) => { try { return [k, new RegExp(src)]; } catch (_) { return [k, /^$^/]; } })) });
export const cardOf = (id) => CARD[id] || null;
