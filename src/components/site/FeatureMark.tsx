import { Check, CircleDashed, CircleHelp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAP = {
  yes: { Icon: Check, text: 'Yes', cls: 'text-success' },
  partial: { Icon: CircleDashed, text: 'Partly', cls: 'text-warning' },
  no: { Icon: X, text: 'No', cls: 'text-destructive' },
  unknown: { Icon: CircleHelp, text: 'Not confirmed', cls: 'text-muted-foreground font-normal' },
} as const;

/** One feature cell. Unknown means we have no source either way, never "no". */
export function FeatureMark({ value, note }: { value?: string; note?: string }) {
  const m = MAP[(value as keyof typeof MAP) ?? 'unknown'] ?? MAP.unknown;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', m.cls)} title={note}>
      <m.Icon className="size-4" aria-hidden="true" />
      {m.text}
    </span>
  );
}
