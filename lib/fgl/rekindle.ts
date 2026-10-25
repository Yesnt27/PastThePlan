import { PEOPLE_ORDER, TODAY } from "@/client/data/seed"
import type { LorePiece } from "@/client/data/types"
import { daysBetween } from "@/client/lib/dates"

/**
 * Rekindler: friendship upkeep from the lore itself. Results that name a person stay on the
 * server or go to that person's own agent; the group only ever sees counts.
 */
export function drifters(lore: LorePiece[], people = PEOPLE_ORDER) {
  const past = lore.filter((p) => p.date <= TODAY).sort((a, b) => b.date.localeCompare(a.date))
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
