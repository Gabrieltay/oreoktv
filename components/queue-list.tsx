"use client";

import { ChevronsUp, Loader2, Music2, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useKtvCommand, useMoveToTop, usePlaylist } from "@/lib/queries";
import { toast } from "@/components/toaster";
import type { QueueItem } from "@/lib/ktv-client";
import { cn } from "@/lib/utils";

export function QueueList() {
  const { data, isLoading, isError, error } = usePlaylist();

  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded" />
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

  if (!data) return null;

  if (data.queue.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-muted-foreground">
        <Music2 className="h-8 w-8" />
        <div className="text-sm">Queue is empty</div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {data.count} {data.count === 1 ? "song" : "songs"}
      </div>
      <div>
        {data.queue.map((item, idx) => (
          <QueueRow key={`${item.songId}-${idx}`} item={item} index={idx} />
        ))}
      </div>
    </div>
  );
}

function QueueRow({ item, index }: { item: QueueItem; index: number }) {
  const cmd = useKtvCommand();
  const moveToTop = useMoveToTop();
  const pending = cmd.isPending || moveToTop.isPending;

  const onRemove = () =>
    cmd.mutate(
      { cmd: "Del1", songId: item.songId },
      {
        onSuccess: () => toast(`Removed · ${item.songName}`),
        onError: (e) => toast(e.message, "error"),
      },
    );

  const onMoveToTop = () =>
    moveToTop.mutate(item, {
      onSuccess: () => toast(`Moved to top · ${item.songName}`),
      onError: (e) => toast(e.message, "error"),
    });

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-muted-foreground">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{item.songName}</div>
        <div className="truncate text-sm text-muted-foreground">{item.singer}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ActionButton
          label={`Move ${item.songName} to top`}
          pending={pending}
          onClick={onMoveToTop}
        >
          <ChevronsUp className="h-5 w-5" />
        </ActionButton>
        <ActionButton
          label={`Remove ${item.songName}`}
          pending={pending}
          tone="destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-5 w-5" />
        </ActionButton>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  pending,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
  tone?: "default" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50",
        tone === "destructive"
          ? "text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}
