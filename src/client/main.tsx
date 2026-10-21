// One client entry for every page: mounts the interactive islands found in the HTML. Mounting from a regular
// script (rather than Astro's island loader) keeps everything in one bundle that also runs in sandboxed previews.
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import { SearchCommand } from '@/islands/SearchCommand';
import { ThemeToggle } from '@/islands/ThemeToggle';
import { CompareTray } from '@/islands/CompareTray';
import { FilterPanel } from '@/islands/FilterPanel';
import { CompareBuilder } from '@/islands/CompareBuilder';
import { DiffSwitch } from '@/islands/DiffSwitch';
import { MobileNav } from '@/islands/MobileNav';

const ISLANDS: Record<string, ComponentType<any>> = {
  search: SearchCommand,
  theme: ThemeToggle,
  tray: CompareTray,
  filters: FilterPanel,
  builder: CompareBuilder,
  diff: DiffSwitch,
  nav: MobileNav,
};

for (const el of document.querySelectorAll<HTMLElement>('[data-island]')) {
  const Comp = ISLANDS[el.dataset.island!];
  if (!Comp) continue;
  let props = {};
  try {
    props = el.dataset.props ? JSON.parse(el.dataset.props) : {};
  } catch {
    /* bad props: mount with defaults */
  }
  if (el.dataset.island === 'filters') document.getElementById('listing-toolbar')?.replaceChildren();
  createRoot(el).render(<Comp {...props} />);
}
