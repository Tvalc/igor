import { listsContaining } from './lists';
import { scoreTool, groupOf, type Tool } from './score';

/** The badge a vendor can embed: its best placement on a published list, or its score when it isn't in a top 10. */
export async function badgeFor(tool: Tool) {
  const score = scoreTool(tool, groupOf(tool)).score;
  let best: { rank: number; title: string; slug: string } | undefined;
  for (const { def, ranked } of await listsContaining(tool)) {
    const rank = ranked.findIndex((s) => s.tool.id === tool.id) + 1;
    if (rank > 0 && rank <= 10 && (!best || rank < best.rank)) best = { rank, title: def.title, slug: def.slug };
  }
  const label = best ? `#${best.rank} ${best.title.replace(/^Best /, '')}` : `Score ${score}/100`;
  return { score, best, label, alt: `${tool.data.name} on Make AI Games: ${best ? `ranked ${label}` : `scored ${score}/100`}` };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A flat two-part badge, sized from the text so it works without web fonts. */
export function badgeSvg(label: string) {
  const left = 'Make AI Games';
  const w1 = Math.round(left.length * 6.6 + 20);
  const w2 = Math.round(label.length * 6.6 + 20);
  const w = w1 + w2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="28" viewBox="0 0 ${w} 28" role="img" aria-label="${esc(`${left}: ${label}`)}">
<title>${esc(`${left}: ${label}`)}</title>
<rect width="${w}" height="28" rx="6" fill="#111827"/>
<rect x="${w1}" width="${w2}" height="28" rx="6" fill="#16a34a"/>
<rect x="${w1}" width="8" height="28" fill="#16a34a"/>
<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" font-weight="bold">
<text x="10" y="18">${esc(left)}</text>
<text x="${w1 + 10}" y="18">${esc(label)}</text>
</g>
</svg>
`;
}
