"use client";

import Link from "next/link";
import { ChevronRight, ListMusic, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreatePlaylist, usePlaylists } from "@/lib/queries";
import { toast } from "@/components/toaster";

export function PlaylistList() {
  const { data, isLoading, isError, error } = usePlaylists();
  const create = useCreatePlaylist();

  const onCreate = () => {
    const name = window.prompt("Playlist name");
    if (!name?.trim()) return;
    create.mutate(name.trim(), {
      onSuccess: (p) => toast(`Created · ${p.name}`),
      onError: (e) => toast(e.message, "error"),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {data ? `${data.length} ${data.length === 1 ? "playlist" : "playlists"}` : ""}
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={create.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      {isLoading ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="px-4 py-8 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Something went wrong"}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-muted-foreground">
          <ListMusic className="h-8 w-8" />
          <div className="text-sm">No playlists yet</div>
          <div className="text-xs">
            Tap <span className="font-semibold">New</span> to create one, then bookmark songs from
            Search.
          </div>
        </div>
      ) : (
        <div>
          {data.map((p) => (
            <Link
              key={p.id}
              href={`/playlists/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <ListMusic className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{p.name}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {p.songCount} {p.songCount === 1 ? "song" : "songs"}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
