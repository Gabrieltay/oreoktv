"use client";

import { ChevronsUp, Cloud, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Song } from "@/lib/ktv-client";
import { useKtvCommand } from "@/lib/queries";
import { toast } from "@/components/toaster";
import { cn } from "@/lib/utils";
import { AddToPlaylistButton } from "@/components/add-to-playlist-button";
import { SingerArtwork } from "@/components/singer-artwork";

export function SongRow({ song }: { song: Song }) {
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
    <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40">
      <SingerArtwork pic={song.singerPic} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{song.songName}</span>
          {song.isCloud && (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 bg-secondary/60 px-1.5 py-0 text-[10px] font-medium"
            >
              <Cloud className="h-2.5 w-2.5" />
              Cloud
            </Badge>
          )}
        </div>
        <div className="truncate text-sm text-muted-foreground">{song.singer}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <AddToPlaylistButton song={song} />
        <SongAction
          label={`Play next — ${song.songName}`}
          pending={cmd.isPending}
          onClick={onPlayNext}
        >
          <ChevronsUp className="h-5 w-5" />
        </SongAction>
        <SongAction
          label={`Add to queue — ${song.songName}`}
          pending={cmd.isPending}
          onClick={onAdd}
          tone="primary"
        >
          <Plus className="h-5 w-5" />
        </SongAction>
      </div>
    </div>
  );
}

function SongAction({
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
