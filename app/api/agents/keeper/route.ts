import { NextResponse } from "next/server"
import { runKeeper } from "@/lib/fgl/keeper"
import { currentPerson } from "@/lib/server/identity"
import { leaks } from "@/lib/fgl/leak"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const { text, sourceLoreId } = (await req.json()) as { text?: string; sourceLoreId?: string }
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 })
  const me = await currentPerson()
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(req.url).origin
  try {
    const reply = await runKeeper({ text: text.slice(0, 500), sourceLoreId, me, base })
    // Every group-visible sentence passes the leak check before it leaves the server.
    if (leaks(reply.text)) reply.text = "Here’s what fits everyone this time. I checked calendars and everyone’s private limits; the details stay private."
    return NextResponse.json(reply)
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 502 })
  }
}
