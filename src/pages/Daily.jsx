import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { replay } from '../../shared/rules.js';
import Board from '../components/Board.jsx';
import { DailyRow } from './Standings.jsx';
import { checkColor } from '../lib/chess.js';
import { word } from '../lib/annotate.js';
import { myGameIds, rememberGame } from '../lib/myGames.js';
import { Link, navigate } from '../lib/router.jsx';
import { updateSettings, useSettings } from '../lib/settings.js';
import { toast } from '../lib/toast.jsx';

// "4 hours 12 minutes" until the next UTC midnight.
function untilTomorrow(now) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.ceil((next - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h} hour${h === 1 ? '' : 's'}`, m && `${m} minute${m === 1 ? '' : 's'}`].filter(Boolean).join(' ');
}

export default function Daily() {
  const settings = useSettings();
  const [daily, setDaily] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState(settings.name || '');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null); // an unfinished daily try on this device
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.daily().then((d) => setDaily(d.daily), (e) => setError(e.message));
    api.leaderboard({ daily: 'today', limit: 100 }).then((d) => setBoard(d.entries), () => setBoard([]));
    const ids = myGameIds().slice(0, 20);
    if (ids.length) {
      api.games({ ids: ids.join(',') }).then(
        (d) => setCurrent(d.games.find((g) => g.status === 'active' && g.mode === 'daily') || null),
        () => {},
      );
    }
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // The day's position with its last move highlighted, as on a diagram.
  const plies = useMemo(() => (daily ? replay(daily.moves).plies : []), [daily]);
  const last = plies[plies.length - 1];
  const lastMove = useMemo(() => (last ? [last.from, last.to] : undefined), [last]);

  async function play(e) {
    e.preventDefault();
    setBusy(true);
    const clean = name.trim();
    updateSettings({ name: clean });
    try {
      const { game, token } = await api.createGame(undefined, clean, 'daily');
      rememberGame(game.id, token);
      navigate(`/game/${game.id}`);
    } catch (err) {
      toast(err.message);
      setBusy(false);
    }
  }

  if (error) return <div className="page-msg"><p>{error}</p></div>;
  if (!daily) return <div className="page-msg">Loading today's game…</div>;

  const side = daily.playerColor === 'w' ? 'White' : 'Black';
  const garyMoves = Math.ceil(daily.moves.length / 2);
  const mine = board?.find((e) => settings.name && e.name.toLowerCase() === settings.name.toLowerCase());
  const dateLabel = new Date(`${daily.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page daily">
      <h1 className="page-title">The Daily</h1>
      <p className="page-dek">
        No. {daily.number}, {dateLabel}. A new one at midnight UTC, in {untilTomorrow(now)}.
      </p>

      <div className="daily-grid">
        <figure className="problem daily-diagram">
          <div className="diagram">
            <Board fen={daily.fen} orientation={daily.playerColor === 'w' ? 'white' : 'black'} lastMove={lastMove} check={checkColor(daily.fen)} />
          </div>
          <figcaption>
            <b>Diagram {daily.number}.</b> {side} to play and lose.
          </figcaption>
        </figure>

        <div className="daily-side">
          <div className="story">
            <p>
              This morning {BOT.name} played {word(garyMoves)} moves against itself, at random, and stopped here. You
              take over as {side}. Everyone gets the same position today.
            </p>
            <p>
              From here it's the usual game: get checkmated in as few moves as you can. {BOT.name}'s replies are as
              random as ever, so try as often as you like. The standings show your best and which try it came on.
            </p>
          </div>

          <form className="coupon daily-coupon" onSubmit={play}>
            <label className="blank">
              <span>Name</span>
              <input value={name} maxLength={20} placeholder="Anonymous" onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-ink btn-big" disabled={busy}>
              {busy ? 'Setting up…' : mine ? "Try today's again" : "Play today's"}
            </button>
            {current && (
              <p className="coupon-note">
                You have a try in progress. <Link to={`/game/${current.id}`}>Go back to it</Link>.
              </p>
            )}
            {mine && <p className="coupon-note">Your best today: {mine.playerMoves} moves, on try {mine.tries}.</p>}
          </form>
        </div>
      </div>

      <h3 className="col-head daily-head">Today's standings</h3>
      {board === null ? (
        <p className="muted">Loading…</p>
      ) : board.length === 0 ? (
        <p className="empty">Nobody has been checkmated today yet.</p>
      ) : (
        <ol className="standings">
          {board.map((e, i) => <DailyRow key={e.id} entry={e} rank={i + 1} />)}
        </ol>
      )}
    </div>
  );
}
