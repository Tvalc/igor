import { CATEGORIES } from '../content.config';
import { activeTools } from './lists';
import { fromPrice } from './compare';
import { groupOf, scoreTool, type Tool } from './score';
import { CATEGORY_LABELS, isoDate, newestVerified } from './format';

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 100) / 100;
};
// Monthly entry price for paid tools; one-time and custom prices aren't comparable month to month.
const monthly = (t: Tool) => (t.data.pricing.model === 'one-time' ? null : fromPrice(t));

export interface CategoryStats {
  key: string;
  label: string;
  tools: number;
  freeTier: number; // % with a genuine free tier
  commercialAll: number; // % allowing commercial use on every plan
  medianPaid: number | null; // median cheapest paid plan, USD per month
  cheapestPaid: { name: string; id: string; price: number } | null;
  pricedPaid: number; // tools with a verified paid monthly price
}

export async function siteStats() {
  const tools = (await activeTools()).filter((t) => t.data.status !== 'discontinued');
  const n = tools.length;
  const of = (f: (t: Tool) => boolean) => tools.filter(f).length;
  const makers = tools.filter((t) => t.data.categories.includes('game-maker'));
  const categories: CategoryStats[] = CATEGORIES.map((c) => {
    const ts = tools.filter((t) => (t.data.categories as string[]).includes(c));
    const paid = ts.map((t) => ({ t, p: monthly(t) })).filter((x): x is { t: Tool; p: number } => x.p !== null && x.p > 0);
    const cheapest = paid.sort((a, b) => a.p - b.p)[0];
    return {
      key: c,
      label: CATEGORY_LABELS[c],
      tools: ts.length,
      freeTier: pct(ts.filter((t) => t.data.pricing.free_tier === 'yes').length, ts.length),
      commercialAll: pct(ts.filter((t) => t.data.license.commercial_use === 'yes').length, ts.length),
      medianPaid: median(paid.map((x) => x.p)),
      cheapestPaid: cheapest ? { name: cheapest.t.data.name, id: cheapest.t.id, price: cheapest.p } : null,
      pricedPaid: paid.length,
    };
  }).filter((c) => c.tools > 0);
  const paidAll = tools.map(monthly).filter((p): p is number => p !== null && p > 0);
  return {
    updated: newestVerified(tools),
    updatedIso: isoDate(newestVerified(tools)),
    total: n,
    freeTier: pct(of((t) => t.data.pricing.free_tier === 'yes'), n),
    anyFree: pct(of((t) => ['yes', 'limited', 'trial'].includes(t.data.pricing.free_tier) || ['free', 'open-source'].includes(t.data.pricing.model)), n),
    commercialAll: pct(of((t) => t.data.license.commercial_use === 'yes'), n),
    commercialPaidOnly: pct(of((t) => t.data.license.commercial_use === 'paid-plans'), n),
    commercialUnknown: pct(of((t) => t.data.license.commercial_use === 'unknown'), n),
    openSource: of((t) => t.data.license.open_source),
    mcp: of((t) => t.data.tags.includes('mcp')),
    medianPaid: median(paidAll),
    makers: makers.length,
    makersSourceCode: pct(makers.filter((t) => t.data.exports.includes('source-code') || ['yes', 'partial'].includes(t.data.features.export_project ?? '')).length, makers.length),
    makersNoCode: pct(makers.filter((t) => t.data.features.no_code === 'yes').length, makers.length),
    makersSteam: makers.filter((t) => t.data.exports.includes('steam')).map((t) => t.data.name),
    beginner: pct(of((t) => t.data.skill_level === 'beginner'), n),
    categories,
  };
}

/** One flat row per tool, for the open dataset. */
export async function datasetRows(base: string) {
  return (await activeTools()).map((t) => {
    const d = t.data;
    return {
      id: t.id,
      name: d.name,
      url: d.url,
      page: `${base}/tools/${t.id}`,
      status: d.status,
      categories: d.categories.join(';'),
      score: scoreTool(t, groupOf(t)).score,
      skill_level: d.skill_level,
      pricing_model: d.pricing.model,
      free_tier: d.pricing.free_tier,
      starting_price_usd: fromPrice(t),
      commercial_use: d.license.commercial_use,
      open_source: d.license.open_source,
      engines: d.engines.join(';'),
      exports: d.exports.join(';'),
      platforms: d.platforms.join(';'),
      makko_owned: d.makko_owned,
      last_verified: isoDate(d.last_verified),
    };
  });
}
