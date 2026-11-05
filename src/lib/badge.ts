import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { listsContaining } from './lists';
import { scoreTool, groupOf, type Tool } from './score';
import { BADGE_STYLE, SITE } from '../site';

/** The badge a vendor can embed: its best placement on a published list, or its score when it isn't in a top 10. */
export async function badgeFor(tool: Tool) {
  const score = scoreTool(tool, groupOf(tool)).score;
  let best: { rank: number; title: string; slug: string } | undefined;
  for (const { def, ranked } of await listsContaining(tool)) {
    const rank = ranked.findIndex((s) => s.tool.id === tool.id) + 1;
    if (rank > 0 && rank <= 10 && (!best || rank < best.rank)) best = { rank, title: def.title, slug: def.slug };
  }
  const title = best ? best.title.replace(/^Best /, '') : '';
  const label = best ? `#${best.rank} ${title}` : `Score ${score}/100`;
  return { score, best, rank: best?.rank ?? 0, title, label, alt: `${tool.data.name} on Make AI Games: ${best ? `ranked ${label}` : `scored ${score}/100`}` };
}

// Three badge designs. Text is rendered to outlines by satori, so the SVG looks the same everywhere without web fonts.
export const BADGE_STYLES = {
  plaque: { name: 'Plaque', note: 'Dark award plaque with a medal for the rank.', width: 300, height: 76 },
  seal: { name: 'Laurel seal', note: 'Square award seal with a laurel wreath.', width: 170, height: 190 },
  light: { name: 'Light', note: 'Clean light version for white pages and READMEs.', width: 280, height: 60 },
} as const;
export type BadgeStyle = keyof typeof BADGE_STYLES;
export const DEFAULT_BADGE_STYLE: BadgeStyle = BADGE_STYLE;

const font = (pkg: string, file: string) => readFileSync(join(process.cwd(), 'node_modules/@fontsource', pkg, 'files', file));
let fonts: Parameters<typeof satori>[1]['fonts'] | undefined;
const FONTS = () =>
  (fonts ??= [
    { name: 'Sora', data: font('sora', 'sora-latin-700-normal.woff'), weight: 700, style: 'normal' },
    { name: 'Inter', data: font('inter', 'inter-latin-500-normal.woff'), weight: 500, style: 'normal' },
    { name: 'Inter', data: font('inter', 'inter-latin-700-normal.woff'), weight: 700, style: 'normal' },
  ]);

type Child = Node | string | null | false | undefined;
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Child | Child[])[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) },
});
const img = (src: string, w: number, hh: number, style = {}): Node => ({ type: 'img', props: { src, width: w, height: hh, style } });
const uri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

type Metal = { a: string; b: string; c: string; ink: string; name: string };
type Spec = { rank: number; title: string; score: number; year: number };

const METAL: Record<number, Metal> = {
  1: { a: '#fde68a', b: '#d4a017', c: '#8a6410', ink: '#3b2a03', name: 'gold' },
  2: { a: '#f1f5f9', b: '#a8b2c1', c: '#5f6b7a', ink: '#1f2733', name: 'silver' },
  3: { a: '#f5c9a0', b: '#c07a45', c: '#7a4520', ink: '#3a1d08', name: 'bronze' },
  0: { a: '#ddd6fe', b: '#a78bfa', c: '#6d4fd8', ink: '#1e1240', name: 'violet' },
};
const metal = (rank: number) => METAL[rank >= 1 && rank <= 3 ? rank : 0];

// Brand pixel mark (same as favicon), drawn on transparent.
const mark = (fg = '#fff', accent = '#ffd000') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 6 20 19"><path d="M7 8h3v3H7zM20 8h3v3h-3zM7 11h3v3H7zM20 11h3v3h-3zM7 14h3v3H7zM13 14h4v3h-4zM20 14h3v3h-3zM7 17h3v3H7zM20 17h3v3h-3zM7 20h3v3H7zM20 20h3v3h-3z" fill="${fg}"/><path d="M10 11h3v3h-3zM17 11h3v3h-3z" fill="${accent}"/></svg>`;

// Laurel wreath: two branches of leaves laid tangent to an arc, open at the top.
function laurel(m: Metal, size = 150) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  let leaves = '', stems = '';
  const n = 9, from = 195, to = 325;
  for (const side of [-1, 1]) {
    const pt = (deg: number) => { const a = (deg * Math.PI) / 180; return [cx + side * -r * Math.sin(a), cy - r * Math.cos(a)]; };
    const [sx, sy] = pt(from), [ex, ey] = pt(to);
    stems += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} A${r} ${r} 0 0 ${side > 0 ? 0 : 1} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${m.b}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    for (let i = 0; i < n; i++) {
      const deg = from + (i * (to - from)) / (n - 1);
      const s = 1 - i * 0.05;
      for (const off of [-1, 1]) {
        const rr = r + off * 4.5 * s;
        const a = (deg * Math.PI) / 180;
        const x = cx + side * -rr * Math.sin(a), y = cy - rr * Math.cos(a);
        const rot = side * -deg + off * side * -28 + 180 * 0;
        leaves += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(2.6 * s).toFixed(1)}" ry="${(6.8 * s).toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#g)"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.a}"/><stop offset="1" stop-color="${m.b}"/></linearGradient></defs>${stems}${leaves}</svg>`;
}


const titleSize = (t: string, short: number, long: number) => (t.length <= 22 ? short : long);

// A: dark award plaque, horizontal.
function plaque({ rank, title, score, year }: Spec): [number, number, Node] {
  const m = metal(rank);
  const W = 300, H = 76;
  const big = rank ? `#${rank}` : `${score}`;
  const text = rank ? title : `Scored ${score} out of 100`;
  return [W, H, h('div', { width: W, height: H, borderRadius: 14, background: `linear-gradient(135deg, ${m.c} 0%, #2a2340 35%, #2a2340 65%, ${m.c} 100%)`, padding: 1.5 },
    h('div', { flex: 1, borderRadius: 12.5, background: 'linear-gradient(180deg, #1d1830 0%, #0f0d17 100%)', alignItems: 'center', padding: '0 14px 0 11px', gap: 12 },
      h('div', { width: 52, height: 52, borderRadius: 26, background: `linear-gradient(160deg, ${m.a} 0%, ${m.b} 55%, ${m.c} 100%)`, alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px rgba(255,255,255,0.08)' },
        h('div', { fontFamily: 'Sora', fontWeight: 700, fontSize: big.length > 2 ? 18 : 21, color: m.ink, letterSpacing: -0.5 }, big),
      ),
      h('div', { flexDirection: 'column', width: 200, gap: 4 },
        h('div', { alignItems: 'center', gap: 6 },
          img(uri(mark()), 12, 11),
          h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 9, letterSpacing: 1.6, color: m.a }, `MAKE AI GAMES · ${year}`),
        ),
        h('div', { fontFamily: 'Sora', fontWeight: 700, fontSize: titleSize(text, 15, 12.5), color: '#f5f4fa', letterSpacing: -0.2, lineHeight: 1.2, width: 200 }, text),
      ),
    ),
  )];
}

// B: laurel seal, square card.
function seal({ rank, title, score, year }: Spec): [number, number, Node] {
  const m = metal(rank);
  const W = 170, H = 190;
  return [W, H, h('div', { width: W, height: H, borderRadius: 18, background: `linear-gradient(160deg, ${m.b} 0%, #2a2340 30%, #2a2340 70%, ${m.c} 100%)`, padding: 1.5 },
    h('div', { flex: 1, borderRadius: 16.5, background: 'radial-gradient(circle at 50% 35%, #2b2445 0%, #120f1c 70%)', flexDirection: 'column', alignItems: 'center', padding: '12px 12px 10px' },
      h('div', { position: 'relative', width: 110, height: 96, alignItems: 'center', justifyContent: 'center' },
        img(uri(laurel(m, 110)), 110, 110, { position: 'absolute', top: -6, left: 0 }),
        h('div', { flexDirection: 'column', alignItems: 'center', marginTop: 4 },
          h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 8, letterSpacing: 1.6, color: m.a }, rank ? 'RANKED' : 'SCORED'),
          h('div', { fontFamily: 'Sora', fontWeight: 700, fontSize: 40, color: '#fff', letterSpacing: -1, lineHeight: 1 }, rank ? `#${rank}` : `${score}`),
        ),
      ),
      h('div', { fontFamily: 'Sora', fontWeight: 700, fontSize: titleSize(rank ? title : 'x', 12.5, 11), color: '#f5f4fa', textAlign: 'center', justifyContent: 'center', lineHeight: 1.2, height: 32, alignItems: 'center', width: 146 }, rank ? title : 'out of 100'),
      h('div', { width: 120, height: 1, background: `linear-gradient(90deg, transparent, ${m.b}, transparent)`, margin: '8px 0 7px' }),
      h('div', { alignItems: 'center', gap: 5 },
        img(uri(mark()), 11, 10),
        h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 8.5, letterSpacing: 1.2, color: '#c9c4dc' }, `MAKEAIGAMES.COM · ${year}`),
      ),
    ),
  )];
}

// C: light, minimal, for light sites and READMEs.
function light({ rank, title, score, year }: Spec): [number, number, Node] {
  const m = metal(rank);
  const W = 280, H = 60;
  const big = rank ? `#${rank}` : `${score}`;
  const text = rank ? title : 'Score out of 100';
  return [W, H, h('div', { width: W, height: H, borderRadius: 12, background: '#ffffff', border: '1px solid #e4e1ee', alignItems: 'center', padding: '0 12px 0 8px', gap: 10 },
    h('div', { width: 42, height: 42, borderRadius: 10, background: '#1a1423', alignItems: 'center', justifyContent: 'center' }, img(uri(mark()), 24, 23)),
    h('div', { fontFamily: 'Sora', fontWeight: 700, fontSize: 22, color: rank && rank <= 3 ? m.c : '#6d4fd8', letterSpacing: -0.8 }, big),
    h('div', { width: 1, height: 30, background: '#e4e1ee' }),
    h('div', { flexDirection: 'column', width: 160, gap: 2 },
      h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 8.5, letterSpacing: 1.4, color: '#6b6488' }, `MAKE AI GAMES · ${year}`),
      h('div', { fontFamily: 'Sora', fontWeight: 700, fontSize: titleSize(text, 13, 11), color: '#17142a', letterSpacing: -0.2, lineHeight: 1.2, width: 160 }, text),
    ),
  )];
}

const DESIGNS: Record<BadgeStyle, (s: Spec) => [number, number, Node]> = { plaque, seal, light };

export async function badgeSvg(b: Awaited<ReturnType<typeof badgeFor>>, style: BadgeStyle = DEFAULT_BADGE_STYLE) {
  const [w, hh, node] = DESIGNS[style]({ rank: b.rank, title: b.title, score: b.score, year: SITE.year });
  const svg = await satori(node as Parameters<typeof satori>[0], { width: w, height: hh, fonts: FONTS() });
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return svg.replace('<svg ', `<svg role="img" aria-label="${esc(b.alt)}" `);
}

/** The HTML a vendor pastes: the badge image, linked to the tool's review page. */
export function badgeEmbed(base: string, id: string, alt: string, style: BadgeStyle = DEFAULT_BADGE_STYLE) {
  const { width, height } = BADGE_STYLES[style];
  const path = style === DEFAULT_BADGE_STYLE ? `${id}.svg` : `${style}/${id}.svg`;
  return `<a href="${base}/tools/${id}"><img src="${base}/badges/${path}" alt="${alt.replace(/"/g, '&quot;')}" width="${width}" height="${height}"></a>`;
}
