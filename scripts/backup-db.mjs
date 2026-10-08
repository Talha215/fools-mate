// Downloads a full copy of the live database (schema + data, as SQL) into
// backups\, keeping the newest 30. Cloudflare's Time Travel only reaches back
// 7 days on the free plan; these files don't expire.
//   .\run npm run backup
// `npm run deploy` runs this first, so each deploy has a snapshot from just
// before it. A failed backup stops the deploy. Restoring: see README.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP = 30;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'backups');
mkdirSync(dir, { recursive: true });

// fools-mate-2026-10-08-2215.sql (UTC), so names sort by time.
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const file = join(dir, `fools-mate-${stamp}.sql`);

const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const run = spawnSync(process.execPath, [wrangler, 'd1', 'export', 'DB', '--remote', '--skip-confirmation', '--output', file], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
if (run.status !== 0) {
  console.error('Backup failed: the database export did not complete.');
  process.exit(1);
}

// A dump without the games table is not a backup worth trusting.
const sql = readFileSync(file, 'utf8');
if (!/CREATE TABLE[^;]*\bgames\b/i.test(sql)) {
  console.error(`Backup looks wrong (no games table in it): ${file}`);
  process.exit(1);
}
const games = (sql.match(/INSERT INTO "?games"?[ (]/gi) || []).length;
console.log(`Backup saved: ${file} (${(statSync(file).size / 1024).toFixed(1)} KB, ${games} games)`);

const old = readdirSync(dir)
  .filter((f) => /^fools-mate-.*\.sql$/.test(f))
  .sort()
  .reverse()
  .slice(KEEP);
for (const f of old) unlinkSync(join(dir, f));
if (old.length) console.log(`Removed ${old.length} old backup(s); keeping the newest ${KEEP}.`);
