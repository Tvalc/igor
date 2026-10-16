import type { APIRoute } from 'astro';

// AI crawlers are explicitly welcome: being cited by answer engines is the point of this site.
export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: ${new URL('/sitemap.xml', site).toString()}`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
