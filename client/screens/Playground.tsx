import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { Link } from "react-router"
import { PIECES, TODAY } from "../data/seed"
import type { LorePiece, Person, PersonId, Tint } from "../data/types"
import { fmtShort } from "../lib/dates"
import type { Cluster, Lens } from "../state/selectors"
import { useStore } from "../state/store"
import { NameTag, Photo, TINT_HEX } from "../ui/kit"

/**
 * The board as a playground: an endless sheet of dotted paper you drag in any direction.
 * Lore pieces are polaroids scattered on islands (one per area, season or person); the agent's
 * cards sit in the middle, under “today”. Pieces can be picked up and moved; where you put them
 * is remembered on this device.
 */

// ---------------------------------------------------------------------------------------------
// Deterministic scatter, so the same board looks the same on every phone.

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function rand(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const SPACING = 112
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const HUB_W = 430
const MIN_Z = 0.45
const MAX_Z = 1.6

type Spot = { x: number; y: number }
type Placed = {
  key: string
  piece: LorePiece
  x: number
  y: number
  tilt: number
  island: Island
  order: number
}
type Island = {
  key: string
  cluster: Cluster
  x: number
  y: number
  r: number
  tint: Tint
  shape: string
}

const seasonTint = (label: string): Tint =>
  /winter/i.test(label)
    ? "blue"
    : /spring/i.test(label)
      ? "green"
      : /summer/i.test(label)
        ? "yellow"
        : "orange"

function layout(groups: Cluster[], lens: Lens, people: Record<PersonId, Person>) {
  const shown = groups.filter((c) => c.pieces.length || lens === "activity")
  const radius = shown.map((c) => SPACING * Math.sqrt(Math.max(c.pieces.length, 1)) * 0.92 + 80)
  // Islands sit just outside the "today" hub, and far enough apart not to collide.
  const ring = radius.reduce((a, r) => a + 2 * r + 60, 0) / (2 * Math.PI)
  const hubHalf = { x: HUB_W / 2 + 30, y: 330 }
  const clearHub = (angle: number, r: number) =>
    Math.min(hubHalf.x / Math.max(0.01, Math.abs(Math.cos(angle))), hubHalf.y / Math.max(0.01, Math.abs(Math.sin(angle)))) + r + 30
  const islands: Island[] = []
  const placed: Placed[] = []
  let order = 0
  shown.forEach((c, i) => {
    const s = hash(`${lens}:${c.key}`)
    const angle = -Math.PI / 2 + 0.42 + (i / shown.length) * Math.PI * 2 + (rand(s) - 0.5) * 0.25
    const dist = Math.max(clearHub(angle, radius[i]), ring)
    const x = Math.cos(angle) * dist + (rand(s + 1) - 0.5) * 50
    const y = Math.sin(angle) * dist + (rand(s + 2) - 0.5) * 50
    const tint: Tint =
      lens === "season"
        ? seasonTint(c.label)
        : lens === "people" && c.person
          ? PIECES[people[c.person]?.piece ?? "yellow"].tint
          : ((c.tint as Tint) ?? "yellow")
    const b = () => 38 + Math.round(rand(s + order++ * 7) * 24)
    const island: Island = {
      key: c.key,
      cluster: c,
      x,
      y,
      r: radius[i],
      tint,
      shape: `${b()}% ${100 - b()}% ${b()}% ${100 - b()}% / ${b()}% ${b()}% ${100 - b()}% ${100 - b()}%`,
    }
    islands.push(island)
    const newest = [...c.pieces].sort((a, z) => z.date.localeCompare(a.date))
    newest.forEach((p, k) => {
      const ps = hash(`${c.key}:${p.id}`)
      const r = k === 0 ? 0 : SPACING * Math.sqrt(k + 0.35)
      const th = k * GOLDEN + rand(ps) * 0.6 + rand(s) * 6.28
      placed.push({
        key: `${c.key}:${p.id}`,
        piece: p,
        x: x + Math.cos(th) * r * 1.12 + (rand(ps + 2) - 0.5) * 18,
        y: y + 20 + Math.sin(th) * r + (rand(ps + 3) - 0.5) * 18,
        tilt: (rand(ps + 4) - 0.5) * 14,
        island,
        order: placed.length,
      })
    })
  })
  return { islands, placed }
}

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

// ---------------------------------------------------------------------------------------------

export function Playground({
  lens,
  groups,
  hub,
  highlight,
  onIsland,
}: {
  lens: Lens
  groups: Cluster[]
  hub: ReactNode
  highlight?: string
  onIsland: (areaId: string) => void
}) {
  const { people } = useStore()
  const view = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const cam = useRef({ x: 0, y: 0, z: 1 })
  const anim = useRef<number | null>(null)
  const [, setTick] = useState(0)
  const tickPending = useRef(false)

  const { islands, placed } = useMemo(() => layout(groups, lens, people), [groups, lens, people])

  // Pieces you moved, per lens, on this device.
  const storeKey = `fgl:board:${lens}`
  const [moved, setMoved] = useState<Record<string, Spot>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) || "{}")
    } catch {
      return {}
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(moved))
    } catch {
      /* private mode */
    }
  }, [moved, storeKey])
  const [front, setFront] = useState<string | null>(null)
  const [lifted, setLifted] = useState<string | null>(null)

  const pos = (p: Placed): Spot => moved[p.key] ?? { x: p.x, y: p.y }

  // World bounds keep the camera from wandering into empty paper.
  const bounds = useMemo(() => {
    let minX = -HUB_W / 2 - 40, maxX = HUB_W / 2 + 40, minY = -320, maxY = 320
    for (const i of islands) {
      minX = Math.min(minX, i.x - i.r - 60)
      maxX = Math.max(maxX, i.x + i.r + 60)
      minY = Math.min(minY, i.y - i.r - 80)
      maxY = Math.max(maxY, i.y + i.r + 60)
    }
    for (const p of Object.values(moved)) {
      minX = Math.min(minX, p.x - 100)
      maxX = Math.max(maxX, p.x + 100)
      minY = Math.min(minY, p.y - 100)
      maxY = Math.max(maxY, p.y + 100)
    }
    return { minX, maxX, minY, maxY }
  }, [islands, moved])

  const size = () => {
    const r = view.current?.getBoundingClientRect()
    return { w: r?.width ?? 400, h: r?.height ?? 600, left: r?.left ?? 0, top: r?.top ?? 0 }
  }

  const clamp = useCallback(() => {
    const c = cam.current
    const { w, h } = size()
    c.z = Math.min(MAX_Z, Math.max(MIN_Z, c.z))
    const loX = w / 2 - bounds.maxX * c.z, hiX = w / 2 - bounds.minX * c.z
    const loY = h / 2 - bounds.maxY * c.z, hiY = h / 2 - bounds.minY * c.z
    c.x = Math.min(hiX, Math.max(loX, c.x))
    c.y = Math.min(hiY, Math.max(loY, c.y))
  }, [bounds])

  const apply = useCallback(() => {
    clamp()
    const c = cam.current
    if (world.current) world.current.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.z})`
    if (view.current) {
      view.current.style.backgroundPosition = `${c.x}px ${c.y}px`
      view.current.style.backgroundSize = `${13 * c.z}px ${13 * c.z}px`
    }
    if (!tickPending.current) {
      tickPending.current = true
      requestAnimationFrame(() => {
        tickPending.current = false
        setTick((t) => t + 1)
      })
    }
  }, [clamp])

  const stop = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current)
    anim.current = null
  }

  /** Glide so that world point (wx, wy) sits in the middle of the view. */
  const flyTo = useCallback(
    (wx: number, wy: number, z = cam.current.z) => {
      stop()
      const { w, h } = size()
      const from = { ...cam.current }
      const to = { x: w / 2 - wx * z, y: h / 2 - wy * z, z }
      if (prefersReduced()) {
        cam.current = to
        return apply()
      }
      const t0 = performance.now()
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 520)
        const e = 1 - Math.pow(1 - k, 3)
        cam.current = {
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
          z: from.z + (to.z - from.z) * e,
        }
        apply()
        if (k < 1) anim.current = requestAnimationFrame(step)
        else anim.current = null
      }
      anim.current = requestAnimationFrame(step)
    },
    [apply],
  )

  const home = useCallback(() => {
    const { w } = size()
    flyTo(0, 40, w < 520 ? 0.64 : 0.9)
  }, [flyTo])

  // Start centered on today.
  useLayoutEffect(() => {
    const { w, h } = size()
    const z = w < 520 ? 0.64 : 0.9
    cam.current = { x: w / 2, y: h / 2 - 40 * z, z }
    apply()
    const ro = new ResizeObserver(() => apply())
    if (view.current) ro.observe(view.current)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A freshly added piece: fly to it.
  useEffect(() => {
    if (!highlight) return
    const p = placed.find((x) => x.piece.id === highlight)
    if (p) {
      const at = moved[p.key] ?? p
      flyTo(at.x, at.y, Math.max(cam.current.z, 1))
    }
  }, [highlight]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trackpad and wheel: scroll pans, pinch (ctrl/⌘ + wheel) zooms around the cursor.
  useEffect(() => {
    const el = view.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      stop()
      const c = cam.current
      if (e.ctrlKey || e.metaKey) {
        const { left, top } = size()
        const mx = e.clientX - left, my = e.clientY - top
        const z = Math.min(MAX_Z, Math.max(MIN_Z, c.z * Math.exp(-e.deltaY * 0.01)))
        c.x = mx - (mx - c.x) * (z / c.z)
        c.y = my - (my - c.y) * (z / c.z)
        c.z = z
      } else {
        c.x -= e.deltaX
        c.y -= e.deltaY
      }
      apply()
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [apply])

  // ---------------------------------------------------------------------------------------
  // Pointers: drag the paper to pan (with a little glide), two fingers to zoom,
  // and pick up a piece to move it (mouse: just drag; touch: hold, then drag).

  const g = useRef<{
    mode: "idle" | "maybe" | "pan" | "piece" | "pinch"
    pts: Map<number, { x: number; y: number }>
    start: { x: number; y: number }
    camStart: { x: number; y: number; z: number }
    piece?: string
    pieceStart?: Spot
    hold?: number
    trail: { x: number; y: number; t: number }[]
    pinch?: { d: number; mx: number; my: number }
  }>({ mode: "idle", pts: new Map(), start: { x: 0, y: 0 }, camStart: { x: 0, y: 0, z: 1 }, trail: [] })

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    const s = g.current
    stop()
    s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (s.pts.size === 2) {
      const [a, b] = [...s.pts.values()]
      const { left, top } = size()
      s.mode = "pinch"
      if (s.hold) clearTimeout(s.hold)
      setLifted(null)
      s.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 - left, my: (a.y + b.y) / 2 - top }
      s.camStart = { ...cam.current }
      try {
        view.current?.setPointerCapture(e.pointerId)
      } catch { /* already gone */ }
      return
    }
    if (s.pts.size > 2) return
    const pieceEl = (e.target as HTMLElement).closest<HTMLElement>("[data-piece-key]")
    s.mode = "maybe"
    s.start = { x: e.clientX, y: e.clientY }
    s.camStart = { ...cam.current }
    s.trail = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
    s.piece = pieceEl?.dataset.pieceKey
    s.pieceStart = undefined
    if (s.piece) {
      const p = placed.find((x) => x.key === s.piece)
      s.pieceStart = p ? pos(p) : undefined
      if (e.pointerType !== "mouse") {
        s.hold = window.setTimeout(() => {
          if (g.current.mode === "maybe" && g.current.piece) {
            g.current.mode = "piece"
            setLifted(g.current.piece)
            setFront(g.current.piece)
            try {
              view.current?.setPointerCapture(e.pointerId)
            } catch { /* gone */ }
          }
        }, 320)
      }
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current
    if (!s.pts.has(e.pointerId)) return
    s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (s.mode === "pinch" && s.pinch && s.pts.size >= 2) {
      const [a, b] = [...s.pts.values()]
      const { left, top } = size()
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2 - left, my = (a.y + b.y) / 2 - top
      const z = Math.min(MAX_Z, Math.max(MIN_Z, (s.camStart.z * d) / Math.max(1, s.pinch.d)))
      cam.current = {
        z,
        x: mx - (s.pinch.mx - s.camStart.x) * (z / s.camStart.z),
        y: my - (s.pinch.my - s.camStart.y) * (z / s.camStart.z),
      }
      return apply()
    }
    const dx = e.clientX - s.start.x, dy = e.clientY - s.start.y
    if (s.mode === "maybe") {
      if (Math.hypot(dx, dy) < 6) return
      if (s.hold) clearTimeout(s.hold)
      s.mode = s.piece && e.pointerType === "mouse" && s.pieceStart ? "piece" : "pan"
      if (s.mode === "piece") {
        setLifted(s.piece!)
        setFront(s.piece!)
      }
      try {
        view.current?.setPointerCapture(e.pointerId)
      } catch { /* gone */ }
    }
    if (s.mode === "pan") {
      cam.current = { ...cam.current, x: s.camStart.x + dx, y: s.camStart.y + dy }
      s.trail.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      if (s.trail.length > 6) s.trail.shift()
      apply()
    } else if (s.mode === "piece" && s.piece && s.pieceStart) {
      const z = cam.current.z
      const key = s.piece
      const next = { x: s.pieceStart.x + dx / z, y: s.pieceStart.y + dy / z }
      const el = world.current?.querySelector<HTMLElement>(`[data-piece-key="${CSS.escape(key)}"]`)
      if (el) {
        el.style.left = `${next.x}px`
        el.style.top = `${next.y}px`
      }
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current
    s.pts.delete(e.pointerId)
    if (s.hold) clearTimeout(s.hold)
    if (s.mode === "pinch") {
      if (s.pts.size === 0) s.mode = "idle"
      else {
        // One finger left: carry on as a pan from here.
        const [p] = [...s.pts.values()]
        s.mode = "pan"
        s.start = { ...p }
        s.camStart = { ...cam.current }
        s.trail = []
      }
      return
    }
    if (s.mode === "pan") {
      // Glide: keep the last velocity and let it decay.
      const tr = s.trail
      const a = tr[0], b = tr[tr.length - 1]
      if (a && b && b.t - a.t > 0 && performance.now() - b.t < 80 && !prefersReduced()) {
        let vx = ((b.x - a.x) / (b.t - a.t)) * 16
        let vy = ((b.y - a.y) / (b.t - a.t)) * 16
        const glide = () => {
          vx *= 0.92
          vy *= 0.92
          cam.current = { ...cam.current, x: cam.current.x + vx, y: cam.current.y + vy }
          apply()
          if (Math.hypot(vx, vy) > 0.4) anim.current = requestAnimationFrame(glide)
          else anim.current = null
        }
        anim.current = requestAnimationFrame(glide)
      }
    } else if (s.mode === "piece" && s.piece && s.pieceStart) {
      const z = cam.current.z
      const key = s.piece
      const dx = e.clientX - s.start.x, dy = e.clientY - s.start.y
      const next = { x: s.pieceStart.x + dx / z, y: s.pieceStart.y + dy / z }
      setMoved((m) => ({ ...m, [key]: next }))
    }
    setLifted(null)
    s.mode = "idle"
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== view.current) return
    const c = cam.current
    const step = 70
    if (e.key === "ArrowLeft") c.x += step
    else if (e.key === "ArrowRight") c.x -= step
    else if (e.key === "ArrowUp") c.y += step
    else if (e.key === "ArrowDown") c.y -= step
    else if (e.key === "+" || e.key === "=") return zoomBy(1.2)
    else if (e.key === "-") return zoomBy(1 / 1.2)
    else if (e.key === "0") return home()
    else return
    e.preventDefault()
    apply()
  }

  const zoomBy = (f: number) => {
    const { w, h } = size()
    const c = cam.current
    const wx = (w / 2 - c.x) / c.z, wy = (h / 2 - c.y) / c.z
    flyTo(wx, wy, Math.min(MAX_Z, Math.max(MIN_Z, c.z * f)))
  }

  // Tabbing to a piece that is off screen brings it into view.
  const onFocusCapture = (e: FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement
    if (el === view.current) return
    const r = el.getBoundingClientRect(), v = size()
    if (r.left < v.left || r.right > v.left + v.w || r.top < v.top || r.bottom > v.top + v.h) {
      const c = cam.current
      const wx = (r.left + r.width / 2 - v.left - c.x) / c.z
      const wy = (r.top + r.height / 2 - v.top - c.y) / c.z
      flyTo(wx, wy)
    }
  }

  // ---------------------------------------------------------------------------------------
  // Minimap

  const mini = (() => {
    const W_ = 86, H_ = 86, pad = 6
    const bw = bounds.maxX - bounds.minX, bh = bounds.maxY - bounds.minY
    const k = Math.min((W_ - pad * 2) / bw, (H_ - pad * 2) / bh)
    const ox = pad + ((W_ - pad * 2) - bw * k) / 2, oy = pad + ((H_ - pad * 2) - bh * k) / 2
    const map = (x: number, y: number) => ({ x: ox + (x - bounds.minX) * k, y: oy + (y - bounds.minY) * k })
    const { w, h } = size()
    const c = cam.current
    const tl = map(-c.x / c.z, -c.y / c.z)
    return { W_, H_, k, map, view: { x: tl.x, y: tl.y, w: (w / c.z) * k, h: (h / c.z) * k } }
  })()

  const onMini = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const pad = 6
    const bw = bounds.maxX - bounds.minX, bh = bounds.maxY - bounds.minY
    const k = mini.k
    const ox = pad + ((mini.W_ - pad * 2) - bw * k) / 2, oy = pad + ((mini.H_ - pad * 2) - bh * k) / 2
    flyTo(bounds.minX + (mx - ox) / k, bounds.minY + (my - oy) / k)
  }

  const anyMoved = Object.keys(moved).length > 0

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={view}
        data-canvas
        data-drop="free"
        tabIndex={0}
        role="application"
        aria-label="The board. Drag to move around, pinch or ⌘-scroll to zoom, arrow keys to pan, 0 to return to today."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onFocusCapture={onFocusCapture}
        className="paper absolute inset-0 cursor-grab touch-none select-none overflow-hidden outline-none active:cursor-grabbing"
      >
        <div ref={world} className="absolute left-0 top-0 origin-top-left will-change-transform">
          {/* islands: soft ground under each group */}
          {islands.map((i) => (
            <div key={i.key}>
              <div
                data-drop={lens === "activity" ? i.cluster.areaId : undefined}
                className="absolute"
                style={{
                  left: i.x - i.r,
                  top: i.y - i.r + 30,
                  width: i.r * 2,
                  height: i.r * 2 - 20,
                  borderRadius: i.shape,
                  background: `${TINT_HEX[i.tint]}38`,
                  border: `1.5px dashed ${TINT_HEX[i.tint]}`,
                }}
              />
              <div
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: i.x, top: i.y - i.r - 8 }}
              >
                {i.cluster.person ? (
                  <Link
                    to={i.cluster.person === "john" ? "/me" : `/people/${i.cluster.person}`}
                    className="inline-flex items-center gap-1.5"
                    draggable={false}
                  >
                    <NameTag person={people[i.cluster.person]} />
                    <span className="font-display text-[26px] font-bold text-ink">×{i.cluster.pieces.length}</span>
                  </Link>
                ) : i.cluster.areaId ? (
                  <button
                    type="button"
                    onClick={() => onIsland(i.cluster.areaId!)}
                    className="rounded-full px-2 font-display text-[34px] font-bold leading-none text-ink hover:underline"
                  >
                    {i.cluster.label}
                    <span className="ml-1.5 text-[26px] text-muted">×{i.cluster.pieces.length}</span>
                  </button>
                ) : (
                  <span className="px-2 font-display text-[34px] font-bold leading-none text-ink">
                    {i.cluster.label}
                    <span className="ml-1.5 text-[26px] text-muted">×{i.cluster.pieces.length}</span>
                  </span>
                )}
              </div>
              {i.cluster.pieces.length === 0 ? (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 font-display text-[20px] text-muted"
                  style={{ left: i.x, top: i.y + 30 }}
                >
                  free spot
                </div>
              ) : null}
            </div>
          ))}

          {/* today: the agent's cards */}
          <div className="absolute -translate-x-1/2" style={{ left: 0, top: -250, width: HUB_W }}>
            <p className="mb-2 text-center font-display text-[28px] font-bold leading-none text-ink">
              today <span className="text-[22px] text-muted">· {fmtShort(TODAY)}</span>
            </p>
            {hub}
          </div>

          {/* the pieces */}
          {placed.map((p, idx) => {
            const at = pos(p)
            const isLifted = lifted === p.key
            const hl = highlight === p.piece.id
            return (
              <div
                key={p.key}
                data-piece-key={p.key}
                data-drop={lens === "activity" ? p.island.cluster.areaId : undefined}
                className="absolute"
                style={{
                  left: at.x,
                  top: at.y,
                  zIndex: isLifted ? 50 : front === p.key ? 40 : 10 + p.order,
                }}
              >
                <Link
                  to={`/lore/${p.piece.id}`}
                  data-piece={p.piece.id}
                  draggable={false}
                  onClick={(e) => {
                    if (g.current.mode !== "idle") e.preventDefault()
                  }}
                  className={`group block w-[124px] -translate-x-1/2 -translate-y-1/2 animate-pop-in rounded-[14px] bg-white p-1.5 pb-2 transition-[rotate,scale,box-shadow] duration-200 ${
                    isLifted
                      ? "scale-[1.08] border-2 border-ink shadow-offset"
                      : hl
                        ? "animate-glow border-2 border-ink shadow-offset"
                        : "border-[1.5px] border-line shadow-[0_6px_14px_-8px_rgba(30,30,28,0.45)] hover:scale-[1.05] hover:border-ink"
                  }`}
                  style={{
                    rotate: isLifted ? "0deg" : `${p.tilt}deg`,
                    animationDelay: `${Math.min(idx * 28, 500)}ms`,
                  }}
                >
                  <Photo
                    src={p.piece.photos[0]}
                    alt=""
                    tint={p.island.tint}
                    label={p.piece.title}
                    className="pointer-events-none h-[84px] w-full rounded-[9px]"
                  />
                  <span className="mt-1.5 block px-0.5 font-display text-[17px] font-bold leading-[1.05] text-ink">
                    {p.piece.title}
                  </span>
                </Link>
              </div>
            )
          })}
        </div>
      </div>

      {/* minimap: where you are on the board; tap to jump */}
      <div
        role="button"
        tabIndex={-1}
        aria-label="Board map. Tap to jump there."
        onPointerDown={onMini}
        className="absolute bottom-3 left-3 z-20 cursor-pointer rounded-xl border-[1.5px] border-ink bg-paper/95 shadow-offset-sm"
        style={{ width: mini.W_, height: mini.H_ }}
      >
        <svg width={mini.W_} height={mini.H_} aria-hidden className="block">
          {islands.map((i) => {
            const c = mini.map(i.x, i.y + 20)
            return <circle key={i.key} cx={c.x} cy={c.y} r={Math.max(3, i.r * mini.k)} fill={TINT_HEX[i.tint]} fillOpacity={0.75} />
          })}
          {(() => {
            const c = mini.map(0, 0)
            return <rect x={c.x - (HUB_W / 2) * mini.k} y={c.y - 250 * mini.k} width={HUB_W * mini.k} height={500 * mini.k} rx={2} fill="#2457c5" fillOpacity={0.35} />
          })()}
          <rect
            x={mini.view.x}
            y={mini.view.y}
            width={mini.view.w}
            height={mini.view.h}
            rx={3}
            fill="none"
            stroke="#1e1e1c"
            strokeWidth={1.5}
          />
        </svg>
      </div>

      {/* camera controls */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
        <CamButton label="Back to today" onClick={home}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="5.5" stroke="#1E1E1C" strokeWidth="2.2" />
            <path d="M9 1.1V3.4M9 14.6V16.9M1.1 9H3.4M14.6 9H16.9" stroke="#1E1E1C" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </CamButton>
        <CamButton label="Zoom in" onClick={() => zoomBy(1.25)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1.1V14.9M1.1 8H14.9" stroke="#1E1E1C" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </CamButton>
        <CamButton label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M1.1 8H14.9" stroke="#1E1E1C" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </CamButton>
        {anyMoved ? (
          <button
            type="button"
            onClick={() => setMoved({})}
            className="mt-1 h-8 rounded-[10px] border-[1.5px] border-ink bg-white px-2 text-[12px] font-bold text-ink shadow-offset-sm"
          >
            Tidy up
          </button>
        ) : null}
      </div>
    </div>
  )
}

function CamButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="grid size-9 place-items-center rounded-[10px] border-[1.5px] border-ink bg-white shadow-offset-sm active:translate-y-px"
    >
      {children}
    </button>
  )
}
