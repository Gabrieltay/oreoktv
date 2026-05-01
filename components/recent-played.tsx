"use client";

import { ChevronsUp, History, Loader2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useKtvCommand, useRecentlyPlayed } from "@/lib/queries";
import { toast } from "@/components/toaster";
import type { PlaylistSong } from "@/lib/playlist-types";
import { cn } from "@/lib/utils";
import { SingerArtwork } from "@/components/singer-artwork";
import { AddToPlaylistButton } from "@/components/add-to-playlist-button";

export function RecentPlayed() {
  const { data, isLoading, isError, error } = useRecentlyPlayed();

  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
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

  if (!data || data.songs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-muted-foreground">
        <History className="h-8 w-8" />
        <div className="text-sm">No history yet</div>
        <div className="text-xs">Songs you queue from Search will appear here.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {data.songs.length} {data.songs.length === 1 ? "song" : "songs"}
      </div>
      <div>
        {data.songs.map((song, idx) => (
          <RecentRow key={`${song.songId}-${idx}`} song={song} index={idx} />
        ))}
      </div>
    </div>
  );
}

function RecentRow({ song, index }: { song: PlaylistSong; index: number }) {
  const cmd = useKtvCommand();
  const onAdd = () =>
    cmd.mutate(
      { cmd: "Add1", songId: song.songId, item: song },
      {
        onSuccess: () => toast(`Added · ${song.songName}`),
        onError: (e) => toast(e.message, "error"),
      },
    );
  const onPlayNext = () =>
    cmd.mutate(
      { cmd: "Pro1", songId: song.songId, item: song },
      {
        onSuccess: () => toast(`Playing next · ${song.songName}`),
        onError: (e) => toast(e.message, "error"),
      },
    );

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40">
      <div className="w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground">
        {index + 1}
      </div>
      <SingerArtwork pic={song.singerPic} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{song.songName}</div>
        <div className="truncate text-sm text-muted-foreground">{song.singer}</div>
      </div>
      <AddToPlaylistButton song={song} />
      <RowAction
        label={`Play next — ${song.songName}`}
        pending={cmd.isPending}
        onClick={onPlayNext}
      >
        <ChevronsUp className="h-5 w-5" />
      </RowAction>
      <RowAction
        label={`Add to queue — ${song.songName}`}
        pending={cmd.isPending}
        onClick={onAdd}
        tone="primary"
      >
        <Plus className="h-5 w-5" />
      </RowAction>
    </div>
  );
}

function RowAction({
  label,
  onClick,
  pending,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
  tone?: "primary" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full transition-all disabled:opacity-50",
        tone === "primary"
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}
