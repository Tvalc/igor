import type { Scored } from './score';
import { fromPrice, priceLabel } from './compare';

const usableFree = (s: Scored) => {
  const d = s.tool.data;
  if (d.status === 'discontinued') return false;
  if (d.license.open_source || d.pricing.model === 'free' || d.pricing.model === 'open-source') return true;
  const exportLocked = ['partial', 'no'].includes((d.features as Record<string, string>).export_project ?? '');
  return d.pricing.free_tier === 'yes' && d.license.commercial_use === 'yes' && !exportLocked;
};

/** "Our picks" for a ranked list, computed from the ranking and facts. Each tool fills at most one slot. */
export function computePicks(ranked: Scored[]) {
  const used = new Set<string>();
  const out: { label: string; s: Scored; why: string }[] = [];
  const take = (label: string, s: Scored | undefined, why: (s: Scored) => string) => {
    if (!s || used.has(s.tool.id)) return;
    used.add(s.tool.id);
    out.push({ label, s, why: why(s) });
  };
  const free = (s: Scored) => !used.has(s.tool.id);
  // "Best free option" means you can make and ship something without paying: fully free or open source, or a free
  // plan that allows commercial use and doesn't lock exports behind a paid plan. Any free tier isn't enough.
  const bestFree = ranked.find((s) => usableFree(s));
  const top = ranked[0];
  take('Best overall', top, (s) => `Highest score on this list: ${s.score}/100.${bestFree === s ? ' Also free to use.' : ''}`);
  take('Best free option', bestFree, (s) => (s.tool.data.license.open_source || s.tool.data.pricing.model === 'free' ? 'Highest-ranked tool that is completely free.' : 'Highest-ranked free plan that lets you sell and export what you make.'));
  take('Best for beginners', ranked.find((s) => s.tool.data.skill_level === 'beginner' && free(s)), () => 'Highest-ranked tool that needs no technical skills.');
  const half = ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2)));
  const value = half.filter((s) => free(s) && (fromPrice(s.tool) ?? 0) > 0).sort((a, b) => fromPrice(a.tool)! - fromPrice(b.tool)!)[0];
  take('Best value', value, (s) => `Cheapest paid plan among the top half: ${priceLabel(s.tool).toLowerCase()}.`);
  return out;
}
