// Pure quiz logic (no React, no DOM) so it can be unit-tested with `node --test`.

export const LETTERS = ['a', 'b', 'c', 'd'];
export const COUNTS = [10, 15, 20];
// CLAT 2027: 120 questions in 120 minutes.
export const SECONDS_PER_QUESTION = 60;

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Questions usable in a quiz: answer key present and status verified. */
export function playable(bank) {
  return bank.questions.filter((q) => q.answer && q.status === 'verified');
}

/** Map passageId -> questions of that passage in paper order. */
export function passageIndex(questions) {
  const map = new Map();
  for (const q of questions) {
    const key = q.passageId || `solo:${q.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(q);
  }
  for (const list of map.values()) list.sort((x, y) => x.number - y.number);
  return map;
}

/**
 * CLAT-style selection: pick whole passage sets (a passage with all of its questions, in order)
 * until `count` is reached. If the last set would overshoot, only its first questions are taken,
 * so the quiz has exactly `count` questions (or fewer if the pool is smaller).
 */
export function pickPassageSets(pool, count, rand = Math.random) {
  const sets = shuffle([...passageIndex(pool).values()], rand);
  const out = [];
  for (const set of sets) {
    if (out.length >= count) break;
    out.push(...set.slice(0, count - out.length));
  }
  return out;
}

/**
 * Mixed selection: individual random questions, then regrouped so questions that share a
 * passage sit next to each other (the passage is read once).
 */
export function pickMixed(pool, count, rand = Math.random) {
  const chosen = shuffle(pool, rand).slice(0, Math.min(count, pool.length));
  return groupByPassage(chosen);
}

/** Keep first-appearance order of passages, questions within a passage in paper order. */
export function groupByPassage(questions) {
  const order = [];
  const byKey = new Map();
  for (const q of questions) {
    const key = q.passageId || `solo:${q.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key).push(q);
  }
  return order.flatMap((k) => byKey.get(k).sort((x, y) => x.number - y.number));
}

/** Filter the pool by settings shared by every quiz type. */
export function filterPool(pool, { categories = [], excludeIds = null } = {}) {
  return pool.filter(
    (q) => (!categories.length || categories.includes(q.category)) && !(excludeIds && excludeIds.has(q.id))
  );
}

/** Contiguous runs of the same passage: [{ passageId, start, end }] (end exclusive). */
export function passageGroups(questions) {
  const groups = [];
  questions.forEach((q, i) => {
    const last = groups[groups.length - 1];
    if (last && last.passageId && last.passageId === q.passageId) last.end = i + 1;
    else groups.push({ passageId: q.passageId, start: i, end: i + 1 });
  });
  return groups;
}

export function score(questions, answers) {
  let correct = 0, wrong = 0, skipped = 0;
  for (const q of questions) {
    const a = answers[q.id];
    if (a == null) skipped++;
    else if (a === q.answer) correct++;
    else wrong++;
  }
  const attempted = correct + wrong;
  return {
    correct,
    wrong,
    skipped,
    total: questions.length,
    attempted,
    // CLAT marking: +1 correct, -0.25 wrong, 0 unattempted
    marks: correct - 0.25 * wrong,
    accuracy: attempted ? correct / attempted : 0,
  };
}

/** Per-category tallies for one attempt. */
export function categoryBreakdown(questions, answers) {
  const out = {};
  for (const q of questions) {
    const c = (out[q.category] ||= { correct: 0, wrong: 0, skipped: 0, total: 0 });
    c.total++;
    const a = answers[q.id];
    if (a == null) c.skipped++;
    else if (a === q.answer) c.correct++;
    else c.wrong++;
  }
  return out;
}
