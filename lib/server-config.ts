import { readSettings } from "@/lib/settings-store";

export const DEFAULT_KTV_BASE_URL = "http://192.168.50.150:8080";

/**
 * Server-only resolver for the KTV servlet host. Precedence:
 *   1. `${DATA_DIR}/settings.json` — the in-app settings sheet writes here.
 *   2. `KTV_BASE_URL` env var — kept for Docker / CI overrides.
 *   3. Hardcoded default for the developer's own LAN.
 *
 * Read on every request rather than at module load so the override takes
 * effect immediately after the user saves new settings — no restart needed.
 * The file is tiny and the read is fast; not worth caching.
 *
 * Lives in its own file (separate from [lib/config.ts](lib/config.ts)) so
 * client modules that need only `LANGUAGES` / `langToSingerType` don't pull
 * `fs` and `path` into the browser bundle.
 */
export async function getKtvBaseUrl(): Promise<string> {
  const settings = await readSettings();
  return settings.ktvBaseUrl ?? process.env.KTV_BASE_URL ?? DEFAULT_KTV_BASE_URL;
}

/**
 * Server-only baseline (env var ?? hardcoded default), shown in the settings
 * UI as the value that takes effect when no override is set.
 */
export function getKtvBaseUrlBaseline(): string {
  return process.env.KTV_BASE_URL ?? DEFAULT_KTV_BASE_URL;
}

export function imageBaseFor(ktvBaseUrl: string): string {
  return `${ktvBaseUrl}/singer`;
}
