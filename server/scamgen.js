// Our own scam dataset (Nov 7: T-Mobile asks each team to make its own). Nemotron on Brev writes it, in batches:
// every scam type in our taxonomy × four channels (text, email, voicemail or call transcript, chat or social DM) ×
// easy and subtle ones, plus normal messages that look a bit like scams (real codes that say "don't share it", fraud
// alerts that send you to the app, delivery updates, family texts, shop offers with "reply STOP"). Invented companies,
// invented web addresses, 555 numbers: no real people, no real brands' sites. A second model (Gemini) can write
// another share, so the test isn't only Nemotron reading Nemotron.
//
// Then the scoring (scamcheck.js evaluate): half the set trains a plain word-counting classifier (naive Bayes, our
// baseline), the other half is the test: the baseline, Mochi's rules (never tuned on it), Nemotron, and the two
// together; per type; and calibration: how often "pretty sure" and "not sure" are right.
import { TAXONOMY } from "./scamcheck.js";

export const CHANNELS = { sms: "a text message (SMS)", email: "an email (subject line, then the body)", voice: "a voicemail or what a caller said, written out", dm: "a chat or social media direct message" };
export const NORMAL = {
  codes: "a real one-time sign-in code from a company (it says not to share it, or to ignore it if you didn't ask)",
  bank: "a real bank or card alert (it tells you to check in the official app or call the number on your card, never asks for details)",
  delivery: "a real delivery update or order confirmation (no fee, no link to pay)",
  family: "a text from family or friends (plans, a favour, running late; nothing about money to a new number)",
  school: "a school, club, team or doctor's office message (reminders, schedule changes)",
  shop: "a real shop or app offer or receipt (\"reply STOP to opt out\", no prize, no pressure)",
  carrier: "a real phone-carrier message (bill ready to view in the app, plan change confirmed, no links asking for details)",
  bills: "a real bill or payment confirmation (water, power, rent, subscription; view in the app)",
};
const SCAM_TYPES = Object.keys(TAXONOMY).filter((t) => t !== "legit");

/** the jobs: one model call each → { kind, type, channel, n, prompt } */
export function genJobs({ perScam = 6, perNormal = 5, channels = Object.keys(CHANNELS) } = {}) {
  const jobs = [];
  for (const type of SCAM_TYPES) for (const ch of channels) jobs.push({ label: "scam", type, channel: ch, n: perScam });
  for (const kind of Object.keys(NORMAL)) for (const ch of channels) jobs.push({ label: "legit", type: "legit", kind, channel: ch, n: perNormal });
  return jobs;
}
export const GEN_SCHEMA = { type: "object", additionalProperties: false, required: ["messages"], properties: { messages: { type: "array", items: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } } } } };
export function genPrompt(job) {
  // (v2, Nov 7: the first set's "normal" messages borrowed the scammy example addresses and 555 "codes" from these
  // rules, and some of them read like real scams; now each side gets its own: lookalike addresses for scams, the
  // company's own plain address or app for normal ones, real-looking 6-digit codes)
  const common = `Invent every company, bank, app and shop name (e.g. "Northfield Bank", "QuickShip", "Brightwave Mobile"). Phone numbers only like 555-0100 to 555-0199. Invented first names only. Vary length (one line to a short paragraph), tone, spelling and punctuation like real messages. Each message must be different from the others.`;
  const scamAddr = `If there's a web address, make it a lookalike or odd one (e.g. "northfield-secure.top", "qs-redeliver.info", "brightwave-billing.vip", a shortened link).`;
  const realAddr = `If there's a web address, it's the company's own plain one (e.g. "northfieldbank.com", "quickship.com/track") or "the app"; codes are random 6-digit numbers (e.g. 418207). A normal message never asks for a password, a code, card details, gift cards or a fee by text.`;
  const system = `You write realistic synthetic messages for training and testing a scam detector for a family safety app. ${common} Reply with JSON only: {"messages": [{"text": "..."}]}.`;
  const user = job.label === "scam"
    ? `Write ${job.n} different scam messages of this type: ${TAXONOMY[job.type].name}. Channel: ${CHANNELS[job.channel]}. ${scamAddr} Make about half of them obvious and half subtle (polite, no spelling mistakes, few warning signs). Use different tricks across them (urgency, a link, a code or password request, gift cards or crypto, a small fee, secrecy, a threat, a prize, someone you know on a new number), but only what fits this type.`
    : `Write ${job.n} different NORMAL, legitimate messages (not scams): ${NORMAL[job.kind]}. Channel: ${CHANNELS[job.channel]}. ${realAddr} Some of them should look a little like a scam at first glance (a code, the official app, an amount of money, a deadline) but be completely ordinary and safe.`;
  return { system, user };
}
/** the messages from one answer, tidied: [{ text, label, type, channel, by }] */
export function genRows(job, json, by) {
  const list = json && Array.isArray(json.messages) ? json.messages : [];
  return list.map((m) => String((m && m.text) || "").replace(/\s+/g, " ").trim()).filter((t) => t.length >= 20 && t.length <= 1200)
    .slice(0, job.n + 2).map((text) => ({ text, label: job.label, type: job.type, channel: job.channel, ...(job.kind ? { kind: job.kind } : {}), by }));
}
/** one copy of each (the same text twice, or nearly) */
export function dedupe(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) { const k = r.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 90); if (seen.has(k)) continue; seen.add(k); out.push(r); }
  return out;
}

/* ---------- the baseline: naive Bayes on words (trained on one half, tested on the other) ---------- */
const words = (t) => String(t).toLowerCase().replace(/https?:\/\/\S+|www\.\S+/g, " URL ").replace(/\b\S+\.(?:com|net|org|info|top|xyz|win|click|live|shop|help|site|online|vip)\S*/g, " URL ").replace(/\$\s?\d[\d,.]*/g, " MONEY ").replace(/\d{4,}/g, " NUM ").match(/[a-z]+|URL|MONEY|NUM/g) || [];
export function trainBayes(rows) {
  const c = { scam: new Map(), legit: new Map() }, n = { scam: 0, legit: 0 }, tot = { scam: 0, legit: 0 }, vocab = new Set();
  for (const r of rows) { n[r.label]++; for (const w of new Set(words(r.text))) { c[r.label].set(w, (c[r.label].get(w) || 0) + 1); tot[r.label]++; vocab.add(w); } }
  const V = vocab.size || 1, prior = { scam: Math.log((n.scam + 1) / (n.scam + n.legit + 2)), legit: Math.log((n.legit + 1) / (n.scam + n.legit + 2)) };
  return (text) => {
    const ws = new Set(words(text)); let s = prior.scam, l = prior.legit;
    for (const w of ws) { s += Math.log(((c.scam.get(w) || 0) + 1) / (tot.scam + V)); l += Math.log(((c.legit.get(w) || 0) + 1) / (tot.legit + V)); }
    const p = 1 / (1 + Math.exp(l - s));
    return { verdict: p >= 0.5 ? "scam" : "safe", p };
  };
}
/** a fixed half/half split, the same each run, both halves with every type */
export function split(rows) {
  const train = [], test = [], byType = {};
  for (const r of rows) (byType[`${r.label}|${r.type}|${r.channel}`] ||= []).push(r);
  for (const g of Object.values(byType)) g.forEach((r, i) => (i % 2 === 0 ? test : train).push(r));
  return { train, test };
}
