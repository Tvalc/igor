// Lists tools due for re-verification: stale last_verified dates and open needs_verification fields.
// Usage: node scripts/stale-report.mjs [maxAgeDays=30]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const TOOLS = 'src/content/tools';
const maxAge = Number(process.argv[2] ?? 30);
const now = Date.now();
const rows = [];

for (const f of readdirSync(TOOLS).filter((f) => f.endsWith('.yaml'))) {
  const t = parse(readFileSync(join(TOOLS, f), 'utf8'));
  if (t.status === 'discontinued') continue;
  const age = Math.floor((now - new Date(t.last_verified).valueOf()) / 86_400_000);
  const pending = t.needs_verification ?? [];
  if (age > maxAge || pending.length) rows.push({ slug: f.replace(/\.yaml$/, ''), age, pending });
}

rows.sort((a, b) => b.age - a.age || b.pending.length - a.pending.length);
console.log(`# Verification queue (${rows.length} tools)\n`);
console.log('| Tool | Days since verified | Pending fields |');
console.log('|---|---|---|');
for (const r of rows) console.log(`| ${r.slug} | ${r.age} | ${r.pending.join(', ') || '—'} |`);
