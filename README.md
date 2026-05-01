# Oreo KTV — Remote

Mobile-first web remote (Next.js 14 App Router) for a HUASEN/InAndOn KV-V5 KTV machine on the LAN. Phone-driven UX — search songs, browse artists, manage the live queue, control playback, and curate local playlists.

The KTV's own UI is a 2010-era TV remote nightmare. This is a phone-friendly replacement that talks to the same machine.

## What's built

### Search & browse

- **Song search** against `/SearchServlet` with infinite scroll (page size 8).
- **Artist search** against `/SingerServlet` — separate mode toggle, per-artist photo grid.
- **Artist drill-down** at `/artist/[name]` — every song by that singer.
- **Language filter chips** (Mandarin / Cantonese / English / Japanese / Korean). Handles the KTV's quirk where `/SearchServlet` and `/SingerServlet` use different vocabularies for the same language (`国语` vs `大陆` etc.).
- **URL state**: `?q=...&lang=...&mode=songs|artists`, debounced 300 ms, so reloads and back-button preserve the screen.

### Live queue & playback (`/queue` + sticky bottom bar)

- **Queue view** polls every 3 s — shows now-playing + upcoming songs.
- **Per-song actions**: add to queue, **add to top** (emulated via `Del1 + Pro1` because the KTV's native `Pro2` reorder is broken in firmware), remove from queue.
- **Playback bar** (sticky, on every screen):
  - Play/pause toggle, skip, restart current song
  - Toggle guide vocal (`MuOr`)
  - Mute toggle
  - Music & mic volume up/down (in a slide-up drawer)
- **Toasts** confirm every command; failures surface the KTV's error code.

### User playlists (file-backed, KTV-independent)

- Curate local playlists, stored one-JSON-file-per-playlist under `${DATA_DIR}/playlists/<uuid>.json`. The KTV doesn't know about these — they're local bookmarks.
- **Bookmark button** on every song row → pick which playlist(s) to add to.
- **Playlist detail screen** — rename, delete, remove songs, and **"Add all to queue"** which fans out `Add1` commands sequentially.
- Atomic writes (tmp + rename), Zod-validated reads, UUID-only ids. A corrupted file is logged and skipped, not fatal.

### Polish

- Light/dark theme toggle (persisted; no-flash boot script in `<head>`).
- iOS Safari tuned: viewport locked to no-zoom, `safe-area-inset-*` honored on tab bar + playback bar, no-zoom inputs.
- Tab bar: Search · Playlists · Queue.
- **Installable as a PWA** — web manifest + service worker so the app adds to the home screen and launches in a standalone window with no browser chrome. Service worker caches the app shell and bypasses `/api/*` so KTV state stays fresh. Drop `icon-192.png` and `icon-512.png` into `public/icons/` to provide the install icons.

## Run

```bash
pnpm install
pnpm dev          # 0.0.0.0:3001
```

On a phone on the same Wi-Fi, open `http://<host-ip>:3001` — find the host's IP with `ipconfig getifaddr en0` (macOS).

## Run with Docker

```bash
docker build -t oreo-ktv .
mkdir -p data
docker run --rm -p 3001:3001 \
  -e KTV_BASE_URL=http://192.168.50.150:8080 \
  -v "$(pwd)/data:/data" \
  -e DATA_DIR=/data \
  oreo-ktv
```

Playlists in `./data/playlists/*.json` survive image rebuilds.

## Deploy to a Raspberry Pi

The intended home for this is a Pi on the same LAN as the KTV. There are two deploy paths depending on whether you're starting from scratch or pushing an update.

### First-time install (run on the Pi)

Clone the repo, then register a systemd service that builds the image and runs it on boot:

```bash
git clone <repo-url> ~/oreo-ktv
cd ~/oreo-ktv
sudo ./scripts/install-service.sh
```

Override defaults via env, e.g. `sudo KTV_BASE_URL=http://192.168.50.150:8080 ./scripts/install-service.sh`. Re-runnable.

After install:

```bash
systemctl status oreo-ktv.service
journalctl -u oreo-ktv.service -f
```

### Updates (build on Mac, push to Pi)

Building `next build` on a Pi is slow and can OOM on small boards. The easier path is to build the image on your Mac (cross-compiled for `linux/arm64`), ship it over SSH, and restart the service:

```bash
./scripts/deploy.sh
```

That script ([scripts/deploy.sh](scripts/deploy.sh)):

1. `docker buildx build --platform linux/arm64 --load` on the Mac
2. `docker save | ssh pi 'docker load'` to ship the image over the LAN
3. `ssh -t pi 'sudo systemctl restart oreo-ktv.service'` to swap the running container

Defaults assume `gabriel@oreopi.local`. Override with env:

```bash
PI_HOST=raspberrypi.local PI_USER=pi ./scripts/deploy.sh
```

To make deploys fully unattended, set up SSH keys (`ssh-copy-id $PI_USER@$PI_HOST`) and grant passwordless sudo for the one restart command on the Pi:

```bash
echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl restart oreo-ktv.service" \
  | sudo tee /etc/sudoers.d/oreo-ktv
sudo chmod 440 /etc/sudoers.d/oreo-ktv
```

### Update in place (alternative — build on the Pi)

If the Pi has enough RAM and you'd rather pull from git than push images, [scripts/update.sh](scripts/update.sh) does `git pull` + `docker build` + `systemctl restart`, and is safe to run from cron.

## Config

`.env.local`:

- `KTV_BASE_URL` — KTV servlet host. **Server-only** (used by API routes).
- `NEXT_PUBLIC_KTV_IMAGE_BASE` — base URL for singer photos. Browser hits this directly, so it must be reachable from the phone. Default: `${KTV_BASE_URL}/singer`.
- `DATA_DIR` — where user playlists are written. Default `./data`; in Docker `/data`.

Defaults point at `192.168.50.150:8080` (see [lib/config.ts](lib/config.ts)).

## Architecture

```
Browser  →  React Query hook  →  /api/* route  →  ktv-client.ts  →  KTV servlet
(lib/queries.ts)            (app/api/.../route.ts)            (JSONP+Zod)
```

Three load-bearing files:

- **[lib/ktv-client.ts](lib/ktv-client.ts)** — the _only_ place that knows about JSONP, raw `SHOUTING_CASE` fields, and KTV semantics. Each servlet is a `{Zod schema, fn}` pair; `.transform()` normalizes to camelCase. New servlets go here.
- **[app/api/\*/route.ts](app/api/)** — thin proxy routes. Exist because the browser can't reach the KTV's JSONP, and they double as a server-side validation boundary. No business logic.
- **[lib/queries.ts](lib/queries.ts)** — React Query hooks. `useSearchSongs` / `useSearchSingers` use `useInfiniteQuery`. `usePlaylist` polls every 3 s. Mutations invalidate `["playlist"]` on success.

User playlists follow a parallel pattern: `lib/playlist-store.ts` (filesystem adapter) → `app/api/playlists/*` → `lib/queries.ts` hooks.

### KTV firmware quirks worth knowing

- `Pro2` (move queue item to top) is broken in firmware — even the KTV's own UI can't reorder. Emulated as `Del1 + Pro1` in `useMoveToTop` (Del1 first to avoid removing a duplicate at position 1).
- `Play` is a _toggle_ (pause ↔ resume), not "play".
- `MuOr` toggles original vocal / guide vocal.
- `CommandServlet` returns `{cmd, code}`; `code === "0"` means success. Anything else throws.
- Don't fan out commands in parallel — the CommandServlet is flaky under concurrent writes. `useAddPlaylistToQueue` enqueues sequentially.

## Possible enhancements

Roughly ordered by ratio of value-to-effort.

### Quality-of-life on existing features

- **Optimistic updates for queue mutations.** Right now Add/Remove/Move-to-top wait for the next 3 s poll before the UI reflects the change. Optimistic mutate + rollback on error would feel instant.
- **Drag-to-reorder queue.** The KTV firmware can't reorder mid-queue, but we can emulate any reorder client-side as a sequence of `Del1` + `Pro1`/`Add1` ops. Risky — partial failures leave the queue in a weird state — so do it behind a "Reorder" mode with a single Apply button.
- **Search history / recent songs.** Persist the last N queries in `localStorage`; surface as chips below the search bar when the input is empty.
- **"Now playing" header on the playback bar.** The bar shows controls but not the current song's title. The data is already in `usePlaylist().queue[0]`.
- **Skeleton loaders.** Currently the search/queue/playlist views flash empty before data lands. Replace with row skeletons.
- **Long-press on a song row** → quick "Play next" (current behavior is "Add to top", but UX could distinguish "play immediately after current" from "jump to front of long queue").
- **Empty/error states with retry buttons.** Failed network calls just toast; a banner with "Retry" inside the affected section is friendlier.

### New features

- **Favorites / Liked Songs.** A built-in playlist that's always present. Heart button on every row. Reuses the existing playlist-store machinery.
- **Recently played.** The KTV doesn't expose history, but we can log every successful `Add1` server-side to a rolling JSON file under `DATA_DIR/history.jsonl`, then expose it as a virtual playlist.
- **Multi-select bulk actions.** Long-press a song to enter selection mode → bulk Add to Queue / bulk Add to Playlist.
- **Playlist sharing via QR code.** Encode a playlist as a JSON blob → a URL → a QR. Anyone on the LAN scans it and imports.
- **Playlist import/export.** Plain JSON download/upload for backup.
- **Keypad / song-number entry.** Power users sometimes know the 6-digit `songId` and want to type it directly. A numpad screen that submits `Add1` instantly.
- **Smart suggestions.** "People who queued X also queued Y" — derived from history, not the KTV. Useful at parties.
- **Voice search.** Tap mic → Web Speech API → fills the search input. Big win on phones.
- **Lyrics display.** The KTV plays the music; phones could show synced lyrics from a side service (musixmatch, etc.) for the singer to read off without looking at the TV.

### Platform / infra

- **Multi-user awareness.** Today everyone shares one queue. A `userId` cookie + per-user "I queued this" badges would let people see whose pick is next without changing the KTV-side queue.
- **Auth / room code.** Right now anyone on the Wi-Fi has full control. A 4-digit room code (set at boot, displayed on the host's screen) gates write commands.
- **Tests.** No test runner is configured. At minimum: a Vitest suite around `lib/ktv-client.ts` (record fixtures from the real KTV, replay them) and `lib/playlist-store.ts` (atomic writes under concurrent access).
- **Observability.** Log every command + outcome to a rolling file. Useful when "the KTV stopped responding" — was it a `code: -1` from the firmware or a network blip?
- **Health check / KTV reachability indicator.** A small dot in the tab bar that goes red when the KTV's `/PlaylistServlet` is failing, so users know it's the machine and not the app.
- **Replace JSONP-over-fetch with native JSON if the firmware supports it.** Worth probing each servlet without `jsonpCallback` — some Java servlets fall back to plain JSON when the callback param is absent.

### Hardware-adjacent

- **Microphone reverb / echo presets.** The KTV exposes `eff` (effect) and `pitch` in the playlist response but no command to change them is wired up yet. If the firmware accepts setters, expose preset chips: "Hall / Stadium / Dry / Pitch +1".
- **Auto-pause on inbound call.** iOS exposes audio session events; pause the KTV when the user takes a call.

## Conventions

- Path alias `@/*` → repo root.
- TypeScript `strict: true`; don't loosen it.
- Tailwind for styling; shadcn-style primitives in [components/ui/](components/ui/).
- No test runner — `pnpm build` is the type-check. Lint via `pnpm lint`.
