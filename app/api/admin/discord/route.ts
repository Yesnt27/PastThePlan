import { NextResponse } from "next/server"
import type { Plan } from "@/client/data/types"
import { voteCard } from "@/lib/discord/cards"
import { planOptions } from "@/lib/fgl/book"
import { runKeeper } from "@/lib/fgl/keeper"
import { leaks } from "@/lib/fgl/leak"
import { sql } from "@/lib/server/db"
import { GROUP_ID } from "@/lib/server/identity"
import { applyActions } from "@/lib/server/state"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Admin: {link:{person,discordId}} links an account; {post:{request,as}} posts a plan card to the enabled channel. */
export async function POST(req: Request) {
  if (!process.env.FGL_ADMIN_SECRET || req.headers.get("x-admin-secret") !== process.env.FGL_ADMIN_SECRET)
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const body = (await req.json()) as { link?: { person: string; discordId: string }; post?: { request: string; as?: string } }
  if (body.link) {
    await sql()`update fgl_people set discord_id = null where group_id = ${GROUP_ID} and discord_id = ${body.link.discordId}`
    await sql()`update fgl_people set discord_id = ${body.link.discordId}, consent_chat = true where group_id = ${GROUP_ID} and id = ${body.link.person}`
    return NextResponse.json({ linked: true })
  }
  if (body.post) {
    const base = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(req.url).origin
    let draft = await planOptions(GROUP_ID, body.post.request)
    let intro = ""
    try {
      const r = await runKeeper({ text: body.post.request, me: body.post.as ?? "sam", base })
      if (r.draft?.options?.length) draft = r.draft
      if (r.text && !leaks(r.text)) intro = r.text
    } catch { /* keep the deterministic draft */ }
    const plan: Plan = { id: `plan-${Date.now().toString(36)}`, request: body.post.request, status: "voting", options: draft.options, votes: {}, majorityAnnounced: false, coming: [], meta: { ...draft.meta, requestedBy: body.post.as ?? "sam" } }
    await applyActions(GROUP_ID, body.post.as ?? "sam", [{ type: "plan/add", plan }])
    const r = await fetch(`https://discord.com/api/v10/channels/${process.env.FGL_DISCORD_CHANNEL}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(voteCard(plan, intro)),
    })
    return NextResponse.json({ posted: r.ok, status: r.status, planId: plan.id, meta: plan.meta, options: plan.options.map((o) => `${o.title} ${o.day}`) })
  }
  return NextResponse.json({ error: "nothing to do" })
}
