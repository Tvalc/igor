import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Tool } from '@/lib/score';

const PERIOD: Record<string, string> = { month: '/mo', year: '/mo, billed yearly', 'one-time': ' one-time', usage: ' pay as you go', free: '', custom: '' };

export function Plans({ tool }: { tool: Tool }) {
  const plans = tool.data.plans;
  const paid = plans.filter((p) => p.price_usd && p.period !== 'usage');
  const entry = paid.length ? paid.reduce((a, b) => (b.price_usd! < a.price_usd! ? b : a)) : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((p) => (
        <Card key={p.name} className={cn('gap-2 px-5 py-5', p === entry && 'border-brand ring-brand/20 ring-2')}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm font-medium">{p.name}</span>
            {p === entry && <Badge variant="brand">Cheapest paid</Badge>}
          </div>
          <div className="font-display text-2xl font-semibold tracking-tight">
            {p.price_usd === null ? 'Custom' : p.price_usd === 0 ? 'Free' : `$${p.price_usd}`}
            {p.price_usd ? <span className="text-muted-foreground font-sans text-sm font-normal">{PERIOD[p.period]}</span> : null}
          </div>
          {p.includes && <p className="text-muted-foreground text-sm">{p.includes}</p>}
        </Card>
      ))}
    </div>
  );
}
