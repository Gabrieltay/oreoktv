import { NextResponse, type NextRequest } from "next/server";
import { PlaylistError, addSong, removeSong } from "@/lib/playlist-store";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json().catch(() => null);
    const data = await addSong(params.id, body);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const songId = req.nextUrl.searchParams.get("songId");
    if (!songId) {
      return NextResponse.json(
        { error: "invalid_input", message: "songId is required" },
        { status: 400 },
      );
    }
    const data = await removeSong(params.id, songId);
    return NextResponse.json(data, {
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
