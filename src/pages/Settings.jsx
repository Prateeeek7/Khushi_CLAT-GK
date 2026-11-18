import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Segmented, Modal } from '../components/ui.jsx';
import { useAppState, store, storageAvailable } from '../lib/store.js';
import { SHORTCUTS } from '../lib/shortcuts.js';

export default function Settings() {
  const state = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState(null);
  const file = useRef(null);

  function exportProgress() {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clat-gk-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importProgress(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text()
      .then((t) => {
        store.importData(t);
        setMsg({ tone: 'good', text: 'Progress imported.' });
      })
      .catch((err) => setMsg({ tone: 'bad', text: err.message || 'Import failed.' }))
      .finally(() => (e.target.value = ''));
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Preferences &amp; data</h1>
        </div>
      </header>

      <section className="card">
        <h2 className="field-title">Appearance</h2>
        <Segmented
          label="Theme"
          value={state.settings.theme}
          onChange={(v) => store.setSettings({ theme: v })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </section>

      <section className="card">
        <h2 className="field-title">Your data</h2>
        <p className="muted">
          {storageAvailable
            ? 'Quiz history, mistakes and bookmarks are stored in this browser (localStorage). Nothing is sent to a server. Export a backup to move it to another device.'
            : 'This browser is blocking local storage (private mode?), so progress will be lost when you close the tab.'}
        </p>
        <ul className="data-counts">
          <li>
            <strong>{state.attempts.length}</strong> quizzes
          </li>
          <li>
            <strong>{Object.keys(state.mistakes).length}</strong> saved mistakes
          </li>
          <li>
            <strong>{Object.keys(state.bookmarks).length}</strong> bookmarks
          </li>
        </ul>
        <div className="row wrap">
          <button className="btn" onClick={exportProgress}>
            <Icon name="download" size={16} /> Export progress
          </button>
          <button className="btn" onClick={() => file.current?.click()}>
            <Icon name="upload" size={16} /> Import progress
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={importProgress} />
          <button className="btn danger ghost" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={16} /> Reset all progress
          </button>
        </div>
        {msg && (
          <p className={`small ${msg.tone === 'good' ? 'good-text' : 'warn-text'}`} role="status">
            {msg.text}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="field-title">Keyboard shortcuts in a quiz</h2>
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
      </section>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all progress?"
        actions={
          <>
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={() => {
                store.resetAll();
                setConfirmReset(false);
                setMsg({ tone: 'good', text: 'All progress cleared.' });
              }}
            >
              Reset everything
            </button>
          </>
        }
      >
        <p>This deletes your quiz history, saved mistakes and bookmarks from this browser. It cannot be undone; export a backup first if unsure.</p>
      </Modal>
    </>
  );
}
