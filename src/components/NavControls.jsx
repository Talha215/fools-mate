import { useEffect } from 'react';
import { IconFirst, IconFlip, IconLast, IconNext, IconPause, IconPlay, IconPrev } from './Icons.jsx';

// ⏮ ◀ ▶ ⏭ under the move list, plus keyboard: ←/→, ↑/Home, ↓/End, F to flip.
// `ply` is the shown position: -1 = start, plies-1 = latest.
export default function NavControls({ ply, last, onGo, onFlip, playing, onTogglePlay }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const map = { ArrowLeft: ply - 1, ArrowRight: ply + 1, ArrowUp: -1, Home: -1, ArrowDown: last, End: last };
      if (e.key in map) {
        e.preventDefault();
        onGo(Math.max(-1, Math.min(last, map[e.key])));
      } else if (e.key === 'f' || e.key === 'F') {
        onFlip();
      } else if (e.key === ' ' && onTogglePlay) {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ply, last, onGo, onFlip, onTogglePlay]);

  return (
    <div className="nav-controls">
      <button type="button" className="icon-btn" title="Flip board (F)" onClick={onFlip}><IconFlip /></button>
      <button type="button" className="icon-btn" title="First move (↑)" disabled={ply <= -1} onClick={() => onGo(-1)}><IconFirst /></button>
      <button type="button" className="icon-btn" title="Previous move (←)" disabled={ply <= -1} onClick={() => onGo(ply - 1)}><IconPrev /></button>
      {onTogglePlay && (
        <button type="button" className="icon-btn" title="Autoplay (space)" onClick={onTogglePlay}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
      )}
      <button type="button" className="icon-btn" title="Next move (→)" disabled={ply >= last} onClick={() => onGo(ply + 1)}><IconNext /></button>
      <button type="button" className="icon-btn" title="Last move (↓)" disabled={ply >= last} onClick={() => onGo(last)}><IconLast /></button>
    </div>
  );
}
