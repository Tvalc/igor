import type { Tool } from './score';

export const CATEGORY_LABELS: Record<string, string> = {
  'game-maker': 'AI game maker',
  'art-2d': '2D art & sprites',
  'art-3d': '3D models',
  texture: 'Textures & materials',
  animation: 'Animation & mocap',
  code: 'Coding & engine AI',
  voice: 'Voice',
  music: 'Music',
  sfx: 'Sound effects',
  npc: 'NPCs & dialogue',
};

export const ENGINE_LABELS: Record<string, string> = {
  unity: 'Unity', unreal: 'Unreal', godot: 'Godot', roblox: 'Roblox', blender: 'Blender', aseprite: 'Aseprite', web: 'Web',
};

export const FREE_TIER_LABELS = {
  yes: 'Free tier', limited: 'Limited free tier', trial: 'Free trial', no: 'No free tier', unknown: 'Unverified',
} as const;

export const COMMERCIAL_LABELS = {
  yes: 'Allowed', 'paid-plans': 'Paid plans only', restricted: 'Restricted', no: 'Not allowed', unknown: 'Unverified',
} as const;

export const STATUS_LABELS = {
  active: 'Active', beta: 'Beta', research: 'Research demo', discontinued: 'Discontinued',
} as const;

export const list = (xs: readonly string[], labels?: Record<string, string>) =>
  xs.length ? xs.map((x) => labels?.[x] ?? x.toUpperCase()).join(', ') : 'Unverified';

export const price = (t: Tool) => {
  const p = t.data.pricing;
  if (p.model === 'free' || p.model === 'open-source') return 'Free';
  if (p.starting_price_usd !== null) {
    return p.model === 'one-time' ? `$${p.starting_price_usd} one-time` : `From $${p.starting_price_usd}/mo`;
  }
  return 'Unverified';
};

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const outboundUrl = (t: Tool) => t.data.affiliate?.url ?? t.data.url;
export const outboundRel = (t: Tool) =>
  t.data.affiliate?.url || t.data.sponsored ? 'sponsored noopener' : 'noopener';

/** Lowercase for mid-sentence use, keeping acronyms such as AI, 2D, 3D and NPCs intact. */
export const lc = (s: string) =>
  s.split(' ').map((w) => (/^[A-Z0-9]{2,}s?$/.test(w) ? w : w.toLowerCase())).join(' ');
