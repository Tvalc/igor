import { EDITOR, SITE } from '../site';
import type { Scored } from './score';
import { isoDate } from './format';

const APP_CATEGORY: Record<string, string> = {
  'game-maker': 'GameApplication', code: 'DeveloperApplication',
};

// The named editor behind reviews and rankings, linked to the About page.
export function editor(base: string) {
  return { '@type': 'Person', name: EDITOR.name, jobTitle: EDITOR.role, url: `${base}${EDITOR.url}`, worksFor: { '@type': 'Organization', name: SITE.name, url: `${base}/` } };
}

export function softwareApp(s: Scored, base: string) {
  const d = s.tool.data;
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: d.name,
    url: d.url,
    description: d.description,
    applicationCategory: APP_CATEGORY[d.categories[0]] ?? 'MultimediaApplication',
    operatingSystem: d.platforms.includes('web') ? 'Web' : undefined,
    // Rich results want an offer on every app: free tools at 0, paid ones at their cheapest verified plan.
    offers:
      d.pricing.free_tier === 'yes' || d.pricing.model === 'free' || d.pricing.model === 'open-source'
        ? { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        : d.pricing.starting_price_usd != null
          ? { '@type': 'Offer', price: String(d.pricing.starting_price_usd), priceCurrency: 'USD' }
          : undefined,
    review: {
      '@type': 'Review',
      author: editor(base),
      publisher: { '@type': 'Organization', name: SITE.name, url: `${base}/` },
      datePublished: isoDate(d.last_verified),
      reviewRating: { '@type': 'Rating', ratingValue: s.score, bestRating: 100, worstRating: 0 },
      reviewBody: `${d.tagline} Best for: ${d.best_for}`,
    },
  };
}

export function itemList(name: string, items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
  };
}

export function breadcrumbs(crumbs: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

// Rankings and guides: a dated article, so answer engines can tell how fresh the facts are.
export function article(a: { headline: string; description: string; url: string; dateModified: string }, base: string) {
  const org = { '@type': 'Organization', name: SITE.name, url: `${base}/` };
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline,
    description: a.description,
    mainEntityOfPage: a.url,
    image: `${base}/og.png`,
    dateModified: a.dateModified,
    author: editor(base),
    publisher: org,
  };
}

// The open tool dataset (/data/tools.json and .csv), so search engines and models can find and cite it.
export function dataset(d: { name: string; description: string; url: string; dateModified: string }, base: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: d.name,
    description: d.description,
    url: d.url,
    dateModified: d.dateModified,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: SITE.name, url: `${base}/` },
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${base}/data/tools.json` },
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${base}/data/tools.csv` },
    ],
  };
}
