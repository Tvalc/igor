import { cn } from '@/lib/utils';
import { logoSrc } from '@/lib/links';

const SIZES = { sm: 'size-8 rounded-md text-[11px]', md: 'size-11 rounded-lg text-sm', lg: 'size-16 rounded-xl text-xl' };

export function monogram(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const words = name.replace(/\(.*?\)/g, '').split(/[\s.\-&]+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  return { initials, hue: hash % 360 };
}

/** Vendor logo from the tool's own site icon, over a monogram that shows until (or instead of) the image. */
export function ToolLogo({ name, url, size = 'md', className }: { name: string; url: string; size?: keyof typeof SIZES; className?: string }) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const { initials, hue } = monogram(name);
  // GitHub repos would all show GitHub's icon, which says nothing about the tool.
  const src = host === 'github.com' ? null : logoSrc(host);
  return (
    <span className={cn('logo bg-card relative inline-grid shrink-0 place-items-center overflow-hidden border', SIZES[size], className)}>
      <span
        aria-hidden="true"
        className="font-display absolute inset-0 grid place-items-center font-bold text-white"
        style={{ background: `oklch(0.5 0.14 ${hue})` }}
      >
        {initials}
      </span>
      {src && <img data-logo src={src} alt="" width={64} height={64} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="relative z-10 hidden size-[70%] object-contain" />}
    </span>
  );
}
