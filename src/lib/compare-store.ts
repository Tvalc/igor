// The compare selection follows the visitor across pages. Storage can be unavailable (private mode, previews),
// so every access is guarded and the page still works with an in-memory list.
const KEY = 'mag-compare';
export const MAX_COMPARE = 4;
let memory: string[] = [];

export function getCompare(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_COMPARE) : [];
  } catch {
    return memory;
  }
}

export function setCompare(ids: string[]) {
  memory = [...new Set(ids)].slice(0, MAX_COMPARE);
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* keep the in-memory copy */
  }
  document.dispatchEvent(new CustomEvent('compare-change', { detail: memory }));
}

export function toggleCompare(id: string, on: boolean) {
  const cur = getCompare().filter((x) => x !== id);
  setCompare(on ? [...cur, id] : cur);
}
