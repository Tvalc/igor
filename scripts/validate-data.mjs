// Cross-file checks the Zod schema can't express. Runs in CI before the build.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const TOOLS = 'src/content/tools';
const TESTS = 'src/content/tests';
const errors = [];
const tools = new Map();

for (const f of readdirSync(TOOLS).filter((f) => f.endsWith('.yaml'))) {
  const slug = f.replace(/\.yaml$/, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.push(`${f}: slug must be lowercase kebab-case`);
  tools.set(slug, parse(readFileSync(join(TOOLS, f), 'utf8')));
}

const today = new Date().toISOString().slice(0, 10);
const owned = [];
for (const [slug, t] of tools) {
  // A successor is optional: some tools are replaced by products we don't track (CGDream → CGTrader AI).
  if (t.successor && !tools.has(t.successor)) errors.push(`${slug}: successor "${t.successor}" does not exist`);
  if (!t.sources?.length) errors.push(`${slug}: at least one source URL is required`);
  if (String(t.last_verified) > today) errors.push(`${slug}: last_verified is in the future`);
  if (t.hands_on && !readdirSync(TESTS).includes(`${t.hands_on.test}.md`)) {
    errors.push(`${slug}: hands_on.test "${t.hands_on.test}" has no published test file`);
  }
  if (t.makko_owned) owned.push(slug);
}
if (owned.length > 1) errors.push(`only one tool may be makko_owned, found: ${owned.join(', ')}`);

for (const f of readdirSync(TESTS).filter((f) => f.endsWith('.md'))) {
  const fm = readFileSync(join(TESTS, f), 'utf8').match(/^---\n([\s\S]*?)\n---/);
  if (!fm) {
    errors.push(`${f}: missing frontmatter`);
    continue;
  }
  for (const id of parse(fm[1]).tools ?? []) if (!tools.has(id)) errors.push(`${f}: unknown tool "${id}"`);
}

if (errors.length) {
  console.error(`Data validation failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Data OK: ${tools.size} tools.`);
