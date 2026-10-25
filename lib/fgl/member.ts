import type { Day, Limits, PlanOption } from "@/client/data/types"
import { PEOPLE_ORDER } from "@/client/data/seed"
import { sql } from "@/lib/server/db"
import { open } from "@/lib/server/vault"

/**
 * The privacy boundary. Limits and busy days are decrypted only in this module, and every
 * export returns aggregates: yes/no, counts and minutes. Nothing here returns a name with a reason.
 */

export const MIN_GROUP_FOR_COUNTS = 3
const PRICE_EST: Record<string, number> = { Free: 0, $: 15, $$: 25, $$$: 60 }

type Held = { person: string; limits: Limits; busy: Day[] }

export async function loadHeld(groupId: string): Promise<Held[]> {
  const rows = await sql()`select person, field, ciphertext, iv, tag from fgl_vault where group_id = ${groupId}`
  const by: Record<string, Held> = {}
  for (const id of PEOPLE_ORDER) by[id] = { person: id, limits: {}, busy: [] }
  for (const r of rows) {
    const h = by[r.person as string]
    if (!h) continue
    try {
      const v = open(r as never, `${groupId}:${r.person}:${r.field}`)
      if (r.field === "limits") h.limits = v as Limits
      if (r.field === "busy") h.busy = v as Day[]
    } catch {
      /* unreadable entry: treat as no limits */
    }
  }
  return Object.values(by)
}

const toMinutes = (t: string) => {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (!m) return null
  let h = Number(m[1]) % 12
  if (m[3].toLowerCase() === "pm") h += 12
  return h * 60 + Number(m[2])
}

export const isFree = (h: Held, day: Day) =>
  !h.busy.includes(day) && (!h.limits.days?.length || h.limits.days.includes(day))

/** Whether one person's private limits allow an option. Never exported to the group side. */
function fits(h: Held, o: PlanOption & { alcoholCentric?: boolean; durationMin?: number }) {
  const L = h.limits
  if (L.budget != null && (PRICE_EST[o.price] ?? 25) > L.budget) return false
  if (L.noAlcohol && o.alcoholCentric) return false
  if (L.travelMin != null && o.maxTravelMin > L.travelMin + 5) return false
  if (L.homeBy) {
    const end = toMinutes(o.time)
    let home = toMinutes(L.homeBy)
    if (end != null && home != null) {
      if (home < 6 * 60) home += 24 * 60 // after midnight
      if (end + (o.durationMin ?? 150) + Math.min(o.maxTravelMin, 45) > home) return false
    }
  }
  return true
}

export type FitResult = { optionId: string; free: number; fitsEveryone: boolean; fitCount: number | null }

/** Aggregate fit for each option among the people free that day. Counts are hidden under 3 people. */
export function checkOptions(held: Held[], options: PlanOption[]): FitResult[] {
  return options.map((o) => {
    const coming = held.filter((h) => isFree(h, o.day))
    const ok = coming.filter((h) => fits(h, o)).length
    return {
      optionId: o.id,
      free: coming.length,
      fitsEveryone: ok === coming.length,
      fitCount: coming.length >= MIN_GROUP_FOR_COUNTS ? ok : null,
    }
  })
}

export function availability(held: Held[], days: Day[]) {
  return Object.fromEntries(days.map((d) => [d, held.filter((h) => isFree(h, d)).length]))
}

/** Each affected person's own agent gets a private line; nothing goes to the group. */
export function privateNudges(held: Held[], option: PlanOption) {
  return held
    .filter((h) => isFree(h, option.day) && !fits(h, option))
    .map((h) => ({
      person: h.person,
      text: `The top pick (${option.title}) is a stretch for what you told me. Skip this one, stretch once, or should I find something closer to your limits? Nobody will know why.`,
    }))
}
