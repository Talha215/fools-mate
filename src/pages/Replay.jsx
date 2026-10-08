import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { replay, START_FEN } from '../../shared/rules.js';
import Board from '../components/Board.jsx';
import ChessLayout from '../components/ChessLayout.jsx';
import PlayerBar from '../components/PlayerBar.jsx';
import MoveList from '../components/MoveList.jsx';
import NavControls from '../components/NavControls.jsx';
import { resultCopy } from '../components/EndModal.jsx';
import { BotAvatar, PlayerAvatar } from '../components/Avatars.jsx';
import { IconLink, IconPlus } from '../components/Icons.jsx';
import { REASONS, cgColor, checkColor, formatDuration, material, other, timeAgo, turnOf } from '../lib/chess.js';
import { pct, useMateStats } from '../lib/mateStats.js';
import { tokenFor } from '../lib/myGames.js';
import { Link } from '../lib/router.jsx';
import { playSound } from '../lib/sound.js';
import { toast } from '../lib/toast.jsx';
import { scoreline, Thinking } from './Game.jsx';

const POLL_MS = 2500;

export default function ReplayPage({ id }) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState(null); // null = follow the latest move
  const [orientation, setOrientation] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer;
    const load = () =>
      api.game(id).then(
        ({ game: g }) => {
          if (!alive) return;
          // Keep the same object while nothing changed, so polling doesn't
          // re-replay the whole game every few seconds.
          setGame((prev) => (prev && prev.ply === g.ply && prev.status === g.status && prev.name === g.name ? prev : g));
          // Spectating a game in progress: keep polling for new moves.
          if (g.status === 'active') timer = setTimeout(load, POLL_MS);
        },
        (e) => alive && setError(e.message),
      );
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  const plies = useMemo(() => (game ? replay(game.moves).plies : []), [game]);
  const lastIdx = plies.length - 1;
  const shown = view ?? lastIdx;
  const shownFen = shown >= 0 ? plies[shown].fen : START_FEN;
  const shownPly = shown >= 0 ? plies[shown] : null;
  const lastMove = useMemo(() => (shownPly ? [shownPly.from, shownPly.to] : undefined), [shownPly]);
  const check = useMemo(() => checkColor(shownFen), [shownFen]);
  const mat = useMemo(() => material(shownFen), [shownFen]);
  const stats = useMateStats(plies, game ? other(game.playerColor) : 'b');

  const go = useCallback(
    (i, { quiet = false } = {}) => {
      const next = Math.max(-1, Math.min(lastIdx, i));
      if (!quiet && next === shown + 1 && plies[next]) {
        const p = plies[next];
        playSound(p.check ? 'check' : p.captured ? 'capture' : 'move');
      }
      setView(next >= lastIdx ? null : next);
    },
    [lastIdx, shown, plies],
  );

  // Autoplay steps forward like a slow broadcast; restarts from the top if
  // started at the end.
  useEffect(() => {
    if (!playing) return;
    if (shown >= lastIdx) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => go(shown + 1), 900);
    return () => clearTimeout(t);
  }, [playing, shown, lastIdx, go]);

  const togglePlay = useCallback(() => {
    if (!playing && shown >= lastIdx) setView(-1);
    setPlaying(!playing);
  }, [playing, shown, lastIdx]);
  const flip = useCallback(() => setOrientation((o) => (o === 'black' ? 'white' : 'black')), []);

  if (error) {
    return (
      <div className="page-msg">
        <p>{error}</p>
        <Link className="btn btn-primary" to="/games">Browse games</Link>
      </div>
    );
  }
  if (!game) return <div className="page-msg">Loading game…</div>;

  const playerColor = game.playerColor;
  const orient = orientation || cgColor(playerColor);
  const active = game.status === 'active';
  const mine = !!tokenFor(game.id);
  const copy = resultCopy(game);
  const sideToMove = turnOf(plies.length ? plies[lastIdx].fen : START_FEN);

  const bar = (side) =>
    side === playerColor ? (
      <PlayerBar
        side={side}
        avatar={<PlayerAvatar name={game.name} />}
        name={game.name}
        tag={mine ? 'You' : null}
        material={mat}
        active={active && sideToMove === side}
        right={<span className="move-count"><b>{game.playerMoves}</b> {game.playerMoves === 1 ? 'move' : 'moves'}</span>}
      />
    ) : (
      <PlayerBar
        side={side}
        avatar={<BotAvatar />}
        name={BOT.name}
        tag={BOT.rating}
        material={mat}
        active={active && sideToMove === side}
        status={active && sideToMove === side ? <Thinking /> : null}
      />
    );
  const topSide = orient === 'white' ? 'b' : 'w';

  return (
    <ChessLayout
      top={bar(topSide)}
      bottom={bar(other(topSide))}
      board={
        <Board
          fen={shownFen}
          orientation={orient}
          turnColor={cgColor(turnOf(shownFen))}
          movableColor={undefined}
          lastMove={lastMove}
          check={check}
        />
      }
      side={
        <div className="side-card">
          <div className="game-info">
            <div className="game-info-title">
              {active ? <span className="live-badge">LIVE</span> : <span className={`result-pill ${copy.tone}`}>{copy.title}</span>}
              <span className="game-info-when">{timeAgo(game.endedAt || game.updatedAt)}</span>
            </div>
            <div className="game-info-players">
              <b>{game.name}</b> ({playerColor === 'w' ? 'White' : 'Black'}) vs {BOT.name}
            </div>
            <div className="game-info-meta">
              {game.result === 'mated' && <>Rank <b>#{game.rank}</b> · </>}
              {game.playerMoves} player moves · {formatDuration(game.durationMs)}
              {game.reason && !active && <> · {REASONS[game.reason]}</>}
            </div>
            <div className="game-info-meta">
              Close calls <b>{stats.closeCalls}</b> · Best mate odds <b>{pct(stats.bestOdds)}</b>
            </div>
          </div>
          <MoveList
            plies={plies}
            current={shown}
            onSelect={(i) => go(i, { quiet: true })}
            footer={!active && (
              <>
                <div className="result-score">{scoreline(game)}</div>
                <div className={`result-text ${copy.tone}`}>{copy.title}</div>
              </>
            )}
          />
          <NavControls
            ply={shown}
            last={lastIdx}
            onGo={(i) => go(i)}
            onFlip={flip}
            playing={playing}
            onTogglePlay={togglePlay}
          />
          <div className="side-actions">
            {mine && active ? (
              <Link className="btn btn-primary" to={`/game/${game.id}`}>Continue your game</Link>
            ) : (
              <Link className="btn btn-primary" to="/"><IconPlus /> Play</Link>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                const link = `${location.origin}/replay/${game.id}`;
                navigator.clipboard?.writeText(link).then(() => toast('Link copied.'), () => toast(link));
              }}
            >
              <IconLink /> Copy link
            </button>
          </div>
        </div>
      }
    />
  );
}
