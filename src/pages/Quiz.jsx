import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Modal, QuestionText, BookmarkButton } from '../components/ui.jsx';
import { useAppState, useBank, store } from '../lib/store.js';
import { LETTERS, passageGroups } from '../lib/quiz.js';
import { toAttempt } from '../lib/session.js';
import { go } from '../lib/router.js';
import { clock } from '../lib/format.js';
import { SHORTCUTS } from '../lib/shortcuts.js';

export default function Quiz() {
  const { byId } = useBank();
  const { session } = useAppState();
  const questions = useMemo(
    () => (session ? session.questionIds.map((id) => byId.get(id)).filter(Boolean) : []),
    // only the id list matters; answers etc. live in the runner's state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id, byId]
  );
  const title = session?.title;
  useEffect(() => {
    document.title = `${title || 'Quiz'} · CLAT GK`;
  }, [title]);
  if (!session || !questions.length) {
    return (
      <div className="quiz-empty">
        <div className="empty">
          <span className="empty-icon">
            <Icon name="play" size={22} />
          </span>
          <h3>No quiz in progress</h3>
          <p className="muted">Start one from the dashboard or the practice page.</p>
          <div className="row">
            <a className="btn primary" href="#/practice">
              Set up a quiz
            </a>
            <a className="btn" href="#/">
              Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
  return <QuizRunner key={session.id} initial={session} questions={questions} />;
}

function status(s, id) {
  const ans = s.answers[id] != null;
  const mk = !!s.marked[id];
  if (ans && mk) return 'answered-marked';
  if (mk) return 'marked';
  if (ans) return 'answered';
  if (s.visited[id]) return 'skipped';
  return 'unvisited';
}

function QuizRunner({ initial, questions }) {
  const { byId } = useBank();
  const { bookmarks } = useAppState();
  const [s, setS] = useState(initial);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [help, setHelp] = useState(false);
  const [passageOpen, setPassageOpen] = useState(true);
  const sRef = useRef(s);
  sRef.current = s;
  const submitted = useRef(false);

  const groups = useMemo(() => passageGroups(questions), [questions]);
  const q = questions[s.current];
  const groupIdx = groups.findIndex((g) => s.current >= g.start && s.current < g.end);
  const group = groups[groupIdx];
  const { bank } = useBank();
  const passage = q.passageId ? bank.passages[q.passageId] : null;
  const answered = Object.values(s.answers).filter((a) => a != null).length;
  const markedCount = Object.values(s.marked).filter(Boolean).length;
  const remaining = s.limit ? s.limit - s.elapsed : null;

  // --- timer & per-question time (pauses while the tab is hidden) ---
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      if (document.hidden || submitted.current) return;
      setS((p) => {
        const qid = p.questionIds[p.current];
        return { ...p, elapsed: p.elapsed + dt, timeSpent: { ...p.timeSpent, [qid]: (p.timeSpent[qid] || 0) + dt } };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // --- persist (debounced) so a refresh resumes exactly here ---
  useEffect(() => {
    if (submitted.current) return;
    const t = setTimeout(() => store.setSession(sRef.current), 1500);
    return () => clearTimeout(t);
  }, [s.answers, s.marked, s.current, Math.floor(s.elapsed / 10)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const save = () => !submitted.current && store.setSession(sRef.current);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      save();
    };
  }, []);

  const submit = useCallback(
    (reason) => {
      if (submitted.current) return;
      submitted.current = true;
      const attempt = toAttempt(sRef.current, questions);
      store.recordAttempt(attempt, byId);
      go(`results/${attempt.id}${reason === 'time' ? '?timeup=1' : ''}`);
    },
    [questions, byId]
  );

  useEffect(() => {
    if (remaining != null && remaining <= 0) submit('time');
  }, [remaining, submit]);

  const goTo = useCallback((i) => {
    setS((p) => {
      const n = Math.max(0, Math.min(p.questionIds.length - 1, i));
      return { ...p, current: n, visited: { ...p.visited, [p.questionIds[n]]: true } };
    });
    setPaletteOpen(false);
  }, []);
  const choose = useCallback((letter) => {
    setS((p) => {
      const qid = p.questionIds[p.current];
      const answers = { ...p.answers };
      if (answers[qid] === letter) delete answers[qid];
      else answers[qid] = letter;
      return { ...p, answers };
    });
  }, []);
  const clear = useCallback(() => {
    setS((p) => {
      const answers = { ...p.answers };
      delete answers[p.questionIds[p.current]];
      return { ...p, answers };
    });
  }, []);
  const toggleMark = useCallback(() => {
    setS((p) => {
      const qid = p.questionIds[p.current];
      return { ...p, marked: { ...p.marked, [qid]: !p.marked[qid] } };
    });
  }, []);

  // --- keyboard shortcuts ---
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (confirm || help) return; // modals handle their own keys
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      const cur = sRef.current;
      if (['1', '2', '3', '4'].includes(k)) choose(LETTERS[+k - 1]);
      else if (['a', 'b', 'c', 'd'].includes(k) && !e.shiftKey && k !== 'b') choose(k);
      else if (k === 'b') store.toggleBookmark(cur.questionIds[cur.current]);
      else if (k === 'arrowright' || k === 'n') goTo(cur.current + 1);
      else if (k === 'arrowleft' || k === 'p') goTo(cur.current - 1);
      else if (k === 'm') toggleMark();
      else if (k === 'x') clear();
      else if (k === 'g') setPaletteOpen((o) => !o);
      else if (k === 'enter' && e.shiftKey) setConfirm(true);
      else if (e.key === '?') setHelp(true);
      else if (k === 'escape') setPaletteOpen(false);
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, goTo, toggleMark, clear, confirm, help]);

  const myAnswer = s.answers[q.id];
  const isMarked = !!s.marked[q.id];
  const isLast = s.current === questions.length - 1;
  const low = remaining != null && remaining <= 120;

  function saveAndExit() {
    store.setSession(sRef.current);
    go('');
  }
  function discard() {
    submitted.current = true;
    store.setSession(null);
    go('practice');
  }

  return (
    <div className="quiz">
      <header className="quiz-bar">
        <button className="icon-btn" onClick={saveAndExit} title="Save and exit (progress is kept)">
          <Icon name="left" />
          <span className="hide-sm">Exit</span>
        </button>
        <div className="qb-title">
          <strong>{s.title}</strong>
          <span className="muted small">
            {answered}/{questions.length} answered{markedCount ? ` · ${markedCount} marked` : ''}
          </span>
        </div>
        <div className={`timer ${low ? 'low' : ''}`} role="timer" aria-live={low ? 'polite' : 'off'} title={s.limit ? 'Time remaining' : 'Time elapsed'}>
          <Icon name="clock" size={16} />
          <span>{remaining != null ? clock(remaining) : clock(s.elapsed)}</span>
        </div>
        <button className="icon-btn palette-toggle" onClick={() => setPaletteOpen(true)} aria-label="Question palette">
          <Icon name="grid" />
        </button>
        <button className="icon-btn hide-sm" onClick={() => setHelp(true)} title="Keyboard shortcuts (?)">
          <Icon name="keyboard" />
        </button>
        <button className="btn primary" onClick={() => setConfirm(true)}>
          Submit
        </button>
        <div className="qb-progress" aria-hidden="true">
          <span style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>
      </header>

      <div className={`quiz-body ${passage ? 'with-passage' : ''}`}>
        {passage && (
          <section className={`passage-pane ${passageOpen ? '' : 'collapsed'}`} aria-label="Passage" key={q.passageId}>
            <div className="pp-head">
              <span className="eyebrow">
                Passage {groupIdx + 1} of {groups.length} · Questions {group.start + 1}–{group.end}
              </span>
              <button className="link-btn pp-toggle" onClick={() => setPassageOpen((o) => !o)} aria-expanded={passageOpen}>
                {passageOpen ? 'Hide passage' : 'Show passage'}
              </button>
            </div>
            {passage.title && <h2 className="pp-title">{passage.title}</h2>}
            <div className="pp-text">
              {passage.text.split(/\n\n+/).map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          </section>
        )}

        <section className="question-pane" aria-label={`Question ${s.current + 1}`}>
          <div className="qp-inner" key={q.id}>
            <div className="qp-meta">
              <span className="q-index">
                Question <strong>{s.current + 1}</strong> of {questions.length}
              </span>
              <span className="tag">{q.category}</span>
              <span className="qp-actions">
                <button className={`icon-btn ${isMarked ? 'on violet' : ''}`} onClick={toggleMark} aria-pressed={isMarked} title="Mark for review (M)">
                  <Icon name="flag" />
                  <span className="hide-sm">{isMarked ? 'Marked' : 'Mark for review'}</span>
                </button>
                <BookmarkButton on={!!bookmarks[q.id]} onToggle={() => store.toggleBookmark(q.id)} />
              </span>
            </div>
            <QuestionText text={q.question} />
            <div className="options" role="radiogroup" aria-label="Options">
              {q.options.map((opt, i) => {
                const L = LETTERS[i];
                const on = myAnswer === L;
                return (
                  <button key={L} role="radio" aria-checked={on} className={`option ${on ? 'selected' : ''}`} onClick={() => choose(L)}>
                    <span className="opt-key">{L.toUpperCase()}</span>
                    <span className="opt-text">{opt}</span>
                    <kbd className="opt-kbd" aria-hidden="true">
                      {i + 1}
                    </kbd>
                  </button>
                );
              })}
            </div>
            <p className="source-line muted small">
              {q.mock} · Q{q.number}
            </p>
          </div>
        </section>

        <aside className={`palette-pane ${paletteOpen ? 'open' : ''}`} aria-label="Question palette">
          <div className="palette-sheet">
            <div className="pal-head">
              <strong>Question palette</strong>
              <button className="icon-btn palette-close" onClick={() => setPaletteOpen(false)} aria-label="Close palette">
                <Icon name="x" />
              </button>
            </div>
            <div className="pal-groups">
              {groups.map((g, gi) => (
                <div className="pal-group" key={g.start}>
                  <span className="pal-group-label">
                    {g.passageId ? `Passage ${gi + 1}` : 'Standalone'}
                    <span className="muted"> · {g.end - g.start} Q</span>
                  </span>
                  <div className="pal-grid">
                    {questions.slice(g.start, g.end).map((qq, k) => {
                      const i = g.start + k;
                      const st = status(s, qq.id);
                      return (
                        <button
                          key={qq.id}
                          className={`pal st-${st} ${i === s.current ? 'current' : ''}`}
                          onClick={() => goTo(i)}
                          aria-label={`Question ${i + 1}, ${st.replace('-', ' and ')}`}
                          aria-current={i === s.current ? 'step' : undefined}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <ul className="pal-legend">
              <li>
                <span className="pal st-answered" /> Answered
              </li>
              <li>
                <span className="pal st-skipped" /> Not answered
              </li>
              <li>
                <span className="pal st-unvisited" /> Not visited
              </li>
              <li>
                <span className="pal st-marked" /> Marked for review
              </li>
              <li>
                <span className="pal st-answered-marked" /> Answered &amp; marked
              </li>
            </ul>
            <button className="btn primary block" onClick={() => setConfirm(true)}>
              Submit quiz
            </button>
          </div>
          <div className="palette-scrim" onClick={() => setPaletteOpen(false)} />
        </aside>
      </div>

      <footer className="quiz-foot">
        <button className="btn" onClick={() => goTo(s.current - 1)} disabled={s.current === 0}>
          <Icon name="left" size={16} /> <span className="hide-sm">Previous</span>
        </button>
        <button className="btn ghost" onClick={clear} disabled={!myAnswer}>
          <Icon name="eraser" size={16} /> <span className="hide-sm">Clear</span>
        </button>
        <span className="foot-spacer" />
        {isLast ? (
          <button className="btn primary" onClick={() => setConfirm(true)}>
            Review &amp; submit
          </button>
        ) : (
          <button className="btn primary" onClick={() => goTo(s.current + 1)}>
            {myAnswer ? 'Save & next' : 'Next'} <Icon name="right" size={16} />
          </button>
        )}
      </footer>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit this quiz?"
        actions={
          <>
            <button className="btn" onClick={() => setConfirm(false)}>
              Keep working
            </button>
            <button className="btn primary" onClick={() => submit('user')}>
              Submit
            </button>
          </>
        }
      >
        <ul className="confirm-stats">
          <li>
            <strong>{answered}</strong> answered
          </li>
          <li>
            <strong>{questions.length - answered}</strong> not answered
          </li>
          <li>
            <strong>{markedCount}</strong> marked for review
          </li>
        </ul>
        {questions.length - answered > 0 && (
          <p className="muted">Unanswered questions score 0. Wrong answers cost 0.25 marks.</p>
        )}
        <button className="link-btn danger" onClick={discard}>
          Discard this quiz without scoring
        </button>
      </Modal>

      <Modal open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts" actions={<button className="btn primary" onClick={() => setHelp(false)}>Done</button>}>
        <dl className="shortcuts">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">B is reserved for bookmarking, so choose option B with 2.</p>
      </Modal>
    </div>
  );
}
