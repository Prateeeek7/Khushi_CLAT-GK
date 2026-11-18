// Derived statistics from the attempt history. Pure functions.

const DAY = 86400000;

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Consecutive days (ending today or yesterday) with at least one finished attempt. */
export function streak(attempts, now = Date.now()) {
  const days = new Set(attempts.map((a) => dayKey(a.finishedAt)));
  let n = 0;
  let t = now;
  if (!days.has(dayKey(t))) t -= DAY; // a streak survives until the end of the next day
  while (days.has(dayKey(t))) {
    n++;
    t -= DAY;
  }
  return n;
}

/**
 * Overall + per-category stats across attempts. `byId` maps qid -> question (for category and key).
 * Questions no longer in the bank are ignored.
 */
export function summarize(attempts, byId) {
  const cats = {};
  let correct = 0, wrong = 0, skipped = 0, seconds = 0, timedQs = 0;
  const seen = new Set();
  for (const at of attempts) {
    for (const qid of at.questionIds) {
      const q = byId.get(qid);
      if (!q) continue;
      seen.add(qid);
      const c = (cats[q.category] ||= { correct: 0, wrong: 0, skipped: 0, total: 0 });
      c.total++;
      const a = at.answers[qid];
      if (a == null) {
        skipped++;
        c.skipped++;
      } else if (a === q.answer) {
        correct++;
        c.correct++;
      } else {
        wrong++;
        c.wrong++;
      }
      const t = at.timeSpent?.[qid];
      if (t) {
        seconds += t;
        timedQs++;
      }
    }
  }
  const attempted = correct + wrong;
  return {
    quizzes: attempts.length,
    questions: correct + wrong + skipped,
    unique: seen.size,
    correct,
    wrong,
    skipped,
    accuracy: attempted ? correct / attempted : 0,
    avgSeconds: timedQs ? seconds / timedQs : 0,
    categories: Object.entries(cats)
      .map(([name, c]) => ({ name, ...c, accuracy: c.correct + c.wrong ? c.correct / (c.correct + c.wrong) : null }))
      .sort((a, b) => b.total - a.total),
  };
}

/** One point per attempt, oldest first: score as % of maximum marks (negative marking can push below 0). */
export function scoreSeries(attempts) {
  return attempts
    .slice()
    .reverse()
    .map((a, i) => ({
      i: i + 1,
      id: a.id,
      at: a.finishedAt,
      pct: a.score.total ? (100 * a.score.marks) / a.score.total : 0,
      accuracy: a.score.attempted ? (100 * a.score.correct) / a.score.attempted : 0,
      total: a.score.total,
      marks: a.score.marks,
    }));
}

/** Categories with enough data, weakest first. */
export function weakest(categories, minAttempted = 5) {
  return categories
    .filter((c) => c.correct + c.wrong >= minAttempted)
    .sort((a, b) => a.accuracy - b.accuracy);
}
