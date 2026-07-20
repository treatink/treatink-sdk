import { TreatinkError } from '../../types.js';
import type { CopyStrings, Page, Template } from '../../types.js';

/**
 * Cutout browser (P2-T08, Charter §7.2): category chips driven by template `category` metadata
 * (never hard-coded), a scrollable thumbnail row for the active category, and a Browse All grid
 * of every template for the SKU. Thumbnails are buttons (tabbable, labeled) wrapping the mask
 * image; alt text comes from the template title.
 */

export interface CutoutsHooks {
  onSelect(template: Template): void;
  onError(error: TreatinkError): void;
}

export interface CutoutsControl {
  root: HTMLElement;
  /** Resolves once templates are loaded and (optionally) a preselection applied. */
  ready: Promise<void>;
}

export function mountCutouts(
  doc: Document,
  host: HTMLElement,
  copy: Pick<CopyStrings, 'categoryAll' | 'genericError'>,
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
  const chips = doc.createElement('div');
  chips.className = 'tk-chips';
  chips.setAttribute('role', 'tablist');
  const row = doc.createElement('div');
  row.className = 'tk-cutout-row';
  root.append(chips, row);
  host.appendChild(root);

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
    const ALL = '__all__';
    let activeCategory: string = categories[0] ?? ALL;

    const renderChips = () => {
      chips.textContent = '';
      for (const category of [...categories, ALL]) {
        const chip = doc.createElement('button');
        chip.type = 'button';
        chip.className = 'tk-chip';
        chip.dataset['category'] = category;
        chip.setAttribute('role', 'tab');
        chip.setAttribute('aria-selected', String(category === activeCategory));
        chip.textContent = category === ALL ? copy.categoryAll : category;
        chip.addEventListener('click', () => {
          activeCategory = category;
          renderChips();
          renderRow();
        });
        chips.appendChild(chip);
      }
    };

    const renderRow = () => {
      row.textContent = '';
      const browseAll = activeCategory === ALL;
      row.className = browseAll ? 'tk-cutout-row tk-cutout-grid' : 'tk-cutout-row';
      const visible = browseAll
        ? templates
        : templates.filter((t) => t.category === activeCategory);
      for (const template of visible) {
        const thumb = doc.createElement('button');
        thumb.type = 'button';
        thumb.className = 'tk-cutout-thumb';
        thumb.dataset['cutout'] = template.cutoutLabelId;
        thumb.setAttribute('aria-label', template.title);
        const img = doc.createElement('img');
        img.src = template.maskUrl;
        img.alt = template.title;
        img.loading = 'lazy';
        thumb.appendChild(img);
        thumb.addEventListener('click', () => hooks.onSelect(template));
        row.appendChild(thumb);
      }
    };

    renderChips();
    renderRow();

    if (input.preselectId) {
      const preselected = templates.find((t) => t.cutoutLabelId === input.preselectId);
      if (preselected) {
        hooks.onSelect(preselected);
      } else {
        hooks.onError(
          new TreatinkError('not_found', 'The requested cutout label does not exist.', {
            param: 'cutoutLabelId',
          }),
        );
      }
    }
  })().catch((cause: unknown) => {
    hooks.onError(
      cause instanceof TreatinkError
        ? cause
        : new TreatinkError('bad_request', copy.genericError, { cause }),
    );
  });

  return { root, ready };
}
