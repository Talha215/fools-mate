import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { replay, START_FEN } from '../../shared/rules.js';
import Board from '../components/Board.jsx';
import { Gary, PenCircle } from '../components/Drawings.jsx';
import { ResultRow } from './Archive.jsx';
import { StandingsRow } from './Standings.jsx';
import { word } from '../lib/annotate.js';
import { checkColor, durationWords } from '../lib/chess.js';
import { myGameIds, rememberGame, tokenFor } from '../lib/myGames.js';
import { Link, navigate } from '../lib/router.jsx';
import { playSound } from '../lib/sound.js';
import { updateSettings, useSettings } from '../lib/settings.js';
import { toast } from '../lib/toast.jsx';

const SIDES = [
  { key: 'w', label: 'White' },
  { key: 'b', label: 'Black' },
  { key: 'random', label: 'Either' },
];

const titleWord = (n) => {
  const w = word(n);
  return w[0].toUpperCase() + w.slice(1);
};

export default function Home() {
  const settings = useSettings();
  const [side, setSide] = useState(settings.color || 'w');
  const [name, setName] = useState(settings.name || '');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);
  const [top, setTop] = useState(null);
  const [recent, setRecent] = useState(null);
  const [current, setCurrent] = useState(null); // this device's unfinished game

  useEffect(() => {
    api.stats().then(setStats, () => {});
    api.leaderboard({ limit: 8, unique: true }).then((d) => setTop(d.entries), () => setTop([]));
    api.games({ scope: 'recent', limit: 8 }).then((d) => setRecent(d.games), () => setRecent([]));
    const ids = myGameIds().slice(0, 10);
    if (ids.length) {
      api.games({ ids: ids.join(',') }).then((d) => setCurrent(d.games.find((g) => g.status === 'active') || null), () => {});
    }
  }, []);

  async function play(e) {
    e.preventDefault();
    setBusy(true);
    const clean = name.trim();
    updateSettings({ name: clean, color: side });
    try {
      // One game at a time: starting a new one resigns the unfinished one.
      if (current) await api.resign(current.id, tokenFor(current.id)).catch(() => {});
      const { game, token } = await api.createGame(side === 'random' ? undefined : side, clean);
      rememberGame(game.id, token);
      navigate(`/game/${game.id}`);
    } catch (err) {
      toast(err.message);
      setBusy(false);
    }
  }

  const record = top?.[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="front">
      <header className="masthead">
        <div className="mast-line">
          <span>Vol. 1, No. {Math.max(1, stats?.games ?? 1).toLocaleString()}</span>
          <span className="hide-sm">Price: free</span>
          <span>{today}</span>
        </div>
        <h1 className="mast-title">Fool's Mate</h1>
        <div className="mast-line mast-line-bottom">
          <span>{stats?.live ? `${stats.live} playing now` : ' '}</span>
          <span>{stats ? `${stats.games.toLocaleString()} games, ${stats.mated.toLocaleString()} checkmated` : ''}</span>
        </div>
      </header>

      <section className="front-top">
        <div className="lead-head">
          {top === null ? (
            <h2 className="headline">&nbsp;</h2>
          ) : record ? (
            <>
              <h2 className="headline">
                {record.name === 'Anonymous' ? 'Anonymous Player' : record.name} Mated in {titleWord(record.playerMoves)}
              </h2>
              <p className="byline">
                The club record. Played as {record.playerColor === 'w' ? 'White' : 'Black'}, over in{' '}
                {durationWords(record.durationMs)}. <Link to={`/replay/${record.id}`}>Replay the game</Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="headline">Nobody Has Lost Yet</h2>
              <p className="byline">The record is open.</p>
            </>
          )}
        </div>

        <article className="lead-body">
          <figure className="photo">
            <Gary width={128} />
            <figcaption>{BOT.name}.</figcaption>
          </figure>
          <div className="story">
            <p>
              {BOT.name} is the club computer. It knows the rules of chess and one plan, which is to attack your king.
              It takes three moves to remember the plan, and plays anything at all until then. After that, if it can
              give check, it does, picking one of its checks at random. If it can't, it moves a piece toward your king,
              also at random.
            </p>
            <p>
              The object is to get checkmated by {BOT.name} in as few moves as you can. Checkmating {BOT.name} doesn't
              count, and neither does a draw. {BOT.name} can't tell a check from a checkmate, so the quickest way to
              lose is to leave it checks that are also mate.
            </p>
          </div>
        </article>

        <form className="coupon" onSubmit={play}>
          <div className="coupon-title">Entry form</div>
          <label className="blank">
            <span>Name</span>
            <input value={name} maxLength={20} placeholder="Anonymous" onChange={(e) => setName(e.target.value)} />
          </label>
          <fieldset className="checks">
            <legend>Play as</legend>
            {SIDES.map((s) => (
              <label key={s.key} className="check">
                <input type="radio" name="side" value={s.key} checked={side === s.key} onChange={() => setSide(s.key)} />
                <span className="box" aria-hidden="true">
                  {side === s.key && (
                    <svg viewBox="0 0 20 20">
                      <path d="M4 3.5c4 4 8 8.5 12.5 13M16 4c-3.5 3.8-8 8.6-12 12.5" />
                    </svg>
                  )}
                </span>
                {s.label}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn btn-ink btn-big" disabled={busy}>
            {busy ? 'Setting up…' : `Play ${BOT.name}`}
          </button>
          {current && (
            <p className="coupon-note">
              You have a game going, {current.playerMoves} {current.playerMoves === 1 ? 'move' : 'moves'} in.{' '}
              <Link to={`/game/${current.id}`}>Go back to it</Link>. Starting a new one resigns it.
            </p>
          )}
        </form>
      </section>

      <section className="front-columns">
        <div className="col">
          <Problem />
        </div>
        <div className="col">
          <h3 className="col-head">Standings</h3>
          {top === null ? (
            <p className="muted">Loading…</p>
          ) : top.length === 0 ? (
            <p className="muted">No one yet.</p>
          ) : (
            <ol className="standings compact">
              {top.map((e, i) => <StandingsRow key={e.id} entry={e} rank={i + 1} compact />)}
            </ol>
          )}
          <Link className="col-more" to="/standings">All standings</Link>
        </div>
        <div className="col">
          <h3 className="col-head">Latest results</h3>
          {recent === null ? (
            <p className="muted">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="muted">No games finished yet.</p>
          ) : (
            <ul className="results">
              {recent.map((g) => <ResultRow key={g.id} game={g} />)}
            </ul>
          )}
          <Link className="col-more" to="/archive">The archive</Link>
        </div>
      </section>
    </div>
  );
}

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

// A newspaper chess problem. The solution is printed upside down; turning it
// the right way up plays it out on the diagram.
function Problem() {
  const plies = useMemo(() => replay(FOOLS_MATE).plies, []);
  const [step, setStep] = useState(-1);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    if (!solved || step >= plies.length - 1) return;
    const t = setTimeout(() => {
      setStep((s) => s + 1);
      playSound(step + 1 === plies.length - 1 ? 'check' : 'move');
    }, step === -1 ? 350 : 800);
    return () => clearTimeout(t);
  }, [solved, step, plies.length]);

  const p = step >= 0 ? plies[step] : null;
  const fen = p ? p.fen : START_FEN;
  const lastMove = useMemo(() => (p ? [p.from, p.to] : undefined), [p]);
  const shapes = useMemo(() => (step === plies.length - 1 ? [{ orig: 'h4', dest: 'e1', brush: 'red' }] : []), [step, plies.length]);

  return (
    <figure className="problem">
      <div className="diagram">
        <Board fen={fen} orientation="white" turnColor={step % 2 ? 'white' : 'black'} lastMove={lastMove} check={checkColor(fen)} autoShapes={shapes} />
      </div>
      <figcaption>
        <b>Diagram 1.</b> White to play and lose in two.
      </figcaption>
      <button
        type="button"
        className={`solution${solved ? ' upright' : ''}`}
        onClick={() => {
          if (solved) {
            setSolved(false);
            setStep(-1);
          } else {
            setSolved(true);
          }
        }}
        title={solved ? 'Reset the diagram' : 'Show the solution'}
      >
        Solution: 1.f3 e5 2.g4 Qh4#
        {solved && step === plies.length - 1 && <PenCircle className="solution-ring" />}
      </button>
      <p className="problem-note">
        {BOT.name}'s first three moves are random, so it has to stumble onto 1…e5 or 1…e6 and then Qh4. That
        happens about once in three hundred games.
      </p>
    </figure>
  );
}
