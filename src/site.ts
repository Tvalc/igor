// Brand and domain identity. The logo, titles, llms.txt and disclosures all read from here.
export const SITE = {
  name: 'Make AI Games',
  brand: { lead: 'Make AI', accent: 'Games' },
  tagline: 'Every AI game dev tool, ranked on a public rubric',
  description:
    'How to make games with AI: transparent, fact-checked rankings and comparisons of AI game makers, AI sprite and 3D generators, AI coding tools for Unity and Godot, and AI voice, music and NPC tools.',
  owner: 'the Makko AI team',
  ownerProduct: 'makko-ai',
  year: 2026,
};

export const NAV = [
  { href: '/best/', label: 'Best lists' },
  { href: '/tools/', label: 'All tools' },
  { href: '/compare/', label: 'Compare' },
  { href: '/guides/how-to-make-a-game-with-ai', label: 'Guides' },
  { href: '/methodology', label: 'How we rank' },
];

// Directory-style pages, served as /x/index.html. Their canonical URLs end with a slash.
export const SECTION_INDEXES = ['/', '/best/', '/tools/', '/compare/', '/tests/'];
