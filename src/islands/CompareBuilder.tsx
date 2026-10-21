import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CircleDashed, CircleHelp, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { siteLinks, logoSrc } from '@/lib/links';
import { getCompare, setCompare } from '@/lib/compare-store';
import { monogram } from '@/components/site/ToolLogo';
import { readJson } from './data';

type Plan = { name: string; price_usd: number | null; period: string; includes?: string };
type T = {
  id: string; name: string; host: string; best: string; catLabel: string; cats: string[]; score: number;
  free: string; freeLabel: string; price: number | null; priceLabel: string; commercial: string; commercialLabel: string;
  engines: string; exports: string; platforms: string; skill: string; status: string; owned: boolean;
  features: Record<string, string>; plans: Plan[];
};
type Data = { tools: T[]; features: Record<string, { key: string; label: string }[]>; categories: Record<string, string>; pairs: string[] };
type Preset = { label: string; ids: string[] };

const MAX = 4;
const FREE: Record<string, number> = { yes: 4, limited: 3, trial: 2, no: 1 };
const COMM: Record<string, number> = { yes: 4, 'paid-plans': 3, restricted: 2, no: 1 };
const FEAT: Record<string, number> = { yes: 2, partial: 1, no: 0 };

function Logo({ t, size = 'size-7' }: { t: T; size?: string }) {
  const { initials, hue } = monogram(t.name);
  const [ok, setOk] = useState(false);
  return (
    <span className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-md border text-[10px] font-bold text-white', size)} style={{ background: `oklch(0.5 0.14 ${hue})` }}>
      {initials}
      <img src={logoSrc(t.host)} alt="" referrerPolicy="no-referrer" className={ok ? 'bg-card absolute inset-0 size-full object-contain p-1' : 'hidden'} onLoad={(e) => setOk(e.currentTarget.naturalWidth > 16)} onError={() => setOk(false)} />
    </span>
  );
}

function Mark({ v }: { v?: string }) {
  if (v === 'yes') return <span className="text-success inline-flex items-center gap-1.5 font-medium"><Check className="size-4" />Yes</span>;
  if (v === 'partial') return <span className="text-warning inline-flex items-center gap-1.5 font-medium"><CircleDashed className="size-4" />Partly</span>;
  if (v === 'no') return <span className="text-destructive inline-flex items-center gap-1.5 font-medium"><X className="size-4" />No</span>;
  return <span className="text-muted-foreground inline-flex items-center gap-1.5"><CircleHelp className="size-4" />Not confirmed</span>;
}

const shown = (s: string, price = false) => (s === 'Unverified' ? <span className="text-muted-foreground">{price ? 'See site for pricing' : 'Not listed'}</span> : s);

export function CompareBuilder({ presets }: { presets: Preset[] }) {
  const data = readJson<Data>('compare-data', { tools: [], features: {}, categories: {}, pairs: [] });
  const byId = useMemo(() => new Map(data.tools.map((t) => [t.id, t])), [data.tools]);
  const links = siteLinks();
  const [ids, setIds] = useState<string[]>(() => {
    const fromUrl = (new URLSearchParams(location.search).get('tools') ?? '').split(',').filter((id) => byId.has(id));
    return (fromUrl.length ? fromUrl : getCompare().filter((id) => byId.has(id))).slice(0, MAX);
  });
  const [open, setOpen] = useState(false);
  const [onlyDiff, setOnlyDiff] = useState(false);

  useEffect(() => {
    const url = new URL(location.href);
    if (ids.length) url.searchParams.set('tools', ids.join(','));
    else url.searchParams.delete('tools');
    history.replaceState(null, '', url);
    setCompare(ids);
  }, [ids]);

  const tools = ids.map((id) => byId.get(id)!).filter(Boolean);
  const add = (id: string) => setIds((cur) => (cur.includes(id) || cur.length >= MAX ? cur : [...cur, id]));
  const remove = (id: string) => setIds((cur) => cur.filter((x) => x !== id));

  type Row = { label: string; cells: React.ReactNode[]; keys: string[]; best?: (number | null)[]; mode?: 'max' | 'min'; group?: string };
  const rows: Row[] = [];
  const push = (label: string, cell: (t: T) => React.ReactNode, key: (t: T) => string, score?: (t: T) => number | null, mode: 'max' | 'min' = 'max') =>
    rows.push({ label, cells: tools.map(cell), keys: tools.map(key), best: score ? tools.map(score) : undefined, mode });
  push('Score', (t) => <span className="font-semibold tabular-nums">{t.score}/100</span>, (t) => String(t.score), (t) => t.score);
  push('Best for', (t) => <span className="text-muted-foreground">{t.best}</span>, (t) => t.best);
  push('Category', (t) => t.catLabel, (t) => t.catLabel);
  push('Free tier', (t) => shown(t.freeLabel), (t) => t.freeLabel, (t) => FREE[t.free] ?? null);
  push('Starting price', (t) => shown(t.priceLabel, true), (t) => t.priceLabel, (t) => t.price, 'min');
  push('Commercial use', (t) => shown(t.commercialLabel), (t) => t.commercialLabel, (t) => COMM[t.commercial] ?? null);
  push(
    'Plans',
    (t) =>
      t.plans.length ? (
        <ul className="space-y-0.5">
          {t.plans.map((p) => (
            <li key={p.name}>
              {p.name}
              <span className="text-muted-foreground">: {p.price_usd === null ? 'custom' : p.price_usd === 0 ? 'free' : `$${p.price_usd}${p.period === 'one-time' ? ' once' : '/mo'}`}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-muted-foreground">See vendor site</span>
      ),
    (t) => t.plans.map((p) => p.name + p.price_usd).join(),
  );
  push('Engines', (t) => shown(t.engines), (t) => t.engines);
  push('Exports', (t) => shown(t.exports), (t) => t.exports);
  push('Runs on', (t) => shown(t.platforms), (t) => t.platforms);
  push('Skill level', (t) => t.skill, (t) => t.skill);
  const seen = new Set<string>();
  for (const c of [...new Set(tools.flatMap((t) => t.cats))]) {
    const defs = (data.features[c] ?? []).filter((f) => !seen.has(f.key) && seen.add(f.key)).filter((f) => tools.some((t) => t.features[f.key] !== undefined));
    if (!defs.length) continue;
    rows.push({ label: `${data.categories[c]} features`, cells: [], keys: [], group: c });
    for (const f of defs) push(f.label, (t) => <Mark v={t.features[f.key]} />, (t) => t.features[f.key] ?? '', (t) => FEAT[t.features[f.key] ?? ''] ?? null);
  }

  const bestIdx = (r: Row) => {
    if (!r.best) return new Set<number>();
    const nums = r.best.filter((v): v is number => v !== null);
    if (nums.length < 2) return new Set<number>();
    const target = r.mode === 'min' ? Math.min(...nums) : Math.max(...nums);
    if (nums.every((v) => v === target)) return new Set<number>();
    return new Set(r.best.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0));
  };
  const pair = tools.length === 2 ? [tools[0].id, tools[1].id].sort().join('-vs-') : '';

  return (
    <div className="space-y-6">
      <Card className="gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {tools.map((t) => (
            <Badge key={t.id} variant="outline" className="h-9 gap-2 rounded-lg pr-1 pl-1.5 text-sm">
              <Logo t={t} size="size-6" />
              <a href={links.tool(t.id)} className="font-medium hover:underline">{t.name}</a>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => remove(t.id)} aria-label={`Remove ${t.name}`}>
                <X className="size-3.5" />
              </Button>
            </Badge>
          ))}
          {tools.length < MAX && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 border-dashed">
                  <Plus /> {tools.length ? 'Add tool' : 'Choose tools to compare'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tools…" />
                  <CommandList>
                    <CommandEmpty>No tools found.</CommandEmpty>
                    <CommandGroup>
                      {data.tools.filter((t) => !ids.includes(t.id)).map((t) => (
                        <CommandItem key={t.id} value={`${t.name} ${t.catLabel}`} onSelect={() => { add(t.id); setOpen(false); }}>
                          <Logo t={t} />
                          <span className="truncate">{t.name}</span>
                          <span className="text-muted-foreground ml-auto truncate pl-2 text-xs">{t.catLabel.split(',')[0]}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          <span className="text-muted-foreground ml-auto text-xs">{tools.length}/{MAX} tools</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Quick start:</span>
          {presets.map((p) => (
            <Button key={p.label} variant="secondary" size="sm" className="h-7 rounded-full text-xs" onClick={() => setIds(p.ids.filter((id) => byId.has(id)).slice(0, MAX))}>
              {p.label}
            </Button>
          ))}
        </div>
      </Card>

      {tools.length < 2 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          {tools.length ? 'Add one more tool to see them side by side.' : 'Pick at least two tools, or start from a category above.'}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="builder-diff" checked={onlyDiff} onCheckedChange={setOnlyDiff} />
              <Label htmlFor="builder-diff">Only show differences</Label>
            </div>
            <span className="text-muted-foreground text-xs">★ best in row</span>
          </div>
          <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-28 sm:w-44">Fact</TableHead>
                  {tools.map((t) => (
                    <TableHead key={t.id} className="w-56">
                      <a href={links.tool(t.id)} className="text-foreground inline-flex items-center gap-2 font-medium hover:underline">
                        <Logo t={t} /> <span className="truncate">{t.name}</span>
                      </a>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  if (r.group)
                    return (
                      <TableRow key={`g${i}`} className="bg-muted/60 hover:bg-muted/60">
                        <TableCell colSpan={tools.length + 1} className="text-muted-foreground py-2 text-xs font-semibold tracking-wide uppercase">{r.label}</TableCell>
                      </TableRow>
                    );
                  const same = r.keys.every((k) => k === r.keys[0]);
                  if (onlyDiff && same) return null;
                  const best = bestIdx(r);
                  return (
                    <TableRow key={r.label + i}>
                      <TableCell className="text-muted-foreground align-top text-sm font-medium whitespace-normal">{r.label}</TableCell>
                      {r.cells.map((c, j) => (
                        <TableCell key={j} className={cn('align-top text-sm whitespace-normal', best.has(j) && 'bg-success/10')}>
                          {c}
                          {best.has(j) && <span className="text-star ml-1">★</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {tools.some((t) => t.owned) && (
            <p className="text-muted-foreground text-xs">Disclosure: Makko is built by the team that runs this site and is scored by the same rules.</p>
          )}
          {data.pairs.includes(pair) && (
            <Button asChild>
              <a href={links.pair(pair)}>
                Read the full {tools[0].name} vs {tools[1].name} verdict <ArrowRight />
              </a>
            </Button>
          )}
        </>
      )}
    </div>
  );
}
