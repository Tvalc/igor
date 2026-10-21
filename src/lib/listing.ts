// Sidebar filters, sort and active-filter chips for any page with a [data-listing] block of [data-item] cards.
// Cards carry their facts as data attributes, so this works on static HTML and needs no server.

const FREE = new Set(['yes', 'limited']);
const COMMERCIAL = new Set(['yes', 'paid-plans']);
const PRICE_LABEL: Record<string, string> = { free: 'Has a free plan', '10': 'From $10/mo or less', '25': 'From $25/mo or less', '50': 'From $50/mo or less' };

export function initListing(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('form.sidebar')!;
  const list = root.querySelector<HTMLElement>('[data-items]')!;
  const items = [...list.querySelectorAll<HTMLElement>('[data-item]')];
  const count = root.querySelector('[data-count]');
  const chips = root.querySelector<HTMLElement>('[data-chips]');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const sort = root.querySelector<HTMLSelectElement>('select[name="sort"]');
  const scrim = root.querySelector<HTMLElement>('[data-scrim]');
  const noun = root.dataset.noun ?? 'tools';

  const params = new URLSearchParams(location.search);
  for (const [k, v] of params) {
    const el = form.elements.namedItem(k);
    if (el instanceof HTMLInputElement && el.type !== 'checkbox' && el.type !== 'radio') el.value = v;
    else if (el instanceof HTMLSelectElement) el.value = v;
    else if (el instanceof RadioNodeList) el.value = v;
  }

  function apply() {
    const f = new FormData(form);
    const q = String(f.get('q') ?? '').trim().toLowerCase();
    const cat = String(f.get('cat') ?? '');
    const price = String(f.get('price') ?? '');
    const engine = String(f.get('engine') ?? '');
    const exp = String(f.get('export') ?? '');
    const commercial = f.has('commercial');
    const beginner = f.has('beginner');
    let shown = 0;
    for (const el of items) {
      const d = el.dataset;
      const p = d.price === '' ? null : Number(d.price);
      const ok =
        (!q || d.text!.includes(q)) &&
        (!cat || d.cats!.split(' ').includes(cat)) &&
        (!engine || d.engines!.split(' ').includes(engine)) &&
        (!exp || d.exports!.split(' ').includes(exp)) &&
        (!price || (price === 'free' ? FREE.has(d.free!) : p !== null && p <= Number(price))) &&
        (!commercial || COMMERCIAL.has(d.commercial!)) &&
        (!beginner || d.skill === 'beginner');
      el.hidden = !ok;
      if (ok) shown++;
    }
    if (sort) {
      const by = sort.value;
      const key = (el: HTMLElement) =>
        by === 'name' ? el.dataset.name!.toLowerCase() : by === 'price' ? (el.dataset.price === '' ? Infinity : Number(el.dataset.price)) : by === 'rank' ? Number(el.dataset.rank ?? 0) : -Number(el.dataset.score);
      const sorted = [...items].sort((a, b) => {
        const x = key(a);
        const y = key(b);
        return x < y ? -1 : x > y ? 1 : a.dataset.name!.localeCompare(b.dataset.name!);
      });
      list.append(...sorted);
    }
    if (count) count.textContent = `${shown} ${shown === 1 ? noun.replace(/s$/, '') : noun}`;
    if (empty) empty.hidden = shown > 0;

    if (chips) {
      const active: [string, () => void][] = [];
      const clear = (name: string) => () => {
        const el = form.elements.namedItem(name);
        if (el instanceof RadioNodeList) el.value = '';
        else if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = false;
        else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = '';
        apply();
      };
      const optionText = (name: string, v: string) =>
        form.querySelector<HTMLOptionElement>(`select[name="${name}"] option[value="${v}"]`)?.textContent ??
        form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${v}"]`)?.closest('label')?.querySelector('.label')?.textContent ?? v;
      if (q) active.push([`“${q}”`, clear('q')]);
      if (cat) active.push([optionText('cat', cat), clear('cat')]);
      if (price) active.push([PRICE_LABEL[price] ?? price, clear('price')]);
      if (engine) active.push([optionText('engine', engine), clear('engine')]);
      if (exp) active.push([optionText('export', exp), clear('export')]);
      if (commercial) active.push(['Commercial use', clear('commercial')]);
      if (beginner) active.push(['Beginner friendly', clear('beginner')]);
      chips.replaceChildren(
        ...active.map(([text, fn]) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = `${text} ✕`;
          b.setAttribute('aria-label', `Remove filter ${text}`);
          b.addEventListener('click', fn);
          return b;
        }),
      );
    }
  }

  const open = (on: boolean) => {
    form.classList.toggle('open', on);
    if (scrim) scrim.hidden = !on;
  };
  root.querySelector('[data-open-filters]')?.addEventListener('click', () => open(true));
  form.querySelector('[data-close-filters]')?.addEventListener('click', () => open(false));
  scrim?.addEventListener('click', () => open(false));
  form.querySelector('[data-reset]')?.addEventListener('click', () => {
    form.reset();
    apply();
  });
  form.addEventListener('input', apply);
  form.addEventListener('change', apply);
  form.addEventListener('submit', (e) => e.preventDefault());
  sort?.addEventListener('change', apply);
  apply();
}
