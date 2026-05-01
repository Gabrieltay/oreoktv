import { NextResponse } from "next/server";
import { getPlaylist } from "@/lib/ktv-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPlaylist();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "ktv_fetch_failed", message }, { status: 502 });
  }
}
