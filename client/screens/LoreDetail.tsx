import { useRef, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { lockedOption } from "../agent/planner"
import { nameOf } from "../agent/text"
import { ME, TODAY } from "../data/seed"
import type { LorePiece, Tint } from "../data/types"
import { fmtWithDay, relativeDays } from "../lib/dates"
import { useStore } from "../state/store"
import { Icon } from "../ui/Icon"
import { AgentBox, Button, NameTag, Photo, Pill, SectionLabel } from "../ui/kit"
import { NotFound } from "./NotFound"

/** "Teach me this chapter", reworked as a three-step walkthrough of a lore piece. */
const STEPS = [
  {
    target: "photos",
    title: "What happened",
    body: (p: LorePiece) =>
      `This is ${p.title} — ${fmtWithDay(p.date)} at ${p.place}.`,
  },
  {
    target: "words",
    title: "In their words",
    body: (p: LorePiece) =>
      p.quotes.length
        ? "Quotes are saved exactly as they were typed. Nobody, including the agent, can reword them."
        : "The story is kept in the words of whoever added it.",
  },
  {
    target: "people",
    title: "Who was there",
    body: (p: LorePiece) =>
      `${nameOf(p.addedBy)} added this to the lore. ${p.who.length} of you were there.`,
  },
] as const

export function LoreDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { lore, people, areas, plans } = useStore()
  const piece = lore.find((p) => p.id === id)
  const [slide, setSlide] = useState(0)
  const strip = useRef<HTMLDivElement>(null)
  if (!piece) return <NotFound what="That lore piece isn’t in the book." />

  const area = areas[piece.area]
  const plan = piece.planId
    ? plans.find((p) => p.id === piece.planId)
    : undefined
  const planTitle = plan ? lockedOption(plan)?.title : undefined
  const tourStep = Number(params.get("tour") ?? 0)
  const step =
    tourStep >= 1 && tourStep <= STEPS.length ? STEPS[tourStep - 1] : undefined
  const setTour = (n?: number) => {
    const next = new URLSearchParams(params)
    if (n) next.set("tour", String(n))
    else next.delete("tour")
    setParams(next, { replace: true })
  }
  const ring = (target: string) =>
    step?.target === target
      ? "rounded-2xl outline outline-[3px] outline-offset-4 outline-plezi"
      : ""

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <article className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5 pl-6 pr-4 pt-2">
        <div className={`animate-page-in ${ring("photos")}`}>
          {piece.photos.length ? (
            <div className="relative">
              <div
                ref={strip}
                className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto"
                onScroll={(e) =>
                  setSlide(
                    Math.round(
                      e.currentTarget.scrollLeft / e.currentTarget.clientWidth,
                    ),
                  )
                }
              >
                {piece.photos.map((src, i) => (
                  <figure
                    key={src + i}
                    className="w-full shrink-0 snap-center rounded-2xl border-[1.5px] border-ink bg-white p-2 shadow-offset-sm"
                  >
                    <img
                      src={src}
                      alt={`${piece.title}, photo ${i + 1} of ${piece.photos.length}`}
                      className="aspect-[4/3] w-full rounded-xl object-cover"
                      draggable={false}
                    />
                  </figure>
                ))}
              </div>
              {piece.photos.length > 1 && (
                <p className="absolute bottom-4 right-4 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-semibold text-white">
                  photo · {slide + 1} / {piece.photos.length}
                </p>
              )}
            </div>
          ) : (
            <Photo
              alt={`${piece.title} has no photos yet`}
              tint={(area?.tint ?? "yellow") as Tint}
              label="no photos yet"
              className="aspect-[4/3] w-full rounded-2xl border-[1.5px] border-line"
            />
          )}

          <h1 className="mt-4 text-[28px] font-extrabold uppercase leading-[1.05] text-ink">
            {piece.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {fmtWithDay(piece.date)} · {piece.place} · added by{" "}
            {nameOf(piece.addedBy)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {area && (
              <Link to={`/board?area=${area.id}`}>
                <Pill>{area.label}</Pill>
              </Link>
            )}
            <Pill>{relativeDays(piece.date, TODAY)}</Pill>
            {planTitle && <Pill agent>From the plan: {planTitle}</Pill>}
          </div>
        </div>

        <section
          className={`mt-5 ${ring("people")}`}
          aria-labelledby="who-came"
        >
          <SectionLabel>
            <span id="who-came">Who came</span>
          </SectionLabel>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {piece.who.map((pid) => (
              <li key={pid}>
                <Link
                  to={pid === ME ? "/me" : `/people/${pid}`}
                  className="block rounded-full transition-transform hover:-translate-y-0.5"
                >
                  <NameTag person={people[pid]} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className={`mt-5 ${ring("words")}`}>
          <SectionLabel>The story</SectionLabel>
          {piece.story ? (
            <p className="mt-2 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-[15px] leading-[1.45] text-ink">
              {piece.story}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {nameOf(piece.addedBy)} didn’t write a story — just what was said.
            </p>
          )}

          <SectionLabel className="mt-5" aside="saved word for word">
            Quotes
          </SectionLabel>
          {piece.quotes.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {piece.quotes.map((q) => (
                <li key={q.id}>
                  <AgentBox className="px-3 py-2.5">
                    <p className="text-[15px] leading-snug text-ink">
                      “{q.text}”{" "}
                      <span className="whitespace-nowrap">
                        — {nameOf(q.by)}
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                      <Icon name="lock" size={12} /> Saved as typed · can’t be
                      edited
                    </p>
                  </AgentBox>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              No quotes saved. Add one by editing this lore.
            </p>
          )}
        </div>

        {!step && (
          <button
            onClick={() => setTour(1)}
            className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-plezi underline-offset-2 hover:underline"
          >
            Walk me through this lore <Icon name="chevronRight" size={16} />
          </button>
        )}
      </article>

      {step ? (
        <div className="shrink-0 px-5 pb-1 pt-2">
          <AgentBox className="animate-pop-in p-3.5" as="aside">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Step {tourStep} of {STEPS.length} · {step.title}
            </p>
            <p className="mt-1 text-[15px] leading-snug text-ink">
              {step.body(piece)}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                tone="secondary"
                className="h-10 flex-1 text-sm"
                onClick={() => setTour(tourStep > 1 ? tourStep - 1 : undefined)}
              >
                {tourStep > 1 ? "Back" : "Close"}
              </Button>
              {tourStep < STEPS.length ? (
                <Button
                  className="h-10 flex-1 text-sm"
                  onClick={() => setTour(tourStep + 1)}
                >
                  Got it
                </Button>
              ) : (
                <Button
                  className="h-10 flex-1 text-sm"
                  onClick={() => navigate(`/keeper?again=${piece.id}`)}
                >
                  What should we do next?
                </Button>
              )}
            </div>
          </AgentBox>
        </div>
      ) : (
        <div className="flex shrink-0 gap-2 px-5 pb-1 pt-2">
          <Button
            tone="agent"
            icon="search"
            className="flex-1 px-3"
            onClick={() => navigate(`/ask?about=${piece.id}`)}
          >
            Ask about this
          </Button>
          <Button
            className="flex-1 px-3"
            onClick={() => navigate(`/keeper?again=${piece.id}`)}
          >
            Do it again
          </Button>
        </div>
      )}
    </div>
  )
}
