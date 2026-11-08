// Dressing up for a job (Nov 7, Binoy: "let mochi be capable to dress up as any popular professions like Doctor,
// engineer, police etc. No need to over dress him, just make sure he has something that shows that profession clearly
// and that he holds or wears that prop correctly and fits correctly", then "Also allow the other two characters mimi
// and cocoa to also dress up as any of these professions correctly and maybe they could even use it in a skit").
// One thing that says the job (a hat, or the stethoscope), and the tool that goes with it if there is one: all
// hand-made patterns (shared/pocket-more.js, craft.js), fitted to Mochi; the kit sizes them to Mimi and Cocoa.
// Used by his activity book (shared/activity-book.js), by "Mimi, dress up as a doctor" (server/dress.js) and by the
// little scenes (server/skits.js, the dress beat).

export const JOBS = {
  doctor: { name: "doctor", words: "doctors?|nurses?|vets?|veterinarians?|medics?|physicians?|surgeons?|dentists?", wear: ["stethoscope"], hold: null },
  police: { name: "police officer", words: "police(?: ?(?:officers?|m[ae]n|wom[ae]n))?|cops?|policem[ae]n|sheriffs?|officers?", wear: ["police cap"], hold: "walkie-talkie" },
  engineer: { name: "engineer", words: "engineers?|builders?|construction workers?|mechanics?|plumbers?|handym[ae]n|electricians?", wear: ["hard hat"], hold: "wrench" },
  firefighter: { name: "firefighter", words: "fire ?fighters?|firem[ae]n", wear: ["firefighter helmet"], hold: null },
  chef: { name: "chef", words: "chefs?|cooks?|bakers?", wear: ["chef hat"], hold: "wooden spoon" },
  pilot: { name: "pilot", words: "pilots?|airline pilots?|airplane pilots?", wear: ["pilot cap"], hold: null },
  farmer: { name: "farmer", words: "farmers?|gardeners?|ranchers?|cowboys?|cowgirls?", wear: ["straw hat"], hold: "watering can" },
  artist: { name: "artist", words: "artists?|painters?", wear: ["beret"], hold: "paintbrush" },
  detective: { name: "detective", words: "detectives?|investigators?|sherlocks?|private eyes?|sleuths?", wear: ["detective hat"], hold: "magnifying glass" },
  astronaut: { name: "astronaut", words: "astronauts?|spacem[ae]n|cosmonauts?|space explorers?", wear: ["space helmet"], hold: null },
  teacher: { name: "teacher", words: "teachers?|professors?", wear: ["round reading glasses"], hold: "book" },
  scientist: { name: "scientist", words: "scientists?|inventors?", wear: ["round reading glasses"], hold: "magnifying glass" },
  judge: { name: "judge", words: "judges?", wear: ["judge's robe"], hold: "gavel" },
  // Cocoa's silly scammer disguise in the scam-call game (Nov 7, server/scams.js); also "dress Mimi as a spy"
  disguise: { name: "master of disguise", words: "disguises?|spy|spies|secret agents?", wear: ["silly disguise"], hold: "magenta smartphone" },
};
export const JOB_IDS = Object.keys(JOBS);
const ONE = Object.fromEntries(JOB_IDS.map((id) => [id, new RegExp(`\\b(?:${JOBS[id].words})\\b`)]));
// "police officer" before "officer" alone; a detective isn't a police officer
const ORDER = ["detective", "police", "firefighter", "astronaut", "engineer", "doctor", "chef", "pilot", "farmer", "artist", "teacher", "scientist", "judge", "disguise"];
export const JOB_WORDS = ORDER.map((id) => JOBS[id].words).join("|");

/** the job a bit of text names ("a police officer", "Dr.", "cops") → its id, or null */
export function jobOf(text) {
  const t = String(text || "").toLowerCase();
  if (JOBS[t]) return t;
  for (const id of ORDER) if (ONE[id].test(t)) return id;
  return null;
}
/** every job named in the text, with where: [{ id, at }] */
export function jobsIn(text) {
  const t = String(text || "").toLowerCase(), out = [];
  const re = new RegExp(`\\b(?:${JOB_WORDS})\\b`, "g");
  for (let m; (m = re.exec(t));) { const id = jobOf(m[0]); if (id && !out.some((o) => o.at === m.index)) out.push({ id, at: m.index, word: m[0] }); }
  return out;
}
/** what goes on: { wear: [name], hold: name | null } */
export function outfit(id) { const J = JOBS[id]; return J ? { wear: J.wear.slice(), hold: J.hold } : null; }
