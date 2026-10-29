// Cross-file checks the Zod schema can't express. Runs in CI before the build.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const TOOLS = 'src/content/tools';
const TESTS = 'src/content/tests';
const errors = [];
const tools = new Map();
// Redirect hosts used by affiliate networks; a referral link may point at these instead of the vendor.
const AFFILIATE_HOSTS = [
  'partnerstack.com', 'grsm.io', 'impact.com', 'sjv.io', 'pxf.io', 'ojrq.net', 'rewardful.com', 'getrewardful.com',
  'firstpromoter.com', 'fpr.io', 'tolt.io', 'tolt.com', 'dub.sh', 'dub.co', 'refer.io', 'awin1.com', 'anrdoezrs.net',
  'jdoqocy.com', 'tkqlhce.com', 'dpbolvw.net', 'kqzyfj.com', 'shareasale.com', 'lemonsqueezy.com', 'affiliatly.com',
  'prf.hn', 'partnerize.com', 'refersion.com', 'partnero.io', 'partneroapp.com', 'creem.io', 'promotekit.com', 'cello.so',
];

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
  if (t.affiliate?.url) {
    // A referral link must go to the vendor itself or to a known affiliate network, over https.
    const link = new URL(t.affiliate.url);
    const vendor = new URL(t.url).hostname.replace(/^www\./, '');
    const ok = link.hostname === vendor || link.hostname.endsWith('.' + vendor) || AFFILIATE_HOSTS.some((h) => link.hostname === h || link.hostname.endsWith('.' + h));
    if (link.protocol !== 'https:') errors.push(`${slug}: affiliate.url must use https`);
    if (!ok) errors.push(`${slug}: affiliate.url host ${link.hostname} is neither ${vendor} nor a known affiliate network`);
    if (t.makko_owned) errors.push(`${slug}: Makko is ours, so it can't carry an affiliate link`);
  }
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
