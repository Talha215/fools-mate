import { useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { Gary } from '../components/Drawings.jsx';
import { rememberGame } from '../lib/myGames.js';
import { navigate } from '../lib/router.jsx';
import { updateSettings, useSettings } from '../lib/settings.js';
import { toast } from '../lib/toast.jsx';

// Endless: a fresh Gary v Gary position every game, never ranked.
export default function Endless() {
  const settings = useSettings();
  const [name, setName] = useState(settings.name || '');
  const [busy, setBusy] = useState(false);

  async function play(e) {
    e.preventDefault();
    setBusy(true);
    const clean = name.trim();
    updateSettings({ name: clean });
    try {
      const { game, token } = await api.createGame(undefined, clean, 'endless');
      rememberGame(game.id, token);
      navigate(`/game/${game.id}`);
    } catch (err) {
      toast(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Endless</h1>
      <p className="page-dek">A new position every game. None of it goes in the standings.</p>
      <div className="endless-grid">
        <div className="story">
          <figure className="photo">
            <Gary width={110} />
            <figcaption>{BOT.name}, warming up.</figcaption>
          </figure>
          <p>
            Each game, {BOT.name} plays itself for six to twelve moves from a fresh random start, then hands you
            whichever side is to move, the same way the Daily does. The object hasn't changed: get checkmated in as few
            moves as you can.
          </p>
          <p>
            Nothing here is ranked, so it's the place to practise, or to keep going after you've had enough of
            today's Daily. Your games still go in the archive.
          </p>
        </div>
        <form className="coupon endless-coupon" onSubmit={play}>
          <label className="blank">
            <span>Name</span>
            <input value={name} maxLength={20} placeholder="Anonymous" onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-ink btn-big" disabled={busy}>
            {busy ? 'Setting up…' : 'Deal a position'}
          </button>
        </form>
      </div>
    </div>
  );
}
