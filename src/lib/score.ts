import type { CollectionEntry } from 'astro:content';
import { featuresFor } from './features';

export type Tool = CollectionEntry<'tools'>;
export type Group = 'maker' | 'art' | 'code' | 'audio';
export type Factor = 'access' | 'output' | 'rights' | 'value' | 'maturity' | 'fit' | 'features';

// The published rubric. /methodology renders these tables, so the page can't drift from the math.
export const FACTOR_LABELS: Record<Factor, { label: string; question: string }> = {
  access: { label: 'Accessibility', question: 'Can a beginner start for free without installing or coding?' },
  output: { label: 'Output & integration', question: 'Where can the results go: export formats, platforms, engines?' },
  rights: { label: 'Commercial rights', question: 'Can you ship what it makes, and on which plans?' },
  value: { label: 'Value', question: 'How much does it cost to get real use out of it?' },
  maturity: { label: 'Maturity', question: 'Is it a stable product, a beta, or a research demo?' },
  fit: { label: 'Game focus', question: 'Is it built for game development, or a general tool that can also make games?' },
  features: { label: 'Features', question: "How much of its category's feature checklist does the vendor confirm it has?" },
};

// Features take 15%; the other factors keep their relative weights in the remaining 85%.
const FEATURE_WEIGHT = 0.15;
const BASE: Record<Group, Record<Exclude<Factor, 'features'>, number>> = {
  maker: { access: 0.3, output: 0.2, rights: 0.15, value: 0.1, maturity: 0.1, fit: 0.15 },
  art: { access: 0.2, output: 0.25, rights: 0.25, value: 0.1, maturity: 0.1, fit: 0.1 },
  code: { access: 0.15, output: 0.25, rights: 0.15, value: 0.1, maturity: 0.15, fit: 0.2 },
  audio: { access: 0.25, output: 0.2, rights: 0.25, value: 0.1, maturity: 0.1, fit: 0.1 },
};
export const WEIGHTS = Object.fromEntries(
  Object.entries(BASE).map(([g, w]) => [
    g,
    { ...Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v * (1 - FEATURE_WEIGHT)])), features: FEATURE_WEIGHT },
  ]),
) as Record<Group, Record<Factor, number>>;

export const GROUP_LABELS: Record<Group, string> = {
  maker: 'AI game makers',
  art: 'Art, 3D & animation',
  code: 'Coding & engine tools',
  audio: 'Audio, voice & NPCs',
};

// Unknown facts score below the middle, so verifying a tool can only move it in the direction the facts point.
const FREE_TIER = { yes: 1, limited: 0.8, trial: 0.55, no: 0.25, unknown: 0.45 } as const;
const SKILL = { beginner: 1, intermediate: 0.65, advanced: 0.35 } as const;
const COMMERCIAL = { yes: 1, 'paid-plans': 0.75, restricted: 0.4, no: 0, unknown: 0.45 } as const;
const MODEL_VALUE = {
  free: 1, 'open-source': 1, 'one-time': 0.85, freemium: 0.75, bundled: 0.6, trial: 0.55, paid: 0.5,
} as const;
const STATUS = { active: 1, beta: 0.6, research: 0.2, discontinued: 0 } as const;
// Unconfirmed features score below Partly, so confirming them can only move a tool the way the facts point.
const FEATURE = { yes: 1, partial: 0.6, no: 0 } as Record<string, number>;
const FEATURE_UNKNOWN = 0.4;
const GROUP_CATEGORIES: Record<Group, string[]> = {
  maker: ['game-maker'],
  art: ['art-2d', 'art-3d', 'texture', 'animation'],
  code: ['code'],
  audio: ['voice', 'music', 'sfx', 'npc'],
};

export function groupOf(tool: Tool): Group {
  const c = tool.data.categories[0];
  if (c === 'game-maker') return 'maker';
  if (c === 'code') return 'code';
  if (c === 'voice' || c === 'music' || c === 'sfx' || c === 'npc') return 'audio';
  return 'art';
}

export function factors(tool: Tool, group: Group): Record<Factor, number> {
  const d = tool.data;
  const skillWeight = group === 'code' ? 0.2 : 0.4;
  const access = (1 - skillWeight) * FREE_TIER[d.pricing.free_tier] + skillWeight * SKILL[d.skill_level];

  const reach = d.exports.length + d.engines.length;
  const output = reach === 0 ? 0.4 : Math.min(1, 0.3 + reach * 0.14);

  const rights = Math.min(1, COMMERCIAL[d.license.commercial_use] + (d.license.open_source ? 0.1 : 0));

  let value: number = MODEL_VALUE[d.pricing.model];
  const p = d.pricing.starting_price_usd;
  if (p !== null && p > 0) value = Math.min(value, p <= 15 ? 0.9 : p <= 30 ? 0.75 : p <= 60 ? 0.6 : 0.4);

  const fit = d.tags.includes('general-purpose') ? 0.4 : 1;

  // The checklists for the tool's categories in this group (all its categories if none fall in the group).
  const inGroup = d.categories.filter((c) => GROUP_CATEGORIES[group].includes(c));
  const checklist = featuresFor(inGroup.length ? inGroup : d.categories);
  const have = d.features as Record<string, string>;
  const features = checklist.length
    ? checklist.reduce((sum, f) => sum + (have[f.key] ? FEATURE[have[f.key]] : FEATURE_UNKNOWN), 0) / checklist.length
    : FEATURE_UNKNOWN;

  return { access, output, rights, value, maturity: STATUS[d.status], fit, features };
}

export interface Scored {
  tool: Tool;
  score: number; // 0–100
  factors: Record<Factor, number>;
  handsOn: boolean;
}

export function scoreTool(tool: Tool, group: Group = groupOf(tool)): Scored {
  const f = factors(tool, group);
  const w = WEIGHTS[group];
  let facts = 0;
  for (const k of Object.keys(w) as Factor[]) facts += w[k] * f[k];
  const h = tool.data.hands_on;
  const combined = h ? 0.5 * facts + 0.5 * (h.score / 10) : facts;
  return { tool, score: Math.round(combined * 100), factors: f, handsOn: Boolean(h) };
}

export function rank(tools: Tool[], group: Group): Scored[] {
  return tools
    .filter((t) => t.data.status !== 'discontinued')
    .map((t) => scoreTool(t, group))
    .sort((a, b) => b.score - a.score || a.tool.data.name.localeCompare(b.tool.data.name));
}

/** The strongest factors, for "why it ranks here" copy. */
export function strengths(s: Scored, n = 2): Factor[] {
  return (Object.keys(s.factors) as Factor[])
    .filter((k) => s.factors[k] >= 0.75)
    .sort((a, b) => s.factors[b] - s.factors[a])
    .slice(0, n);
}
