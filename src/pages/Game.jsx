import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { playUci, replay, START_FEN } from '../../shared/rules.js';
import { garyOptions } from '../../shared/gary.js';
import Board from '../components/Board.jsx';
import ChessLayout from '../components/ChessLayout.jsx';
import PlayerBar from '../components/PlayerBar.jsx';
import MoveList from '../components/MoveList.jsx';
import NavControls from '../components/NavControls.jsx';
import PromotionDialog from '../components/PromotionDialog.jsx';
import ResultSlip from '../components/ResultSlip.jsx';
import Tally from '../components/Tally.jsx';
import { moveLabel, useAnnotations } from '../lib/annotate.js';
import { cgColor, checkColor, isPromotion, legalDests, material, other, scoreline, turnOf } from '../lib/chess.js';
import { rememberGame, tokenFor } from '../lib/myGames.js';
import { Link, navigate } from '../lib/router.jsx';
import { useSettings } from '../lib/settings.js';
import { playSound, soundForMove } from '../lib/sound.js';
import { toast } from '../lib/toast.jsx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function GamePage({ id }) {
  const [state, setState] = useState({ game: null, error: null });
  const token = tokenFor(id);

  useEffect(() => {
    // Without this device's token it isn't your game to play; watch it instead.
    if (!token) {
      navigate(`/replay/${id}`, { replace: true });
      return;
    }
    let alive = true;
    api.game(id).then(
      ({ game }) => alive && setState({ game, error: null }),
      (e) => alive && setState({ game: null, error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [id, token]);

  if (state.error) {
    return (
      <div className="page-msg">
        <p>{state.error}</p>
        <Link className="btn" to="/">Back to the front page</Link>
      </div>
    );
  }
  if (!state.game) return <div className="page-msg">Loading the game…</div>;
  return <GameView initial={state.game} token={token} />;
}

function GameView({ initial, token }) {
  const settings = useSettings();
  const [game, setGame] = useState(initial);
  const [pending, setPending] = useState(null); // the player's move (UCI), until the server answers
  const [view, setView] = useState(null); // ply being browsed; null = live position
  const [orientation, setOrientation] = useState(cgColor(initial.playerColor));
  const [promo, setPromo] = useState(null);
  const [tally, setTally] = useState(null); // Gary's options for the current turn (see Tally)
  const [slipOpen, setSlipOpen] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [busy, setBusy] = useState(false);
  // Intro for a fresh game: how many of the server's moves are on show yet
  // (null = all). As Black, the empty board first, then Gary's opening move.
  // In the daily, the board fast-forwards through Gary v Gary to the day's
  // position before you get the controls.
  const startPly = initial.startPly || 0;
  const [reveal, setReveal] = useState(() => {
    const fresh = Date.now() - initial.createdAt < 60000;
    if (fresh && startPly > 0 && initial.ply === startPly) return 0;
    if (fresh && initial.playerColor === 'b' && initial.ply === 1) return 0;
    return null;
  });
  const intro = reveal !== null;
  const boardRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const playerColor = game.playerColor;
  const active = game.status === 'active';

  const moves = useMemo(
    () => (reveal !== null ? game.moves.slice(0, reveal) : pending ? [...game.moves, pending] : game.moves),
    [reveal, pending, game.moves],
  );
  const plies = useMemo(() => replay(moves).plies, [moves]);
  const lastIdx = plies.length - 1;
  const liveFen = lastIdx >= 0 ? plies[lastIdx].fen : START_FEN;
  const shown = view ?? lastIdx;
  const shownFen = shown >= 0 ? plies[shown].fen : START_FEN;
  const shownPly = shown >= 0 ? plies[shown] : null;
  const myTurn = active && view === null && !pending && !promo && !intro && turnOf(liveFen) === playerColor;

  const dests = useMemo(() => (myTurn ? legalDests(liveFen) : new Map()), [myTurn, liveFen]);
  const lastMove = useMemo(() => (shownPly ? [shownPly.from, shownPly.to] : undefined), [shownPly]);
  const check = useMemo(() => checkColor(shownFen), [shownFen]);
  const mat = useMemo(() => material(shownFen), [shownFen]);
  const notes = useAnnotations(plies, playerColor, intro ? 0 : startPly);
  const playerMoves = plies.filter((p, i) => i >= startPly && p.color === playerColor).length;
  const latestNote = [...notes.notes.entries()].pop();

  useEffect(() => {
    if (reveal === null) return;
    const target = game.moves.length;
    if (reveal >= target) {
      const t = setTimeout(() => setReveal(null), startPly ? 350 : 0);
      return () => clearTimeout(t);
    }
    // Daily: about two seconds of fast-forward whatever the length.
    const step = startPly ? Math.max(90, Math.min(170, 2200 / startPly)) : 650;
    const t = setTimeout(() => {
      setReveal(reveal + 1);
      playSound('move');
    }, reveal === 0 && startPly ? 500 : step);
    return () => clearTimeout(t);
  }, [reveal, game.moves.length, startPly]);

  // A premove queued while Gary was "thinking" fires as soon as it's our
  // turn. Board's own effect (a child, so it runs first) has already handed
  // chessground the new legal moves by now.
  useEffect(() => {
    if (myTurn) boardRef.current?.playPremove();
  }, [myTurn]);

  useEffect(() => {
    document.title = myTurn ? "Your move · Fool's Mate" : "Fool's Mate";
    return () => void (document.title = "Fool's Mate");
  }, [myTurn]);

  const finish = useCallback((afterBotMove) => {
    setTimeout(() => alive.current && setSlipOpen(true), afterBotMove ? 700 : 400);
  }, []);

  async function submit(uci) {
    const chess = new Chess(liveFen);
    const m = playUci(chess, uci);
    setPromo(null);
    if (!m) {
      boardRef.current?.setPosition(liveFen, lastMove);
      return;
    }
    setPending(uci);
    playSound(soundForMove(m, chess.inCheck()));
    const afterFen = chess.fen();
    const options = chess.isGameOver() ? null : garyOptions(chess);
    setTally(options ? { ...options, phase: 'thinking' } : null);

    const started = performance.now();
    const ply = game.ply;
    try {
      const { game: next } = await api.move(game.id, token, ply, uci);
      const botMoved = next.moves.length === ply + 2;
      // The server answers instantly; the pause is theatre. Longer when a mate
      // is on the table, so you get a moment to look at the red marks.
      const pause = botMoved ? 320 + Math.random() * 420 + (options?.mates ? 900 : 0) : 100;
      await sleep(Math.max(0, pause - (performance.now() - started)));
      if (!alive.current) return;
      setGame(next);
      setPending(null);
      if (botMoved) {
        const c = new Chess(afterFen);
        const bm = playUci(c, next.moves[next.moves.length - 1]);
        if (bm) {
          playSound(soundForMove(bm, c.inCheck()));
          setTally({ ...options, phase: 'done', picked: bm.lan, pickedLabel: moveLabel(ply + 1, bm.san) });
        }
      }
      if (next.status === 'finished') finish(botMoved);
    } catch (err) {
      if (!alive.current) return;
      setPending(null);
      setTally(null);
      if (err.game) setGame(err.game);
      toast(err.message);
    }
  }

  function onMove(orig, dest, meta) {
    if (isPromotion(liveFen, orig, dest)) {
      // Premoves auto-queen, like lichess.
      if (meta?.premove) submit(`${orig}${dest}q`);
      else setPromo({ from: orig, to: dest });
      return;
    }
    submit(orig + dest);
  }

  async function resign() {
    setConfirmResign(false);
    try {
      const { game: g } = await api.resign(game.id, token);
      setGame(g);
      finish(false);
    } catch (e) {
      toast(e.message);
    }
  }

  async function playAgain() {
    setBusy(true);
    try {
      const color = settings.color === 'w' || settings.color === 'b' ? settings.color : undefined;
      const { game: g, token: t } = await api.createGame(color, settings.name, game.mode === 'daily' ? 'daily' : undefined);
      rememberGame(g.id, t);
      navigate(`/game/${g.id}`);
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
  }

  const go = useCallback((i) => setView(i >= lastIdx ? null : Math.max(-1, i)), [lastIdx]);
  const flip = useCallback(() => setOrientation((o) => (o === 'white' ? 'black' : 'white')), []);

  const sideToMove = turnOf(liveFen);
  const bar = (side) =>
    side === playerColor ? (
      <PlayerBar
        side={side}
        name={game.name}
        tag="you"
        material={mat}
        active={active && sideToMove === side}
        right={
          <span className="move-count" title="Your moves so far. Fewer is better.">
            <b>{playerMoves}</b> {playerMoves === 1 ? 'move' : 'moves'}
          </span>
        }
      />
    ) : (
      <PlayerBar
        side={side}
        name={BOT.name}
        tag={BOT.rating}
        material={mat}
        active={active && sideToMove === side}
        status={
          intro && startPly ? <span className="typing">playing itself</span> : (pending || intro) && active ? <span className="typing">thinking</span> : null
        }
      />
    );
  const topSide = orientation === 'white' ? 'b' : 'w';

  return (
    <>
      <ChessLayout
        top={bar(topSide)}
        bottom={bar(other(topSide))}
        board={
          <Board
            ref={boardRef}
            fen={shownFen}
            orientation={orientation}
            turnColor={cgColor(turnOf(shownFen))}
            movableColor={active && view === null && !promo && !intro ? cgColor(playerColor) : undefined}
            dests={dests}
            lastMove={lastMove}
            check={check}
            // Always on while live (chessground only premoves off-turn), so a
            // drag started right after your move isn't lost before React
            // re-renders with Gary to move.
            premove={active && view === null && !intro}
            onMove={onMove}
          >
            {promo && (
              <PromotionDialog
                square={promo.to}
                color={playerColor}
                orientation={orientation}
                onPick={(t) => submit(`${promo.from}${promo.to}${t}`)}
                onCancel={() => {
                  setPromo(null);
                  boardRef.current?.setPosition(liveFen, lastMove);
                }}
              />
            )}
            {view !== null && (
              <button type="button" className="board-banner" onClick={() => setView(null)}>
                Looking at move {Math.floor(view / 2) + 1}. Back to the game
              </button>
            )}
          </Board>
        }
        side={
          <div className="sheet">
            <div className="sheet-head">
              <span>{game.mode === 'daily' ? `Daily No. ${game.dailyNumber}` : 'Scoresheet'}</span>
              <span>{playerColor === 'w' ? `${game.name} v ${BOT.name}` : `${BOT.name} v ${game.name}`}</span>
            </div>
            {settings.odds && (active || tally) && <Tally data={tally} />}
            {latestNote && <p className="latest-note">{latestNote[1]}</p>}
            <MoveList
              plies={plies}
              startPly={startPly}
              current={shown}
              onSelect={go}
              marks={notes.marks}
              notes={notes.notes}
              empty={!active ? 'No moves were played.' : playerColor === 'w' ? 'Your move.' : `${BOT.name} has White.`}
              footer={!active && <ResultLine game={game} />}
            />
            <NavControls ply={shown} last={lastIdx} onGo={go} onFlip={flip} />
            <div className="sheet-actions">
              {active ? (
                confirmResign ? (
                  <div className="confirm-row">
                    <span>Resign this game?</span>
                    <button type="button" className="btn btn-ink" onClick={resign}>Yes</button>
                    <button type="button" className="btn" onClick={() => setConfirmResign(false)}>No</button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirmResign(true)}>Resign</button>
                )
              ) : (
                <>
                  <button type="button" className="btn btn-ink" onClick={playAgain} disabled={busy}>
                    {game.mode === 'daily' ? 'Try again' : 'Play again'}
                  </button>
                  <Link className="btn" to={`/replay/${game.id}`}>Replay</Link>
                  {game.result === 'mated' && <Link className="btn" to={game.mode === 'daily' ? '/daily' : '/standings'}>Standings</Link>}
                </>
              )}
            </div>
          </div>
        }
      />
      {game.status === 'finished' && (
        <ResultSlip
          open={slipOpen}
          game={game}
          token={token}
          closeCalls={notes.closeCalls}
          finalOdds={tally?.phase === 'done' && game.result === 'mated' ? tally : null}
          onClose={() => setSlipOpen(false)}
          onGame={setGame}
          onPlayAgain={playAgain}
          busy={busy}
        />
      )}
    </>
  );
}

const RESULT_WORDS = {
  mated: (g) => `Checkmated in ${g.playerMoves}`,
  won: () => `Checkmated ${BOT.name} (void)`,
  draw: () => 'Drawn',
  resigned: () => 'Resigned',
};

export function ResultLine({ game }) {
  return (
    <>
      <span className="result-score">{scoreline(game)}</span>
      <span className={`result-words ${game.result}`}>{RESULT_WORDS[game.result]?.(game)}</span>
    </>
  );
}
