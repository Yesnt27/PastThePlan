import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Link, type LinkProps } from "react-router"
import { PIECES } from "../data/seed"
import type { Person, Tint } from "../data/types"
import { Icon, type GlyphName } from "./Icon"

export const TINT_BG: Record<Tint, string> = {
  red: "bg-tag-red",
  orange: "bg-tag-orange",
  yellow: "bg-tag-yellow",
  green: "bg-tag-green",
  purple: "bg-tag-purple",
  blue: "bg-tag-blue",
}

export const TINT_HEX: Record<Tint, string> = {
  red: "#ff6c6e",
  orange: "#ffae5d",
  yellow: "#ffea82",
  green: "#a9f48e",
  purple: "#eb8fff",
  blue: "#87d9fb",
}

export function Creature({
  person,
  size = 32,
}: {
  person: Person
  size?: number
}) {
  const piece = PIECES[person.piece]
  const scale = size / 32
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg bg-paper"
      style={{ width: size, height: size, borderRadius: 8 * scale }}
    >
      <img
        alt=""
        src={piece.creature}
        style={{ width: piece.width * scale, height: piece.height * scale }}
        draggable={false}
      />
    </span>
  )
}

/** Name tag from the book cover: tint pill, cream creature square, Matcha-style name. */
export function NameTag({
  person,
  size = "md",
  className = "",
}: {
  person: Person
  size?: "md" | "sm"
  className?: string
}) {
  const tint = PIECES[person.piece].tint
  if (size === "sm") {
    return (
      <span
        className={`inline-flex h-8 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 ${TINT_BG[tint]} ${className}`}
      >
        <Creature person={person} size={24} />
        <span className="font-display text-[17px] font-bold leading-none text-ink">
          {person.name}
        </span>
      </span>
    )
  }
  return (
    <span
      className={`flex items-center gap-1 overflow-hidden rounded-[33px] p-2 ${TINT_BG[tint]} ${className}`}
    >
      <Creature person={person} />
      <span className="truncate font-display text-[19px] font-bold leading-none text-ink">
        {person.name}
      </span>
    </span>
  )
}

export function Pill({
  children,
  dark,
  agent,
  className = "",
}: {
  children: ReactNode
  dark?: boolean
  agent?: boolean
  className?: string
}) {
  const tone = dark
    ? "bg-ink text-white border-ink"
    : agent
      ? "bg-agent border-plezi border-dashed text-ink"
      : "bg-white border-line text-ink"
  return (
    <span
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 text-[13px] font-semibold ${tone} ${className}`}
    >
      {children}
    </span>
  )
}

type BtnTone = "primary" | "secondary" | "dashed" | "agent"
const BTN: Record<BtnTone, string> = {
  primary: "bg-ink text-white border-ink hover:bg-ink-soft",
  secondary: "bg-white text-ink border-ink hover:bg-paper",
  dashed: "bg-white/70 text-ink border-ink border-dashed hover:bg-white",
  agent: "bg-agent text-ink border-plezi border-dashed hover:bg-white",
}

export function Button({
  tone = "primary",
  icon,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: BtnTone
  icon?: GlyphName
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-[1.5px] px-[18px] text-base font-bold transition-[transform,background-color] duration-150 active:translate-y-px disabled:opacity-40 ${BTN[tone]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

export function ButtonLink({
  tone = "primary",
  className = "",
  children,
  ...rest
}: LinkProps & { tone?: BtnTone }) {
  return (
    <Link
      className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-[1.5px] px-[18px] text-base font-bold transition-[transform,background-color] duration-150 active:translate-y-px ${BTN[tone]} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  )
}

/** Square outline button from the ASI frames (44 × 44, 12 radius). */
export function SquareButton({
  icon,
  label,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: GlyphName
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-line bg-white transition-colors hover:border-ink ${className}`}
      {...rest}
    >
      <Icon name={icon} size={20} />
    </button>
  )
}

/** Dashed Plezi-blue surface: anything the agent produced or is holding. */
export function AgentBox({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode
  className?: string
  as?: "div" | "section" | "aside"
}) {
  return (
    <As
      className={`rounded-2xl border-2 border-dashed border-plezi bg-agent ${className}`}
    >
      {children}
    </As>
  )
}

/** Solid white card: anything a person made. */
export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode
  className?: string
  as?: "div" | "section" | "article"
}) {
  return (
    <As
      className={`rounded-[20px] border-[1.5px] border-line bg-white ${className}`}
    >
      {children}
    </As>
  )
}

export function SectionLabel({
  children,
  aside,
  className = "",
}: {
  children: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
        {children}
      </h2>
      {aside && <span className="text-xs text-muted">{aside}</span>}
    </div>
  )
}

/** A photo, or a tinted placeholder when a piece has none yet. */
export function Photo({
  src,
  alt,
  tint = "yellow",
  label,
  className = "",
}: {
  src?: string
  alt: string
  tint?: Tint
  label?: string
  className?: string
}) {
  if (src)
    return (
      <img
        src={src}
        alt={alt}
        className={`block object-cover ${className}`}
        draggable={false}
        loading="lazy"
      />
    )
  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-end p-2 ${className}`}
      style={{ background: `${TINT_HEX[tint]}55` }}
    >
      {label && (
        <span className="font-display text-sm font-bold leading-none text-ink/70">
          {label}
        </span>
      )}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border-[1.5px] border-dashed border-line px-3 py-4 text-center text-sm text-muted">
      {children}
    </p>
  )
}
