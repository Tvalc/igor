import { cn } from '@/lib/utils';

/** Score out of 100 as five stars (20 points each) with the number beside it. */
export function Stars({ score, compact = false, className }: { score: number; compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)} role="img" aria-label={`Score ${score} out of 100`}>
      <span aria-hidden="true" className="relative inline-block text-[15px] leading-none tracking-[1px] text-muted-foreground/30">
        ★★★★★
        <span className="text-star absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${score}%` }}>
          ★★★★★
        </span>
      </span>
      <span aria-hidden="true" className="text-sm font-semibold tabular-nums">
        {score}
        {!compact && <span className="text-muted-foreground text-xs font-normal">/100</span>}
      </span>
    </span>
  );
}
