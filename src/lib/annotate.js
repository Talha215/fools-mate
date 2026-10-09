import { useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { START_FEN } from '../../shared/rules.js';
import { garyOptions } from '../../shared/gary.js';
import { BOT } from '../../shared/bot.js';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const word = (n) => WORDS[n] ?? String(n);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// "7.Nf3" for White, "7…Qh4#" for Black.
export const moveLabel = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'}${san}`;

// Annotates a game the way a chess column would, from the loser-wins point
// of view: "??" on any move by Gary that skipped an available mate, "!" on
// the player move that offered it, "??" on a player move that mates Gary.
// Positions are cached, so a growing game only analyses the newest turn.
// startPly: daily games begin with Gary playing both sides; those moves
// aren't annotated, and a note marks where the player takes over.
export function useAnnotations(plies, playerColor, startPly = 0) {
  const cache = useRef(new Map());
  return useMemo(() => {
    const marks = new Map();
    const notes = new Map();
    let closeCalls = 0;
    const botColor = playerColor === 'w' ? 'b' : 'w';
    if (startPly > 0 && plies.length >= startPly) notes.set(startPly - 1, `${BOT.name} played both sides up to here.`);
    plies.forEach((p, i) => {
      if (i < startPly) return;
      if (p.color !== botColor) {
        if (p.san.endsWith('#')) {
          marks.set(i, '??');
          notes.set(i, `This checkmates ${BOT.name}, which doesn't count.`);
        }
        return;
      }
      const before = i === 0 ? START_FEN : plies[i - 1].fen;
      let r = cache.current.get(before);
      if (!r) {
        r = garyOptions(new Chess(before));
        cache.current.set(before, r);
      }
      if (!r.mates) return;
      if (i > 0) marks.set(i - 1, '!');
      // Past the random opening, mates are always checks, so Gary was choosing
      // between his checks; in the opening he was choosing between all moves.
      const n = r.pool.length;
      if (p.san.endsWith('#')) {
        const what = r.kind === 'check' ? 'checks' : 'moves';
        notes.set(i, n === 1 ? `The only ${what.slice(0, -1)} was mate.` : `${cap(word(r.mates))} of ${word(n)} ${what} mated here.`);
      } else {
        closeCalls++;
        marks.set(i, '??');
        // Per-square SAN can drop disambiguation; replay for the proper one.
        const m = r.mating[0];
        const first = moveLabel(i, new Chess(before).move({ from: m.from, to: m.to, promotion: m.promotion }).san);
        notes.set(i, r.mates === 1 ? `Missed ${first}.` : `Missed ${word(r.mates)} mates, ${first} among them.`);
      }
    });
    return { marks, notes, closeCalls };
  }, [plies, playerColor, startPly]);
}

// Standard PGN, with the annotations as NAG-style marks and {comments}, so a
// game can be pasted into lichess or any chess program.
export function toPgn(game, plies, marks, notes) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date(game.createdAt);
  const white = game.playerColor === 'w' ? game.name : BOT.name;
  const black = game.playerColor === 'w' ? BOT.name : game.name;
  const result = pgnResult(game);
  const tags = [
    ['Event', game.mode === 'daily' ? `Fool's Mate Daily No. ${game.dailyNumber}` : game.mode === 'endless' ? "Fool's Mate Endless" : "Fool's Mate"],
    ['Site', location.host],
    ['Date', `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`],
    ['White', white],
    ['Black', black],
    ['Result', result],
  ];
  const tokens = [];
  plies.forEach((p, i) => {
    const n = Math.floor(i / 2) + 1;
    if (i % 2 === 0) tokens.push(`${n}.`);
    else if (i === 0 || notes.has(i - 1)) tokens.push(`${n}...`);
    tokens.push(p.san + (marks.get(i) || ''));
    if (notes.has(i)) tokens.push(`{${notes.get(i)}}`);
  });
  tokens.push(result);
  const lines = [];
  let line = '';
  for (const t of tokens) {
    if (line && line.length + t.length + 1 > 79) {
      lines.push(line);
      line = t;
    } else line = line ? `${line} ${t}` : t;
  }
  if (line) lines.push(line);
  return { tags: tags.map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`).join('\n'), text: lines.join('\n') };
}

export function pgnResult(game) {
  if (game.status === 'active') return '*';
  if (game.result === 'draw') return '1/2-1/2';
  const winner = game.result === 'won' ? game.playerColor : game.playerColor === 'w' ? 'b' : 'w';
  return winner === 'w' ? '1-0' : '0-1';
}

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
