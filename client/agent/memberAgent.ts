import type { Limits } from "../data/types"

/**
 * Front-end stand-in for John's private member agent on ASI:One.
 * Limits stay here; the group agent only ever receives derived answers (busy times, travel
 * minutes, fits / doesn't fit), never the values themselves.
 */

export const PAIRING_CODE = "K7Q2M9"

export const EMPTY_LIMITS: Limits = { calendar: "not connected" }

const DIET =
  /\b(vegetarian|vegan|pescatarian|halal|kosher|gluten[- ]free|dairy[- ]free|nut allergy|no pork|no beef|no seafood)\b/g

function clock(h: number, min: number, suffix?: string) {
  // "home by 11" means 11 pm; "home by 12" or "home by 1" mean after midnight.
  const ampm =
    suffix?.toLowerCase() ?? (h >= 13 || (h >= 6 && h <= 11) ? "pm" : "am")
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${String(min).padStart(2, "0")} ${ampm}`
}

/** Reads limits out of plain words. Only fields that were mentioned are returned. */
export function parseLimits(input: string): Partial<Limits> {
  const text = input.toLowerCase()
  const out: Partial<Limits> = {}

  const budget = text.match(/\$\s?(\d+)/) ?? text.match(/\bbudget\D{0,12}(\d+)/)
  if (budget) out.budget = Number(budget[1])
  if (/\b(no budget|any budget|budget doesn.?t matter)\b/.test(text))
    out.budget = undefined

  if (
    /\b(no alcohol|no drinking|no drinks|no bars?|sober|don.?t drink)\b/.test(
      text,
    )
  )
    out.noAlcohol = true
  if (
    /\b(alcohol (is )?(ok|okay|fine)|drinks? (are )?(ok|okay|fine))\b/.test(
      text,
    )
  )
    out.noAlcohol = false

  const home = text.match(/\bhome by (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (home) out.homeBy = clock(Number(home[1]), Number(home[2] ?? 0), home[3])
  if (/\bhome by midnight\b/.test(text)) out.homeBy = "12:00 am"
  if (/\b(no curfew|stay out late|any time)\b/.test(text))
    out.homeBy = undefined

  const travel = text.match(/(\d+)\s*(?:min|mins|minutes)\b/)
  if (travel) out.travelMin = Number(travel[1])

  const diets = [...new Set([...text.matchAll(DIET)].map((m) => m[1]))]
  const notes = text.match(/\bnotes?:\s*(.+)$/)
  if (notes) out.notes = notes[1].trim()
  else if (diets.length) out.notes = diets.join(", ")

  if (/\bcalendar\b/.test(text))
    out.calendar = /\b(disconnect|remove|off)\b/.test(text)
      ? "not connected"
      : "connected"

  const area = input.match(
    /\bhome(?: area)?(?: is| in|:)?\s+(?!by\b)([A-Za-z][A-Za-z .'-]{1,40})$/i,
  )
  if (area && !home) out.homeArea = titleCaseArea(area[1])

  return out
}

const titleCaseArea = (raw: string) => {
  const name = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return /,/.test(name) ? name : `${name}, SF`
}

export function summarizeLimits(l: Limits) {
  const parts = [
    l.budget != null ? `budget up to $${l.budget}/person` : "no budget set",
    l.noAlcohol ? "no alcohol-centric plans" : null,
    l.homeBy ? `home by ${l.homeBy}` : null,
    l.travelMin != null ? `travel up to ${l.travelMin} min` : null,
    l.notes ? `notes: ${l.notes}` : null,
    `calendar: ${
      l.calendar === "connected" ? "busy times only" : "not connected"
    }`,
    l.homeArea ? `home area: ${l.homeArea}` : null,
  ]
  return parts.filter(Boolean).join(" · ")
}

export const limitRows = (l: Limits) => [
  {
    key: "budget",
    label: "Budget",
    value: l.budget != null ? `Up to $${l.budget}/person` : "Not set",
  },
  {
    key: "noAlcohol",
    label: "Alcohol",
    value: l.noAlcohol ? "No alcohol-centric plans" : "Fine either way",
  },
  { key: "homeBy", label: "Home by", value: l.homeBy ?? "No curfew" },
  {
    key: "travelMin",
    label: "Travel",
    value: l.travelMin != null ? `Up to ${l.travelMin} min` : "Any distance",
  },
  { key: "notes", label: "Notes", value: l.notes ?? "None" },
  {
    key: "calendar",
    label: "Calendar",
    value: l.calendar === "connected" ? "Busy times only" : "Not connected",
  },
  { key: "homeArea", label: "Home area", value: l.homeArea ?? "Not set" },
]

export type AgentReply = {
  kind: "text" | "agent-card"
  text: string
  limits?: Limits
}

const FIELD_WORDS: [RegExp, keyof Limits][] = [
  [/budget|money|\$/, "budget"],
  [/alcohol|drink/, "noAlcohol"],
  [/home by|curfew|late/, "homeBy"],
  [/travel|distance|minutes|min\b/, "travelMin"],
  [/notes?|diet|vegetarian|vegan|food/, "notes"],
  [/calendar/, "calendar"],
  [/home area|neighbou?rhood|where i live|\bhome\b/, "homeArea"],
]

/** One turn of the private agent conversation. Never echoes secrets such as calendar URLs. */
export function memberAgentReply(input: string, limits: Limits): AgentReply {
  const raw = input.trim()
  const text = raw.toLowerCase()

  if (/^pair\b/.test(text)) {
    const code = raw.split(/\s+/)[1]?.toUpperCase()
    return code === PAIRING_CODE
      ? {
          kind: "text",
          text: "Already paired with you. Your limits stay here — Lore Keeper only hears yes or no.",
        }
      : {
          kind: "text",
          text: `That code doesn’t match. Pairing codes look like ${PAIRING_CODE}.`,
        }
  }

  if (/^forget\b/.test(text)) {
    const rest = text.replace(/^forget\s*/, "")
    if (!rest || /\b(all|everything)\b/.test(rest)) {
      return {
        kind: "agent-card",
        text: `Forgotten. I’m holding nothing now: ${summarizeLimits(EMPTY_LIMITS)}. Tell me new limits any time.`,
        limits: { ...EMPTY_LIMITS },
      }
    }
    const field = FIELD_WORDS.find(([re]) => re.test(rest))?.[1]
    if (!field)
      return {
        kind: "text",
        text: "Which one should I forget? Try “forget budget” or just “forget” for everything.",
      }
    const next: Limits = {
      ...limits,
      [field]: field === "calendar" ? "not connected" : undefined,
    }
    return {
      kind: "agent-card",
      text: `Forgot that. Here’s what I keep now: ${summarizeLimits(next)}.`,
      limits: next,
    }
  }

  if (/^(profile|limits|show|what do you know)/.test(text)) {
    return {
      kind: "agent-card",
      text: `Here’s what I keep private: ${summarizeLimits(limits)}. Say ‘fix: …’ to change it.`,
    }
  }

  const body = /^fix:?/.test(text) ? raw.replace(/^fix:?\s*/i, "") : raw
  if (/^calendar\b/i.test(body)) {
    const off = /\b(disconnect|remove|off)\b/i.test(body)
    const next: Limits = {
      ...limits,
      calendar: off ? "not connected" : "connected",
    }
    return {
      kind: "text",
      text: off
        ? "Calendar disconnected. I’ll assume you’re free unless you tell me."
        : "Got it. I only read busy times, never event titles.",
      limits: next,
    }
  }
  if (/^home\b/i.test(body) && !/^home by\b/i.test(body)) {
    const area = body.replace(/^home(?: area)?(?: is| in|:)?\s*/i, "")
    if (!area)
      return {
        kind: "text",
        text: "Which neighbourhood? Something like “home Mission”.",
      }
    const homeArea = titleCaseArea(area)
    return {
      kind: "text",
      text: `Home area set to ${homeArea} (rounded to about 1 km). Only travel minutes are shared.`,
      limits: { ...limits, homeArea },
    }
  }

  const found = parseLimits(body)
  if (Object.keys(found).length) {
    const next: Limits = { ...limits, ...found }
    return {
      kind: "agent-card",
      text: `Here’s what I’ll keep private: ${summarizeLimits(next)}. Say ‘fix: …’ to change it.`,
      limits: next,
    }
  }

  return {
    kind: "text",
    text: "Tell me limits in plain words — like “budget $30”, “home by midnight”, or “max 20 min travel”. Say “forget” to clear them.",
  }
}

/** What the group planner may learn: whether an option fits, never why. */
export const fitsPrivateLimits = (
  limits: Limits,
  option: { price: string; time: string },
) => {
  if (limits.budget != null && limits.budget < 20 && option.price === "$$")
    return false
  return true
}
