"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CommandName,
  PlaybackCommand,
  Playlist,
  QueueItem,
  SearchResponse,
  SingersResponse,
} from "@/lib/ktv-client";
import type { Playlist as UserPlaylist, PlaylistMeta, PlaylistSong } from "@/lib/playlist-types";

export interface UseSearchSongsArgs {
  songName?: string;
  singer?: string;
  lang?: string;
  enabled?: boolean;
}

async function fetchSearchPage(args: UseSearchSongsArgs, page: number): Promise<SearchResponse> {
  const qs = new URLSearchParams();
  if (args.songName) qs.set("songName", args.songName);
  if (args.singer) qs.set("singer", args.singer);
  if (args.lang) qs.set("lang", args.lang);
  qs.set("page", String(page));
  const res = await fetch(`/api/songs/search?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Search failed (${res.status})`);
  }
  return res.json();
}

export function useSearchSongs(args: UseSearchSongsArgs) {
  return useInfiniteQuery({
    queryKey: ["songs", "search", args.songName ?? "", args.singer ?? "", args.lang ?? ""] as const,
    queryFn: ({ pageParam = 0 }) => fetchSearchPage(args, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.page + 1 < lastPage.maxPage ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: args.enabled ?? true,
  });
}

export interface UseSearchSingersArgs {
  singer: string;
  singerType: string;
  enabled?: boolean;
}

async function fetchSingersPage(
  args: UseSearchSingersArgs,
  page: number,
): Promise<SingersResponse> {
  const qs = new URLSearchParams();
  if (args.singer) qs.set("singer", args.singer);
  if (args.singerType) qs.set("singerType", args.singerType);
  qs.set("page", String(page));
  const res = await fetch(`/api/singers/search?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Singer search failed (${res.status})`);
  }
  return res.json();
}

export function useSearchSingers(args: UseSearchSingersArgs) {
  return useInfiniteQuery({
    queryKey: ["singers", "search", args.singer, args.singerType] as const,
    queryFn: ({ pageParam = 0 }) => fetchSingersPage(args, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.page + 1 < lastPage.maxPage ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: args.enabled ?? true,
  });
}

async function fetchPlaylist(): Promise<Playlist> {
  const res = await fetch("/api/playlist");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Playlist fetch failed (${res.status})`);
  }
  return res.json();
}

export function usePlaylist() {
  return useQuery({
    queryKey: ["playlist"] as const,
    queryFn: fetchPlaylist,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

type AddMeta = Pick<PlaylistSong, "songName" | "singer" | "singerPic" | "isCloud">;

async function postCommand(cmd: CommandName, cmdValue?: string, meta?: AddMeta): Promise<void> {
  const payload: Record<string, unknown> = { cmd };
  if (cmdValue !== undefined) payload.cmdValue = cmdValue;
  if (cmd === "Add1" && meta) payload.meta = meta;
  const res = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Command failed (${res.status})`);
  }
}

/**
 * Apply an in-place mutation to the cached playlist. Returns the previous
 * value so onError can roll back. The poll (every 3 s) will reconcile any
 * drift between our optimistic shape and the KTV's actual state.
 */
async function optimisticPlaylistMutate(
  qc: ReturnType<typeof useQueryClient>,
  fn: (queue: QueueItem[]) => QueueItem[],
): Promise<{ previous: Playlist | undefined }> {
  await qc.cancelQueries({ queryKey: ["playlist"] });
  const previous = qc.getQueryData<Playlist>(["playlist"]);
  if (previous) {
    const queue = fn(previous.queue);
    qc.setQueryData<Playlist>(["playlist"], { ...previous, queue, count: queue.length });
  }
  return { previous };
}

function rollbackPlaylist(
  qc: ReturnType<typeof useQueryClient>,
  ctx: { previous: Playlist | undefined } | undefined,
) {
  if (ctx?.previous) qc.setQueryData(["playlist"], ctx.previous);
}

/**
 * Queue/playback song commands. Pass `item` (full PlaylistSong) on Add1/Pro1
 * to enable optimistic insertion; for Add1 the item also gets persisted to
 * the server-side history log so it shows up in Recently played. Without
 * `item`, the optimistic step is skipped for adds. Del1 only needs songId.
 */
export function useKtvCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cmd,
      songId,
      item,
    }: {
      cmd: CommandName;
      songId: string;
      item?: PlaylistSong;
    }) => postCommand(cmd, songId, item),
    onMutate: async ({ cmd, songId, item }) => {
      if (cmd === "Add1" && item) {
        return optimisticPlaylistMutate(qc, (q) => [...q, toQueueItem(item)]);
      }
      if (cmd === "Pro1" && item) {
        return optimisticPlaylistMutate(qc, (q) => [toQueueItem(item), ...q]);
      }
      if (cmd === "Del1") {
        return optimisticPlaylistMutate(qc, (q) => {
          const i = q.findIndex((s) => s.songId === songId);
          if (i < 0) return q;
          return [...q.slice(0, i), ...q.slice(i + 1)];
        });
      }
      return undefined;
    },
    onError: (_e, _vars, ctx) => rollbackPlaylist(qc, ctx),
    onSettled: (_d, _e, vars) => {
      void qc.invalidateQueries({ queryKey: ["playlist"] });
      if (vars.cmd === "Add1") void qc.invalidateQueries({ queryKey: ["recent"] });
    },
  });
}

function toQueueItem(s: PlaylistSong): QueueItem {
  return { songId: s.songId, songName: s.songName, singer: s.singer };
}

/**
 * "Move to top" in the queue. Pro2 is broken in the KTV firmware, so we
 * emulate it as Del1 + Pro1 in sequence. Del1 first (not Pro1 first), so
 * a duplicate of the same song at position 1 doesn't get removed instead
 * of the one we meant to move.
 *
 * If Del1 succeeds but Pro1 fails, the song is gone from the queue — the
 * error surfaces to the caller so the UI can explain what happened.
 */
export function useMoveToTop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: QueueItem) => {
      await postCommand("Del1", item.songId);
      await postCommand("Pro1", item.songId);
    },
    onMutate: (item) =>
      optimisticPlaylistMutate(qc, (q) => {
        const i = q.findIndex((s) => s.songId === item.songId);
        const without = i < 0 ? q : [...q.slice(0, i), ...q.slice(i + 1)];
        return [item, ...without];
      }),
    onError: (_e, _vars, ctx) => rollbackPlaylist(qc, ctx),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["playlist"] });
    },
  });
}

/**
 * Parameter-less playback commands: Play (toggle pause/resume), Skip, Reset.
 */
export function usePlaybackCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cmd: PlaybackCommand) => postCommand(cmd),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["playlist"] });
    },
  });
}

// ---------------------------------------------------------------------------
// User playlists (file-backed, served from /api/playlists)
// ---------------------------------------------------------------------------

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `${fallback} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"] as const,
    queryFn: async () =>
      jsonOrThrow<PlaylistMeta[]>(await fetch("/api/playlists"), "Failed to load playlists"),
    staleTime: 0,
  });
}

export function usePlaylistDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["playlists", id] as const,
    queryFn: async () =>
      jsonOrThrow<UserPlaylist>(await fetch(`/api/playlists/${id}`), "Failed to load playlist"),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      jsonOrThrow<UserPlaylist>(
        await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
        "Failed to create playlist",
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Delete failed (${res.status})`);
      }
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.removeQueries({ queryKey: ["playlists", id] });
    },
  });
}

export function useRenamePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      jsonOrThrow<UserPlaylist>(
        await fetch(`/api/playlists/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
        "Failed to rename playlist",
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.setQueryData(["playlists", data.id], data);
    },
  });
}

export function useAddSongToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, song }: { id: string; song: PlaylistSong }) =>
      jsonOrThrow<UserPlaylist>(
        await fetch(`/api/playlists/${id}/songs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(song),
        }),
        "Failed to add song",
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.setQueryData(["playlists", data.id], data);
    },
  });
}

export function useRemoveSongFromPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, songId }: { id: string; songId: string }) =>
      jsonOrThrow<UserPlaylist>(
        await fetch(`/api/playlists/${id}/songs?songId=${encodeURIComponent(songId)}`, {
          method: "DELETE",
        }),
        "Failed to remove song",
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.setQueryData(["playlists", data.id], data);
    },
  });
}

/**
 * Server-logged history of every successful Add1, surfaced as a
 * read-only virtual playlist. Invalidated on Add1 success so the list
 * updates without polling.
 */
export function useRecentlyPlayed() {
  return useQuery({
    queryKey: ["recent"] as const,
    queryFn: async () =>
      jsonOrThrow<UserPlaylist>(await fetch("/api/history"), "Failed to load history"),
    staleTime: 60 * 1000,
  });
}

/**
 * Bulk-enqueue every song in a playlist onto the live KTV queue. Sequential
 * because the KTV's CommandServlet doesn't tolerate parallel writes well, and
 * because surfacing a partial result is cleaner than fanning out.
 */
export function useAddPlaylistToQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (songs: PlaylistSong[]) => {
      let added = 0;
      for (const s of songs) {
        await postCommand("Add1", s.songId, s);
        added += 1;
      }
      return { added, total: songs.length };
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["playlist"] });
      void qc.invalidateQueries({ queryKey: ["recent"] });
    },
  });
}
