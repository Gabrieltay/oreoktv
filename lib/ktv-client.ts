import { z, type ZodType } from "zod";
import { getKtvBaseUrl } from "@/lib/server-config";

/**
 * The KTV exposes JSONP-wrapped Java servlets at a configurable base URL.
 * This module is the single adapter between that quirky API and the rest
 * of the app:
 *  - strips the JSONP callback wrapper
 *  - validates response shape with Zod
 *  - normalizes SHOUTING_CASE field names to camelCase via .transform()
 *
 * The base URL is resolved per request via `getKtvBaseUrl()` so the
 * in-app settings sheet can change it without a restart.
 *
 * All new servlets (queue, playback, volume) should be added here as
 * `{schema, fn}` pairs — no other file in the app should know about JSONP or
 * the raw field names.
 */

const JSONP_RE = /^[^(]*\(([\s\S]*)\)\s*;?\s*$/;

function stripJsonp(raw: string): unknown {
  const m = raw.match(JSONP_RE);
  if (!m) {
    throw new Error(`KTV response was not JSONP-wrapped: ${raw.slice(0, 120)}...`);
  }
  return JSON.parse(m[1]);
}

async function fetchJsonp<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  schema: ZodType<T>,
  baseUrlOverride?: string,
): Promise<T> {
  const callback = `jQuery_ksing_${Date.now()}`;
  const qs = new URLSearchParams({ jsonpCallback: callback });
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    qs.set(k, String(v));
  }
  qs.set("_", String(Date.now()));

  const baseUrl = baseUrlOverride ?? (await getKtvBaseUrl());
  const url = `${baseUrl}${path}?${qs.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`KTV ${path} returned ${res.status}`);
  }
  const text = await res.text();
  const parsed = stripJsonp(text);
  return schema.parse(parsed);
}

// ---------------------------------------------------------------------------
// /SearchServlet
// ---------------------------------------------------------------------------

const rawSongSchema = z
  .object({
    sONGBM: z.string(),
    sONGNAME: z.string(),
    sINGER: z.string(),
    sINGERPIC: z.string(),
    cLOUD: z.number(),
  })
  .transform((s) => ({
    songId: s.sONGBM,
    songName: s.sONGNAME,
    singer: s.sINGER,
    singerPic: s.sINGERPIC,
    isCloud: s.cLOUD === 1,
  }));

const searchResponseSchema = z.object({
  maxPage: z.number(),
  number: z.number(),
  page: z.number(),
  songList: z.array(rawSongSchema),
});

export type Song = z.infer<typeof rawSongSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export interface SearchParams {
  songName?: string;
  songType?: string;
  singer?: string;
  lang?: string;
  sortType?: string;
  page?: number;
}

export function searchSongs(params: SearchParams): Promise<SearchResponse> {
  return fetchJsonp(
    "/SearchServlet",
    {
      songName: params.songName ?? "",
      songType: params.songType ?? "",
      singer: params.singer ?? "",
      lang: params.lang ?? "",
      sortType: params.sortType ?? "",
      page: params.page ?? 0,
    },
    searchResponseSchema,
  );
}

// ---------------------------------------------------------------------------
// /SingerServlet
// ---------------------------------------------------------------------------

const singerSchema = z
  .object({ name: z.string(), picture: z.string() })
  .transform((s) => ({ name: s.name, picture: s.picture }));

const singersResponseSchema = z.object({
  maxPage: z.number(),
  number: z.number(),
  page: z.number(),
  singerList: z.array(singerSchema),
});

export type Singer = z.infer<typeof singerSchema>;
export type SingersResponse = z.infer<typeof singersResponseSchema>;

export interface SingersSearchParams {
  singer?: string;
  singerType?: string; // "全部" (default) or a language value
  sortType?: string;
  page?: number;
}

export function searchSingers(params: SingersSearchParams): Promise<SingersResponse> {
  return fetchJsonp(
    "/SingerServlet",
    {
      singer: params.singer ?? "",
      singerType: params.singerType ?? "全部",
      sortType: params.sortType ?? "",
      page: params.page ?? 0,
    },
    singersResponseSchema,
  );
}

// ---------------------------------------------------------------------------
// /PlaylistServlet — the current queue + playback state
// ---------------------------------------------------------------------------

const queueItemSchema = z
  .object({
    xH: z.string(),
    sONGNAME: z.string(),
    sINGER: z.string(),
  })
  .transform((s) => ({
    songId: s.xH,
    songName: s.sONGNAME,
    singer: s.sINGER,
  }));

const playlistResponseSchema = z
  .object({
    songList: z.array(queueItemSchema),
    number: z.number(),
    hasChange: z.string(),
    statePlay: z.boolean(),
    stateMute: z.boolean(),
    stateMuOr: z.boolean(),
    vol: z.number(),
    mic: z.number(),
    pitch: z.number(),
    eff: z.number(),
  })
  .transform((p) => ({
    queue: p.songList,
    count: p.number,
    hasChange: p.hasChange === "true",
    isPlaying: p.statePlay,
    isMuted: p.stateMute,
    isOriginalVocal: p.stateMuOr,
    volume: p.vol,
    micVolume: p.mic,
    pitch: p.pitch,
    effect: p.eff,
  }));

export type QueueItem = z.infer<typeof queueItemSchema>;
export type Playlist = z.infer<typeof playlistResponseSchema>;

export function getPlaylist(): Promise<Playlist> {
  return fetchJsonp(
    "/PlaylistServlet",
    { onSelectPage: "true", type: "1" },
    playlistResponseSchema,
  );
}

/**
 * Validate that a candidate base URL responds to /PlaylistServlet correctly.
 * Used by the settings save flow to refuse a bad IP before persisting it.
 */
export function pingKtv(baseUrl: string): Promise<Playlist> {
  return fetchJsonp(
    "/PlaylistServlet",
    { onSelectPage: "true", type: "1" },
    playlistResponseSchema,
    baseUrl,
  );
}

// ---------------------------------------------------------------------------
// /CommandServlet — fire-and-forget playback/queue commands
// ---------------------------------------------------------------------------

const commandResponseSchema = z.object({
  cmd: z.string(),
  code: z.string(),
});

/**
 * Known commands. The KTV returns `{cmd, code}` where code "0" = success.
 * Add new commands here as they're discovered.
 */
/** Commands that operate on a specific song (cmdValue = songId). */
export type SongCommand = "Add1" | "Pro1" | "Del1";
// Add1: append song to queue
// Pro1: add song to TOP of queue (insert at front)
// Del1: remove song from queue

/** Commands that take no cmdValue. */
export type PlaybackCommand =
  | "Play" // toggle pause/resume
  | "Skip" // skip to next song
  | "Reset" // restart current song from beginning
  | "MuOr" // toggle original vocal (guide vocal on/off)
  | "Mute" // toggle mute
  | "Music_up" // music volume +1 step
  | "Music_down" // music volume -1 step
  | "Mic_up" // mic volume +1 step
  | "Mic_down"; // mic volume -1 step

export type CommandName = SongCommand | PlaybackCommand;
// Note: Pro2 (move existing queue item to top) exists but is broken in the
// KTV firmware — even the machine's own UI can't reorder queued items.
// Emulated client-side via Del1 + Pro1 in useMoveToTop().

export async function sendCommand(cmd: CommandName, cmdValue?: string): Promise<void> {
  const res = await fetchJsonp(
    "/CommandServlet",
    cmdValue !== undefined ? { cmd, cmdValue } : { cmd },
    commandResponseSchema,
  );
  if (res.code !== "0") {
    const suffix = cmdValue !== undefined ? `(${cmdValue})` : "";
    throw new Error(`KTV rejected ${cmd}${suffix}: code=${res.code}`);
  }
}
