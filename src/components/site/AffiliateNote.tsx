import { cn } from '@/lib/utils';

/** Shown next to a Visit link that earns us a commission, so the disclosure sits beside the link itself. */
export function AffiliateNote({ className }: { className?: string }) {
  return (
    <a href="/disclosure" className={cn('text-muted-foreground text-[11px] hover:underline', className)}>
      Affiliate link
    </a>
  );
}
