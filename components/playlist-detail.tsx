"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronsUp,
  ListPlus,
  Loader2,
  Music2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddPlaylistToQueue,
  useDeletePlaylist,
  useKtvCommand,
  usePlaylistDetail,
  useRemoveSongFromPlaylist,
  useRenamePlaylist,
} from "@/lib/queries";
import type { PlaylistSong } from "@/lib/playlist-types";
import { toast } from "@/components/toaster";
import { cn } from "@/lib/utils";

export function PlaylistDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, isError, error } = usePlaylistDetail(id);
  const rename = useRenamePlaylist();
  const remove = useDeletePlaylist();
  const addAll = useAddPlaylistToQueue();

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 py-4">
        <Skeleton className="h-7 w-2/5" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8 text-center text-sm text-destructive">
        {error instanceof Error ? error.message : "Something went wrong"}
      </div>
    );
  }

  if (!data) return null;

  const onRename = () => {
    const name = window.prompt("Rename playlist", data.name);
    if (!name?.trim() || name.trim() === data.name) return;
    rename.mutate(
      { id: data.id, name: name.trim() },
      { onError: (e) => toast(e.message, "error") },
    );
  };

  const onDelete = () => {
    if (!window.confirm(`Delete "${data.name}"?`)) return;
    remove.mutate(data.id, {
      onSuccess: () => {
        toast(`Deleted · ${data.name}`);
        router.replace("/playlists");
      },
      onError: (e) => toast(e.message, "error"),
    });
  };

  const onAddAll = () => {
    if (data.songs.length === 0) return;
    addAll.mutate(data.songs, {
      onSuccess: ({ added, total }) => toast(`Queued ${added}/${total} songs`),
      onError: (e) => toast(e.message, "error"),
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          type="button"
          onClick={() => router.push("/playlists")}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onRename}
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent/40"
        >
          <span className="truncate text-lg font-semibold">{data.name}</span>
          <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={remove.isPending}
          aria-label="Delete playlist"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
        >
          {remove.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Trash2 className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onAddAll}
          disabled={data.songs.length === 0 || addAll.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50"
        >
          {addAll.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ListPlus className="h-4 w-4" />
          )}
          {data.songs.length === 0
            ? "Add songs from Search"
            : `Add all to queue (${data.songs.length})`}
        </button>
      </div>

      {data.songs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-muted-foreground">
          <Music2 className="h-8 w-8" />
          <div className="text-sm">No songs yet</div>
          <div className="text-xs">Bookmark songs from the Search tab to add them here.</div>
        </div>
      ) : (
        <div>
          {data.songs.map((song, idx) => (
            <PlaylistSongRow
              key={`${song.songId}-${idx}`}
              playlistId={data.id}
              song={song}
              index={idx}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlaylistSongRow({
  playlistId,
  song,
  index,
}: {
  playlistId: string;
  song: PlaylistSong;
  index: number;
}) {
  const removeSong = useRemoveSongFromPlaylist();
  const cmd = useKtvCommand();
  const onRemove = () =>
    removeSong.mutate(
      { id: playlistId, songId: song.songId },
      {
        onSuccess: () => toast(`Removed · ${song.songName}`),
        onError: (e) => toast(e.message, "error"),
      },
    );
  const onAdd = () =>
    cmd.mutate(
      { cmd: "Add1", songId: song.songId },
      {
        onSuccess: () => toast(`Added · ${song.songName}`),
        onError: (e) => toast(e.message, "error"),
      },
    );
  const onPlayNext = () =>
    cmd.mutate(
      { cmd: "Pro1", songId: song.songId },
      {
        onSuccess: () => toast(`Playing next · ${song.songName}`),
        onError: (e) => toast(e.message, "error"),
      },
    );

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-muted-foreground">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{song.songName}</div>
        <div className="truncate text-sm text-muted-foreground">{song.singer}</div>
      </div>
      <button
        type="button"
        aria-label={`Remove ${song.songName}`}
        disabled={removeSong.isPending}
        onClick={onRemove}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-destructive/15 hover:text-destructive active:scale-95 disabled:opacity-50",
        )}
      >
        {removeSong.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Trash2 className="h-5 w-5" />
        )}
      </button>
      <button
        type="button"
        aria-label={`Play next — ${song.songName}`}
        disabled={cmd.isPending}
        onClick={onPlayNext}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 disabled:opacity-50"
      >
        {cmd.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ChevronsUp className="h-5 w-5" />
        )}
      </button>
      <button
        type="button"
        aria-label={`Add to queue — ${song.songName}`}
        disabled={cmd.isPending}
        onClick={onAdd}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50"
      >
        {cmd.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Plus className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
