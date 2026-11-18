import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PassageBlock, Empty, Modal } from '../components/ui.jsx';
import ReviewItem from '../components/ReviewItem.jsx';
import { useAppState, useBank, store } from '../lib/store.js';
import { groupByPassage, passageGroups } from '../lib/quiz.js';
import { startSession } from '../lib/session.js';
import { go } from '../lib/router.js';
import { plural, relDate } from '../lib/format.js';

const TABS = [
  ['mistakes', 'Mistakes'],
  ['learned', 'Learned'],
  ['bookmarks', 'Bookmarks'],
];

export default function Revision({ tab = 'mistakes' }) {
  const { byId, categories } = useBank();
  const { mistakes, bookmarks, settings } = useAppState();
  const [cat, setCat] = useState(null);
  const [sort, setSort] = useState('recent');
  const [confirmClear, setConfirmClear] = useState(false);
  const active = TABS.some(([k]) => k === tab) ? tab : 'mistakes';

  const lists = useMemo(() => {
    const m = Object.entries(mistakes).filter(([id]) => byId.has(id));
    return {
      mistakes: m.filter(([, v]) => !v.resolvedAt),
      learned: m.filter(([, v]) => v.resolvedAt),
      bookmarks: Object.entries(bookmarks)
        .filter(([id]) => byId.has(id))
        .map(([id, ts]) => [id, { bookmarkedAt: ts, ...(mistakes[id] || {}) }]),
    };
  }, [mistakes, bookmarks, byId]);

  const entries = lists[active]
    .filter(([id]) => !cat || byId.get(id).category === cat)
    .sort(([, a], [, b]) =>
      sort === 'most'
        ? (b.count || 0) - (a.count || 0) || (b.lastWrongAt || 0) - (a.lastWrongAt || 0)
        : (b.lastWrongAt || b.bookmarkedAt || 0) - (a.lastWrongAt || a.bookmarkedAt || 0)
    );
  // keep passage siblings together so each passage is shown once
  const ordered = groupByPassage(entries.map(([id]) => byId.get(id)));
  const info = Object.fromEntries(entries);
  const groups = passageGroups(ordered);
  const catCounts = lists[active].reduce((acc, [id]) => {
    const c = byId.get(id).category;
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  function practise() {
    const title = active === 'bookmarks' ? 'Bookmarked questions' : active === 'learned' ? 'Learned mistakes recap' : 'Mistake revision';
    startSession(ordered, { kind: 'revision', title: `${title} · ${ordered.length} Q`, timer: settings.timer });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Revision</p>
          <h1>Your mistake book</h1>
          <p className="lede">
            Every wrong answer is saved in this browser. Retake them until they stick; a question moves to “Learned” the next time you
            get it right.
          </p>
        </div>
        {ordered.length > 0 && (
          <button className="btn primary" onClick={practise}>
            <Icon name="play" size={16} /> Practise {ordered.length}
          </button>
        )}
      </header>

      <div className="tabs" role="tablist" aria-label="Revision lists">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={active === k} className={active === k ? 'on' : ''} onClick={() => go(`revision/${k}`)}>
            {label} <span className="tab-n">{lists[k].length}</span>
          </button>
        ))}
      </div>

      {lists[active].length > 0 && (
        <div className="toolbar">
          <div className="chips" role="group" aria-label="Filter by topic">
            <button className={`chip ${!cat ? 'on' : ''}`} aria-pressed={!cat} onClick={() => setCat(null)}>
              All <span className="chip-n">{lists[active].length}</span>
            </button>
            {categories
              .filter((c) => catCounts[c])
              .map((c) => (
                <button key={c} className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>
                  {c} <span className="chip-n">{catCounts[c]}</span>
                </button>
              ))}
          </div>
          {active !== 'bookmarks' && (
            <label className="select">
              <span className="muted small">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">Most recent</option>
                <option value="most">Most often wrong</option>
              </select>
            </label>
          )}
        </div>
      )}

      {!lists[active].length && (
        <Empty
          icon={active === 'bookmarks' ? 'bookmark' : 'revise'}
          title={active === 'mistakes' ? 'No open mistakes' : active === 'learned' ? 'Nothing learned yet' : 'No bookmarks yet'}
          action={
            <a className="btn primary" href="#/practice">
              Start practising
            </a>
          }
        >
          {active === 'mistakes'
            ? 'Wrong answers from every quiz land here automatically.'
            : active === 'learned'
              ? 'Answer a saved mistake correctly and it moves here.'
              : 'Press B or the bookmark icon on any question to save it.'}
        </Empty>
      )}

      {groups.map((g) => {
        const items = ordered.slice(g.start, g.end);
        return (
          <div className="review-group" key={`${g.passageId}-${g.start}`}>
            {g.passageId && <PassageBlock passageId={g.passageId} defaultOpen={false} label={`Passage · ${plural(items.length, 'saved question')}`} />}
            {items.map((q) => {
              const m = info[q.id] || {};
              return (
                <ReviewItem
                  key={q.id}
                  q={q}
                  answer={m.lastAnswer}
                  extra={
                    m.count ? (
                      <span className="muted small">
                        Wrong {m.count}× · {relDate(m.lastWrongAt)}
                      </span>
                    ) : null
                  }
                  footer={
                    active !== 'bookmarks' && (
                      <div className="ri-foot">
                        {active === 'mistakes' ? (
                          <button className="btn sm" onClick={() => store.resolveMistake(q.id)}>
                            <Icon name="check" size={14} /> Mark as learned
                          </button>
                        ) : (
                          <span className="muted small">Learned {relDate(m.resolvedAt)}</span>
                        )}
                        <button className="btn sm ghost" onClick={() => store.removeMistake(q.id)}>
                          <Icon name="trash" size={14} /> Remove
                        </button>
                      </div>
                    )
                  }
                />
              );
            })}
          </div>
        );
      })}

      {active === 'learned' && lists.learned.length > 0 && (
        <div className="row end">
          <button className="btn ghost" onClick={() => setConfirmClear(true)}>
            Clear learned list
          </button>
        </div>
      )}
      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear the learned list?"
        actions={
          <>
            <button className="btn" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={() => {
                store.clearMistakes(true);
                setConfirmClear(false);
              }}
            >
              Clear {lists.learned.length}
            </button>
          </>
        }
      >
        <p>Open mistakes and your quiz history stay. This cannot be undone.</p>
      </Modal>
    </>
  );
}
