import { createMCPClient } from "@ai-sdk/mcp"
import { generateText, stepCountIs, tool, type ToolSet } from "ai"
import { z } from "zod"
import type { LoreAnswer, PlanOption } from "@/client/data/types"
import { GROUP_ID } from "@/lib/server/identity"
import { askLore, checkIdea, planOptions, type PlanDraft } from "./book"

export const SMART = process.env.FGL_MODEL_SMART || "anthropic/claude-sonnet-5.5"

const SYSTEM = `You are Lore Keeper, the group agent for "The Wizards Pit", a friend group. You plan hangouts and keep their lore.
Rules:
- To plan anything, call plan_options exactly once with the person's request (and sourceLoreId if given). Then write ONE short message (2–3 sentences, no lists, no markdown) introducing the options: mention live context that matters (weather, how many are free) and that everything was checked against everyone's calendars and private limits. Do not restate each option; the app shows them as cards.
- For questions about the past, call ask_lore and answer briefly. Never invent or paraphrase quotes; the app shows the cited answer.
- If someone asks why an idea wasn't suggested, call check_idea. If it doesn't fit everyone, say only "It didn't fit everyone this time" plus an offer to look for something similar. Never guess or mention budgets, drinking, curfews, diets, homes, calendars or any person's reasons.
- You never speak for any friend, never reveal who has a limit, and never address people by name.`

async function mcpTools(base: string, token: string): Promise<{ tools: ToolSet; close: () => Promise<void> } | null> {
  try {
    const book = await createMCPClient({ transport: { type: "http", url: `${base}/api/mcp/book`, headers: { Authorization: `Bearer ${token}` } } })
    const tools = (await book.tools()) as ToolSet
    const keep = ["plan_options", "ask_lore", "check_idea", "on_this_day", "area_stats", "search_lore"]
    return { tools: Object.fromEntries(Object.entries(tools).filter(([k]) => keep.includes(k))) as ToolSet, close: () => book.close() }
  } catch {
    return null
  }
}

/** Same tools in-process, used when MCP isn't reachable (local dev, protected previews). */
function localTools(): ToolSet {
  return {
    plan_options: tool({ description: "Draft three options for this weekend (checks calendars and private limits as aggregates).", inputSchema: z.object({ request: z.string(), sourceLoreId: z.string().optional() }), execute: async ({ request, sourceLoreId }) => planOptions(GROUP_ID, request, sourceLoreId) }),
    ask_lore: tool({ description: "Answer from saved lore only, verbatim cited quotes.", inputSchema: z.object({ question: z.string(), scopeId: z.string().optional() }), execute: async ({ question, scopeId }) => askLore(GROUP_ID, question, scopeId) }),
    check_idea: tool({ description: "Yes/no: does one idea fit everyone this weekend.", inputSchema: z.object({ idea: z.string() }), execute: async ({ idea }) => checkIdea(GROUP_ID, idea) }),
  }
}

function parseResult(output: unknown): unknown {
  if (!output || typeof output !== "object") return output
  const o = output as { structuredContent?: unknown; content?: { type: string; text?: string }[] }
  if (o.structuredContent) return o.structuredContent
  const t = o.content?.find((c) => c.type === "text")?.text
  if (t) {
    try {
      return JSON.parse(t)
    } catch {
      return t
    }
  }
  return output
}

export type KeeperReply = {
  text: string
  draft?: PlanDraft
  answer?: LoreAnswer
  via: "mcp" | "local"
  toolCalls: string[]
}

export async function runKeeper(input: { text: string; sourceLoreId?: string; me: string; base: string; model?: string }): Promise<KeeperReply> {
  const token = process.env.FGL_MCP_SERVICE_TOKEN
  const remote = token && process.env.AGENT_TOOLS !== "local" ? await mcpTools(input.base, token) : null
  const tools = remote?.tools ?? localTools()
  try {
    const res = await generateText({
      model: input.model || SMART,
      system: SYSTEM,
      prompt: `${input.me} says: ${input.text}${input.sourceLoreId ? `\n(Context: they started from lore piece id "${input.sourceLoreId}".)` : ""}`,
      tools,
      stopWhen: stepCountIs(4),
      maxOutputTokens: 2000,
    })
    const reply: KeeperReply = { text: res.text.trim(), via: remote ? "mcp" : "local", toolCalls: [] }
    for (const step of res.steps)
      for (const r of step.toolResults) {
        reply.toolCalls.push(r.toolName)
        const v = parseResult((r as { output?: unknown }).output)
        if (r.toolName === "plan_options") reply.draft = v as PlanDraft
        if (r.toolName === "ask_lore") reply.answer = v as LoreAnswer
      }
    return reply
  } finally {
    await remote?.close().catch(() => {})
  }
}

export type { PlanOption }
