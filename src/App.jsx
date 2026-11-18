import { useEffect, useMemo, useState } from 'react';
import Shell from './components/Shell.jsx';
import { BankContext, useAppState } from './lib/store.js';
import { useRoute, go } from './lib/router.js';
import { playable } from './lib/quiz.js';
import Dashboard from './pages/Dashboard.jsx';
import Practice from './pages/Practice.jsx';
import Quiz from './pages/Quiz.jsx';
import Results from './pages/Results.jsx';
import Revision from './pages/Revision.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';

function useTheme(theme) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
  }, [theme]);
}

export default function App() {
  const [bank, setBank] = useState(null);
  const [error, setError] = useState(null);
  const route = useRoute();
  const { settings } = useAppState();
  useTheme(settings.theme);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}questions.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setBank)
      .catch((e) => setError(`Could not load the question bank (${e.message}). Check your connection and reload.`));
  }, []);

  const ctx = useMemo(() => {
    if (!bank) return null;
    const pool = playable(bank);
    return { bank, pool, byId: new Map(pool.map((q) => [q.id, q])), categories: bank.meta.categories };
  }, [bank]);

  if (error) {
    return (
      <div className="boot">
        <p className="error">{error}</p>
      </div>
    );
  }
  if (!ctx) {
    return (
      <div className="boot" aria-busy="true">
        <div className="boot-mark">§</div>
        <p className="muted">Loading question bank…</p>
      </div>
    );
  }

  if (route.name === 'quiz') {
    return (
      <BankContext.Provider value={ctx}>
        <Quiz />
      </BankContext.Provider>
    );
  }

  const pages = {
    home: <Dashboard />,
    practice: <Practice />,
    results: <Results id={route.params[0]} />,
    revision: <Revision tab={route.params[0]} />,
    analytics: <Analytics />,
    settings: <Settings />,
  };
  const page = pages[route.name];
  if (!page) {
    go('');
    return null;
  }
  return (
    <BankContext.Provider value={ctx}>
      <Shell route={route}>{page}</Shell>
    </BankContext.Provider>
  );
}
