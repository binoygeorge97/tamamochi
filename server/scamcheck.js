// "Is this a scam?" (Nov 7, the T-Mobile track; Binoy: "maybe we can give nemotron this task (we can also use Gemma
// if needed)"). Paste a text, an email or what a caller said. Two readers, and an honest answer:
//   1. Mochi's rules, on the M5, instant: the warning signs a person can learn (a link with an odd address, hurry,
//      a prize you never entered for, money in a strange way, a code or password asked for, threats, secrecy,
//      someone on a new number…), each with the words in the message that show it;
//   2. Nemotron (on Brev, thinking switched off so it answers in a few seconds), reading it against the same list of
//      scam types; Gemma if Nemotron can't.
// The verdict says how sure it is and why: both readers agree → "pretty sure"; they disagree → "not sure, so be
// careful"; only the rules answered → it says so. Then what to do (don't tap or reply, never share a code, check
// through the real app or the number on your card, forward to 7726, delete and block, tell a grown-up).
// Mochi says it in his own words; the page shows the card. Pure, apart from the model call.

/* ---------- the scam types (and "looks normal") ---------- */
export const TAXONOMY = {
  prize: { name: "prize or giveaway", re: /\b(?:congrat\w*|you(?:'ve| have)? (?:won|been selected)|winner|prize|giveaway|sweepstakes|lottery|free (?:iphone|gift|cash|money)|claim (?:your|now|it)|reward)\b/ },
  account: { name: "fake bank or account alert", re: /\b(?:account|card|bank|payment method|apple ?id|netflix|paypal|amazon)\b.{0,60}\b(?:locked|suspended|compromised|disabled|on hold|unusual|suspicious|restricted|blocked|declined|expired|verify|confirm|update)\b|\bunusual (?:sign[- ]?in|activity|login)\b/ },
  delivery: { name: "fake delivery notice", re: /\b(?:package|parcel|delivery|shipment|courier|redeliver\w*|customs|tracking|usps|ups|fedex|dhl)\b/ },
  impersonation: { name: "someone pretending to be family or a friend", re: /\b(?:hi (?:mom|mum|dad|grandma|grandpa)|new (?:phone )?number|lost my phone|broke my phone|it'?s me,? \w+|this is your (?:son|daughter|grandson|granddaughter)|i'?m in trouble)\b/ },
  code: { name: "asking for a verification code", re: /\b(?:send|share|read|tell|forward|give)\b.{0,40}\b(?:code|pin|passcode|one[- ]time)\b|\b(?:code|pin)\b.{0,40}\b(?:send|share|read|tell|forward) (?:it|me|us)\b/ },
  tech: { name: "fake tech support", re: /\b(?:virus|infected|malware|hacked|tech(?:nical)? support|remote access|your (?:computer|device|phone) (?:is|has)|subscription (?:renewal|will renew)|refund (?:department|team))\b/ },
  government: { name: "fake government, toll or tax notice", re: /\b(?:irs|tax refund|unpaid (?:toll|tax|fine)|toll|fine|warrant|arrest|social security|ssn|court|dmv|customs fee|stimulus|government grant)\b/ },
  money: { name: "too-good job or money offer", re: /\b(?:job offer|work from home|earn \$?\d+|per (?:day|hour)|easy money|part[- ]time|recruit\w*|invest\w*|crypto\w*|bitcoin|double your|guaranteed (?:return|profit)|trading)\b/ },
  // (Nov 7: the phone-carrier ones, for T-Mobile: SIM swaps, port-out PINs, fake bills, "voicemail" links, one-ring calls)
  carrier: { name: "fake phone-carrier notice or SIM swap", re: /\b(?:sim (?:card|swap|change)|e-?sim|port(?:ing)?[- ]?out|transfer (?:pin|your number)|number transfer|carrier|wireless (?:account|bill|service)|your (?:phone|mobile) (?:bill|plan|account|service|line)|line (?:will be|has been) (?:suspended|disconnected)|new voicemail|missed call from)\b/ },
  legit: { name: "looks normal", re: /^$/ },
};
export const TYPES = Object.keys(TAXONOMY);

/* ---------- the warning signs (message-side; scams.js has the kid-words ones for the game) ---------- */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|co|io|xyz|top|win|click|link|live|shop|help|site|online|vip|app|me|ly|gl|us|cc|tk|ml|ga|cf|gq|ru|cn)(?:\/[^\s<>"']*)?/gi;
const SHORT = /\b(?:bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rb\.gy|shorturl|tiny\.cc)\b/i;
const ODD_TLD = /\.(?:xyz|top|win|click|link|live|shop|help|site|online|vip|cc|tk|ml|ga|cf|gq|ru|cn|info)(?:\/|$)/i;
const LOOKALIKE = /(?:secure|login|verify|account|update|support|confirm|wallet|billing|refund|claim|prize|gift|free|track|redeliver|toll|pay)[-.]/i;
export const SIGNS = {
  badLink: { w: 2, name: "a link with an odd address", say: "the link's address is strange (a shortened link, an odd ending, or words like \"secure-login\" stuck on): a fake website can steal your password" },
  link: { w: 1, name: "a link to tap", say: "it wants you to tap a link" },
  hurry: { w: 1.5, name: "it rushes you", say: "it rushes you so you don't stop to think",
    re: /\b(?:urgent\w*|immediately|right away|real quick|act now|asap|(?:due|pay|by) (?:today|tonight)|limited (?:spots|time)|within \d+ ?(?:minutes?|mins?|hours?|hrs?|days?)|in \d+ ?(?:minutes?|mins?|hours?|hrs?)|today only|last chance|expires? (?:today|soon|in)|final (?:notice|warning|reminder)|before (?:it'?s too late|midnight)|don'?t delay|hurry|(?:now|today|tonight) or (?:your|you|we|it)(?:'ll)?)\b/ },
  threat: { w: 1.5, name: "it tries to scare you", say: "it tries to scare you (locked, suspended, fined, arrested) so you panic",
    re: /\b(?:locked|suspend\w*|disabled|closed|terminated|frozen|blocked|penalt\w*|fine[ds]?|arrest\w*|warrant|legal action|lawsuit|deport\w*|police|late fee|collections|infected|viruses|hacked|compromised|deleted)\b/ },
  prize: { w: 1.5, name: "a prize you never entered for", say: "it says you won something you never entered for: too good to be true", re: TAXONOMY.prize.re },
  oddPay: { w: 2, name: "it asks for money in a strange way", say: "it asks for gift cards, crypto, a wire or an app payment: real companies and offices don't",
    re: /\b(?:gift ?cards?|itunes card|google play card|steam card|wire (?:transfer|the money)|western union|moneygram|bitcoin|crypto\w*|zelle|venmo|cash ?app|send (?:me )?(?:the )?(?:money|numbers|codes?|\$\d+))\b/ },
  smallFee: { w: 1.5, name: "a small fee to unlock something", say: "it asks for a small fee to release a parcel, a prize or a refund",
    re: /\b(?:pay|fee|charge)\b.{0,30}\$\s?\d{1,2}(?:\.\d\d)?\b|\$\s?\d{1,2}(?:\.\d\d)?\b.{0,30}\b(?:fee|charge|to (?:release|redeliver|claim|unlock))\b/ },
  askSecret: { w: 2.5, name: "it asks for a code or password", say: "it asks for a code, password or card number: never share those, not with anyone",
    re: /\b(?:send|share|read|tell|give|forward|reply with|enter|type|confirm)\b.{0,40}\b(?:code|pin|password|passcode|card number|cvv|account number|social security|ssn|date of birth|login|security question|bank details)\b|\b(?:code|pin|passcode)\b.{0,50}\b(?:send|read|forward|tell|give|text|reply with) (?:it|them|me|us)\b|\b(?:code|pin|passcode)\b.{0,50}\b(?:text|send|reply) (?:it|them) back\b/ },   // ("…code is 482913. Text it back…": Nov 7, a real check the rules missed)
  secret: { w: 2, name: "it says to keep it a secret", say: "it says to keep it secret: a real friend or company never does",
    re: /\b(?:don'?t tell|do not tell|keep (?:this|it) (?:between us|a secret|quiet)|tell no ?one|our (?:little )?secret)\b/ },
  stranger: { w: 1.5, name: "someone on a new number", say: "it's from a new number, pretending to be someone you know", re: TAXONOMY.impersonation.re },
  generic: { w: 0.5, name: "it doesn't use your name", say: "it doesn't use your name (\"Dear customer\")", re: /\b(?:dear (?:customer|user|member|client|sir|madam|valued)|valued (?:customer|member))\b/ },
  remote: { w: 2, name: "it wants into your device", say: "it wants you to call a number or let someone onto your device", re: /\b(?:call (?:us |this number |back )?(?:now|immediately|right away)|call (?:microsoft|apple|our (?:refund|support|fraud))|remote access|anydesk|teamviewer|install (?:this|the) app|call \d[\d-]{6,})\b/ },
  tooGood: { w: 2, name: "an offer that's too good to be true", say: "it promises easy money or a big win: if it sounds too good to be true, it is",
    re: /\b(?:earn \$?\d[\d,]*|\$\d[\d,]* (?:a|per) (?:day|week|hour)|guaranteed (?:returns?|profit|income)|double your (?:money|investment)|get \$\d[\d,]* back|easy money|no experience needed|keep \d+%|made \$\d[\d,]* (?:last|this) (?:month|week))\b/ },
  fakeCharge: { w: 2, name: "a charge you didn't make", say: "it says you were charged for something you didn't buy, to get you to call or click",
    re: /\b(?:order (?:was|has been) placed|will renew (?:today|for)|you(?:'ve| have) been charged|purchase of \$\d[\d,.]* .{0,40}call|refund (?:department|team))\b/ },
  askMoney: { w: 1.5, name: "it asks you for money", say: "it asks you to send money or pay something for them",
    re: /\b(?:can you|could you|please|need you to)\s+(?:send|zelle|venmo|wire|lend|pay|buy)\b|\bsend (?:me )?\$\d|\bpay (?:a|the|my) (?:bill|deposit|fee) for me\b/ },
};
// what real messages say: "don't share this code", "we will never ask", "if this wasn't you, ignore it"
const SAFE_SIGNS = /\b(?:do(?:n'?t| not) share (?:this|the|your) code|never ask (?:you )?for|we will never|if (?:this|it) wasn'?t you,? (?:you can )?ignore|no action (?:is )?needed|reply stop to (?:opt out|unsubscribe))\b/;

const low = (t) => String(t || "").toLowerCase().replace(/[’`]/g, "'");
// the words that show it, widened to whole words (a few either side)
const quoteOf = (text, re) => {
  const m = re && new RegExp(re.source, re.flags.replace("g", "")).exec(text); if (!m) return null;
  let s = m.index, e = m.index + m[0].length;
  for (let k = 0; k < 2 && s > 0; k++) { const j = text.lastIndexOf(" ", s - 2); s = j < 0 ? 0 : j + 1; }
  for (let k = 0; k < 2 && e < text.length; k++) { const j = text.indexOf(" ", e + 1); e = j < 0 ? text.length : j; }
  return `${s > 0 ? "…" : ""}${text.slice(s, e).trim().replace(/[,;:]$/, "")}${e < text.length ? "…" : ""}`;
};

/* ---------- the link X-ray (Nov 7): the address taken apart, never opened ---------- */
const TWO_PART = /\.(?:co|com|org|net|gov|ac|edu)\.[a-z]{2}$/;
const BRAND_WORDS = /secure|login|log-in|signin|verify|verification|account|update|support|confirm|wallet|billing|refund|claim|prize|gift|free|track|redeliver|delivery|toll|pay|bank|service|help|alert|official/i;
export function xray(url) {
  const raw = String(url || ""), host = raw.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase().replace(/^www\./, "");
  if (!host || !/\./.test(host)) return null;
  const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host);
  const labels = host.split("."), n = TWO_PART.test(host) ? 3 : 2, real = ip ? host : labels.slice(-n).join("."), front = ip ? "" : labels.slice(0, -n).join(".");
  const tld = labels.at(-1), notes = [];
  if (SHORT.test(host)) notes.push("It's a shortened link: it hides where it really goes.");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) notes.push("It's just numbers, not a company's name: real companies don't send links like that.");
  if (front && /\.(?:com|net|org)$|[a-z]{3,}\.(?:com|net|org)/.test(front + ".")) notes.push(`The real website is "${real}". The "${front}" in front is a disguise to make it look like somewhere else.`);
  else if (front && BRAND_WORDS.test(front)) notes.push(`The real website is "${real}"; "${front}" in front is just decoration.`);
  const name = real.split(".")[0];
  if (BRAND_WORDS.test(name) && name.includes("-")) notes.push(`"${name}" has words like "${(name.match(BRAND_WORDS) || [""])[0]}" stuck on with dashes to look official: a real company uses its plain name.`);
  if (ODD_TLD.test("." + tld + "/")) notes.push(`It ends in ".${tld}", an ending big companies almost never use for messages like this.`);
  if (/^http:\/\//i.test(raw)) notes.push("It starts with http:// (no s): not even a locked connection.");
  return { url: raw.slice(0, 120), host, real, notes: notes.slice(0, 3) };
}

/** Mochi's rules: { verdict, score, risk 0-100, type, signs: [{ id, name, say, quote }], links } */
export function ruleCheck(text) {
  const raw = String(text || "").slice(0, 2000), t = low(raw);
  const links = [...new Set((raw.match(URL_RE) || []).map((u) => u.replace(/[.,!?)]+$/, "")))];
  const signs = [];
  const add = (id, quote) => signs.push({ id, name: SIGNS[id].name, say: SIGNS[id].say, quote: quote || null });
  const bad = links.find((u) => SHORT.test(u) || ODD_TLD.test(u.replace(/^https?:\/\//, "").split(/[/?#]/)[0] + "/") || LOOKALIKE.test(u.replace(/^https?:\/\//, "").split(/[/?#]/)[0]) || /^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(u));
  if (bad) add("badLink", bad); else if (links.length) add("link", links[0]);
  for (const id of ["hurry", "threat", "prize", "oddPay", "smallFee", "askSecret", "secret", "stranger", "generic", "remote", "tooGood", "fakeCharge", "askMoney"]) {
    if (id === "askMoney" && signs.some((x) => x.id === "oddPay")) continue;   // (said once: the strange way is the sign)
    if (SIGNS[id].re.test(t)) add(id, quoteOf(raw, new RegExp(SIGNS[id].re.source, "i")));
  }
  // (a fee only counts once it's paired with something else odd; a threat word alone in a normal notice is weak)
  let score = signs.reduce((s, x) => s + SIGNS[x.id].w, 0);
  const safe = SAFE_SIGNS.test(t);
  if (safe && !signs.some((s) => ["badLink", "oddPay", "secret", "stranger", "remote"].includes(s.id))) score -= 2.5;
  if (signs.length === 1 && ["threat", "generic", "link", "hurry"].includes(signs[0].id)) score -= 0.5;
  score = Math.max(0, Math.round(score * 10) / 10);
  const verdict = score >= 4 ? "scam" : score >= 2 ? "suspicious" : "safe";
  return { verdict, score, risk: Math.round(100 * (1 - Math.exp(-score / 3))), type: ruleType(t, signs, verdict), signs, links, safeSigns: safe, xray: links.slice(0, 2).map(xray).filter((x) => x && x.notes.length) };
}
function ruleType(t, signs, verdict) {
  if (verdict === "safe") return "legit";
  const order = ["code", "carrier", "impersonation", "tech", "government", "delivery", "account", "prize", "money"];
  for (const id of order) if (TAXONOMY[id].re.test(t)) return id;
  if (signs.some((s) => s.id === "askSecret")) return "code";
  if (signs.some((s) => s.id === "oddPay")) return "money";
  return "account";
}

/* ---------- the model's reading ---------- */
export const MODEL_SCHEMA = {
  type: "object", additionalProperties: false, required: ["verdict", "type", "confidence", "tells", "reason"],
  properties: {
    verdict: { type: "string", enum: ["scam", "suspicious", "safe"] },
    type: { type: "string", enum: TYPES },
    confidence: { type: "number" },
    tells: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["tell", "quote"], properties: { tell: { type: "string" }, quote: { type: "string" } } } },
    reason: { type: "string" },
  },
};
export function modelPrompt(text) {
  return {
    system: `You check messages for scams (texts, emails, what a caller said) for a family app. Read the message and decide: "scam", "suspicious" (some warning signs, can't be sure) or "safe". Pick its type: ${TYPES.map((k) => `${k} (${TAXONOMY[k].name})`).join(", ")}. Give your confidence from 0 to 1, up to 4 warning signs ("tells") each with the exact words from the message that show it, and one plain sentence of reason a 10-year-old would understand. Real companies do send texts (a delivery update, a code that says "don't share it", a bank alert that tells you to use their app); don't call those scams. Reply with JSON only.`,
    user: `The message:\n"""\n${String(text).slice(0, 2000)}\n"""`,
  };
}
export function cleanModel(j) {
  if (!j || typeof j !== "object" || !["scam", "suspicious", "safe"].includes(j.verdict)) return null;
  return { verdict: j.verdict, type: TYPES.includes(j.type) ? j.type : null, confidence: Math.max(0, Math.min(1, +j.confidence || 0)),
    tells: (Array.isArray(j.tells) ? j.tells : []).slice(0, 4).map((x) => ({ tell: String((x && x.tell) || "").slice(0, 120), quote: String((x && x.quote) || "").slice(0, 140) })).filter((x) => x.tell),
    reason: String(j.reason || "").slice(0, 240) };
}

/* ---------- together, honestly ---------- */
const RANK = { safe: 0, suspicious: 1, scam: 2 };
const NAMES = { local: "Gemma", "nemotron-brev": "Nemotron", nemotron: "Nemotron", "nemotron-api": "Nemotron", gemini: "Gemini", anthropic: "Claude", openai: "GPT" };
export const readerName = (p) => NAMES[p] || (p ? String(p).replace(/^./, (c) => c.toUpperCase()) : "a model");
export function combine(rules, model, reader = null, words = null) {
  const who = readerName(reader);
  let verdict, sure, why;
  // three readers (Nov 7, after the first scores on our own set: two that disagreed flagged too many normal messages):
  // Mochi's rules, his word counter (trained on our own set, on this computer) and Nemotron vote; two of three decide
  if (words && model) {
    const flags = [RANK[rules.verdict] > 0, words.verdict === "scam", RANK[model.verdict] > 0], n = flags.filter(Boolean).length;
    const strong = rules.verdict === "scam" || model.verdict === "scam" || words.p >= 0.9;
    verdict = n >= 2 ? (strong ? "scam" : "suspicious") : "safe";
    sure = n === 3 || n === 0 ? "pretty sure" : "fairly sure";
    why = n === 3 ? `All three checks (Mochi's rules, his word counter and ${who}) say it's a scam.` : n === 0 ? `All three checks (Mochi's rules, his word counter and ${who}) say it looks normal.`
      : n === 2 ? `Two of three checks say it's a scam (${["his rules", "his word counter", who].filter((_, i) => !flags[i])[0]} didn't).` : `Two of three checks say it's fine (${["his rules", "his word counter", who].filter((_, i) => flags[i])[0]} had a doubt).`;
  } else if (!model && words) {   // the model didn't answer: the two readers on this computer
    const a = RANK[rules.verdict] > 0, b = words.verdict === "scam";
    if (a === b) { verdict = a ? (rules.verdict === "scam" || words.p >= 0.9 ? "scam" : "suspicious") : "safe"; sure = "fairly sure"; why = `${who === "a model" ? "The model" : who} didn't answer; Mochi's rules and his word counter agree.`; }
    else { verdict = "suspicious"; sure = "not sure"; why = `${who === "a model" ? "The model" : who} didn't answer, and Mochi's rules and his word counter disagree, so be careful.`; }
  } else if (!model) { verdict = rules.verdict; sure = "only the rules"; why = `Only Mochi's rules checked it (${who === "a model" ? "the model" : who} didn't answer).`; }
  else if ((RANK[rules.verdict] > 0) === (RANK[model.verdict] > 0)) {
    verdict = RANK[rules.verdict] >= RANK[model.verdict] ? rules.verdict : model.verdict;
    if (verdict === "suspicious" && rules.verdict === "suspicious" && model.verdict === "scam" && model.confidence >= 0.8) verdict = "scam";
    sure = "pretty sure"; why = `Mochi's rules and ${who} agree.`;
  } else { verdict = "suspicious"; sure = "not sure"; why = `Mochi's rules and ${who} disagree, so be careful.`; }
  const type = verdict === "safe" ? "legit" : (model && model.type && model.type !== "legit" ? model.type : rules.type === "legit" ? "account" : rules.type);
  const tells = [...rules.signs.map((s) => ({ tell: s.name, quote: s.quote, say: s.say }))];
  // the model's signs, when they add something: not one the rules already named, not the same words quoted again,
  // and not a bare quote passed off as a sign (Nov 7, a real card: "Your account is LOCKED" listed under the rules'
  // "it tries to scare you", which quoted the same words)
  const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const overlaps = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a.includes(b) || b.includes(a)); };
  for (const m of (model ? model.tells : [])) {
    if (tells.length >= 5) break;
    if (tells.some((x) => x.tell.toLowerCase().split(" ")[0] === m.tell.toLowerCase().split(" ")[0])) continue;
    if (m.quote && tells.some((x) => overlaps(x.quote, m.quote))) continue;
    if (overlaps(m.tell, m.quote) || tells.some((x) => overlaps(x.quote, m.tell))) continue;
    tells.push({ tell: m.tell, quote: m.quote || null });
  }
  return { verdict, sure, why, type, typeName: TAXONOMY[type].name, tells: verdict === "safe" ? tells.slice(0, 2) : tells.slice(0, 5), steps: stepsFor(verdict, type, rules), reason: model ? model.reason : null,
    xray: rules.xray || [], rules: { verdict: rules.verdict, risk: rules.risk }, model: model ? { verdict: model.verdict, confidence: model.confidence, by: who } : null, ...(words ? { words: { verdict: words.verdict, p: Math.round(words.p * 100) / 100 } } : {}) };
}
/** his word counter (scamgen.js trainBayes, trained on our own set when the server starts): (text) → { verdict, p } */
let WORDS = null, WORDS_INFO = null;
export function setWordModel(fn, info = null) { WORDS = fn; WORDS_INFO = info; }
export const wordModelInfo = () => WORDS_INFO;
export function stepsFor(verdict, type, rules = { links: [] }) {
  if (verdict === "safe") return ["It looks normal. If it later asks for money, a code or a password, stop and check with someone first."];
  const s = [];
  if (rules.links && rules.links.length) s.push("Don't tap the link.");
  s.push(type === "tech" ? "Don't call the number in it, and don't let anyone onto your device." : "Don't reply to it.");
  s.push("Never share a code, a password or a card number, with anyone.");
  const own = { account: "To check, open your bank's own app, or call the number on the back of your card.", delivery: "To check a parcel, use the shipper's own app or website, not the link.",
    impersonation: "Call them on the number you already have for them, and ask.", government: "Government offices and toll agencies don't ask for payment by text. Check their real website.",
    prize: "If you didn't enter, you didn't win.", code: "That code is the key to your account: nobody real will ask you for it.", money: "If it sounds too good to be true, it is.", tech: "Real tech companies don't contact you out of the blue." }[type];
  if (own) s.push(own);
  s.push("Forward it to 7726 (SPAM) to report it, then delete it and block the number.", "Tell a grown-up you trust.");
  return s;
}

/* ---------- asking ---------- */
const ASK = /\b(?:(?:is|was) (?:this|that|it)(?: (?:text|message|email|e-mail|call|link|website|site|number|dm|offer|voicemail))? (?:a |an )?(?:scam|scammer|fake|legit|real|safe|spam|phishing|fraud)|scam ?check|check (?:this|if this|whether this)\b.{0,30}\b(?:scam|fake|legit|text|message|email|call|link)|should i (?:click|tap|trust|reply to|open|answer) (?:this|it|that)|does this (?:look|seem|sound) (?:like a scam|legit|fake|safe|real)|(?:can|could) you check (?:this|a) (?:text|message|email|link))\b/;
/** "is this a scam? <message>" → { message } ; "is this text a scam?" with nothing pasted → { waiting: true }; else null */
export function scamCheckAsk(text) {
  const raw = String(text || "").trim(), t = low(raw);
  if (!ASK.test(t)) return null;
  // the message: after a colon or a line break, or in quotes, else what's left once the asking words are gone
  // the message: in quotes; else what comes after the question when it's asked first ("Is this a scam? <message>",
  // "is this legit: <message>"), or before it when it's asked last ("<message> is this a scam?"). (Nov 7: a colon
  // inside the message, "Code: 482913", used to cut it there.)
  let msg = "";
  const q = /["“]([^"”]{15,})["”]/.exec(raw), m = new RegExp(ASK.source, "i").exec(raw);
  if (q) msg = q[1];
  else if (m && m.index < 60 && raw.length - (m.index + m[0].length) > 15) msg = raw.slice(m.index + m[0].length).replace(/^[\s?:!.,;\-–—)]+/, "").replace(/^(?:here(?:'s| is) (?:the )?(?:text|message|email)|it says|the (?:text|message|email) (?:says|is))[\s:,.-]*/i, "").trim();
  else if (m && m.index >= 15) msg = raw.slice(0, m.index).replace(/[\s,.;:\-–—(]+$/, "").trim();
  else msg = raw.replace(new RegExp(ASK.source, "i"), " ").replace(/^\W+|\W+$/g, "").trim();
  if (/^(?:if|when|to|for|that|because)\b/i.test(msg)) return null;   // "is it a scam if someone asks for my password?": a question for him, not a message
  if (msg.replace(/\W+/g, "").length < 15) return { waiting: true };
  return { message: msg.slice(0, 2000) };
}

/** what the brain is told ("you" is Mochi): the answer is already on screen as a card */
export function checkNote(c) {
  const v = { scam: "a scam", suspicious: "suspicious: some warning signs", safe: "probably fine" }[c.verdict];
  return `\nThey asked you to check a message for a scam, and it's been checked (the result card is on screen now): ${v} (${c.typeName}); ${c.sure === "pretty sure" ? "you're pretty sure: the checks agree" : c.sure === "fairly sure" ? "you're fairly sure: two of your three checks agree" : c.sure === "not sure" ? "you're NOT sure: the checks disagree" : "only your rules checked it"}. ` +
    `${c.tells.length && c.verdict !== "safe" ? `Warning signs: ${c.tells.slice(0, 3).map((x) => x.tell).join("; ")}. ` : ""}What to do: ${c.steps.slice(0, 3).join(" ")} ` +
    `Reply in 2–3 short, calm sentences, in your own warm words: what you think and how sure you are, the one or two biggest warning signs, and the most important thing to do. Don't repeat the whole message, don't make anything or bring out props, and say you could be wrong if you're not sure.`;
}
export const WAITING_NOTE = "\nThey want you to check a message for a scam but haven't pasted it yet. Ask them, short and friendly, to paste the text, email or what the caller said (and to cover any real names, numbers or codes in it).";

/* ---------- the privacy shield (Nov 7, "privacy by design") ---------- */
// What could identify someone is taken out before the message goes to a model off this computer: email addresses,
// phone numbers, card and account numbers, ID numbers, one-time codes, street addresses, the name a message greets.
// The web address stays (its odd ending is the clue) but not what follows it. Mochi's rules read the original, here.
export function redact(text) {
  const counts = {}, n = (k) => { counts[k] = (counts[k] || 0) + 1; return `[${k}]`; };
  let t = String(text || "");
  t = t.replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, () => n("EMAIL"));
  t = t.replace(/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,6})(\/[^\s<>"']+)/gi, (_, host, rest) => (rest.length > 1 ? `${host}/…` : host + rest));
  t = t.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => n("ID NUMBER"));
  t = t.replace(/\b(?:\d[ -]?){13,19}\b/g, () => n("CARD NUMBER"));
  t = t.replace(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, () => n("PHONE"));
  t = t.replace(/\b(?:account|acct|member|policy|order|case|ref(?:erence)?)\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9-]{6,})\b/gi, (m, id) => m.replace(id, n("ACCOUNT NUMBER")));
  t = t.replace(/(?<![$£€\d.,])\b\d{4,8}\b(?![.,]\d)/g, (d) => (/^(?:19|20)\d\d$/.test(d) ? d : n("CODE")));
  t = t.replace(/\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Ln|Lane|Dr|Drive|Blvd|Ct|Court|Way|Pl|Place)\b\.?/g, () => n("ADDRESS"));
  t = t.replace(/\b(Hi|Hello|Hey|Dear|Good (?:morning|afternoon|evening))[ ,]+(?!mom\b|mum\b|dad\b|grandma\b|grandpa\b|there\b|customer\b|user\b|member\b|sir\b|madam\b|friend\b|all\b)([A-Z][a-z]{1,15})\b/g, (_, hi) => `${hi} ${n("NAME")}`);
  return { text: t, counts, hidden: Object.values(counts).reduce((a, b) => a + b, 0) };
}

/** both readers on one message → the card (combine) plus how long it took, who read it, and what they were sent */
export async function checkMessage(message, { llm = null, log = console, timeoutMs = 30000, words: wordsFn } = {}) {
  const t0 = Date.now(), rules = ruleCheck(message), shield = redact(message);
  const wf = wordsFn === undefined ? WORDS : wordsFn, words = wf ? wf(message) : null;
  let model = null, reader = null;
  if (llm) {
    try {
      const p = modelPrompt(shield.text);
      const r = await llm.chat({ what: "scamcheck", ...p, schema: MODEL_SCHEMA, schemaName: "scamcheck", maxTokens: 500, temperature: 0.1, background: true, anyTask: true, thenGemini: true, think: false, timeoutMs });   // (Nemotron reads it; if Brev is down, Gemini, then Gemma: Nov 8)
      model = cleanModel(r.json); reader = r.provider || "local";
      if (!model) log.warn && log.warn(`[scamcheck] ${reader} gave no usable answer`);
    } catch (e) { log.warn && log.warn(`[scamcheck] ${e.message}`); }
  }
  const local = !model || reader === "local";
  const privacy = local ? { left: false, note: "Checked on this computer: nothing left it." }
    : { left: true, to: readerName(reader), sent: shield.text.slice(0, 600), hidden: shield.counts, note: `Sent to ${readerName(reader)}${shield.hidden ? ` with ${Object.entries(shield.counts).map(([k, v]) => `${v} ${k.toLowerCase()}${v > 1 ? "s" : ""}`).join(", ")} hidden first` : " (nothing personal in it to hide)"}.` };
  return { ...combine(rules, model, reader, words), ms: Date.now() - t0, reader: model ? readerName(reader) : null, privacy };
}
/** his words if the model can't write them */
export function fallbackLine(c) {
  if (c.verdict === "safe") return "That one looks okay to me! But if it ever asks for money, a code or a password, check with someone first.";
  const t = c.tells[0], why = t ? (t.say || t.tell) : "";
  return `${c.verdict === "scam" ? "Uh oh, I think that's a scam" : "Hmm, that looks fishy to me"}${c.sure === "not sure" ? ", but I'm not totally sure" : ""}. ${why ? `${why[0].toUpperCase()}${why.slice(1).replace(/[.!]?$/, ".")} ` : ""}${c.steps[0]} ${c.steps.find((x) => /7726/.test(x)) || ""}`.trim();
}

/* ---------- how good is it? (the accuracy run: a bench file with "scams": true) ---------- */
const flagged = (v) => v === "scam" || v === "suspicious";
function tally(rows, pick) {
  let tp = 0, fp = 0, fn = 0, tn = 0; const byType = {};
  for (const r of rows) {
    const p = pick(r); if (p == null) continue;
    const yes = flagged(p), scam = r.label === "scam";
    if (yes && scam) tp++; else if (yes) fp++; else if (scam) fn++; else tn++;
    if (scam) { const b = byType[r.type] || (byType[r.type] = { n: 0, caught: 0 }); b.n++; if (yes) b.caught++; }
  }
  const pr = tp + fp ? tp / (tp + fp) : null, rc = tp + fn ? tp / (tp + fn) : null;
  return { n: tp + fp + fn + tn, tp, fp, fn, tn, precision: pr, recall: rc, f1: pr && rc ? (2 * pr * rc) / (pr + rc) : null, accuracy: (tp + tn) / Math.max(1, tp + fp + fn + tn), byType };
}
/** run every message through the rules, the model and both together; { rules, model, both, ms, reader, rows } */
export async function evaluate(set, { llm = null, log = console, onEach = null, baseline = null, parallel = 1, words } = {}) {
  const rows = new Array(set.length);
  let next = 0, doneN = 0;
  async function worker() {
    for (let i = next++; i < set.length; i = next++) {
      const m = set[i], c = await checkMessage(m.text, { llm, log: { warn() {} }, ...(words !== undefined ? { words } : {}) });
      rows[i] = { label: m.label, type: m.type || null, by: m.by || null, channel: m.channel || null, text: m.text.slice(0, 160), rules: c.rules.verdict, model: c.model ? c.model.verdict : null, both: c.verdict, sure: c.sure, ms: c.ms, reader: c.reader,
        ...(baseline ? { base: baseline(m.text).verdict } : {}) };
      doneN++; if (onEach) onEach(rows[i], doneN, set.length);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, set.length)) }, worker));
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  // honest confidence, measured: how often each kind of answer is right
  const calib = {};
  for (const r of rows) { const k = r.sure, b = calib[k] || (calib[k] = { n: 0, right: 0 }); b.n++; if (flagged(r.both) === (r.label === "scam")) b.right++; }
  const byWriter = {};
  for (const by of [...new Set(rows.map((r) => r.by).filter(Boolean))]) byWriter[by] = tally(rows.filter((r) => r.by === by), (r) => r.both);
  return { rules: tally(rows, (r) => r.rules), model: tally(rows, (r) => r.model), both: tally(rows, (r) => r.both), ...(baseline ? { baseline: tally(rows, (r) => r.base) } : {}), calib, byWriter, median: ms[Math.floor(ms.length / 2)] || 0,
    reader: rows.find((r) => r.reader) ? rows.find((r) => r.reader).reader : null, answered: rows.filter((r) => r.model).length, rows,
    notSure: rows.filter((r) => r.sure === "not sure").length, wrongBoth: rows.filter((r) => flagged(r.both) !== (r.label === "scam")).map((r) => ({ label: r.label, type: r.type, text: r.text, both: r.both })) };
}
/** someone else's set (T-Mobile's, in data\tmobile\): .jsonl, .json or .csv with a text column and a label column */
export function parseSet(name, raw) {
  const out = [], lab = (v) => { const t = String(v ?? "").trim().toLowerCase(); if (/^(?:1|true|yes|scam|spam|fraud|phish\w*|smish\w*|malicious)$/.test(t) || /scam|fraud|phish|smish/.test(t)) return "scam"; if (/^(?:0|false|no|ham|legit\w*|safe|normal|benign|not[ _-]?scam)$/.test(t)) return "legit"; return null; };
  const TEXT = ["text", "message", "sms", "body", "content", "msg", "transcript"], LABEL = ["label", "is_scam", "scam", "class", "category", "type", "y"];
  // (a "label" column first if there is one; a "type" column, when it names one of our scam types, is kept as the type)
  const take = (o) => {
    const k = Object.keys(o), tk = k.find((x) => TEXT.includes(x.toLowerCase())), lk = k.find((x) => x.toLowerCase() === "label") || k.find((x) => LABEL.includes(x.toLowerCase())); if (!tk || !lk) return;
    const l = lab(o[lk]); if (!l || !String(o[tk]).trim()) return;
    const ty = k.find((x) => x.toLowerCase() === "type"), tv = ty ? String(o[ty]).toLowerCase() : "";
    out.push({ label: l, type: l === "legit" ? "legit" : TYPES.includes(tv) ? tv : String(o[lk]).toLowerCase(), text: String(o[tk]).slice(0, 2000), ...(o.channel ? { channel: String(o.channel) } : {}), ...(o.difficulty ? { difficulty: String(o.difficulty) } : {}) });
  };
  if (/\.jsonl$/i.test(name)) for (const line of raw.split(/\r?\n/)) { try { if (line.trim()) take(JSON.parse(line)); } catch (_) { /* skip */ } }
  else if (/\.json$/i.test(name)) { try { const j = JSON.parse(raw); for (const o of Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : Array.isArray(j.messages) ? j.messages : []) take(o); } catch (_) { /* skip */ } }
  else if (/\.csv$/i.test(name)) {
    const rows = [], re = /("(?:[^"]|"")*"|[^,\r\n]*)(,|\r?\n|$)/g; let row = [], m;
    while ((m = re.exec(raw)) && m[0] !== "") { row.push(m[1].replace(/^"|"$/g, "").replace(/""/g, '"')); if (m[2] !== ",") { rows.push(row); row = []; } }
    const head = (rows.shift() || []).map((h) => h.trim());
    for (const r of rows) if (r.length >= 2) take(Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }
  return out;
}


/* ---------- the scam shield in everyday chat (Nov 7) ---------- */
/** a pasted message that looks like a scam, though they didn't ask: { message } or null */
export function noticeScam(text) {
  const raw = String(text || "").trim();
  if (raw.length < 40 || raw.length > 2000 || scamCheckAsk(raw)) return null;
  const r = ruleCheck(raw);
  // (a forwarded message reads like one: a link, money, a code, "Dear customer", quotes; and the rules are sure)
  return r.score >= 4 && (r.links.length || /["“”]|^(?:fwd|fw):|\bdear\b/i.test(raw) || r.signs.some((x) => ["askSecret", "oddPay", "smallFee"].includes(x.id))) ? { message: raw } : null;
}
const PAUSE = /\b(?:buy(?:ing)?|get(?:ting)?|send(?:ing)?|wir(?:e|ing)|pay(?:ing)?|giv(?:e|ing))\b.{0,40}\b(?:gift ?cards?|itunes cards?|google play cards?|bitcoin|crypto|western union|moneygram|wire transfer)\b|\b(?:someone|somebody|a (?:guy|man|lady|woman|stranger)|they|he|she|my boss|a friend online)\b.{0,40}\b(?:asked|wants?|told me|needs?)\b.{0,40}\b(?:my |the |a )?(?:code|password|pin|bank details|card number|account number|social security|ssn)\b/i;
/** "I'm going to buy gift cards for my boss", "someone asked me for my code": a gentle pause (a note for his reply) */
export function pauseNote(text) {
  const t = String(text || "");
  if (!PAUSE.test(t) || scamCheckAsk(t)) return "";
  return `\nWhat they just said sounds like how a common scam works (being asked for gift cards, crypto or a wire, or for a code or password). Gently, without lecturing or scaring them: ask who asked them, say that real bosses, companies and family don't ask for those by text or phone, and suggest checking first by calling that person on a number they already know, or asking a grown-up. Two or three short, warm sentences.`;
}
