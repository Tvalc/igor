# Deploying makeaigames.com

The site is fully static and hosted free on **GitHub Pages**. `.github/workflows/deploy.yml` builds and
publishes it on every push to `main`, and `public/CNAME` sets the custom domain. Domains stay at GoDaddy,
so there's no Cloudflare and no nameserver change.

## Domains

| Domain | Role | Set up where |
|---|---|---|
| makeaigames.com | Production site | GoDaddy DNS → GitHub Pages |
| www.makeaigames.com | Redirects to makeaigames.com | GoDaddy DNS (CNAME); GitHub redirects it automatically |
| aigameranks.com | 301 → `https://makeaigames.com/best/` | GoDaddy Forwarding |
| gamedevranks.com | 301 → `https://makeaigames.com/best/` | GoDaddy Forwarding |
| aigamesatlas.com | 301 → `https://makeaigames.com/tools/` | GoDaddy Forwarding |
| topgamedevs.com | 301 → `https://makeaigames.com/` | GoDaddy Forwarding |

## Phone checklist (GoDaddy app or godaddy.com)

### 1. Point makeaigames.com at GitHub Pages

Go to **My Products → makeaigames.com → DNS**.

1. Delete the existing **A** record named `@`. It usually points to "Parked" or "WebsiteBuilder".
2. Add four **A** records, each with Name `@`, TTL default:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. Edit or add the **CNAME** record with Name `www` and Value `tvalc.github.io`.
4. If **Forwarding** is turned on for makeaigames.com, turn it off.

### 2. Forward the other four domains

For each domain, go to **My Products → domain → DNS → Forwarding → Add forwarding (Domain)**:

- Forward to `https` and the destination URL from the table above.
- Type: **Permanent (301)**.
- Settings: **Forward only**, not "masking".

### 3. Turn on HTTPS (GitHub, once DNS is live)

On github.com (the mobile browser works; the app doesn't), go to **Tvalc/igor → Settings → Pages**:

- **Source** should say *GitHub Actions*. The deploy workflow tries to set this itself. If it shows
  "Deploy from a branch", switch it to *GitHub Actions*.
- **Custom domain** should say `makeaigames.com`. If it's empty, type it and Save.
- Tick **Enforce HTTPS** once GitHub has issued the certificate. That takes a few minutes to an hour after
  DNS updates.

## Check it

```bash
curl -sI https://makeaigames.com | head -1                    # HTTP/2 200
curl -sI https://www.makeaigames.com | grep -i location       # https://makeaigames.com/
curl -sI https://makeaigames.com/tools/makko-ai | head -1     # 200 (extensionless URLs work on Pages)
for d in aigameranks.com gamedevranks.com aigamesatlas.com topgamedevs.com; do
  echo "$d -> $(curl -sI http://$d | grep -i '^location')"
done
```

## Tell the search engines

- **Google Search Console:** add a *Domain* property for `makeaigames.com`, verify it with the TXT record
  Google gives you (add it in GoDaddy DNS), then submit `https://makeaigames.com/sitemap.xml`.
- **Bing Webmaster Tools:** import from Search Console, then submit the sitemap. ChatGPT search and
  Copilot draw on Bing's index.

## Ongoing

- Every merge to `main` redeploys within about a minute.
- The weekly data refresh workflow opens PRs, and merging one publishes the new rankings.
- If you later want edge redirects or analytics, move DNS to Cloudflare. The site needs no code changes
  for that.
