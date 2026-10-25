import { NextResponse } from "next/server"
import { directSql } from "@/lib/server/db"
import { GROUP_ID } from "@/lib/server/identity"
import { SCHEMA } from "@/lib/server/schema"
import { seedGroup } from "@/lib/server/state"

export const dynamic = "force-dynamic"

/** Creates tables, the photo bucket and the demo group. POST with x-admin-secret; ?reset=1 reseeds. */
export async function POST(req: Request) {
  if (!process.env.FGL_ADMIN_SECRET || req.headers.get("x-admin-secret") !== process.env.FGL_ADMIN_SECRET)
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const reset = new URL(req.url).searchParams.get("reset") === "1"
  const db = directSql()
  const out: Record<string, unknown> = {}
  try {
    await db.unsafe(SCHEMA)
    out.schema = "ok"
    out.seeded = await seedGroup(db, GROUP_ID, reset)
  } catch (e) {
    out.error = String(e)
  } finally {
    await db.end()
  }
  out.bucket = await ensureBucket()
  return NextResponse.json(out)
}

async function ensureBucket() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return "no storage credentials"
  const r = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ id: "lore-photos", name: "lore-photos", public: true, file_size_limit: 10485760 }),
  })
  return r.ok ? "created" : `${r.status} ${(await r.text()).slice(0, 120)}`
}
