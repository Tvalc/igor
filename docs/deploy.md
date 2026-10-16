# Deploying makeaigames.com

The site is fully static: `npm run build` writes `dist/`. Production runs on Cloudflare Pages, and all five
domains (registered at GoDaddy) use Cloudflare DNS so redirects happen at the edge.

## Domains

| Domain | Role | Destination |
|---|---|---|
| makeaigames.com | Production site | Cloudflare Pages |
| www.makeaigames.com | Redirect (301) | `https://makeaigames.com` + same path |
| aigameranks.com | Redirect (301) | `https://makeaigames.com/best` |
| gamedevranks.com | Redirect (301) | `https://makeaigames.com/best` |
| aigamesatlas.com | Redirect (301) | `https://makeaigames.com/tools` |
| topgamedevs.com | Redirect (301) | `https://makeaigames.com/` (parked for a future studios directory) |

Redirects must be 301 (permanent), so search engines treat makeaigames.com as the only canonical site.

## 1. Create the Pages project

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick
   `tvalc/igor`.
2. Settings:
   - Production branch: `main`
   - Framework preset: Astro, or None
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variables: `NODE_VERSION` = `22` and `SITE_URL` = `https://makeaigames.com`
3. Deploy. You'll get a `*.pages.dev` URL to check the build.

## 2. Move DNS to Cloudflare (each of the 5 domains)

1. Cloudflare dashboard → **Add a domain** → enter the domain → **Free** plan.
2. Cloudflare shows two nameservers. In GoDaddy, go to **My Products → Domain → DNS → Nameservers →
   Change → "I'll use my own nameservers"** and paste both.
3. In GoDaddy, make sure **Forwarding** is off for the domain. GoDaddy forwarding conflicts with
   Cloudflare.
4. Wait for Cloudflare to show the domain as **Active**. This usually takes minutes, sometimes a few hours.

## 3. Attach the main domain

In the Pages project, go to **Custom domains → Set up a custom domain**. Add `makeaigames.com`, then add
`www.makeaigames.com`. Cloudflare creates the DNS records and SSL certificates automatically.

Then add a redirect from www to the bare domain: in the **makeaigames.com** zone, go to
**Rules → Redirect Rules → Create rule**.
- When: Hostname equals `www.makeaigames.com`
- Then: Dynamic, expression `concat("https://makeaigames.com", http.request.uri.path)`, status 301,
  preserve query string.

## 4. Set up the redirect domains

For each of aigameranks.com, gamedevranks.com, aigamesatlas.com and topgamedevs.com:

1. **DNS → Add record:**
   - Type `AAAA`, name `@`, IPv6 `100::`, proxy **on** (orange cloud).
   - The same again with name `www`.
   - `100::` is a placeholder address. It works because Cloudflare handles the request before it goes
     anywhere.
2. **Rules → Redirect Rules → Create rule:**
   - When: All incoming requests
   - Then: Static URL, the destination from the table above, status **301**

## 5. Check it

```bash
curl -sI https://makeaigames.com | head -1                      # HTTP/2 200
curl -sI https://www.makeaigames.com/best | grep -i location    # https://makeaigames.com/best
for d in aigameranks.com gamedevranks.com aigamesatlas.com topgamedevs.com; do
  echo "$d -> $(curl -sI https://$d | grep -i '^location')"
done
curl -s https://makeaigames.com/llms.txt | head -3
curl -sI https://makeaigames.com/tools/makko-ai | head -1       # 200, extensionless URL
```

## 6. Tell the search engines

- **Google Search Console:** add a *Domain* property for `makeaigames.com`, verify with the DNS TXT
  record (add it in Cloudflare DNS), then submit `https://makeaigames.com/sitemap.xml`.
- **Bing Webmaster Tools:** import from Search Console, or verify the same way, then submit the sitemap.
  ChatGPT search and Copilot draw on Bing's index.
- Optional: add the four redirect domains as properties too, so you can watch for redirect errors.

## Ongoing

- Every push to `main` deploys automatically. Pull requests get preview URLs.
- The weekly data refresh workflow opens PRs. Merging one deploys the updated rankings.
