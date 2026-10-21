import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type Opt = { value: string; label: string; count?: number };
export type FilterConfig = {
  search: boolean;
  categories: Opt[];
  prices: Opt[];
  commercialCount: number;
  beginnerCount: number;
  engines: Opt[];
  exports: Opt[];
  sorts: Opt[];
  views: boolean;
  noun: string;
};

type State = { q: string; cat: string; price: string; engine: string; exp: string; commercial: boolean; beginner: boolean; sort: string };
const FREE = new Set(['yes', 'limited']);
const COMMERCIAL = new Set(['yes', 'paid-plans']);

function initial(cfg: FilterConfig): State {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get('q') ?? '',
    cat: p.get('category') ?? p.get('cat') ?? '',
    price: '',
    engine: '',
    exp: '',
    commercial: false,
    beginner: false,
    sort: cfg.sorts[0]?.value ?? 'score',
  };
}

/** Sidebar filters, sort and active chips for a server-rendered list of [data-item] cards. */
export function FilterPanel({ config: cfg }: { config: FilterConfig }) {
  const [s, setS] = useState<State>(() => initial(cfg));
  const [shown, setShown] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const list = document.querySelector<HTMLElement>('[data-items]');
  const items = useMemo(() => [...(list?.querySelectorAll<HTMLElement>('[data-item]') ?? [])], [list]);
  const toolbar = document.getElementById('listing-toolbar');
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    if (!list) return;
    let n = 0;
    const q = s.q.trim().toLowerCase();
    for (const el of items) {
      const d = el.dataset;
      const p = d.price === '' ? null : Number(d.price);
      const ok =
        (!q || d.text!.includes(q)) &&
        (!s.cat || d.cats!.split(' ').includes(s.cat)) &&
        (!s.engine || d.engines!.split(' ').includes(s.engine)) &&
        (!s.exp || d.exports!.split(' ').includes(s.exp)) &&
        (!s.price || (s.price === 'free' ? FREE.has(d.free!) : p !== null && p <= Number(s.price))) &&
        (!s.commercial || COMMERCIAL.has(d.commercial!)) &&
        (!s.beginner || d.skill === 'beginner');
      el.hidden = !ok;
      if (ok) n++;
    }
    const key = (el: HTMLElement) =>
      s.sort === 'name' ? el.dataset.name!.toLowerCase()
      : s.sort === 'price' ? (el.dataset.price === '' ? Infinity : Number(el.dataset.price))
      : s.sort === 'rank' ? Number(el.dataset.rank ?? 0)
      : -Number(el.dataset.score);
    list.append(
      ...[...items].sort((a, b) => {
        const x = key(a);
        const y = key(b);
        return x < y ? -1 : x > y ? 1 : a.dataset.name!.localeCompare(b.dataset.name!);
      }),
    );
    setShown(n);
    document.querySelector('[data-empty]')?.toggleAttribute('hidden', n > 0);
  }, [s, items, list]);

  useEffect(() => {
    if (!list || !cfg.views) return;
    list.className = view === 'grid' ? 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-5';
  }, [view, list, cfg.views]);

  const label = (opts: Opt[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
  const chips: [string, () => void][] = [];
  if (s.q) chips.push([`“${s.q}”`, () => set('q', '')]);
  if (s.cat) chips.push([label(cfg.categories, s.cat), () => set('cat', '')]);
  if (s.price) chips.push([label(cfg.prices, s.price), () => set('price', '')]);
  if (s.engine) chips.push([label(cfg.engines, s.engine), () => set('engine', '')]);
  if (s.exp) chips.push([label(cfg.exports, s.exp), () => set('exp', '')]);
  if (s.commercial) chips.push(['Commercial use', () => set('commercial', false)]);
  if (s.beginner) chips.push(['Beginner friendly', () => set('beginner', false)]);
  const reset = () => setS({ ...initial(cfg), q: '', cat: '', sort: s.sort });

  const panel = (
    <div className="space-y-6">
      {cfg.search && (
        <div className="space-y-2">
          <Label htmlFor="flt-q" className="text-muted-foreground text-xs tracking-wide uppercase">Search</Label>
          <Input id="flt-q" placeholder="Name or keyword" value={s.q} onChange={(e) => set('q', e.target.value)} />
        </div>
      )}
      {cfg.categories.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Category</legend>
          <RadioGroup value={s.cat} onValueChange={(v) => set('cat', v)} className="gap-2.5">
            {[{ value: '', label: 'All categories' }, ...cfg.categories].map((o) => (
              <div key={o.value || 'all'} className="flex items-center gap-2.5">
                <RadioGroupItem value={o.value} id={`cat-${o.value || 'all'}`} />
                <Label htmlFor={`cat-${o.value || 'all'}`} className="flex-1 font-normal">{o.label}</Label>
                {o.count !== undefined && <span className="text-muted-foreground text-xs tabular-nums">{o.count}</span>}
              </div>
            ))}
          </RadioGroup>
        </fieldset>
      )}
      <fieldset className="space-y-3">
        <legend className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Price</legend>
        <RadioGroup value={s.price} onValueChange={(v) => set('price', v)} className="gap-2.5">
          {[{ value: '', label: 'Any price' }, ...cfg.prices].map((o) => (
            <div key={o.value || 'any'} className="flex items-center gap-2.5">
              <RadioGroupItem value={o.value} id={`price-${o.value || 'any'}`} />
              <Label htmlFor={`price-${o.value || 'any'}`} className="flex-1 font-normal">{o.label}</Label>
              {o.count !== undefined && <span className="text-muted-foreground text-xs tabular-nums">{o.count}</span>}
            </div>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Rights &amp; skill</legend>
        <div className="flex items-center gap-2.5">
          <Checkbox id="flt-comm" checked={s.commercial} onCheckedChange={(v) => set('commercial', v === true)} />
          <Label htmlFor="flt-comm" className="flex-1 font-normal">Commercial use allowed</Label>
          <span className="text-muted-foreground text-xs tabular-nums">{cfg.commercialCount}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Checkbox id="flt-beg" checked={s.beginner} onCheckedChange={(v) => set('beginner', v === true)} />
          <Label htmlFor="flt-beg" className="flex-1 font-normal">Beginner friendly</Label>
          <span className="text-muted-foreground text-xs tabular-nums">{cfg.beginnerCount}</span>
        </div>
      </fieldset>
      {cfg.engines.length > 0 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs tracking-wide uppercase">Engine</Label>
          <Select value={s.engine || 'any'} onValueChange={(v) => set('engine', v === 'any' ? '' : v)}>
            <SelectTrigger className="w-full" aria-label="Engine"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any engine</SelectItem>
              {cfg.engines.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {cfg.exports.length > 0 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs tracking-wide uppercase">Exports</Label>
          <Select value={s.exp || 'any'} onValueChange={(v) => set('exp', v === 'any' ? '' : v)}>
            <SelectTrigger className="w-full" aria-label="Export format"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any format</SelectItem>
              {cfg.exports.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  const bar = (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium" aria-live="polite">
          {shown ?? items.length} {(shown ?? items.length) === 1 ? cfg.noun.replace(/s$/, '') : cfg.noun}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
            <SlidersHorizontal /> Filters{chips.length > 0 && <Badge variant="brand" className="px-1.5">{chips.length}</Badge>}
          </Button>
          {cfg.views && (
            <div className="bg-muted inline-flex rounded-md p-0.5" role="group" aria-label="Layout">
              <Button variant={view === 'grid' ? 'outline' : 'ghost'} size="sm" className="h-7" onClick={() => setView('grid')} aria-pressed={view === 'grid'}>
                <LayoutGrid /> Grid
              </Button>
              <Button variant={view === 'list' ? 'outline' : 'ghost'} size="sm" className="h-7" onClick={() => setView('list')} aria-pressed={view === 'list'}>
                <List /> List
              </Button>
            </div>
          )}
          <Select value={s.sort} onValueChange={(v) => set('sort', v)}>
            <SelectTrigger size="sm" className="w-44" aria-label="Sort by"><SelectValue /></SelectTrigger>
            <SelectContent>
              {cfg.sorts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(([text, clear]) => (
            <Badge key={text} variant="secondary" asChild className="cursor-pointer gap-1 py-1">
              <button type="button" onClick={clear} aria-label={`Remove filter ${text}`}>
                {text} <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button variant="link" size="sm" className="h-auto px-1" onClick={reset}>Clear all</Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="hidden lg:block">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Filters</h2>
          <Button variant="link" size="sm" className="h-auto px-0" onClick={reset}>Reset</Button>
        </div>
        <Separator className="mb-5" />
        {panel}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{panel}</div>
          <div className="bg-background sticky bottom-0 mt-auto flex gap-2 border-t p-4">
            <Button variant="outline" className="flex-1" onClick={reset}>Reset</Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>Show {shown ?? items.length}</Button>
          </div>
        </SheetContent>
      </Sheet>
      {toolbar && createPortal(bar, toolbar)}
    </>
  );
}
