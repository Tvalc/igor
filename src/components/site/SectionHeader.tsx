import { ArrowRight } from 'lucide-react';

export function SectionHeader({ title, href, cta, description }: { title: string; href?: string; cta?: string; description?: string }) {
  return (
    <div className="mt-16 mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold sm:text-[1.7rem]">{title}</h2>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {href && cta && (
        <a href={href} className="text-brand inline-flex items-center gap-1 text-sm font-medium hover:underline">
          {cta} <ArrowRight className="size-4" />
        </a>
      )}
    </div>
  );
}
