import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import type { PlaylistSong } from "@/lib/playlist-types";

/**
 * Server-only append-only log of every song the KTV accepts via Add1. The
 * KTV firmware doesn't expose play history, so we capture it at the one
 * server-side chokepoint that sees every queue add.
 *
 * Format: JSONL at `${DATA_DIR}/history.jsonl`, one record per line.
 * Append-only on the hot path so concurrent phones don't have to read +
 * rewrite the file. Two phones queueing in the same millisecond can in
 * theory interleave bytes; we tolerate that by skipping unparseable lines
 * on read (one corrupt line at most, very rare in single-household use).
 *
 * Reads return up to RECENT_LIMIT unique songs (most-recent first, dedup
 * by songId). The file is allowed to grow to COMPACT_THRESHOLD lines
 * before being rewritten down — that amortizes O(N) compactions across
 * many appends so the common path stays O(1).
 */

const DATA_DIR = process.env.DATA_DIR ?? "./data";
const HISTORY_FILE = path.resolve(DATA_DIR, "history.jsonl");

export const RECENT_LIMIT = 200;
const COMPACT_THRESHOLD = Math.floor(RECENT_LIMIT * 1.5);

const recordSchema = z.object({
  songId: z.string(),
  songName: z.string(),
  singer: z.string(),
  singerPic: z.string().default(""),
  isCloud: z.boolean().default(false),
  addedAt: z.string(),
});

type HistoryRecord = z.infer<typeof recordSchema>;

async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
}

async function readAllLines(): Promise<string[]> {
  let raw: string;
  try {
    raw = await fs.readFile(HISTORY_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return raw.split("\n").filter((l) => l.length > 0);
}

function parseLine(line: string): HistoryRecord | null {
  try {
    const parsed = recordSchema.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Append a single Add1 to the history log. Best-effort: if the disk write
 * fails we log and swallow — losing a history entry must never break the
 * user's queue add.
 */
export async function recordAdd(song: PlaylistSong, addedAt: string): Promise<void> {
  const record: HistoryRecord = { ...song, addedAt };
  const line = JSON.stringify(record) + "\n";
  try {
    await ensureDir();
    await fs.appendFile(HISTORY_FILE, line, "utf8");
    await maybeCompact();
  } catch (err) {
    console.warn("[history-store] recordAdd failed:", err);
  }
}

/**
 * Return up to `limit` most-recently-added unique songs (newest first,
 * dedup by songId). Older duplicates are silently dropped.
 */
export async function getRecent(limit = RECENT_LIMIT): Promise<PlaylistSong[]> {
  const lines = await readAllLines();
  const seen = new Set<string>();
  const out: PlaylistSong[] = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const rec = parseLine(lines[i]);
    if (!rec) continue;
    if (seen.has(rec.songId)) continue;
    seen.add(rec.songId);
    out.push({
      songId: rec.songId,
      songName: rec.songName,
      singer: rec.singer,
      singerPic: rec.singerPic,
      isCloud: rec.isCloud,
    });
  }
  return out;
}

/**
 * If the file has grown past COMPACT_THRESHOLD lines, rewrite it keeping
 * the last RECENT_LIMIT unique entries (in original chronological order).
 * Atomic via tmp + rename, same pattern as playlist-store's writes.
 */
async function maybeCompact(): Promise<void> {
  const lines = await readAllLines();
  if (lines.length <= COMPACT_THRESHOLD) return;

  const seen = new Set<string>();
  const keptReverse: HistoryRecord[] = [];
  for (let i = lines.length - 1; i >= 0 && keptReverse.length < RECENT_LIMIT; i--) {
    const rec = parseLine(lines[i]);
    if (!rec || seen.has(rec.songId)) continue;
    seen.add(rec.songId);
    keptReverse.push(rec);
  }
  const kept = keptReverse.reverse();
  const body = kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : "");

  const tmp = `${HISTORY_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, HISTORY_FILE);
}
