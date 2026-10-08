import { useEffect, useRef, useState } from 'react';
import { BOT } from '../../shared/bot.js';
import { Link, usePath } from '../lib/router.jsx';
import { THEMES, boardImage, updateSettings, useSettings } from '../lib/settings.js';
import { FallenKing } from './Drawings.jsx';

const NAV = [
  { to: '/', label: 'Play', match: (p) => p === '/' || p.startsWith('/game/') },
  { to: '/standings', label: 'Standings', match: (p) => p.startsWith('/standings') },
  { to: '/archive', label: 'Archive', match: (p) => p.startsWith('/archive') || p.startsWith('/replay/') },
];

export default function Header() {
  const path = usePath();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const pop = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !pop.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <header className="nameplate">
      <div className="nameplate-inner">
        <Link to="/" className="wordmark" aria-label="Fool's Mate, front page">
          <FallenKing size={28} />
          {path !== '/' && <span>Fool's Mate</span>}
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={n.match(path) ? 'on' : ''}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="tools" ref={pop}>
          <button type="button" className="text-btn" onClick={() => updateSettings({ sound: !settings.sound })}>
            sound {settings.sound ? 'on' : 'off'}
          </button>
          <button type="button" className={`text-btn${open ? ' on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            board
          </button>
          {open && (
            <div className="settings-pop">
              <div className="pop-label">Board</div>
              <div className="theme-row">
                {Object.entries(THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    className={`theme-swatch${settings.theme === key ? ' on' : ''}`}
                    onClick={() => updateSettings({ theme: key })}
                  >
                    <span style={{ backgroundImage: boardImage(key) }} />
                    {t.label}
                  </button>
                ))}
              </div>
              <label className="check-row">
                <input type="checkbox" checked={settings.coords} onChange={(e) => updateSettings({ coords: e.target.checked })} />
                Coordinates
              </label>
              <label className="check-row">
                <input type="checkbox" checked={settings.odds} onChange={(e) => updateSettings({ odds: e.target.checked })} />
                Show {BOT.name}'s options
              </label>
              <label className="check-row">
                <input type="checkbox" checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} />
                Sound
              </label>
              <p className="pop-hint">
                Right-click and drag to draw an arrow, or right-click a square to circle it. Shift, Alt, or both
                change the colour.
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
