import type { Day } from "@/client/data/types"
import { WEEKEND } from "@/client/agent/planner"

/** Open-Meteo (no key). San Francisco by default; the coarse group center replaces it later. */
export async function weekendWeather(lat = 37.7599, lon = -122.4148) {
  const days = Object.entries(WEEKEND) as [Day, string][]
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=America%2FLos_Angeles` +
    `&start_date=${days[0][1]}&end_date=${days[days.length - 1][1]}`
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) })
    if (!r.ok) throw new Error(String(r.status))
    const j = (await r.json()) as { daily: { time: string[]; precipitation_probability_max: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] } }
    const out: Record<string, { rain: number; high: number; low: number; source: string }> = {}
    j.daily.time.forEach((t, i) => {
      const day = days.find(([, d]) => d === t)?.[0]
      if (day)
        out[day] = {
          rain: j.daily.precipitation_probability_max[i] ?? 0,
          high: Math.round(j.daily.temperature_2m_max[i]),
          low: Math.round(j.daily.temperature_2m_min[i]),
          source: "open-meteo",
        }
    })
    return out
  } catch {
    return {} as Record<string, { rain: number; high: number; low: number; source: string }>
  }
}

export function describe(w: { rain: number; high: number } | undefined, indoor: boolean) {
  if (!w) return null
  const rainy = w.rain >= 50
  if (indoor) return rainy ? `indoor, rain likely (${w.rain}%)` : `indoor, ${w.high}°C`
  return rainy ? `outdoors, rain likely (${w.rain}%)` : `${w.rain >= 25 ? "maybe showers" : "dry"}, ${w.high}°C`
}
