"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Music2 } from "lucide-react";
import { useImageBase } from "@/components/runtime-config";
import type { Singer } from "@/lib/ktv-client";

export function SingerRow({ singer }: { singer: Singer }) {
  return (
    <Link
      href={`/artist/${encodeURIComponent(singer.name)}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40 active:bg-accent"
    >
      <SingerAvatar pic={singer.picture} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{singer.name}</div>
        <div className="text-xs text-muted-foreground">Artist</div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function SingerAvatar({ pic }: { pic: string }) {
  const [broken, setBroken] = useState(false);
  const imageBase = useImageBase();
  if (!pic || broken) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Music2 className="h-5 w-5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- KTV image host is configured at runtime (LAN IP); next/image's build-time remotePatterns don't fit.
    <img
      src={`${imageBase}/${pic}`}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-12 w-12 shrink-0 rounded-full bg-secondary object-cover"
    />
  );
}
