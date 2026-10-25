import { NextResponse } from "next/server"
import { fmtShort } from "@/client/lib/dates"
import { SEED_PEOPLE } from "@/client/data/seed"
import { loadLore } from "@/lib/fgl/book"
import { onThisDay } from "@/lib/fgl/rekindle"
import { sql } from "@/lib/server/db"
import { GROUP_ID } from "@/lib/server/identity"

export const dynamic = "force-dynamic"

/** Daily: post “one year ago today” to the enabled channel, once per day. Group-safe by design. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  const ok = (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.FGL_ADMIN_SECRET && req.headers.get("x-admin-secret") === process.env.FGL_ADMIN_SECRET)
  if (!ok) return new NextResponse("unauthorized", { status: 401 })
  const channel = process.env.FGL_DISCORD_CHANNEL
  const pieces = onThisDay(await loadLore(GROUP_ID))
  if (!channel || !pieces.length) return NextResponse.json({ posted: 0 })
  const today = new Date().toISOString().slice(0, 10)
  const key = `rekindle:onthisday:${today}`
  const seen = await sql()`select 1 from fgl_kv where key = ${key}`
  if (seen.length) return NextResponse.json({ posted: 0, note: "already posted today" })
  await sql()`insert into fgl_kv (key, value) values (${key}, ${sql().json({ at: Date.now() } as never)}) on conflict do nothing`
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(req.url).origin
  const p = pieces[0]
  const q = p.quotes[0]
  const body = {
    embeds: [{
      title: `📖 One year ago today: ${p.title}`,
      description: [`${fmtShort(p.date)} · ${p.place}`, p.story, q ? `> “${q.text}” — ${SEED_PEOPLE[q.by]?.name ?? q.by}` : ""].filter(Boolean).join("\n"),
      url: `${base}/lore/${p.id}`,
      color: 0x2457c5,
      image: p.photos[0] ? { url: p.photos[0].startsWith("http") ? p.photos[0] : `${base}${p.photos[0]}` } : undefined,
      footer: { text: "FGL Rekindler · type /plan do it again" },
    }],
  }
  const r = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return NextResponse.json({ posted: r.ok ? 1 : 0, status: r.status })
}
