import { useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router"
import { listNames } from "../agent/text"
import { ME, PEOPLE_ORDER, PIECE_ORDER, PIECES } from "../data/seed"
import type { PersonId, Profile as ProfileT } from "../data/types"
import { fmtShort } from "../lib/dates"
import {
  connections,
  loreWith,
  newestFirst,
  profileStats,
} from "../state/selectors"
import { useActions, useStore } from "../state/store"
import { Icon } from "../ui/Icon"
import {
  AgentBox,
  Button,
  Card,
  Creature,
  NameTag,
  Photo,
  Pill,
  SquareButton,
  TINT_BG,
} from "../ui/kit"
import { NotFound } from "./NotFound"

const H = "text-base font-extrabold uppercase text-ink"

export function Profile() {
  const params = useParams()
  const navigate = useNavigate()
  const { lore, people, profiles, areas } = useStore()
  const { setPiece } = useActions()
  const [showMatches, setShowMatches] = useState(false)

  if (params.id === ME) return <Navigate to="/me" replace />
  const id = (params.id ?? ME) as PersonId
  if (!PEOPLE_ORDER.includes(id))
    return <NotFound what="Nobody by that name is in this book." />

  const own = id === ME
  const person = people[id]
  const profile = profiles[id]
  const stats = profileStats(lore, id, areas)
  const mine = loreWith(lore, id)
  const added = lore.filter((p) => p.addedBy === id).sort(newestFirst)
  const friends = connections(lore, id)
  const me = profiles[ME]
  const sharedHobbies = own
    ? []
    : profile.hobbies.filter((h) => me.hobbies.includes(h))
  const matches = own
    ? PEOPLE_ORDER.filter((p) => p !== ME)
        .map((p) => ({
          p,
          shared: profiles[p].hobbies.filter((h) => me.hobbies.includes(h)),
        }))
        .filter((m) => m.shared.length)
    : []
  const takenBy = (tint: string) =>
    PEOPLE_ORDER.find((p) => p !== id && people[p].piece === tint)

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6 pl-6 pr-4 pt-1">
      <div className="flex animate-page-in flex-col gap-3.5">
        <Card className="flex flex-col gap-3 p-3.5">
          <div className="flex gap-3">
            <Photo
              src={profile.photo}
              alt={`${person.name}’s photo`}
              className="size-[140px] shrink-0 rounded-xl"
            />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <div className="flex w-full items-start justify-between gap-2">
                <Creature person={person} size={48} />
                {own && (
                  <SquareButton
                    icon="pencil"
                    label="Edit profile"
                    onClick={() => navigate("/me/edit")}
                  />
                )}
              </div>
              <AgentBox className="rounded-[10px] px-2.5 py-1.5">
                <p className="text-sm font-bold leading-tight text-ink">
                  {stats.line}
                </p>
              </AgentBox>
              {profile.aka && (
                <p className="text-sm font-semibold text-ink">
                  AKA {profile.aka}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-extrabold uppercase leading-none text-ink">
              {profile.fullName} · {profile.age}
            </h1>
            <Pill>{profile.city}</Pill>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.vibes.map((v) => (
              <Pill key={v}>{v}</Pill>
            ))}
          </div>
          <p className="text-[13px] text-muted">
            {own
              ? "Your email and phone are visible to your groups only."
              : `Contact details are shared inside ${profile.groups[0]?.name ?? "your groups"} only.`}
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col gap-2.5 p-3.5">
            <h2 className={H}>Hobbies</h2>
            <ul className="flex flex-col gap-2.5 text-[15px] text-ink">
              {profile.hobbies.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <div className="flex-1" />
            {own ? (
              <>
                <Button
                  tone="secondary"
                  className="w-full px-2 text-sm"
                  aria-expanded={showMatches}
                  onClick={() => setShowMatches((s) => !s)}
                >
                  Your matches
                </Button>
                {showMatches && (
                  <ul className="flex flex-col gap-1 text-xs text-ink">
                    {matches.map((m) => (
                      <li key={m.p}>
                        <Link
                          to={`/people/${m.p}`}
                          className="font-bold hover:underline"
                        >
                          {people[m.p].name}
                        </Link>{" "}
                        · {m.shared.join(", ")}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-xs text-muted">
                {sharedHobbies.length
                  ? `In common with you: ${sharedHobbies.join(", ")}`
                  : "No hobbies in common yet"}
              </p>
            )}
          </Card>
          <div className="flex min-w-0 flex-col gap-3">
            <Card className="flex flex-col gap-2 p-3.5">
              <h2 className={H}>Activity</h2>
              <p className="flex items-center gap-2 text-sm text-ink">
                <span
                  aria-hidden
                  className={`size-9 shrink-0 rounded-xl ${TINT_BG[PIECES[person.piece].tint]}`}
                />
                {profile.activity}
              </p>
            </Card>
            <Card className="flex flex-col gap-2 p-3.5">
              <h2 className={H}>Favourite meme</h2>
              {profile.meme ? (
                <img
                  src={profile.meme}
                  alt={`${person.name}’s favourite meme`}
                  className="h-[90px] w-full rounded-xl object-cover"
                />
              ) : (
                <p className="grid h-[90px] place-items-center rounded-xl bg-chip text-xs text-muted">
                  No meme yet
                </p>
              )}
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col items-start gap-2.5 p-3.5">
            <h2 className={H}>Connections</h2>
            {friends.map(({ person: f, together }) => (
              <Link
                key={f}
                to={f === ME ? "/me" : `/people/${f}`}
                className="rounded-full transition-transform hover:-translate-y-0.5"
                title={`${together} pieces of lore together`}
              >
                <NameTag person={people[f]} size="sm" />
              </Link>
            ))}
            {friends.length === 0 && (
              <p className="text-xs text-muted">
                Shows up once there’s lore together.
              </p>
            )}
          </Card>
          <AgentBox className="flex flex-col gap-2.5 rounded-[20px] p-3.5">
            <h2 className={H}>Statistics</h2>
            {profile.groups.map((g) => (
              <div key={g.name} className="text-ink">
                <p className="text-lg font-bold leading-tight">{g.days} days</p>
                <p className="text-sm">{g.name}</p>
              </div>
            ))}
            {friends[0] && (
              <p className="text-xs text-ink">
                Most lore with {people[friends[0].person].name} (
                {friends[0].together})
              </p>
            )}
          </AgentBox>
        </div>

        <Card className="flex items-center gap-3.5 p-3.5">
          <span
            className={`grid size-20 shrink-0 place-items-center rounded-xl ${TINT_BG[PIECES[person.piece].tint]}`}
          >
            <Creature person={person} size={52} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 className={H}>
              {own ? "My puzzle piece" : `${person.name}’s puzzle piece`}
            </h2>
            <p className="text-[13px] text-muted">
              Shows up next to {own ? "your" : "their"} name in every book{" "}
              {own ? "you’re" : "they’re"} in.
            </p>
            <div
              className="flex gap-1.5"
              role={own ? "radiogroup" : undefined}
              aria-label="Piece colour"
            >
              {PIECE_ORDER.map((tint) => {
                const taken = takenBy(tint)
                const current = person.piece === tint
                return own ? (
                  <button
                    key={tint}
                    role="radio"
                    aria-checked={current}
                    aria-label={`${tint}${
                      taken ? `, ${people[taken].name}’s colour` : ""
                    }`}
                    title={taken ? `${people[taken].name}’s colour` : tint}
                    disabled={!!taken}
                    onClick={() => setPiece(id, tint)}
                    className={`size-6 rounded-full border-[1.5px] border-ink ${TINT_BG[tint]} ${
                      current ? "outline-2 outline-offset-2 outline-ink" : ""
                    } disabled:opacity-30`}
                  />
                ) : (
                  <span
                    key={tint}
                    aria-hidden
                    className={`size-6 rounded-full border-[1.5px] border-ink ${TINT_BG[tint]} ${
                      current
                        ? "outline-2 outline-offset-2 outline-ink"
                        : "opacity-30"
                    }`}
                  />
                )
              })}
            </div>
          </div>
        </Card>

        <AgentBox
          className="flex flex-col gap-2.5 rounded-[20px] p-3.5"
          as="section"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className={H}>
              {own ? "Lore you’re in" : `Lore ${person.name}’s in`}
            </h2>
            {mine.length > 3 && (
              <Link
                to={`/board?by=people&who=${id}`}
                className="text-xs font-bold text-plezi hover:underline"
              >
                All {mine.length}
              </Link>
            )}
          </div>
          {mine.length ? (
            <ul className="grid grid-cols-3 gap-2">
              {mine.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/lore/${p.id}`}
                    className="group flex flex-col gap-1"
                  >
                    <Photo
                      src={p.photos[0]}
                      alt=""
                      className="h-[90px] w-full rounded-xl border-[1.5px] border-line transition-transform group-hover:-translate-y-0.5"
                    />
                    <span className="text-xs font-bold leading-tight text-ink">
                      {p.title}
                    </span>
                    <span className="text-xs text-ink">{fmtShort(p.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing yet.</p>
          )}
        </AgentBox>

        <Card className="flex flex-col gap-2 p-3.5" as="section">
          <h2 className={H}>Added to the lore</h2>
          {added.length ? (
            <ul className="flex flex-col">
              {added.map((p) => (
                <li
                  key={p.id}
                  className="border-t border-hair first:border-t-0"
                >
                  <Link
                    to={`/lore/${p.id}`}
                    className="flex items-center gap-2 py-2 hover:opacity-80"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {p.title}
                    </span>
                    <span className="text-xs text-muted">
                      {fmtShort(p.date)}
                    </span>
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {own ? "You haven’t" : `${person.name} hasn’t`} added any lore
              yet.
            </p>
          )}
        </Card>

        {profile.knownAs.length > 0 && (
          <Card className="flex flex-col gap-2.5 p-3.5" as="section">
            <h2 className={H}>Known as</h2>
            <div className="grid grid-cols-2 gap-2">
              {profile.knownAs.map((k) => (
                <div
                  key={k.name}
                  className="rounded-xl border-[1.5px] border-line p-2.5"
                >
                  <p className="text-sm font-bold text-ink">{k.name}</p>
                  <p className="text-[13px] text-ink">
                    {k.group}, from {listNames([k.from])}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {own && (
          <Link
            to="/me/agent"
            className="flex items-center gap-3 rounded-[20px] bg-ink p-3.5 transition-opacity hover:opacity-90"
          >
            <Icon name="lockWhite" size={24} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-white">
                My limits
              </span>
              <span className="block text-[13px] text-hair">
                Set privately with your own agent
              </span>
            </span>
            <Icon name="chevronRightWhite" size={20} />
          </Link>
        )}
      </div>
    </div>
  )
}

const splitList = (s: string) =>
  s.split(",")
    .map((x) => x.trim())
    .filter(Boolean)

/** Editing your own page. Stats and connections aren't editable — they come from the lore. */
export function ProfileEdit() {
  const navigate = useNavigate()
  const { profiles } = useStore()
  const { updateProfile, notify } = useActions()
  const p = profiles[ME]
  const [form, setForm] = useState({
    fullName: p.fullName,
    age: String(p.age),
    city: p.city,
    aka: p.aka ?? "",
    vibes: p.vibes.join(", "),
    hobbies: p.hobbies.join(", "),
    activity: p.activity,
  })
  const field = (key: keyof typeof form, label: string, hint?: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
        {label}
      </span>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        inputMode={key === "age" ? "numeric" : undefined}
        className="h-11 rounded-xl border-[1.5px] border-line bg-white px-3 text-[15px] outline-none focus:border-ink"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
  const valid = form.fullName.trim() && Number(form.age) > 0
  const save = () => {
    if (!valid) return
    const patch: Partial<ProfileT> = {
      fullName: form.fullName.trim(),
      age: Number(form.age),
      city: form.city.trim(),
      aka: form.aka.trim() || undefined,
      vibes: splitList(form.vibes),
      hobbies: splitList(form.hobbies),
      activity: form.activity.trim(),
    }
    updateProfile(ME, patch)
    notify("Profile saved")
    navigate("/me", { replace: true })
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-1 pl-6 pr-4 pt-1">
      <div className="flex shrink-0 items-center justify-between">
        <SquareButton
          icon="chevronLeft"
          label="Back to your profile"
          onClick={() => navigate("/me")}
        />
      </div>
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border-[1.5px] border-line bg-white"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-[18px]">
          <h1 className="text-[28px] font-extrabold uppercase leading-none text-ink">
            Edit profile
          </h1>
          <p className="text-[13px] text-muted">
            Hangouts, connections and “Lore you’re in” come from the lore, so
            they update on their own.
          </p>
          {field("fullName", "Name")}
          <div className="grid grid-cols-2 gap-2">
            {field("age", "Age")}
            {field("city", "City")}
          </div>
          {field("aka", "AKA")}
          {field("vibes", "Vibe tags", "Separate with commas")}
          {field("hobbies", "Hobbies", "Separate with commas")}
          {field("activity", "Right now")}
        </div>
        <div className="shrink-0 border-t-[1.5px] border-hair p-[18px] pt-3">
          <Button type="submit" className="w-full" disabled={!valid}>
            Save profile
          </Button>
        </div>
      </form>
    </div>
  )
}
