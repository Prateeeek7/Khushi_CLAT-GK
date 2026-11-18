import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { LineChart, BarList, SegmentBar } from '../components/Charts.jsx';
import { StatTile, Empty } from '../components/ui.jsx';
import { useAppState, useBank } from '../lib/store.js';
import { summarize, scoreSeries, streak, weakest } from '../lib/analytics.js';
import { filterPool, pickPassageSets } from '../lib/quiz.js';
import { startSession } from '../lib/session.js';
import { duration, marks, pct, relDate } from '../lib/format.js';

const RANGES = [
  ['all', 'All time'],
  ['30', '30 days'],
  ['7', '7 days'],
];

export default function Analytics() {
  const { byId, pool } = useBank();
  const { attempts, mistakes, settings } = useAppState();
  const [range, setRange] = useState('all');
  const [view, setView] = useState('chart');

  const scoped = useMemo(() => {
    if (range === 'all') return attempts;
    const since = Date.now() - Number(range) * 86400000;
    return attempts.filter((a) => a.finishedAt >= since);
  }, [attempts, range]);
  const sum = useMemo(() => summarize(scoped, byId), [scoped, byId]);
  const series = useMemo(() => scoreSeries(scoped), [scoped]);
  const weak = weakest(sum.categories).slice(0, 3);
  const open = Object.values(mistakes).filter((m) => !m.resolvedAt).length;
  const learned = Object.values(mistakes).filter((m) => m.resolvedAt).length;

  if (!attempts.length) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="eyebrow">Analytics</p>
            <h1>Performance</h1>
          </div>
        </header>
        <Empty
          icon="chart"
          title="No quizzes yet"
          action={
            <a className="btn primary" href="#/practice">
              Take your first quiz
            </a>
          }
        >
          Score trends, topic accuracy and timing appear after your first quiz.
        </Empty>
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Performance</h1>
        </div>
      </header>

      <div className="toolbar">
        <div className="segmented sm" role="radiogroup" aria-label="Date range">
          {RANGES.map(([k, l]) => (
            <button key={k} role="radio" aria-checked={range === k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>
              <span className="seg-label">{l}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="stats-row">
        <StatTile label="Quizzes" value={sum.quizzes} sub={`${sum.questions} questions answered or seen`} />
        <StatTile label="Accuracy" value={sum.correct + sum.wrong ? pct(sum.accuracy) : '—'} sub={`${sum.correct} correct · ${sum.wrong} wrong`} />
        <StatTile label="Avg time / question" value={sum.avgSeconds ? duration(sum.avgSeconds) : '—'} sub="CLAT pace is 60s" />
        <StatTile label="Day streak" value={streak(attempts)} sub={`${open} open · ${learned} learned mistakes`} />
      </section>

      {scoped.length === 0 ? (
        <p className="muted">No quizzes in this range.</p>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Score trend</h2>
                <p className="muted small">Marks as % of maximum per quiz, after negative marking</p>
              </div>
              <div className="segmented sm" role="radiogroup" aria-label="View">
                <button role="radio" aria-checked={view === 'chart'} className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}>
                  <span className="seg-label">Chart</span>
                </button>
                <button role="radio" aria-checked={view === 'table'} className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>
                  <span className="seg-label">Table</span>
                </button>
              </div>
            </div>
            {view === 'chart' ? (
              series.length > 1 ? (
                <LineChart
                  ariaLabel="Score per quiz over time"
                  points={series.map((p) => ({
                    key: p.id,
                    label: `#${p.i}`,
                    value: p.pct,
                    detail: `Quiz #${p.i} · ${marks(p.marks)}/${p.total} · ${relDate(p.at)}`,
                  }))}
                />
              ) : (
                <p className="muted">Finish one more quiz to see a trend.</p>
              )
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Quiz</th>
                      <th>When</th>
                      <th className="num">Marks</th>
                      <th className="num">Score %</th>
                      <th className="num">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series
                      .slice()
                      .reverse()
                      .map((p) => {
                        const a = scoped.find((x) => x.id === p.id);
                        return (
                          <tr key={p.id}>
                            <td>{p.i}</td>
                            <td>
                              <a href={`#/results/${p.id}`}>{a.title}</a>
                            </td>
                            <td className="muted">{relDate(p.at)}</td>
                            <td className="num">
                              {marks(p.marks)}/{p.total}
                            </td>
                            <td className="num">{Math.round(p.pct)}%</td>
                            <td className="num">{Math.round(p.accuracy)}%</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid-2">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Accuracy by topic</h2>
                  <p className="muted small">Correct ÷ attempted; right column shows correct/attempted</p>
                </div>
              </div>
              <BarList
                rows={sum.categories.map((c) => ({
                  key: c.name,
                  label: c.name,
                  value: c.accuracy,
                  meta: `${c.correct}/${c.correct + c.wrong}`,
                }))}
                empty="not attempted"
              />
            </section>

            <section className="card">
              <div className="card-head">
                <h2>All answers</h2>
              </div>
              <SegmentBar
                parts={[
                  { key: 'c', label: 'correct', value: sum.correct, tone: 'good' },
                  { key: 'w', label: 'wrong', value: sum.wrong, tone: 'bad' },
                  { key: 's', label: 'not answered', value: sum.skipped, tone: 'neutral' },
                ]}
              />
              <h3 className="sub-head">Focus next</h3>
              {weak.length ? (
                <ul className="focus-list">
                  {weak.map((c) => (
                    <li key={c.name}>
                      <span>
                        <strong>{c.name}</strong>
                        <span className="muted small">
                          {' '}
                          {pct(c.accuracy)} on {c.correct + c.wrong} attempted
                        </span>
                      </span>
                      <button
                        className="btn sm"
                        onClick={() =>
                          startSession(pickPassageSets(filterPool(pool, { categories: [c.name] }), 10), {
                            title: `Focus: ${c.name}`,
                            timer: settings.timer,
                          })
                        }
                      >
                        Practise <Icon name="right" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Attempt at least 5 questions in a topic to rank it.</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
