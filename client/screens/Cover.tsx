import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { Link, useNavigate } from "react-router"
import { GROUP, ME, PEOPLE_ORDER, PIECES } from "../data/seed"
import type { Person } from "../data/types"
import { art } from "../lib/asset"
import { useStore } from "../state/store"
import { newestFirst } from "../state/selectors"
import { TINT_BG } from "../ui/kit"

/** Book units: every position below is in the 364 × 555 space of "01 Book – closed". */
const u = (n: number) => `calc(var(--u) * ${n})`
const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): CSSProperties => ({
  position: "absolute",
  left: u(left),
  top: u(top),
  width: u(width),
  height: u(height),
})

function Rotated({
  left,
  top,
  w,
  h,
  iw,
  ih,
  deg,
  children,
}: {
  left: number
  top: number
  w: number
  h: number
  iw: number
  ih: number
  deg: number
  children: ReactNode
}) {
  return (
    <div
      style={{
        ...box(left, top, w, h),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: u(iw),
          height: u(ih),
          transform: `rotate(${deg}deg)`,
          flex: "none",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** The first page under the cover: three polaroids, everyone's name tag, the group name. */
export function InsideCover({ interactive = true }: { interactive?: boolean }) {
  const { lore, people } = useStore()
  const recent = [...lore].sort(newestFirst).filter((p) => p.photos.length)
  const frames = [
    {
      left: 23.91,
      top: 122.99,
      w: 154.361,
      h: 202.008,
      iw: 120.126,
      ih: 181.452,
      deg: 11.68,
    },
    {
      left: 93.59,
      top: 122.99,
      w: 149.968,
      h: 202.488,
      iw: 120.294,
      ih: 184.713,
      deg: -9.8,
    },
    {
      left: 186.59,
      top: 121,
      w: 152.802,
      h: 203.996,
      iw: 120.294,
      ih: 184.713,
      deg: 10.81,
    },
  ]
  // Middle frame sits on top, like the comp.
  const order = [0, 2, 1]

  return (
    <div className="book-object relative w-full select-none overflow-hidden rounded-[6px] bg-[#fbf5ea] shadow-book">
      <img
        src={art.paperTexture}
        alt=""
        className="pointer-events-none absolute inset-0 size-full object-cover"
        draggable={false}
      />
      <div aria-hidden>
        <Rotated
          left={271.92}
          top={10}
          w={184.395}
          h={147.004}
          iw={112.189}
          ih={162.744}
          deg={-76.53}
        >
          <img
            src={art.creatureBlue}
            alt=""
            className="absolute inset-0 size-full"
            draggable={false}
          />
        </Rotated>
        <Rotated
          left={304.84}
          top={40.04}
          w={43.337}
          h={59.685}
          iw={53.785}
          ih={31.683}
          deg={-76.53}
        >
          <img
            src={art.creatureEyes}
            alt=""
            className="absolute inset-0 size-full"
            draggable={false}
          />
        </Rotated>
        <Rotated
          left={-50.62}
          top={-109.78}
          w={238.091}
          h={210.813}
          iw={199.408}
          ih={131.762}
          deg={-28.43}
        >
          <img
            src={art.creaturePurple}
            alt=""
            className="absolute inset-0 size-full"
            draggable={false}
          />
        </Rotated>
      </div>

      {order.map((i) => {
        const f = frames[i]
        const piece = recent[i]
        if (!piece) return null
        const inner = (
          <span
            className="absolute inset-0 flex flex-col overflow-hidden bg-white shadow-[0_3px_8px_rgba(0,0,0,0.22)]"
            style={{ borderRadius: u(13.147), padding: u(7) }}
          >
            <img
              src={piece.photos[0]}
              alt=""
              className="min-h-0 w-full flex-1 object-cover"
              style={{ borderRadius: u(7) }}
              draggable={false}
            />
            <span
              className="truncate text-center font-display font-bold leading-none text-ink"
              style={{ fontSize: u(13), paddingTop: u(7), paddingBottom: u(2) }}
            >
              {piece.title}
            </span>
          </span>
        )
        return (
          <Rotated
            key={piece.id}
            left={f.left}
            top={f.top}
            w={f.w}
            h={f.h}
            iw={f.iw}
            ih={f.ih}
            deg={f.deg}
          >
            {interactive ? (
              <Link
                to={`/lore/${piece.id}`}
                aria-label={`${piece.title} — open this lore`}
                className="absolute inset-0 transition-transform hover:scale-[1.03]"
              >
                {inner}
              </Link>
            ) : (
              inner
            )}
          </Rotated>
        )
      })}

      <div
        style={{
          position: "absolute",
          left: u(14.92),
          top: u(377),
          width: u(321),
        }}
        className="flex flex-col"
      >
        <ul
          className="grid grid-cols-3"
          style={{ columnGap: u(12), rowGap: u(7), height: u(103) }}
          aria-label="Members"
        >
          {PEOPLE_ORDER.map((id) => (
            <li key={id} className="min-w-0">
              {interactive ? (
                <Link
                  to={id === ME ? "/me" : `/people/${id}`}
                  className="block h-full rounded-[33px] transition-transform hover:-translate-y-0.5"
                  aria-label={`${people[id].name}’s page`}
                >
                  <CoverTag person={people[id]} />
                </Link>
              ) : (
                <CoverTag person={people[id]} />
              )}
            </li>
          ))}
        </ul>
        <h1
          className="font-display font-bold leading-none text-ink"
          style={{ fontSize: u(28), marginTop: u(10) }}
        >
          {GROUP.name}
        </h1>
      </div>

      <img
        aria-hidden
        src={art.creatureGreen}
        alt=""
        className="pointer-events-none absolute"
        style={box(258.92, 431, 200.769, 212.143)}
        draggable={false}
      />
    </div>
  )
}

/** Name tag at the comp's exact size (32px creature square, 16px name) in book units. */
function CoverTag({ person }: { person: Person }) {
  const piece = PIECES[person.piece]
  return (
    <span
      className={`flex h-full items-center overflow-hidden rounded-[33px] ${TINT_BG[piece.tint]}`}
      style={{ padding: u(8), gap: u(4) }}
    >
      <span
        aria-hidden
        className="grid shrink-0 place-items-center bg-paper"
        style={{ width: u(32), height: u(32), borderRadius: u(8) }}
      >
        <img
          src={piece.creature}
          alt=""
          style={{ width: u(piece.width), height: u(piece.height) }}
          draggable={false}
        />
      </span>
      <span
        className="min-w-0 truncate font-display font-bold leading-none tracking-[-0.01em] text-ink"
        style={{ fontSize: u(17) }}
      >
        {person.name}
      </span>
    </span>
  )
}

/** "01 Book – closed". Tapping the cover swings it open onto the inside cover. */
export function ClosedBook() {
  const navigate = useNavigate()
  const [opening, setOpening] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const open = () => {
    if (opening) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) return navigate("/book")
    setOpening(true)
    timer.current = setTimeout(() => navigate("/book"), 760)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-2">
      <div
        className="relative w-full max-w-[364px]"
        style={{
          perspective: "1600px",
          maxWidth: "min(364px, calc((100dvh - 190px) * 364 / 555))",
        }}
      >
        <InsideCover interactive={false} />
        <button
          type="button"
          onClick={open}
          aria-label="Book of friends — open the book"
          className={`book-object absolute inset-0 w-full origin-left overflow-hidden rounded-[6px] bg-binding text-left shadow-book [backface-visibility:hidden] [transform-style:preserve-3d] ${
            opening
              ? "animate-cover-open"
              : "transition-transform duration-200 hover:[transform:rotateY(-8deg)]"
          }`}
        >
          <img
            src={art.spine}
            alt=""
            className="pointer-events-none absolute inset-y-0 object-cover"
            style={{ left: u(18.39), width: u(22.331), height: "100%" }}
            draggable={false}
          />
          <img
            src={art.spine}
            alt=""
            className="pointer-events-none absolute inset-y-0 object-cover"
            style={{ left: u(13.14), width: u(22.331), height: "100%" }}
            draggable={false}
          />
          <span
            className="absolute left-1/2 -translate-x-1/2 text-center font-cover font-normal leading-[normal] text-white"
            style={{
              top: `calc(50% - ${u(47.5)})`,
              width: u(170),
              fontSize: u(40),
            }}
          >
            Book of friends
          </span>
        </button>
      </div>
      <p
        className={`mt-4 text-center text-[13px] text-muted transition-opacity ${
          opening ? "opacity-0" : ""
        }`}
      >
        Tap the cover to open The Wizards Pit’s book
      </p>
    </div>
  )
}

/** The open inside cover, as a page of its own. */
export function CoverPage() {
  const { lore, plans } = useStore()
  const coming = plans.filter((p) => p.status === "locked").length
  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-4 pt-1">
      <div
        className="w-full animate-page-in"
        style={{ maxWidth: "min(364px, calc((100dvh - 210px) * 364 / 555))" }}
      >
        <InsideCover />
      </div>
      <p className="mt-3 text-center text-[13px] text-muted">
        {lore.length} pieces of lore
        {coming ? ` · ${coming} plan coming up` : ""} · tap a name for their
        page
      </p>
      <Link
        to="/board"
        className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-ink bg-white px-4 text-sm font-bold text-ink hover:bg-paper"
      >
        Open the board
      </Link>
    </div>
  )
}
