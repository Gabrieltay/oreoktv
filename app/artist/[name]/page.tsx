"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Music2 } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { SongList } from "@/components/song-list";
import { useImageBase } from "@/components/runtime-config";
import { useDebouncedValue } from "@/lib/hooks";
import { useSearchSongs } from "@/lib/queries";

export default function ArtistPage() {
  // useSearchParams requires a Suspense boundary at build time; mirror the
  // home page split (app/page.tsx).
  return (
    <Suspense fallback={null}>
      <ArtistScreen />
    </Suspense>
  );
}

function ArtistScreen() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params?.name ?? "");

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(urlQ);
  const debouncedQuery = useDebouncedValue(query, 300);

  // Sync ?q= to URL so reloads preserve the filter (mirrors app/page.tsx).
  useEffect(() => {
    const qs = new URLSearchParams();
    if (debouncedQuery) qs.set("q", debouncedQuery);
    const next = qs.toString();
    if (next !== searchParams.toString()) {
      const path = `/artist/${encodeURIComponent(name)}`;
      router.replace(next ? `${path}?${next}` : path, { scroll: false });
    }
  }, [debouncedQuery, name, router, searchParams]);

  // Hero pic peek stays UNFILTERED — passing songName here would re-key the
  // query on every keystroke and the photo would flicker/disappear.
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
      <div className="px-4 pb-3">
        <SearchBar value={query} onChange={setQuery} placeholder={`Search in ${name}...`} />
      </div>
      <section className="flex-1">
        <SongList songName={debouncedQuery} singer={name} />
      </section>
    </>
  );
}

function ArtistHero({ pic }: { pic: string | undefined }) {
  const [broken, setBroken] = useState(false);
  const imageBase = useImageBase();
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
      src={`${imageBase}/${pic}`}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-36 w-36 rounded-full bg-secondary object-cover shadow-xl"
    />
  );
}
