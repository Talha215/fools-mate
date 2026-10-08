import Header from './components/Header.jsx';
import GamePage from './pages/Game.jsx';
import Games from './pages/Games.jsx';
import Home from './pages/Home.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import ReplayPage from './pages/Replay.jsx';
import { Link, usePath } from './lib/router.jsx';
import { Toaster } from './lib/toast.jsx';
import { SOURCE_URL } from './config.js';

export default function App() {
  const path = usePath();
  let page;
  let m;
  if ((m = path.match(/^\/game\/([A-Za-z0-9]+)\/?$/))) page = <GamePage key={m[1]} id={m[1]} />;
  else if ((m = path.match(/^\/replay\/([A-Za-z0-9]+)\/?$/))) page = <ReplayPage key={m[1]} id={m[1]} />;
  else if (path === '/leaderboard') page = <Leaderboard />;
  else if (path === '/games') page = <Games />;
  else if (path === '/') page = <Home />;
  else {
    page = (
      <div className="page-msg">
        <p>That square is empty.</p>
        <Link className="btn btn-primary" to="/">Back to the lobby</Link>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="site-main">{page}</main>
      <footer className="site-footer">
        <span>Fool's Mate</span>
        <span>Board: chessground (lichess.org)</span>
        <span>Pieces: Colin M.L. Burnett</span>
        {SOURCE_URL ? <a href={SOURCE_URL}>Source code (GPL-3.0)</a> : <span>Free software, GPL-3.0</span>}
      </footer>
      <Toaster />
    </>
  );
}
