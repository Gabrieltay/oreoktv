"use client";

import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SingerRow } from "@/components/singer-row";
import { useSearchSingers } from "@/lib/queries";

interface Props {
  singer: string;
  singerType: string;
}

export function SingerList({ singer, singerType }: Props) {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSearchSingers({ singer, singerType });

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <SkeletonRows />;

  if (isError) {
    return (
      <div className="px-4 py-8 text-center text-sm text-destructive">
        {error instanceof Error ? error.message : "Something went wrong"}
      </div>
    );
  }

  const singers = data?.pages.flatMap((p) => p.singerList) ?? [];

  if (singers.length === 0) {
    return <div className="px-4 py-12 text-center text-sm text-muted-foreground">No results</div>;
  }

  return (
    <div>
      {singers.map((s) => (
        <SingerRow key={s.name} singer={s} />
      ))}
      <div ref={sentinelRef} className="h-8" />
      {isFetchingNextPage && <SkeletonRows count={3} />}
    </div>
  );
}

function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
