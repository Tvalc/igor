import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { monogram } from '../components/site/ToolLogo';

// Social preview images (1200x630) for tool, list and versus pages, rendered at build time.

// Resolved from the project root: at build time this module runs from dist/, so import.meta.url won't reach node_modules.
const font = (pkg: string, file: string) => readFileSync(join(process.cwd(), 'node_modules/@fontsource', pkg, 'files', file));
const FONTS = [
  { name: 'Sora', data: font('sora', 'sora-latin-700-normal.woff'), weight: 700 as const, style: 'normal' as const },
  { name: 'Inter', data: font('inter', 'inter-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: font('inter', 'inter-latin-500-normal.woff'), weight: 500 as const, style: 'normal' as const },
];

// Brand colours from global.css, written as hex because satori doesn't parse oklch.
const C = { bg: '#0f0d17', panel: '#1a1726', fg: '#f5f4fa', muted: '#a9a5bd', brand: '#a78bfa', pick: '#facc15' };

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | null | false)[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter(Boolean) },
});

const badge = (name: string, size = 120) => {
  const { initials, hue } = monogram(name);
  return h(
    'div',
    { width: size, height: size, borderRadius: size * 0.22, background: `hsl(${hue} 55% 42%)`, alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Sora', fontWeight: 700, fontSize: size * 0.38 },
    initials,
  );
};

export interface OgCard {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** One or two tools to show as monogram badges. */
  tools?: { name: string; score?: number }[];
  /** Short highlighted line, e.g. "#1 in AI Game Makers". */
  highlight?: string;
}

export async function renderOg(card: OgCard): Promise<Buffer> {
  const tools = card.tools ?? [];
  const tree = h(
    'div',
    { width: 1200, height: 630, background: C.bg, color: C.fg, flexDirection: 'column', padding: '64px 72px', fontFamily: 'Inter', justifyContent: 'space-between' },
    h(
      'div',
      { alignItems: 'center', gap: 16 },
      h('div', { width: 44, height: 44, borderRadius: 10, background: C.brand, alignItems: 'center', justifyContent: 'center', color: C.bg, fontFamily: 'Sora', fontWeight: 700, fontSize: 26 }, 'M'),
      h('div', { fontFamily: 'Sora', fontWeight: 700, fontSize: 28 }, 'Make AI', h('span', { color: C.brand, marginLeft: 8 }, 'Games')),
      h('div', { marginLeft: 'auto', color: C.muted, fontSize: 24, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2 }, card.eyebrow),
    ),
    h(
      'div',
      { alignItems: 'center', gap: 40 },
      tools.length > 0 && h('div', { gap: 20, alignItems: 'center' }, ...tools.map((t) => badge(t.name, tools.length > 1 ? 110 : 140))),
      h(
        'div',
        { flexDirection: 'column', gap: 14, flex: 1 },
        h('div', { fontFamily: 'Sora', fontWeight: 700, fontSize: card.title.length > 38 ? 54 : 68, lineHeight: 1.08, letterSpacing: -1 }, card.title),
        card.subtitle ? h('div', { color: C.muted, fontSize: 30, lineHeight: 1.35 }, card.subtitle) : null,
      ),
    ),
    h(
      'div',
      { alignItems: 'center', justifyContent: 'space-between' },
      card.highlight ? h('div', { background: C.panel, color: C.pick, borderRadius: 999, padding: '12px 26px', fontSize: 28, fontWeight: 500 }, card.highlight) : h('div', {}),
      h('div', { color: C.muted, fontSize: 26 }, 'makeaigames.com'),
    ),
  );
  const svg = await satori(tree as never, { width: 1200, height: 630, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
