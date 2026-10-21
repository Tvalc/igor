import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Scored } from '@/lib/score';
import { fromPrice, priceHeadline } from '@/lib/compare';
import { CATEGORY_LABELS, ENGINE_LABELS, STATUS_LABELS, outboundRel, outboundUrl } from '@/lib/format';
import { ToolLogo } from './ToolLogo';
import { Stars } from './Stars';
import { ProsCons } from './ProsCons';

type Props = { scored: Scored; rank?: number; pick?: string; details?: boolean; as?: 'li' | 'div' };

/** The product card used on every listing. Facts ride along as data attributes for the client-side filters. */
export function ToolCard({ scored, rank, pick, details = false, as = 'li' }: Props) {
  const t = scored.tool;
  const d = t.data;
  const dead = d.status === 'discontinued';
  const p = fromPrice(t);
  const price = priceHeadline(t);
  const badges: [string, 'pick' | 'success' | 'brand' | 'secondary'][] = [];
  if (pick) badges.push([pick, 'pick']);
  if (d.pricing.free_tier === 'yes') badges.push(['Free plan', 'success']);
  if (d.license.commercial_use === 'yes') badges.push(['Commercial use OK', 'success']);
  if (d.skill_level === 'beginner') badges.push(['Beginner friendly', 'brand']);
  if (d.license.open_source) badges.push(['Open source', 'brand']);
  if (d.status !== 'active') badges.push([STATUS_LABELS[d.status], 'secondary']);
  const Tag = as;

  return (
    <Tag
      className="relative list-none"
      data-item
      data-id={t.id}
      data-name={d.name}
      data-text={`${d.name} ${d.tagline} ${d.tags.join(' ')}`.toLowerCase()}
      data-cats={d.categories.join(' ')}
      data-engines={d.engines.join(' ')}
      data-exports={d.exports.join(' ')}
      data-free={d.pricing.free_tier}
      data-price={p ?? ''}
      data-commercial={d.license.commercial_use}
      data-skill={d.skill_level}
      data-score={dead ? -1 : scored.score}
      data-rank={rank}
    >
      {rank && (
        <span
          className={cn(
            'font-display absolute -top-2.5 -left-2.5 z-10 grid size-7 place-items-center rounded-full text-xs font-bold shadow-sm ring-4 ring-background',
            rank === 1 ? 'bg-pick text-pick-foreground' : 'bg-primary text-primary-foreground',
          )}
        >
          {rank}
        </span>
      )}
      <Card className="group h-full gap-4 py-5 transition-shadow hover:shadow-md">
        <div className={cn('grid gap-4 px-5', details ? 'sm:grid-cols-[auto_1fr_auto]' : 'grid-cols-[auto_1fr]')}>
          <ToolLogo name={d.name} url={d.url} />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold">
                <a href={`/tools/${t.id}`} className="after:absolute after:inset-0 hover:underline">
                  {d.name}
                </a>
              </h3>
              {!dead && <Stars score={scored.score} compact />}
              {d.makko_owned && (
                <Badge variant="outline" className="relative z-10 border-amber-400/60 text-amber-700 dark:text-amber-300" title="Built by the team that runs this site">
                  Our team
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">{details ? d.best_for : d.tagline}</p>
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {badges.map(([b, v]) => (
                  <Badge key={b} variant={v}>
                    {b}
                  </Badge>
                ))}
              </div>
            )}
            {details && (
              <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>
                  <span className="text-foreground font-medium">Type:</span> {d.categories.map((c) => CATEGORY_LABELS[c]).join(', ')}
                </span>
                {d.engines.length > 0 && (
                  <span>
                    <span className="text-foreground font-medium">Engines:</span> {d.engines.map((e) => ENGINE_LABELS[e]).join(', ')}
                  </span>
                )}
              </p>
            )}
          </div>
          <div
            className={cn(
              'relative z-10 flex items-center justify-between gap-3',
              details ? 'col-span-full border-t pt-4 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0' : 'col-span-full border-t pt-4',
            )}
          >
            <div className={cn(details && 'sm:text-right')}>
              <div className="font-display text-base font-semibold whitespace-nowrap">
                {price.main !== 'See site for pricing' ? price.main : <span className="text-muted-foreground text-sm font-normal">{price.main}</span>}
              </div>
              {price.sub && <div className="text-muted-foreground text-xs">{price.sub}</div>}
            </div>
            {!dead && (
              <div className="flex items-center gap-3">
                <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                  <input type="checkbox" data-compare={t.id} aria-label={`Compare ${d.name}`} className="accent-brand size-4 rounded" />
                  Compare
                </label>
                <Button asChild size="sm">
                  <a href={outboundUrl(t)} rel={outboundRel(t)} target="_blank">
                    Visit <ArrowUpRight />
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
        {details && (
          <div className="relative z-10 border-t px-5 pt-4">
            <ProsCons tool={t} max={3} />
          </div>
        )}
      </Card>
    </Tag>
  );
}
