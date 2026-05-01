import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

/**
 * Server-only persistence for runtime-overridable settings. Lives in
 * `${DATA_DIR}/settings.json` so the same DATA_DIR mount that holds
 * playlists/history also carries the KTV IP override.
 *
 * Currently a single field: `ktvBaseUrl`. The resolver in [lib/config.ts](lib/config.ts)
 * prefers this over the env var so the in-app settings sheet wins.
 */

const DATA_DIR = process.env.DATA_DIR ?? "./data";
const SETTINGS_FILE = path.resolve(DATA_DIR, "settings.json");

const settingsSchema = z.object({
  ktvBaseUrl: z.string().url().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
}

export async function readSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    console.warn("[settings-store] readSettings failed:", err);
    return {};
  }
}

export async function writeSettings(next: Settings): Promise<Settings> {
  const validated = settingsSchema.parse(next);
  await ensureDir();
  const tmp = `${SETTINGS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(validated, null, 2), "utf8");
  await fs.rename(tmp, SETTINGS_FILE);
  return validated;
}
