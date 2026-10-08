import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installPieceStyles } from './lib/pieces.jsx';
import { installAudioUnlock } from './lib/sound.js';
import 'chessground/assets/chessground.base.css';
import './styles/app.css';

installPieceStyles();
installAudioUnlock();
createRoot(document.getElementById('root')).render(<App />);
