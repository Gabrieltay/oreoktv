import { NextResponse } from "next/server";
import { getRecent } from "@/lib/history-store";
import type { Playlist } from "@/lib/playlist-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const songs = await getRecent();
    const now = new Date().toISOString();
    const data: Playlist = {
      id: "recent",
      name: "Recently played",
      createdAt: now,
      updatedAt: now,
      songs,
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "history_read_failed", message }, { status: 500 });
  }
}
