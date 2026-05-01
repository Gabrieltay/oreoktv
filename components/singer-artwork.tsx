"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { useImageBase } from "@/components/runtime-config";

export function SingerArtwork({ pic }: { pic: string }) {
  const [broken, setBroken] = useState(false);
  const imageBase = useImageBase();
  if (!pic || broken) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
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
      className="h-12 w-12 shrink-0 rounded-md bg-secondary object-cover"
    />
  );
}
