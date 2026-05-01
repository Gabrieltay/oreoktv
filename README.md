# Oreo KTV — Remote

Mobile-first web remote for a HUASEN/InAndOn KV-V5 KTV machine on the LAN.

## Phase 1 (shipped)

- Song search against `/SearchServlet` with infinite scroll
- Language filter chips (国语 / 粤语 / 英语 / 日语 / 韩语)
- State persisted in URL (`?q=...&lang=...`)
- iOS Safari tuned (no-zoom inputs, safe-area padding, sticky header)

## Run

```bash
pnpm install
pnpm dev
```

Dev server binds to `0.0.0.0:3000`. On the phone, open
`http://<your-mac-lan-ip>:3000` — find the IP with `ipconfig getifaddr en0`.

## Config

`.env.local`:

- `KTV_BASE_URL` — KTV servlet host (server-side only).
- `NEXT_PUBLIC_KTV_IMAGE_BASE` — base URL for singer photos. The client
  renders `<img src>` directly against this, so it must be reachable from
  the phone. Default: `${KTV_BASE_URL}/singer` (confirmed with
  `curl /singer/26940.jpg -> 200`).

## Architecture

- `lib/ktv-client.ts` — single adapter for the KTV's JSONP API. Owns the
  wrapper-stripping, Zod validation, and SHOUTING_CASE → camelCase
  normalization. **All new servlets (queue, playback, volume) go here.**
- `app/api/songs/search/route.ts` — thin proxy. The browser can't hit
  the KTV's JSONP directly; the route also gives us server-side validation.
- `lib/queries.ts` — React Query hooks. `useSearchSongs` uses
  `useInfiniteQuery`, page size 8, `getNextPageParam` stops at `maxPage`.
- Caching: no server cache on the proxy; React Query owns it with
  `staleTime: 5min`.

## Phase 2 (not yet built — extension points ready)

Add queue / playback / volume servlets here:

```ts
// lib/ktv-client.ts
export function getQueue(): Promise<Queue> { ... }
export function addToQueue(songId: string): Promise<void> { ... }
export function skipSong(): Promise<void> { ... }
```

Each new servlet needs:

1. A Zod schema + function in `lib/ktv-client.ts`.
2. A route handler under `app/api/`.
3. A React Query hook in `lib/queries.ts`.

No other files need to change.
# oreoktv
