import { AREAS, GROUP, VENUES, type Venue } from "../data/seed"
import type { Day, LorePiece, Plan, PlanOption, PersonId } from "../data/types"
import { dayName, fmtShort } from "../lib/dates"
import { nameOf, normalize } from "./text"

/**
 * Front-end stand-in for the Lore Keeper group agent on ASI:One.
 * In production the agent returns the carousel payload; card text and badges come straight
 * from it (shared/cards.py), and this module goes away.
 */

export const WEEKEND: Record<Day, string> = {
  Fri: "2026-10-30",
  Sat: "2026-10-31",
  Sun: "2026-11-01",
}

/** Members free on each day, from busy-time checks done privately by each member's agent. */
const FREE_ON: Record<Day, number> = { Fri: 3, Sat: 5, Sun: 4 }

export const MAJORITY = Math.ceil(GROUP.size / 2)

export const AREA_HINTS: [RegExp, string][] = [
  [/\b(food|eat|dinner|lunch|brunch|hungry)\b/, "food"],
  [/\b(outside|outdoors?|park|beach|hike|nature)\b/, "outdoors"],
  [/\b(game|games|bowling|board)\b/, "games"],
  [/\b(karaoke|sing)\b/, "karaoke"],
  [/\b(climb|boulder|active|sport)\b/, "active"],
]

const DEFAULT_PICKS = ["mini-golf", "bouldering", "karaoke-room"]

export const sameActivity = (piece: LorePiece, venue: Venue) =>
  normalize(piece.title).includes(normalize(venue.keyword)) ||
  piece.place === venue.venue

/** Finds a lore piece named in a request like "do Ocean Beach bonfire again". */
export function findMentionedLore(text: string, lore: LorePiece[]) {
  const t = normalize(text)
  return [...lore]
    .sort((a, b) => b.title.length - a.title.length)
    .find((p) => t.includes(normalize(p.title)))
}

/** A repeat of a piece that has no catalogue venue (for example the Chud event). */
const repeatVenue = (piece: LorePiece): Venue => ({
  id: `again-${piece.id}`,
  title: `${piece.title}, again`,
  keyword: piece.title,
  venue: piece.place,
  day: "Sat",
  time: "2:00 pm",
  conditions: "same plan as last time",
  price: "$$",
  maxTravelMin: 30,
  photo: piece.photos[0] ?? VENUES[0].photo,
  area: piece.area,
})

export function draftOptions({
  request,
  lore,
  source,
}: {
  request: string
  lore: LorePiece[]
  source?: LorePiece
}): PlanOption[] {
  const text = request.toLowerCase()
  let picks: Venue[]

  if (source) {
    const repeat =
      VENUES.find((v) => sameActivity(source, v)) ?? repeatVenue(source)
    const alternatives = VENUES.filter(
      (v) => v.area === source.area && v.id !== repeat.id,
    )
    picks = [repeat, ...alternatives]
  } else {
    const area = AREA_HINTS.find(([re]) => re.test(text))?.[1]
    if (area) picks = VENUES.filter((v) => v.area === area)
    else if (/\b(cheap|free|broke|budget)\b/.test(text))
      picks = VENUES.filter((v) => v.price !== "$$")
    else picks = DEFAULT_PICKS.map((id) => VENUES.find((v) => v.id === id)!)
  }

  // Always offer three, topping up from the defaults without repeats.
  for (const id of DEFAULT_PICKS) {
    if (picks.length >= 3) break
    if (!picks.some((p) => p.id === id))
      picks.push(VENUES.find((v) => v.id === id)!)
  }

  return picks.slice(0, 3).map((venue) => toOption(venue, lore, source))
}

export function toOption(
  venue: Venue,
  lore: LorePiece[],
  source?: LorePiece,
): PlanOption {
  const badges: string[] = []
  const citations: string[] = []
  const done = lore
    .filter((p) => sameActivity(p, venue))
    .sort((a, b) => b.date.localeCompare(a.date))

  if (
    source &&
    (done.some((p) => p.id === source.id) || venue.id === `again-${source.id}`)
  ) {
    badges.push(`Because of ${source.title}, by ${nameOf(source.addedBy)}`)
    citations.push(source.id)
  } else if (done.length) {
    badges.push(`Done ${done.length}× · last ${fmtShort(done[0].date)}`)
    citations.push(done[0].id)
  } else {
    badges.push("New for you")
  }

  const inArea = lore.filter((p) => p.area === venue.area).length
  if (inArea >= 3 && !source)
    badges.push(
      `${AREAS[venue.area]?.label ?? venue.area} ×${inArea} in the lore`,
    )

  badges.push(
    `${dayName(venue.day)} works for ${FREE_ON[venue.day]}/${GROUP.size}`,
  )

  return {
    id: venue.id,
    title: venue.title,
    venue: venue.venue,
    day: venue.day,
    date: WEEKEND[venue.day],
    time: venue.time,
    conditions: venue.conditions,
    note: venue.note,
    price: venue.price,
    maxTravelMin: venue.maxTravelMin,
    photo: venue.photo,
    area: venue.area,
    badges,
    citations,
  }
}

/** "1. Mini golf — Sat 3:00 pm at Urban Putt. Dry and cozy if it rains" */
export const optionLine = (o: PlanOption, i: number) =>
  `${i + 1}. ${o.title} — ${o.day} ${o.time} at ${o.venue}${
    o.note ? `. ${o.note}` : ""
  }`

export const optionMeta = (o: PlanOption) =>
  `${o.venue} · ${o.price} · max ${o.maxTravelMin} min for anyone`

export const votedCount = (plan: Plan) => Object.keys(plan.votes).length

export const tally = (plan: Plan) => {
  const counts: Record<string, number> = {}
  for (const optionId of Object.values(plan.votes))
    if (optionId) counts[optionId] = (counts[optionId] ?? 0) + 1
  return counts
}

/** The option at or above half the group, if any. */
export const majority = (plan: Plan) => {
  const counts = tally(plan)
  const best = [...plan.options].sort(
    (a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0),
  )[0]
  return best && (counts[best.id] ?? 0) >= MAJORITY
    ? { option: best, votes: counts[best.id] }
    : undefined
}

export const lockedOption = (plan: Plan) =>
  plan.options.find((o) => o.id === plan.lockedOptionId)

/**
 * Friends' replies in the simulation. Sam and Noah answer the FGL invite first; Harry and Daniel
 * reply after John votes; Ysan never opens it.
 */
export const EARLY_VOTERS: PersonId[] = ["sam", "noah"]
export const LATE_VOTERS: {
  person: PersonId
  strategy: "follow-planner" | "second-choice"
  delayMs: number
}[] = [
  { person: "harry", strategy: "follow-planner", delayMs: 1800 },
  { person: "daniel", strategy: "second-choice", delayMs: 3600 },
]
