import { NextResponse } from "next/server"
import { GROUP_ID } from "@/lib/server/identity"

export const dynamic = "force-dynamic"

/** Uploads one lore photo to Supabase Storage and returns its public URL. */
export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "storage not configured" }, { status: 503 })
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File) || !file.type.startsWith("image/"))
    return NextResponse.json({ error: "image required" }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 })
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5)
  const path = `${GROUP_ID}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const r = await fetch(`${url}/storage/v1/object/lore-photos/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": file.type, "x-upsert": "false" },
    body: Buffer.from(await file.arrayBuffer()),
  })
  if (!r.ok) return NextResponse.json({ error: `upload failed ${r.status}` }, { status: 502 })
  return NextResponse.json({ url: `${url}/storage/v1/object/public/lore-photos/${path}` })
}
