import { answerLocally } from "@/client/agent/loreAgent"
import { AREA_HINTS, MAJORITY, sameActivity, toOption } from "@/client/agent/planner"
import { AREAS, GROUP, TODAY, VENUES, type Venue } from "@/client/data/seed"
import type { Day, LorePiece, PlanOption } from "@/client/data/types"
import { dayName } from "@/client/lib/dates"
import { sql } from "@/lib/server/db"
import { availability, checkOptions, loadHeld, privateNudges } from "./member"
import { describe, weekendWeather } from "./world"

/** Extra candidates the catalogue in seed.ts doesn't have. */
const EXTRA: (Venue & { alcoholCentric?: boolean; durationMin?: number })[] = [
  { id: "rooftop-bar", title: "Rooftop bar", keyword: "rooftop", venue: "Charmaine’s Rooftop", day: "Sat", time: "9:00 pm", conditions: "outdoor heaters", price: "$$$", maxTravelMin: 28, photo: "/assets/photos/seawall-sunset.jpg", area: "food", alcoholCentric: true, durationMin: 180 },
  { id: "night-market", title: "Night market", keyword: "market", venue: "Off the Grid, Fort Mason", day: "Fri", time: "6:00 pm", conditions: "outdoor", price: "$", maxTravelMin: 26, photo: "/assets/photos/dimsum-group.jpg", area: "food" },
  { id: "free-show", title: "Free show in the park", keyword: "show", venue: "Stern Grove", day: "Sun", time: "2:00 pm", conditions: "outdoor", price: "Free", maxTravelMin: 24, photo: "/assets/photos/picnic-laughing.jpg", area: "outdoors" },
]
const ALL: (Venue & { alcoholCentric?: boolean; durationMin?: number })[] = [...VENUES, ...EXTRA]
const indoor = (v: Venue) => /indoor/.test(v.conditions)

export async function loadLore(groupId: string): Promise<LorePiece[]> {
  const rows = await sql()`select data from fgl_lore where group_id = ${groupId} order by created_at desc`
  return rows.map((r) => r.data as LorePiece)
}

export async function askLore(groupId: string, question: string, scopeId?: string) {
  const lore = await loadLore(groupId)
  return answerLocally(question, lore, scopeId ? lore.find((p) => p.id === scopeId) : undefined)
}

export async function onThisDay(groupId: string) {
  const lore = await loadLore(groupId)
  const md = TODAY.slice(5)
  return lore.filter((p) => p.date.slice(5) === md && p.date < TODAY).map((p) => ({ id: p.id, title: p.title, date: p.date, place: p.place, quote: p.quotes[0]?.text }))
}

export async function areaStats(groupId: string) {
  const lore = await loadLore(groupId)
  return Object.values(AREAS).map((a) => {
    const ps = lore.filter((p) => p.area === a.id).sort((x, y) => y.date.localeCompare(x.date))
    return { area: a.label, count: ps.length, last: ps[0]?.date ?? null }
  })
}

export type PlanDraft = {
  options: PlanOption[]
  considered: number
  didNotFit: number
  availability: Record<string, number>
  weather: Record<string, { rain: number; high: number; low: number }>
  note: string
}

/** Candidates → fit check (aggregate only) → deterministic score → three diverse picks. */
export async function planOptions(groupId: string, request: string, sourceLoreId?: string): Promise<PlanDraft> {
  const [lore, held, weather] = await Promise.all([loadLore(groupId), loadHeld(groupId), weekendWeather()])
  const days: Day[] = ["Fri", "Sat", "Sun"]
  const avail = availability(held, days)
  const text = request.toLowerCase()
  const source = sourceLoreId
    ? lore.find((p) => p.id === sourceLoreId)
    : /\bagain\b/.test(text)
      ? [...lore].sort((a, b) => b.title.length - a.title.length).find((p) => text.includes(p.title.toLowerCase()))
      : undefined
  const hinted = AREA_HINTS.find(([re]) => re.test(text))?.[1]
  const cheap = /\b(cheap|free|broke|budget)\b/.test(text)

  let pool = ALL.map((v) => ({ v, o: toOption(v, lore, source) }))
  if (source && !pool.some(({ v }) => sameActivity(source, v))) {
    const v: Venue = { id: `again-${source.id}`, title: `${source.title}, again`, keyword: source.title, venue: source.place, day: "Sat", time: "2:00 pm", conditions: "same plan as last time", price: "$$", maxTravelMin: 30, photo: source.photos[0] ?? VENUES[0].photo, area: source.area }
    pool.push({ v, o: toOption(v, lore, source) })
  }
  // Live conditions and real availability replace the catalogue text.
  pool = pool.map(({ v, o }) => {
    const w = weather[v.day]
    const cond = describe(w, indoor(v)) ?? o.conditions
    const note = w && w.rain >= 50 && indoor(v) ? "Dry and cozy if it rains" : o.note
    const badges = o.badges.filter((b) => !/ works for /.test(b))
    badges.push(`${dayName(v.day)} works for ${avail[v.day]}/${GROUP.size}`)
    return { v, o: { ...o, conditions: cond, note, badges, alcoholCentric: (v as { alcoholCentric?: boolean }).alcoholCentric, durationMin: (v as { durationMin?: number }).durationMin } as PlanOption }
  })

  const fit = checkOptions(held, pool.map((p) => p.o))
  const fitById = Object.fromEntries(fit.map((f) => [f.optionId, f]))
  const passing = pool.filter(({ o }) => fitById[o.id].fitsEveryone && avail[o.day] >= MAJORITY)

  const score = ({ v, o }: { v: Venue; o: PlanOption }) => {
    const done = lore.filter((p) => sameActivity(p, v)).length
    const recentSameArea = lore.filter((p) => p.area === v.area && p.date >= "2026-08-25").length
    const w = weather[v.day]
    const wet = w ? w.rain / 100 : 0.2
    let s = 30 * (avail[o.day] / GROUP.size)
    s += 15 * (indoor(v) ? 1 : 1 - wet)
    s += 15 * Math.max(0, 1 - o.maxTravelMin / 45)
    s += 15 * (done ? 1 / (1 + done) : 1) - (recentSameArea >= 3 ? 6 : 0)
    s += 10 * (hinted && v.area === hinted ? 1 : 0) + (source && (sameActivity(source, v) || v.id === `again-${source.id}`) ? 40 : 0)
    s += 5 * (o.price === "Free" ? 1 : o.price === "$" ? 0.6 : 0.2) + (cheap && o.price !== "$$" ? 5 : 0)
    return s
  }
  const ranked = [...passing].sort((a, b) => score(b) - score(a))
  const picks: typeof ranked = []
  for (const c of ranked) {
    if (picks.length >= 3) break
    if (picks.some((p) => p.v.area === c.v.area) && ranked.some((r) => !picks.includes(r) && r !== c && !picks.some((p) => p.v.area === r.v.area))) continue
    picks.push(c)
  }
  for (const c of ranked) if (picks.length < 3 && !picks.includes(c)) picks.push(c)

  const didNotFit = pool.filter(({ o }) => !fitById[o.id].fitsEveryone).length
  return {
    options: picks.map((p) => p.o),
    considered: pool.length,
    didNotFit,
    availability: avail,
    weather,
    note: picks.length ? "" : "Nothing fits everyone this weekend.",
  }
}

/** “Why not the rooftop bar?”: a yes/no about one idea, never a reason or a name. */
export async function checkIdea(groupId: string, idea: string) {
  const t = idea.toLowerCase()
  const lore = await loadLore(groupId)
  const v = ALL.find((x) => t.includes(x.keyword) || t.includes(x.title.toLowerCase()) || t.includes(x.venue.toLowerCase()))
  if (!v) return { known: false as const }
  const held = await loadHeld(groupId)
  const [f] = checkOptions(held, [{ ...toOption(v, lore), alcoholCentric: (v as { alcoholCentric?: boolean }).alcoholCentric } as PlanOption])
  return { known: true as const, title: v.title, fitsEveryone: f.fitsEveryone, free: f.free }
}

export async function nudgesFor(groupId: string, option: PlanOption) {
  return privateNudges(await loadHeld(groupId), option)
}
