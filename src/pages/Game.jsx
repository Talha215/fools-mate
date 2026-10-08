import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { matingMoves, playUci, replay, START_FEN } from '../../shared/rules.js';
import Board from '../components/Board.jsx';
import ChessLayout from '../components/ChessLayout.jsx';
import PlayerBar from '../components/PlayerBar.jsx';
import MoveList from '../components/MoveList.jsx';
import NavControls from '../components/NavControls.jsx';
import PromotionDialog from '../components/PromotionDialog.jsx';
import EndModal, { resultCopy } from '../components/EndModal.jsx';
import { BotAvatar, PlayerAvatar } from '../components/Avatars.jsx';
import { IconFlag, IconLink, IconPlus, IconReplay, IconTrophy } from '../components/Icons.jsx';
import { cgColor, checkColor, isPromotion, legalDests, material, other, turnOf } from '../lib/chess.js';
import { confetti } from '../lib/confetti.js';
import { pct, useMateStats } from '../lib/mateStats.js';
import { rememberGame, tokenFor } from '../lib/myGames.js';
import { quip } from '../lib/quips.js';
import { Link, navigate } from '../lib/router.jsx';
import { useSettings } from '../lib/settings.js';
import { playSound, soundForMove } from '../lib/sound.js';
import { toast } from '../lib/toast.jsx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const END_QUIP = { mated: 'botWins', won: 'playerWins', draw: 'draw', resigned: 'resign' };

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
        <Link className="btn btn-primary" to="/">Back to the lobby</Link>
      </div>
    );
  }
  if (!state.game) return <div className="page-msg">Setting up the pieces…</div>;
  return <GameView initial={state.game} token={token} />;
}

function GameView({ initial, token }) {
  const settings = useSettings();
  const [game, setGame] = useState(initial);
  const [pending, setPending] = useState(null); // the player's move (UCI), until the server answers
  const [view, setView] = useState(null); // ply being browsed; null = live position
  const [orientation, setOrientation] = useState(cgColor(initial.playerColor));
  const [promo, setPromo] = useState(null);
  const [bubble, setBubble] = useState(() =>
    initial.status === 'finished' ? quip(END_QUIP[initial.result]) : initial.ply <= 1 ? quip('hello') : 'Where were we?',
  );
  const [odds, setOdds] = useState(null); // { mates, total, phase: 'thinking' | 'done', hit }
  const [endOpen, setEndOpen] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [busy, setBusy] = useState(false);
  // A fresh game as Black: show the empty board first, then the bot's opening move.
  const [intro, setIntro] = useState(
    () => initial.playerColor === 'b' && initial.ply === 1 && Date.now() - initial.createdAt < 15000,
  );
  const boardRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const playerColor = game.playerColor;
  const botColor = other(playerColor);
  const active = game.status === 'active';

  const moves = useMemo(() => (intro ? [] : pending ? [...game.moves, pending] : game.moves), [intro, pending, game.moves]);
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
  const stats = useMateStats(plies, botColor);
  const playerMoves = plies.filter((p) => p.color === playerColor).length;

  useEffect(() => {
    if (initial.status === 'active' && initial.ply <= 1) playSound('start');
  }, [initial]);

  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => {
      setIntro(false);
      playSound('move');
    }, 650);
    return () => clearTimeout(t);
  }, [intro]);

  // A premove queued while the bot was "thinking" fires as soon as it's our
  // turn. Board's own effect (a child, so it runs first) has already handed
  // chessground the new legal moves by now.
  useEffect(() => {
    if (myTurn) boardRef.current?.playPremove();
  }, [myTurn]);

  useEffect(() => {
    document.title = myTurn ? "Your turn · Fool's Mate" : "Fool's Mate";
    return () => void (document.title = "Fool's Mate");
  }, [myTurn]);

  const finish = useCallback((g, afterBotMove) => {
    setBubble(quip(END_QUIP[g.result]));
    setTimeout(() => {
      if (!alive.current) return;
      if (g.result === 'mated') {
        playSound('success');
        confetti();
      } else if (g.result !== 'resigned') {
        playSound('fail');
      }
      setEndOpen(true);
    }, afterBotMove ? 700 : 450);
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
    const over = chess.isGameOver();
    const o = over ? null : matingMoves(afterFen);
    setOdds(o ? { ...o, phase: 'thinking' } : null);
    if (!over) setBubble(quip(chess.inCheck() ? 'inCheck' : 'thinking'));

    const started = performance.now();
    const ply = game.ply;
    try {
      const { game: next } = await api.move(game.id, token, ply, uci);
      const botMoved = next.moves.length === ply + 2;
      // The server answers instantly; the pause is theatre. Longer when a mate
      // is on the table, for suspense.
      const pause = botMoved ? 320 + Math.random() * 420 + (o?.mates ? 750 : 0) : 100;
      await sleep(Math.max(0, pause - (performance.now() - started)));
      if (!alive.current) return;
      setGame(next);
      setPending(null);
      if (botMoved) {
        const c = new Chess(afterFen);
        const bm = playUci(c, next.moves[next.moves.length - 1]);
        if (bm) {
          playSound(soundForMove(bm, c.inCheck()));
          setBubble(quip(botQuipKind(next, bm, c, o, afterFen)));
        }
        setOdds(o ? { ...o, phase: 'done', hit: next.result === 'mated' } : null);
      }
      if (next.status === 'finished') finish(next, botMoved);
    } catch (err) {
      if (!alive.current) return;
      setPending(null);
      setOdds(null);
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
      finish(g, false);
    } catch (e) {
      toast(e.message);
    }
  }

  async function playAgain() {
    setBusy(true);
    try {
      const color = settings.color === 'w' || settings.color === 'b' ? settings.color : undefined;
      const { game: g, token: t } = await api.createGame(color, settings.name);
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
        avatar={<PlayerAvatar name={game.name} />}
        name={game.name}
        tag="You"
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
        avatar={<BotAvatar />}
        name={BOT.name}
        tag={BOT.rating}
        material={mat}
        active={active && sideToMove === side}
        status={(pending || intro) && active ? <Thinking /> : null}
      />
    );
  const topSide = orientation === 'white' ? 'b' : 'w';
  const copy = resultCopy(game);

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
            // re-renders with the bot to move.
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
                Viewing move {Math.floor(view / 2) + 1}. Back to the game →
              </button>
            )}
          </Board>
        }
        side={
          <div className="side-card">
            <div className="bot-chat">
              <BotAvatar size={44} />
              <div className="bubble" key={bubble}>{bubble}</div>
            </div>
            {settings.odds && <OddsStrip odds={odds} stats={stats} active={active} />}
            <MoveList
              plies={plies}
              current={shown}
              onSelect={go}
              empty={!active ? 'No moves were played.' : playerColor === 'w' ? 'Your move. Try to lose quickly.' : `${BOT.name} is choosing an opening…`}
              footer={!active && (
                <>
                  <div className="result-score">{scoreline(game)}</div>
                  <div className={`result-text ${copy.tone}`}>{copy.title}</div>
                </>
              )}
            />
            <NavControls ply={shown} last={lastIdx} onGo={go} onFlip={flip} />
            <div className={`side-actions${active ? '' : ' finished'}`}>
              {active ? (
                confirmResign ? (
                  <div className="confirm-row">
                    <span>Give up on losing?</span>
                    <button type="button" className="btn btn-danger" onClick={resign}>Yes</button>
                    <button type="button" className="btn" onClick={() => setConfirmResign(false)}>No</button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmResign(true)}>
                    <IconFlag /> Give up
                  </button>
                )
              ) : (
                <>
                  <button type="button" className="btn btn-primary" onClick={playAgain} disabled={busy}>
                    <IconPlus /> Play again
                  </button>
                  <Link className="btn" to={`/replay/${game.id}`}>
                    <IconReplay /> Replay
                  </Link>
                  {game.result === 'mated' && (
                    <Link className="btn" to="/leaderboard">
                      <IconTrophy /> #{game.rank}
                    </Link>
                  )}
                  <button
                    type="button"
                    className="btn icon-only"
                    title="Copy replay link"
                    onClick={() => {
                      const link = `${location.origin}/replay/${game.id}`;
                      navigator.clipboard?.writeText(link).then(() => toast('Replay link copied.'), () => toast(link));
                    }}
                  >
                    <IconLink />
                  </button>
                </>
              )}
            </div>
          </div>
        }
      />
      {game.status === 'finished' && (
        <EndModal
          open={endOpen}
          game={game}
          token={token}
          finalOdds={odds?.hit ? odds : null}
          closeCalls={stats.closeCalls}
          onClose={() => setEndOpen(false)}
          onGame={(g) => setGame(g)}
          onPlayAgain={playAgain}
          busy={busy}
        />
      )}
    </>
  );
}

function botQuipKind(next, bm, chess, odds, fenBefore) {
  if (next.result === 'mated') return 'botWins';
  if (odds?.mates) return 'missedMate';
  if (bm.promotion) return bm.promotion === 'q' ? 'promote' : 'underpromote';
  if (chess.inCheck()) return 'check';
  if (bm.captured) return 'capture';
  if (bm.san.startsWith('O-O')) return 'castle';
  if (new Chess(fenBefore).moves({ verbose: true }).some((m) => m.captured === 'q')) return 'ignoredQueen';
  return 'move';
}

export function scoreline(game) {
  if (game.result === 'draw') return '½–½';
  const winner = game.result === 'won' ? game.playerColor : other(game.playerColor);
  return winner === 'w' ? '1–0' : '0–1';
}

export function Thinking() {
  return (
    <span className="thinking" aria-label="thinking">
      <i />
      <i />
      <i />
    </span>
  );
}

function OddsStrip({ odds, stats, active }) {
  const p = odds?.total ? odds.mates / odds.total : 0;
  let text;
  if (odds?.phase === 'thinking') {
    text = odds.mates ? (
      <><b>{odds.mates}</b> of {odds.total} moves mate you. <b>{pct(p)}</b></>
    ) : (
      <>None of its {odds.total} moves mate you.</>
    );
  } else if (odds?.phase === 'done') {
    text = odds.hit ? (
      <>It found the mate! <b>{odds.mates}/{odds.total}</b></>
    ) : odds.mates ? (
      <>Missed it! <b>{odds.mates}/{odds.total}</b> moves were mate.</>
    ) : (
      <>No mate was available.</>
    );
  } else {
    text = active ? <>Make a move. Then hope.</> : <>Game over.</>;
  }
  return (
    <div className={`odds${odds?.mates ? ' hot' : ''}${odds?.phase === 'done' && odds.mates && !odds.hit ? ' missed' : ''}`}>
      <div className="odds-head">
        <span>Mate chance</span>
        <span className="odds-meta">
          Close calls <b>{stats.closeCalls}</b> · Best <b>{pct(stats.bestOdds)}</b>
        </span>
      </div>
      <div className="odds-bar">
        <span style={{ width: `${odds?.mates ? Math.max(3, p * 100) : 0}%` }} />
      </div>
      <div className="odds-text">{text}</div>
    </div>
  );
}
