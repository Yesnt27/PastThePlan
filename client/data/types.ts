/**
 * Domain types for the FGL book. Rebuilt from usage: the Figma Make source map shipped every
 * module except this type-only file.
 */

export type Tint = "red" | "orange" | "yellow" | "green" | "purple" | "blue"
export type PieceId = Tint
export type PersonId = string
export type Day = "Fri" | "Sat" | "Sun"
export type Price = "Free" | "$" | "$$" | "$$$"

export type Piece = {
  id: PieceId
  tint: Tint
  creature: string
  width: number
  height: number
}

export type Person = { id: PersonId; name: string; piece: PieceId }

export type Area = { id: string; label: string; tint: Tint }

export type Quote = { id: string; text: string; by: PersonId }

export type LorePiece = {
  id: string
  title: string
  area: string
  date: string
  place: string
  addedBy: PersonId
  who: PersonId[]
  story?: string
  quotes: Quote[]
  photos: string[]
  planId?: string
}

export type KnownAs = { name: string; group: string; from: PersonId }

export type Profile = {
  id: PersonId
  fullName: string
  age?: number
  city: string
  aka?: string
  vibes: string[]
  hobbies: string[]
  activity: string
  meme?: string
  photo?: string
  groups: { name: string; days: number }[]
  knownAs: KnownAs[]
}

export type Limits = {
  budget?: number
  noAlcohol?: boolean
  homeBy?: string
  travelMin?: number
  notes?: string
  calendar?: "connected" | "not connected" | string
  homeArea?: string
  /** Days this person can do at all, e.g. weekends only. */
  days?: ("Fri" | "Sat" | "Sun")[]
}

export type PlanOption = {
  id: string
  title: string
  venue: string
  day: Day
  date: string
  time: string
  conditions: string
  note?: string
  price: Price
  maxTravelMin: number
  photo: string
  area: string
  badges: string[]
  citations: string[]
}

export type PlanStatus =
  | "checking"
  | "voting"
  | "review"
  | "locked"
  | "done"
  | "cancelled"

export type PlanMeta = {
  /** Ideas sent to everyone's agent, and how many passed (any "no" drops an idea). */
  checked: number
  passed: number
  /** Members whose agent answered privately. */
  agents: number
  /** Days that work for a majority (and for anyone being re-included), with free counts. */
  windows: { day: Day; free: number }[]
  /** How many people the plan was shaped around because they've missed recent hangouts. Never who. */
  reinclude: number
  requestedBy?: string
  askedOn?: string
}

export type Plan = {
  id: string
  request: string
  sourceLoreId?: string
  status: PlanStatus
  options: PlanOption[]
  votes: Record<PersonId, string>
  majorityAnnounced: boolean
  lockedOptionId?: string
  coming: PersonId[]
  recapStory?: string
  loreId?: string
  meta?: PlanMeta
}

export type QuotedLine = {
  loreId: string
  quoteId: string
  text: string
  by: PersonId
}

export type LoreAnswer = {
  question: string
  text: string
  quotes: QuotedLine[]
  citations: string[]
  found: boolean
  scopeId?: string
}

export type ChatMessage =
  | { id: string; kind: "text"; from: "me" | "agent"; text: string }
  | { id: string; kind: "agent-card" | "system" | "response"; text: string }
  | { id: string; kind: "answer"; answer: LoreAnswer; text?: string }
  | {
      id: string
      kind: "pick" | "review" | "board-link" | "recap-link"
      planId: string
    }
