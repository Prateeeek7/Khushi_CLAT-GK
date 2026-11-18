import { useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import { BarList, Sparkline } from '../components/Charts.jsx';
import { StatTile, Empty } from '../components/ui.jsx';
import { useAppState, useBank } from '../lib/store.js';
import { summarize, streak, scoreSeries, weakest } from '../lib/analytics.js';
import { pickPassageSets, filterPool } from '../lib/quiz.js';
import { startSession } from '../lib/session.js';
import { greeting, pct, relDate, marks, plural } from '../lib/format.js';

export default function Dashboard() {
  const { pool, byId, bank } = useBank();
  const { attempts, mistakes, bookmarks, settings, session } = useAppState();
  const sum = useMemo(() => summarize(attempts, byId), [attempts, byId]);
  const series = useMemo(() => scoreSeries(attempts).slice(-12), [attempts]);
  const pending = Object.entries(mistakes).filter(([id, m]) => !m.resolvedAt && byId.has(id)).length;
  const days = streak(attempts);
  const weak = weakest(sum.categories)[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  function quickStart(n) {
    const qs = pickPassageSets(filterPool(pool, { categories: settings.categories }), n);
    startSession(qs, { title: `${n}-question passage set`, timer: settings.timer });
  }
  function practiseWeak() {
    const qs = pickPassageSets(filterPool(pool, { categories: [weak.name] }), 10);
    startSession(qs, { title: `Focus: ${weak.name}`, timer: settings.timer });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>{greeting()}.</h1>
          <p className="lede">
            {bank.meta.liveQuestions.toLocaleString()} verified questions from {bank.meta.liveMocks} CLAT mock papers, set
            passage by passage the way the exam asks them.
          </p>
        </div>
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Today's practice</span>
          <h2>Read a passage, answer its set.</h2>
          <p className="muted">
            Each quiz pulls whole passages with their 4–6 questions, timed at CLAT pace by default. Wrong answers go straight
            into your revision list.
          </p>
        </div>
        <div className="hero-actions">
          {session ? (
            <a className="btn primary lg" href="#/quiz">
              <Icon name="play" size={16} /> Resume “{session.title}”
            </a>
          ) : (
            <div className="quick">
              {[10, 15, 20].map((n) => (
                <button key={n} className={`btn ${n === 15 ? 'primary' : ''} lg`} onClick={() => quickStart(n)}>
                  <span className="q-n">{n}</span>
                  <span>questions</span>
                </button>
              ))}
            </div>
          )}
          <a className="link-btn" href="#/practice">
            Customise topics, format and timer <Icon name="right" size={14} />
          </a>
        </div>
      </section>

      <section className="stats-row" aria-label="Your progress">
        <StatTile label="Questions practised" value={sum.unique.toLocaleString()} sub={`of ${pool.length.toLocaleString()} in the bank`}>
          <span className="meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (sum.unique / pool.length) * 100)}%` }} />
          </span>
        </StatTile>
        <StatTile
          label="Accuracy"
          value={sum.correct + sum.wrong ? pct(sum.accuracy) : '—'}
          sub={sum.correct + sum.wrong ? `${sum.correct} right, ${sum.wrong} wrong` : 'No answers yet'}
        >
          <Sparkline values={series.map((s) => s.accuracy)} />
        </StatTile>
        <StatTile label="Day streak" value={days} sub={days ? 'Keep it going today' : 'Finish a quiz to start one'} />
        <a className="stat link" href="#/revision">
          <span className="stat-label">To revise</span>
          <span className="stat-value">{pending}</span>
          <span className="stat-sub">
            {plural(pending, 'mistake')} · {plural(Object.keys(bookmarks).length, 'bookmark')}
          </span>
        </a>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Topic strength</h2>
            <a href="#/analytics" className="link-btn">
              Analytics <Icon name="right" size={14} />
            </a>
          </div>
          {sum.categories.length ? (
            <>
              <BarList
                rows={sum.categories.map((c) => ({
                  key: c.name,
                  label: c.name,
                  value: c.accuracy,
                  meta: `${c.correct}/${c.correct + c.wrong}`,
                }))}
              />
              {weak && (
                <div className="callout">
                  <span>
                    Weakest so far: <strong>{weak.name}</strong> at {pct(weak.accuracy)}.
                  </span>
                  <button className="btn sm" onClick={practiseWeak}>
                    Practise 10
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty icon="chart" title="No topic data yet">
              Finish a quiz and accuracy for each of the {bank.meta.categories.length} topics appears here.
            </Empty>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Recent quizzes</h2>
            {attempts.length > 0 && <span className="muted small">{plural(attempts.length, 'quiz', 'quizzes')}</span>}
          </div>
          {attempts.length ? (
            <ul className="attempt-list">
              {attempts.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <a href={`#/results/${a.id}`}>
                    <span className="al-main">
                      <strong>{a.title}</strong>
                      <span className="muted small">{relDate(a.finishedAt)}</span>
                    </span>
                    <span className="al-score">
                      <strong>{marks(a.score.marks)}</strong>
                      <span className="muted">/{a.score.total}</span>
                    </span>
                    <Icon name="right" size={16} className="muted" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="play" title="Nothing here yet">
              Your scored quizzes are listed here, each with a full answer review.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}
