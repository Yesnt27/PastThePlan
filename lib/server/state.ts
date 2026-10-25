import type postgres from "postgres"
import {
  AREAS,
  GROUP,
  PEOPLE_ORDER,
  SEED_AGENT_THREAD,
  SEED_KEEPER_THREAD,
  SEED_LIMITS,
  SEED_LORE,
  SEED_PEOPLE,
  SEED_PROFILES,
} from "@/client/data/seed"
import type { ChatMessage, Limits } from "@/client/data/types"
import { sql } from "./db"
import { open, seal } from "./vault"

type Sql = ReturnType<typeof postgres>
type J = Parameters<Sql["json"]>[0]
const j = (db: Sql, v: unknown) => db.json(v as J)

export const AGENT_INTRO: ChatMessage[] = [
  {
    id: "a-intro",
    kind: "text",
    from: "agent",
    text: "I’m your private agent. Tell me your limits in plain words, like “budget $20, no alcohol, home by 11, max 30 min travel”. Lore Keeper only ever hears whether a plan fits.",
  },
]

export async function seedGroup(db: Sql, groupId: string, reset = false) {
  if (reset) await db`delete from fgl_groups where id = ${groupId}`
  const exists = await db`select 1 from fgl_groups where id = ${groupId}`
  if (exists.length) return false
  await db`insert into fgl_groups (id, name, invite_code) values (${groupId}, ${GROUP.name}, ${"WIZPIT"})`
  for (const [i, id] of PEOPLE_ORDER.entries()) {
    const p = SEED_PEOPLE[id]
    await db`insert into fgl_people (group_id, id, name, piece, profile, sort)
      values (${groupId}, ${id}, ${p.name}, ${p.piece}, ${j(db, SEED_PROFILES[id] ?? {})}, ${i})`
  }
  for (const a of Object.values(AREAS))
    await db`insert into fgl_areas (group_id, id, label, tint) values (${groupId}, ${a.id}, ${a.label}, ${a.tint})`
  const now = Date.now()
  for (const [i, piece] of SEED_LORE.entries())
    await db`insert into fgl_lore (group_id, id, data, created_at)
      values (${groupId}, ${piece.id}, ${j(db, piece)}, ${new Date(now - (i + 1) * 60_000)})`
  for (const m of SEED_AGENT_THREAD)
    await db`insert into fgl_messages (group_id, thread, data) values (${groupId}, ${"agent:john"}, ${j(db, m)})`
  await putLimits(db, groupId, "john", SEED_LIMITS)
  await bump(db, groupId, "seed")
  return true
}

async function bump(db: Sql, groupId: string, kind: string) {
  await db`insert into fgl_events (group_id, kind) values (${groupId}, ${kind})`
}

export async function putLimits(db: Sql, groupId: string, person: string, limits: Limits) {
  const s = seal(limits, `${groupId}:${person}:limits`)
  await db`insert into fgl_vault (group_id, person, field, ciphertext, iv, tag)
    values (${groupId}, ${person}, ${"limits"}, ${s.ciphertext}, ${s.iv}, ${s.tag})
    on conflict (group_id, person, field) do update
    set ciphertext = excluded.ciphertext, iv = excluded.iv, tag = excluded.tag, updated_at = now()`
}

export async function getLimits(db: Sql, groupId: string, person: string): Promise<Limits | null> {
  const rows = await db`select ciphertext, iv, tag from fgl_vault
    where group_id = ${groupId} and person = ${person} and field = 'limits'`
  if (!rows.length) return null
  return open<Limits>(rows[0] as never, `${groupId}:${person}:limits`)
}

export async function version(groupId: string) {
  const db = sql()
  const r = await db`select coalesce(max(id), 0)::int as v from fgl_events where group_id = ${groupId}`
  return r[0].v as number
}

export async function loadState(groupId: string, me: string) {
  const db = sql()
  const [v, people, areas, lore, plans, keeper, agent, limits] = await Promise.all([
    version(groupId),
    db`select id, name, piece, profile from fgl_people where group_id = ${groupId} order by sort`,
    db`select id, label, tint from fgl_areas where group_id = ${groupId}`,
    db`select data from fgl_lore where group_id = ${groupId} order by created_at desc`,
    db`select data from fgl_plans where group_id = ${groupId} order by created_at`,
    db`select data from fgl_messages where group_id = ${groupId} and thread = ${"keeper:" + me} order by id`,
    db`select data from fgl_messages where group_id = ${groupId} and thread = ${"agent:" + me} order by id`,
    getLimits(db, groupId, me),
  ])
  return {
    version: v,
    me,
    people: Object.fromEntries(people.map((p) => [p.id, { id: p.id, name: p.name, piece: p.piece }])),
    profiles: Object.fromEntries(people.map((p) => [p.id, p.profile])),
    areas: Object.fromEntries(areas.map((a) => [a.id, a])),
    lore: lore.map((r) => r.data),
    plans: plans.map((r) => r.data),
    keeper: keeper.length ? keeper.map((r) => r.data) : SEED_KEEPER_THREAD,
    agent: agent.length ? agent.map((r) => r.data) : me === "john" ? SEED_AGENT_THREAD : AGENT_INTRO,
    limits: limits ?? { calendar: "not connected" },
  }
}

// Actions mirror the client reducer for the shared slices.
type Action = { type: string; [k: string]: unknown }

export async function applyActions(groupId: string, me: string, actions: Action[]) {
  const db = sql()
  let changed = 0
  for (const a of actions) {
    switch (a.type) {
      case "lore/add": {
        const piece = a.piece as { id: string }
        await db`insert into fgl_lore (group_id, id, data) values (${groupId}, ${piece.id}, ${j(db, piece)})
          on conflict do nothing`
        break
      }
      case "lore/patch": {
        const patch = { ...(a.patch as object) } as Record<string, unknown>
        delete patch.quotes
        await db`update fgl_lore set data = (data || ${j(db, patch)})
            || jsonb_build_object('quotes', coalesce(data->'quotes', '[]'::jsonb) || ${j(db, a.addQuotes ?? [])})
          where group_id = ${groupId} and id = ${a.id as string}`
        break
      }
      case "plan/add": {
        const plan = a.plan as { id: string }
        await db`insert into fgl_plans (group_id, id, data) values (${groupId}, ${plan.id}, ${j(db, plan)})
          on conflict do nothing`
        break
      }
      case "plan/patch":
        await db`update fgl_plans set data = data || ${j(db, a.patch)}, updated_at = now()
          where group_id = ${groupId} and id = ${a.id as string}`
        break
      case "plan/vote":
        await db`update fgl_plans
          set data = jsonb_set(data, array['votes', ${a.person as string}], to_jsonb(${a.optionId as string}::text), true),
              updated_at = now()
          where group_id = ${groupId} and id = ${a.id as string}`
        break
      case "area/add": {
        const area = a.area as { id: string; label: string; tint: string }
        await db`insert into fgl_areas (group_id, id, label, tint) values (${groupId}, ${area.id}, ${area.label}, ${area.tint})
          on conflict (group_id, id) do update set label = excluded.label, tint = excluded.tint`
        break
      }
      case "profile/patch":
        await db`update fgl_people set profile = profile || ${j(db, a.patch)}
          where group_id = ${groupId} and id = ${a.id as string}`
        break
      case "person/piece":
        await db`update fgl_people set piece = ${a.piece as string} where group_id = ${groupId} and id = ${a.id as string}`
        break
      case "keeper/push":
      case "agent/push": {
        const thread = (a.type === "keeper/push" ? "keeper:" : "agent:") + me
        for (const m of a.messages as ChatMessage[])
          await db`insert into fgl_messages (group_id, thread, data) values (${groupId}, ${thread}, ${j(db, m)})
            on conflict do nothing`
        break
      }
      case "limits/set":
        await putLimits(db, groupId, me, a.limits as Limits)
        break
      default:
        continue
    }
    changed++
  }
  if (changed) await bump(db, groupId, actions.map((a) => a.type).join(","))
  return version(groupId)
}
