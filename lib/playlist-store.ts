import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import type {
  Playlist as PlaylistType,
  PlaylistMeta as PlaylistMetaType,
  PlaylistSong as PlaylistSongType,
} from "@/lib/playlist-types";

/**
 * Server-only filesystem adapter for user-curated playlists. One JSON file per
 * playlist under `${DATA_DIR}/playlists/<uuid>.json`. The rest of the app
 * never touches the filesystem directly — all reads/writes go through here.
 *
 * DATA_DIR defaults to `./data` (resolved relative to the Next.js process
 * cwd). In Docker we set DATA_DIR=/data and bind-mount the host's `./data`
 * onto it so playlists survive image rebuilds.
 */

const DATA_DIR = process.env.DATA_DIR ?? "./data";
export const PLAYLISTS_DIR = path.resolve(DATA_DIR, "playlists");

const songSchema = z.object({
  songId: z.string(),
  songName: z.string(),
  singer: z.string(),
  singerPic: z.string().default(""),
  isCloud: z.boolean().default(false),
});

const playlistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  songs: z.array(songSchema),
});

export type PlaylistSong = PlaylistSongType;
export type Playlist = PlaylistType;
export type PlaylistMeta = PlaylistMetaType;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new PlaylistError("invalid_id", `Invalid playlist id: ${id}`, 400);
  }
}

function fileFor(id: string): string {
  assertValidId(id);
  return path.join(PLAYLISTS_DIR, `${id}.json`);
}

export class PlaylistError extends Error {
  constructor(
    public code: "not_found" | "invalid_id" | "invalid_input" | "io",
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "PlaylistError";
  }
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(PLAYLISTS_DIR, { recursive: true });
}

async function readFile(id: string): Promise<Playlist> {
  const file = fileFor(id);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PlaylistError("not_found", `Playlist ${id} not found`, 404);
    }
    throw err;
  }
  return playlistSchema.parse(JSON.parse(raw));
}

async function writeFileAtomic(playlist: Playlist): Promise<void> {
  await ensureDir();
  const final = fileFor(playlist.id);
  const tmp = `${final}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(playlist, null, 2), "utf8");
  await fs.rename(tmp, final);
}

export async function listPlaylists(): Promise<PlaylistMeta[]> {
  await ensureDir();
  const entries = await fs.readdir(PLAYLISTS_DIR);
  const metas: PlaylistMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const id = entry.slice(0, -".json".length);
    if (!UUID_RE.test(id)) continue;
    try {
      const p = await readFile(id);
      metas.push({
        id: p.id,
        name: p.name,
        songCount: p.songs.length,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    } catch (err) {
      console.warn(`[playlist-store] skipping ${entry}:`, err);
    }
  }
  metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return metas;
}

export async function getPlaylist(id: string): Promise<Playlist> {
  return readFile(id);
}

function normalizeName(name: unknown): string {
  if (typeof name !== "string") {
    throw new PlaylistError("invalid_input", "name must be a string", 400);
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new PlaylistError("invalid_input", "name cannot be empty", 400);
  }
  if (trimmed.length > 80) {
    throw new PlaylistError("invalid_input", "name is too long", 400);
  }
  return trimmed;
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const now = new Date().toISOString();
  const playlist: Playlist = {
    id: randomUUID(),
    name: normalizeName(name),
    createdAt: now,
    updatedAt: now,
    songs: [],
  };
  await writeFileAtomic(playlist);
  return playlist;
}

export async function deletePlaylist(id: string): Promise<void> {
  try {
    await fs.unlink(fileFor(id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PlaylistError("not_found", `Playlist ${id} not found`, 404);
    }
    throw err;
  }
}

export async function renamePlaylist(id: string, name: string): Promise<Playlist> {
  const playlist = await readFile(id);
  playlist.name = normalizeName(name);
  playlist.updatedAt = new Date().toISOString();
  await writeFileAtomic(playlist);
  return playlist;
}

export async function addSong(id: string, song: unknown): Promise<Playlist> {
  const parsed = songSchema.safeParse(song);
  if (!parsed.success) {
    throw new PlaylistError("invalid_input", "invalid song payload", 400);
  }
  const playlist = await readFile(id);
  if (!playlist.songs.some((s) => s.songId === parsed.data.songId)) {
    playlist.songs.push(parsed.data);
    playlist.updatedAt = new Date().toISOString();
    await writeFileAtomic(playlist);
  }
  return playlist;
}

export async function removeSong(id: string, songId: string): Promise<Playlist> {
  const playlist = await readFile(id);
  const next = playlist.songs.filter((s) => s.songId !== songId);
  if (next.length !== playlist.songs.length) {
    playlist.songs = next;
    playlist.updatedAt = new Date().toISOString();
    await writeFileAtomic(playlist);
  }
  return playlist;
}
