import { BOT } from '../../shared/bot.js';
import { word } from '../lib/annotate.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// The moves Gary is choosing between, as tally marks: only his checks when he
// has any, otherwise the moves that bring a piece toward your king. Red marks
// are mate; once he's moved, the one he picked is circled.
// data: garyOptions(...) plus { phase: 'thinking' | 'done', picked (uci), pickedLabel }
export default function Tally({ data }) {
  if (!data) {
    return (
      <div className="tally idle">
        <div className="tally-head">{BOT.name}'s options</div>
        <p className="tally-text">
          Each mark is a move {BOT.name} might play. When {BOT.name} can give check, only the checks count. Red ones
          are mate.
        </p>
      </div>
    );
  }
  const n = data.pool.length;
  const checks = data.kind === 'check';
  let text;
  if (data.phase === 'thinking') {
    if (data.kind === 'opening') {
      text = `${BOT.name}'s first three moves are random. `;
      text += data.mates ? `${cap(word(data.mates))} of these ${n} ${data.mates === 1 ? 'is' : 'are'} mate.` : 'None of these is mate.';
    } else if (checks && n === 1) text = data.mates ? `${BOT.name}'s only check is mate.` : `${BOT.name} has one check, and it isn't mate.`;
    else if (checks) text = data.mates ? `${cap(word(data.mates))} of these ${n} checks ${data.mates === 1 ? 'is' : 'are'} mate.` : `None of these ${n} checks is mate.`;
    else if (data.kind === 'charge') text = `No checks, so ${BOT.name} will move one of these ${n} toward your king.`;
    else text = `No checks, and nothing can get closer to your king, so any of these ${n} will do.`;
  } else {
    text = `${BOT.name} played ${data.pickedLabel}.`;
    const missed = data.mates && !data.mating.some((m) => m.uci === data.picked);
    if (missed) text += data.mates === 1 ? ' The red one was mate.' : ' The red ones were mate.';
  }
  return (
    <div className={`tally ${data.phase}`}>
      <div className="tally-head">
        {checks ? `${BOT.name}'s checks` : `${BOT.name}'s options`}
        <span>{checks || data.kind === 'opening' ? `${data.mates} of ${n} mate` : 'no checks'}</span>
      </div>
      <div className="tally-marks" aria-hidden="true">
        {data.pool.map((m, i) => (
          <i
            key={m.uci}
            className={`${m.mate ? 'mate' : ''}${data.phase === 'done' && data.picked === m.uci ? ' picked' : ''}`}
            style={{ '--tilt': `${((i * 37) % 9) - 4}deg` }}
            title={m.san}
          />
        ))}
      </div>
      <p className="tally-text">{text}</p>
    </div>
  );
}
