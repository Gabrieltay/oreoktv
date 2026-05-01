import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getKtvBaseUrl, getKtvBaseUrlBaseline, imageBaseFor } from "@/lib/server-config";
import { pingKtv } from "@/lib/ktv-client";
import { readSettings, writeSettings } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  ktvBaseUrl: z.string().trim().url().nullable(),
});

export async function GET() {
  try {
    const [settings, ktvBaseUrl] = await Promise.all([readSettings(), getKtvBaseUrl()]);
    return NextResponse.json(
      {
        ktvBaseUrl,
        imageBase: imageBaseFor(ktvBaseUrl),
        baseline: getKtvBaseUrlBaseline(),
        override: settings.ktvBaseUrl ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "config_read_failed", message }, { status: 500 });
  }
}

/**
 * Save a new KTV base URL. Pass `null` to clear the override and fall back
 * to the env var / hardcoded default. Before persisting, we hit the new
 * host's /PlaylistServlet — if that fails the override is rejected so the
 * user can't accidentally point the app at an unreachable IP.
 */
export async function PUT(req: NextRequest) {
  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid_body", message: String(err) }, { status: 400 });
  }

  const next = body.ktvBaseUrl?.replace(/\/+$/, "") || null;

  if (next) {
    try {
      await pingKtv(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return NextResponse.json(
        { error: "ktv_unreachable", message: `Couldn't reach KTV at ${next}: ${message}` },
        { status: 502 },
      );
    }
  }

  try {
    const settings = await writeSettings({ ktvBaseUrl: next ?? undefined });
    const effective = settings.ktvBaseUrl ?? getKtvBaseUrlBaseline();
    return NextResponse.json({
      ktvBaseUrl: effective,
      imageBase: imageBaseFor(effective),
      baseline: getKtvBaseUrlBaseline(),
      override: settings.ktvBaseUrl ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "config_write_failed", message }, { status: 500 });
  }
}
