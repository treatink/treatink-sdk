# drafts/

`localStorage` reference records (Charter §9, docs/10 §6). **NO image bytes, ever** — only asset ids
+ metadata. A persistence test asserts this (docs/11 §2).

- Keys: `treatink:v1:<channel>:index` and `…:draft:<draftId>`.
- Written only after a successful save; emits `draft:saved`.
- Bounded count (default 5, LRU), TTL (default 30 days), versioned namespace (migrate-or-discard),
  in-memory fallback when `localStorage` is unavailable/full.
- `store.ts` (`list/get/delete/clear`) — P3-T03. `types.ts` re-exports `DraftRecord`.
