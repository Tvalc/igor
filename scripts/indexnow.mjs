// Tells Bing (and the other IndexNow engines) which pages changed, so they recrawl right after a deploy.
// Bing's index feeds ChatGPT search and Copilot answers, so this matters for answer engines too.
// Usage: node scripts/indexnow.mjs [sitemap=https://makeaigames.com/sitemap.xml]
const KEY = '2f21929c400382a9cd0a71b080eb3bf6'; // public by design: served at /<key>.txt
const sitemap = process.argv[2] ?? 'https://makeaigames.com/sitemap.xml';
const { host, origin } = new URL(sitemap);

const xml = await (await fetch(sitemap)).text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${origin}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: submitted ${urlList.length} URLs, HTTP ${res.status}`);
if (!res.ok && res.status !== 202) process.exit(1);
