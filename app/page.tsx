"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search-bar";
import { LanguageChips } from "@/components/language-chips";
import { SongList } from "@/components/song-list";
import { SingerList } from "@/components/singer-list";
import type { SearchMode } from "@/components/search-mode-toggle";
import { useDebouncedValue } from "@/lib/hooks";
import { langToSingerType } from "@/lib/config";

export default function Home() {
  // useSearchParams requires a Suspense boundary at build time to allow the
  // shell to prerender while the search-param-driven content is deferred.
  return (
    <Suspense fallback={null}>
      <SearchScreen />
    </Suspense>
  );
}

function SearchScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  const urlLang = searchParams.get("lang") ?? "";
  const urlMode = (searchParams.get("mode") ?? "songs") as SearchMode;

  const [query, setQuery] = useState(urlQ);
  const [lang, setLang] = useState(urlLang);
  const [mode, setMode] = useState<SearchMode>(urlMode);
  const debouncedQuery = useDebouncedValue(query, 300);

  // Keep URL in sync with debounced query + lang + mode so reloads preserve state.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (debouncedQuery) qs.set("q", debouncedQuery);
    if (lang) qs.set("lang", lang);
    if (mode !== "songs") qs.set("mode", mode);
    const next = qs.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `/?${next}` : "/", { scroll: false });
    }
  }, [debouncedQuery, lang, mode, router, searchParams]);

  const onChangeLang = useCallback((v: string) => setLang(v), []);

  return (
    <>
      <header className="flex flex-col gap-3 border-b bg-background px-4 py-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={mode === "songs" ? "Search song..." : "Search artist..."}
          mode={mode}
          onModeChange={setMode}
        />
        <LanguageChips value={lang} onChange={onChangeLang} />
      </header>
      <section className="flex-1">
        {mode === "songs" ? (
          <SongList songName={debouncedQuery} lang={lang} />
        ) : (
          <SingerList singer={debouncedQuery} singerType={langToSingerType(lang)} />
        )}
      </section>
    </>
  );
}
