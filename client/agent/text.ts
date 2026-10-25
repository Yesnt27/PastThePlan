import { SEED_PEOPLE } from "../data/seed"
import type { PersonId } from "../data/types"

export const nameOf = (id: PersonId) => SEED_PEOPLE[id]?.name ?? id

/** "Harry, John and Noah" */
export const listNames = (ids: PersonId[]) => {
  const names = ids.map(nameOf)
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

export const normalize = (s: string) =>
  s.toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
