// Links built in the browser. The page renders <link rel="home" href="/">; the preview bundler rewrites that to a
// relative index.html, so scripts read it to work both on the live site (extensionless URLs) and in the preview.

export function siteLinks() {
  const home = document.querySelector<HTMLLinkElement>('link[rel="home"]')?.href ?? `${location.origin}/`;
  const preview = home.endsWith('index.html');
  const root = preview ? home.slice(0, -'index.html'.length) : home.replace(/\/?$/, '/');
  const ext = preview ? '.html' : '';
  const index = preview ? 'index.html' : '';
  return {
    tool: (id: string) => `${root}tools/${id}${ext}`,
    pair: (slug: string) => `${root}compare/${slug}${ext}`,
    builder: (ids: string[]) => `${root}compare/${index}${ids.length ? `?tools=${ids.join(',')}` : ''}`,
    directory: (q = '') => `${root}tools/${index}${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  };
}

/** Logo URL for a tool's site: the favicon service returns a usable icon for almost every vendor. */
export const logoSrc = (host: string) => `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
