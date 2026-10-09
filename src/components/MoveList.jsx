import { useEffect, useRef } from 'react';

// Scoresheet: number | white | black, with annotation marks ("!", "??")
// after moves and notes printed under the row they belong to. A flat list of
// cells, so CSS can make it a grid on desktop and a scrolling strip on phones.
// startPly: moves before it (Gary v Gary in the daily) are printed muted.
export default function MoveList({ plies, current, onSelect, marks, notes, footer, empty, startPly = 0 }) {
  const box = useRef(null);

  useEffect(() => {
    const el = box.current?.querySelector('.mv.active');
    const b = box.current;
    if (!el || !b) return;
    // Scroll only the list, never the page (scrollIntoView would on phones).
    if (b.scrollHeight > b.clientHeight) {
      const top = el.offsetTop - b.offsetTop;
      if (top < b.scrollTop || top + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = top - b.clientHeight / 2;
    }
    if (b.scrollWidth > b.clientWidth) b.scrollLeft = el.offsetLeft - b.offsetLeft - b.clientWidth / 2 + el.offsetWidth / 2;
  }, [current, plies.length]);

  const cells = [];
  for (let i = 0; i < plies.length; i += 2) {
    cells.push(<span key={`n${i}`} className="mv-num">{i / 2 + 1}.</span>);
    for (const j of [i, i + 1]) {
      if (!plies[j]) {
        cells.push(<span key={`e${j}`} className="mv mv-empty" />);
        continue;
      }
      const mark = marks?.get(j);
      cells.push(
        <button key={j} type="button" className={`mv${j < startPly ? ' pre' : ''}${current === j ? ' active' : ''}`} onClick={() => onSelect(j)}>
          {plies[j].san}
          {mark && <span className={`mark${mark === '??' ? ' bad' : ''}`}>{mark}</span>}
        </button>,
      );
    }
    for (const j of [i, i + 1]) {
      const note = notes?.get(j);
      if (note) cells.push(<p key={`c${j}`} className="mv-note">{note}</p>);
    }
  }

  return (
    <div className="moves" ref={box}>
      {cells.length ? cells : <p className="moves-empty">{empty}</p>}
      {footer && <div className="moves-footer">{footer}</div>}
    </div>
  );
}
