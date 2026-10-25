import { asset, photo } from "../lib/asset"
import type {
  Area,
  ChatMessage,
  Day,
  Limits,
  LorePiece,
  Person,
  PersonId,
  Piece,
  PieceId,
  Price,
  Profile,
} from "./types"

/**
 * Demo data for The Wizards Pit. A production build would load this from the FGL backend;
 * the screens only read it through the store in src/state.
 */

/** Demo clock. Matches the frames: next Saturday (Oct 31) is "in 7 days". */
export const TODAY = "2026-10-24"
export let ME: PersonId = "john"
/** Switches who this browser acts as (see client/identity.ts). */
export function setMe(id: PersonId) {
  ME = id
}
export const GROUP = { name: "The Wizards Pit", size: 6 }

/** Name-tag creatures from "01 Book – closed", in the swatch order used by "My puzzle piece". */
export const PIECES: Record<PieceId, Piece> = {
  green: {
    id: "green",
    tint: "green",
    creature: asset("assets/book/df5fc.svg"),
    width: 16.0081,
    height: 13.0002,
  },
  orange: {
    id: "orange",
    tint: "orange",
    creature: asset("assets/book/1af92.svg"),
    width: 16.0011,
    height: 14.0004,
  },
  red: {
    id: "red",
    tint: "red",
    creature: asset("assets/book/2a867.svg"),
    width: 16.0005,
    height: 11.9994,
  },
  yellow: {
    id: "yellow",
    tint: "yellow",
    creature: asset("assets/book/ce28a.svg"),
    width: 11.9998,
    height: 16,
  },
  blue: {
    id: "blue",
    tint: "blue",
    creature: asset("assets/book/be3c5.svg"),
    width: 11.0011,
    height: 15.9993,
  },
  purple: {
    id: "purple",
    tint: "purple",
    creature: asset("assets/book/922ad.svg"),
    width: 16.0006,
    height: 12.0016,
  },
}
export const PIECE_ORDER: PieceId[] = [
  "green",
  "orange",
  "red",
  "yellow",
  "blue",
  "purple",
]

export const PEOPLE_ORDER: PersonId[] = [
  "harry",
  "john",
  "daniel",
  "sam",
  "noah",
  "ysan",
]

export const SEED_PEOPLE: Record<PersonId, Person> = {
  harry: { id: "harry", name: "Harry", piece: "red" },
  john: { id: "john", name: "John", piece: "orange" },
  daniel: { id: "daniel", name: "Daniel", piece: "yellow" },
  sam: { id: "sam", name: "Sam", piece: "green" },
  noah: { id: "noah", name: "Noah", piece: "purple" },
  ysan: { id: "ysan", name: "Ysan", piece: "blue" },
}

export const AREAS: Record<string, Area> = {
  karaoke: { id: "karaoke", label: "Karaoke", tint: "purple" },
  outdoors: { id: "outdoors", label: "Outdoors", tint: "green" },
  games: { id: "games", label: "Games", tint: "yellow" },
  food: { id: "food", label: "Food", tint: "orange" },
  active: { id: "active", label: "Active", tint: "blue" },
}

const everyone: PersonId[] = [...PEOPLE_ORDER]

export const SEED_LORE: LorePiece[] = [
  {
    id: "chud-event",
    title: "Chud event",
    area: "food",
    date: "2026-10-11",
    place: "Trees Café, Big Way, Sulbing",
    addedBy: "noah",
    who: ["harry", "sam", "noah"],
    quotes: [
      {
        id: "q-chud",
        text: "We started with a study session at Trees Café, grabbed dinner at Big Way, and ended with dessert at Sulbing, chatting for hours!",
        by: "noah",
      },
    ],
    photos: [photo("cafe-window"), photo("cafe-friends"), photo("dessert")],
  },
  {
    id: "bowling-night",
    title: "Bowling night",
    area: "games",
    date: "2026-10-10",
    place: "Mission Bowling Club",
    addedBy: "harry",
    who: ["harry", "john", "daniel", "noah"],
    story: "Harry bowled a 180 and has mentioned it twice a day since.",
    quotes: [],
    photos: [photo("bowling-strike"), photo("bowling-pins")],
  },
  {
    id: "board-games",
    title: "Board games",
    area: "games",
    date: "2026-09-27",
    place: "John’s place",
    addedBy: "john",
    who: ["john", "daniel", "noah", "ysan"],
    story: "Catan, then a very long game of Codenames.",
    quotes: [],
    photos: [photo("boardgame-table"), photo("boardgame-play")],
  },
  {
    id: "stanley-park",
    title: "Stanley Park",
    area: "outdoors",
    date: "2026-09-21",
    place: "Stanley Park, Vancouver",
    addedBy: "sam",
    who: ["harry", "daniel", "sam", "noah"],
    story: "Seawall loop on rented bikes.",
    quotes: [],
    photos: [photo("seawall-sunset")],
  },
  {
    id: "karaoke-round-3",
    title: "Karaoke round 3",
    area: "karaoke",
    date: "2026-09-12",
    place: "Do Re Mi",
    addedBy: "john",
    who: ["harry", "john", "sam", "noah"],
    story: "Round three. We finally booked the big room.",
    quotes: [
      { id: "q-round3", text: "we are never doing ballads again", by: "harry" },
    ],
    photos: [photo("karaoke-lounge")],
  },
  {
    id: "escape-room",
    title: "Escape room",
    area: "games",
    date: "2026-08-15",
    place: "Escape SF",
    addedBy: "daniel",
    who: ["john", "daniel", "sam", "noah"],
    story: "We lost by two minutes.",
    quotes: [{ id: "q-escape", text: "the lock was rigged", by: "sam" }],
    photos: [photo("escape-entrance"), photo("escape-bulb")],
  },
  {
    id: "noahs-bday",
    title: "Noah’s b-day",
    area: "karaoke",
    date: "2026-07-18",
    place: "Do Re Mi",
    addedBy: "sam",
    who: everyone,
    story:
      "Birthday karaoke. Noah picked every third song and nobody complained.",
    quotes: [],
    photos: [photo("karaoke-singing")],
  },
  {
    id: "dolores-picnic",
    title: "Dolores picnic",
    area: "outdoors",
    date: "2026-06-14",
    place: "Dolores Park",
    addedBy: "ysan",
    who: everyone,
    story: "Ysan baked, Noah brought nothing, the sun showed up anyway.",
    quotes: [],
    photos: [photo("picnic-laughing"), photo("picnic-spread")],
  },
  {
    id: "sunrise-hike",
    title: "Sunrise hike",
    area: "outdoors",
    date: "2026-05-09",
    place: "Mount Tam",
    addedBy: "daniel",
    who: ["john", "daniel", "ysan"],
    story: "Alarm at 4:30. Worth it.",
    quotes: [],
    photos: [photo("hike-trail"), photo("hike-friends")],
  },
  {
    id: "dim-sum",
    title: "Dim sum",
    area: "food",
    date: "2026-03-08",
    place: "Yank Sing",
    addedBy: "noah",
    who: ["harry", "john", "noah", "ysan"],
    story: "Ordered too many har gow. No regrets.",
    quotes: [],
    photos: [photo("dimsum-table"), photo("dimsum-group")],
  },
  {
    id: "holiday-karaoke",
    title: "Holiday karaoke",
    area: "karaoke",
    date: "2025-12-19",
    place: "Do Re Mi",
    addedBy: "harry",
    who: everyone,
    story:
      "Six of us, one mic that kept cutting out, and a duet nobody asked for.",
    quotes: [{ id: "q-holiday", text: "one more song, I promise", by: "ysan" }],
    photos: [photo("karaoke-couch")],
  },
  {
    id: "ocean-beach-bonfire",
    title: "Ocean Beach bonfire",
    area: "outdoors",
    date: "2025-10-24",
    place: "Ocean Beach Fire Pits",
    addedBy: "sam",
    who: ["harry", "john", "daniel", "sam", "noah"],
    story: "S’mores, a borrowed guitar and one very determined seagull.",
    quotes: [
      {
        id: "q-bonfire",
        text: "this is the best night of the year, I’m calling it",
        by: "sam",
      },
    ],
    photos: [
      photo("bonfire-shore"),
      photo("bonfire-night"),
      photo("bonfire-setup"),
      photo("hike-sunset"),
    ],
  },
]

export type Venue = {
  id: string
  title: string
  /** Matches existing lore with this word in the title or the same venue. */
  keyword: string
  venue: string
  day: Day
  time: string
  conditions: string
  note?: string
  price: Price
  maxTravelMin: number
  photo: string
  area: string
}

/** Places the group agent can propose. Travel minutes are the worst case across members. */
export const VENUES: Venue[] = [
  {
    id: "mini-golf",
    title: "Mini golf",
    keyword: "golf",
    venue: "Urban Putt",
    day: "Sat",
    time: "3:00 pm",
    conditions: "indoor, rain likely",
    note: "Dry and cozy if it rains",
    price: "$$",
    maxTravelMin: 36,
    photo: photo("minigolf-course"),
    area: "games",
  },
  {
    id: "bouldering",
    title: "Bouldering session",
    keyword: "boulder",
    venue: "Mission Cliffs",
    day: "Sun",
    time: "2:00 pm",
    conditions: "indoor, 17°C and dry",
    price: "$$",
    maxTravelMin: 28,
    photo: photo("bouldering-wall"),
    area: "active",
  },
  {
    id: "karaoke-room",
    title: "Karaoke room",
    keyword: "karaoke",
    venue: "Do Re Mi",
    day: "Sat",
    time: "6:00 pm",
    conditions: "indoor",
    price: "$",
    maxTravelMin: 32,
    photo: photo("karaoke-lounge"),
    area: "karaoke",
  },
  {
    id: "bonfire",
    title: "Ocean Beach bonfire",
    keyword: "bonfire",
    venue: "Ocean Beach Fire Pits",
    day: "Sat",
    time: "5:30 pm",
    conditions: "clear, 14°C at sunset",
    price: "$",
    maxTravelMin: 30,
    photo: photo("bonfire-shore"),
    area: "outdoors",
  },
  {
    id: "picnic",
    title: "Dolores picnic",
    keyword: "picnic",
    venue: "Dolores Park",
    day: "Sun",
    time: "12:00 pm",
    conditions: "sunny, 19°C",
    price: "Free",
    maxTravelMin: 18,
    photo: photo("picnic-laughing"),
    area: "outdoors",
  },
  {
    id: "hike",
    title: "Sunrise hike",
    keyword: "hike",
    venue: "Lands End Trail",
    day: "Sun",
    time: "7:00 am",
    conditions: "dry, 12°C at sunrise",
    price: "Free",
    maxTravelMin: 25,
    photo: photo("hike-trail"),
    area: "outdoors",
  },
  {
    id: "dim-sum",
    title: "Dim sum brunch",
    keyword: "dim sum",
    venue: "Yank Sing",
    day: "Sun",
    time: "11:00 am",
    conditions: "indoor",
    price: "$$",
    maxTravelMin: 22,
    photo: photo("dimsum-table"),
    area: "food",
  },
  {
    id: "board-games",
    title: "Board games",
    keyword: "board game",
    venue: "Game Parlor",
    day: "Fri",
    time: "7:00 pm",
    conditions: "indoor",
    price: "$",
    maxTravelMin: 20,
    photo: photo("boardgame-table"),
    area: "games",
  },
  {
    id: "bowling",
    title: "Bowling night",
    keyword: "bowling",
    venue: "Mission Bowling Club",
    day: "Fri",
    time: "8:00 pm",
    conditions: "indoor",
    price: "$$",
    maxTravelMin: 24,
    photo: photo("bowling-strike"),
    area: "games",
  },
  {
    id: "escape-room",
    title: "Escape room rematch",
    keyword: "escape",
    venue: "Escape SF",
    day: "Sat",
    time: "4:00 pm",
    conditions: "indoor",
    price: "$$",
    maxTravelMin: 26,
    photo: photo("escape-entrance"),
    area: "games",
  },
]

export const SEED_PROFILES: Record<PersonId, Profile> = {
  john: {
    id: "john",
    fullName: "John Surge",
    age: 23,
    city: "San Francisco",
    aka: "El Capitan",
    vibes: ["Down for food", "Free late-night"],
    hobbies: ["Gaming", "Hiking", "Coding", "Travel"],
    activity: "Playing Figma",
    meme: photo("meme-cat"),
    photo: asset("assets/people/john.jpg"),
    groups: [
      { name: "The Wizards Pit", days: 67 },
      { name: "The Roundtable", days: 23 },
    ],
    knownAs: [
      { name: "El Capitan", group: "The Roundtable", from: "sam" },
      { name: "Water guzzler", group: "The Roundtable", from: "harry" },
    ],
  },
  harry: {
    id: "harry",
    fullName: "Harry Lim",
    age: 24,
    city: "San Francisco",
    aka: "Mic Drop",
    vibes: ["Always down for karaoke", "Early bird"],
    hobbies: ["Karaoke", "Bowling", "Cooking"],
    activity: "Learning ukulele",
    photo: asset("assets/people/harry.jpg"),
    groups: [{ name: "The Wizards Pit", days: 67 }],
    knownAs: [{ name: "Mic Drop", group: "The Wizards Pit", from: "noah" }],
  },
  daniel: {
    id: "daniel",
    fullName: "Daniel Okafor",
    age: 23,
    city: "Oakland",
    aka: "Clue Master",
    vibes: ["Plans the route", "Free weekends"],
    hobbies: ["Hiking", "Puzzles", "Photography"],
    activity: "Editing hike photos",
    photo: asset("assets/people/daniel.jpg"),
    groups: [{ name: "The Wizards Pit", days: 67 }],
    knownAs: [{ name: "Clue Master", group: "The Wizards Pit", from: "sam" }],
  },
  sam: {
    id: "sam",
    fullName: "Sam Reyes",
    age: 22,
    city: "San Francisco",
    aka: "Seagull whisperer",
    vibes: ["Down for anything outdoors", "Free late-night"],
    hobbies: ["Climbing", "Guitar", "Travel"],
    activity: "Practicing guitar",
    photo: asset("assets/people/sam.jpg"),
    groups: [
      { name: "The Wizards Pit", days: 67 },
      { name: "The Roundtable", days: 23 },
    ],
    knownAs: [
      { name: "Seagull whisperer", group: "The Wizards Pit", from: "harry" },
    ],
  },
  noah: {
    id: "noah",
    fullName: "Noah Park",
    age: 23,
    city: "Daly City",
    aka: "Birthday boy",
    vibes: ["Down for food", "Night owl"],
    hobbies: ["Gaming", "Karaoke", "Cooking"],
    activity: "Playing Mario Kart",
    photo: asset("assets/people/noah.jpg"),
    groups: [{ name: "The Wizards Pit", days: 67 }],
    knownAs: [{ name: "Birthday boy", group: "The Wizards Pit", from: "ysan" }],
  },
  ysan: {
    id: "ysan",
    fullName: "Ysan Tran",
    age: 22,
    city: "San Francisco",
    aka: "Picnic planner",
    vibes: ["Weekends only", "Down for food"],
    hobbies: ["Hiking", "Baking", "Photography"],
    activity: "Baking sourdough",
    photo: asset("assets/people/ysan.jpg"),
    groups: [{ name: "The Wizards Pit", days: 58 }],
    knownAs: [
      { name: "Picnic planner", group: "The Wizards Pit", from: "daniel" },
    ],
  },
}

export const SEED_LIMITS: Limits = {
  budget: 25,
  noAlcohol: true,
  homeBy: "11:00 pm",
  travelMin: 30,
  notes: "vegetarian",
  calendar: "connected",
  homeArea: "Mission, SF",
}

export const SEED_KEEPER_THREAD: ChatMessage[] = [
  {
    id: "k-hello",
    kind: "text",
    from: "agent",
    text: "I’m Lore Keeper, The Wizards Pit’s group agent. Ask me to plan something and I’ll check calendars and everyone’s limits privately, then bring back three options to vote on.",
  },
]

/** "13 ASI:One · my private agent" — the pairing conversation John already had. */
export const SEED_AGENT_THREAD: ChatMessage[] = [
  { id: "a1", kind: "text", from: "me", text: "pair K7Q2M9" },
  {
    id: "a2",
    kind: "text",
    from: "agent",
    text: "Paired — I’m your private agent now. Tell me your limits in plain words.",
  },
  {
    id: "a3",
    kind: "text",
    from: "me",
    text: "budget $25, no alcohol, home by 11, max 30 min travel. vegetarian",
  },
  {
    id: "a4",
    kind: "agent-card",
    text: "Here’s what I’ll keep private: budget up to $25/person · no alcohol-centric plans · home by 11:00 pm · travel up to 30 min · notes: vegetarian · calendar: not connected. Say ‘fix: …’ to change it.",
  },
  { id: "a5", kind: "text", from: "me", text: "calendar [secret iCal URL]" },
  {
    id: "a6",
    kind: "text",
    from: "agent",
    text: "Got it. I only read busy times, never event titles.",
  },
  { id: "a7", kind: "text", from: "me", text: "home Mission" },
  {
    id: "a8",
    kind: "text",
    from: "agent",
    text: "Home area set to Mission, SF (rounded to about 1 km). Only travel minutes are shared.",
  },
]
