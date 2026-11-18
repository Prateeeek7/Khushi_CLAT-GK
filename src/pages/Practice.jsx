import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Segmented } from '../components/ui.jsx';
import { useAppState, useBank, store } from '../lib/store.js';
import { COUNTS, filterPool, pickPassageSets, pickMixed, passageGroups, passageIndex } from '../lib/quiz.js';
import { startSession, TIMER_OPTIONS, timeLimit } from '../lib/session.js';
import { clock, plural } from '../lib/format.js';

export default function Practice() {
  const { pool, categories } = useBank();
  const { settings, attempts, session } = useAppState();
  const [unseenOnly, setUnseenOnly] = useState(false);
  const { count, mode, timer } = settings;
  const selected = settings.categories || [];

  const seen = useMemo(() => new Set(attempts.flatMap((a) => a.questionIds)), [attempts]);
  const counts = useMemo(() => {
    const out = {};
    for (const q of pool) out[q.category] = (out[q.category] || 0) + 1;
    return out;
  }, [pool]);
  const eligible = filterPool(pool, { categories: selected, excludeIds: unseenOnly ? seen : null });
  const available = eligible.length;
  const n = Math.min(count, available);
  const passages = passageIndex(eligible).size;
  const limit = timeLimit(timer, n);

  const toggleCat = (c) =>
    store.setSettings({ categories: selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c] });

  function start() {
    const qs = mode === 'passage' ? pickPassageSets(eligible, n) : pickMixed(eligible, n);
    const sets = passageGroups(qs).length;
    const topic = selected.length === 1 ? selected[0] : mode === 'passage' ? 'Passage practice' : 'Mixed practice';
    startSession(qs, { title: `${topic} · ${qs.length} Q, ${plural(sets, 'passage')}`, timer });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Practice</p>
          <h1>Set up a quiz</h1>
          <p className="lede">Choose a length, how questions are drawn, which topics, and whether the clock runs.</p>
        </div>
      </header>

      {session && (
        <div className="callout warn">
          <span>
            You have an unfinished quiz, “{session.title}”. Starting a new one replaces it.
          </span>
          <a className="btn sm" href="#/quiz">
            Resume
          </a>
        </div>
      )}

      <div className="setup">
        <div className="setup-main">
          <section className="card">
            <h2 className="field-title">Length</h2>
            <Segmented
              label="Number of questions"
              value={count}
              onChange={(v) => store.setSettings({ count: v })}
              options={COUNTS.map((c) => ({ value: c, label: `${c}`, hint: 'questions' }))}
            />
          </section>

          <section className="card">
            <h2 className="field-title">Format</h2>
            <Segmented
              label="Question format"
              value={mode}
              onChange={(v) => store.setSettings({ mode: v })}
              options={[
                { value: 'passage', label: 'Passage sets', hint: 'Whole passages, like the exam' },
                { value: 'mixed', label: 'Mixed', hint: 'Random questions, grouped by passage' },
              ]}
            />
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="field-title">Topics</h2>
              {selected.length > 0 && (
                <button className="link-btn" onClick={() => store.setSettings({ categories: [] })}>
                  Clear ({selected.length})
                </button>
              )}
            </div>
            <div className="chips" role="group" aria-label="Topics">
              <button className={`chip ${!selected.length ? 'on' : ''}`} aria-pressed={!selected.length} onClick={() => store.setSettings({ categories: [] })}>
                All topics <span className="chip-n">{pool.length}</span>
              </button>
              {categories.map((c) => (
                <button key={c} className={`chip ${selected.includes(c) ? 'on' : ''}`} aria-pressed={selected.includes(c)} onClick={() => toggleCat(c)}>
                  {c} <span className="chip-n">{counts[c] || 0}</span>
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={unseenOnly} onChange={(e) => setUnseenOnly(e.target.checked)} />
              <span>Only questions I haven't attempted yet</span>
            </label>
          </section>

          <section className="card">
            <h2 className="field-title">Timer</h2>
            <Segmented label="Timer" value={timer} onChange={(v) => store.setSettings({ timer: v })} options={TIMER_OPTIONS} />
          </section>
        </div>

        <aside className="setup-summary card">
          <span className="eyebrow">Summary</span>
          <dl>
            <div>
              <dt>Questions</dt>
              <dd>{n}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{mode === 'passage' ? 'Passage sets' : 'Mixed'}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{limit ? clock(limit) : 'Untimed'}</dd>
            </div>
            <div>
              <dt>Pool</dt>
              <dd>
                {available.toLocaleString()} Q · {passages} passages
              </dd>
            </div>
          </dl>
          {available < count && available > 0 && <p className="small warn-text">Only {available} questions match, so the quiz uses all of them.</p>}
          {available === 0 && <p className="small warn-text">No questions match these filters.</p>}
          <button className="btn primary lg block" onClick={start} disabled={!available}>
            <Icon name="play" size={16} /> Start quiz
          </button>
          <p className="muted small">Marking: +1 correct, −0.25 wrong, 0 skipped.</p>
        </aside>
      </div>
    </>
  );
}
