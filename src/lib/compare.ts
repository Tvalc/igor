import { activeTools, comparisonPairs } from './lists';
import { scoreTool, type Tool } from './score';
import { FEATURES, featuresFor } from './features';
import {
  CATEGORY_LABELS, COMMERCIAL_LABELS, ENGINE_LABELS, EXPORT_LABELS, FREE_TIER_LABELS, STATUS_LABELS, list, price, shown, tier,
} from './format';

// Shared by the compare builder and the directory filters: one compact record per tool, embedded in the page as
// JSON so both work without a server and stay in sync with the static pages.

export const FREE_RANK = { yes: 4, limited: 3, trial: 2, no: 1, unknown: 0 } as const;
export const COMMERCIAL_RANK = { yes: 4, 'paid-plans': 3, restricted: 2, no: 1, unknown: 0 } as const;

/** Lowest monthly price we know: the starting price, else the cheapest paid plan, else 0 for free tools. */
export const fromPrice = (t: Tool): number | null => {
  const p = t.data.pricing;
  if (p.model === 'free' || p.model === 'open-source') return 0;
  if (p.starting_price_usd !== null) return p.starting_price_usd;
  const paid = t.data.plans.filter((x) => x.price_usd !== null && x.price_usd > 0).map((x) => x.price_usd as number);
  return paid.length ? Math.min(...paid) : null;
};

export const priceLabel = (t: Tool) => {
  const label = price(t);
  if (label !== 'Unverified') return label;
  const n = fromPrice(t);
  if (n !== null) return n === 0 ? 'Free' : `From $${n}/mo`;
  // Paid prices unknown, but a confirmed free plan is still the honest headline.
  return t.data.pricing.free_tier === 'yes' ? 'Free plan' : label;
};

export async function clientTools() {
  return (await activeTools())
    .filter((t) => t.data.status !== 'discontinued')
    .map((t) => {
      const s = scoreTool(t);
      const d = t.data;
      return {
        id: t.id,
        name: d.name,
        host: new URL(d.url).hostname.replace(/^www\./, ''),
        tagline: d.tagline,
        best: d.best_for,
        cats: d.categories as string[],
        catLabel: d.categories.map((c) => CATEGORY_LABELS[c]).join(', '),
        score: s.score,
        tier: tier(s.score),
        free: d.pricing.free_tier,
        freeLabel: FREE_TIER_LABELS[d.pricing.free_tier],
        price: fromPrice(t),
        priceLabel: priceLabel(t),
        commercial: d.license.commercial_use,
        commercialLabel: d.license.open_source
          ? `${shown(COMMERCIAL_LABELS[d.license.commercial_use])} (open source)`
          : COMMERCIAL_LABELS[d.license.commercial_use],
        engines: list(d.engines, ENGINE_LABELS),
        exports: list(d.exports, EXPORT_LABELS),
        platforms: list(d.platforms, { web: 'Web', desktop: 'Desktop', plugin: 'Plugin', api: 'API', cli: 'CLI', 'self-hosted': 'Self-hosted' }),
        skill: d.skill_level[0].toUpperCase() + d.skill_level.slice(1),
        status: STATUS_LABELS[d.status],
        owned: d.makko_owned,
        features: d.features as Record<string, string>,
        plans: d.plans,
      };
    });
}

export type ClientTool = Awaited<ReturnType<typeof clientTools>>[number];

/** Everything the compare builder needs, as one JSON payload. */
export async function compareData() {
  return {
    tools: await clientTools(),
    features: FEATURES,
    categories: CATEGORY_LABELS,
    pairs: [...(await comparisonPairs()).keys()],
  };
}

/** Feature rows for a set of tools: the union of their categories' checklists. */
export const sharedFeatures = (tools: Tool[]) => featuresFor([...new Set(tools.flatMap((t) => t.data.categories as string[]))]);
