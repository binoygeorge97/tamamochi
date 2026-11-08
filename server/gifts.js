// Gifts he makes on his own (the hackathon plan's "strongest single addition"). When his memory holds an emotionally
// weighted event coming up (an interview Thursday, an exam, a birthday, a trip) or a rough week, he quietly queues a
// little prop for it on his workbench, keeps it a secret, and gives it to you later at a quiet moment:
// "I made you something for your interview tomorrow. For luck! Ta-da!"
//
// Hand-made patterns make these quick and reliable (a gold medal for luck, a confetti popper for a birthday, a map for
// a trip, a sunflower for a new start, a teddy for a rough week), in their favourite colour if he knows it. Never for
// grief, illness or anything heavy (that's for listening, not for props), never while he's worried about them, at most
// one a day and one per event.

const KINDS = [
  { kind: "luck", re: /\b(interview|exam|test|quiz|finals?|midterms?|presentation|pitch|audition|hackathon|competition|tournament|race|marathon|game|match|tryouts?|recital|performance|thesis|defen[cs]e|driving test|demo day|demo)\b/, gift: "gold medal", wish: "For luck!" },
  { kind: "birthday", re: /\b(birthday|bday|b-day)\b/, gift: "confetti popper", wish: null },
  { kind: "trip", re: /\b(trip|travel(?:ling|ing)?|vacation|holiday|flight|flying|camping|road trip|hike|hiking|beach)\b/, gift: "folded map", wish: "So you never get lost!" },
  { kind: "new", re: /\b(first day|new job|starts? (?:a |her |his |their |my )?new|moving|move (?:in|out|house)|new (?:house|home|apartment|flat|place)|graduat\w*|wedding|anniversary)\b/, gift: "potted sunflower", wish: "For your new chapter!" },
  { kind: "rough", re: /\b(rough|hard|tough|long|stressful|awful|bad) (?:week|day|time|month)|\b(stressed|exhausted|overwhelmed|burn(?:ed|t)? out|tired)\b/, gift: "little teddy bear", wish: "For when it gets hard. You've got this." },
];
const HEAVY = /\b(died|dead|death|passed away|passing|funeral|cancer|hospital|surgery|sick|ill(?:ness)?|diagnos\w*|divorce|broke up|breakup|fired|laid off|suicid\w*|self[- ]harm|depress\w*|abuse|accident|crash|grief|grieving|miscarriage)\b/;
const EVENT_WORD = /\b(job interview|interview|exam|test|quiz|finals|presentation|pitch|audition|hackathon|competition|tournament|race|marathon|game|match|tryouts?|recital|performance|thesis defen[cs]e|thesis|driving test|demo day|demo|birthday|trip|vacation|holiday|flight|camping trip|road trip|hike|first day|new job|move|graduation|wedding|anniversary)\b/;
const COLOURS = ["red", "pink", "purple", "violet", "lilac", "lavender", "blue", "navy", "teal", "turquoise", "mint", "green", "lime", "yellow", "gold", "orange", "peach", "coral", "brown", "black", "white", "silver", "rainbow"];

/** What he'd make for a fact, or null: { kind, gift (a pattern name, maybe with a colour), event ("your interview"), wish } */
export function giftFor(fact, likes = []) {
  const t = String(fact && fact.text || "").toLowerCase();
  if (!t || HEAVY.test(t)) return null;
  const K = KINDS.find((k) => k.re.test(t));
  if (!K) return null;
  const ev = (t.match(EVENT_WORD) || [])[1] || null;
  const event = K.kind === "rough" ? "the rough week" : ev ? `your ${ev.replace(/^job interview$/, "interview")}` : "your big day";
  const colour = favouriteColour(likes);
  return { kind: K.kind, gift: colour && K.kind !== "rough" ? `${colour} ${K.gift}` : K.gift, pattern: K.gift, event, wish: K.wish };
}
export function favouriteColour(likes = []) {
  for (const f of likes) {
    const t = String(f.text || f).toLowerCase();
    if (!/\b(colou?r|likes?|loves?|favou?rite)\b/.test(t)) continue;
    // the nearest feeling word before each colour decides: "I hate red but love blue" → blue; "my black cat" → none
    let best = null;
    for (const x of COLOURS) {
      const m = new RegExp(`\\b${x}\\b`).exec(t);
      if (!m) continue;
      const before = t.slice(0, m.index), after = t.slice(m.index + x.length);
      const last = (ws) => Math.max(...ws.map((w) => { const i = before.lastIndexOf(w); return i < 0 ? -1 : i + w.length; }));   // where the phrase ends
      const lastLike = last(["like", "likes", "love", "loves", "favourite", "favorite", "fav", "colour", "color", "prefer", "prefers"]);
      const lastHate = last(["hate", "hates", "dislike", "don't like", "dont like", "doesn't like", "doesnt like", "not", "can't stand", "never"]);
      const liked = lastLike > lastHate && m.index - lastLike < 40, named = /^\s*(is|was)?\s*(my|the|their|her|his)?\s*(favou?rite|colou?r)/.test(after) || /\b(favou?rite|colou?r)\s*(is|was|:)?\s*$/.test(before);
      if (!liked && !named) continue;
      if (/^\s+(cat|dog|car|hair|shirt|dress|coffee|tea|cat's|belt|box|bag|phone|bike|jacket|shoes|hat)\b/.test(after) && !named) continue;   // a black cat, not a liking for black
      if (!best || m.index < best.i) best = { c: x, i: m.index };
    }
    if (best) return best.c;
  }
  return null;
}

/** "tomorrow", "today", "on Thursday" (from a local YYYY-MM-DD and today's), or "" */
export function whenWords(date, today) {
  if (!date || !today) return "";
  const d = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d > 1 && d < 7) return `on ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}`;
  if (d === -1) return "yesterday";
  return "";
}
/** what he says when he gives it */
export function giftLine(g, when) {
  const w = when ? ` ${when}` : "";
  if (g.kind === "birthday") return when === "today" ? "I made you something for your birthday. Happy birthday!" : `I made you something for your birthday${w}. Happy early birthday!`;
  if (g.kind === "rough") return `I made you something for the rough week. ${g.wish}`;
  if (when === "yesterday") return `I made you something for ${g.event}. How did it go?`;
  return `I made you something for ${g.event}${w}. ${g.wish}`;
}

/** Look for something to make: returns the gifts queued now ([] most of the time). */
export function sweepGifts(memory, { care = false, today, now = Date.now() } = {}) {
  if (care) return [];
  const done = new Set(memory.get("gifted", []));
  if (memory.get("lastGiftDay", null) === today) return [];   // one a day
  const facts = memory.facts(60), likes = facts.filter((f) => f.kind === "like" || /colou?r/.test(f.text));
  const recent = (f) => now - Date.parse(String(f.created_at).replace(" ", "T") + "Z") < 2 * 864e5;
  const candidates = [
    ...memory.upcoming(3).map((f) => ({ f, dated: true })),
    ...facts.filter((f) => !f.when_date && f.weight >= 0.7 && recent(f)).map((f) => ({ f, dated: false })),
  ];
  for (const { f, dated } of candidates) {
    if (done.has(f.id)) continue;
    const g = giftFor(f, likes);
    if (!g || (!dated && g.kind !== "rough")) continue;   // undated: only a rough week; events need a date
    const r = memory.enqueue({ kind: "prop", request: `${g.gift}: a surprise gift for ${g.event.replace(/^your /, "their ")}`, source: "mochi", priority: 0.9, reason: `for ${g.event}`, context: `gift:${f.id}` });
    memory.set("gifted", [...done, f.id].slice(-50));
    memory.set("lastGiftDay", today);
    return [{ ...g, fact: f, job: r }];
  }
  return [];
}
