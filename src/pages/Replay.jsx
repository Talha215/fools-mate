import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { replay, START_FEN } from '../../shared/rules.js';
import Board from '../components/Board.jsx';
import ChessLayout from '../components/ChessLayout.jsx';
import PlayerBar from '../components/PlayerBar.jsx';
import MoveList from '../components/MoveList.jsx';
import NavControls from '../components/NavControls.jsx';
import { ResultLine } from './Game.jsx';
import { toPgn, useAnnotations } from '../lib/annotate.js';
import { cgColor, checkColor, formatDuration, material, other, turnOf } from '../lib/chess.js';
import { tokenFor } from '../lib/myGames.js';
import { Link } from '../lib/router.jsx';
import { playSound } from '../lib/sound.js';
import { toast } from '../lib/toast.jsx';

const POLL_MS = 2500;

const copy = (text, done) => navigator.clipboard?.writeText(text).then(() => toast(done), () => toast('Copying failed.'));

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
          // Watching a game in progress: keep polling for new moves.
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
  const notes = useAnnotations(plies, game?.playerColor ?? 'w', game?.startPly || 0);
  const lastIdx = plies.length - 1;
  const shown = view ?? lastIdx;
  const shownFen = shown >= 0 ? plies[shown].fen : START_FEN;
  const shownPly = shown >= 0 ? plies[shown] : null;
  const lastMove = useMemo(() => (shownPly ? [shownPly.from, shownPly.to] : undefined), [shownPly]);
  const check = useMemo(() => checkColor(shownFen), [shownFen]);
  const mat = useMemo(() => material(shownFen), [shownFen]);
  const pgn = useMemo(() => (game ? toPgn(game, plies, notes.marks, notes.notes) : null), [game, plies, notes]);

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

  // Autoplay steps through at a reading pace; restarts from the top if
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
        <Link className="btn" to="/archive">To the archive</Link>
      </div>
    );
  }
  if (!game) return <div className="page-msg">Loading the game…</div>;

  const playerColor = game.playerColor;
  const orient = orientation || cgColor(playerColor);
  const active = game.status === 'active';
  const mine = !!tokenFor(game.id);
  const sideToMove = turnOf(plies.length ? plies[lastIdx].fen : START_FEN);

  const bar = (side) =>
    side === playerColor ? (
      <PlayerBar
        side={side}
        name={game.name}
        tag={mine ? 'you' : null}
        material={mat}
        active={active && sideToMove === side}
        right={<span className="move-count"><b>{game.playerMoves}</b> {game.playerMoves === 1 ? 'move' : 'moves'}</span>}
      />
    ) : (
      <PlayerBar
        side={side}
        name={BOT.name}
        tag={BOT.rating}
        material={mat}
        active={active && sideToMove === side}
        status={active && sideToMove === side ? <span className="typing">thinking</span> : null}
      />
    );
  const topSide = orient === 'white' ? 'b' : 'w';

  return (
    <ChessLayout
      top={bar(topSide)}
      bottom={bar(other(topSide))}
      board={
        <Board fen={shownFen} orientation={orient} turnColor={cgColor(turnOf(shownFen))} lastMove={lastMove} check={check} />
      }
      side={
        <div className="sheet">
          <div className="sheet-head">
            <span>{game.mode === 'daily' ? `Daily No. ${game.dailyNumber}` : active ? 'In play' : 'Game record'}</span>
            <span>{game.durationMs != null && formatDuration(game.durationMs)}</span>
          </div>
          <pre className="pgn-tags">{pgn.tags}</pre>
          <MoveList
            plies={plies}
            startPly={game.startPly || 0}
            current={shown}
            onSelect={(i) => go(i, { quiet: true })}
            marks={notes.marks}
            notes={notes.notes}
            empty="No moves yet."
            footer={!active && <ResultLine game={game} />}
          />
          <NavControls ply={shown} last={lastIdx} onGo={(i) => go(i)} onFlip={flip} playing={playing} onTogglePlay={togglePlay} />
          <div className="sheet-actions">
            {mine && active ? (
              <Link className="btn btn-ink" to={`/game/${game.id}`}>Back to your game</Link>
            ) : (
              <Link className="btn btn-ink" to="/">Play {BOT.name}</Link>
            )}
            <button type="button" className="btn" onClick={() => copy(`${pgn.tags}\n\n${pgn.text}\n`, 'PGN copied.')}>
              Copy PGN
            </button>
            <button type="button" className="btn" onClick={() => copy(`${location.origin}/replay/${game.id}`, 'Link copied.')}>
              Copy link
            </button>
          </div>
        </div>
      }
    />
  );
}
