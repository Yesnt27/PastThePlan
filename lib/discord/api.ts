const API = "https://discord.com/api/v10"

export async function editOriginal(token: string, body: unknown) {
  const app = process.env.DISCORD_APPLICATION_ID
  await fetch(`${API}/webhooks/${app}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function followUp(token: string, body: unknown) {
  const app = process.env.DISCORD_APPLICATION_ID
  await fetch(`${API}/webhooks/${app}/${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

export const COMMANDS = [
  { name: "plan", description: "Lore Keeper drafts three options for this weekend", options: [{ type: 3, name: "request", description: "e.g. something outdoors, cheap, do bonfire again", required: false }] },
  { name: "ask", description: "Ask the lore (answers only from what was added, quotes word for word)", options: [{ type: 3, name: "question", description: "e.g. who came to bowling?", required: true }] },
  { name: "limits", description: "Tell your private agent your limits. Only you see this." },
  { name: "iam", description: "Link your Discord account to your page in the book", options: [{ type: 3, name: "member", description: "who you are in the book", required: true, choices: ["harry", "john", "daniel", "sam", "noah", "ysan"].map((v) => ({ name: v[0].toUpperCase() + v.slice(1), value: v })) }] },
]
