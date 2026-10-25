import { NextResponse } from "next/server"
import { hasDb } from "@/lib/server/db"
import { currentPerson, GROUP_ID } from "@/lib/server/identity"
import { applyActions } from "@/lib/server/state"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ ok: false, reason: "no database" })
  const me = await currentPerson()
  const body = (await req.json()) as { actions?: { type: string }[] }
  try {
    const v = await applyActions(GROUP_ID, me, (body.actions ?? []).slice(0, 50))
    return NextResponse.json({ ok: true, version: v })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
