import { useEffect, useRef, useState } from 'react';
import { Link, usePath } from '../lib/router.jsx';
import { THEMES, updateSettings, useSettings } from '../lib/settings.js';
import { IconSettings, IconSoundOff, IconSoundOn } from './Icons.jsx';

export function Logo({ size = 28 }) {
  // A jester's cap: the fool in Fool's Mate.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 46 6 16l18 16 8-24 8 24 18-16-4 30z" fill="#81b64c" />
      <path d="M32 8 24 32l8 14 8-14z" fill="#e8b33b" />
      <path d="M6 16 24 32l-6 14h-8z" fill="#5d8a37" />
      <path d="M58 16 40 32l6 14h8z" fill="#5d8a37" />
      <rect x="9" y="45" width="46" height="9" rx="3" fill="#e8e6e3" />
      <circle cx="6" cy="14" r="5" fill="#e8b33b" />
      <circle cx="32" cy="7" r="5" fill="#e05252" />
      <circle cx="58" cy="14" r="5" fill="#e8b33b" />
    </svg>
  );
}

const NAV = [
  { to: '/', label: 'Play' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/games', label: 'Games' },
];

export default function Header() {
  const path = usePath();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const pop = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !pop.current?.contains(e.target) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const isActive = (to) => (to === '/' ? path === '/' || path.startsWith('/game/') : path.startsWith(to) || (to === '/games' && path.startsWith('/replay/')));

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">
          <Logo />
          <span className="brand-text">Fool's<b>Mate</b></span>
        </Link>
        <nav className="site-nav">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={isActive(n.to) ? 'active' : ''}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-tools" ref={pop}>
          <button
            type="button"
            className="icon-btn"
            title={settings.sound ? 'Sound on' : 'Sound off'}
            onClick={() => updateSettings({ sound: !settings.sound })}
          >
            {settings.sound ? <IconSoundOn /> : <IconSoundOff />}
          </button>
          <button type="button" className={`icon-btn${open ? ' on' : ''}`} title="Board settings" onClick={() => setOpen((o) => !o)}>
            <IconSettings />
          </button>
          {open && (
            <div className="settings-pop">
              <div className="settings-title">Board</div>
              <div className="theme-grid">
                {Object.entries(THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    className={`theme-swatch${settings.theme === key ? ' selected' : ''}`}
                    onClick={() => updateSettings({ theme: key })}
                    title={t.label}
                  >
                    <span style={{ background: `conic-gradient(${t.dark} 0 25%, ${t.light} 0 50%, ${t.dark} 0 75%, ${t.light} 0)` }} />
                    {t.label}
                  </button>
                ))}
              </div>
              <label className="toggle-row">
                <input type="checkbox" checked={settings.coords} onChange={(e) => updateSettings({ coords: e.target.checked })} />
                Coordinates
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={settings.odds} onChange={(e) => updateSettings({ odds: e.target.checked })} />
                Show the bot's mating odds
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} />
                Sound
              </label>
              <div className="settings-hint">
                Right-click drag to draw arrows, right-click a square to circle it. Hold Shift, Alt or both for other colours.
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
