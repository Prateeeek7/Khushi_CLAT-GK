import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { SegmentBar, BarList } from '../components/Charts.jsx';
import { StatTile, PassageBlock, Empty } from '../components/ui.jsx';
import ReviewItem, { outcome } from '../components/ReviewItem.jsx';
import { useAppState, useBank } from '../lib/store.js';
import { groupByPassage, passageGroups } from '../lib/quiz.js';
import { startSession } from '../lib/session.js';
import { clock, duration, marks, pct, relDate } from '../lib/format.js';
import { useRoute } from '../lib/router.js';

const FILTERS = [
  ['all', 'All'],
  ['wrong', 'Wrong'],
  ['skipped', 'Not answered'],
  ['correct', 'Correct'],
  ['marked', 'Marked'],
];

export default function Results({ id }) {
  const { byId } = useBank();
  const { attempts, settings } = useAppState();
  const route = useRoute();
  const [filter, setFilter] = useState('all');
  const attempt = attempts.find((a) => a.id === id);
  const questions = useMemo(() => (attempt ? attempt.questionIds.map((q) => byId.get(q)).filter(Boolean) : []), [attempt, byId]);

  if (!attempt) {
    return (
      <Empty
        icon="chart"
        title="Result not found"
        action={
          <a className="btn primary" href="#/">
            Back to dashboard
          </a>
        }
      >
        It may have been cleared from this browser.
      </Empty>
    );
  }

  const sc = attempt.score;
  const marked = new Set(attempt.marked || []);
  const wrongQs = questions.filter((q) => outcome(q, attempt.answers[q.id]) === 'wrong');
  const missedQs = questions.filter((q) => outcome(q, attempt.answers[q.id]) !== 'correct');
  const shown = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => {
      const o = outcome(q, attempt.answers[q.id]);
      return filter === 'all' || (filter === 'marked' ? marked.has(q.id) : o === filter);
    });
  const groups = passageGroups(shown.map((s) => s.q));
  const counts = {
    all: questions.length,
    wrong: sc.wrong,
    skipped: sc.skipped,
    correct: sc.correct,
    marked: marked.size,
  };
  const cats = Object.entries(attempt.categories || {}).sort((a, b) => b[1].total - a[1].total);
  const avg = sc.total ? attempt.durationSec / sc.total : 0;

  function retry(qs, title) {
    startSession(groupByPassage(qs), { kind: 'retry', title, timer: settings.timer });
  }

  return (
    <>
      {route.query.get('timeup') && (
        <div className="callout warn" role="status">
          <Icon name="clock" size={16} /> Time ran out, so the quiz was submitted automatically.
        </div>
      )}
      <header className="page-head">
        <div>
          <p className="eyebrow">Result · {relDate(attempt.finishedAt)}</p>
          <h1>{attempt.title}</h1>
        </div>
        <div className="row">
          <a className="btn" href="#/practice">
            New quiz
          </a>
        </div>
      </header>

      <section className="result-hero">
        <div className="score-block">
          <span className="eyebrow">Score</span>
          <span className="score-big">
            {marks(sc.marks)}
            <span className="score-of">/ {sc.total}</span>
          </span>
          <span className="muted">CLAT marking, +1 / −0.25</span>
        </div>
        <div className="result-stats">
          <StatTile label="Accuracy" value={sc.attempted ? pct(sc.accuracy) : '—'} sub={`${sc.attempted} of ${sc.total} attempted`} />
          <StatTile label="Time taken" value={clock(attempt.durationSec)} sub={attempt.limit ? `of ${clock(attempt.limit)} allowed` : 'Untimed'} />
          <StatTile label="Per question" value={duration(avg)} sub="average" />
        </div>
        <SegmentBar
          parts={[
            { key: 'c', label: 'correct', value: sc.correct, tone: 'good' },
            { key: 'w', label: 'wrong', value: sc.wrong, tone: 'bad' },
            { key: 's', label: 'not answered', value: sc.skipped, tone: 'neutral' },
          ]}
        />
        <div className="row wrap">
          {wrongQs.length > 0 && (
            <button className="btn primary" onClick={() => retry(wrongQs, `Retry ${wrongQs.length} wrong`)}>
              <Icon name="revise" size={16} /> Retry wrong answers
            </button>
          )}
          {missedQs.length > wrongQs.length && (
            <button className="btn" onClick={() => retry(missedQs, `Retry ${missedQs.length} missed`)}>
              Retry wrong + unanswered
            </button>
          )}
          {wrongQs.length > 0 && (
            <a className="btn ghost" href="#/revision">
              Open revision list
            </a>
          )}
        </div>
      </section>

      {cats.length > 1 && (
        <section className="card">
          <div className="card-head">
            <h2>By topic</h2>
            <span className="muted small">accuracy on attempted · correct/total</span>
          </div>
          <BarList
            rows={cats.map(([name, c]) => ({
              key: name,
              label: name,
              value: c.correct + c.wrong ? c.correct / (c.correct + c.wrong) : null,
              meta: `${c.correct}/${c.correct + c.wrong + c.skipped}`,
            }))}
            empty="not attempted"
          />
        </section>
      )}

      <section className="review">
        <div className="card-head">
          <h2>Answer review</h2>
        </div>
        <div className="tabs" role="tablist" aria-label="Filter answers">
          {FILTERS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)} disabled={!counts[k] && k !== 'all'}>
              {label} <span className="tab-n">{counts[k]}</span>
            </button>
          ))}
        </div>
        {groups.map((g) => {
          const items = shown.slice(g.start, g.end);
          return (
            <div className="review-group" key={`${g.passageId}-${g.start}`}>
              {g.passageId && <PassageBlock passageId={g.passageId} defaultOpen={false} label={`Passage · ${items.length} question${items.length > 1 ? 's' : ''} below`} />}
              {items.map(({ q, i }) => (
                <ReviewItem key={q.id} q={q} index={i + 1} answer={attempt.answers[q.id]} seconds={attempt.timeSpent?.[q.id]} marked={marked.has(q.id)} />
              ))}
            </div>
          );
        })}
        {!shown.length && <p className="muted">Nothing in this filter.</p>}
      </section>
    </>
  );
}
