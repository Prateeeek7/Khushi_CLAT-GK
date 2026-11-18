import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { useAppState } from '../lib/store.js';

const NAV = [
  { name: 'home', label: 'Dashboard', icon: 'home', href: '#/' },
  { name: 'practice', label: 'Practice', icon: 'play', href: '#/practice' },
  { name: 'revision', label: 'Revision', icon: 'revise', href: '#/revision' },
  { name: 'analytics', label: 'Analytics', icon: 'chart', href: '#/analytics' },
  { name: 'settings', label: 'Settings', icon: 'settings', href: '#/settings' },
];

export function Wordmark() {
  return (
    <a href="#/" className="wordmark" aria-label="CLAT GK home">
      <span className="wm-mark" aria-hidden="true">§</span>
      <span>
        <span className="wm-title">CLAT GK</span>
        <span className="wm-sub">Current Affairs Desk</span>
      </span>
    </a>
  );
}

export default function Shell({ route, children }) {
  const { mistakes, session } = useAppState();
  const pending = Object.values(mistakes).filter((m) => !m.resolvedAt).length;
  const active = route.name === 'results' ? 'practice' : route.name;

  useEffect(() => {
    const label = NAV.find((n) => n.name === active)?.label;
    document.title = label && active !== 'home' ? `${label} · CLAT GK` : 'CLAT GK · Current Affairs Desk';
  }, [active]);

  const badge = (n) =>
    n === 'revision' && pending ? <span className="nav-badge" aria-label={`${pending} to revise`}>{pending}</span> : null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Wordmark />
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a key={n.name} href={n.href} className={`nav-item ${active === n.name ? 'active' : ''}`} aria-current={active === n.name ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {badge(n.name)}
            </a>
          ))}
        </nav>
        {session && (
          <a className="resume-card" href="#/quiz">
            <span className="eyebrow">In progress</span>
            <strong>{session.title}</strong>
            <span className="muted small">
              {Object.keys(session.answers).length}/{session.questionIds.length} answered · Resume
            </span>
          </a>
        )}
        <p className="sidebar-foot muted small">Progress is saved in this browser only.</p>
      </aside>
      <header className="topbar">
        <Wordmark />
      </header>
      <main className="main" key={route.name + route.params.join('/')}>
        <div className="page">{children}</div>
      </main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.name} href={n.href} className={active === n.name ? 'active' : ''} aria-current={active === n.name ? 'page' : undefined}>
            <span className="tab-icon">
              <Icon name={n.icon} size={20} />
              {badge(n.name)}
            </span>
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
