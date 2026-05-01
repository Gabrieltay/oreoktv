import { NextResponse, type NextRequest } from "next/server";
import { PlaylistError, deletePlaylist, getPlaylist, renamePlaylist } from "@/lib/playlist-store";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const data = await getPlaylist(params.id);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown };
    const data = await renamePlaylist(params.id, String(body.name ?? ""));
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await deletePlaylist(params.id);
    return new NextResponse(null, { status: 204 });
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
