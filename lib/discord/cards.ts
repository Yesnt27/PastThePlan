import { MAJORITY, tally } from "@/client/agent/planner"
import { GROUP, SEED_PEOPLE } from "@/client/data/seed"
import type { Plan } from "@/client/data/types"

/** The Discord twin of the in-app vote carousel: one embed, numbered buttons, a live tally. */
export function voteCard(plan: Plan, intro?: string) {
  const counts = tally(plan)
  const voted = Object.keys(plan.votes).length
  const locked = plan.status === "locked" ? plan.options.find((o) => o.id === plan.lockedOptionId) : undefined
  const lead = plan.options.reduce<{ id: string; n: number } | null>((best, o) => ((counts[o.id] ?? 0) > (best?.n ?? 0) ? { id: o.id, n: counts[o.id] ?? 0 } : best), null)
  const majority = lead && lead.n >= MAJORITY ? plan.options.find((o) => o.id === lead.id) : undefined
  const embed = {
    title: locked ? `Locked in: ${locked.title}` : "This weekend · pick one",
    description: [
      intro,
      locked
        ? `${locked.day} ${locked.time} at ${locked.venue}. Claim a task in the book.`
        : majority
          ? `**${majority.title}** has a majority. The planner confirms with “lock it in”.`
          : `${voted}/${GROUP.size} voted · ${MAJORITY} votes for one option settles it.`,
    ].filter(Boolean).join("\n\n"),
    color: 0x2457c5,
    fields: plan.options.map((o, i) => ({
      name: `${i + 1}. ${o.title} · ${o.day} ${o.time}`,
      value: [`${o.venue} · ${o.price} · max ${o.maxTravelMin} min for anyone`, o.conditions, o.badges.join(" · "), `**${counts[o.id] ?? 0}** vote${(counts[o.id] ?? 0) === 1 ? "" : "s"}`].filter(Boolean).join("\n"),
    })),
    footer: { text: "FGL · Lore Keeper checked calendars and everyone’s private limits. Details stay private." },
  }
  const buttons = plan.options.map((o, i) => ({ type: 2, style: 1, label: `${i + 1} · ${o.title}`.slice(0, 80), custom_id: `vote:${plan.id}:${o.id}`, disabled: !!locked }))
  buttons.push({ type: 2, style: 2, label: "Can’t make it", custom_id: `vote:${plan.id}:none`, disabled: !!locked })
  const voters = Object.entries(plan.votes).filter(([, v]) => v).map(([p]) => SEED_PEOPLE[p]?.name ?? p)
  if (voters.length) embed.footer.text = `Voted: ${voters.join(", ")} · ` + embed.footer.text
  return { embeds: [embed], components: [{ type: 1, components: buttons.slice(0, 5) }] }
}
