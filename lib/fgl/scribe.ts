import { generateText, Output } from "ai"
import { z } from "zod"
import { PEOPLE_ORDER, SEED_PEOPLE, TODAY } from "@/client/data/seed"
import { sql } from "@/lib/server/db"
import { applyActions } from "@/lib/server/state"

/**
 * Scribe reads channels the bot was added to, keeps only messages from members who opted in
 * (linked with /iam), and turns them into drafts. Quotes are copied by code and must be exact
 * substrings of the cited message. Nothing becomes lore until a person accepts it.
 */
const API = "https://discord.com/api/v10"
const FAST = process.env.FGL_MODEL_FAST || "openai/gpt-oss-120b"

const Extract = z.object({
  items: z.array(z.object({
    kind: z.enum(["lore_candidate", "preference", "plan_intent", "availability"]),
    title: z.string().describe("Short title, e.g. 'Mini golf at Urban Putt'"),
    date: z.string().optional().describe("YYYY-MM-DD if the messages say when it happened or will happen"),
    place: z.string().optional(),
    who: z.array(z.string()).optional().describe("First names of people who were there"),
    quotes: z.array(z.object({ text: z.string().describe("copied EXACTLY, character for character"), by: z.string() })).optional(),
    note: z.string().optional().describe("one short line for preferences, intents or availability"),
    messageIds: z.array(z.string()),
  })),
})

async function kvGet<T>(key: string): Promise<T | null> {
  const r = await sql()`select value from fgl_kv where key = ${key}`
  return (r[0]?.value as T) ?? null
}
async function kvSet(key: string, value: unknown) {
  await sql()`insert into fgl_kv (key, value) values (${key}, ${sql().json(value as never)})
    on conflict (key) do update set value = excluded.value, updated_at = now()`
}

export async function syncChannel(groupId: string, channelId: string, opts: { force?: boolean } = {}) {
  const db = sql()
  const last = await kvGet<{ at: number }>(`scribe:last:${channelId}`)
  if (!opts.force && last && Date.now() - last.at < 60_000) return { skipped: "ran less than a minute ago" }
  await kvSet(`scribe:last:${channelId}`, { at: Date.now() })

  const bot = process.env.DISCORD_BOT_TOKEN
  if (!bot) return { error: "no bot token" }
  const cursor = (await kvGet<{ id: string }>(`scribe:cursor:${channelId}`))?.id
  const r = await fetch(`${API}/channels/${channelId}/messages?limit=100${cursor ? `&after=${cursor}` : ""}`, { headers: { Authorization: `Bot ${bot}` } })
  if (!r.ok) return { error: `discord ${r.status}` }
  const msgs = ((await r.json()) as { id: string; content: string; timestamp: string; author: { id: string; bot?: boolean } }[]).reverse()
  if (!msgs.length) return { read: 0, kept: 0, drafts: 0 }
  await kvSet(`scribe:cursor:${channelId}`, { id: msgs[msgs.length - 1].id })

  // Consent first: only members who linked their Discord account. Everyone else is dropped unread.
  const linked = await db`select id, discord_id from fgl_people where group_id = ${groupId} and discord_id is not null`
  const byDiscord = Object.fromEntries(linked.map((p) => [p.discord_id as string, p.id as string]))
  const kept = msgs
    .filter((m) => !m.author.bot && byDiscord[m.author.id] && m.content?.trim())
    .map((m) => ({ id: m.id, person: byDiscord[m.author.id], ts: m.timestamp, text: m.content.replace(/\bhttps?:\/\/\S*(?:token|key|secret|ical|webcal)\S*/gi, "[link removed]") }))
  for (const m of kept)
    await db`insert into fgl_chat (id, group_id, channel, person, ts, text) values (${m.id}, ${groupId}, ${channelId}, ${m.person}, ${m.ts}, ${m.text}) on conflict do nothing`
  if (!kept.length) return { read: msgs.length, kept: 0, drafts: 0, note: "No messages from members who linked with /iam." }

  const transcript = kept.map((m) => `[${m.id}] ${SEED_PEOPLE[m.person]?.name ?? m.person} (${m.ts.slice(0, 10)}): ${m.text}`).join("\n")
  const { output } = await generateText({
    model: FAST,
    output: Output.object({ schema: Extract }),
    system: `You are Scribe for a friend group's lore book. Today is ${TODAY}. From the chat, extract: lore_candidate (something the group did together, with exact quotes worth keeping), preference (what someone likes or wants to try), plan_intent (someone wants to plan something), availability (someone says when they're free or busy, as said, no inference). Copy quotes exactly. Never infer private constraints like money, drinking, health or curfews; skip those entirely. Cite message ids.`,
    prompt: transcript.slice(0, 12000),
  })

  const textById = Object.fromEntries(kept.map((m) => [m.id, m.text]))
  let drafts = 0
  for (const it of output?.items ?? []) {
    const cites = it.messageIds.filter((id) => textById[id])
    if (!cites.length) continue
    const source = cites.map((id) => textById[id]).join("\n")
    // Validate in code: keep a quote only if it appears word for word in a cited message.
    const quotes = (it.quotes ?? []).filter((q) => q.text.trim().length > 2 && source.includes(q.text.trim()))
    if (it.kind === "lore_candidate" && !it.title) continue
    const payload = { ...it, quotes, date: it.date && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : undefined }
    const id = `draft-${cites[0]}-${it.kind}-${drafts}`
    await db`insert into fgl_drafts (id, group_id, kind, payload, cites) values (${id}, ${groupId}, ${it.kind}, ${db.json(payload as never)}, ${cites})
      on conflict do nothing`
    drafts++
  }
  await db`insert into fgl_events (group_id, kind) values (${groupId}, ${"scribe"})`
  return { read: msgs.length, kept: kept.length, drafts }
}

export async function listDrafts(groupId: string) {
  const r = await sql()`select id, kind, payload, cites, created_at from fgl_drafts where group_id = ${groupId} and status = 'new' order by created_at desc limit 20`
  return r.map((d) => ({ id: d.id as string, kind: d.kind as string, ...(d.payload as object) }))
}

const slug = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "lore"

export async function acceptDraft(groupId: string, id: string, me: string) {
  const db = sql()
  const r = await db`select kind, payload from fgl_drafts where group_id = ${groupId} and id = ${id} and status = 'new'`
  if (!r.length) return null
  const p = r[0].payload as { title: string; date?: string; place?: string; who?: string[]; quotes?: { text: string; by: string }[]; note?: string }
  await db`update fgl_drafts set status = 'accepted' where id = ${id}`
  if (r[0].kind !== "lore_candidate") return { accepted: true }
  const who = (p.who ?? []).map((n) => n.toLowerCase()).filter((n) => PEOPLE_ORDER.includes(n))
  const piece = {
    id: `${slug(p.title)}-${Date.now().toString(36)}`,
    title: p.title,
    area: /golf|bowl|game|arcade|escape/i.test(p.title) ? "games" : /karaoke|sing/i.test(p.title) ? "karaoke" : /hike|beach|park|picnic|bonfire/i.test(p.title) ? "outdoors" : /dinner|brunch|food|dim sum|cafe/i.test(p.title) ? "food" : "active",
    date: p.date ?? TODAY,
    place: p.place ?? "",
    addedBy: me,
    who,
    story: p.note,
    quotes: (p.quotes ?? []).map((q, i) => ({ id: `q-${Date.now().toString(36)}-${i}`, text: q.text, by: q.by.toLowerCase() })),
    photos: [],
  }
  await applyActions(groupId, me, [{ type: "lore/add", piece }])
  return { accepted: true, loreId: piece.id }
}
