// React wrapper around chessground, lichess's board. chessground owns its DOM;
// React only pushes config changes into it.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Chessground } from 'chessground';
import { boardImage, THEMES, useSettings } from '../lib/settings.js';

const Board = forwardRef(function Board(
  { fen, orientation = 'white', turnColor, movableColor, dests, lastMove, check, premove = false, autoShapes, onMove, onPremoveSet, children },
  ref,
) {
  const el = useRef(null);
  const cg = useRef(null);
  const appliedFen = useRef(null);
  const handlers = useRef({});
  handlers.current = { onMove, onPremoveSet };
  const { theme, coords } = useSettings();

  useEffect(() => {
    cg.current = Chessground(el.current, {
      fen,
      orientation,
      coordinates: coords,
      animation: { enabled: true, duration: 220 },
      highlight: { lastMove: true, check: true },
      movable: {
        free: false,
        showDests: true,
        rookCastle: false,
        events: { after: (orig, dest, meta) => handlers.current.onMove?.(orig, dest, meta) },
      },
      premovable: {
        enabled: false,
        showDests: true,
        events: { set: () => handlers.current.onPremoveSet?.() },
      },
      draggable: { enabled: true, showGhost: true },
      // Right-click drag = arrow, right-click = circle. Shift/Ctrl, Alt and
      // Shift+Alt switch to red, blue and yellow, like lichess.
      drawable: { enabled: true, visible: true, eraseOnClick: true, defaultSnapToValidMove: true },
      disableContextMenu: true,
    });
    appliedFen.current = fen;
    return () => cg.current?.destroy();
    // chessground is created once; later prop changes go through set() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    playPremove: () => cg.current?.playPremove(),
    cancelPremove: () => cg.current?.cancelPremove(),
    setPosition: (nextFen, nextLastMove) => {
      appliedFen.current = nextFen;
      cg.current?.set({ fen: nextFen, lastMove: nextLastMove });
    },
  }));

  useEffect(() => {
    const config = {
      orientation,
      turnColor,
      lastMove,
      check,
      movable: { color: movableColor, dests: dests || new Map() },
      premovable: { enabled: premove },
    };
    // Re-setting the fen makes chessground clear drawn arrows, so only send it
    // when the position actually changed.
    if (fen !== appliedFen.current) {
      config.fen = fen;
      appliedFen.current = fen;
    }
    cg.current?.set(config);
  }, [fen, orientation, turnColor, movableColor, dests, lastMove, check, premove]);

  // Programmatic arrows (the home page demo); user-drawn ones are separate.
  useEffect(() => {
    cg.current?.setAutoShapes(autoShapes || []);
  }, [autoShapes]);

  useEffect(() => {
    if (!cg.current) return;
    cg.current.set({ coordinates: coords });
    cg.current.redrawAll();
  }, [coords]);

  const t = THEMES[theme] || THEMES.brown;
  return (
    <div
      className="board-box"
      style={{ '--sq-light': t.light, '--sq-dark': t.dark, '--last-move': t.last, '--board-img': boardImage(theme) }}
    >
      <div ref={el} className="board" />
      {children}
    </div>
  );
});

export default Board;
