// Finds daily dates whose position allows a forced 1-move loss and picks a
// clean alternate seed for each. Paste the output into RESEED in
// shared/daily.js (and bump CHECKED_UNTIL).
//   .\run node scripts\check-dailies.mjs 2031-12-31
import { Chess } from 'chess.js';
import { DAILY_EPOCH, forcedLossInOne, positionFromSeed } from '../shared/daily.js';

const until = process.argv[2] || '2031-12-31';
const reseed = {};
for (let t = Date.parse(`${DAILY_EPOCH}T00:00:00Z`); t <= Date.parse(`${until}T00:00:00Z`); t += 86400000) {
  const date = new Date(t).toISOString().slice(0, 10);
  for (let n = 0; ; n++) {
    const pos = positionFromSeed(`fools-mate daily ${date}${n ? ` #${n}` : ''}`);
    if (!forcedLossInOne(new Chess(pos.fen))) {
      if (n) reseed[date] = n;
      break;
    }
  }
}
console.log(`export const RESEED = ${JSON.stringify(reseed, null, 2).replace(/"(\d{4}-\d\d-\d\d)"/g, "'$1'")};`);
console.log(`export const CHECKED_UNTIL = '${until}';`);
