import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pickPassageSets, pickMixed, groupByPassage, passageGroups, score, categoryBreakdown, filterPool, playable,
} from '../src/lib/quiz.js';
import { createStore, applyAttemptToMistakes } from '../src/lib/storage.js';
import { streak, summarize, scoreSeries } from '../src/lib/analytics.js';

const bank = JSON.parse(readFileSync(new URL('../public/questions.json', import.meta.url)));
const pool = playable(bank);
const byId = new Map(pool.map((q) => [q.id, q]));
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test('bank has only playable questions with categories', () => {
  assert.equal(pool.length, bank.questions.length);
  assert.ok(pool.every((q) => q.category && q.passageId));
});

for (const n of [10, 15, 20]) {
  test(`passage sets give exactly ${n} questions with passages contiguous`, () => {
    for (let s = 1; s < 30; s++) {
      const qs = pickPassageSets(pool, n, seeded(s));
      assert.equal(qs.length, n);
      assert.equal(new Set(qs.map((q) => q.id)).size, n, 'no duplicates');
      const groups = passageGroups(qs);
      assert.equal(new Set(groups.map((g) => g.passageId)).size, groups.length, 'each passage appears once');
      // within a passage, paper order
      for (const g of groups) {
        const nums = qs.slice(g.start, g.end).map((q) => q.number);
        assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
      }
      // every set except possibly the last is complete
      for (const g of groups.slice(0, -1)) {
        const all = pool.filter((q) => q.passageId === g.passageId).length;
        assert.equal(g.end - g.start, all);
      }
    }
  });
}

test('mixed mode regroups shared passages and respects count', () => {
  const qs = pickMixed(pool, 20, seeded(7));
  assert.equal(qs.length, 20);
  const groups = passageGroups(qs);
  assert.equal(new Set(groups.map((g) => g.passageId)).size, groups.length);
});

test('category filter and small pools', () => {
  const sports = filterPool(pool, { categories: ['Sports'] });
  assert.ok(sports.length > 0 && sports.every((q) => q.category === 'Sports'));
  const tiny = sports.slice(0, 3);
  assert.equal(pickPassageSets(tiny, 10).length, 3);
});

test('groupByPassage keeps first-appearance order', () => {
  const a = pool.filter((q) => q.passageId === pool[0].passageId);
  const b = pool.filter((q) => q.passageId === pool[40].passageId);
  const mixed = [b[1], a[2], b[0], a[0]];
  const out = groupByPassage(mixed);
  assert.deepEqual(out.map((q) => q.id), [b[0].id, b[1].id, a[0].id, a[2].id]);
});

test('scoring uses CLAT marking', () => {
  const qs = pool.slice(0, 4);
  const answers = { [qs[0].id]: qs[0].answer, [qs[1].id]: qs[1].answer === 'a' ? 'b' : 'a' };
  const s = score(qs, answers);
  assert.deepEqual([s.correct, s.wrong, s.skipped, s.marks], [1, 1, 2, 0.75]);
  const cb = categoryBreakdown(qs, answers);
  assert.equal(Object.values(cb).reduce((t, c) => t + c.total, 0), 4);
});

function memStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('store records attempts, logs and resolves mistakes, persists', () => {
  const storage = memStorage();
  const store = createStore(storage);
  const q = pool[0];
  const wrongLetter = q.answer === 'a' ? 'b' : 'a';
  const attempt = (ans, t) => ({
    id: `t${t}`, startedAt: t, finishedAt: t, questionIds: [q.id], answers: { [q.id]: ans }, timeSpent: { [q.id]: 30 },
    score: score([q], { [q.id]: ans }),
  });
  store.recordAttempt(attempt(wrongLetter, 1), byId);
  assert.equal(store.getState().mistakes[q.id].count, 1);
  assert.equal(store.getState().mistakes[q.id].resolvedAt, null);
  store.recordAttempt(attempt(q.answer, 2), byId);
  assert.equal(store.getState().mistakes[q.id].resolvedAt, 2);
  store.toggleBookmark(q.id);
  // reload from storage
  const again = createStore(storage);
  assert.equal(again.getState().attempts.length, 2);
  assert.ok(again.getState().bookmarks[q.id]);
  assert.equal(again.getState().mistakes[q.id].count, 1);
});

test('store survives broken or missing storage', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const store = createStore(broken);
  store.toggleBookmark('x');
  assert.ok(store.getState().bookmarks.x);
  const junk = memStorage();
  junk.setItem('clatgk:v1', '{not json');
  assert.equal(createStore(junk).getState().attempts.length, 0);
});

test('import rejects invalid data', () => {
  const store = createStore(memStorage());
  assert.throws(() => store.importData('{"hello":1}'));
});

test('skipped answers do not create mistakes', () => {
  const q = pool[1];
  const m = applyAttemptToMistakes({}, { questionIds: [q.id], answers: {}, finishedAt: 1 }, byId);
  assert.deepEqual(m, {});
});

test('analytics summary, series and streak', () => {
  const q1 = pool[0], q2 = pool[1];
  const now = new Date(2026, 10, 18, 12).getTime();
  const at = (t, ans) => ({
    id: String(t), finishedAt: t, questionIds: [q1.id, q2.id], answers: ans, timeSpent: { [q1.id]: 40, [q2.id]: 20 },
    score: score([q1, q2], ans),
  });
  const attempts = [at(now, { [q1.id]: q1.answer }), at(now - 86400000, { [q1.id]: q1.answer, [q2.id]: q2.answer })];
  const s = summarize(attempts, byId);
  assert.equal(s.correct, 3);
  assert.equal(s.skipped, 1);
  assert.equal(s.avgSeconds, 30);
  assert.equal(streak(attempts, now), 2);
  assert.equal(streak(attempts, now + 3 * 86400000), 0);
  assert.equal(scoreSeries(attempts)[0].pct, 100);
});
