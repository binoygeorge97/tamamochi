// Keeping his stories fresh (Nov 5, Binoy: "Gemma might be prone to reuse the same story again and again right? If
// there something that can be done like seeding based on time or something to let the stories different").
//
// A random seed alone barely helps: given the same prompt, a model keeps landing on its favourite story whatever the
// seed. What changes the story is changing what it's asked. So each story the model writes (a caper, a skit, his
// chapter) gets:
//  - the real moment: time of day, day of the week, the season, a holiday coming up (a Thursday evening in autumn,
//    Thanksgiving in three weeks), so the same idea plays out differently on different days;
//  - an ingredient: a twist to work in, picked at random from ones not used lately;
//  - what it wrote lately, to steer away from;
//  - a different seed and a slightly different temperature each time;
// and if it still comes back too like a recent one, it's asked once more with another ingredient.

/** what the real day is like, in words */
export function momentOfDay(d = new Date()) {
  const h = d.getHours(), m = d.getMonth(), wd = d.toLocaleDateString("en-US", { weekday: "long" });
  const part = h < 5 ? "the middle of the night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night-time";
  const season = [11, 0, 1].includes(m) ? "winter" : [2, 3, 4].includes(m) ? "spring" : [5, 6, 7].includes(m) ? "summer" : "autumn";
  const SEASON = { winter: "chilly, maybe snowy", spring: "flowers coming up", summer: "warm and sunny", autumn: "crunchy leaves falling" };
  const near = holidayNear(d);
  return `It's ${wd} ${part}, ${season} (${SEASON[season]})${near ? `; ${near}` : ""}.`;
}

/** a holiday in the next two weeks (or today), in words */
export function holidayNear(d = new Date()) {
  const y = d.getFullYear(), day = 864e5, today = new Date(y, d.getMonth(), d.getDate());
  const nth = (month, weekday, n) => { const f = new Date(y, month, 1), off = (weekday - f.getDay() + 7) % 7; return new Date(y, month, 1 + off + 7 * (n - 1)); };
  const L = [["New Year's Day", new Date(y, 0, 1)], ["Valentine's Day", new Date(y, 1, 14)], ["St Patrick's Day", new Date(y, 2, 17)], ["the Fourth of July", new Date(y, 6, 4)],
    ["Halloween", new Date(y, 9, 31)], ["Thanksgiving", nth(10, 4, 4)], ["Christmas", new Date(y, 11, 25)], ["New Year's Eve", new Date(y, 11, 31)], ["New Year's Day", new Date(y + 1, 0, 1)]];
  for (const [name, at] of L) {
    const n = Math.round((at - today) / day);
    if (n === 0) return `today is ${name}!`;
    if (n > 0 && n <= 14) return `${name} is ${n === 1 ? "tomorrow" : `in ${n} days`}`;
  }
  return "";
}

// things to work into a story: small, soft, and things the stage can show or the friends can say
export const TWISTS = [
  "something goes a little wrong at first and they fix it together",
  "a misunderstanding: someone thinks it's for something else",
  "a friendly contest, and the result is a surprise",
  "someone is secretly planning a surprise",
  "someone is too shy at first and gets brave",
  "a silly sound effect or a funny noise interrupts",
  "someone gets the giggles and can't stop",
  "they pretend it's something grand (a royal ceremony, a space mission, a cooking show)",
  "someone tries to copy someone else and it goes hilariously",
  "it turns into a game with made-up rules",
  "someone remembers something nice from before",
  "someone is grumpy at first and gets won over",
  "a tiny mystery: something has gone missing, and it's somewhere silly",
  "they make a promise or a pinky-swear",
  "someone gives someone else a nickname",
  "it ends with a little dance or a silly pose",
  "they talk in a funny accent or a big dramatic voice for a moment",
  "someone gets a good idea out of nowhere",
  "it's all done in slow motion for a moment",
  "someone keeps score, badly",
  "it's about the weather or the season today",
  "someone's tummy rumbles at the wrong moment",
];

/** an ingredient not used lately (memory keeps the last few per kind); returns its words */
export function spice(memory, kind, rnd = Math.random) {
  const used = (memory && memory.get(`variety.${kind}`, [])) || [];
  const fresh = TWISTS.filter((t) => !used.includes(t));
  const t = (fresh.length ? fresh : TWISTS)[Math.floor(rnd() * (fresh.length || TWISTS.length))];
  if (memory) memory.set(`variety.${kind}`, [...used, t].slice(-8));
  return t;
}

const STOP = new Set("a an the and or but so to of in on at for with it its it's is are was be i you he she we they me my your his her our their this that what oh ok okay yes no not just like look here there now too very really let's lets can will do does did got get go".split(" "));
const bag = (t) => new Set(String(t || "").toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
/** how alike two stories are (0..1, shared words over all words) */
export function likeness(a, b) {
  const A = bag(a), B = bag(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / (A.size + B.size - n);
}
/** too like one of the recent ones? */
export const tooLike = (text, recent = [], over = 0.45) => recent.some((r) => likeness(text, r) >= over);

/** a different seed each call, and a temperature a touch either side of the usual */
export const seedNow = () => Math.floor(Date.now() % 2147483647);
export const wobble = (t, rnd = Math.random) => Math.max(0.2, Math.min(1.2, t + (rnd() - 0.5) * 0.2));
