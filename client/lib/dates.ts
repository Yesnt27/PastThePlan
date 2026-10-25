const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

/** Parses yyyy-mm-dd at local noon so formatting never slips a day across time zones. */
export const parseDay = (iso: string) => new Date(`${iso}T12:00:00`)

export const toISODay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** "Oct 10" */
export const fmtShort = (iso: string) => {
  const d = parseDay(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** "Oct 24, 2025" */
export const fmtLong = (iso: string) =>
  `${fmtShort(iso)}, ${parseDay(iso).getFullYear()}`

/** "Sat Oct 31, 2026" */
export const fmtWithDay = (iso: string) =>
  `${DAYS[parseDay(iso).getDay()]} ${fmtLong(iso)}`

export const monthName = (iso: string) => MONTHS_LONG[parseDay(iso).getMonth()]

export const dayName = (short: string) =>
  DAYS_LONG[DAYS.indexOf(short)] ?? short

export const daysBetween = (fromISO: string, toISO: string) =>
  Math.round(
    (parseDay(toISO).getTime() - parseDay(fromISO).getTime()) / 86_400_000,
  )

/** "today", "tomorrow", "in 7 days", "3 days ago" */
export const relativeDays = (iso: string, today: string) => {
  const n = daysBetween(today, iso)
  if (n === 0) return "today"
  if (n === 1) return "tomorrow"
  if (n === -1) return "yesterday"
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

/** Meteorological seasons; December counts toward the following winter. */
export const seasonOf = (iso: string) => {
  const d = parseDay(iso)
  const m = d.getMonth()
  const y = d.getFullYear()
  if (m === 11)
    return { key: `${y + 1}-0`, label: `Winter ${y}–${String(y + 1).slice(2)}` }
  if (m <= 1)
    return { key: `${y}-0`, label: `Winter ${y - 1}–${String(y).slice(2)}` }
  if (m <= 4) return { key: `${y}-1`, label: `Spring ${y}` }
  if (m <= 7) return { key: `${y}-2`, label: `Summer ${y}` }
  return { key: `${y}-3`, label: `Fall ${y}` }
}
