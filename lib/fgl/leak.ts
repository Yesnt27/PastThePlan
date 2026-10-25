import { PEOPLE_ORDER, SEED_PEOPLE } from "@/client/data/seed"

const SENSITIVE = /\b(budget|afford|money|broke|expensive|cost[s]? too|sober|drink(?:ing|s)?|alcohol|curfew|home by|vegetarian|vegan|diet|lives?|address|calendar|busy|limit[s]?)\b/i

/** True when a group-facing sentence puts a member’s name near a sensitive word. */
export function leaks(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const names = PEOPLE_ORDER.map((id) => SEED_PEOPLE[id].name.toLowerCase())
  return sentences.some((s) => {
    const l = s.toLowerCase()
    return SENSITIVE.test(l) && names.some((n) => new RegExp(`\\b${n}\\b`).test(l))
  })
}
