import * as React from 'react';

import { cn } from '@/lib/utils';

// Static progress bar with the shadcn look; no client JS needed for a fixed value.
function Progress({ className, value = 0, ...props }: React.ComponentProps<'div'> & { value?: number }) {
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn('bg-primary/15 relative h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div data-slot="progress-indicator" className="bg-brand h-full rounded-full transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export { Progress };
