import { createIcon } from '../icons.js';
import { TreatinkError } from '../../types.js';
import type { CopyStrings, Page, Template } from '../../types.js';

/**
 * Cutout browser (P2-T08 → P5-T07, docs/13 §5.3, PetCustomizer.jsx:499-587): collapsible card
 * ("Choose Your Background" + chevron), category chips from template metadata (never hard-coded),
 * a 3-up scroll-snap pager with the store's orange pagination dots (no Swiper dep — I-08), and
 * layered thumbs — grey backdrop + the shopper's photo BEHIND the frame PNG (the store's live
 * thumb preview). The default cutout auto-preselects on open, like the store (artistic-frame-18).
 * Collapsible + toggler are real buttons with aria-expanded (I-06/I-09). "Browse All" swaps the
 * row for the full grid (the store's modal lands in P5-T08).
 */

export interface CutoutsHooks {
  onSelect(template: Template): void;
  onError(error: TreatinkError): void;
}

export interface CutoutsControl {
  root: HTMLElement;
  /** Resolves once templates are loaded and the (auto-)preselection applied. */
  ready: Promise<void>;
  /** Current photo object URL for the layered thumb previews (null clears them). */
  setPhoto(url: string | null): void;
}

const PAGE_SIZE = 3; // store: slidesPerGroup={3}

export function mountCutouts(
  doc: Document,
  host: HTMLElement,
  copy: Pick<CopyStrings, 'cutoutsLabel' | 'categoryAll' | 'genericError'>,
  input: {
    sku: string;
    preselectId?: string;
    listTemplates(params: {
      sku: string;
      limit?: number;
      cursor?: string;
    }): Promise<Page<Template>>;
  },
  hooks: CutoutsHooks,
): CutoutsControl {
  const root = doc.createElement('div');
  root.className = 'tk-cutouts';

  // Collapsible header — a real button with aria-expanded (store uses a click-only div; I-06).
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tk-cutouts-toggle';
  toggle.setAttribute('aria-expanded', 'true');
  const label = doc.createElement('span');
  label.className = 'tk-card-label';
  label.textContent = copy.cutoutsLabel;
  let chevron = createIcon(doc, 'chevron-up');
  toggle.append(label, chevron);

  const collapsible = doc.createElement('div');
  collapsible.className = 'tk-collapsible';
  const inner = doc.createElement('div');
  inner.className = 'tk-collapsible-inner';
  collapsible.appendChild(inner);

  const chips = doc.createElement('div');
  chips.className = 'tk-chips';
  chips.setAttribute('role', 'tablist');

  const pager = doc.createElement('div');
  pager.className = 'tk-pager';
  const row = doc.createElement('div');
  row.className = 'tk-cutout-row';
  const dots = doc.createElement('div');
  dots.className = 'tk-dots';
  pager.append(row, dots);

  const browseWrap = doc.createElement('div');
  browseWrap.className = 'tk-browse-wrap';
  const browseAll = doc.createElement('button');
  browseAll.type = 'button';
  browseAll.className = 'tk-browse-all';
  browseAll.textContent = copy.categoryAll;
  browseAll.setAttribute('aria-pressed', 'false');
  browseWrap.appendChild(browseAll);

  inner.append(chips, pager, browseWrap);
  root.append(toggle, collapsible);
  host.appendChild(root);

  let expanded = true;
  const setExpanded = (next: boolean) => {
    expanded = next;
    toggle.setAttribute('aria-expanded', String(next));
    const nextChevron = createIcon(doc, next ? 'chevron-up' : 'chevron-down');
    chevron.replaceWith(nextChevron);
    chevron = nextChevron;
    // Measured-height transition (I-09 — no rAF/magic constants): px → 0 to close,
    // 0 → px to open, released to auto on transition end so content can reflow.
    const target = next ? inner.scrollHeight : 0;
    collapsible.style.height = `${collapsible.scrollHeight}px`; // fix the starting height
    void collapsible.offsetHeight; // flush so the transition sees both endpoints
    collapsible.style.height = `${target}px`;
  };
  collapsible.addEventListener('transitionend', () => {
    if (expanded) collapsible.style.height = 'auto';
  });
  toggle.addEventListener('click', () => setExpanded(!expanded));

  let photoUrl: string | null = null;
  let selectedId: string | null = null;
  let renderRow: () => void = () => undefined;

  const ready = (async () => {
    // page through everything for the SKU (fixture set fits one 100-page)
    const templates: Template[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await input.listTemplates({
        sku: input.sku,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      templates.push(...page.data);
      if (!page.hasMore || page.nextCursor === null) break;
      cursor = page.nextCursor;
    }

    // categories in first-appearance order, from metadata (not hard-coded)
    const categories = [...new Set(templates.map((t) => t.category))];
    let activeCategory: string = categories[0] ?? '';
    let gridMode = false; // Browse All (interim inline grid — store modal in P5-T08)

    const select = (template: Template) => {
      selectedId = template.cutoutLabelId;
      for (const thumb of row.querySelectorAll<HTMLElement>('.tk-cutout-thumb')) {
        thumb.setAttribute('aria-selected', String(thumb.dataset['cutout'] === selectedId));
      }
      hooks.onSelect(template);
    };

    const renderChips = () => {
      chips.textContent = '';
      for (const category of categories) {
        const chip = doc.createElement('button');
        chip.type = 'button';
        chip.className = 'tk-chip';
        chip.dataset['category'] = category;
        chip.setAttribute('role', 'tab');
        chip.setAttribute('aria-selected', String(category === activeCategory && !gridMode));
        chip.textContent = category; // displayed capitalized via CSS (wire is lowercase)
        chip.addEventListener('click', () => {
          activeCategory = category;
          gridMode = false;
          browseAll.setAttribute('aria-pressed', 'false');
          renderChips();
          renderRow();
          row.scrollTo({ left: 0 }); // store: swiper slideTo(0) on category switch
        });
        chips.appendChild(chip);
      }
    };

    const renderDots = (visibleCount: number) => {
      dots.textContent = '';
      if (gridMode) return;
      const pages = Math.ceil(visibleCount / PAGE_SIZE);
      if (pages <= 1) return;
      for (let i = 0; i < pages; i++) {
        const dot = doc.createElement('button');
        dot.type = 'button';
        dot.className = 'tk-dot';
        dot.setAttribute('aria-label', `${i + 1} / ${pages}`);
        dot.setAttribute('aria-current', String(i === 0));
        dot.addEventListener('click', () => {
          row.scrollTo({ left: i * row.clientWidth, behavior: 'smooth' });
        });
        dots.appendChild(dot);
      }
    };

    // active dot follows the scroll position (store: swiper pagination)
    row.addEventListener('scroll', () => {
      const page = row.clientWidth > 0 ? Math.round(row.scrollLeft / row.clientWidth) : 0;
      [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === page)));
    });

    renderRow = () => {
      row.textContent = '';
      row.className = gridMode ? 'tk-cutout-row tk-cutout-grid' : 'tk-cutout-row';
      const visible = gridMode ? templates : templates.filter((t) => t.category === activeCategory);
      for (const template of visible) {
        const thumb = doc.createElement('button');
        thumb.type = 'button';
        thumb.className = 'tk-cutout-thumb';
        thumb.dataset['cutout'] = template.cutoutLabelId;
        thumb.setAttribute('aria-label', template.title);
        thumb.setAttribute('aria-selected', String(template.cutoutLabelId === selectedId));
        if (photoUrl) {
          // the shopper's photo behind the frame — the store's live thumb preview
          const photo = doc.createElement('img');
          photo.className = 'tk-thumb-photo';
          photo.src = photoUrl;
          photo.alt = '';
          thumb.appendChild(photo);
        }
        const img = doc.createElement('img');
        img.className = 'tk-thumb-frame';
        img.src = template.maskUrl;
        img.alt = template.title;
        img.loading = 'lazy';
        thumb.appendChild(img);
        thumb.addEventListener('click', () => select(template));
        row.appendChild(thumb);
      }
      renderDots(visible.length);
    };

    browseAll.addEventListener('click', () => {
      gridMode = !gridMode;
      browseAll.setAttribute('aria-pressed', String(gridMode));
      renderChips();
      renderRow();
    });

    renderChips();
    renderRow();

    // Auto-preselect (docs/13 §5.3): explicit id wins; unknown id surfaces not_found and falls
    // back; else the first template of the default category — the store's default-frame behavior.
    let initial: Template | undefined;
    if (input.preselectId) {
      initial = templates.find((t) => t.cutoutLabelId === input.preselectId);
      if (!initial) {
        hooks.onError(
          new TreatinkError('not_found', 'The requested cutout label does not exist.', {
            param: 'cutoutLabelId',
          }),
        );
      }
    }
    initial ??= templates[0];
    if (initial) select(initial);
  })().catch((cause: unknown) => {
    hooks.onError(
      cause instanceof TreatinkError
        ? cause
        : new TreatinkError('bad_request', copy.genericError, { cause }),
    );
  });

  return {
    root,
    ready,
    setPhoto(url: string | null): void {
      photoUrl = url;
      renderRow();
    },
  };
}
