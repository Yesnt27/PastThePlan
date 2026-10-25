import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { lockedOption, votedCount } from "../agent/planner"
import { GROUP, ME, PEOPLE_ORDER, TODAY } from "../data/seed"
import { drifters, onThisDay, reconnectFor, type Reconnect } from "@/lib/fgl/rekindle"
import { fmtShort } from "../lib/dates"
import { nameOf } from "../agent/text"
import type { LorePiece, PersonId, Plan, Tint } from "../data/types"
import { relativeDays } from "../lib/dates"
import { clusters, type Cluster, type Lens } from "../state/selectors"
import { useActions, useStore } from "../state/store"
import { Icon } from "../ui/Icon"
import { Button, EmptyNote, NameTag, Photo, TINT_BG } from "../ui/kit"
import { Sheet } from "../ui/Sheet"
import { Playground } from "./Playground"

const LENSES: { id: Lens; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "season", label: "Season" },
  { id: "people", label: "People" },
]

type Tile = { kind: "cluster"; cluster: Cluster } | {
  kind: "plan"
  plan: Plan
} | { kind: "cta" } | { kind: "free"; id: string } | {
  kind: "onthisday"
  piece: LorePiece
} | { kind: "spot" } | { kind: "drafts" } | { kind: "nudge"; r: Reconnect }

/** Rough heights so tiles can be dealt into two columns, row by row, like the board comp. */
const estimate = (t: Tile) => {
  if (t.kind === "free") return 100
  if (t.kind === "plan" || t.kind === "cta" || t.kind === "spot") return 170
  if (t.kind === "onthisday") return 250
  if (t.kind === "drafts") return 200
  if (t.kind === "nudge") return 430
  const n = Math.min(t.cluster.pieces.length, 6) || 1
  return 48 + Math.ceil(n / 2) * 104
}

function masonry(tiles: Tile[]) {
  const cols: Tile[][] = [[], []]
  const h = [0, 0]
  for (const t of tiles) {
    const i = h[0] <= h[1] ? 0 : 1
    cols[i].push(t)
    h[i] += estimate(t) + 14
  }
  return cols
}

export function Board() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { lore, plans, areas, people, profiles, highlight } = useStore()
  const { clearHighlight } = useActions()
  const lens = (LENSES.find((l) => l.id === params.get("by"))?.id ??
    "activity") as Lens
  const who = (params
    .get("who")
    ?.split(",")
    .filter((id) => PEOPLE_ORDER.includes(id as PersonId)) ?? []) as PersonId[]
  const areaFocus = params.get("area")
  const sheet = params.get("sheet")

  const visible = useMemo(
    () => lore.filter((p) => who.every((id) => p.who.includes(id))),
    [lore, who],
  )
  const open = plans.filter((p) =>
    ["checking", "voting", "review", "locked"].includes(p.status),
  )

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  // Pulse a freshly added piece, scroll it into view, then let it settle.
  const canvas = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!highlight) return
    if (canvas.current) {
      const el = canvas.current.querySelector(`[data-piece="${highlight}"]`)
      el?.scrollIntoView({ block: "center", behavior: "smooth" })
    }
    const t = setTimeout(clearHighlight, 3200)
    return () => clearTimeout(t)
  }, [highlight, clearHighlight, lens])

  // Scribe: open drafts from the group chat, plus a sync on open (the server throttles it).
  const [drafts, setDrafts] = useState<Draft[]>([])
  useEffect(() => {
    let live = true
    fetch("/api/scribe", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .then((j) => live && setDrafts(j.drafts ?? []))
      .catch(() => {})
    fetch("/api/scribe", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j?.drafts && setDrafts(j.drafts))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const groups = clusters(visible, lens, areas).filter(
    (c) => lens !== "people" || who.length === 0 || c.pieces.length,
  )
  const tiles: Tile[] = []
  // Rekindler, privately: the friend you've gone longest without, through a moment you share.
  const reconnect = useMemo(
    () =>
      reconnectFor(
        lore,
        ME,
        Object.fromEntries(Object.entries(profiles).map(([id, p]) => [id, p?.hobbies ?? []])),
      ),
    [lore, profiles],
  )
  if (reconnect) tiles.push({ kind: "nudge", r: reconnect })
  // A memory from this day in an earlier year, and (only for you) a saved spot.
  onThisDay(lore).slice(0, 1).forEach((piece) => tiles.push({ kind: "onthisday", piece }))
  if (drifters(lore).some((d) => d.person === ME) && open.length) tiles.push({ kind: "spot" })
  if (open.length) open.forEach((plan) => tiles.push({ kind: "plan", plan }))
  else tiles.push({ kind: "cta" })
  if (drafts.length) tiles.push({ kind: "drafts" })
  const hubCols = masonry(tiles)

  const renderTile = (t: Tile) =>
    t.kind === "nudge" ? (
      <ReconnectCard key={`nudge-${t.r.friend}`} r={t.r} />
    ) : t.kind === "plan" ? (
      <PlanCard key={t.plan.id} plan={t.plan} />
    ) : t.kind === "cta" ? (
      <PlanPrompt key="cta" />
    ) : t.kind === "onthisday" ? (
      <OnThisDay key={`otd-${t.piece.id}`} piece={t.piece} />
    ) : t.kind === "spot" ? (
      <SavedSpot key="spot" />
    ) : t.kind === "drafts" ? (
      <ScribeDrafts key="drafts" drafts={drafts} onDone={(id) => setDrafts((d) => d.filter((x) => x.id !== id))} />
    ) : t.kind === "cluster" ? (
      <ClusterCard key={t.cluster.key} cluster={t.cluster} lens={lens} highlight={highlight} onFocus={(id) => setParam("area", id)} />
    ) : (
      <FreeSpot key={t.id} />
    )

  const focused = areaFocus
    ? groups.find((g) => g.areaId === areaFocus)
    : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 pb-1 pl-6 pr-4 pt-2">
        <div role="tablist" aria-label="Group pieces by" className="flex gap-2">
          {LENSES.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={lens === l.id}
              onClick={() =>
                setParam("by", l.id === "activity" ? undefined : l.id)
              }
              className={`h-8 rounded-full border-[1.5px] px-3 text-[13px] font-semibold transition-colors ${
                lens === l.id
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:border-ink"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted">
          {visible.length} piece{visible.length === 1 ? "" : "s"}
        </span>
      </div>
      {who.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-1 pl-6 pr-4 pt-1 text-xs text-muted">
          Only lore with
          {who.map((id) => (
            <button
              key={id}
              onClick={() =>
                setParam(
                  "who",
                  who.filter((w) => w !== id).join(",") || undefined,
                )
              }
              aria-label={`Remove ${people[id].name} from the filter`}
              className="inline-flex items-center rounded-full hover:opacity-80"
            >
              <NameTag person={people[id]} size="sm" />
              <Icon name="close" size={16} className="-ml-1" />
            </button>
          ))}
        </div>
      )}

      <DragLayer>
        {(drag) => (
          <>
            {focused ? (
              <div
                ref={canvas}
                className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                <AreaFocus
                  cluster={focused}
                  highlight={highlight}
                  onBack={() => setParam("area")}
                />
              </div>
            ) : (
              <Playground
                key={lens}
                lens={lens}
                groups={groups}
                highlight={highlight}
                onIsland={(id) => setParam("area", id)}
                hub={
                  <div className="grid grid-cols-2 items-start gap-3.5">
                    {hubCols.map((col, i) => (
                      <div key={i} className="flex min-w-0 flex-col gap-3.5">
                        {col.map(renderTile)}
                      </div>
                    ))}
                  </div>
                }
              />
            )}
            {visible.length === 0 && (
              <div className="px-6 pb-2">
                <EmptyNote>No lore has all of those people in it yet.</EmptyNote>
              </div>
            )}
            <div className="flex shrink-0 justify-center px-5 pb-1 pt-2">
              <button
                type="button"
                onPointerDown={drag.start}
                onClick={(e) => {
                  // Pointer taps are handled on release; this covers keyboard activation.
                  if (e.detail === 0) navigate("/lore/new")
                }}
                className="inline-flex h-12 touch-none select-none items-center gap-2 whitespace-nowrap rounded-xl bg-ink px-[18px] text-[15px] font-bold text-white shadow-[0_3px_0_rgba(0,0,0,0.2)] active:translate-y-px"
                aria-label="New lore — drag onto an area or an empty spot, or tap to start"
              >
                <span className="grid size-6 place-items-center rounded-md bg-paper">
                  <Icon name="plus" size={16} />
                </span>
                Drag “New lore” onto the board
              </button>
            </div>
          </>
        )}
      </DragLayer>

      {sheet === "filter" && (
        <FilterSheet
          lens={lens}
          who={who}
          onClose={() => setParam("sheet")}
          onLens={(l) => setParam("by", l === "activity" ? undefined : l)}
          onWho={(ids) => setParam("who", ids.join(",") || undefined)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

function ClusterCard({
  cluster,
  lens,
  highlight,
  onFocus,
}: {
  cluster: Cluster
  lens: Lens
  highlight?: string
  onFocus: (id: string) => void
}) {
  const { people } = useStore()
  const shown =
    cluster.pieces.length > 6 ? cluster.pieces.slice(-5) : cluster.pieces
  const extra = cluster.pieces.length - shown.length
  const tint = (cluster.tint ?? "yellow") as Tint
  const countLabel =
    cluster.pieces.length > 1 ? ` ×${cluster.pieces.length}` : ""

  return (
    <section
      data-drop={cluster.areaId}
      aria-label={`${
        cluster.person ? people[cluster.person].name : cluster.label
      }, ${cluster.pieces.length} pieces`}
      className="relative overflow-hidden rounded-[22px] border-[1.5px] border-hair bg-area/80 p-2.5 pb-3"
    >
      <header className="mb-2 flex min-h-6 items-center gap-1.5">
        {cluster.person ? (
          <Link
            to={cluster.person === "john" ? "/me" : `/people/${cluster.person}`}
            className="rounded-full"
          >
            <NameTag person={people[cluster.person]} size="sm" />
          </Link>
        ) : (
          <>
            {lens === "activity" && (
              <span
                aria-hidden
                className={`size-2.5 shrink-0 rounded-full ${TINT_BG[tint]}`}
              />
            )}
            {cluster.areaId ? (
              <button
                onClick={() => onFocus(cluster.areaId!)}
                className="truncate text-left text-[13px] font-extrabold uppercase tracking-[0.04em] text-ink hover:underline"
              >
                {cluster.label}
                {countLabel}
              </button>
            ) : (
              <h3 className="truncate text-[13px] font-extrabold uppercase tracking-[0.04em] text-ink">
                {cluster.label}
                {countLabel}
              </h3>
            )}
          </>
        )}
        {cluster.person && (
          <span className="text-[13px] font-extrabold text-ink">
            ×{cluster.pieces.length}
          </span>
        )}
      </header>
      {cluster.pieces.length === 0 ? (
        <div
          data-drop={cluster.areaId}
          className="grid h-20 place-items-center rounded-xl border-2 border-dashed border-line text-xs text-muted"
        >
          free spot
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-2 gap-y-2">
          {shown.map((p, i) => (
            <li key={p.id} className={i % 2 === 1 ? "mt-3" : ""}>
              <MiniPiece
                piece={p}
                highlighted={p.id === highlight}
                tilt={i % 3 === 0 ? -2 : i % 3 === 1 ? 1.5 : -0.5}
              />
            </li>
          ))}
          {extra > 0 && cluster.areaId && (
            <li className="mt-3">
              <button
                onClick={() => onFocus(cluster.areaId!)}
                className="grid h-[92px] w-full place-items-center rounded-xl border-[1.5px] border-dashed border-line text-xs font-semibold text-muted hover:border-ink"
              >
                +{extra} more
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function MiniPiece({
  piece,
  highlighted,
  tilt,
}: {
  piece: LorePiece
  highlighted?: boolean
  tilt: number
}) {
  const { areas } = useStore()
  return (
    <Link
      to={`/lore/${piece.id}`}
      data-piece={piece.id}
      style={{ rotate: `${tilt}deg` }}
      className={`block overflow-hidden rounded-xl bg-white p-1 transition-transform hover:z-10 hover:scale-[1.04] ${
        highlighted
          ? "animate-glow border-2 border-ink shadow-offset"
          : "border-[1.5px] border-line"
      }`}
    >
      <Photo
        src={piece.photos[0]}
        alt=""
        tint={(areas[piece.area]?.tint ?? "yellow") as Tint}
        className="h-[52px] w-full rounded-lg"
      />
      <span
        className={`mt-1 line-clamp-2 min-h-[26px] px-0.5 text-[11px] leading-[1.2] text-ink ${
          highlighted ? "font-semibold" : ""
        }`}
      >
        {piece.title}
      </span>
    </Link>
  )
}

function AreaFocus({
  cluster,
  highlight,
  onBack,
}: {
  cluster: Cluster
  highlight?: string
  onBack: () => void
}) {
  return (
    <div
      className="animate-page-in pb-6 pl-6 pr-4 pt-3"
      data-drop={cluster.areaId}
    >
      <button
        onClick={onBack}
        className="mb-3 inline-flex h-8 items-center gap-1 rounded-full border-[1.5px] border-line bg-white pl-1.5 pr-3 text-[13px] font-semibold hover:border-ink"
      >
        <Icon name="chevronLeft" size={18} /> All areas
      </button>
      <h2 className="mb-3 text-[22px] font-extrabold uppercase tracking-[0.02em] text-ink">
        {cluster.label} ×{cluster.pieces.length}
      </h2>
      <ul className="grid grid-cols-2 gap-3">
        {[...cluster.pieces].reverse().map((p, i) => (
          <li key={p.id} className={i % 2 ? "mt-4" : ""}>
            <Link
              to={`/lore/${p.id}`}
              data-piece={p.id}
              className={`block rounded-2xl bg-white p-1.5 transition-transform hover:-translate-y-0.5 ${
                p.id === highlight
                  ? "animate-glow border-2 border-ink"
                  : "border-[1.5px] border-line"
              }`}
            >
              <Photo
                src={p.photos[0]}
                alt=""
                className="aspect-[4/3] w-full rounded-xl"
              />
              <span className="mt-1.5 block px-1 text-sm font-bold leading-tight">
                {p.title}
              </span>
              <span className="block px-1 pb-1 text-xs text-muted">
                {relativeDays(p.date, TODAY)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Plans sit on the board in dashed blue — not lore until someone adds a recap. */
function PlanCard({ plan }: { plan: Plan }) {
  const navigate = useNavigate()
  const option = lockedOption(plan)
  const locked = plan.status === "locked" && option
  return (
    <article
      data-plan={plan.id}
      className="relative animate-pop-in overflow-hidden rounded-[22px] border-2 border-dashed border-plezi bg-agent p-3"
    >
      <Link
        to="/keeper"
        className="absolute inset-0 rounded-[22px]"
        aria-label={`Open the Lore Keeper thread for ${option?.title ?? "this plan"}`}
      />
      <p className="text-xs font-extrabold uppercase tracking-[0.04em] text-ink">
        {locked ? "Coming up" : "Planning"}
      </p>
      {locked ? (
        <>
          <p className="mt-1 text-[15px] font-bold leading-tight text-ink">
            {option.title}
          </p>
          <p className="text-[13px] text-ink">
            {option.day} {option.time} · {relativeDays(option.date, TODAY)}
          </p>
          <p className="mt-1.5 text-xs leading-snug text-muted">
            Not lore yet — add a recap after
          </p>
          <Button
            className="relative z-10 mt-2.5 h-9 w-full rounded-[10px] px-3 text-sm"
            onClick={() => navigate(`/lore/new?plan=${plan.id}`)}
          >
            We went
          </Button>
        </>
      ) : plan.status === "checking" ? (
        <p className="mt-1 text-[13px] leading-snug text-ink">
          Lore Keeper is checking calendars…
        </p>
      ) : (
        <>
          <p className="mt-1 text-[15px] font-bold leading-tight text-ink">
            Pick one
          </p>
          <p className="text-[13px] text-ink">
            {plan.options.length} options · {votedCount(plan)}/{GROUP.size}{" "}
            voted
          </p>
          <p className="mt-1.5 text-xs leading-snug text-muted">
            {plan.status === "review"
              ? "Waiting for you to confirm"
              : "Vote in the Lore Keeper thread"}
          </p>
        </>
      )}
    </article>
  )
}

/** Rekindler: “one year ago today”, with the saved quote and a way to do it again. */
function OnThisDay({ piece }: { piece: LorePiece }) {
  const years = Number(TODAY.slice(0, 4)) - Number(piece.date.slice(0, 4))
  const quote = piece.quotes[0]
  return (
    <article className="relative animate-pop-in overflow-hidden rounded-[22px] border-2 border-dashed border-plezi bg-agent p-3">
      <Link to={`/lore/${piece.id}`} className="absolute inset-0 rounded-[22px]" aria-label={`Open ${piece.title}`} />
      <p className="text-xs font-extrabold uppercase tracking-[0.04em] text-ink">
        {years === 1 ? "One year ago today" : `${years} years ago today`}
      </p>
      {piece.photos[0] ? (
        <img src={piece.photos[0]} alt="" className="mt-2 aspect-[4/3] w-full rounded-xl border-[1.5px] border-ink object-cover" />
      ) : null}
      <p className="mt-2 text-[15px] font-bold leading-tight text-ink">{piece.title}</p>
      <p className="text-[12.5px] text-muted">{fmtShort(piece.date)} · {piece.place}</p>
      {quote ? (
        <p className="mt-1.5 font-display text-[17px] leading-tight text-ink">
          “{quote.text}” <span className="text-muted">— {nameOf(quote.by)}</span>
        </p>
      ) : null}
      <Link
        to={`/keeper?again=${piece.id}`}
        className="relative z-10 mt-2.5 flex h-9 w-full items-center justify-center rounded-[10px] bg-ink px-3 text-sm font-bold text-white"
      >
        Do it again
      </Link>
    </article>
  )
}

type Draft = {
  id: string
  kind: string
  title: string
  date?: string
  place?: string
  note?: string
  quotes?: { text: string; by: string }[]
}

/** Scribe drafts are agent-made, so they stay dashed-blue until a person accepts them. */
function ScribeDrafts({ drafts, onDone }: { drafts: Draft[]; onDone: (id: string) => void }) {
  const act = async (id: string, what: "accept" | "dismiss") => {
    onDone(id)
    await fetch("/api/scribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ [what]: id }) }).catch(() => {})
  }
  const shown = drafts.slice(0, 3)
  return (
    <article className="animate-pop-in rounded-[22px] border-2 border-dashed border-plezi bg-agent p-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.04em] text-ink">Scribe found · from #plans</p>
      <ul className="mt-1.5 flex flex-col gap-2.5">
        {shown.map((d) => (
          <li key={d.id} className="rounded-xl border-[1.5px] border-dashed border-plezi bg-white/70 p-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-plezi">{d.kind.replace("_", " ")}</p>
            <p className="text-[14px] font-bold leading-tight text-ink">{d.title}</p>
            {d.date || d.place ? <p className="text-[12px] text-muted">{[d.date ? fmtShort(d.date) : "", d.place].filter(Boolean).join(" · ")}</p> : null}
            {d.note ? <p className="text-[12px] leading-snug text-muted">{d.note}</p> : null}
            {(d.quotes ?? []).slice(0, 2).map((q, i) => (
              <p key={i} className="mt-1 font-display text-[16px] leading-tight text-ink">
                “{q.text}” <span className="text-muted">— {q.by}</span>
              </p>
            ))}
            {d.kind === "lore_candidate" ? (
              <div className="mt-2 flex flex-col items-stretch gap-1">
                <button type="button" onClick={() => act(d.id, "accept")} className="h-8 w-full whitespace-nowrap rounded-[10px] bg-ink px-2 text-[13px] font-bold text-white">Add to lore</button>
                <button type="button" onClick={() => act(d.id, "dismiss")} className="h-7 w-full whitespace-nowrap text-[12px] font-semibold text-muted underline">Not now</button>
              </div>
            ) : (
              <button type="button" onClick={() => act(d.id, "dismiss")} className="mt-1.5 text-[12px] font-semibold text-muted underline">Noted</button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] leading-snug text-muted">Quotes are checked word for word against the messages. Only people who linked with /iam are read.</p>
    </article>
  )
}

/** Only the re-included person sees this, in their own book. Nobody else knows. */
/** Private to the person viewing: built only from moments the two of them already share. */
function ReconnectCard({ r }: { r: Reconnect }) {
  const { people, areas } = useStore()
  const key = `fgl:nudge:${TODAY}:${ME}:${r.friend}`
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1"
    } catch {
      return false
    }
  })
  if (hidden) return null
  const friend = people[r.friend]
  const m = r.memory
  const quote = m.quotes.find((q) => q.by === r.friend) ?? m.quotes[0]
  const when =
    r.why === "anniversary" ? "one year ago today" : r.why === "last" ? "last time" : relativeDays(m.date, TODAY)
  const chips = [
    `${r.together} hangouts together`,
    r.topArea ? `${areas[r.topArea.area]?.label ?? r.topArea.area} ×${r.topArea.count} together` : null,
    r.sharedHobbies[0] ? `you both love ${r.sharedHobbies[0].toLowerCase()}` : null,
  ].filter(Boolean) as string[]
  return (
    <article data-nudge className="relative animate-pop-in rounded-[22px] border-2 border-dashed border-plezi bg-agent p-3">
      <p className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-ink">
        <Icon name="lock" size={13} /> For you · only you see this
      </p>
      <p className="mt-1.5 text-[16px] font-extrabold leading-[1.15] text-ink">
        You and {friend.name} haven’t hung out in {r.days} days
      </p>
      <Link
        to={`/lore/${m.id}`}
        className="mt-2.5 block -rotate-[1.5deg] rounded-xl border-[1.5px] border-ink bg-white p-1.5 pb-1 transition-transform hover:rotate-0"
      >
        <Photo
          src={m.photos[0]}
          alt=""
          tint={(areas[m.area]?.tint ?? "yellow") as Tint}
          label={m.title}
          className="aspect-[4/3] w-full rounded-lg"
        />
        <span className="mt-1 block font-display text-[16px] font-bold leading-tight text-ink">
          {when} · {m.title}
        </span>
      </Link>
      {quote ? (
        <p className="mt-2 font-display text-[17px] leading-tight text-ink">
          “{quote.text}” <span className="text-muted">— {nameOf(quote.by)}</span>
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {chips.map((c) => (
          <span key={c} className="rounded-full border-[1.5px] border-dashed border-plezi bg-white px-2 py-0.5 text-[11.5px] font-semibold text-ink">
            {c}
          </span>
        ))}
      </div>
      <Link
        to={`/keeper?with=${r.friend}`}
        className="mt-2.5 flex h-9 w-full items-center justify-center whitespace-nowrap rounded-[10px] bg-ink px-2 text-[13.5px] font-bold text-white"
      >
        Plan something with {friend.name}
      </Link>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(key, "1")
          } catch {
            /* private mode */
          }
          setHidden(true)
        }}
        className="mt-0.5 h-7 w-full text-[12px] font-semibold text-muted underline"
      >
        Not now
      </button>
    </article>
  )
}

function SavedSpot() {
  return (
    <Link to="/me/agent" className="block animate-pop-in rounded-[22px] border-2 border-dashed border-plezi bg-agent p-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.04em] text-ink">From your agent · only you</p>
      <p className="mt-1 text-[15px] font-bold leading-tight text-ink">Saved you a spot</p>
      <p className="mt-1 text-xs leading-snug text-muted">
        This weekend’s options were picked to work for you. Nobody else knows why.
      </p>
    </Link>
  )
}

function FreeSpot() {
  return (
    <div
      data-drop="free"
      className="mx-auto grid h-24 w-[100px] place-items-center rounded-2xl border-2 border-dashed border-line text-xs text-muted"
    >
      free spot
    </div>
  )
}

/** The old board's "Plan this weekend": shown while nothing is being planned. */
function PlanPrompt() {
  return (
    <Link
      to="/keeper?compose=1"
      className="group block rounded-[22px] border-2 border-dashed border-plezi bg-agent p-3 transition-colors hover:bg-white"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.04em] text-ink">
        Nothing planned
      </p>
      <p className="mt-1 text-[15px] font-bold leading-tight text-ink">
        Plan this weekend
      </p>
      <p className="mt-1 text-xs leading-snug text-muted">
        Lore Keeper checks everyone’s agent privately and brings back 3 options.
      </p>
      <span className="mt-2 inline-flex items-center gap-0.5 text-sm font-bold text-ink">
        Start{" "}
        <Icon
          name="chevronRight"
          size={16}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------------------------
// Pointer drag for the "New lore" pill (HTML5 drag doesn't work on touch).

type DragApi = { start: (e: ReactPointerEvent<HTMLButtonElement>) => void }

function DragLayer({ children }: { children: (api: DragApi) => ReactNode }) {
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)
  const [ghost, setGhost] = useState<{
    x: number
    y: number
    target?: string
  } | null>(null)

  const start = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const origin = { x: e.clientX, y: e.clientY }
    let dragging = false
    let over: HTMLElement | null = null
    const scroller = root.current?.querySelector<HTMLElement>("[data-canvas]")

    const setOver = (next: HTMLElement | null) => {
      if (over === next) return
      over?.removeAttribute("data-over")
      next?.setAttribute("data-over", "true")
      over = next
    }
    const move = (ev: PointerEvent) => {
      if (
        !dragging &&
        Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 6
      )
        return
      if (!dragging) {
        dragging = true
        root.current?.setAttribute("data-dragging", "true")
      }
      const hit =
        document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest<HTMLElement>("[data-drop]") ?? null
      setOver(hit)
      setGhost({ x: ev.clientX, y: ev.clientY, target: hit?.dataset.drop })
      if (scroller) {
        const r = scroller.getBoundingClientRect()
        if (ev.clientY < r.top + 48) scroller.scrollBy(0, -10)
        else if (ev.clientY > r.bottom - 48 && ev.clientY < r.bottom + 40)
          scroller.scrollBy(0, 10)
      }
    }
    const end = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", end)
      el.removeEventListener("pointercancel", cancel)
      root.current?.removeAttribute("data-dragging")
      const target = over?.dataset.drop
      setOver(null)
      setGhost(null)
      if (!dragging) return navigate("/lore/new")
      if (target)
        navigate(target === "free" ? "/lore/new" : `/lore/new?area=${target}`)
    }
    const cancel = () => {
      dragging = false
      over = null
      end()
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", end)
    el.addEventListener("pointercancel", cancel)
  }

  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col">
      {children({ start })}
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[130%]"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <span
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-lg ${
              ghost.target ? "bg-plezi text-white" : "bg-ink text-white"
            }`}
          >
            <span className="grid size-5 place-items-center rounded bg-paper">
              <Icon name="plus" size={14} />
            </span>
            New lore
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

function FilterSheet({
  lens,
  who,
  onClose,
  onLens,
  onWho,
}: {
  lens: Lens
  who: PersonId[]
  onClose: () => void
  onLens: (l: Lens) => void
  onWho: (ids: PersonId[]) => void
}) {
  const { people } = useStore()
  const toggle = (id: PersonId) =>
    onWho(who.includes(id) ? who.filter((w) => w !== id) : [...who, id])
  return (
    <Sheet title="Group and filter" onClose={onClose}>
      <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em]">
        Group pieces by
      </p>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {LENSES.map((l) => (
          <button
            key={l.id}
            onClick={() => onLens(l.id)}
            aria-pressed={lens === l.id}
            className={`h-11 rounded-xl border-[1.5px] text-sm font-semibold ${
              lens === l.id
                ? "border-ink bg-ink text-white"
                : "border-line bg-white hover:border-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em]">
        Only lore with
      </p>
      <div className="flex flex-wrap gap-2">
        {PEOPLE_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => toggle(id)}
            aria-pressed={who.includes(id)}
            className={`rounded-full transition-opacity ${
              who.includes(id)
                ? "outline-2 outline-offset-2 outline-ink"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            <NameTag person={people[id]} size="sm" />
          </button>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        <Button
          tone="secondary"
          className="flex-1"
          onClick={() => onWho([])}
          disabled={!who.length}
        >
          Clear people
        </Button>
        <Button className="flex-1" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}
