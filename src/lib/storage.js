// Progress store persisted in the browser (localStorage). No backend.
// Everything is wrapped in try/catch: private windows or blocked storage just mean the
// app runs without persistence.

const KEY = 'clatgk:v1';
const MAX_ATTEMPTS = 300;

export function emptyState() {
  return {
    version: 1,
    attempts: [], // newest first
    mistakes: {}, // qid -> { count, lastAnswer, lastWrongAt, resolvedAt, firstWrongAt }
    bookmarks: {}, // qid -> timestamp
    settings: { theme: 'system', count: 10, mode: 'passage', timer: 'clat', categories: [] },
    session: null, // in-progress quiz (survives refresh)
  };
}

function safeParse(raw) {
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || s.version !== 1) return null;
    const base = emptyState();
    return {
      ...base,
      ...s,
      settings: { ...base.settings, ...(s.settings || {}) },
      mistakes: s.mistakes || {},
      bookmarks: s.bookmarks || {},
      attempts: Array.isArray(s.attempts) ? s.attempts : [],
    };
  } catch {
    return null;
  }
}

/**
 * Apply a finished attempt to the mistake log:
 *  - wrong answer  -> mistake count +1, marked unresolved
 *  - correct answer on a logged mistake -> resolved (kept for history)
 */
export function applyAttemptToMistakes(mistakes, attempt, questionsById) {
  const next = { ...mistakes };
  for (const qid of attempt.questionIds) {
    const q = questionsById.get(qid);
    const a = attempt.answers[qid];
    if (!q || a == null) continue;
    const prev = next[qid];
    if (a !== q.answer) {
      next[qid] = {
        count: (prev?.count || 0) + 1,
        lastAnswer: a,
        lastWrongAt: attempt.finishedAt,
        firstWrongAt: prev?.firstWrongAt || attempt.finishedAt,
        resolvedAt: null,
      };
    } else if (prev && !prev.resolvedAt) {
      next[qid] = { ...prev, resolvedAt: attempt.finishedAt };
    }
  }
  return next;
}

export function createStore(storage = globalThis.localStorage) {
  let state = emptyState();
  try {
    const loaded = storage && safeParse(storage.getItem(KEY));
    if (loaded) state = loaded;
  } catch {
    /* storage unavailable */
  }
  const listeners = new Set();

  function persist() {
    try {
      storage?.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota or blocked: keep working in memory */
    }
  }
  function set(updater) {
    state = typeof updater === 'function' ? updater(state) : updater;
    persist();
    listeners.forEach((l) => l());
  }

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setSettings(patch) {
      set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    },
    setSession(session) {
      set((s) => ({ ...s, session }));
    },
    toggleBookmark(qid) {
      set((s) => {
        const bookmarks = { ...s.bookmarks };
        if (bookmarks[qid]) delete bookmarks[qid];
        else bookmarks[qid] = Date.now();
        return { ...s, bookmarks };
      });
    },
    recordAttempt(attempt, questionsById) {
      set((s) => ({
        ...s,
        session: null,
        attempts: [attempt, ...s.attempts].slice(0, MAX_ATTEMPTS),
        mistakes: applyAttemptToMistakes(s.mistakes, attempt, questionsById),
      }));
    },
    resolveMistake(qid) {
      set((s) => (s.mistakes[qid] ? { ...s, mistakes: { ...s.mistakes, [qid]: { ...s.mistakes[qid], resolvedAt: Date.now() } } } : s));
    },
    removeMistake(qid) {
      set((s) => {
        const mistakes = { ...s.mistakes };
        delete mistakes[qid];
        return { ...s, mistakes };
      });
    },
    clearMistakes(onlyResolved = false) {
      set((s) => ({
        ...s,
        mistakes: onlyResolved ? Object.fromEntries(Object.entries(s.mistakes).filter(([, m]) => !m.resolvedAt)) : {},
      }));
    },
    resetAll() {
      set({ ...emptyState(), settings: state.settings });
    },
    exportData() {
      return JSON.stringify(state, null, 1);
    },
    importData(raw) {
      const parsed = safeParse(raw);
      if (!parsed) throw new Error('Not a valid progress file');
      set({ ...parsed, session: null });
    },
  };
}
