import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installPieceStyles } from './lib/pieces.jsx';
import { installAudioUnlock } from './lib/sound.js';
import '@fontsource/old-standard-tt/400.css';
import '@fontsource/old-standard-tt/400-italic.css';
import '@fontsource/old-standard-tt/700.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/400-italic.css';
import '@fontsource/courier-prime/700.css';
import 'chessground/assets/chessground.base.css';
import './styles/app.css';

installPieceStyles();
installAudioUnlock();
createRoot(document.getElementById('root')).render(<App />);
