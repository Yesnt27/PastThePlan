import { createMcpHandler } from "mcp-handler"
import { registerBook, registerMember, registerWorld } from "@/lib/fgl/mcp-servers"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const handlers = {
  book: createMcpHandler((s) => registerBook(s as never), { serverInfo: { name: "fgl-book", version: "0.2.0" } }),
  member: createMcpHandler((s) => registerMember(s as never), { serverInfo: { name: "fgl-member", version: "0.2.0" } }),
  world: createMcpHandler((s) => registerWorld(s as never), { serverInfo: { name: "fgl-world", version: "0.2.0" } }),
}

async function handle(req: Request, ctx: { params: Promise<{ server: string }> }) {
  const { server } = await ctx.params
  const h = handlers[server as keyof typeof handlers]
  if (!h) return new Response("unknown server", { status: 404 })
  const token = process.env.FGL_MCP_SERVICE_TOKEN
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`)
    return new Response("unauthorized", { status: 401 })
  return h(req)
}

export { handle as GET, handle as POST, handle as DELETE }
