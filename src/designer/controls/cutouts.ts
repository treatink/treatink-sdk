import { createIcon } from '../icons.js';
import { TreatinkError } from '../../types.js';
import type { CopyStrings, Page, Template } from '../../types.js';

/**
 * Cutout browser (P2-T08 → P5-T07/T08, docs/13 §5.3–§6, PetCustomizer.jsx:499-587 +
 * FramesModal.jsx): collapsible card ("Choose Your Background" + chevron), category chips from
 * template metadata (never hard-coded), a 3-up scroll-snap pager with the store's orange
 * pagination dots (no Swiper dep — I-08), layered thumbs — grey backdrop + the shopper's photo
 * BEHIND the frame PNG — and the store's Browse-All modal: nested overlay, pill search field
 * (filters title AND tags — I-10; the store searched desc only), 'All' + category chips, thumb
 * grid. The default cutout auto-preselects on open, like the store (artistic-frame-18).
 * Collapsible + toggler are real buttons with aria-expanded (I-06/I-09).
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
const MODAL_ALL = 'All'; // store framesModalCategories default

export function mountCutouts(
  doc: Document,
  host: HTMLElement,
  copy: Pick<
    CopyStrings,
    | 'cutoutsLabel'
    | 'categoryAll'
    | 'browseAllTitle'
    | 'searchPlaceholder'
    | 'noCutoutsFound'
    | 'closeLabel'
    | 'genericError'
  >,
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
  chips.className = 'tk-chips'; // role=tablist applied at render — skeletons aren't tabs (axe)

  const pager = doc.createElement('div');
  pager.className = 'tk-pager';
  const row = doc.createElement('div');
  row.className = 'tk-cutout-row'; // role=listbox applied at render — skeletons aren't options
  const dots = doc.createElement('div');
  dots.className = 'tk-dots';
  pager.append(row, dots);

  const browseWrap = doc.createElement('div');
  browseWrap.className = 'tk-browse-wrap';
  const browseAll = doc.createElement('button');
  browseAll.type = 'button';
  browseAll.className = 'tk-browse-all';
  browseAll.textContent = copy.categoryAll;
  browseWrap.appendChild(browseAll);

  inner.append(chips, pager, browseWrap);
  root.append(toggle, collapsible);
  host.appendChild(root);

  // Loading skeletons mirroring the loaded layout (owner 2026-07-22): chip pills + a 3-up row of
  // thumb placeholders, swapped out by the real render below. Browse All hides until loaded.
  browseWrap.hidden = true;
  for (let i = 0; i < 4; i++) {
    const chipSkeleton = doc.createElement('span');
    chipSkeleton.className = 'tk-skeleton tk-skeleton-chip';
    chips.appendChild(chipSkeleton);
  }
  for (let i = 0; i < 3; i++) {
    const thumbSkeleton = doc.createElement('span');
    thumbSkeleton.className = 'tk-skeleton tk-skeleton-thumb';
    row.appendChild(thumbSkeleton);
  }

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

  // ── Browse-All modal shell (store ModalWrapper + FramesModal, docs/13 §6) ──
  const framesOverlay = doc.createElement('div');
  framesOverlay.className = 'tk-frames-overlay';
  framesOverlay.hidden = true;

  const framesModal = doc.createElement('div');
  framesModal.className = 'tk-frames-modal';
  framesModal.setAttribute('role', 'dialog');
  framesModal.setAttribute('aria-modal', 'true');
  framesModal.setAttribute('aria-label', copy.browseAllTitle);

  const framesClose = doc.createElement('button');
  framesClose.type = 'button';
  framesClose.className = 'tk-frames-close';
  framesClose.setAttribute('aria-label', copy.closeLabel);
  framesClose.appendChild(createIcon(doc, 'x'));

  const framesTitle = doc.createElement('div');
  framesTitle.className = 'tk-frames-title';
  framesTitle.textContent = copy.browseAllTitle;

  const search = doc.createElement('div');
  search.className = 'tk-search';
  const searchInput = doc.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'tk-search-input';
  searchInput.placeholder = copy.searchPlaceholder;
  searchInput.setAttribute('aria-label', copy.searchPlaceholder);
  const searchClear = doc.createElement('button');
  searchClear.type = 'button';
  searchClear.className = 'tk-search-clear';
  searchClear.setAttribute('aria-label', copy.closeLabel);
  searchClear.appendChild(createIcon(doc, 'x', 15));
  searchClear.hidden = true;
  const searchIcon = doc.createElement('span');
  searchIcon.className = 'tk-search-icon';
  searchIcon.appendChild(createIcon(doc, 'search'));
  search.append(searchClear, searchInput, searchIcon);

  const modalChips = doc.createElement('div');
  modalChips.className = 'tk-chips tk-frames-chips';
  modalChips.setAttribute('role', 'tablist');

  const grid = doc.createElement('div');
  grid.className = 'tk-frames-grid';
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', copy.browseAllTitle);

  const emptyMessage = doc.createElement('p');
  emptyMessage.className = 'tk-frames-empty';
  emptyMessage.textContent = copy.noCutoutsFound;
  emptyMessage.hidden = true;

  framesModal.append(framesClose, framesTitle, search, modalChips, grid, emptyMessage);
  framesOverlay.appendChild(framesModal);
  // Portal to the SDK overlay so the nested modal covers the whole designer card.
  (host.closest('.tk-overlay') ?? host).appendChild(framesOverlay);

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
    let modalCategory: string = MODAL_ALL; // store: modal defaults to 'All'
    let modalOpen = false;

    const syncSelection = () => {
      const thumbs = [...row.children, ...grid.children] as HTMLElement[];
      for (const thumb of thumbs) {
        thumb.setAttribute('aria-selected', String(thumb.dataset['cutout'] === selectedId));
      }
    };

    const select = (template: Template) => {
      selectedId = template.cutoutLabelId;
      syncSelection();
      hooks.onSelect(template);
    };

    /** Layered thumb (docs/13 §5.3): grey backdrop + photo (z0) behind the frame PNG (z1). */
    const buildThumb = (template: Template, onPick: (t: Template) => void): HTMLElement => {
      const thumb = doc.createElement('button');
      thumb.type = 'button';
      thumb.className = 'tk-cutout-thumb';
      thumb.setAttribute('role', 'option'); // aria-selected is valid on option (axe aria-allowed-attr)
      thumb.dataset['cutout'] = template.cutoutLabelId;
      thumb.setAttribute('aria-label', template.title);
      thumb.setAttribute('aria-selected', String(template.cutoutLabelId === selectedId));
      if (photoUrl) {
        const photo = doc.createElement('img');
        photo.className = 'tk-thumb-photo';
        photo.src = photoUrl;
        photo.alt = '';
        photo.draggable = false; // never a native image drag (owner 2026-07-22)
        thumb.appendChild(photo);
      }
      const img = doc.createElement('img');
      img.className = 'tk-thumb-frame';
      img.src = template.maskUrl;
      img.alt = template.title;
      img.loading = 'lazy';
      img.draggable = false;
      thumb.appendChild(img);
      thumb.addEventListener('click', () => onPick(template));
      return thumb;
    };

    const renderChips = () => {
      chips.textContent = '';
      chips.setAttribute('role', 'tablist');
      for (const category of categories) {
        const chip = doc.createElement('button');
        chip.type = 'button';
        chip.className = 'tk-chip';
        chip.dataset['category'] = category;
        chip.setAttribute('role', 'tab');
        chip.setAttribute('aria-selected', String(category === activeCategory));
        chip.textContent = category; // displayed capitalized via CSS (wire is lowercase)
        chip.addEventListener('click', () => {
          activeCategory = category;
          renderChips();
          renderRow();
          row.scrollTo({ left: 0 }); // store: swiper slideTo(0) on category switch
        });
        chips.appendChild(chip);
      }
    };

    const renderDots = (visibleCount: number) => {
      dots.textContent = '';
      const pages = Math.ceil(visibleCount / PAGE_SIZE);
      if (pages <= 1) return;
      for (let i = 0; i < pages; i++) {
        const dot = doc.createElement('button');
        dot.type = 'button';
        dot.className = 'tk-dot';
        dot.setAttribute('aria-label', `${i + 1} / ${pages}`);
        dot.setAttribute('aria-current', String(i === 0));
        dot.addEventListener('click', () => {
          // page stride = clientWidth + the 10px gap between page boundaries (store spaceBetween)
          row.scrollTo({ left: i * (row.clientWidth + 10), behavior: 'smooth' });
        });
        dots.appendChild(dot);
      }
    };

    // Mouse drag-to-scroll, like the store's Swiper (owner 2026-07-22): pointer-capture the row,
    // pan scrollLeft, and suppress the click that would otherwise select a thumb after a drag.
    // Touch scrolls natively; snap is disabled while dragging so the pan tracks 1:1, then the
    // browser snaps on release.
    let dragScroll: { id: number; startX: number; startLeft: number; moved: boolean } | null = null;
    row.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse') return;
      dragScroll = {
        id: event.pointerId,
        startX: event.clientX,
        startLeft: row.scrollLeft,
        moved: false,
      };
    });
    row.addEventListener('pointermove', (event) => {
      if (!dragScroll || event.pointerId !== dragScroll.id) return;
      const dx = event.clientX - dragScroll.startX;
      if (!dragScroll.moved && Math.abs(dx) > 5) {
        dragScroll.moved = true;
        row.setPointerCapture(event.pointerId);
        row.classList.add('tk-drag-scrolling');
      }
      if (dragScroll.moved) row.scrollLeft = dragScroll.startLeft - dx;
    });
    const endDragScroll = () => {
      if (!dragScroll) return;
      const dragged = dragScroll.moved;
      dragScroll = null;
      row.classList.remove('tk-drag-scrolling');
      if (dragged) suppressNextClick = true;
    };
    let suppressNextClick = false;
    row.addEventListener('pointerup', endDragScroll);
    row.addEventListener('pointercancel', endDragScroll);
    row.addEventListener(
      'click',
      (event) => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        event.preventDefault();
        event.stopPropagation(); // a drag is not a selection
      },
      { capture: true },
    );

    // active dot follows the scroll position (store: swiper pagination)
    row.addEventListener('scroll', () => {
      const stride = row.clientWidth + 10;
      // A partial last page clamps at max scroll below the last stride — count it as the last page.
      const maxScroll = row.scrollWidth - row.clientWidth;
      const atEnd = maxScroll > 0 && maxScroll - row.scrollLeft <= 1;
      const page = atEnd
        ? dots.children.length - 1
        : row.clientWidth > 0
          ? Math.round(row.scrollLeft / stride)
          : 0;
      [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === page)));
    });

    renderRow = () => {
      row.textContent = '';
      row.setAttribute('role', 'listbox');
      row.setAttribute('aria-label', copy.cutoutsLabel);
      const visible = templates.filter((t) => t.category === activeCategory);
      for (const template of visible) row.appendChild(buildThumb(template, select));
      renderDots(visible.length);
    };

    // ── Browse-All modal behavior (store FramesModal) ──
    const renderModalChips = () => {
      modalChips.textContent = '';
      for (const category of [MODAL_ALL, ...categories]) {
        const chip = doc.createElement('button');
        chip.type = 'button';
        chip.className = 'tk-chip tk-chip-lg';
        chip.dataset['category'] = category;
        chip.setAttribute('role', 'tab');
        chip.setAttribute('aria-selected', String(category === modalCategory));
        chip.textContent = category;
        chip.addEventListener('click', () => {
          modalCategory = category;
          renderModalChips();
          renderGrid();
        });
        modalChips.appendChild(chip);
      }
    };

    const renderGrid = () => {
      grid.textContent = '';
      const query = searchInput.value.trim().toLowerCase();
      const visible = templates
        .filter((t) => modalCategory === MODAL_ALL || t.category === modalCategory)
        .filter(
          (t) =>
            query === '' ||
            t.title.toLowerCase().includes(query) ||
            t.tags.some((tag) => tag.toLowerCase().includes(query)),
        );
      for (const template of visible) {
        grid.appendChild(
          buildThumb(template, (picked) => {
            select(picked);
            closeModal(); // store: picking a frame closes the modal
          }),
        );
      }
      emptyMessage.hidden = visible.length > 0;
      searchClear.hidden = searchInput.value === '';
    };

    const openModal = () => {
      modalOpen = true;
      modalCategory = MODAL_ALL; // store: modal opens on 'All'
      searchInput.value = ''; // …with a fresh query
      framesOverlay.hidden = false;
      renderModalChips();
      renderGrid();
      searchInput.focus();
    };
    const closeModal = () => {
      if (!modalOpen) return;
      modalOpen = false;
      framesOverlay.hidden = true;
      browseAll.focus(); // focus returns to the opener
    };

    browseAll.addEventListener('click', openModal);
    framesClose.addEventListener('click', closeModal);
    framesOverlay.addEventListener('click', (event) => {
      if (event.target === framesOverlay) closeModal(); // backdrop click, store ModalWrapper
    });
    // Escape closes the frames modal FIRST — the designer's overlay handler must not see it.
    framesOverlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeModal();
      }
    });
    searchInput.addEventListener('input', renderGrid);
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      renderGrid();
      searchInput.focus();
    });

    renderChips();
    renderRow();
    browseWrap.hidden = false; // skeleton phase over

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
    // Load failed — clear the skeletons so the card doesn't shimmer forever.
    chips.textContent = '';
    row.textContent = '';
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
