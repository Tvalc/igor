import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Scored } from '@/lib/score';
import { priceLabel } from '@/lib/compare';
import { COMMERCIAL_LABELS, FREE_TIER_LABELS, shown } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ToolLogo } from './ToolLogo';
import { Stars } from './Stars';

export function RankTable({ ranked, limit }: { ranked: Scored[]; limit?: number }) {
  const rows = limit ? ranked.slice(0, limit) : ranked;
  const dim = (v: string) => (v === 'Unverified' ? 'text-muted-foreground' : undefined);
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Tool</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Free tier</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Commercial use</TableHead>
            <TableHead className="min-w-56">Best for</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s, i) => {
            const d = s.tool.data;
            const free = FREE_TIER_LABELS[d.pricing.free_tier];
            const price = priceLabel(s.tool);
            const comm = COMMERCIAL_LABELS[d.license.commercial_use];
            return (
              <TableRow key={s.tool.id}>
                <TableCell className="text-muted-foreground font-display font-semibold">{i + 1}</TableCell>
                <TableCell>
                  <a href={`/tools/${s.tool.id}`} className="flex min-w-44 items-center gap-2.5 font-medium hover:underline">
                    <ToolLogo name={d.name} url={d.url} size="sm" />
                    {d.name}
                    {d.makko_owned && <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">Our team</Badge>}
                  </a>
                </TableCell>
                <TableCell>
                  <Stars score={s.score} compact />
                </TableCell>
                <TableCell className={dim(free)}>{shown(free)}</TableCell>
                <TableCell className={cn('whitespace-nowrap tabular-nums', dim(price))}>{shown(price, 'price')}</TableCell>
                <TableCell className={dim(comm)}>{shown(comm)}</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-normal">{d.best_for}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
