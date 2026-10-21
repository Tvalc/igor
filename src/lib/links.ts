// Links built in the browser. The page renders <link rel="home" href="/">; the preview bundler rewrites that to a
// relative index.html, so scripts read it to work both on the live site (extensionless URLs) and in the preview.

export function siteLinks() {
  const home = document.querySelector<HTMLLinkElement>('link[rel="home"]')?.href ?? `${location.origin}/`;
  const preview = home.endsWith('index.html');
  const root = preview ? home.slice(0, -'index.html'.length) : home.replace(/\/?$/, '/');
  const ext = preview ? '.html' : '';
  return {
    tool: (id: string) => `${root}tools/${id}${ext}`,
    pair: (slug: string) => `${root}compare/${slug}${ext}`,
    builder: (ids: string[]) => `${root}compare/${preview ? 'index.html' : ''}?tools=${ids.join(',')}`,
  };
}
