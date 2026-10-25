import { PEOPLE_ORDER, TODAY } from "@/client/data/seed"
import type { LorePiece, PersonId } from "@/client/data/types"
import { daysBetween } from "@/client/lib/dates"

/**
 * Rekindler: friendship upkeep from the lore itself. Results that name a person stay on the
 * server or go to that person's own agent; the group only ever sees counts.
 */
/** A hangout counts for drift when at least three of the group were there. */
const groupHangouts = (lore: LorePiece[]) => lore.filter((p) => p.date <= TODAY && p.who.length >= 3)

export function drifters(lore: LorePiece[], people = PEOPLE_ORDER) {
  const past = groupHangouts(lore).sort((a, b) => b.date.localeCompare(a.date))
  const last4 = past.slice(0, 4)
  return people
    .map((person) => {
      const missed = last4.filter((p) => !p.who.includes(person)).length
      const lastWith = past.find((p) => p.who.includes(person))
      const daysSince = lastWith ? daysBetween(lastWith.date, TODAY) : 999
      return { person, missed, of: last4.length, daysSince }
    })
    .filter((d) => d.of >= 4 && (d.missed >= 3 || d.daysSince >= 30))
}

export function onThisDay(lore: LorePiece[]) {
  const md = TODAY.slice(5)
  return lore.filter((p) => p.date.slice(5) === md && p.date < TODAY)
}

/** The same area three times in 60 days earns other areas a novelty bonus. */
export function repeatedAreas(lore: LorePiece[]) {
  const recent = lore.filter((p) => p.date <= TODAY && daysBetween(p.date, TODAY) <= 60)
  const counts: Record<string, number> = {}
  for (const p of recent) counts[p.area] = (counts[p.area] ?? 0) + 1
  return Object.entries(counts).filter(([, n]) => n >= 3).map(([a]) => a)
}

export type Reconnect = {
  friend: PersonId
  days: number
  together: number
  last: LorePiece
  memory: LorePiece
  why: "anniversary" | "quote" | "last"
  topArea?: { area: string; count: number }
  sharedHobbies: string[]
}

/**
 * A private nudge for one person: the friend they have gone longest without seeing (21+ days),
 * built only from moments the two of them already share in the lore. Never from limits or chat.
 */
export function reconnectFor(
  lore: LorePiece[],
  me: PersonId,
  hobbies: Partial<Record<PersonId, string[]>> = {},
  people = PEOPLE_ORDER,
): Reconnect | null {
  const past = lore
    .filter((p) => p.date <= TODAY && p.who.length >= 2)
    .sort((a, b) => b.date.localeCompare(a.date))
  const md = TODAY.slice(5)
  const pick = people
    .filter((f) => f !== me)
    .map((friend) => {
      const shared = past.filter((p) => p.who.includes(me) && p.who.includes(friend))
      const last = shared[0]
      return { friend, shared, last, days: last ? daysBetween(last.date, TODAY) : -1 }
    })
    .filter((o) => o.last && o.days >= 21)
    .sort((a, b) => b.days - a.days || b.shared.length - a.shared.length)[0]
  if (!pick) return null
  const anniversary = pick.shared.find((p) => p.date.slice(5) === md && p.date < TODAY)
  const quoted = pick.shared.find((p) => p.quotes.some((q) => q.by === pick.friend)) ?? pick.shared.find((p) => p.quotes.length)
  const memory = anniversary ?? quoted ?? pick.last
  const counts = new Map<string, number>()
  for (const p of pick.shared) counts.set(p.area, (counts.get(p.area) ?? 0) + 1)
  const [area, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  const mine = (hobbies[me] ?? []).map((h) => h.toLowerCase())
  return {
    friend: pick.friend,
    days: pick.days,
    together: pick.shared.length,
    last: pick.last,
    memory,
    why: anniversary ? "anniversary" : memory === quoted ? "quote" : "last",
    topArea: area && count && count >= 2 ? { area, count } : undefined,
    sharedHobbies: (hobbies[pick.friend] ?? []).filter((h) => mine.includes(h.toLowerCase())),
  }
}
