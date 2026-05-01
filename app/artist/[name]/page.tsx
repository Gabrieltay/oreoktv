"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Music2 } from "lucide-react";
import { SongList } from "@/components/song-list";
import { KTV_IMAGE_BASE } from "@/lib/config";
import { useSearchSongs } from "@/lib/queries";

export default function ArtistPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params?.name ?? "");

  // Peek at the first result to grab a singer picture (singer endpoint would
  // be cleaner, but we already have the first song's photo and it's the same
  // pic the search-for-this-artist flow shows elsewhere).
  const { data } = useSearchSongs({ singer: name });
  const firstPic = data?.pages[0]?.songList[0]?.singerPic;

  return (
    <>
      <div className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-2 px-3 py-2 backdrop-blur">
        <Link
          href="/?mode=artists"
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>
      <header className="flex flex-col items-center gap-4 px-4 pb-6 pt-2 text-center">
        <ArtistHero pic={firstPic} />
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-extrabold tracking-tight">{name}</h1>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Artist
          </div>
        </div>
      </header>
      <section className="flex-1">
        <SongList singer={name} />
      </section>
    </>
  );
}

function ArtistHero({ pic }: { pic: string | undefined }) {
  const [broken, setBroken] = useState(false);
  if (!pic || broken) {
    return (
      <div className="flex h-36 w-36 items-center justify-center rounded-full bg-secondary text-muted-foreground shadow-xl">
        <Music2 className="h-12 w-12" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- KTV image host is configured at runtime (LAN IP); next/image's build-time remotePatterns don't fit.
    <img
      src={`${KTV_IMAGE_BASE}/${pic}`}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-36 w-36 rounded-full bg-secondary object-cover shadow-xl"
    />
  );
}
