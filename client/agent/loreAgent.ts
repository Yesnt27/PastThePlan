import { AREAS, PEOPLE_ORDER, TODAY } from "../data/seed"
import type { LoreAnswer, LorePiece, PersonId, QuotedLine } from "../data/types"
import {
  fmtLong,
  fmtShort,
  fmtWithDay,
  parseDay,
  relativeDays,
  toISODay,
} from "../lib/dates"
import { listNames, nameOf, normalize } from "./text"

/**
 * "Ask the lore" — the Lore Keeper's read-only side.
 *
 * The app only talks to `loreAgent.ask`. Today it answers locally and deterministically from the
 * lore pieces in memory; a backend agent can replace it as long as it returns the same
 * `LoreAnswer` shape: a summary written around exact quotes, plus the lore it cited. It must never
 * paraphrase a quote, and it says so plainly when the lore has no answer instead of guessing.
 */
export type LoreAgent = {
  ask: (
    question: string,
    ctx: { lore: LorePiece[]; scope?: LorePiece },
  ) => Promise<LoreAnswer>
}

export const loreAgent: LoreAgent = {
  ask: async (question, ctx) => answerLocally(question, ctx.lore, ctx.scope),
}

export const SUGGESTED_QUESTIONS = [
  "How many times have we done karaoke?",
  "Who came to bowling?",
  "What did we do a year ago?",
  "What did we do last summer?",
  "Who said the lock was rigged?",
]

export const scopedSuggestions = (piece: LorePiece) => [
  "Who came?",
  "Where was it?",
  piece.quotes.length ? "What did people say?" : "What happened?",
  "When was it?",
]

// ---------------------------------------------------------------------------------------------
// Text matching

const STOP = new Set(
  `a an the of to in on at for and or with about from by is are was were be been being am do does did done doing
  have has had having we us our ours you your i me my mine it its this that these those there here what which who whom
  whose when where why how many much often times time number count ever any all some go goes going gone went come came
  coming show showed get got hang hung hangout hangouts out together again last first next lore piece pieces tell
  say said says saying quote quotes quoted happen happened happening thing things stuff anything something everything
  can could would should will just like than then so if not no yes ago year years month months week weeks weekend day
  days today ive weve youve also very really one two three`.split(/\s+/),
)

const stem = (word: string) => {
  let w = word
  if (w.length > 4) w = w.replace(/(ing|ed|s)$/, "")
  if (w.length > 3) w = w.replace(/e$/, "")
  return w
}

const tokens = (text: string) => normalize(text).split(" ").filter(Boolean)

const PERSON_RE = new RegExp(`\\b(${PEOPLE_ORDER.join("|")})\\b`, "g")

type Parsed = {
  raw: string
  q: string
  topic: string[]
  topicWords: string[]
  people: PersonId[]
}

function parse(question: string): Parsed {
  const q = normalize(question)
  const people = [
    ...new Set([...q.matchAll(PERSON_RE)].map((m) => m[1] as PersonId)),
  ]
  if (/\b(i|me|my)\b/.test(q) && !people.includes("john")) people.push("john")
  const withoutTime = q.replace(TIME_WORDS, " ")
  const topicWords = tokens(withoutTime).filter(
    (w) =>
      !STOP.has(w) && !PEOPLE_ORDER.includes(w as PersonId) && !/^\d+$/.test(w),
  )
  return {
    raw: question.trim(),
    q,
    topic: topicWords.map(stem),
    topicWords,
    people,
  }
}

const pieceText = (p: LorePiece) =>
  [
    p.title,
    AREAS[p.area]?.label ?? p.area,
    p.place,
    p.story ?? "",
    ...p.quotes.map((x) => x.text),
  ].join(" ")

const pieceStems = (p: LorePiece) => new Set(tokens(pieceText(p)).map(stem))

/** Pieces that mention every topic word; failing that, the ones that mention the most. */
function matchTopic(pieces: LorePiece[], topic: string[]) {
  if (!topic.length) return pieces
  const scored = pieces.map((p) => {
    const s = pieceStems(p)
    return { p, score: topic.filter((t) => s.has(t)).length }
  })
  const all = scored.filter((x) => x.score === topic.length).map((x) => x.p)
  if (all.length) return all
  const best = Math.max(0, ...scored.map((x) => x.score))
  return best ? scored.filter((x) => x.score === best).map((x) => x.p) : []
}

// ---------------------------------------------------------------------------------------------
// Relative dates, anchored to the demo's "today"

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]
const MONTH_ABBR = [
  "jan",
  "feb",
  "mar",
  "apr",
  "",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
]
const TIME_WORDS = new RegExp(
  `\\b(a year ago|one year ago|this time last year|last summer|this summer|summer|last spring|this spring|spring|last fall|this fall|fall|autumn|last winter|this winter|winter|last month|this month|last week|this week|last weekend|this year|last year|in may|${MONTHS.filter((m) => m !== "may").join("|")}|${MONTH_ABBR.filter(Boolean).join("|")}|sept|20\\d\\d)\\b`,
  "g",
)

type Window = { from: string; to: string; label: string }

const addDays = (iso: string, n: number) => {
  const d = parseDay(iso)
  d.setDate(d.getDate() + n)
  return toISODay(d)
}
const ymd = (y: number, m: number, d: number) => toISODay(new Date(y, m, d, 12))
const monthEnd = (y: number, m: number) => ymd(y, m + 1, 0)

function seasonWindow(
  name: "summer" | "spring" | "fall" | "winter",
  which: "last" | "this" | "bare",
): Window {
  const t = parseDay(TODAY)
  const y = t.getFullYear()
  const m = t.getMonth()
  const startMonth = { spring: 2, summer: 5, fall: 8, winter: 11 }[name]
  // Most recent season of this name that has started; "last" steps back one more if we're in it.
  let startYear =
    name === "winter" ? (m >= 11 ? y : y - 1) : m >= startMonth ? y : y - 1
  const endOf = (sy: number) =>
    name === "winter" ? monthEnd(sy + 1, 1) : monthEnd(sy, startMonth + 2)
  const inProgress = TODAY <= endOf(startYear)
  if (which === "last" && inProgress) startYear -= 1
  const from = ymd(startYear, startMonth, 1)
  const to = endOf(startYear)
  const span =
    name === "winter"
      ? `Dec ${startYear}–Feb ${startYear + 1}`
      : `${fmtShort(from).split(" ")[0]}–${fmtShort(to).split(" ")[0]} ${startYear}`
  const lead =
    which === "last" || (!inProgress && which === "bare")
      ? `Last ${name}`
      : `This ${name}`
  return { from, to, label: `${lead} (${span})` }
}

function windowFor(q: string): Window | undefined {
  const t = parseDay(TODAY)
  const y = t.getFullYear()
  const m = t.getMonth()

  if (/\b(a year ago|one year ago|this time last year)\b/.test(q)) {
    const center = ymd(y - 1, m, t.getDate())
    return {
      from: addDays(center, -21),
      to: addDays(center, 21),
      label: `A year ago (around ${fmtLong(center)})`,
    }
  }
  const season = q.match(/\b(last |this )?(summer|spring|fall|autumn|winter)\b/)
  if (season) {
    const name = (
      season[2] === "autumn" ? "fall" : season[2]
    ) as "summer" | "spring" | "fall" | "winter"
    return seasonWindow(
      name,
      season[1] ? season[1].trim() as "last" | "this" : "bare",
    )
  }
  if (/\blast month\b/.test(q)) {
    const from = ymd(y, m - 1, 1)
    return {
      from,
      to: monthEnd(y, m - 1),
      label: `Last month (${MONTHS[parseDay(from).getMonth()].replace(/^./, (c) => c.toUpperCase())})`,
    }
  }
  if (/\bthis month\b/.test(q))
    return { from: ymd(y, m, 1), to: TODAY, label: `This month` }
  if (/\blast weekend\b/.test(q)) {
    const back = (t.getDay() + 1) % 7 || 7 // days back to the most recent Saturday before today
    const sat = addDays(TODAY, -back)
    return {
      from: sat,
      to: addDays(sat, 1),
      label: `Last weekend (${fmtShort(sat)}–${fmtShort(addDays(sat, 1)).split(" ")[1]})`,
    }
  }
  if (/\b(last|this) week\b/.test(q))
    return {
      from: addDays(TODAY, -7),
      to: TODAY,
      label: `The last week (${fmtShort(addDays(TODAY, -7))}–${fmtShort(TODAY)})`,
    }
  if (/\bthis year\b/.test(q))
    return { from: ymd(y, 0, 1), to: TODAY, label: `This year` }
  if (/\blast year\b/.test(q))
    return {
      from: ymd(y - 1, 0, 1),
      to: ymd(y - 1, 11, 31),
      label: `Last year (${y - 1})`,
    }

  const year = q.match(/\b(20\d\d)\b/)?.[1]
  const monthIdx = MONTHS.findIndex((name, i) =>
    name === "may"
      ? /\bin may\b/.test(q)
      : new RegExp(
          `\\b(${name}|${MONTH_ABBR[i] || name}${i === 8 ? "|sept" : ""})\\b`,
        ).test(q),
  )
  if (monthIdx >= 0) {
    const yy = year ? Number(year) : monthIdx > m ? y - 1 : y
    const from = ymd(yy, monthIdx, 1)
    const label = `${MONTHS[monthIdx].replace(/^./, (c) => c.toUpperCase())} ${yy}`
    return { from, to: monthEnd(yy, monthIdx), label }
  }
  if (year) return { from: `${year}-01-01`, to: `${year}-12-31`, label: year }
  return undefined
}

// ---------------------------------------------------------------------------------------------
// Phrasing

const thisYear = TODAY.slice(0, 4)
const when = (iso: string) =>
  iso.startsWith(thisYear) ? fmtShort(iso) : fmtLong(iso)
const whoPhrase = (p: LorePiece) =>
  p.who.length === PEOPLE_ORDER.length ? "all six of you" : listNames(p.who)
const newestFirst = (a: LorePiece, b: LorePiece) => b.date.localeCompare(a.date)
const oldestFirst = (a: LorePiece, b: LorePiece) => a.date.localeCompare(b.date)

const joinList = (items: string[]) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`

const quotesFrom = (
  pieces: LorePiece[],
  limit = 2,
  by?: PersonId[],
): QuotedLine[] =>
  pieces
    .flatMap((p) =>
      p.quotes
        .filter((q) => !by?.length || by.includes(q.by))
        .map((q) => ({ loreId: p.id, quoteId: q.id, text: q.text, by: q.by })),
    )
    .slice(0, limit)

const answer = (
  parsed: Parsed,
  text: string,
  pieces: LorePiece[],
  quotes: QuotedLine[] = [],
  scopeId?: string,
): LoreAnswer => ({
  question: parsed.raw,
  text,
  quotes,
  citations: [
    ...new Set([...pieces.map((p) => p.id), ...quotes.map((q) => q.loreId)]),
  ],
  found: true,
  scopeId,
})

const nothing = (
  parsed: Parsed,
  text: string,
  scopeId?: string,
): LoreAnswer => ({
  question: parsed.raw,
  text,
  quotes: [],
  citations: [],
  found: false,
  scopeId,
})

const topicLabel = (parsed: Parsed) => parsed.topicWords.join(" ")

// ---------------------------------------------------------------------------------------------

const isQuoteQ = (q: string) =>
  /\b(who said|said|say|says|quote|quoted|saying|words)\b/.test(q)
const isCountQ = (q: string) =>
  /\b(how many|how often|number of|count)\b/.test(q)
const isWhoQ = (q: string) =>
  /^(so )?who\b/.test(q) || /\bwho (came|went|was|were|showed)\b/.test(q)
const isWhereQ = (q: string) => /^where\b|\bwhere (was|did|is)\b/.test(q)
const isWhenQ = (q: string) => /^when\b|\blast time\b|\bwhat date\b/.test(q)
const isYesNoQ = (q: string) => /^(did|was|were|has|have)\b/.test(q)

export function answerLocally(
  question: string,
  lore: LorePiece[],
  scope?: LorePiece,
): LoreAnswer {
  const parsed = parse(question)
  if (scope) return answerAbout(scope, parsed)

  const { q, topic, people } = parsed
  if (!q)
    return nothing(
      parsed,
      "Ask me something about the group — like karaoke, who came to bowling, or what you did a year ago.",
    )

  // Quotes: search the saved words themselves, and return them untouched.
  if (isQuoteQ(q)) {
    const speakers = people.filter(
      (p) => !(p === "john" && !/\bjohn\b/.test(q)),
    )
    const lines = lore
      .flatMap((p) =>
        p.quotes.map((x) => ({ p, x, s: new Set(tokens(x.text).map(stem)) })),
      )
      .filter(
        ({ x, s }) =>
          (!speakers.length || speakers.includes(x.by)) &&
          topic.every((t) => s.has(t)),
      )
    if (lines.length) {
      const first = lines[0]
      const text =
        lines.length === 1
          ? `${nameOf(first.x.by)} said it at ${first.p.title} (${when(first.p.date)}):`
          : `${lines.length} saved quotes match, word for word:`
      return answer(
        parsed,
        text,
        [],
        lines
          .slice(0, 4)
          .map(({ p, x }) => ({
            loreId: p.id,
            quoteId: x.id,
            text: x.text,
            by: x.by,
          })),
      )
    }
    const who = speakers.length ? `from ${listNames(speakers)} ` : ""
    return nothing(
      parsed,
      `No saved quote ${who}${
        topic.length ? `says “${topicLabel(parsed)}”` : "matches that"
      }. Quotes only exist if someone typed them in when adding lore.`,
    )
  }

  const window = windowFor(q)
  let pool = window
    ? lore.filter((p) => p.date >= window.from && p.date <= window.to)
    : lore
  const filterPeople = isWhoQ(q) ? [] : people
  if (filterPeople.length && !isYesNoQ(q))
    pool = pool.filter((p) => filterPeople.every((id) => p.who.includes(id)))
  const matched = matchTopic(pool, topic).sort(oldestFirst)

  if (!matched.length) {
    if (window && !topic.length)
      return nothing(
        parsed,
        `Nothing in the lore from ${window.label.replace(/^./, (c) => c.toLowerCase())}. If you did something, nobody added it.`,
      )
    const scopeText = window
      ? ` from ${window.label.replace(/^./, (c) => c.toLowerCase())}`
      : ""
    const withWho = filterPeople.length
      ? ` with ${listNames(filterPeople)}`
      : ""
    return nothing(
      parsed,
      `I couldn’t find anything about “${topicLabel(parsed) || parsed.raw}”${withWho}${scopeText} in the lore. Nobody’s added it yet — use + to add it.`,
    )
  }

  if (isYesNoQ(q) && people.length) {
    const person = people.find((p) => p !== "john") ?? people[0]
    const latest = [...matched].sort(newestFirst)[0]
    const there = latest.who.includes(person)
    const text = there
      ? `Yes — ${nameOf(person)} was at ${latest.title} on ${when(latest.date)}, with ${listNames(latest.who.filter((id) => id !== person))}.`
      : `No — ${nameOf(person)} wasn’t at ${latest.title} (${when(latest.date)}). ${listNames(latest.who)} ${
          latest.who.length === 1 ? "was" : "were"
        }.`
    return answer(parsed, text, [latest], quotesFrom([latest], 1))
  }

  if (isCountQ(q)) {
    const n = matched.length
    const items = matched.map((p) => `${p.title} (${when(p.date)})`)
    const lead = window ? `${window.label}: ` : ""
    // "How many times have I…" puts John in the filter; don't name him back to himself.
    const others = filterPeople.filter(
      (id) => id !== "john" || /\bjohn\b/.test(q),
    )
    const withWho = others.length ? ` with ${listNames(others)}` : ""
    const text = `${lead}${n} time${
      n === 1 ? "" : "s"
    }${withWho}, going by the lore — ${joinList(items)}.`
    return answer(
      parsed,
      text,
      matched,
      quotesFrom([...matched].sort(newestFirst), 1),
    )
  }

  if (isWhoQ(q)) {
    const latest = [...matched].sort(newestFirst)
    if (latest.length === 1 || topic.length) {
      const p = latest[0]
      const more =
        latest.length > 1 ? ` (That’s the latest of ${latest.length}.)` : ""
      return answer(
        parsed,
        `${listNames(p.who)} came to ${p.title} on ${when(p.date)} at ${p.place}.${more}`,
        [p],
        quotesFrom([p], 1),
      )
    }
    const items = latest
      .slice(0, 4)
      .map((p) => `${p.title} (${when(p.date)}): ${whoPhrase(p)}`)
    return answer(
      parsed,
      `${window ? `${window.label} — ` : ""}${items.join("; ")}.`,
      latest.slice(0, 4),
    )
  }

  if (isWhereQ(q)) {
    const p = [...matched].sort(newestFirst)[0]
    return answer(parsed, `${p.title} was at ${p.place}, on ${when(p.date)}.`, [
      p,
    ])
  }

  if (isWhenQ(q)) {
    const sorted = [...matched].sort(newestFirst)
    const p = sorted[0]
    const days = relativeDays(p.date, TODAY)
    const more =
      sorted.length > 1
        ? ` Before that: ${joinList(sorted.slice(1, 3).map((x) => `${x.title} (${when(x.date)})`))}.`
        : ""
    return answer(
      parsed,
      `Last time was ${p.title} on ${fmtWithDay(p.date)} — ${days}, at ${p.place}.${more}`,
      sorted.slice(0, 3),
      quotesFrom([p], 1),
    )
  }

  // Default: summarise what matched, oldest first, quoting rather than retelling.
  const shown = matched.slice(0, 5)
  const items = shown.map(
    (p) => `${p.title} on ${when(p.date)} with ${whoPhrase(p)}`,
  )
  const rest =
    matched.length > shown.length
      ? ` — plus ${matched.length - shown.length} more`
      : ""
  const lead = window
    ? `${window.label}, you had ${matched.length} hangout${
        matched.length === 1 ? "" : "s"
      }: `
    : `${matched.length} piece${
        matched.length === 1 ? "" : "s"
      } of lore match: `
  return answer(
    parsed,
    `${lead}${joinList(items)}${rest}.`,
    matched,
    quotesFrom([...shown].sort(newestFirst), 2),
  )
}

/** Questions asked from a lore piece only ever look at that piece. */
function answerAbout(p: LorePiece, parsed: Parsed): LoreAnswer {
  const { q, topic, people } = parsed
  const say = (text: string, quotes: QuotedLine[] = []) =>
    answer(parsed, text, [p], quotes, p.id)
  const allQuotes = quotesFrom([p], 20)

  if (isQuoteQ(q)) {
    const by = people.filter((id) => id !== "john" || /\bjohn\b/.test(q))
    const lines = quotesFrom([p], 20, by)
    if (lines.length)
      return say(
        lines.length === 1
          ? `One saved quote, word for word:`
          : `${lines.length} saved quotes, word for word:`,
        lines,
      )
    return nothing(
      parsed,
      by.length
        ? `Nothing from ${listNames(by)} was saved for ${p.title}.`
        : `No quotes were saved for ${p.title}.`,
      p.id,
    )
  }
  if (isYesNoQ(q) && people.length) {
    const person = people.find((id) => id !== "john") ?? people[0]
    return p.who.includes(person)
      ? say(`Yes — ${nameOf(person)} was there.`)
      : say(
          `No — ${nameOf(person)} wasn’t at ${p.title}. ${listNames(p.who)} ${
            p.who.length === 1 ? "was" : "were"
          }.`,
        )
  }
  if (isWhoQ(q) || /\b(who|people|attend)/.test(q))
    return say(
      `${
        p.who.length === PEOPLE_ORDER.length
          ? "All six of you"
          : listNames(p.who)
      } — ${p.who.length} ${
        p.who.length === 1 ? "person" : "people"
      }. ${nameOf(p.addedBy)} added it.`,
    )
  if (isWhereQ(q) || /\b(place|venue)\b/.test(q)) return say(`At ${p.place}.`)
  if (isWhenQ(q) || /\b(date|day)\b/.test(q))
    return say(`${fmtWithDay(p.date)} — ${relativeDays(p.date, TODAY)}.`)
  if (/\b(photo|photos|picture|pictures|pics)\b/.test(q))
    return say(
      `${p.photos.length} photo${
        p.photos.length === 1 ? "" : "s"
      } saved with it.`,
    )

  if (topic.length) {
    const s = pieceStems(p)
    const hits = topic.filter((t) => s.has(t))
    if (!hits.length) {
      return nothing(
        parsed,
        `${p.title} doesn’t say anything about “${topicLabel(parsed)}”. ${listNames(p.who)} ${
          p.who.length === 1 ? "was" : "were"
        } there — they’d know.`,
        p.id,
      )
    }
    const lines = allQuotes.filter((x) =>
      hits.some((t) => tokens(x.text).map(stem).includes(t)),
    )
    const storyHit =
      p.story &&
      hits.some((t) =>
        tokens(p.story ?? "")
          .map(stem)
          .includes(t),
      )
    const text = storyHit
      ? `In ${nameOf(p.addedBy)}’s words: “${p.story}”`
      : `It comes up in what was saved:`
    return say(text, lines.length ? lines : storyHit ? [] : allQuotes)
  }

  const story = p.story
    ? `In ${nameOf(p.addedBy)}’s words: “${p.story}”`
    : `${nameOf(p.addedBy)} didn’t write a story for this one.`
  return say(
    `${p.title}, ${when(p.date)} at ${p.place} with ${whoPhrase(p)}. ${story}`,
    allQuotes,
  )
}
