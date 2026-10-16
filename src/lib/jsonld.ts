import { SITE } from '../site';
import type { Scored } from './score';
import { isoDate } from './format';

const APP_CATEGORY: Record<string, string> = {
  'game-maker': 'GameApplication', code: 'DeveloperApplication',
};

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
    offers:
      d.pricing.free_tier === 'yes' || d.pricing.model === 'free' || d.pricing.model === 'open-source'
        ? { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        : undefined,
    review: {
      '@type': 'Review',
      author: { '@type': 'Organization', name: SITE.name, url: base },
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
