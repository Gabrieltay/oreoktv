import { NextResponse } from "next/server";
import { searchSongs } from "@/lib/ktv-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageParam = searchParams.get("page");
  const page = pageParam ? Number(pageParam) : 0;

  try {
    const data = await searchSongs({
      songName: searchParams.get("songName") ?? undefined,
      songType: searchParams.get("songType") ?? undefined,
      singer: searchParams.get("singer") ?? undefined,
      lang: searchParams.get("lang") ?? undefined,
      sortType: searchParams.get("sortType") ?? undefined,
      page: Number.isFinite(page) ? page : 0,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "ktv_fetch_failed", message }, { status: 502 });
  }
}
