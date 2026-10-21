import { Progress } from '@/components/ui/progress';
import { FACTOR_LABELS, WEIGHTS, type Factor, type Group, type Scored } from '@/lib/score';

export function ScoreBars({ scored, group }: { scored: Scored; group: Group }) {
  const keys = Object.keys(scored.factors) as Factor[];
  return (
    <ul className="space-y-4">
      {keys.map((k) => {
        const v = Math.round(scored.factors[k] * 100);
        return (
          <li key={k} className="grid grid-cols-[minmax(8rem,12rem)_1fr_2.5rem] items-center gap-4 text-sm">
            <span title={FACTOR_LABELS[k].question}>
              {FACTOR_LABELS[k].label} <span className="text-muted-foreground text-xs">{Math.round(WEIGHTS[group][k] * 100)}%</span>
            </span>
            <Progress value={v} aria-label={`${FACTOR_LABELS[k].label}: ${v} out of 100`} />
            <span className="text-right font-medium tabular-nums">{v}</span>
          </li>
        );
      })}
    </ul>
  );
}
