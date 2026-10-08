import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { BOT } from '../../shared/bot.js';
import { REASONS, scoreline } from '../lib/chess.js';
import { ordinal, word } from '../lib/annotate.js';
import { api } from '../api.js';
import { Link } from '../lib/router.jsx';
import { updateSettings } from '../lib/settings.js';
import { playSound } from '../lib/sound.js';
import { toast } from '../lib/toast.jsx';

const STAMPS = { mated: 'Checkmated', won: 'Void', draw: 'Drawn', resigned: 'Resigned' };
const plural = (n, s) => `${word(n)} ${s}${n === 1 ? '' : 's'}`;

// The result, typed on a slip and rubber-stamped.
export default function ResultSlip({ open, game, token, finalOdds, closeCalls, onClose, onGame, onPlayAgain, busy }) {
  const [name, setName] = useState(game.name === 'Anonymous' ? '' : game.name);
  const [saving, setSaving] = useState(false);
  const success = game.result === 'mated';
  const white = game.playerColor === 'w' ? game.name : BOT.name;
  const black = game.playerColor === 'w' ? BOT.name : game.name;

  useEffect(() => {
    if (!open) return;
    // Timed to the stamp landing (see .stamp animation).
    const t1 = setTimeout(() => playSound('stamp'), 230);
    const t2 = success ? setTimeout(() => playSound('bell'), 480) : null;
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, success]);

  async function saveName(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { game: g } = await api.rename(game.id, token, name);
      updateSettings({ name: g.name === 'Anonymous' ? '' : g.name });
      onGame(g);
      toast('Name saved.');
    } catch (err) {
      toast(err.message);
    } finally {
      setSaving(false);
    }
  }

  const lines = [];
  if (success) {
    lines.push(`Checkmated in ${plural(game.playerMoves, 'move')}.`);
    if (game.playerMoves === 2) lines.push('That is the shortest game possible.');
    if (finalOdds) {
      const n = finalOdds.pool.length;
      lines.push(
        n === 1
          ? `${BOT.name}'s only check was mate.`
          : `${BOT.name} had ${word(n)} checks to choose from, and ${finalOdds.mates === 1 ? 'one was' : `${word(finalOdds.mates)} were`} mate.`,
      );
    }
    if (closeCalls) lines.push(`Before that, ${BOT.name} missed ${plural(closeCalls, 'mate')}.`);
  } else {
    if (game.result === 'won') lines.push(`You checkmated ${BOT.name}. It doesn't count.`);
    if (game.result === 'draw') lines.push(`Drawn ${REASONS[game.reason] || ''}. It doesn't count.`);
    if (game.result === 'resigned') lines.push('You resigned.');
    if (closeCalls) lines.push(`${BOT.name} missed ${plural(closeCalls, 'mate')} along the way.`);
  }

  const link = `${location.origin}/replay/${game.id}`;
  return (
    <Modal open={open} onClose={onClose} className="slip">
      <div className="slip-label">Result</div>
      <div className="slip-score">
        <span>{white} v {black}</span>
        <b>{scoreline(game)}</b>
      </div>
      <div className="slip-body">
        {lines.map((l) => <p key={l}>{l}</p>)}
        {success && game.rank && <p>{ordinal(game.rank)} in the standings.</p>}
      </div>
      <div className={`stamp ${success ? 'red' : ''}`} aria-hidden="true">{STAMPS[game.result]}</div>

      {success && (
        <form className="slip-name" onSubmit={saveName}>
          <label htmlFor="slip-name">Name for the standings</label>
          <div className="slip-name-row">
            <input id="slip-name" value={name} maxLength={20} placeholder="Anonymous" onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="btn" disabled={saving || name.trim() === game.name}>Save</button>
          </div>
        </form>
      )}

      <div className="slip-actions">
        <button type="button" className="btn btn-ink" onClick={onPlayAgain} disabled={busy}>Play again</button>
        <Link className="btn" to={`/replay/${game.id}`}>Replay</Link>
        <button
          type="button"
          className="btn"
          onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copied.'), () => toast(link))}
        >
          Copy link
        </button>
      </div>
    </Modal>
  );
}
