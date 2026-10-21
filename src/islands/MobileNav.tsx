import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export function MobileNav({ nav, lists }: { nav: { href: string; label: string }[]; lists: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto">
          <SheetHeader className="border-b">
            <SheetTitle className="font-pixel text-lg">Make AI <span className="text-brand">Games</span></SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col px-2" aria-label="Mobile">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="hover:bg-accent rounded-md px-3 py-2.5 text-sm font-medium">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="px-5 pb-6">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Popular rankings</p>
            <div className="flex flex-col">
              {lists.map((l) => (
                <a key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground py-1.5 text-sm">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
