import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { lockedOption, optionMeta, tally, votedCount } from "../agent/planner"
import { GROUP, ME, PEOPLE_ORDER } from "../data/seed"
import type { ChatMessage, LorePiece, Plan, PlanOption } from "../data/types"
import { art } from "../lib/asset"
import { fmtWithDay } from "../lib/dates"
import { activePlan, useActions, useStore } from "../state/store"
import { AnswerView } from "../ui/Answer"
import {
  AgentCardBubble,
  Bubble,
  ChatHeader,
  Composer,
  QuickReplies,
  ResponsePill,
  SystemNote,
  Thread,
  Typing,
} from "../ui/chat"
import { Icon } from "../ui/Icon"
import { AgentBox, Button, ButtonLink, Pill } from "../ui/kit"
import { Sheet } from "../ui/Sheet"

export function Keeper() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { keeper, keeperBusy, plans, lore, people } = useStore()
  const actions = useActions()
  const input = useRef<HTMLInputElement>(null)

  // "Do it again" arrives as ?again=<lore id>: the request is pre-written, with that lore as context.
  const againId = params.get("again")
  const againPiece = againId ? lore.find((p) => p.id === againId) : undefined
  const compose = params.get("compose")
  // A reconnect nudge arrives as ?with=<person>: “Something this weekend with Sam”.
  const withId = params.get("with")
  const withName = withId ? people[withId as keyof typeof people]?.name : undefined
  const [context, setContext] = useState<string | undefined>(againPiece?.id)
  const [text, setText] = useState(() =>
    againPiece ? `Do ${againPiece.title} again` : withName ? `Something this weekend with ${withName}` : "",
  )
  useEffect(() => {
    if (againPiece) {
      setContext(againPiece.id)
      setText(`Do ${againPiece.title} again`)
    } else if (withName) setText(`Something this weekend with ${withName}`)
    if (againPiece || compose || withName) input.current?.focus()
    // Only when a new request arrives through the URL.
  }, [againId, compose, withId]) // eslint-disable-line react-hooks/exhaustive-deps

  const contextPiece = context ? lore.find((p) => p.id === context) : undefined
  const plan = activePlan(plans)
  const sheetPlan = plan ?? [...plans].reverse().find((p) => p.options.length)

  const clearParams = (...keys: string[]) => {
    const next = new URLSearchParams(params)
    keys.forEach((k) => next.delete(k))
    setParams(next, { replace: true })
  }

  const send = (value: string) => {
    actions.sendKeeper(value, { sourceLoreId: context })
    setText("")
    setContext(undefined)
    if (againId || compose || withId) clearParams("again", "compose", "with")
  }

  const pick = (chip: string) => {
    if (chip.endsWith(": ")) {
      setText(chip)
      input.current?.focus()
    } else send(chip)
  }

  const lastReview = [...keeper].reverse().find((m) => m.kind === "review")?.id
  const replies = quickReplies(plan)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white/55">
      <ChatHeader
        badge="Discord"
        back="Back to the board"
        onBack={() => navigate("/board")}
        avatar={<img src={art.logo} alt="" className="h-[26px] w-[21px] object-contain" />}
        title="Lore Keeper"
        subtitle={`Group agent · ${people[ME]?.name ?? "your"}’s chat`}
      />
      <Thread
        label="Lore Keeper conversation"
        follow={`${keeper.length}-${keeperBusy}`}
      >
        {keeper.map((m) => (
          <Message
            key={m.id}
            m={m}
            plans={plans}
            activeReview={m.id === lastReview}
            onOpenPick={() => setParams({ sheet: "pick" }, { replace: true })}
          />
        ))}
        {keeperBusy && (
          <Typing
            label={
              keeperBusy === "checking"
                ? "Checking calendars and asking everyone’s agent privately…"
                : undefined
            }
          />
        )}
      </Thread>
      <QuickReplies items={replies} onPick={pick} />
      <Composer
        value={text}
        onChange={setText}
        onSend={send}
        placeholder="Message Lore Keeper…"
        inputRef={input}
        before={
          contextPiece && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-muted">Context</span>
              <span className="inline-flex h-7 items-center gap-1 rounded-full border-[1.5px] border-dashed border-plezi bg-agent pl-2.5 pr-1 text-xs font-semibold">
                {contextPiece.title}
                <button
                  type="button"
                  aria-label="Remove context"
                  onClick={() => setContext(undefined)}
                  className="grid size-5 place-items-center rounded-full hover:bg-white"
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            </div>
          )
        }
      />
      {params.get("sheet") === "pick" && sheetPlan && (
        <PickSheet plan={sheetPlan} onClose={() => clearParams("sheet")} />
      )}
    </div>
  )
}

function quickReplies(plan?: Plan) {
  if (!plan)
    return [
      "plan something for the crew this weekend",
      "something outdoors",
      "How many times have we done karaoke?",
    ]
  if (plan.status === "checking") return []
  if (plan.status === "review") return ["confirm", "cancel"]
  if (plan.status === "locked")
    return ["recap: ", "what’s the plan", "cancel plan"]
  return plan.votes[ME]
    ? ["lock it in", "what’s the plan", "cancel plan"]
    : ["vote 1", "vote 2", "vote 3", "what’s the plan"]
}

function Message({
  m,
  plans,
  activeReview,
  onOpenPick,
}: {
  m: ChatMessage
  plans: Plan[]
  activeReview: boolean
  onOpenPick: () => void
}) {
  const { lore } = useStore()
  switch (m.kind) {
    case "text":
      return <Bubble from={m.from}>{m.text}</Bubble>
    case "agent-card":
      return <AgentCardBubble>{m.text}</AgentCardBubble>
    case "system":
      return <SystemNote>{m.text}</SystemNote>
    case "response":
      return <ResponsePill>{m.text}</ResponsePill>
    case "answer":
      return <AnswerView answer={m.answer} lore={lore} />
  }
  const plan = plans.find((p) => p.id === m.planId)
  if (!plan) return null
  if (m.kind === "pick") return <PickCard plan={plan} onOpen={onOpenPick} />
  if (m.kind === "review")
    return (
      <ReviewCard plan={plan} live={activeReview && plan.status === "review"} />
    )
  if (m.kind === "board-link")
    return (
      <div className="flex animate-pop-in">
        <ButtonLink to="/board" tone="secondary">
          See it on your board →
        </ButtonLink>
      </div>
    )
  return <RecapDraft plan={plan} />
}

function PickCard({ plan, onOpen }: { plan: Plan; onOpen: () => void }) {
  return (
    <div className="flex animate-pop-in">
      <button
        onClick={onOpen}
        className="flex w-full max-w-[330px] items-center gap-3 rounded-2xl border-2 border-dashed border-plezi bg-agent px-3.5 py-3 text-left transition-colors hover:bg-white"
      >
        <span className="size-11 shrink-0 overflow-hidden rounded-[10px] bg-white">
          {plan.options[0] && (
            <img
              src={plan.options[0].photo}
              alt=""
              className="size-full object-cover"
            />
          )}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[15px] font-bold text-ink">Pick one</span>
          <span className="block text-[13px] text-ink">
            This weekend · {plan.options.length} options · {votedCount(plan)}/
            {GROUP.size} voted
          </span>
        </span>
        <span className="text-sm font-bold text-ink">Open</span>
      </button>
    </div>
  )
}

function ReviewCard({ plan, live }: { plan: Plan; live: boolean }) {
  const { confirmLock, cancelLock } = useActions()
  const { people } = useStore()
  const option = lockedOption(plan)
  if (!option) return null
  const rows: [string, string][] = [
    ["Plan", option.title],
    ["When", `${option.day} ${option.time}`],
    ["Where", option.venue],
    ["Who’s coming", plan.coming.map((id) => people[id].name).join(", ")],
  ]
  return (
    <div className="flex animate-pop-in">
      <AgentBox className="flex w-full max-w-[340px] flex-col gap-2.5 p-3.5">
        <p className="text-base font-bold text-ink">Lock it in?</p>
        <dl className="flex flex-col gap-2.5 text-sm text-ink">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-[104px] shrink-0 font-bold">{k}</dt>
              <dd className="min-w-0 flex-1">{v}</dd>
            </div>
          ))}
        </dl>
        {live ? (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => confirmLock(plan.id)}>
              Confirm
            </Button>
            <Button
              tone="secondary"
              className="flex-1"
              onClick={() => cancelLock(plan.id)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted">
            {plan.status === "locked" || plan.status === "done"
              ? "Confirmed."
              : "Closed."}
          </p>
        )}
      </AgentBox>
    </div>
  )
}

/** The draft created from "recap: …". The story is the user's message, untouched. */
function RecapDraft({ plan }: { plan: Plan }) {
  const option = lockedOption(plan)
  if (!option) return null
  const done = plan.status === "done" && plan.loreId
  return (
    <div className="flex animate-pop-in">
      <article className="w-full max-w-[330px] rounded-2xl border-[1.5px] border-ink bg-white p-3.5 shadow-offset-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          {done ? "In the lore" : "Draft lore"}
        </p>
        <p className="mt-0.5 text-lg font-extrabold uppercase leading-tight text-ink">
          {option.title}
        </p>
        <p className="text-[13px] text-muted">
          {fmtWithDay(option.date)} · {option.venue}
        </p>
        {plan.recapStory && (
          <p className="mt-2 rounded-lg bg-shell px-2.5 py-2 text-[14px] leading-snug text-ink">
            {plan.recapStory}
          </p>
        )}
        {done ? (
          <ButtonLink
            to={`/lore/${plan.loreId}`}
            tone="secondary"
            className="mt-3 h-10 w-full text-sm"
          >
            Open the lore
          </ButtonLink>
        ) : (
          <ButtonLink
            to={`/lore/new?plan=${plan.id}`}
            className="mt-3 h-10 w-full text-sm"
          >
            Add photos and who came
          </ButtonLink>
        )}
      </article>
    </div>
  )
}

function PickSheet({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { vote } = useActions()
  const [slide, setSlide] = useState(0)
  const counts = tally(plan)
  const mine = plan.votes[ME]
  const open = plan.status === "voting"
  return (
    <Sheet title="Pick one" onClose={onClose}>
      <p className="-mt-1 mb-3 text-[13px] text-muted">
        This weekend · {votedCount(plan)}/{GROUP.size} voted
        {open ? "" : " · voting closed"}
      </p>
      <div
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
        onScroll={(e) => {
          const el = e.currentTarget
          const card = el.firstElementChild as HTMLElement | null
          setSlide(
            card ? Math.round(el.scrollLeft / (card.offsetWidth + 12)) : 0,
          )
        }}
      >
        {plan.options.map((o) => (
          <OptionCard
            key={o.id}
            option={o}
            votes={counts[o.id] ?? 0}
            mine={mine === o.id}
            locked={plan.lockedOptionId === o.id && plan.status !== "voting"}
            canVote={open}
            onVote={() => {
              vote(plan.id, o.id)
              onClose()
            }}
          />
        ))}
      </div>
      <div
        className="mt-3 flex justify-center gap-1.5"
        aria-label={`Option ${slide + 1} of ${plan.options.length}`}
      >
        {plan.options.map((o, i) => (
          <span
            key={o.id}
            className={`h-1.5 rounded-full transition-all ${
              i === slide ? "w-5 bg-ink" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">
        Card text and badges come straight from the group agent’s carousel.
        Nobody’s private limits are shown.
      </p>
      <p className="sr-only">{PEOPLE_ORDER.length} members in the group.</p>
    </Sheet>
  )
}

function OptionCard({
  option,
  votes,
  mine,
  locked,
  canVote,
  onVote,
}: {
  option: PlanOption
  votes: number
  mine: boolean
  locked: boolean
  canVote: boolean
  onVote: () => void
}) {
  const { lore } = useStore()
  const cited = option.citations
    .map((id) => lore.find((p) => p.id === id))
    .filter((p): p is LorePiece => !!p)
  return (
    <article
      className={`flex w-[min(82%,300px)] shrink-0 snap-center flex-col rounded-2xl border-[1.5px] bg-white p-2.5 ${
        mine || locked ? "border-ink shadow-offset-sm" : "border-line"
      }`}
    >
      <img
        src={option.photo}
        alt=""
        className="aspect-[4/3] w-full rounded-xl object-cover"
      />
      <h3 className="mt-2.5 text-lg font-bold leading-tight text-ink">
        {option.title}
      </h3>
      <p className="text-[13px] text-ink">
        {option.day} {option.time} · {option.conditions}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {option.badges.map((b, i) =>
          i === 0 && cited[0] ? (
            <Link
              key={b}
              to={`/lore/${cited[0].id}`}
              className="rounded-full hover:opacity-80"
              title={`Source: ${cited[0].title}`}
            >
              <Pill agent className="h-7 px-2.5 text-xs">
                {b}
                <Icon name="chevronRight" size={12} />
              </Pill>
            </Link>
          ) : (
            <Pill key={b} agent className="h-7 px-2.5 text-xs">
              {b}
            </Pill>
          ),
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{optionMeta(option)}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="text-xs font-semibold text-muted">
          {votes} vote{votes === 1 ? "" : "s"}
        </span>
        {locked ? (
          <Pill dark>
            <Icon name="lockWhite" size={14} /> Locked in
          </Pill>
        ) : (
          <Button
            className="h-10 px-4 text-sm"
            onClick={onVote}
            disabled={!canVote || mine}
          >
            {mine ? (
              <>
                <Icon name="checkWhite" size={14} /> Your vote
              </>
            ) : (
              "Vote"
            )}
          </Button>
        )}
      </div>
    </article>
  )
}
