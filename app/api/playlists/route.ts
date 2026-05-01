import { NextResponse, type NextRequest } from "next/server";
import { PlaylistError, createPlaylist, listPlaylists } from "@/lib/playlist-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listPlaylists();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown };
    const playlist = await createPlaylist(String(body.name ?? ""));
    return NextResponse.json(playlist, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  if (err instanceof PlaylistError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "unknown error";
  return NextResponse.json({ error: "playlist_io_failed", message }, { status: 500 });
}
