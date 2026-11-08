// The scam-spotting game (Nov 7, the T-Mobile track: "Mochi teaches you to spot scams"). "Play the scam game",
// "teach me about scams", "do a skit about scams": a friend comes by with a message on the magenta phone (a prize text,
// a "your account is locked" text, a caller after a code, a parcel fee, someone pretending to be a friend), reads it
// out and hands him the phone; he stops them ("Wait, don't tap anything!") and asks you what looks fishy. Your
// answer is checked against the tells in that message; he says what you spotted and what you missed, plainly, and
// the safe thing to do; then they delete it and block it, and the badge counts the scams you've spotted.
// The messages are made up for the game (no real ones, no real companies); the scenes are hand-written, so what he
// teaches is always right. Pure: index.js keeps the question that's waiting and the count.

// the tells, in words a kid would use (a few of them make up each message)
export const TELLS = {
  prize: { name: "a prize you never entered for", say: "it says you won something you never entered: too good to be true",
    re: /\b(?:prizes?|won|win(?:ner|ning)?|free|too good|never entered|didn'?t (?:enter|sign up|buy|order)|lottery|lucky|coins?|reward|thousand|1,?000|5,?000)\b/ },
  hurry: { name: "it rushes you", say: "it rushes you (\"in 10 minutes\", \"today\") so you don't stop to think",
    re: /\b(?:hurry|rush(?:ing|es|ed)?|quick(?:ly)?|fast|urgent(?:ly)?|right (?:now|away)|minutes?|hours?|today|deadline|expires?|time limit|countdown|immediately|asap|pressure|emergency)\b/ },
  link: { name: "a link to tap", say: "it wants you to tap a link (a fake website can steal your password)",
    re: /\b(?:links?|click(?:ing)?|tap(?:ping)?|urls?|websites?|web ?sites?|sites?|web ?page|address|\.win|\.co|\.help|dot com)\b/ },
  code: { name: "it asks for a secret code", say: "it asks for a code or password: never share those, not with anyone",
    re: /\b(?:codes?|passwords?|pins?|passcodes?|verif(?:y|ication)|log ?in|sign ?in|account details?)\b/ },
  stranger: { name: "a sender you don't know", say: "it's from a number you don't know, pretending to be someone",
    re: /\b(?:strangers?|don'?t know (?:them|who|the number|that number|this number)|unknown|who (?:is it|sent)|(?:random|new|weird|strange|different|unknown) (?:number|phone)|pretend(?:ing|s)?|imposter|impostor|impersonat\w*|not (?:really )?(?:mimi|cocoa|her|him|them)|fake (?:mimi|number|sender|company|support))\b/ },
  pay: { name: "it asks for money in a strange way", say: "it asks you to pay: a fee, or gift cards (real people and companies don't ask for gift cards)",
    re: /\b(?:pay(?:ing|ment)?|fees?|gift ?cards?|money|cash|buy|send (?:money|the numbers)|bitcoin|crypto|charge|costs?)\b/ },
  scary: { name: "it tries to scare you", say: "it tries to scare you (\"locked\", \"closed\") so you panic",
    re: /\b(?:scar(?:y|e|ed|es|ing)|threat\w*|locked|lock|blocked|suspend\w*|closed?|trouble|frighten\w*|panic|worr(?:y|ied))\b/ },
  secret: { name: "it says to keep it a secret", say: "it says to keep it secret: a real friend or company never does",
    re: /\b(?:secret|don'?t tell|do not tell|keep it (?:quiet|between)|no ?one|nobody|tell anyone)\b/ },
};
export const TELL_IDS = Object.keys(TELLS);

// the messages (made up; the sites end in odd endings, nothing real), each read out in short lines
export const SCENES = [
  { id: "prize", who: null, kind: "text", tells: ["prize", "hurry", "link", "stranger"],
    lines: { mimi: ["Mochi! I got a text from a number I don't know! ♡", "It says: ‘CONGRATS!! You WON a $1,000 gift card!’", "‘Tap this link in the next 10 minutes to claim it!’ Should I tap it?"],
      cocoa: ["Bro! Some number I don't know just texted me!", "‘CONGRATS!! You WON a $1,000 gift card!’", "‘Tap this link in the next 10 minutes to claim it!’ Do I tap it, dude?"] } },
  { id: "locked", who: null, kind: "text", tells: ["scary", "hurry", "link", "code"],
    lines: { mimi: ["Eep! Mochi, look at this text! ♡", "‘Your Piggy Bank account is LOCKED!’", "‘Tap here and type your password today, or it will be closed!’ Oh no…"],
      cocoa: ["Dude, I'm kinda freaking out. Look!", "‘Your Piggy Bank account is LOCKED!’", "‘Tap here and type your password today, or it will be closed!’ Bro…"] } },
  { id: "code", who: "cocoa", kind: "call", tells: ["code", "prize", "hurry", "secret"],
    lines: { cocoa: ["Bro! Someone just called me from ‘Game Support’!", "They'll give me 5,000 free coins if I read them the code that just came to my phone.", "And to hurry, and not tell anyone! Sweet, right?"] } },
  { id: "parcel", who: "mimi", kind: "text", tells: ["pay", "link", "hurry", "stranger"],
    lines: { mimi: ["Mochi, I got a text about a parcel! ♡", "‘Your package can't be delivered. Pay a $1.99 fee at this link today!’", "But… I didn't order anything. Should I pay it? It's only a little bit."] } },
  { id: "friend", who: "cocoa", kind: "text", tells: ["stranger", "pay", "hurry", "secret"],
    lines: { cocoa: ["Dude, Mimi texted me from a new number!", "‘Hi it's Mimi! I lost my phone! Buy me a gift card and send me the numbers!’", "‘Quick, it's an emergency! And don't tell Mochi!’ Should I help her, bro?"] } },
];
const SCENE = Object.fromEntries(SCENES.map((s) => [s.id, s]));
const Name = (w) => (w === "mimi" ? "Mimi" : "Cocoa");
export const PHONE = "magenta smartphone";

/** "play the scam game", "teach me about scams", "a skit about scams", "how do I spot a scam?" (not a message to check) */
export function scamGameAsk(text) {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  if (!/\b(?:scams?|scammers?|scamm(?:ing|ed)|phishing|fake (?:texts?|messages?|calls?|emails?))\b/.test(t)) return false;
  if (t.length > 200 || /https?:\/\/|www\.|\bis (?:this|that|it) (?:a |an )?(?:scam|fake|phishing)\b/.test(t)) return false;   // (a message to check: that's the checker)
  if (/\b(?:i (?:got|was|just got) scammed|got scammed|lost (?:my )?money)\b/.test(t)) return false;   // (it happened to them: no game, just kindness)
  return /\b(?:game|skit|scene|play|practi[cs]e|teach|show|learn|spot(?:ting)?|quiz|test me|train|how (?:do|can|would|to)|tell me about|what(?:'s| is| are) (?:a )?|help me|act (?:it )?out|pretend)\b/.test(t);
}

/** the next message for the game: one not played lately (who: the friend asked for, if the scene allows) */
export function pickScene(recent = [], who = null, rnd = Math.random) {
  const fits = SCENES.filter((s) => !who || !s.who || s.who === who);
  const fresh = fits.filter((s) => !recent.slice(-3).includes(s.id));
  const pool = fresh.length ? fresh : fits.length ? fits : SCENES;
  const s = pool[Math.floor(rnd() * pool.length) % pool.length];
  return { id: s.id, who: s.who || who || (rnd() < 0.5 ? "mimi" : "cocoa") };
}

/** the scene: they come with the phone, read it out, hand it over; he stops them and asks you. Skit beats (skits.js). */
export function scamScene(id, who, { learned = {} } = {}) {
  const s = SCENE[id] || SCENES[0], w = s.who || who || "mimi", L = s.lines[w] || s.lines[Object.keys(s.lines)[0]];
  // Teach Mimi (Nov 7): a warning sign you taught her before, in this message too: she spots it herself
  const knew = w === "mimi" ? s.tells.find((t) => learned[t]) : null;
  return {
    title: `${Name(w)}'s ${s.kind === "call" ? "phone call" : "text"}`,
    beats: [
      { who: w, do: "arrive", with: PHONE, how: "", line: "" },
      ...L.map((line) => ({ who: w, do: "friend_say", with: "", how: "", line })),
      ...(knew ? [{ who: w, do: "friend_say", with: "", how: "", line: `Wait… I remember what you taught me! ${TELLS[knew].name[0].toUpperCase()}${TELLS[knew].name.slice(1)}! ♡` },
        { who: "mochi", do: "feel", with: "", how: "proud", line: "" },
        { who: "mochi", do: "aside", with: "", how: "", line: "She remembered what you taught her!" }] : [{ who: "mochi", do: "feel", with: "", how: "thinking", line: "" }]),
      { who: "mochi", do: "say", with: "", how: "", line: `Wait, ${Name(w)}! Don't ${s.kind === "call" ? "tell them anything" : "tap anything"} yet. Let me see.` },
      { who: w, do: "give", with: PHONE, how: "", line: "" },
      { who: "mochi", do: "aside", with: "", how: "", line: knew ? "What else looks fishy to you? Tell me what you notice!" : "Hmm… what looks fishy to you? Tell me what you notice!" },
    ],
    quiz: { id: s.id, who: w, tells: s.tells.filter((t) => t !== knew), ...(knew ? { remembered: knew } : {}) },
  };
}

const IDK = /\b(?:i don'?t know|dunno|idk|no idea|not sure|no clue|i give up|tell me|what is it|hmm+)\b/;
const NOT_ANSWER = /^(?:(?:hey|ok(?:ay)?|so|now)[,!]?\s+)*(?:(?:can|could|will|would) you\s+)?(?:make|build|draw|paint|dance|sing|bring|show me (?:your|a|the)|let'?s (?!see)|play (?!it)|stop|forget it|never ?mind|bye|good ?night)\b/;
/** their answer to "what looks fishy?": { found: [ids in this message], also: [real tells, not in this one], missed, idk }, or null when it isn't an answer */
export function gradeAnswer(text, quiz) {
  if (!quiz) return null;
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t || t.length > 300 || NOT_ANSWER.test(t)) return null;
  const named = TELL_IDS.filter((id) => TELLS[id].re.test(t));
  const idk = !named.length && IDK.test(t);
  if (!named.length && !idk && !/\b(?:scam|fake|fishy|suspicious|weird|sketchy|trick|lie|lying|don'?t|no+|nope)\b/.test(t)) return null;
  const found = quiz.tells.filter((id) => named.includes(id)), also = named.filter((id) => !quiz.tells.includes(id));
  return { found, also, missed: quiz.tells.filter((id) => !found.includes(id)), idk, guessed: !named.length && !idk };
}

const list = (ids) => { const n = ids.map((id) => TELLS[id].name); return n.length < 2 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n.at(-1)}`; };
/** what the brain is told for the turn they answer ("you" is Mochi) */
export function answerNote(quiz, g, { spotted = 0 } = {}) {
  const N = Name(quiz.who), s = SCENE[quiz.id] || SCENES[0];
  const got = g.found.length ? `They spotted: ${g.found.map((id) => TELLS[id].say).join("; ")}.` : g.idk ? "They weren't sure." : "They had a feeling it was a scam but didn't say why.";
  const miss = g.missed.length ? ` Still to tell them: ${g.missed.map((id) => TELLS[id].say).join("; ")}.` : " They got every one!";
  return `\nThe scam-spotting game: ${N} just showed you a ${s.kind === "call" ? "phone call" : "text"} (made up for the game): "${s.lines[quiz.who] ? s.lines[quiz.who].join(" ") : ""}". You asked them what looks fishy, and this message is their answer. ${got}${miss} ` +
    `Reply in 2–4 short, warm sentences: ${g.found.length ? "cheer what they got right, by name" : "be kind, it's tricky"}, then the ones they missed in a few plain words, then the safe thing (don't ${s.kind === "call" ? "share anything" : "tap the link or reply"}, never share a code or password, ask a grown-up, then delete it and block the number). ` +
    `It's a scam${spotted ? `; that's ${spotted} scam${spotted === 1 ? "" : "s"} they've spotted with you` : ""}. Don't write lines for ${N}; ${quiz.who === "mimi" ? "she'll" : "he'll"} answer on screen after you.`;
}

/** after he's answered: they say no to it, it's deleted and blocked, a cheer. Skit beats. */
export function afterScene(quiz, g, spotted = 0) {
  const w = quiz.who, mimi = w === "mimi", all = !g.missed.length;
  const thanks = mimi ? (all ? "Wow, you spotted it all! No tapping for me. ♡" : "Ohh, I see it now! No tapping for me. ♡") : (all ? "Dude, you caught every one! Not falling for that." : "Whoa, sneaky! Not falling for that, bro.");
  return {
    title: "scam spotted",
    beats: [
      { who: w, do: "arrive", with: "", how: "", line: "" },   // (still here: they stay; gone home meanwhile: back they come)
      { who: w, do: "friend_say", with: "", how: "", line: thanks },
      { who: "mochi", do: "say", with: "", how: "", line: quiz.id === "code" ? "Hang up, and never share a code. Block!" : "Delete… and block! Bye-bye, scammer!" },
      { who: w, do: "friend_say", with: "", how: "", line: mimi ? (g.found.length ? `I'm going to remember that: ${TELLS[g.found[0]].name}! Thanks for teaching me ♡` : "And I'll tell a grown-up too! ♡") : "I'm telling my mom too. Teamwork!" },
      { who: "mochi", do: "feel", with: "", how: "proud", line: "" },
      { who: "mochi", do: "aside", with: "", how: "", line: spotted > 1 ? `Scam spotted! That's ${spotted} now. You're getting good at this!` : "Scam spotted! You're a scam-spotter now!" },
      { who: w, do: mimi ? "hug" : "dance", with: "", how: "", line: "" },
    ],
  };
}

/** what the brain is told on the turn they ask for the game (the friend's coming: don't give the answers away) */
export const GAME_NOTE = "\nIn a moment, on screen: the scam-spotting game. A friend will come by with a message on their phone and you'll ask them what looks fishy. Don't explain scams or name any warning signs now (that's the game!); just say something short and excited, like \"Ooh, the scam-spotting game! Watch closely…\"";

/** one line for the scrapbook */
export function scrapLine(quiz, g) {
  return `we played the scam-spotting game: ${Name(quiz.who)}'s ${(SCENE[quiz.id] || {}).kind === "call" ? "phone call" : "text"}; ${g.found.length ? `you spotted ${list(g.found)}` : "it was a tricky one"}`;
}


/* ---------- the scam-call game: Cocoa the scammer (Nov 7) ---------- */
// Cocoa, in a silly disguise (dark sunglasses, a fake moustache: the "disguise" outfit, shared/jobs.js), phones Mimi
// pretending to be the bank, "Game Support" or her grandchild. Mochi pauses the scene: what should Mimi do? You
// choose; each choice plays out (the wrong one gently: Mochi stops her in time). Made-up calls, hand-written.
export const CALLS = [
  { id: "bank-code", title: "a call from \"the bank\"",
    lines: ["Ring ring! Hello, this is, uh… Totally Real Bank!", "Your account is LOCKED. Read me the code we just texted you, quick!"],
    mimi: "Oh no! Um… what do I do?",
    options: { hang: "Hang up and call the number on her card", code: "Read him the code", ask: "Ask him a question first" },
    order: ["code", "hang", "ask"], unmask: "Aww, busted! It was me, Cocoa, the whole time!" },
  { id: "game-prize", title: "a call from \"Game Support\"",
    lines: ["Ring ring! Congratulations, it's Game Support! You won 10,000 coins!", "Just tell me your password so I can add them. Hurry, the prize expires today!"],
    mimi: "Ooh, coins! Should I…?",
    options: { hang: "Say no and hang up", code: "Tell him her password", ask: "Ask how he knows her" },
    order: ["ask", "code", "hang"], unmask: "Hehe, you got me! No coins, just Cocoa!" },
  { id: "grandkid", title: "a call from \"the grandkid\"",
    lines: ["Ring ring! Grandma? It's me! I'm in trouble and I need money. Don't tell Mom!", "Can you buy gift cards and read me the numbers? Please hurry!"],
    mimi: "Oh my! Um… sweetie? What should I do?",
    options: { hang: "Hang up and call the family on their real number", code: "Buy the gift cards", ask: "Ask something only family would know" },
    order: ["hang", "ask", "code"], unmask: "Okay, okay, it's me, Cocoa! Great job not falling for it!" },
];
const CALL = Object.fromEntries(CALLS.map((c) => [c.id, c]));
export function pickCall(recent = [], rnd = Math.random) {
  const fresh = CALLS.filter((c) => !recent.slice(-2).includes(c.id)), pool = fresh.length ? fresh : CALLS;
  return pool[Math.floor(rnd() * pool.length) % pool.length].id;
}
/** the call, up to Mochi's pause and the three choices. Skit beats; .choice is what waits for your answer */
export function callScene(id) {
  const c = CALL[id] || CALLS[0];
  return {
    title: c.title,
    beats: [
      { who: "cocoa", do: "arrive", with: "", how: "", line: "" },
      { who: "cocoa", do: "dress", with: "disguise", how: "", line: "" },
      { who: "mimi", do: "arrive", with: PHONE, how: "", line: "" },
      ...c.lines.map((line) => ({ who: "cocoa", do: "friend_say", with: "", how: "", line })),
      { who: "mimi", do: "friend_say", with: "", how: "", line: c.mimi },
      { who: "mochi", do: "feel", with: "", how: "surprised", line: "" },
      { who: "mochi", do: "aside", with: "", how: "", line: "Pause! What should Mimi do?" },
      { who: "mochi", do: "aside", with: "", how: "", line: c.order.map((k, i) => `${i + 1}) ${c.options[k]}`).join("   "), choices: c.order.map((k, i) => ({ n: i + 1, text: c.options[k] })) },   // (the stage shows these as buttons to tap)
    ],
    choice: { kind: "call", id: c.id, order: c.order.slice() },
  };
}
/** their pick: "2", "the second one", "hang up", "call the bank", "read the code" → "hang" | "code" | "ask" | null */
export function gradeChoice(text, choice) {
  if (!choice) return null;
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'").trim();
  if (!t || t.length > 200 || NOT_ANSWER.test(t)) return null;
  const num = /^(?:(?:the|option|number|#)\s*)?(1|2|3|one|two|three|first|second|third)\b/.exec(t) || /\b(?:option|number|choice|pick|choose)\s*(1|2|3|one|two|three)\b/.exec(t);
  if (num) return choice.order[{ 1: 0, one: 0, first: 0, 2: 1, two: 1, second: 1, 3: 2, three: 2, third: 2 }[num[1]]];
  if (/\b(?:hang (?:it )?up|hangs up|call (?:the|her|their|my)? ?(?:bank|card|real|family|number|mom|parents?)|say no|block|don'?t (?:tell|give|read|buy)|no way|ignore)\b/.test(t)) return "hang";
  if (/\b(?:ask|question|quiz|test (?:him|them)|who (?:are|is) (?:you|this)|prove)\b/.test(t)) return "ask";
  if (/\b(?:read|tell|give|share|buy|send)\b.{0,20}\b(?:code|password|gift cards?|numbers?)\b|\b(?:the code|password|buy the gift)\b/.test(t)) return "code";
  return null;
}
/** what happens after their pick. Skit beats; .good: they chose well */
export function choiceScene(choice, pick) {
  const c = CALL[choice.id] || CALLS[0];
  const beats = pick === "hang" ? [
    { who: "mimi", do: "friend_say", line: { "bank-code": "Nope! I'm hanging up and calling the number on my card. ♡", "game-prize": "No thank you! *click* ♡", grandkid: "I'll call the family on their real number first. Bye! ♡" }[c.id] },
    { who: "mochi", do: "feel", how: "proud", line: "" },
    { who: "cocoa", do: "friend_say", line: c.unmask },
    { who: "mochi", do: "aside", line: { "bank-code": "Perfect! A real bank never asks for your code.", "game-prize": "Perfect! Nobody real asks for your password.", grandkid: "Perfect! Call back on a number you already know." }[c.id] },
    { who: "mimi", do: "hug", line: "" },
  ] : pick === "ask" ? [
    { who: "mimi", do: "friend_say", line: { "bank-code": "Hmm… then what's my account number?", "game-prize": "Wait, how do you know me?", grandkid: "Okay… what's the name of our cat?" }[c.id] },
    { who: "cocoa", do: "friend_say", line: { "bank-code": "Uhh… that's… not important! The code, please!", "game-prize": "Uh… everybody knows you! Password, quick!", grandkid: "Uh… Mr. Fluffy? Gift cards, please!" }[c.id] },
    { who: "mochi", do: "aside", line: "Good thinking! See how he dodged it? Now hang up!" },
    { who: "mimi", do: "friend_say", line: "Bye-bye! *click* ♡" },
    { who: "cocoa", do: "friend_say", line: c.unmask },
  ] : [
    { who: "mimi", do: "friend_say", line: { "bank-code": "Okay, it's four, two…", "game-prize": "Okay, my password is…", grandkid: "Okay, I'll go buy the gift ca…" }[c.id] },
    { who: "mochi", do: "feel", how: "surprised", line: "" },
    { who: "mochi", do: "say", line: "Stop, Mimi! Don't! That's exactly what a scammer wants!" },
    { who: "cocoa", do: "friend_say", line: "Darn, so close!" },
    { who: "mochi", do: "aside", line: { "bank-code": "Never share a code: it's the key to your account. Hang up and call the bank yourself.", "game-prize": "Never share a password, not even for a prize.", grandkid: "Real family won't mind if you hang up and call them back." }[c.id] },
    { who: "mimi", do: "friend_say", line: "Phew! Thanks, Mochi. ♡" },
  ];
  return { title: pick === "hang" ? "scam call stopped" : pick === "ask" ? "the scammer dodged" : "Mochi stops Mimi in time", beats: beats.map((b) => ({ with: "", how: "", line: "", ...b })), good: pick === "hang" };
}
/** what the brain is told on the turn they choose */
export function choiceNote(choice, pick) {
  const c = CALL[choice.id] || CALLS[0];
  return `\nThe scam-call game: Cocoa (in a silly disguise, pretending to be a scammer) phoned Mimi: "${c.lines.join(" ")}". You paused it and asked what Mimi should do; they chose: "${c.options[pick]}". ${pick === "hang" ? "That's the best choice." : pick === "ask" ? "Asking a question is smart (the scammer will dodge it), but hanging up is safest." : "That's what the scammer wants: you'll stop Mimi in time on screen."} Reply in one or two short, warm sentences (${pick === "code" ? "kind, not scolding: it's tricky" : "cheer them on"}). Don't write lines for Mimi or Cocoa: they act it out on screen after you.`;
}
