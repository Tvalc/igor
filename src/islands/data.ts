// Page data embedded by Base.astro as JSON, read by the client-side islands.
export type SearchItem = { id: string; name: string; cat: string; price: string; host: string; text: string };
export type ListItem = { slug: string; title: string; count: number };

export function readJson<T>(id: string, fallback: T): T {
  const el = document.getElementById(id);
  if (!el?.textContent) return fallback;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return fallback;
  }
}
