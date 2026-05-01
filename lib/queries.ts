"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CommandName,
  PlaybackCommand,
  Playlist,
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

async function postCommand(cmd: CommandName, cmdValue?: string): Promise<void> {
  const res = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cmdValue !== undefined ? { cmd, cmdValue } : { cmd }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Command failed (${res.status})`);
  }
}

export function useKtvCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cmd, songId }: { cmd: CommandName; songId: string }) => postCommand(cmd, songId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["playlist"] });
    },
  });
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
    mutationFn: async (songId: string) => {
      await postCommand("Del1", songId);
      await postCommand("Pro1", songId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["playlist"] });
    },
    onError: () => {
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
        await postCommand("Add1", s.songId);
        added += 1;
      }
      return { added, total: songs.length };
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["playlist"] });
    },
  });
}
