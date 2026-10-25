import { z } from "zod"
import type { PlanOption } from "@/client/data/types"
import { GROUP_ID } from "@/lib/server/identity"
import { areaStats, askLore, checkIdea, loadLore, onThisDay, planOptions } from "./book"
import { availability, checkOptions, loadHeld } from "./member"
import { weekendWeather } from "./world"

type Server = {
  registerTool: (
    name: string,
    def: { title?: string; description: string; inputSchema: z.ZodType },
    cb: (args: never) => Promise<{ content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown> }>,
  ) => void
}

const out = (v: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v) }],
  structuredContent: (v && typeof v === "object" && !Array.isArray(v) ? v : { result: v }) as Record<string, unknown>,
})

/** book: everything the whole group can already see. */
export function registerBook(server: Server) {
  server.registerTool("search_lore", { description: "Search the group’s lore (past hangouts) by words. Returns ids, titles, dates, places, areas and who came.", inputSchema: z.object({ query: z.string() }) },
    (async ({ query }: { query: string }) => {
      const q = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2)
      const lore = await loadLore(GROUP_ID)
      const hits = lore.filter((p) => q.some((w) => `${p.title} ${p.place} ${p.area} ${p.story ?? ""}`.toLowerCase().includes(w)))
      return out(hits.slice(0, 8).map(({ id, title, date, place, area, who }) => ({ id, title, date, place, area, who })))
    }) as never)
  server.registerTool("ask_lore", { description: "Answer a question about the group’s past ONLY from saved lore. Quotes are verbatim and cited. Returns found=false honestly when nobody added it.", inputSchema: z.object({ question: z.string(), scopeId: z.string().optional() }) },
    (async ({ question, scopeId }: { question: string; scopeId?: string }) => out(await askLore(GROUP_ID, question, scopeId))) as never)
  server.registerTool("on_this_day", { description: "Lore from this calendar day in earlier years.", inputSchema: z.object({}) },
    (async () => out(await onThisDay(GROUP_ID))) as never)
  server.registerTool("area_stats", { description: "How many hangouts per area and when the last one was.", inputSchema: z.object({}) },
    (async () => out(await areaStats(GROUP_ID))) as never)
  server.registerTool("plan_options", { description: "Draft three options for this weekend. Internally checks calendars and everyone’s private limits through the member server (aggregates only), live weather, travel and novelty. Returns options with badges plus counts of ideas considered and ideas that did not fit everyone.", inputSchema: z.object({ request: z.string(), sourceLoreId: z.string().optional() }) },
    (async ({ request, sourceLoreId }: { request: string; sourceLoreId?: string }) => out(await planOptions(GROUP_ID, request, sourceLoreId))) as never)
  server.registerTool("check_idea", { description: "Whether one specific idea (e.g. ‘the rooftop bar’) fits everyone this weekend. Yes/no only, never who or why.", inputSchema: z.object({ idea: z.string() }) },
    (async ({ idea }: { idea: string }) => out(await checkIdea(GROUP_ID, idea))) as never)
}

/** member (group side): aggregate answers only. Owner tools live behind the member agent route. */
export function registerMember(server: Server) {
  server.registerTool("availability", { description: "How many members are free on each weekend day. Counts only.", inputSchema: z.object({}) },
    (async () => out(availability(await loadHeld(GROUP_ID), ["Fri", "Sat", "Sun"]))) as never)
  server.registerTool("check_options", { description: "For each option: fitsEveryone (yes/no) and fitCount (hidden under 3 people). Never names or reasons.", inputSchema: z.object({ options: z.array(z.object({ id: z.string(), day: z.enum(["Fri", "Sat", "Sun"]), time: z.string(), price: z.string(), maxTravelMin: z.number(), alcoholCentric: z.boolean().optional() })) }) },
    (async ({ options }: { options: PlanOption[] }) => out(checkOptions(await loadHeld(GROUP_ID), options))) as never)
}

/** world: public live context. */
export function registerWorld(server: Server) {
  server.registerTool("weather", { description: "Weekend forecast (Fri–Sun) from Open-Meteo: rain probability and temperatures.", inputSchema: z.object({}) },
    (async () => out(await weekendWeather())) as never)
}
