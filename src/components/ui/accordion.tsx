import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

// shadcn Accordion styling on native <details>, so answers stay in the HTML for search engines and work without JS.
function Accordion({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="accordion" className={cn('w-full', className)} {...props} />;
}

function AccordionItem({ className, ...props }: React.ComponentProps<'details'>) {
  return <details data-slot="accordion-item" className={cn('group border-b last:border-b-0', className)} {...props} />;
}

function AccordionTrigger({ className, children, ...props }: React.ComponentProps<'summary'>) {
  return (
    <summary
      data-slot="accordion-trigger"
      className={cn(
        'focus-visible:border-ring focus-visible:ring-ring/50 flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200 group-open:rotate-180" />
    </summary>
  );
}

function AccordionContent({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="accordion-content" className="overflow-hidden text-sm" {...props}>
      <div className={cn('pt-0 pb-4', className)}>{children}</div>
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
