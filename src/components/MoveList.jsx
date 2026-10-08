import { useEffect, useRef } from 'react';

// Lichess-style move table: number | white | black. It's a flat list of cells
// so CSS can lay it out as a grid on desktop and a scrolling strip on phones.
export default function MoveList({ plies, current, onSelect, footer, empty = 'No moves yet.' }) {
  const box = useRef(null);

  useEffect(() => {
    const el = box.current?.querySelector('.mv.active');
    if (!el || !box.current) return;
    // Scroll only the list, never the page (scrollIntoView would on phones).
    const b = box.current;
    if (b.scrollHeight > b.clientHeight) {
      const top = el.offsetTop - b.offsetTop;
      if (top < b.scrollTop || top + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = top - b.clientHeight / 2;
    }
    if (b.scrollWidth > b.clientWidth) {
      const left = el.offsetLeft - b.offsetLeft;
      b.scrollLeft = left - b.clientWidth / 2 + el.offsetWidth / 2;
    }
  }, [current, plies.length]);

  const cells = [];
  for (let i = 0; i < plies.length; i += 2) {
    cells.push(<span key={`n${i}`} className="mv-num">{i / 2 + 1}</span>);
    for (const j of [i, i + 1]) {
      if (plies[j]) {
        cells.push(
          <button key={j} type="button" className={`mv${current === j ? ' active' : ''}`} onClick={() => onSelect(j)}>
            {plies[j].san}
          </button>,
        );
      } else {
        cells.push(<span key={`e${j}`} className="mv mv-empty" />);
      }
    }
  }

  return (
    <div className="moves" ref={box}>
      {cells.length ? cells : <div className="moves-empty">{empty}</div>}
      {footer && <div className="moves-footer">{footer}</div>}
    </div>
  );
}
