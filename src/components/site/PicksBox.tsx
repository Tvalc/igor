import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Scored } from '@/lib/score';
import { computePicks } from '@/lib/picks';
import { isAffiliate, outboundData, outboundRel, outboundUrl } from '@/lib/format';
import { AffiliateNote } from './AffiliateNote';
import { ToolLogo } from './ToolLogo';
import { Stars } from './Stars';

/** "Our picks", computed from the ranking and the facts, never hand-picked. */
export function PicksBox({ ranked }: { ranked: Scored[] }) {
  const picks = computePicks(ranked);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {picks.map((p, i) => (
        <Card key={p.label} className={cn('gap-4 py-5', i === 0 && 'border-pick ring-pick/30 ring-4')}>
          <CardHeader className="px-5">
            <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase', i === 0 ? 'text-amber-700 dark:text-amber-300' : 'text-brand')}>
              {i === 0 && <Trophy className="size-3.5" />}
              {p.label}
            </span>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 px-5">
            <div className="flex items-center gap-3">
              <ToolLogo name={p.s.tool.data.name} url={p.s.tool.data.url} />
              <div className="min-w-0">
                <a href={`/tools/${p.s.tool.id}`} className="font-display block truncate font-semibold hover:underline">
                  {p.s.tool.data.name}
                </a>
                <Stars score={p.s.score} compact />
              </div>
            </div>
            <p className="text-muted-foreground flex-1 text-sm">{p.why}</p>
            <Button asChild size="sm" variant={i === 0 ? 'default' : 'outline'} className="w-full">
              <a href={outboundUrl(p.s.tool)} rel={outboundRel(p.s.tool)} target="_blank" {...outboundData(p.s.tool)}>
                Visit {p.s.tool.data.name}
              </a>
            </Button>
            {isAffiliate(p.s.tool) && <AffiliateNote className="text-center" />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
