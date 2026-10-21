import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Layers, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCompare, setCompare, toggleCompare, MAX_COMPARE } from '@/lib/compare-store';
import { siteLinks } from '@/lib/links';
import { readJson, type SearchItem } from './data';

/** Floating compare bar plus the header "Compare (n)" link. Checkboxes anywhere with data-compare feed it. */
export function CompareTray() {
  const names = new Map(readJson<SearchItem[]>('search-data', []).map((t) => [t.id, t.name]));
  const [ids, setIds] = useState<string[]>(() => getCompare().filter((id) => names.has(id)));
  const links = siteLinks();
  const onBuilder = !!document.querySelector('[data-island="builder"]');
  const slot = document.getElementById('compare-pill-slot');

  useEffect(() => {
    const sync = () => {
      const cur = getCompare().filter((id) => names.has(id));
      setIds(cur);
      document.querySelectorAll<HTMLInputElement>('input[data-compare]').forEach((b) => {
        b.checked = cur.includes(b.dataset.compare!);
        b.disabled = !b.checked && cur.length >= MAX_COMPARE;
      });
    };
    const onChange = (e: Event) => {
      const b = e.target as HTMLInputElement;
      if (b.matches?.('input[data-compare]')) toggleCompare(b.dataset.compare!, b.checked);
    };
    document.addEventListener('change', onChange);
    document.addEventListener('compare-change', sync);
    sync();
    return () => {
      document.removeEventListener('change', onChange);
      document.removeEventListener('compare-change', sync);
    };
  }, []);

  const pill =
    slot && ids.length > 0
      ? createPortal(
          <Button asChild size="sm" variant="secondary">
            <a href={links.builder(ids)}>
              <Layers /> Compare <Badge variant="brand" className="px-1.5">{ids.length}</Badge>
            </a>
          </Button>,
          slot,
        )
      : null;

  if (!ids.length || onBuilder) return pill;
  return (
    <>
      {pill}
      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
        <div className="bg-popover text-popover-foreground flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-xl border p-2.5 pl-4 shadow-xl">
          <Layers className="text-brand size-4" />
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {ids.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {names.get(id)}
                <button type="button" onClick={() => toggleCompare(id, false)} aria-label={`Remove ${names.get(id)}`} className="hover:bg-muted rounded-sm p-0.5">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            {ids.length === 1 && <span className="text-muted-foreground text-xs self-center">Add one more to compare</span>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCompare([])}>
            Clear
          </Button>
          <Button asChild size="sm" disabled={ids.length < 2}>
            <a href={ids.length < 2 ? undefined : links.builder(ids)} aria-disabled={ids.length < 2}>
              Compare now <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}
