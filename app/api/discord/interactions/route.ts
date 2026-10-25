import { after, NextResponse } from "next/server"
import { parseLimits, summarizeLimits } from "@/client/agent/memberAgent"
import type { Limits, Plan } from "@/client/data/types"
import { editOriginal } from "@/lib/discord/api"
import { voteCard } from "@/lib/discord/cards"
import { verifyDiscord } from "@/lib/discord/verify"
import { askLore, planOptions } from "@/lib/fgl/book"
import { runKeeper } from "@/lib/fgl/keeper"
import { leaks } from "@/lib/fgl/leak"
import { sql } from "@/lib/server/db"
import { GROUP_ID } from "@/lib/server/identity"
import { applyActions, getLimits, putLimits } from "@/lib/server/state"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const EPHEMERAL = 64
type Interaction = {
  type: number
  token: string
  data?: { name?: string; custom_id?: string; options?: { name: string; value: string }[]; components?: { components: { custom_id: string; value: string }[] }[] }
  member?: { user: { id: string; global_name?: string; username: string } }
  user?: { id: string; global_name?: string; username: string }
}

const reply = (content: string, ephemeral = false) =>
  NextResponse.json({ type: 4, data: { content, flags: ephemeral ? EPHEMERAL : 0, allowed_mentions: { parse: [] } } })

async function personFor(discordId: string) {
  const r = await sql()`select id from fgl_people where group_id = ${GROUP_ID} and discord_id = ${discordId}`
  return (r[0]?.id as string | undefined) ?? null
}

async function activePlan(): Promise<Plan | null> {
  const r = await sql()`select data from fgl_plans where group_id = ${GROUP_ID}
    and data->>'status' in ('checking','voting','review','locked') order by created_at desc limit 1`
  return (r[0]?.data as Plan) ?? null
}

async function planById(id: string): Promise<Plan | null> {
  const r = await sql()`select data from fgl_plans where group_id = ${GROUP_ID} and id = ${id}`
  return (r[0]?.data as Plan) ?? null
}

export async function POST(req: Request) {
  const body = await req.text()
  if (!verifyDiscord(body, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp")))
    return new NextResponse("bad signature", { status: 401 })
  const i = JSON.parse(body) as Interaction
  if (i.type === 1) return NextResponse.json({ type: 1 })
  const user = i.member?.user ?? i.user
  const discordId = user?.id ?? ""
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(req.url).origin

  // Slash commands
  if (i.type === 2) {
    const name = i.data?.name
    const opt = (k: string) => i.data?.options?.find((o) => o.name === k)?.value

    if (name === "iam") {
      const who = opt("member")!
      await sql()`update fgl_people set discord_id = null where group_id = ${GROUP_ID} and discord_id = ${discordId}`
      await sql()`update fgl_people set discord_id = ${discordId} where group_id = ${GROUP_ID} and id = ${who}`
      return reply(`Linked. Your votes here count as ${who[0].toUpperCase() + who.slice(1)} in the book.`, true)
    }

    if (name === "limits") {
      return NextResponse.json({
        type: 9,
        data: {
          custom_id: "limits",
          title: "Your private agent",
          components: [{ type: 1, components: [{ type: 4, custom_id: "text", style: 2, label: "Limits, in plain words (only your agent sees this)", placeholder: "budget $25, no alcohol, home by 11, max 30 min travel", required: true, max_length: 400 }] }],
        },
      })
    }

    if (name === "ask") {
      const q = opt("question") ?? ""
      after(async () => {
        try {
          const r = await runKeeper({ text: q, me: (await personFor(discordId)) ?? "guest", base })
          const a = r.answer ?? (await askLore(GROUP_ID, q))
          const quotes = (a.quotes ?? []).map((x) => `> “${x.text}”\n> — ${x.by[0].toUpperCase() + x.by.slice(1)}, word for word`).join("\n")
          const text = r.answer ? a.text : r.text || a.text
          await editOriginal(i.token, { content: `**${q}**\n${leaks(text) ? a.text : text}${quotes ? "\n" + quotes : ""}`.slice(0, 1900), allowed_mentions: { parse: [] } })
        } catch {
          await editOriginal(i.token, { content: "Lore Keeper couldn’t answer just now." })
        }
      })
      return NextResponse.json({ type: 5 })
    }

    if (name === "plan") {
      const request = opt("request") || "something this weekend"
      const me = await personFor(discordId)
      after(async () => {
        try {
          const open = await activePlan()
          if (open && open.options.length) {
            await editOriginal(i.token, { content: "There’s already a plan going:", ...voteCard(open) })
            return
          }
          let intro = ""
          let options = (await planOptions(GROUP_ID, request)).options
          try {
            const r = await runKeeper({ text: request, me: me ?? "someone", base })
            if (r.draft?.options?.length) options = r.draft.options
            if (r.text && !leaks(r.text)) intro = r.text
          } catch { /* deterministic draft already in hand */ }
          const plan: Plan = { id: `plan-${Date.now().toString(36)}`, request, status: "voting", options, votes: {}, majorityAnnounced: false, coming: [] }
          await applyActions(GROUP_ID, me ?? "john", [{ type: "plan/add", plan }])
          await editOriginal(i.token, { content: me ? "" : "Tip: run /iam so your vote counts as you.", ...voteCard(plan, intro) })
        } catch (e) {
          await editOriginal(i.token, { content: `Lore Keeper hit a snag: ${String(e).slice(0, 150)}` })
        }
      })
      return NextResponse.json({ type: 5 })
    }
    return reply("Unknown command.", true)
  }

  // Buttons
  if (i.type === 3 && i.data?.custom_id?.startsWith("vote:")) {
    const [, planId, optionId] = i.data.custom_id.split(":")
    const me = await personFor(discordId)
    if (!me) return reply("Run /iam first so your vote counts as you in the book.", true)
    const plan = await planById(planId)
    if (!plan || plan.status !== "voting") return reply("Voting on this plan is closed.", true)
    await applyActions(GROUP_ID, me, [{ type: "plan/vote", id: planId, person: me, optionId: optionId === "none" ? "" : optionId }])
    const updated = (await planById(planId))!
    return NextResponse.json({ type: 7, data: voteCard(updated) })
  }

  // Modal: /limits
  if (i.type === 5 && i.data?.custom_id === "limits") {
    const me = await personFor(discordId)
    if (!me) return reply("Run /iam first so I know whose agent you are talking to.", true)
    const text = i.data.components?.[0]?.components?.[0]?.value ?? ""
    const before = (await getLimits(sql(), GROUP_ID, me)) ?? {}
    const next = { ...before, ...parseLimits(text) } as Limits
    await putLimits(sql(), GROUP_ID, me, next)
    return reply(`Here’s what I’ll keep private: ${summarizeLimits(next)}. Lore Keeper only hears whether a plan fits.`, true)
  }

  return reply("Not sure what to do with that.", true)
}
