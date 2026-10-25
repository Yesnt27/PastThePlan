import { MAJORITY, tally } from "@/client/agent/planner"
import { GROUP, SEED_PEOPLE } from "@/client/data/seed"
import type { Plan } from "@/client/data/types"
import { dayName, fmtShort } from "@/client/lib/dates"

const name = (id?: string) => (id ? SEED_PEOPLE[id]?.name ?? id : "Someone")
const NUM = ["1️⃣", "2️⃣", "3️⃣"]

/**
 * The plan post, in the layout of the example in #plans: request, window, agents asked,
 * re-include, windows found, ideas checked, top 3, votes, lock, recap. Buttons vote.
 */
export function voteCard(plan: Plan, intro?: string) {
  const counts = tally(plan)
  const m = plan.meta
  const locked = plan.status === "locked" || plan.status === "done" ? plan.options.find((o) => o.id === plan.lockedOptionId) : undefined
  const ranked = [...plan.options].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
  const lead = ranked[0]
  const majority = lead && (counts[lead.id] ?? 0) >= MAJORITY ? lead : undefined
  const voted = Object.keys(plan.votes).length

  const lines: string[] = []
  lines.push(`**Request:** ${name(m?.requestedBy)}: “${plan.request}”`)
  lines.push(`**Window:** Fri 5 pm → Sun 10 pm${m?.askedOn ? ` · **Asked on:** ${fmtShort(m.askedOn)}` : ""}`)
  if (m) {
    lines.push(`**Agents asked:** ${m.agents} of ${GROUP.size} answered privately (free times + fits / doesn’t fit only, no reasons)`)
    if (m.reinclude)
      lines.push(`**Re-include:** ${m.reinclude === 1 ? "someone who" : `${m.reinclude} people who`} missed most of the last hangouts, so every window had to work for them`)
    if (m.windows.length)
      lines.push(`**Time windows found:** ${m.windows.map((w) => `${dayName(w.day)} (${w.free}/${GROUP.size} free)`).join(" · ")}`)
    lines.push(`**Ideas checked:** ${m.checked} sent to everyone’s agent → ${m.passed} passed (any “no” drops an idea)`)
  }
  if (intro) lines.push("", intro)

  const optionLines = plan.options.map((o, i) =>
    `${NUM[i] ?? `${i + 1}.`} **${o.title}** · ${o.venue} · ${o.day} ${o.time}\n` +
    `   ${o.conditions} · ${o.price} · max ${o.maxTravelMin} min travel · ${o.badges.join(" · ")}`,
  )

  const voteLine = (() => {
    const byOption = plan.options
      .map((o) => ({ o, who: Object.entries(plan.votes).filter(([, v]) => v === o.id).map(([p]) => name(p)) }))
      .filter((x) => x.who.length)
    if (!byOption.length) return `**Votes:** 0/${GROUP.size} · ${MAJORITY} votes for one option settles it`
    return "**Votes:** " + byOption.map((x) => `${x.who.join(", ")} → ${x.o.title} (${x.who.length}/${GROUP.size}${x.o === majority ? ", majority ✅" : ""})`).join(" · ") +
      (voted - byOption.reduce((n, x) => n + x.who.length, 0) > 0 ? ` · ${voted - byOption.reduce((n, x) => n + x.who.length, 0)} can’t make it` : "")
  })()

  const tail: string[] = [voteLine]
  if (locked) {
    tail.push("", `🔒 **Locked in: ${locked.title}**`, `📅 ${dayName(locked.day)} ${fmtShort(locked.date)}, ${locked.time} · 📍 ${locked.venue}`)
    const coming = Object.entries(plan.votes).filter(([, v]) => v).map(([p]) => name(p))
    if (coming.length) tail.push(`👥 ${coming.join(", ")}`)
  } else if (majority) {
    tail.push(`${majority.title} has a majority. Tap 🔒 to lock it in.`)
  }

  const embed = {
    title: locked ? `📋 Lore Keeper · locked in` : `📋 Lore Keeper · this weekend`,
    description: [lines.join("\n"), "", "**Top 3 options**", optionLines.join("\n"), "", tail.join("\n")].join("\n").slice(0, 4000),
    color: 0x2457c5,
    footer: { text: "FGL · checked privately with everyone’s agent. Details stay private." },
  }
  const row = plan.options.map((o, i) => ({ type: 2, style: 1, label: `${i + 1} · ${o.title}`.slice(0, 80), custom_id: `vote:${plan.id}:${o.id}`, disabled: !!locked }))
  row.push({ type: 2, style: 2, label: "Can’t make it", custom_id: `vote:${plan.id}:none`, disabled: !!locked })
  const components: unknown[] = [{ type: 1, components: row.slice(0, 5) }]
  if (majority && !locked) components.push({ type: 1, components: [{ type: 2, style: 3, label: `🔒 Lock in ${majority.title}`.slice(0, 80), custom_id: `lock:${plan.id}` }] })
  return { embeds: [embed], components }
}

export function recapPost(title: string, story: string, quotes: { text: string; by: string }[]) {
  return {
    embeds: [{
      title: `📖 Recap draft · ${title}`,
      description: [story, ...quotes.map((q) => `> “${q.text}” — ${q.by}`)].join("\n").slice(0, 4000),
      color: 0x2457c5,
      footer: { text: "Your words, exactly as sent. Add photos and who came in the book, then add it to the lore." },
    }],
  }
}
