import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { replay, START_FEN } from '../../shared/rules.js';
import Board from '../components/Board.jsx';
import { BotAvatar } from '../components/Avatars.jsx';
import { RankBadge } from './Leaderboard.jsx';
import { checkColor, formatDuration } from '../lib/chess.js';
import { myGameIds, rememberGame, tokenFor } from '../lib/myGames.js';
import { Piece } from '../lib/pieces.jsx';
import { Link, navigate } from '../lib/router.jsx';
import { updateSettings, useSettings } from '../lib/settings.js';
import { toast } from '../lib/toast.jsx';

const COLORS = [
  { key: 'w', label: 'White' },
  { key: 'random', label: 'Random' },
  { key: 'b', label: 'Black' },
];

export default function Home() {
  const settings = useSettings();
  const [color, setColor] = useState(settings.color || 'w');
  const [name, setName] = useState(settings.name || '');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);
  const [top, setTop] = useState(null);
  const [current, setCurrent] = useState(null); // this device's unfinished game

  useEffect(() => {
    api.stats().then(setStats, () => {});
    api.leaderboard({ limit: 6, unique: true }).then((d) => setTop(d.entries), () => setTop([]));
    const ids = myGameIds().slice(0, 10);
    if (ids.length) {
      api.games({ ids: ids.join(',') }).then((d) => setCurrent(d.games.find((g) => g.status === 'active') || null), () => {});
    }
  }, []);

  async function play() {
    setBusy(true);
    const clean = name.trim();
    updateSettings({ name: clean, color });
    try {
      // One game at a time: starting fresh gives up the unfinished one.
      if (current) await api.resign(current.id, tokenFor(current.id)).catch(() => {});
      const { game, token } = await api.createGame(color === 'random' ? undefined : color, clean);
      rememberGame(game.id, token);
      navigate(`/game/${game.id}`);
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="home">
      <section className="home-hero">
        <div className="hero-top">
          <div className="eyebrow">The chess game you win by losing</div>
          <h1>Lose to the worst chess bot ever made.</h1>
          <p className="lede">
            <b>{BOT.name}</b> plays a random legal move every turn. Your job: get checkmated in as few moves as
            possible. The theoretical record is two moves. Getting a random number generator to play them is
            the hard part.
          </p>
        </div>

        <div className="hero-bottom">
          <ul className="rules">
            <li><span className="dot win" /><span>Get checkmated: <b>you win</b>, scored by your move count.</span></li>
            <li><span className="dot loss" /><span>Checkmate the bot, or draw: <b>you fail</b>.</span></li>
            <li><span className="dot info" /><span>Every move is checked on the server. No takebacks, no rerolls.</span></li>
          </ul>
          <div className="stats-strip">
            <Stat label="Games played" value={stats?.games} />
            <Stat label="Successful losses" value={stats?.mated} />
            <Stat label="Record" value={stats ? (stats.best != null ? `${stats.best} moves` : '–') : null} />
            <Stat label="Playing now" value={stats?.live} live={stats?.live > 0} />
          </div>
        </div>

        <div className="play-card">
          <div className="bot-card">
            <BotAvatar size={64} />
            <div>
              <div className="bot-name">
                {BOT.name} <span className="pb-tag">{BOT.rating}</span>
              </div>
              <div className="bot-tagline">{BOT.tagline}</div>
            </div>
          </div>

          {current && (
            <div className="resume">
              <span>
                Game in progress: <b>{current.playerMoves}</b> moves in.
              </span>
              <Link className="btn btn-sm" to={`/game/${current.id}`}>Resume</Link>
            </div>
          )}

          <label className="field">
            <span>Your name</span>
            <input
              value={name}
              maxLength={20}
              placeholder="Anonymous"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && play()}
            />
          </label>

          <div className="field">
            <span>Play as</span>
            <div className="color-pick">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={color === c.key ? 'selected' : ''}
                  onClick={() => setColor(c.key)}
                  title={c.label}
                  aria-pressed={color === c.key}
                >
                  {c.key === 'random' ? (
                    <span className="random-king">
                      <Piece type="k" color="w" />
                      <Piece type="k" color="b" />
                    </span>
                  ) : (
                    <Piece type="k" color={c.key} />
                  )}
                  <span className="color-label">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="btn btn-primary btn-xl" onClick={play} disabled={busy}>
            {busy ? 'Setting up the board…' : current ? 'Start a new game' : 'Play'}
          </button>
          {current && <div className="field-hint">Starting a new game gives up the one in progress.</div>}
        </div>
      </section>

      <section className="home-lower">
        <div className="card demo-card">
          <h3>The 2-move record: Fool's Mate</h3>
          <DemoBoard />
          <p className="muted">
            1. f3 e5 2. g4?? Qh4#. All you need is for {BOT.name} to pick 1…e5 or 1…e6 (2 of its 20 options) and
            then Qh4 (1 of about 30). Roughly a 1 in 300 shot. Good luck.
          </p>
        </div>
        <div className="card top-card">
          <div className="card-head">
            <h3>Fastest losses</h3>
            <Link to="/leaderboard">Full leaderboard →</Link>
          </div>
          {top === null ? (
            <div className="muted pad">Loading…</div>
          ) : top.length === 0 ? (
            <div className="empty">Nobody has managed to lose yet. Be the first.</div>
          ) : (
            <ol className="mini-lb">
              {top.map((e, i) => (
                <li key={e.id}>
                  <Link to={`/replay/${e.id}`}>
                    <RankBadge n={i + 1} />
                    <span className="mini-name">{e.name}</span>
                    <Piece type="k" color={e.playerColor} />
                    <span className="mini-moves"><b>{e.playerMoves}</b> moves</span>
                    <span className="mini-time">{formatDuration(e.durationMs)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, live }) {
  return (
    <div className="stat">
      <div className="stat-value">
        {live && <span className="live-dot" />}
        {value ?? '·'}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

// Plays fool's mate on a loop. Still a real board: right-click to draw on it.
function DemoBoard() {
  const plies = useMemo(() => replay(FOOLS_MATE).plies, []);
  const [i, setI] = useState(-1);
  const end = plies.length - 1;
  useEffect(() => {
    const t = setTimeout(() => setI((x) => (x >= end ? -1 : x + 1)), i === end ? 3200 : i === -1 ? 1300 : 1000);
    return () => clearTimeout(t);
  }, [i, end]);
  const p = i >= 0 ? plies[i] : null;
  const fen = p ? p.fen : START_FEN;
  const shapes = useMemo(() => (i === end ? [{ orig: 'h4', dest: 'e1', brush: 'red' }] : []), [i, end]);
  const lastMove = useMemo(() => (p ? [p.from, p.to] : undefined), [p]);
  return (
    <div className="demo-board">
      <Board fen={fen} orientation="white" turnColor={i % 2 ? 'white' : 'black'} lastMove={lastMove} check={checkColor(fen)} autoShapes={shapes} />
    </div>
  );
}
