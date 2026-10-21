import type { Scored } from './score';
import { fromPrice } from './compare';
import { CATEGORY_LABELS, ENGINE_LABELS, EXPORT_LABELS } from './format';
import { CATEGORIES, ENGINES, EXPORTS } from '../content.config';
import type { FilterConfig } from '../islands/FilterPanel';

/** Options and counts for the filter panel, computed from the items on the page. */
export function filterConfig(items: Scored[], o: { categories?: boolean; search?: boolean; views?: boolean; ranked?: boolean } = {}): FilterConfig {
  const tools = items.map((s) => s.tool.data);
  const n = (f: (d: (typeof tools)[number]) => boolean) => tools.filter(f).length;
  const prices = items.map((s) => fromPrice(s.tool));
  const upTo = (max: number) => prices.filter((p) => p !== null && p <= max).length;
  return {
    search: o.search ?? true,
    categories: o.categories === false ? [] : CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], count: n((d) => (d.categories as string[]).includes(c)) })).filter((x) => x.count > 0),
    prices: [
      { value: 'free', label: 'Has a free plan', count: n((d) => ['yes', 'limited'].includes(d.pricing.free_tier)) },
      { value: '10', label: 'From $10/mo or less', count: upTo(10) },
      { value: '25', label: 'From $25/mo or less', count: upTo(25) },
      { value: '50', label: 'From $50/mo or less', count: upTo(50) },
    ],
    commercialCount: n((d) => ['yes', 'paid-plans'].includes(d.license.commercial_use)),
    beginnerCount: n((d) => d.skill_level === 'beginner'),
    engines: ENGINES.filter((e) => n((d) => (d.engines as string[]).includes(e)) > 0).map((e) => ({ value: e, label: ENGINE_LABELS[e] })),
    exports: EXPORTS.filter((e) => n((d) => (d.exports as string[]).includes(e)) > 0).map((e) => ({ value: e, label: EXPORT_LABELS[e] })),
    sorts: [
      ...(o.ranked ? [{ value: 'rank', label: 'Our ranking' }] : [{ value: 'score', label: 'Highest score' }]),
      { value: 'price', label: 'Lowest price' },
      { value: 'name', label: 'Name A–Z' },
    ],
    views: o.views ?? false,
    noun: 'tools',
  };
}
