"use client";

import { useEffect, useState } from "react";
import { BookmarkPlus, ListMusic, Loader2, Plus, X } from "lucide-react";
import { useAddSongToPlaylist, useCreatePlaylist, usePlaylists } from "@/lib/queries";
import type { PlaylistSong } from "@/lib/playlist-types";
import type { Song } from "@/lib/ktv-client";
import { toast } from "@/components/toaster";
import { cn } from "@/lib/utils";

export function AddToPlaylistButton({ song }: { song: Song }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`Add ${song.songName} to a playlist`}
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
      >
        <BookmarkPlus className="h-5 w-5" />
      </button>
      {open && <PlaylistPickerSheet song={song} onClose={() => setOpen(false)} />}
    </>
  );
}

function PlaylistPickerSheet({ song, onClose }: { song: Song; onClose: () => void }) {
  const { data, isLoading } = usePlaylists();
  const addSong = useAddSongToPlaylist();
  const create = useCreatePlaylist();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const payload: PlaylistSong = {
    songId: song.songId,
    songName: song.songName,
    singer: song.singer,
    singerPic: song.singerPic,
    isCloud: song.isCloud,
  };

  const onPick = (id: string, playlistName: string) => {
    addSong.mutate(
      { id, song: payload },
      {
        onSuccess: () => {
          toast(`Added to ${playlistName}`);
          onClose();
        },
        onError: (e) => toast(e.message, "error"),
      },
    );
  };

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: (p) => {
        addSong.mutate(
          { id: p.id, song: payload },
          {
            onSuccess: () => {
              toast(`Added to ${p.name}`);
              onClose();
            },
            onError: (err) => toast(err.message, "error"),
          },
        );
      },
      onError: (err) => toast(err.message, "error"),
    });
  };

  const busy = addSong.isPending || create.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to playlist"
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-background pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Add to playlist</div>
            <div className="truncate text-xs text-muted-foreground">
              {song.songName} · {song.singer}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No playlists yet — create one below.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(p.id, p.name)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 disabled:opacity-50",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                    <ListMusic className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{p.name}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {p.songCount} {p.songCount === 1 ? "song" : "songs"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-3">
          {creating ? (
            <form onSubmit={onCreate} className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Playlist name"
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-base outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                {create.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              New playlist
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
