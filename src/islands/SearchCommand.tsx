import { useEffect, useState } from 'react';
import { ListOrdered, Search } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { siteLinks, logoSrc } from '@/lib/links';
import { monogram } from '@/components/site/ToolLogo';
import { readJson, type ListItem, type SearchItem } from './data';

function Logo({ t }: { t: SearchItem }) {
  const { initials, hue } = monogram(t.name);
  const [ok, setOk] = useState(false);
  return (
    <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-md border text-[10px] font-bold text-white" style={{ background: `oklch(0.5 0.14 ${hue})` }}>
      {initials}
      <img
        src={logoSrc(t.host)}
        alt=""
        className={ok ? 'bg-card absolute inset-0 size-full object-contain p-1' : 'hidden'}
        referrerPolicy="no-referrer"
        onLoad={(e) => setOk(e.currentTarget.naturalWidth > 16)}
        onError={() => setOk(false)}
      />
    </span>
  );
}

/** ⌘K search over every tool and ranking. Opened by any element with [data-open-search]. */
export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const tools = readJson<SearchItem[]>('search-data', []);
  const lists = readJson<ListItem[]>('lists-data', []);
  const links = siteLinks();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-open-search]');
      if (!el) return;
      e.preventDefault();
      setQuery(el instanceof HTMLInputElement ? el.value : '');
      setOpen(true);
      el.blur();
    };
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement && el.matches('[data-open-search]')) {
        setQuery(el.value);
        setOpen(true);
        el.blur();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    location.href = href;
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search tools" description="Search every AI game dev tool and ranking">
      <CommandInput placeholder="Search tools, categories, engines…" value={query} onValueChange={setQuery} />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          No tools match. <button className="text-brand underline" onClick={() => go(links.directory(query))}>Search the directory</button>
        </CommandEmpty>
        <CommandGroup heading="Tools">
          {tools.map((t) => (
            <CommandItem key={t.id} value={`${t.name} ${t.text}`} onSelect={() => go(links.tool(t.id))}>
              <Logo t={t} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{t.name}</span>
                <span className="text-muted-foreground truncate text-xs">{t.cat}</span>
              </span>
              {t.price && <span className="text-muted-foreground ml-auto pl-3 text-xs whitespace-nowrap">{t.price}</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Rankings">
          {lists.map((l) => (
            <CommandItem key={l.slug} value={`best ${l.title}`} onSelect={() => go(links.list(l.slug))}>
              <ListOrdered />
              <span className="truncate">{l.title}</span>
              <span className="text-muted-foreground ml-auto text-xs">{l.count} tools</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {query && (
          <CommandGroup heading="Directory">
            <CommandItem value={`__all ${query}`} onSelect={() => go(links.directory(query))}>
              <Search />
              Search all tools for “{query}”
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
