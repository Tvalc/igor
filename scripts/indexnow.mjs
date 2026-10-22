// Tells Bing (and the other IndexNow engines) which pages changed, so they recrawl right after a deploy.
// Bing's index feeds ChatGPT search and Copilot answers, so this matters for answer engines too.
// Usage: node scripts/indexnow.mjs [sitemap=https://makeaigames.com/sitemap.xml]
const KEY = '2f21929c400382a9cd0a71b080eb3bf6'; // public by design: served at /<key>.txt
const sitemap = process.argv[2] ?? 'https://makeaigames.com/sitemap.xml';
const { host, origin } = new URL(sitemap);

const xml = await (await fetch(sitemap)).text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const body = JSON.stringify({ host, key: KEY, keyLocation: `${origin}/${KEY}.txt`, urlList });
// Right after a deploy the key file may not be on every Pages edge yet, so the engine can't verify it (403).
// Retry a few times before giving up.
let res;
for (let attempt = 1; attempt <= 4; attempt++) {
  res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body,
  });
  console.log(`IndexNow: submitted ${urlList.length} URLs, HTTP ${res.status} (attempt ${attempt})`);
  if (res.ok || res.status === 202 || attempt === 4) break;
  await new Promise((r) => setTimeout(r, 30_000));
}
if (!res.ok && res.status !== 202) process.exit(1);
