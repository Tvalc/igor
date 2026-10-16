// Plain-markdown renderings of pages, served at <page>.md and bundled into /llms-full.txt.
// Answer engines and agents parse these far more reliably than HTML.
import { SITE } from '../site';
import type { ListDef } from './lists';
import { FACTOR_LABELS, type Factor, type Scored } from './score';
import {
  CATEGORY_LABELS, COMMERCIAL_LABELS, ENGINE_LABELS, FREE_TIER_LABELS, STATUS_LABELS, isoDate, list, price,
} from './format';

const cell = (s: string) => s.replace(/\|/g, '\\|');

export function toolMarkdown(s: Scored, base: string): string {
  const d = s.tool.data;
  const lines = [
    `# ${d.name} review (${SITE.year})`,
    '',
    `> ${d.tagline}`,
    '',
    d.description,
    '',
    `**Best for:** ${d.best_for}`,
    '',
    `**${SITE.name} score:** ${s.score}/100 (${s.handsOn ? 'facts + hands-on test' : 'facts-based; hands-on test pending'})`,
    '',
    '| Fact | Value |',
    '|---|---|',
    `| Website | ${d.url} |`,
    `| Status | ${STATUS_LABELS[d.status]} |`,
    `| Categories | ${d.categories.map((c) => CATEGORY_LABELS[c]).join(', ')} |`,
    `| Pricing | ${FREE_TIER_LABELS[d.pricing.free_tier]}; ${price(s.tool)} |`,
    `| Commercial use | ${COMMERCIAL_LABELS[d.license.commercial_use]}${d.license.open_source ? ' (open source)' : ''} |`,
    `| Engines | ${list(d.engines, ENGINE_LABELS)} |`,
    `| Exports | ${list(d.exports)} |`,
    `| Skill level | ${d.skill_level} |`,
    `| Last verified | ${isoDate(d.last_verified)} |`,
    '',
    '## Score breakdown',
    '',
    ...(Object.keys(s.factors) as Factor[]).map(
      (k) => `- ${FACTOR_LABELS[k].label}: ${Math.round(s.factors[k] * 100)}/100`,
    ),
  ];
  if (d.license.notes) lines.push('', `License note: ${d.license.notes}`);
  if (d.pricing.notes) lines.push('', `Pricing note: ${d.pricing.notes}`);
  if (d.needs_verification.length) lines.push('', `Pending verification: ${d.needs_verification.join(', ')}.`);
  if (d.makko_owned) lines.push('', `Disclosure: ${SITE.name} is run by ${SITE.owner}. ${d.name} is scored with the same rubric as every other tool.`);
  if (d.sources.length) lines.push('', '## Sources', '', ...d.sources.map((u) => `- ${u}`));
  lines.push('', `Canonical: ${base}/tools/${s.tool.id}`);
  return lines.join('\n') + '\n';
}

export function listMarkdown(def: ListDef, ranked: Scored[], base: string): string {
  const top = ranked.slice(0, 3).map((s) => s.tool.data.name);
  const lines = [
    `# ${def.title} (${SITE.year})`,
    '',
    `${def.question} On the facts-based ${SITE.name} score, the top picks are ${top.join(', ')}. ${def.blurb}`,
    '',
    '| Rank | Tool | Score | Free tier | Commercial use | Best for |',
    '|---|---|---|---|---|---|',
    ...ranked.map(
      (s, i) =>
        `| ${i + 1} | [${cell(s.tool.data.name)}](${base}/tools/${s.tool.id}) | ${s.score} | ${FREE_TIER_LABELS[s.tool.data.pricing.free_tier]} | ${COMMERCIAL_LABELS[s.tool.data.license.commercial_use]} | ${cell(s.tool.data.best_for)} |`,
    ),
    '',
    `Scores are computed from verified facts with a public rubric (${base}/methodology). Hands-on test scores are added as tests are published.`,
    '',
    `Canonical: ${base}/best/${def.slug}`,
  ];
  return lines.join('\n') + '\n';
}
