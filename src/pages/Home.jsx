import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { replay } from '../../shared/rules.js';
import Board from '../components/Board.jsx';
import { ResultRow } from './Archive.jsx';
import { DailyRow } from './Standings.jsx';
import { word } from '../lib/annotate.js';
import { checkColor } from '../lib/chess.js';
import { myGameIds, rememberGame } from '../lib/myGames.js';
import { Link, navigate } from '../lib/router.jsx';
import { updateSettings, useSettings } from '../lib/settings.js';
import { toast } from '../lib/toast.jsx';

const titleWord = (n) => {
  const w = word(n);
  return w[0].toUpperCase() + w.slice(1);
};

// "4 hours 12 minutes" until the next UTC midnight, when the Daily changes.
function untilTomorrow(now) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.ceil((next - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h} hour${h === 1 ? '' : 's'}`, m && `${m} minute${m === 1 ? '' : 's'}`].filter(Boolean).join(' ');
}

// The front page is the Daily: one Gary v Gary position for everyone today.
export default function Home() {
  const settings = useSettings();
  const [daily, setDaily] = useState(null);
  const [board, setBoard] = useState(null);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState(settings.name || '');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null); // an unfinished daily try on this device
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.daily().then((d) => setDaily(d.daily), (e) => setError(e.message));
    api.leaderboard({ daily: 'today', limit: 10 }).then((d) => setBoard(d.entries), () => setBoard([]));
    api.stats().then(setStats, () => {});
    api.games({ scope: 'losses', limit: 8 }).then((d) => setRecent(d.games), () => setRecent([]));
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

  // The day's position with Gary's last move highlighted, as on a diagram.
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

  const today = new Date(now).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const leader = board?.[0];
  const mine = board?.find((e) => settings.name && e.name.toLowerCase() === settings.name.toLowerCase());
  const side = daily?.playerColor === 'w' ? 'White' : 'Black';

  return (
    <div className="front">
      <header className="masthead">
        <div className="mast-line">
          <span>Vol. 1, No. {daily?.number ?? ' '}</span>
          <span className="hide-sm">Price: free</span>
          <span>{today}</span>
        </div>
        <h1 className="mast-title">Fool's Mate</h1>
        <div className="mast-line mast-line-bottom">
          <span>{stats?.live ? `${stats.live} playing now` : ' '}</span>
          <span>Next position in {untilTomorrow(now)}</span>
        </div>
      </header>

      {error && <p className="empty">{error}</p>}

      <section className="front-top">
        <div className="lead-head">
          {board === null || !daily ? (
            <h2 className="headline">&nbsp;</h2>
          ) : leader ? (
            <>
              <h2 className="headline">
                {leader.name === 'Anonymous' ? 'Anonymous Player' : leader.name} Mated in {titleWord(leader.playerMoves)}
              </h2>
              <p className="byline">
                Leads Daily No. {daily.number}, on try {leader.tries}. <Link to={`/replay/${leader.id}`}>Replay the game</Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="headline">Daily No. {daily.number}: Nobody Mated Yet</h2>
              <p className="byline">Today's position is waiting below.</p>
            </>
          )}
        </div>

        <article className="lead-body">
          {daily && (
            <figure className="problem front-diagram">
              <div className="diagram">
                <Board fen={daily.fen} orientation={daily.playerColor === 'w' ? 'white' : 'black'} lastMove={lastMove} check={checkColor(daily.fen)} />
              </div>
              <figcaption>
                <b>Diagram {daily.number}.</b> {side} to play and lose.
              </figcaption>
            </figure>
          )}
          {daily && (
            <div className="story">
              <p>
                This morning {BOT.name}, the club computer, played {word(Math.ceil(daily.moves.length / 2))} moves
                against itself at random and stopped here. You take over as {side}. Everyone gets the same position
                today.
              </p>
              <p>
                The object is to get checkmated by {BOT.name} in as few moves as you can. Checkmating {BOT.name}{' '}
                doesn't count, and neither does a draw. {BOT.name} has one plan, which is to attack your king: if it can
                give check it does, picking one of its checks at random, and if it can't it moves a piece toward your
                king. It can't tell a check from a checkmate.
              </p>
              <p>
                Its replies are random, so try as often as you like. The standings show your best and which try it came
                on.
              </p>
            </div>
          )}
        </article>

        <form className="coupon" onSubmit={play}>
          <div className="coupon-title">Today's game</div>
          <label className="blank">
            <span>Name</span>
            <input value={name} maxLength={20} placeholder="Anonymous" onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-ink btn-big" disabled={busy || !daily}>
            {busy ? 'Setting up…' : mine ? 'Try again' : `Play ${BOT.name}`}
          </button>
          {mine && <p className="coupon-note">Your best today: {mine.playerMoves} moves, on try {mine.tries}.</p>}
          {current && (
            <p className="coupon-note">
              You have a try in progress. <Link to={`/game/${current.id}`}>Go back to it</Link>.
            </p>
          )}
        </form>
      </section>

      <section className="front-columns">
        <div className="col">
          <h3 className="col-head">Today's standings</h3>
          {board === null ? (
            <p className="muted">Loading…</p>
          ) : board.length === 0 ? (
            <p className="muted">Nobody has been checkmated today yet.</p>
          ) : (
            <ol className="standings compact">
              {board.map((e, i) => <DailyRow key={e.id} entry={e} rank={i + 1} />)}
            </ol>
          )}
          <Link className="col-more" to="/standings">All standings</Link>
        </div>
        <div className="col more-games">
          <h3 className="col-head">More games</h3>
          <p>
            <b>Endless.</b> A new {BOT.name} v {BOT.name} position every game. Nothing counts, so play as many as you
            like. <Link to="/endless">Play endless</Link>
          </p>
          <p>
            <b>Classic.</b> The original: from the first move, with the Fool's Mate problem and the all-time
            standings. <Link to="/classic">Play classic</Link>
          </p>
        </div>
        <div className="col">
          <h3 className="col-head">Latest losses</h3>
          {recent === null ? (
            <p className="muted">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="muted">Nobody has been checkmated yet.</p>
          ) : (
            <ul className="results">
              {recent.map((g) => <ResultRow key={g.id} game={g} />)}
            </ul>
          )}
          <Link className="col-more" to="/archive">Every game, in the archive</Link>
        </div>
      </section>
    </div>
  );
}
