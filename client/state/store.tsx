import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from "react"
import { answerLocally, loreAgent } from "../agent/loreAgent"
import { EMPTY_LIMITS, fitsPrivateLimits, memberAgentReply } from "../agent/memberAgent"
import {
  draftOptions,
  EARLY_VOTERS,
  findMentionedLore,
  LATE_VOTERS,
  lockedOption,
  majority,
  MAJORITY,
  optionLine,
  tally,
  votedCount,
} from "../agent/planner"
import { listNames } from "../agent/text"
import { startSync, syncAction } from "./sync"

type KeeperReply = { text: string; draft?: { options: PlanOption[] }; answer?: LoreAnswer }
/** Lore Keeper on the server. Resolves null when it can't be reached (the caller falls back). */
async function askKeeper(text: string, sourceLoreId?: string): Promise<KeeperReply | null> {
  try {
    const r = await fetch("/api/agents/keeper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, sourceLoreId }),
      signal: AbortSignal.timeout(45000),
    })
    return r.ok ? ((await r.json()) as KeeperReply) : null
  } catch {
    return null
  }
}
import {
  AREAS,
  GROUP,
  ME,
  PEOPLE_ORDER,
  SEED_AGENT_THREAD,
  SEED_KEEPER_THREAD,
  SEED_LIMITS,
  SEED_LORE,
  SEED_PEOPLE,
  SEED_PROFILES,
} from "../data/seed"
import type {
  Area,
  ChatMessage,
  Limits,
  LoreAnswer,
  LorePiece,
  Person,
  PersonId,
  PieceId,
  Plan,
  PlanOption,
  Profile,
  Quote,
} from "../data/types"

// ---------------------------------------------------------------------------------------------
// State

export type Busy = null | "checking" | "typing"

/** One question on the Ask page. `scope` is 'all' or the id of the lore piece it was asked about. */
export type AskEntry = {
  id: string
  scope: string
  question: string
  answer?: LoreAnswer
}

export type State = {
  lore: LorePiece[]
  plans: Plan[]
  keeper: ChatMessage[]
  agent: ChatMessage[]
  keeperBusy: Busy
  agentBusy: boolean
  limits: Limits
  people: Record<PersonId, Person>
  profiles: Record<PersonId, Profile>
  areas: Record<string, Area>
  asks: AskEntry[]
  /** Lore piece to pulse on the board after it was just added. */
  highlight?: string
  notice?: { id: number; text: string }
}

const initialState: State = {
  lore: SEED_LORE,
  plans: [],
  keeper: SEED_KEEPER_THREAD,
  agent: ME === "john" ? SEED_AGENT_THREAD : [],
  keeperBusy: null,
  agentBusy: false,
  limits: ME === "john" ? SEED_LIMITS : EMPTY_LIMITS,
  people: SEED_PEOPLE,
  profiles: SEED_PROFILES,
  areas: AREAS,
  asks: [
    {
      id: "ask-seed",
      scope: "all",
      question: "What did we do last summer?",
      answer: answerLocally("What did we do last summer?", SEED_LORE),
    },
  ],
}

type Action = { type: "keeper/push"; messages: ChatMessage[] } | {
  type: "keeper/busy"
  busy: Busy
} | { type: "agent/push"; messages: ChatMessage[] } | {
  type: "agent/busy"
  busy: boolean
} | { type: "limits/set"; limits: Limits } | { type: "plan/add"; plan: Plan } | {
  type: "plan/patch"
  id: string
  patch: Partial<Plan>
} | { type: "plan/vote"; id: string; person: PersonId; optionId: string } | {
  type: "lore/add"
  piece: LorePiece
} | {
  type: "lore/patch"
  id: string
  patch: Partial<Omit<LorePiece, "quotes">>
  addQuotes?: Quote[]
} | { type: "area/add"; area: Area } | {
  type: "profile/patch"
  id: PersonId
  patch: Partial<Profile>
} | { type: "person/piece"; id: PersonId; piece: PieceId } | {
  type: "ask/push"
  entry: AskEntry
} | { type: "ask/answer"; id: string; answer: LoreAnswer } | {
  type: "highlight"
  id?: string
} | { type: "notice"; text?: string } | { type: "hydrate"; snap: Partial<State> }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "keeper/push":
      return { ...state, keeper: [...state.keeper, ...action.messages] }
    case "keeper/busy":
      return { ...state, keeperBusy: action.busy }
    case "agent/push":
      return { ...state, agent: [...state.agent, ...action.messages] }
    case "agent/busy":
      return { ...state, agentBusy: action.busy }
    case "limits/set":
      return { ...state, limits: action.limits }
    case "plan/add":
      return { ...state, plans: [...state.plans, action.plan] }
    case "plan/patch":
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p,
        ),
      }
    case "plan/vote":
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.id
            ? { ...p, votes: { ...p.votes, [action.person]: action.optionId } }
            : p,
        ),
      }
    case "lore/add":
      return { ...state, lore: [action.piece, ...state.lore] }
    case "lore/patch":
      return {
        ...state,
        lore: state.lore.map((p) =>
          // Existing quotes are carried over untouched; edits can only append new ones.
          p.id === action.id
            ? {
                ...p,
                ...action.patch,
                quotes: [...p.quotes, ...(action.addQuotes ?? [])],
              }
            : p,
        ),
      }
    case "area/add":
      return {
        ...state,
        areas: { ...state.areas, [action.area.id]: action.area },
      }
    case "profile/patch":
      return {
        ...state,
        profiles: {
          ...state.profiles,
          [action.id]: { ...state.profiles[action.id], ...action.patch },
        },
      }
    case "person/piece":
      return {
        ...state,
        people: {
          ...state.people,
          [action.id]: { ...state.people[action.id], piece: action.piece },
        },
      }
    case "ask/push":
      return { ...state, asks: [...state.asks, action.entry] }
    case "ask/answer":
      return {
        ...state,
        asks: state.asks.map((a) =>
          a.id === action.id ? { ...a, answer: action.answer } : a,
        ),
      }
    case "highlight":
      return { ...state, highlight: action.id }
    case "hydrate": {
      const s = action.snap
      return {
        ...state,
        lore: s.lore ?? state.lore,
        plans: s.plans ?? state.plans,
        keeper: s.keeper ?? state.keeper,
        agent: s.agent ?? state.agent,
        limits: s.limits ?? state.limits,
        people: s.people ?? state.people,
        profiles: s.profiles ?? state.profiles,
        areas: s.areas ?? state.areas,
      }
    }
    case "notice":
      return {
        ...state,
        notice: action.text ? { id: Date.now(), text: action.text } : undefined,
      }
  }
}

// ---------------------------------------------------------------------------------------------
// Helpers

let seq = 0
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`

const msg = {
  me: (text: string): ChatMessage => ({
    id: uid("m"),
    kind: "text",
    from: "me",
    text,
  }),
  agent: (text: string): ChatMessage => ({
    id: uid("m"),
    kind: "text",
    from: "agent",
    text,
  }),
  card: (text: string): ChatMessage => ({
    id: uid("m"),
    kind: "agent-card",
    text,
  }),
  system: (text: string): ChatMessage => ({
    id: uid("m"),
    kind: "system",
    text,
  }),
  response: (text: string): ChatMessage => ({
    id: uid("m"),
    kind: "response",
    text,
  }),
  attach: (
    kind: "pick" | "review" | "board-link" | "recap-link",
    planId: string,
  ): ChatMessage => ({ id: uid("m"), kind, planId }),
}

const OPEN: Plan["status"][] = ["checking", "voting", "review", "locked"]
export const activePlan = (plans: Plan[]) =>
  [...plans].reverse().find((p) => OPEN.includes(p.status))

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "lore"

/** Plain questions about the past go to the lore; anything that sounds like making plans goes to the planner. */
const looksLikeQuestion = (t: string) => {
  const q = t.toLowerCase().trim()
  if (
    /\b(should we|can we|could we|shall we|wanna|want to|let.?s|plan|book|organi[sz]e|this weekend|next weekend|tonight|tomorrow)\b/.test(
      q,
    )
  )
    return false
  if (/\bagain\b/.test(q) && !/^(when|who|how many)\b/.test(q)) return false
  return (
    /\?$/.test(q) ||
    /^(how|who|what|when|where|which|did|was|were|has|have|is|are)\b/.test(q)
  )
}

export type LoreDraft = {
  title: string
  area: string
  date: string
  place: string
  who: PersonId[]
  story: string
  photos: string[]
  quotes: Omit<Quote, "id">[]
}

// ---------------------------------------------------------------------------------------------
// Provider

type Actions = ReturnType<typeof useCreateActions>

const StateContext = createContext<State | null>(null)
const ActionsContext = createContext<Actions | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initialState)
  // Every shared change is also posted to the server; snapshots from the server replace the shared slices.
  const dispatch = useCallback((a: Action) => {
    rawDispatch(a)
    syncAction(a)
  }, [])
  useEffect(
    () => startSync((snap) => rawDispatch({ type: "hydrate", snap: snap as Partial<State> })),
    [],
  )
  const stateRef = useRef(state)
  stateRef.current = state
  const actions = useCreateActions(dispatch, stateRef)

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>
        {children}
      </ActionsContext.Provider>
    </StateContext.Provider>
  )
}

function useCreateActions(
  dispatch: Dispatch<Action>,
  stateRef: RefObject<State>,
) {
  // Timers live with the provider so plans keep moving while you browse other pages.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const set = timers.current
    return () => {
      set.forEach(clearTimeout)
      set.clear()
    }
  }, [])
  const later = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.current.delete(t)
      fn()
    }, ms)
    timers.current.add(t)
  }, [])

  return useMemo(() => {
    const get = () => stateRef.current
    const planById = (id: string) => get().plans.find((p) => p.id === id)
    const keeperSay = (...messages: ChatMessage[]) =>
      dispatch({ type: "keeper/push", messages })

    /** Records a vote, posts the tally, and announces a majority the first time one forms. */
    function recordVote(planId: string, person: PersonId, optionId: string) {
      const before = planById(planId)
      if (!before || before.status !== "voting") return
      dispatch({ type: "plan/vote", id: planId, person, optionId })
      const plan = { ...before, votes: { ...before.votes, [person]: optionId } }
      const count = votedCount(plan)
      const win = majority(plan)
      const announce = win && !plan.majorityAnnounced
      if (announce)
        dispatch({
          type: "plan/patch",
          id: planId,
          patch: { majorityAnnounced: true },
        })

      if (person === ME) {
        const option = plan.options.find((o) => o.id === optionId)!
        const changed = before.votes[ME] && before.votes[ME] !== optionId
        keeperSay(
          msg.response(`${changed ? "Changed to" : "Voted"}: ${option.title}`),
          msg.card(
            `Vote counted (${count}/${GROUP.size} voted). ` +
              (win
                ? `${win.option.title} has a majority — say “lock it in” to confirm.`
                : `No majority yet — ${MAJORITY} votes for one option settles it.`),
          ),
        )
        if (!before.votes[ME]) scheduleLateVotes(planId)
      } else {
        keeperSay(
          msg.system(
            `${SEED_PEOPLE[person].name} voted · ${count}/${GROUP.size}`,
          ),
        )
        if (announce)
          keeperSay(
            msg.card(
              `${win!.option.title} has a majority (${win!.votes} votes) — say “lock it in” to confirm.`,
            ),
          )
      }
    }

    function scheduleLateVotes(planId: string) {
      for (const { person, strategy, delayMs } of LATE_VOTERS.filter((v) => v.person !== ME)) {
        later(delayMs, () => {
          const plan = planById(planId)
          if (!plan || plan.status !== "voting" || plan.votes[person]) return
          const pick =
            strategy === "follow-planner" ? plan.votes[ME] : plan.options[1]?.id
          if (pick) recordVote(planId, person, pick)
        })
      }
    }

    function startPlan(request: string, sourceLoreId?: string) {
      const s = get()
      const open = activePlan(s.plans)
      if (open) {
        const option = lockedOption(open)
        keeperSay(
          msg.agent(
            open.status === "locked" && option
              ? `${option.title} is already locked in for ${option.day} ${option.time}. Send “recap: …” after, or say “cancel plan” to start over.`
              : `We’re still voting on this weekend (${votedCount(open)}/${GROUP.size} voted). Finish this one or say “cancel plan” first.`,
          ),
          ...(open.status === "voting" ? [msg.attach("pick", open.id)] : []),
        )
        return
      }

      const source = sourceLoreId
        ? s.lore.find((p) => p.id === sourceLoreId)
        : /\bagain\b/i.test(request)
          ? findMentionedLore(request, s.lore)
          : undefined
      const plan: Plan = {
        id: uid("plan"),
        request,
        sourceLoreId: source?.id,
        status: "checking",
        options: [],
        votes: {},
        majorityAnnounced: false,
        coming: [],
      }
      dispatch({ type: "plan/add", plan })
      dispatch({ type: "keeper/busy", busy: "checking" })

      // Lore Keeper drafts on the server (MCP tools, live weather, sealed limits). The local
      // planner is the fallback so the book still works offline.
      const t0 = Date.now()
      later(1700, () => {
        if (get().keeperBusy === "checking") dispatch({ type: "keeper/busy", busy: "typing" })
      })
      const local = () => {
        const now = get()
        const drafted = draftOptions({ request, lore: now.lore, source })
        const fitting = drafted.filter((o) => fitsPrivateLimits(now.limits, o))
        const options = fitting.length ? fitting : drafted
        const intro = source
          ? `${source.title} is in the lore, so I started there. Here are ${options.length} options for this weekend — checked against everyone’s calendars and private limits.`
          : `Here are ${options.length} options for this weekend — checked against everyone’s calendars and private limits.`
        return { options, intro }
      }
      askKeeper(request, source?.id)
        .then((r) => {
          const opts = r?.draft?.options
          if (opts && opts.length) return { options: opts, intro: r!.text || local().intro }
          return local()
        })
        .catch(() => local())
        .then(({ options, intro }) => {
          later(Math.max(0, 2200 - (Date.now() - t0)), () => publish(options, intro))
        })

      const publish = (options: PlanOption[], intro: string) => {
        dispatch({
          type: "plan/patch",
          id: plan.id,
          patch: { status: "voting", options },
        })
        dispatch({ type: "keeper/busy", busy: null })
        keeperSay(
          msg.agent(
            `${intro}\n${options.map(optionLine).join("\n")}\n0/${GROUP.size} voted.`,
          ),
          msg.attach("pick", plan.id),
          msg.system(
            `Vote invites sent in FGL to ${listNames(PEOPLE_ORDER.filter((id) => id !== ME))}`,
          ),
        )
        EARLY_VOTERS.filter((p) => p !== ME).forEach((person, i) =>
          later(2600 + i * 2200, () => {
            const p = planById(plan.id)
            if (p?.options[0] && !p.votes[person])
              recordVote(plan.id, person, p.options[0].id)
          }),
        )
      }
    }

    function requestLock(planId: string) {
      const plan = planById(planId)
      if (!plan || plan.status !== "voting") return
      if (!votedCount(plan)) {
        keeperSay(
          msg.agent(
            "Nobody has voted yet. Pick one first and I’ll lock in whatever wins.",
          ),
        )
        return
      }
      const counts = tally(plan)
      const win = majority(plan)
      const leader =
        win?.option ??
        [...plan.options].sort(
          (a, b) =>
            (counts[b.id] ?? 0) - (counts[a.id] ?? 0) ||
            Number(b.id === plan.votes[ME]) - Number(a.id === plan.votes[ME]),
        )[0]
      const votes = counts[leader.id] ?? 0
      const coming = PEOPLE_ORDER.filter((id) => plan.votes[id])
      dispatch({
        type: "plan/patch",
        id: planId,
        patch: { status: "review", lockedOptionId: leader.id, coming },
      })
      keeperSay(
        msg.agent(
          `Lock in ${leader.title} — ${leader.day} ${leader.time} at ${leader.venue}? (${votes} vote${
            votes === 1 ? "" : "s"
          }${win ? "" : ", no majority yet"}) Reply confirm or cancel.`,
        ),
        msg.attach("review", planId),
      )
    }

    function confirmLock(planId: string) {
      const plan = planById(planId)
      const option = plan && lockedOption(plan)
      if (!plan || plan.status !== "review" || !option) return
      dispatch({ type: "plan/patch", id: planId, patch: { status: "locked" } })
      keeperSay(
        msg.response("Confirmed"),
        msg.agent(
          `Locked in: ${option.title} — ${option.day} ${option.time} at ${option.venue}. Coming: ${plan.coming.map((id) => SEED_PEOPLE[id].name).join(", ")}. Send “recap: …” afterwards and I’ll add it to the lore.`,
        ),
        msg.attach("board-link", planId),
      )
    }

    function cancelLock(planId: string) {
      const plan = planById(planId)
      if (!plan || plan.status !== "review") return
      dispatch({
        type: "plan/patch",
        id: planId,
        patch: { status: "voting", lockedOptionId: undefined },
      })
      keeperSay(
        msg.response("Cancel"),
        msg.agent("Okay — not locked. Voting stays open."),
      )
    }

    function cancelPlan(planId: string) {
      const plan = planById(planId)
      if (!plan || !OPEN.includes(plan.status)) return
      dispatch({
        type: "plan/patch",
        id: planId,
        patch: { status: "cancelled" },
      })
      const title = lockedOption(plan)?.title ?? "this weekend’s plan"
      keeperSay(
        msg.agent(
          `Cancelled ${title}. Nothing was added to the lore. Tell me what you feel like and I’ll start fresh.`,
        ),
      )
    }

    function recap(story: string) {
      const plan = [...get().plans].reverse().find((p) => p.status === "locked")
      if (!plan) {
        keeperSay(
          msg.agent(
            "There’s no locked plan to recap yet. To add lore on its own, use + on the board.",
          ),
        )
        return
      }
      if (!story.trim()) {
        keeperSay(
          msg.agent(
            "Add your words after “recap:” — they become the story, exactly as you write them.",
          ),
        )
        return
      }
      dispatch({
        type: "plan/patch",
        id: plan.id,
        patch: { recapStory: story },
      })
      keeperSay(
        msg.agent(
          "Drafted it. Your words are the story, exactly as sent. Add photos, who came and any quotes, then add it to the lore.",
        ),
        msg.attach("recap-link", plan.id),
      )
    }

    function sendKeeper(raw: string, opts?: { sourceLoreId?: string }) {
      const text = raw.trim()
      if (!text) return
      keeperSay(msg.me(text))
      const lower = text.toLowerCase()
      const plan = activePlan(get().plans)

      const recapMatch = text.match(/^recap\s*:\s*([\s\S]*)$/i)
      if (recapMatch) return recap(recapMatch[1].trim())

      if (plan?.status === "review") {
        if (/^(confirm|yes|yep|yeah|do it|lock it)\b/.test(lower))
          return confirmLock(plan.id)
        if (/^(cancel|no|nope|not yet|wait)\b/.test(lower))
          return cancelLock(plan.id)
      }
      if (plan && /^cancel( the)? plan\b|^cancel( it)?$/.test(lower))
        return cancelPlan(plan.id)
      if (plan?.status === "voting") {
        if (/\block( it)?( in)?\b/.test(lower)) return requestLock(plan.id)
        const n = lower.match(/^(?:vote\s*)?(?:for\s*)?#?([1-3])$/)?.[1]
        const byNumber = n ? plan.options[Number(n) - 1] : undefined
        const byName = plan.options.find((o) =>
          lower.includes(o.title.toLowerCase()),
        )
        const option = byNumber ?? (/^vote\b/.test(lower) ? byName : undefined)
        if (option) return recordVote(plan.id, ME, option.id)
      }
      if (/\b(what.?s the plan|status|where are we)\b/.test(lower)) {
        if (!plan)
          return keeperSay(
            msg.agent(
              "Nothing planned yet. Tell me what you feel like and I’ll bring back three options.",
            ),
          )
        const option = lockedOption(plan)
        if (plan.status === "locked" && option)
          return keeperSay(
            msg.agent(
              `Locked in: ${option.title} — ${option.day} ${option.time} at ${option.venue}.`,
            ),
            msg.attach("board-link", plan.id),
          )
        return keeperSay(
          msg.agent(
            `Here are ${plan.options.length} options for this weekend… ${votedCount(plan)}/${GROUP.size} voted.`,
          ),
          msg.attach("pick", plan.id),
        )
      }

      if (!opts?.sourceLoreId && looksLikeQuestion(text)) {
        dispatch({ type: "keeper/busy", busy: "typing" })
        askKeeper(text)
          .then(async (r) => {
            dispatch({ type: "keeper/busy", busy: null })
            if (r?.answer) {
              keeperSay({ id: uid("m"), kind: "answer", answer: r.answer })
            } else if (r?.text) {
              keeperSay(msg.agent(r.text))
            } else {
              const answer = await loreAgent.ask(text, { lore: get().lore })
              keeperSay({ id: uid("m"), kind: "answer", answer })
            }
          })
        return
      }
      startPlan(text, opts?.sourceLoreId)
    }

    function sendAgent(raw: string) {
      const text = raw.trim()
      if (!text) return
      // Secrets (calendar links) never get written into the thread.
      const shown = text.replace(
        /\b(?:https?|webcal):\/\/\S+/gi,
        "[secret iCal URL]",
      )
      dispatch({ type: "agent/push", messages: [msg.me(shown)] })
      dispatch({ type: "agent/busy", busy: true })
      later(650, () => {
        const reply = memberAgentReply(text, get().limits)
        if (reply.limits) dispatch({ type: "limits/set", limits: reply.limits })
        dispatch({ type: "agent/busy", busy: false })
        dispatch({
          type: "agent/push",
          messages: [
            reply.kind === "agent-card"
              ? msg.card(reply.text)
              : msg.agent(reply.text),
          ],
        })
      })
    }

    function addArea(label: string) {
      const clean = label.trim()
      const existing = Object.values(get().areas).find(
        (a) => a.label.toLowerCase() === clean.toLowerCase(),
      )
      if (existing) return existing.id
      const tints = [
        "blue",
        "red",
        "purple",
        "green",
        "yellow",
        "orange",
      ] as const
      const area: Area = {
        id: slug(clean),
        label: clean,
        tint: tints[Object.keys(get().areas).length % tints.length],
      }
      dispatch({ type: "area/add", area })
      return area.id
    }

    function saveLore(draft: LoreDraft, opts?: { planId?: string }) {
      const base = slug(draft.title)
      const id = get().lore.some((p) => p.id === base)
        ? `${base}-${++seq}`
        : base
      const piece: LorePiece = {
        id,
        title: draft.title.trim(),
        area: draft.area,
        date: draft.date,
        place: draft.place.trim(),
        addedBy: ME,
        who: PEOPLE_ORDER.filter((p) => draft.who.includes(p)),
        story: draft.story.trim() ? draft.story : undefined,
        quotes: draft.quotes.map((q) => ({ ...q, id: uid("q") })),
        photos: draft.photos,
        planId: opts?.planId,
      }
      dispatch({ type: "lore/add", piece })
      dispatch({ type: "highlight", id })
      if (opts?.planId) {
        dispatch({
          type: "plan/patch",
          id: opts.planId,
          patch: { status: "done", loreId: id },
        })
        const area = get().areas[piece.area]?.label ?? piece.area
        keeperSay(
          msg.agent(
            `Added “${piece.title}” to the lore — it’s on the board under ${area}. The plan card is gone; this is a memory now.`,
          ),
        )
      }
      return id
    }

    function updateLore(
      id: string,
      patch: Partial<Omit<LorePiece, "quotes" | "id" | "addedBy">>,
      newQuotes: Omit<Quote, "id">[],
    ) {
      dispatch({
        type: "lore/patch",
        id,
        patch,
        addQuotes: newQuotes.map((q) => ({ ...q, id: uid("q") })),
      })
      dispatch({ type: "highlight", id })
    }

    /** Ask the lore, optionally about a single piece. Only that piece is searched when scoped. */
    function ask(question: string, scopeId?: string) {
      const q = question.trim()
      if (!q) return
      const entry: AskEntry = {
        id: uid("ask"),
        scope: scopeId ?? "all",
        question: q,
      }
      dispatch({ type: "ask/push", entry })
      later(650, () => {
        const s = get()
        const scope = scopeId ? s.lore.find((p) => p.id === scopeId) : undefined
        loreAgent
          .ask(q, { lore: s.lore, scope })
          .then((answer) =>
            dispatch({ type: "ask/answer", id: entry.id, answer }),
          )
      })
    }

    return {
      ask,
      sendKeeper,
      vote: (planId: string, optionId: string) =>
        recordVote(planId, ME, optionId),
      requestLock,
      confirmLock,
      cancelLock,
      cancelPlan,
      startPlan,
      sendAgent,
      addArea,
      saveLore,
      updateLore,
      updateProfile: (id: PersonId, patch: Partial<Profile>) =>
        dispatch({ type: "profile/patch", id, patch }),
      setPiece: (id: PersonId, piece: PieceId) =>
        dispatch({ type: "person/piece", id, piece }),
      clearHighlight: () => dispatch({ type: "highlight" }),
      notify: (text?: string) => dispatch({ type: "notice", text }),
    }
  }, [dispatch, later, stateRef])
}

export function useStore() {
  const s = useContext(StateContext)
  if (!s) throw new Error("useStore must be used inside <StoreProvider>")
  return s
}

export function useActions() {
  const a = useContext(ActionsContext)
  if (!a) throw new Error("useActions must be used inside <StoreProvider>")
  return a
}
