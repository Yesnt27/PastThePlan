import { PEOPLE_ORDER } from "../data/seed"
import type { Area, LorePiece, PersonId, Plan } from "../data/types"
import { seasonOf } from "../lib/dates"

export const newestFirst = (a: LorePiece, b: LorePiece) =>
  b.date.localeCompare(a.date)

export const loreWith = (lore: LorePiece[], id: PersonId) =>
  lore.filter((p) => p.who.includes(id)).sort(newestFirst)

const STAT_PREFERENCE = ["outdoors", "karaoke", "games", "food"]
const STAT_NOUN: Record<string, [string, string]> = {
  outdoors: ["outdoors", "outdoors"],
  karaoke: ["karaoke", "karaoke"],
  games: ["game night", "game nights"],
  food: ["food run", "food runs"],
}

/** "10 hangouts · 3 outdoors", counted from the lore the person is actually in. */
export function profileStats(
  lore: LorePiece[],
  id: PersonId,
  areas: Record<string, Area>,
) {
  const mine = loreWith(lore, id)
  const byArea = new Map<string, number>()
  for (const p of mine) byArea.set(p.area, (byArea.get(p.area) ?? 0) + 1)
  const rank = (a: string) =>
    STAT_PREFERENCE.includes(a) ? STAT_PREFERENCE.indexOf(a) : 99
  const [topArea, topCount] =
    [...byArea.entries()].sort(
      (a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]),
    )[0] ?? []
  const hangouts = `${mine.length} hangout${mine.length === 1 ? "" : "s"}`
  if (!topArea || !topCount) return { line: hangouts, count: mine.length }
  const noun = STAT_NOUN[topArea] ?? [
    areas[topArea]?.label.toLowerCase() ?? topArea,
    areas[topArea]?.label.toLowerCase() ?? topArea,
  ]
  return {
    line: `${hangouts} · ${topCount} ${topCount === 1 ? noun[0] : noun[1]}`,
    count: mine.length,
  }
}

/** Friends this person shows up with most often in the lore. */
export function connections(lore: LorePiece[], id: PersonId, limit = 3) {
  const counts = new Map<PersonId, number>()
  for (const p of lore) {
    if (!p.who.includes(id)) continue
    for (const other of p.who)
      if (other !== id) counts.set(other, (counts.get(other) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] || PEOPLE_ORDER.indexOf(a[0]) - PEOPLE_ORDER.indexOf(b[0]),
    )
    .slice(0, limit)
    .map(([person, together]) => ({ person, together }))
}

export type Lens = "activity" | "season" | "people"
export type Cluster = {
  key: string
  label: string
  tint?: string
  pieces: LorePiece[]
  areaId?: string
  person?: PersonId
}

/** Groups the board by area, by season (newest first) or by person. */
export function clusters(
  lore: LorePiece[],
  lens: Lens,
  areas: Record<string, Area>,
): Cluster[] {
  if (lens === "season") {
    const map = new Map<string, Cluster>()
    for (const p of [...lore].sort(newestFirst)) {
      const s = seasonOf(p.date)
      if (!map.has(s.key))
        map.set(s.key, { key: s.key, label: s.label, pieces: [] })
      map.get(s.key)!.pieces.push(p)
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
  }
  if (lens === "people") {
    return PEOPLE_ORDER.map((person) => ({
      key: person,
      label: person,
      person,
      pieces: loreWith(lore, person),
    }))
  }
  const base = ["karaoke", "outdoors", "games", "food"]
  const ids = [
    ...base,
    ...Object.keys(areas).filter(
      (a) => !base.includes(a) && lore.some((p) => p.area === a),
    ),
  ]
  return ids.map((areaId) => ({
    key: areaId,
    areaId,
    label: areas[areaId]?.label ?? areaId,
    tint: areas[areaId]?.tint,
    pieces: lore
      .filter((p) => p.area === areaId)
      .sort((a, b) => a.date.localeCompare(b.date)),
  }))
}

export const upcoming = (plans: Plan[]) =>
  plans.filter(
    (p) =>
      p.status === "locked" ||
      p.status === "review" ||
      p.status === "voting" ||
      p.status === "checking",
  )
