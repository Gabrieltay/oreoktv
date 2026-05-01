# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mobile-first web remote (Next.js 14 App Router) for a HUASEN/InAndOn KV-V5 KTV machine on the LAN. The package name is `oreo-ktv`. Phone-driven UX — search songs, manage queue, control playback.

## Commands

```bash
pnpm dev          # next dev on 0.0.0.0:3001 (so phones on the LAN can reach it)
pnpm build        # next build
pnpm start        # next start on 0.0.0.0:3001
pnpm lint         # next lint (eslint with next/core-web-vitals + next/typescript)
```

There is no test runner configured. Type checking happens via `pnpm build` (or `tsc --noEmit`).

To use from a phone on the same LAN: find your host's IP (`ipconfig getifaddr en0` on macOS) and open `http://<host-ip>:3001`.

## Environment

- `KTV_BASE_URL` — KTV servlet host. **Server-only** (used by API routes that proxy to the KTV).
- `NEXT_PUBLIC_KTV_IMAGE_BASE` — base URL for singer photos. The browser renders `<img src>` directly against the KTV, so this must be reachable from the phone (default: `${KTV_BASE_URL}/singer`).
- `DATA_DIR` — where user-curated playlists are written on disk (server-only). Default `./data`; in Docker `/data`, with the host's `./data` bind-mounted onto it.

`KTV_BASE_URL` / `NEXT_PUBLIC_KTV_IMAGE_BASE` are read in [lib/config.ts](lib/config.ts) with hardcoded fallbacks pointing at `192.168.50.150:8080`. `DATA_DIR` is read in [lib/playlist-store.ts](lib/playlist-store.ts).

## Architecture

The KTV exposes JSONP-wrapped Java servlets with SHOUTING_CASE field names. Browsers can't call its JSONP endpoints directly, and the field names are awful. The codebase isolates that ugliness behind a single adapter layer:

```
Browser  →  React Query hook  →  /api/* route  →  ktv-client.ts  →  KTV servlet
(lib/queries.ts)            (app/api/.../route.ts)            (JSONP+Zod)
```

Three load-bearing files:

- **[lib/ktv-client.ts](lib/ktv-client.ts)** — the _only_ place that knows about JSONP, raw field names, and KTV semantics. Each servlet is a `{Zod schema, fn}` pair. Schemas use `.transform()` to normalize SHOUTING_CASE → camelCase so the rest of the app never sees `sONGBM`/`sONGNAME`. **All new servlets go here**, not anywhere else.
- **[app/api/\*/route.ts](app/api/)** — thin proxy routes. They exist because the browser can't reach the KTV's JSONP, and they double as a server-side validation boundary. No business logic.
- **[lib/queries.ts](lib/queries.ts)** — React Query hooks. `useSearchSongs`/`useSearchSingers` use `useInfiniteQuery` (page size 8, stop at `maxPage`). `usePlaylist` polls every 3 s. Mutations invalidate `["playlist"]` on success.

To add a new servlet (e.g. queue, volume), follow this pattern:

1. Zod schema + function in [lib/ktv-client.ts](lib/ktv-client.ts).
2. Route handler under `app/api/`.
3. React Query hook in [lib/queries.ts](lib/queries.ts).

No other files should need to change.

### KTV command quirks worth knowing

These are firmware-level behaviors that are not obvious from the API surface:

- `Pro2` (move queue item to top) is broken in the KTV firmware — even the machine's own UI can't reorder. We emulate "move to top" as `Del1 + Pro1` in [`useMoveToTop`](lib/queries.ts) (Del1 first to avoid removing a duplicate at position 1).
- `Play` is a _toggle_ (pause ↔ resume), not "play".
- `MuOr` toggles original vocal / guide vocal.
- The KTV returns `{cmd, code}` where `code === "0"` means success. `sendCommand` throws on anything else.
- `/SearchServlet` `lang` and `/SingerServlet` `singerType` use _different vocabularies_ for the same human concept (language labels like `国语` vs region labels like `大陆`). [LANGUAGES in lib/config.ts](lib/config.ts) keeps both values per entry; pick the right one at the call site (use `langToSingerType()` to translate).

### Caching

No server-side caching on the proxy routes (`Cache-Control: no-store`, `dynamic = "force-dynamic"`). React Query owns caching with `staleTime: 5min` for searches and `refetchInterval: 3000` for the playlist.

### User playlists (file-backed)

User-curated playlists live one-JSON-file-per-playlist under `${DATA_DIR}/playlists/<uuid>.json`. The KTV is not involved — these are local bookmarks with an "Add all to queue" action that fans out `Add1` commands.

```
Browser  →  React Query hook  →  /api/playlists* route  →  lib/playlist-store.ts  →  filesystem
```

- **[lib/playlist-store.ts](lib/playlist-store.ts)** — server-only filesystem adapter. Atomic writes (tmp + rename), Zod-validated reads, UUID-only ids. Bad files are skipped (logged) so one corrupted file can't break the list endpoint.
- **[lib/playlist-types.ts](lib/playlist-types.ts)** — wire-shape types shared between client and server. Don't import from `playlist-store.ts` in client code (it pulls in `fs`/`crypto`).
- **[app/api/playlists/](app/api/playlists/)** — REST routes (list, create, get, rename, delete, add/remove song).
- **Bookmark UI** — `BookmarkPlus` button in [components/song-row.tsx](components/song-row.tsx) opens [components/add-to-playlist-button.tsx](components/add-to-playlist-button.tsx). Detail screen at `/playlists/[id]` lets users rename, delete, remove songs, and bulk-enqueue to the KTV via [`useAddPlaylistToQueue`](lib/queries.ts).

### URL state

Search state (`?q=...&lang=...&mode=songs|artists`) is debounced (300 ms) and pushed via `router.replace` so reloads preserve the screen. See [app/page.tsx](app/page.tsx).

## Conventions

- Path alias `@/*` maps to the repo root (configured in [tsconfig.json](tsconfig.json)). Imports look like `@/lib/ktv-client`, `@/components/song-row`.
- TypeScript `strict: true`. Don't loosen it.
- Tailwind for styling; shadcn-style primitives live in [components/ui/](components/ui/).
- Mobile/iOS Safari is the primary target: viewport is locked to no-zoom, `safe-area-inset-*` is used in the tab bar and playback bar, and inputs avoid the iOS auto-zoom trap.
