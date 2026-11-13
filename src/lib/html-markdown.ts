// Pages without a hand-written .md route get one generated from their built HTML by
// scripts/html-to-md.mjs after `astro build`. Same words as the page, as markdown.
// Keep this list and the script's PREFIXES in sync.
export const HTML_MD_PREFIXES = ['/guides/', '/compare/', '/alternatives/'];
export const HTML_MD_PAGES = ['/methodology', '/disclosure', '/editorial-policy', '/stats', '/about'];

export function generatedMarkdownPath(path: string): string | undefined {
  if (HTML_MD_PAGES.includes(path)) return `${path}.md`;
  const prefix = HTML_MD_PREFIXES.find((p) => path.startsWith(p) && path.length > p.length);
  return prefix ? `${path}.md` : undefined;
}
