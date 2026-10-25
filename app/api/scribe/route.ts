import { NextResponse } from "next/server"
import { acceptDraft, listDrafts, syncChannel } from "@/lib/fgl/scribe"
import { hasDb } from "@/lib/server/db"
import { currentPerson, GROUP_ID } from "@/lib/server/identity"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** GET: open drafts. POST {sync:true} runs Scribe on the enabled channel; POST {accept:id} turns a draft into lore. */
export async function GET() {
  if (!hasDb()) return NextResponse.json({ drafts: [] })
  return NextResponse.json({ drafts: await listDrafts(GROUP_ID) })
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sync?: boolean; force?: boolean; accept?: string; dismiss?: string }
  const me = await currentPerson()
  if (body.dismiss) {
    const { sql } = await import("@/lib/server/db")
    await sql()`update fgl_drafts set status = 'dismissed' where group_id = ${GROUP_ID} and id = ${body.dismiss}`
    return NextResponse.json({ dismissed: true })
  }
  if (body.accept) return NextResponse.json((await acceptDraft(GROUP_ID, body.accept, me)) ?? { error: "not found" })
  const channel = process.env.FGL_DISCORD_CHANNEL
  if (!channel) return NextResponse.json({ error: "no channel enabled" })
  const admin = !!process.env.FGL_ADMIN_SECRET && req.headers.get("x-admin-secret") === process.env.FGL_ADMIN_SECRET
  try {
    return NextResponse.json({ ...(await syncChannel(GROUP_ID, channel, { force: admin && body.force })), drafts: await listDrafts(GROUP_ID) })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 })
  }
}
