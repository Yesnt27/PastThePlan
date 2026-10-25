import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router"
import { lockedOption } from "../agent/planner"
import { nameOf } from "../agent/text"
import { ME, PEOPLE_ORDER, TODAY } from "../data/seed"
import type { PersonId, Quote } from "../data/types"
import { fmtWithDay } from "../lib/dates"
import { useActions, useStore, type LoreDraft } from "../state/store"
import { uploadPhoto } from "../state/sync"
import { Icon } from "../ui/Icon"
import {
  AgentBox,
  Button,
  ButtonLink,
  Pill,
  SectionLabel,
  SquareButton,
  TINT_BG,
} from "../ui/kit"
import { NotFound } from "./NotFound"

const BASE_AREAS = ["karaoke", "outdoors", "games", "food"]

/** One form for all three ways lore gets made: "+" by hand, "We went" on a plan, and editing. */
export function LoreForm({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { lore, plans, areas, people } = useStore()
  const actions = useActions()

  const existing = mode === "edit" ? lore.find((p) => p.id === id) : undefined
  const planId = mode === "new" ? params.get("plan") : null
  const plan = planId ? plans.find((p) => p.id === planId) : undefined
  const option = plan ? lockedOption(plan) : undefined
  const linked =
    plan?.status === "locked" && option ? { plan, option } : undefined

  const [draft, setDraft] = useState<LoreDraft>(() => {
    if (existing) {
      const { title, area, date, place, who, photos } = existing
      return {
        title,
        area,
        date,
        place,
        who,
        photos,
        story: existing.story ?? "",
        quotes: [],
      }
    }
    if (linked) {
      return {
        title: linked.option.title,
        area: linked.option.area,
        date: linked.option.date,
        place: linked.option.venue,
        who: linked.plan.coming.length ? linked.plan.coming : [ME],
        // The recap sent in chat is the story, word for word.
        story: linked.plan.recapStory ?? "",
        photos: [],
        quotes: [],
      }
    }
    const area = params.get("area")
    return {
      title: "",
      area: area && areas[area] ? area : "",
      date: TODAY,
      place: "",
      who: [ME],
      story: "",
      photos: [],
      quotes: [],
    }
  })
  const set = <K extends keyof LoreDraft>(key: K, value: LoreDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  // Object URLs for photos picked here but never saved are released on the way out.
  const saved = useRef(false)
  const created = useRef<string[]>([])
  useEffect(
    () => () => {
      if (!saved.current) created.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  const [newArea, setNewArea] = useState<string | null>(null)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [quoteText, setQuoteText] = useState("")
  const [quoteBy, setQuoteBy] = useState<PersonId | "">("")
  const fileInput = useRef<HTMLInputElement>(null)

  if (mode === "edit" && !existing)
    return <NotFound what="That lore piece isn’t in the book." />
  if (planId && !linked) {
    const done = plan?.status === "done" && plan.loreId
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-[15px] text-muted">
          {done
            ? "That plan is already in the lore."
            : "That plan isn’t locked in, so there’s nothing to recap yet."}
        </p>
        {done ? (
          <ButtonLink to={`/lore/${plan!.loreId}`}>Open the lore</ButtonLink>
        ) : (
          <ButtonLink to="/keeper">Open Lore Keeper</ButtonLink>
        )}
      </div>
    )
  }

  const areaIds = [
    ...BASE_AREAS,
    ...Object.keys(areas).filter((a) => !BASE_AREAS.includes(a)),
  ]
  const valid =
    draft.title.trim() &&
    draft.place.trim() &&
    draft.area &&
    draft.date &&
    draft.who.length
  const missing = [
    !draft.title.trim() && "a title",
    !draft.area && "an area",
    !draft.place.trim() && "a place",
    !draft.who.length && "who came",
  ].filter(Boolean)

  const togglePerson = (pid: PersonId) =>
    set(
      "who",
      draft.who.includes(pid)
        ? draft.who.filter((w) => w !== pid)
        : PEOPLE_ORDER.filter((p) => p === pid || draft.who.includes(p)),
    )

  const addPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/"))
    e.target.value = ""
    // Show each photo right away, then swap in its stored URL once the upload finishes.
    for (const f of files) {
      const local = URL.createObjectURL(f)
      created.current.push(local)
      setDraft((d) => ({ ...d, photos: [...d.photos, local] }))
      void uploadPhoto(f).then((remote) => {
        if (remote)
          setDraft((d) => ({ ...d, photos: d.photos.map((p) => (p === local ? remote : p)) }))
      })
    }
  }
  const removePhoto = (src: string) => {
    if (created.current.includes(src)) URL.revokeObjectURL(src)
    set(
      "photos",
      draft.photos.filter((p) => p !== src),
    )
  }

  const addQuote = () => {
    if (!quoteText.trim() || !quoteBy) return
    // Kept exactly as typed apart from surrounding whitespace.
    set("quotes", [...draft.quotes, { text: quoteText.trim(), by: quoteBy }])
    setQuoteText("")
    setQuoteBy("")
    setQuoteOpen(false)
  }

  const confirmArea = () => {
    if (!newArea?.trim()) return setNewArea(null)
    set("area", actions.addArea(newArea))
    setNewArea(null)
  }

  const save = () => {
    if (!valid) return
    saved.current = true
    if (existing) {
      const { quotes, ...patch } = draft
      actions.updateLore(
        existing.id,
        { ...patch, story: patch.story.trim() ? patch.story : undefined },
        quotes,
      )
      navigate(`/lore/${existing.id}`, { replace: true })
      return
    }
    actions.saveLore(draft, { planId: linked?.plan.id })
    navigate("/board", { replace: true })
  }

  const back = () =>
    location.key !== "default" ? navigate(-1) : navigate("/board")
  const heading = existing ? "Edit lore" : "New lore"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-1 pl-6 pr-4 pt-1">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <SquareButton icon="chevronLeft" label="Back" onClick={back} />
        {linked && (
          <Pill agent>Linked to: {linked.option.title} (planned)</Pill>
        )}
      </div>

      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border-[1.5px] border-line bg-white"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-[18px] pb-3">
          <div>
            <h1 className="text-[28px] font-extrabold uppercase leading-none text-ink">
              {heading}
            </h1>
            {linked ? (
              <p className="mt-1 text-sm text-muted">
                {fmtWithDay(draft.date)} · {draft.place}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                {existing
                  ? `Added by ${nameOf(existing.addedBy)}`
                  : "Not linked to a plan"}
              </p>
            )}
          </div>

          {!linked && (
            <div className="flex flex-col gap-2.5">
              <Field label="Title">
                <input
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="What do you call it?"
                  className={INPUT}
                />
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field label="Place">
                  <input
                    value={draft.place}
                    onChange={(e) => set("place", e.target.value)}
                    placeholder="Where were you?"
                    className={INPUT}
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    value={draft.date}
                    max="2027-12-31"
                    onChange={(e) => set("date", e.target.value)}
                    className={`${INPUT} w-[9.5rem]`}
                  />
                </Field>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
                  Area
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {areaIds.map((a) => (
                    <button
                      type="button"
                      key={a}
                      aria-pressed={draft.area === a}
                      onClick={() => set("area", a)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-sm ${
                        draft.area === a
                          ? "border-ink bg-ink font-semibold text-white"
                          : "border-line bg-white text-ink hover:border-ink"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`size-2.5 rounded-full ${TINT_BG[areas[a]?.tint ?? "yellow"]}`}
                      />
                      {areas[a]?.label ?? a}
                    </button>
                  ))}
                  {newArea === null ? (
                    <button
                      type="button"
                      onClick={() => setNewArea("")}
                      className="h-9 rounded-full border-[1.5px] border-dashed border-ink px-3 text-sm font-semibold"
                    >
                      + New area
                    </button>
                  ) : (
                    <span className="inline-flex h-9 items-center gap-1 rounded-full border-[1.5px] border-ink pl-3 pr-1">
                      <input
                        autoFocus
                        value={newArea}
                        onChange={(e) => setNewArea(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            confirmArea()
                          }
                          if (e.key === "Escape") setNewArea(null)
                        }}
                        placeholder="Area name"
                        aria-label="New area name"
                        className="w-28 bg-transparent text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={confirmArea}
                        aria-label="Add area"
                        className="grid size-7 place-items-center rounded-full bg-ink"
                      >
                        <Icon name="checkWhite" size={14} />
                      </button>
                    </span>
                  )}
                </div>
              </fieldset>
            </div>
          )}

          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={addPhotos}
              aria-label="Add photos"
              tabIndex={-1}
            />
            {draft.photos.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex h-[110px] w-full flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-line bg-shell text-muted hover:border-ink"
              >
                <Icon name="plus" size={28} />
                <span className="text-xs">Add photos</span>
              </button>
            ) : (
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {draft.photos.map((src) => (
                  <div key={src} className="relative shrink-0">
                    <img
                      src={src}
                      alt=""
                      className="size-[110px] rounded-[14px] border-[1.5px] border-line object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(src)}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-white/90 shadow"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  aria-label="Add more photos"
                  className="grid size-[110px] shrink-0 place-items-center rounded-[14px] border-2 border-dashed border-line bg-shell hover:border-ink"
                >
                  <Icon name="plus" size={24} />
                </button>
              </div>
            )}
          </div>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
              Who came
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {PEOPLE_ORDER.map((pid) => {
                const on = draft.who.includes(pid)
                return (
                  <label
                    key={pid}
                    className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] pl-2.5 pr-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-plezi ${
                      on
                        ? "border-solid border-ink text-ink"
                        : "border-dashed border-line text-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => togglePerson(pid)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`grid size-[18px] place-items-center rounded border-[1.5px] border-ink ${
                        on ? "bg-ink" : "bg-white"
                      }`}
                    >
                      {on && <Icon name="checkWhite" size={14} />}
                    </span>
                    {people[pid].name}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="story"
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
            >
              The story
            </label>
            <textarea
              id="story"
              value={draft.story}
              onChange={(e) => set("story", e.target.value)}
              placeholder="What happened, in your words"
              rows={3}
              className="w-full resize-none rounded-xl border-[1.5px] border-line px-3 py-2.5 text-[15px] leading-[1.4] outline-none focus:border-ink"
            />
            {linked?.plan.recapStory &&
              draft.story === linked.plan.recapStory && (
                <p className="mt-1 text-xs text-muted">
                  From your recap in Lore Keeper, exactly as you sent it.
                </p>
              )}
          </div>

          <div className="flex flex-col gap-2">
            <SectionLabel aside="saved word for word">Quotes</SectionLabel>
            {existing?.quotes.map((q) => (
              <QuoteRow key={q.id} quote={q} locked />
            ))}
            {draft.quotes.map((q, i) => (
              <QuoteRow
                key={i}
                quote={q}
                onRemove={() =>
                  set(
                    "quotes",
                    draft.quotes.filter((_, j) => j !== i),
                  )
                }
              />
            ))}
            {quoteOpen ? (
              <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-ink p-2.5">
                <textarea
                  autoFocus
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="Type exactly what was said"
                  aria-label="Quote, exactly as said"
                  rows={2}
                  className="w-full resize-none rounded-lg bg-shell px-2.5 py-2 text-[15px] outline-none"
                />
                <p className="text-xs font-semibold text-muted">Who said it?</p>
                <div className="flex flex-wrap gap-1.5">
                  {(draft.who.length ? draft.who : PEOPLE_ORDER).map((pid) => (
                    <button
                      type="button"
                      key={pid}
                      aria-pressed={quoteBy === pid}
                      onClick={() => setQuoteBy(pid)}
                      className={`h-8 rounded-full border-[1.5px] px-3 text-[13px] font-semibold ${
                        quoteBy === pid
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-white hover:border-ink"
                      }`}
                    >
                      {people[pid].name}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted">
                  Saved as typed. Quotes can’t be edited once they’re in the
                  lore.
                </p>
                <div className="flex gap-2">
                  <Button
                    tone="secondary"
                    className="h-10 flex-1 text-sm"
                    onClick={() => setQuoteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="h-10 flex-1 text-sm"
                    onClick={addQuote}
                    disabled={!quoteText.trim() || !quoteBy}
                  >
                    Save quote
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                tone="dashed"
                className="w-full"
                onClick={() => setQuoteOpen(true)}
              >
                + Add a quote
              </Button>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t-[1.5px] border-hair px-[18px] pb-[18px] pt-3">
          {!valid && (
            <p className="mb-2 text-center text-xs text-muted">
              Add {missing.join(", ")} to save.
            </p>
          )}
          <Button type="submit" className="w-full" disabled={!valid}>
            {existing ? "Save changes" : "Add to the lore"}
          </Button>
          {existing && (
            <Link
              to={`/lore/${existing.id}`}
              className="mt-2 block text-center text-sm font-semibold text-muted hover:text-ink"
            >
              Discard changes
            </Link>
          )}
        </div>
      </form>
    </div>
  )
}

const INPUT =
  "h-11 w-full rounded-xl border-[1.5px] border-line bg-white px-3 text-[15px] outline-none focus:border-ink"

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
        {label}
      </span>
      {children}
    </label>
  )
}

function QuoteRow({
  quote,
  locked,
  onRemove,
}: {
  quote: Pick<Quote, "text" | "by">
  locked?: boolean
  onRemove?: () => void
}) {
  return (
    <AgentBox className="flex items-start gap-2 rounded-xl px-3 py-2.5">
      <p className="min-w-0 flex-1 text-[15px] text-ink">
        “{quote.text}” — {nameOf(quote.by)}
      </p>
      {locked ? (
        <span
          className="mt-0.5 shrink-0"
          title="Saved word for word — can’t be edited"
        >
          <Icon name="lock" size={16} />
          <span className="sr-only">Saved word for word, can’t be edited</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this quote"
          className="-mr-1 grid size-6 shrink-0 place-items-center rounded-full hover:bg-white"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </AgentBox>
  )
}
