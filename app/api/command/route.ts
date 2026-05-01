import { NextResponse } from "next/server";
import { z } from "zod";
import { sendCommand } from "@/lib/ktv-client";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("cmd", [
  z.object({
    cmd: z.enum(["Add1", "Pro1", "Del1"]),
    cmdValue: z.string().min(1),
  }),
  z.object({
    cmd: z.enum([
      "Play",
      "Skip",
      "Reset",
      "MuOr",
      "Mute",
      "Music_up",
      "Music_down",
      "Mic_up",
      "Mic_down",
    ]),
  }),
]);

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid_body", message: String(err) }, { status: 400 });
  }
  try {
    await sendCommand(body.cmd, "cmdValue" in body ? body.cmdValue : undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "ktv_command_failed", message }, { status: 502 });
  }
}
