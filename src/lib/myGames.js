// Games started on this device. The token is what proves you're the player;
// it never leaves this browser except to make your own moves.
import { load, save } from './storage.js';

const KEY = 'fm.games';
const MAX = 100;

export function rememberGame(id, token) {
  const list = load(KEY, []).filter((g) => g.id !== id);
  list.unshift({ id, token, at: Date.now() });
  save(KEY, list.slice(0, MAX));
}

export const tokenFor = (id) => load(KEY, []).find((g) => g.id === id)?.token ?? null;

export const myGameIds = () => load(KEY, []).map((g) => g.id);
