import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { LETTERS } from '../lib/quiz.js';
import { useBank } from '../lib/store.js';

export function Modal({ open, onClose, title, children, actions, labelledBy = 'modal-title' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    // focus the safe primary action (never a destructive link that happens to come first)
    const el = ref.current;
    (el?.querySelector('.modal-actions .btn.primary') || el?.querySelector('.modal-actions button') || el?.querySelector('button'))?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>
        <h2 id={labelledBy}>{title}</h2>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function StatTile({ label, value, sub, children, tone }) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
      {children}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          <span className="seg-label">{o.label}</span>
          {o.hint && <span className="seg-hint">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function PassageBlock({ passageId, compact = false, defaultOpen = true, label }) {
  const { bank } = useBank();
  const p = bank.passages[passageId];
  const [open, setOpen] = useState(defaultOpen);
  if (!p) return null;
  const paras = p.text.split(/\n\n+/);
  const fallback = p.text.replace(/\s+/g, ' ').slice(0, 70).replace(/\s+\S*$/, '') + '…';
  return (
    <section className={`passage-block ${compact ? 'compact' : ''}`}>
      <button className="pb-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="eyebrow">{label || 'Passage'}</span>
        <span className="pb-title">{p.title || fallback}</span>
        <Icon name={open ? 'expand' : 'book'} size={16} />
      </button>
      {open && (
        <div className="pb-text">
          {paras.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      )}
    </section>
  );
}

export function QuestionText({ text }) {
  return (
    <div className="q-text">
      {text.split('\n').map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

/** Read-only answer review: options with the key and the user's answer marked. */
export function ReviewOptions({ q, answer }) {
  return (
    <ol className="review-options">
      {q.options.map((opt, i) => {
        const L = LETTERS[i];
        const isKey = L === q.answer;
        const isMine = L === answer;
        return (
          <li key={L} className={isKey ? 'is-key' : isMine ? 'is-wrong' : ''}>
            <span className="ro-letter">{L.toUpperCase()}</span>
            <span className="ro-text">{opt}</span>
            {isKey && (
              <span className="ro-tag good">
                <Icon name="check" size={14} /> Correct answer
              </span>
            )}
            {isMine && !isKey && (
              <span className="ro-tag bad">
                <Icon name="x" size={14} /> Your answer
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Explanation({ q }) {
  return (
    <div className="explain">
      <p>
        <span className="eyebrow">Why</span>
        {q.explanation}
      </p>
      {q.sources?.length > 0 && (
        <p className="sources">
          Source:{' '}
          {q.sources.map((s, k) => (
            <span key={k}>
              {k > 0 && ' · '}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer noopener">
                  {s.title}
                </a>
              ) : (
                s.title
              )}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export function BookmarkButton({ on, onToggle, withLabel = false }) {
  return (
    <button
      type="button"
      className={`icon-btn ${on ? 'on' : ''}`}
      onClick={onToggle}
      aria-pressed={on}
      title={on ? 'Remove bookmark' : 'Bookmark this question'}
    >
      <Icon name="bookmark" />
      {withLabel && <span>{on ? 'Bookmarked' : 'Bookmark'}</span>}
    </button>
  );
}

export function Empty({ icon = 'book', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
