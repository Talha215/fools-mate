// Board column (player bar, board, player bar) beside a side panel. On phones
// it stacks, with the board edge to edge like the lichess mobile site.
export default function ChessLayout({ top, board, bottom, side }) {
  return (
    <div className="chess-layout">
      <div className="board-col">
        {top}
        {board}
        {bottom}
      </div>
      <aside className="side-col">{side}</aside>
    </div>
  );
}
