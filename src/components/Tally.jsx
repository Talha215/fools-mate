import { BOT } from '../../shared/bot.js';
import { word } from '../lib/annotate.js';

// Gary's options as tally marks: one stroke per legal move, red if it would
// checkmate you, and the one he actually picked circled once he's moved.
// data: { legal, mating, mates, total, phase: 'thinking' | 'done', picked, pickedLabel }
export default function Tally({ data }) {
  if (!data) {
    return (
      <div className="tally idle">
        <div className="tally-head">{BOT.name}'s options</div>
        <p className="tally-text">Each mark is one of {BOT.name}'s legal moves. Red ones would checkmate you.</p>
      </div>
    );
  }
  const mating = new Set(data.mating);
  let text;
  if (data.phase === 'thinking') {
    text = data.mates
      ? `${word(data.mates)[0].toUpperCase()}${word(data.mates).slice(1)} of these ${data.total} would mate you.`
      : `None of these ${data.total} mate you.`;
  } else {
    text = `${BOT.name} played ${data.pickedLabel}.`;
    if (data.mates && !mating.has(data.picked)) text += data.mates === 1 ? ' The red one was mate.' : ' The red ones were mate.';
  }
  return (
    <div className={`tally ${data.phase}`}>
      <div className="tally-head">
        {BOT.name}'s options
        <span>{data.mates} of {data.total} mate</span>
      </div>
      <div className="tally-marks" aria-hidden="true">
        {data.legal.map((san, i) => (
          <i
            key={i}
            className={`${mating.has(san) ? 'mate' : ''}${data.phase === 'done' && data.picked === san ? ' picked' : ''}`}
            style={{ '--tilt': `${((i * 37) % 9) - 4}deg` }}
            title={san}
          />
        ))}
      </div>
      <p className="tally-text">{text}</p>
    </div>
  );
}
