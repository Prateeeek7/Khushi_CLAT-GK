// Quiz session lifecycle (pure helpers + a starter that writes to the store).
import { score, categoryBreakdown, SECONDS_PER_QUESTION } from './quiz.js';
import { store } from './store.js';
import { go } from './router.js';

export const TIMER_OPTIONS = [
  { value: 'off', label: 'Untimed', hint: 'Stopwatch only' },
  { value: 'clat', label: 'CLAT pace', hint: '1 min / question' },
  { value: 'relaxed', label: 'Relaxed', hint: '1.5 min / question' },
];

export function timeLimit(timer, n) {
  if (timer === 'clat') return n * SECONDS_PER_QUESTION;
  if (timer === 'relaxed') return Math.round(n * SECONDS_PER_QUESTION * 1.5);
  return null;
}

export function newSession(questions, { kind = 'practice', title, timer = 'off' } = {}) {
  const now = Date.now();
  return {
    id: `s${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind, // practice | revision | retry
    title: title || `${questions.length}-question practice`,
    questionIds: questions.map((q) => q.id),
    answers: {},
    marked: {},
    visited: { [questions[0]?.id]: true },
    current: 0,
    startedAt: now,
    elapsed: 0,
    limit: timeLimit(timer, questions.length),
    timeSpent: {},
  };
}

export function startSession(questions, opts) {
  if (!questions.length) return;
  store.setSession(newSession(questions, opts));
  go('quiz');
}

/** Turn a finished session into the attempt record kept in history. */
export function toAttempt(session, questions, finishedAt = Date.now()) {
  return {
    id: session.id,
    kind: session.kind,
    title: session.title,
    startedAt: session.startedAt,
    finishedAt,
    durationSec: Math.round(session.elapsed),
    limit: session.limit,
    questionIds: session.questionIds,
    answers: session.answers,
    marked: Object.keys(session.marked).filter((k) => session.marked[k]),
    timeSpent: Object.fromEntries(Object.entries(session.timeSpent).map(([k, v]) => [k, Math.round(v)])),
    score: score(questions, session.answers),
    categories: categoryBreakdown(questions, session.answers),
  };
}
