import { Minus, Plus } from 'lucide-react';
import type { Tool } from '@/lib/score';
import { prosCons } from '@/lib/proscons';

export function ProsCons({ tool, max = 4 }: { tool: Tool; max?: number }) {
  const { pros, cons } = prosCons(tool);
  if (!pros.length && !cons.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {pros.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Pros</p>
          <ul className="space-y-1.5 text-sm">
            {pros.slice(0, max).map((p) => (
              <li key={p} className="flex gap-2">
                <Plus className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cons.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Cons</p>
          <ul className="space-y-1.5 text-sm">
            {cons.slice(0, max).map((c) => (
              <li key={c} className="flex gap-2">
                <Minus className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
