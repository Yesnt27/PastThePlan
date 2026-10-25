import { NextResponse } from "next/server"
import { hasDb } from "@/lib/server/db"
import { currentPerson, GROUP_ID } from "@/lib/server/identity"
import { loadState, version } from "@/lib/server/state"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!hasDb()) return new NextResponse(null, { status: 204 })
  const me = await currentPerson()
  const since = Number(new URL(req.url).searchParams.get("v") ?? -1)
  try {
    if (since >= 0 && (await version(GROUP_ID)) === since) return new NextResponse(null, { status: 204 })
    return NextResponse.json(await loadState(GROUP_ID, me), { headers: { "cache-control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
