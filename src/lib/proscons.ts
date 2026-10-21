import type { Tool } from './score';
import { featuresFor } from './features';
import { ENGINE_LABELS, EXPORT_LABELS } from './format';

// Pros and cons come straight from verified facts. A fact we haven't verified is never a con: it goes in
// `unverified` so the page can say so plainly.
export function prosCons(t: Tool) {
  const d = t.data;
  const pros: string[] = [];
  const cons: string[] = [];
  const unverified: string[] = [];

  if (d.pricing.free_tier === 'yes') pros.push('Free plan available');
  else if (d.pricing.free_tier === 'limited') pros.push('Limited free tier');
  else if (d.pricing.free_tier === 'trial') cons.push('Free trial only, no free plan');
  else if (d.pricing.free_tier === 'no') cons.push('No free tier');

  if (d.license.commercial_use === 'yes') pros.push('Commercial use allowed');
  else if (d.license.commercial_use === 'paid-plans') cons.push('Commercial use on paid plans only');
  else if (d.license.commercial_use === 'restricted') cons.push('Commercial use is restricted');
  else if (d.license.commercial_use === 'no') cons.push('No commercial use');

  if (d.license.open_source) pros.push('Open source');
  if (d.skill_level === 'beginner') pros.push(d.categories.includes('game-maker') ? 'No coding needed' : 'Beginner friendly');
  if (d.skill_level === 'advanced') cons.push('Needs technical skills');
  if (d.engines.length) pros.push(`Works with ${d.engines.map((e) => ENGINE_LABELS[e]).slice(0, 3).join(', ')}`);
  if (d.exports.length >= 3) pros.push(`Exports ${d.exports.slice(0, 3).map((e) => EXPORT_LABELS[e]).join(', ')}`);
  if (d.status === 'beta') cons.push('Still in beta');
  if (d.status === 'research') cons.push('Research demo, not a product you can use');

  const defs = featuresFor(d.categories);
  for (const f of defs) {
    const v = d.features[f.key];
    if (v === 'yes') pros.push(f.label);
    else if (v === 'no') cons.push(`No ${f.label.charAt(0).toLowerCase()}${f.label.slice(1)}`);
    else if (v === 'partial') cons.push(`${f.label}: limited${d.feature_notes[f.key] ? ` (${d.feature_notes[f.key]})` : ''}`);
  }

  for (const k of d.needs_verification) unverified.push(`${k[0].toUpperCase()}${k.slice(1)} not yet verified`);
  return { pros, cons, unverified };
}
