import { useState } from 'react';
import Modal from './Modal.jsx';
import { BOT } from '../../shared/bot.js';
import { REASONS, formatDuration } from '../lib/chess.js';
import { api } from '../api.js';
import { updateSettings } from '../lib/settings.js';
import { toast } from '../lib/toast.jsx';
import { IconLink, IconPlus, IconReplay } from './Icons.jsx';
import { pct } from '../lib/mateStats.js';
import { Link } from '../lib/router.jsx';

export function resultCopy(game) {
  const n = game.playerMoves;
  switch (game.result) {
    case 'mated':
      return { tone: 'win', title: 'You lost!', line: `Checkmated in ${n} move${n === 1 ? '' : 's'}. Magnificent.` };
    case 'won':
      return { tone: 'loss', title: 'Oops. You won.', line: `You checkmated ${BOT.name}. That's the opposite of the assignment.` };
    case 'draw':
      return { tone: 'loss', title: 'Draw.', line: `Drawn ${REASONS[game.reason] || ''}. Nobody lost, least of all you.` };
    case 'resigned':
      return { tone: 'loss', title: 'You gave up.', line: 'Losing is hard. Even against this bot.' };
    default:
      return { tone: '', title: 'Game over', line: '' };
  }
}

export default function EndModal({ open, game, token, finalOdds, closeCalls, onClose, onGame, onPlayAgain, busy }) {
  const copy = resultCopy(game);
  const [name, setName] = useState(game.name === 'Anonymous' ? '' : game.name);
  const [saving, setSaving] = useState(false);
  const success = game.result === 'mated';

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

  const link = `${location.origin}/replay/${game.id}`;
  return (
    <Modal open={open} onClose={onClose} className={`end-modal ${copy.tone}`}>
      <div className="end-emoji" aria-hidden="true">{success ? '🏆' : game.result === 'won' ? '😬' : '🫠'}</div>
      <h2 className="end-title">{copy.title}</h2>
      <p className="end-line">{copy.line}</p>

      {success && (
        <div className="end-stats">
          <div><b>{game.playerMoves}</b><span>moves</span></div>
          <div><b>#{game.rank}</b><span>all-time</span></div>
          <div><b>{formatDuration(game.durationMs)}</b><span>time</span></div>
        </div>
      )}
      {success && finalOdds && (
        <p className="end-note">
          {BOT.name} found a {finalOdds.mates}-in-{finalOdds.total} shot ({pct(finalOdds.mates / finalOdds.total)}).
          {closeCalls > 0 && ` It had already fumbled ${closeCalls} mate${closeCalls === 1 ? '' : 's'} before that.`}
        </p>
      )}
      {!success && closeCalls > 0 && (
        <p className="end-note">
          {BOT.name} had you mated {closeCalls} time{closeCalls === 1 ? '' : 's'} and looked the other way.
        </p>
      )}

      {success && (
        <form className="end-name" onSubmit={saveName}>
          <label htmlFor="end-name">Name on the leaderboard</label>
          <div className="end-name-row">
            <input id="end-name" value={name} maxLength={20} placeholder="Anonymous" onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="btn" disabled={saving || name.trim() === game.name}>
              Save
            </button>
          </div>
        </form>
      )}

      <div className="end-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onPlayAgain} disabled={busy}>
          <IconPlus /> Play again
        </button>
        <div className="end-actions-row">
          <Link className="btn" to={`/replay/${game.id}`}>
            <IconReplay /> Replay
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Replay link copied.'), () => toast(link))}
          >
            <IconLink /> Copy link
          </button>
        </div>
      </div>
    </Modal>
  );
}
