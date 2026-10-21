import type { Scored } from './score';
import { fromPrice, priceLabel } from './compare';

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
  take('Best overall', ranked[0], (s) => `Highest score on this list: ${s.score}/100.`);
  take('Best free option', ranked.find((s) => s.tool.data.pricing.free_tier === 'yes' && free(s)), () => 'Highest-ranked tool with a free plan.');
  take('Best for beginners', ranked.find((s) => s.tool.data.skill_level === 'beginner' && free(s)), () => 'Highest-ranked tool that needs no technical skills.');
  const half = ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2)));
  const value = half.filter((s) => free(s) && (fromPrice(s.tool) ?? 0) > 0).sort((a, b) => fromPrice(a.tool)! - fromPrice(b.tool)!)[0];
  take('Best value', value, (s) => `Cheapest paid plan among the top half: ${priceLabel(s.tool).toLowerCase()}.`);
  return out;
}
