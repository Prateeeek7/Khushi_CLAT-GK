import Icon from './Icon.jsx';
import { QuestionText, ReviewOptions, Explanation, BookmarkButton } from './ui.jsx';
import { store, useAppState } from '../lib/store.js';
import { duration } from '../lib/format.js';

export function outcome(q, answer) {
  if (answer == null) return 'skipped';
  return answer === q.answer ? 'correct' : 'wrong';
}

const LABEL = { correct: 'Correct', wrong: 'Wrong', skipped: 'Not answered' };

export default function ReviewItem({ q, index, answer, seconds, marked, extra, footer }) {
  const { bookmarks } = useAppState();
  const out = outcome(q, answer);
  return (
    <article className={`review-item out-${out}`}>
      <header className="ri-head">
        <span className={`ri-badge out-${out}`}>
          <Icon name={out === 'correct' ? 'check' : out === 'wrong' ? 'x' : 'target'} size={14} />
          {LABEL[out]}
        </span>
        {index != null && <span className="muted small">Q{index}</span>}
        <span className="tag">{q.category}</span>
        {marked && (
          <span className="tag violet">
            <Icon name="flag" size={12} /> Marked
          </span>
        )}
        {seconds ? <span className="muted small">{duration(seconds)}</span> : null}
        {extra}
        <span className="ri-spacer" />
        <BookmarkButton on={!!bookmarks[q.id]} onToggle={() => store.toggleBookmark(q.id)} />
      </header>
      <QuestionText text={q.question} />
      <ReviewOptions q={q} answer={answer} />
      <Explanation q={q} />
      <p className="source-line muted small">
        {q.mock} · Q{q.number}
      </p>
      {footer}
    </article>
  );
}
