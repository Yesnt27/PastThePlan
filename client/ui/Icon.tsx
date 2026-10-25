import type { ButtonHTMLAttributes, CSSProperties } from "react"
import { asset } from "../lib/asset"

/**
 * Icons are the exported SVGs from the Figma frames (public/assets). Each glyph keeps the
 * proportion it has inside its 24px "icon/*" frame so sizes match the comps.
 */
const GLYPHS = {
  plus: { src: "assets/asi/8ec55.svg", w: 0.675, h: 0.675 },
  search: { src: "assets/asi/f56d6.svg", w: 0.717, h: 0.717 },
  pencil: { src: "assets/asi/a6275.svg", w: 0.717, h: 0.717 },
  chevronLeft: { src: "assets/asi/893e5.svg", w: 0.342, h: 0.592 },
  chevronRight: { src: "assets/asi/46ff1.svg", w: 0.342, h: 0.592 },
  chevronRightWhite: { src: "assets/asi/64c79.svg", w: 0.36, h: 0.61 },
  lock: { src: "assets/asi/f97c4.svg", w: 0.675, h: 0.758 },
  lockWhite: { src: "assets/asi/0d3dd.svg", w: 0.675, h: 0.758 },
  send: { src: "assets/asi/d4ac4.svg", w: 0.693, h: 0.61 },
  check: { src: "assets/asi/d4712.svg", w: 0.74, h: 0.574 },
  checkWhite: { src: "assets/asi/44b2f.svg", w: 0.74, h: 0.574 },
  arrowRight: { src: "assets/asi/a6931.svg", w: 0.675, h: 0.59 },
} as const

export type GlyphName = keyof typeof GLYPHS | "close"

export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: GlyphName
  size?: number
  className?: string
  style?: CSSProperties
}) {
  // There is no standalone close glyph in the comps; a plus turned 45° reads as one.
  const g = GLYPHS[name === "close" ? "plus" : name]
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${
        name === "close" ? "rotate-45" : ""
      } ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <img
        alt=""
        src={asset(g.src)}
        className="block max-w-none"
        style={{ width: size * g.w, height: size * g.h }}
        draggable={false}
      />
    </span>
  )
}

/** Cream "Icon Library" buttons from 01 Book – closed. These SVGs already include the square and shadow. */
const BAKED = {
  back: "assets/book/e4edc.svg",
  forward: "assets/book/749c2.svg",
  pencil: "assets/book/7ad94.svg",
  stack: "assets/book/cb925.svg",
  close: "assets/book/0d4a7.svg",
  sliders: "assets/book/24adb.svg",
} as const

/** Buttons that exist in the book only as glyphs get the same cream square drawn in CSS. */
const DRAWN = {
  plus: "assets/book/96930.svg",
} as const

export type BookIconName = keyof typeof BAKED | keyof typeof DRAWN | "search"

type BookButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: BookIconName
  label: string
  /** The comp renders pencil, stack, close and forward mirrored (rotate 180° + flip Y). */
  mirrored?: boolean
  active?: boolean
}

export function BookIcon({
  icon,
  mirrored,
}: {
  icon: BookIconName
  mirrored?: boolean
}) {
  if (icon in BAKED) {
    return (
      <span
        aria-hidden
        className={`relative block size-8 ${mirrored ? "-scale-x-100" : ""}`}
      >
        <img
          alt=""
          src={asset(BAKED[(icon as keyof typeof BAKED)])}
          className="absolute -left-1 top-0 block size-10 max-w-none"
          draggable={false}
        />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className="flex size-8 items-center justify-center rounded-lg bg-paper drop-shadow-[0px_4px_2px_rgba(0,0,0,0.25)]"
    >
      {icon === "search" ? (
        <Icon name="search" size={22} />
      ) : (
        <img
          alt=""
          src={asset(DRAWN[(icon as keyof typeof DRAWN)])}
          className="block size-6"
          draggable={false}
        />
      )}
    </span>
  )
}

export function BookButton({
  icon,
  label,
  mirrored,
  active,
  className = "",
  ...rest
}: BookButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`group relative grid size-11 place-items-center rounded-xl transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-35 ${className}`}
      {...rest}
    >
      <BookIcon icon={icon} mirrored={mirrored} />
      {active && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 h-1 w-4 rounded-full bg-ink"
        />
      )}
    </button>
  )
}
