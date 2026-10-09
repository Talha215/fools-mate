import Header from './components/Header.jsx';
import Archive from './pages/Archive.jsx';
import Classic from './pages/Classic.jsx';
import Endless from './pages/Endless.jsx';
import GamePage from './pages/Game.jsx';
import Home from './pages/Home.jsx';
import ReplayPage from './pages/Replay.jsx';
import Standings from './pages/Standings.jsx';
import { Link, usePath } from './lib/router.jsx';
import { Toaster } from './lib/toast.jsx';
import { SOURCE_URL } from './config.js';

export default function App() {
  const path = usePath();
  let page;
  let m;
  if ((m = path.match(/^\/game\/([A-Za-z0-9]+)\/?$/))) page = <GamePage key={m[1]} id={m[1]} />;
  else if ((m = path.match(/^\/replay\/([A-Za-z0-9]+)\/?$/))) page = <ReplayPage key={m[1]} id={m[1]} />;
  // /leaderboard and /games were the original names; old links still work.
  else if (path === '/standings' || path === '/leaderboard') page = <Standings />;
  else if (path === '/archive' || path === '/games') page = <Archive />;
  // The front page is the Daily; /daily still works as a link to it.
  else if (path === '/' || path === '/daily') page = <Home />;
  else if (path === '/endless') page = <Endless />;
  else if (path === '/classic') page = <Classic />;
  else {
    page = (
      <div className="page-msg">
        <p>There's no page here.</p>
        <Link className="btn" to="/">Front page</Link>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="site-main">{page}</main>
      <footer className="colophon">
        <p>
          Set in Old Standard and Courier Prime. The board is chessground, from lichess.org; the pieces were drawn by
          Colin M.L. Burnett. {SOURCE_URL ? <a href={SOURCE_URL}>Source code</a> : 'Source code'} under the GNU GPL.
        </p>
      </footer>
      <Toaster />
    </>
  );
}
