// Sanity-check the question banks. Exits non-zero on structural errors.
//  - data/bank_full.json : every extracted question (any status)
//  - public/questions.json : what the website serves (verified only)
import { readFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const full = load('../data/bank_full.json');
const site = load('../public/questions.json');
const errors = [];

const ids = new Set();
for (const q of full.questions) {
  if (ids.has(q.id)) errors.push(`duplicate id ${q.id}`);
  ids.add(q.id);
}

const LETTERS = ['a', 'b', 'c', 'd'];
const cats = new Set(site.meta.categories);
const sitePassages = new Set();
for (const q of site.questions) {
  if (q.status !== 'verified') errors.push(`${q.id}: non-verified question in site bank`);
  if (!q.question?.trim()) errors.push(`${q.id}: empty question`);
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => !o?.trim()))
    errors.push(`${q.id}: options must be 4 non-empty strings`);
  if (!LETTERS.includes(q.answer)) errors.push(`${q.id}: no valid answer`);
  if (!q.explanation?.trim()) errors.push(`${q.id}: no explanation`);
  if (!q.sources?.length) errors.push(`${q.id}: no source`);
  if (!cats.has(q.category)) errors.push(`${q.id}: unknown category ${q.category}`);
  if (q.passageId) {
    if (!site.passages[q.passageId]) errors.push(`${q.id}: missing passage ${q.passageId}`);
    sitePassages.add(q.passageId);
  }
}
for (const pid of Object.keys(site.passages))
  if (!sitePassages.has(pid)) errors.push(`passage ${pid} has no live questions`);

const counts = {};
for (const q of full.questions) counts[q.status] = (counts[q.status] || 0) + 1;
console.log(`full bank: ${full.questions.length} questions`, counts);
console.log(`site bank: ${site.questions.length} verified questions, ${Object.keys(site.passages).length} passages`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('OK');
