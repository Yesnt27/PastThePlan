import {
  useLayoutEffect,
  useRef,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { Icon } from "./Icon"
import { Pill } from "./kit"

/** Internally scrolling message list that keeps the newest message in view. */
export function Thread({
  children,
  follow,
  label,
}: {
  children: ReactNode
  follow: unknown
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [follow])
  return (
    <div
      ref={ref}
      role="log"
      aria-label={label}
      aria-live="polite"
      className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="flex min-h-full flex-col justify-end gap-3 px-4 py-4">
        {children}
      </div>
    </div>
  )
}

export function Bubble({
  from,
  children,
}: {
  from: "me" | "agent"
  children: ReactNode
}) {
  if (from === "me") {
    return (
      <div className="flex justify-end animate-pop-in">
        <p className="max-w-[82%] whitespace-pre-line break-words rounded-[18px] rounded-br-[4px] bg-ink px-3.5 py-2.5 text-[15px] leading-[1.4] text-white">
          {children}
        </p>
      </div>
    )
  }
  return (
    <div className="flex animate-pop-in">
      <p className="max-w-[88%] whitespace-pre-line break-words rounded-[18px] rounded-bl-[4px] bg-bubble px-3.5 py-2.5 text-[15px] leading-[1.4] text-ink">
        {children}
      </p>
    </div>
  )
}

export function AgentCardBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex animate-pop-in">
      <div className="max-w-[92%] rounded-2xl border-2 border-dashed border-plezi bg-agent px-3.5 py-2.5 text-[15px] leading-[1.4] text-ink">
        {children}
      </div>
    </div>
  )
}

export function SystemNote({ children }: { children: ReactNode }) {
  return (
    <p className="animate-fade-in text-center text-xs text-muted">{children}</p>
  )
}

export function ResponsePill({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end animate-pop-in">
      <Pill>{children}</Pill>
    </div>
  )
}

export function Typing({ label }: { label?: string }) {
  return (
    <div className="flex animate-fade-in items-center gap-2" role="status">
      <span className="flex h-9 items-center gap-1 rounded-[18px] rounded-bl-[4px] bg-bubble px-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot size-1.5 rounded-full bg-muted"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      {label && <span className="text-xs text-muted">{label}</span>}
    </div>
  )
}

export function QuickReplies({
  items,
  onPick,
}: {
  items: string[]
  onPick: (text: string) => void
}) {
  if (!items.length) return null
  return (
    <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-2">
      {items.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onPick(t)}
          className="h-8 shrink-0 whitespace-nowrap rounded-full border-[1.5px] border-line bg-white px-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink"
        >
          {t}
        </button>
      ))}
    </div>
  )
}

export function Composer({
  value,
  onChange,
  onSend,
  placeholder,
  inputRef,
  before,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSend: (v: string) => void
  placeholder: string
  inputRef?: RefObject<HTMLInputElement | null>
  before?: ReactNode
  disabled?: boolean
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim() || disabled) return
    onSend(value)
  }
  return (
    <form
      onSubmit={submit}
      className="shrink-0 border-t-[1.5px] border-hair bg-white/80 px-4 pb-3 pt-3 backdrop-blur-sm"
    >
      {before}
      <div className="flex items-center gap-2">
        <label className="flex h-[46px] min-w-0 flex-1 items-center rounded-[14px] border-[1.5px] border-line bg-white px-3.5 focus-within:border-ink">
          <span className="sr-only">{placeholder}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full min-w-0 bg-transparent text-[15px] outline-none"
            autoComplete="off"
            enterKeyHint="send"
          />
        </label>
        <button
          type="submit"
          aria-label="Send"
          disabled={!value.trim() || disabled}
          className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-ink transition-opacity disabled:opacity-35"
        >
          <Icon name="send" size={20} />
        </button>
      </div>
    </form>
  )
}

export function ChatHeader({
  back,
  avatar,
  title,
  subtitle,
  onBack,
  badge,
}: {
  badge?: string
  back: string
  avatar: ReactNode
  title: string
  subtitle: string
  onBack: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b-[1.5px] border-hair px-4 pb-3 pt-1">
      <button
        type="button"
        onClick={onBack}
        aria-label={back}
        title={back}
        className="grid size-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-line bg-white hover:border-ink"
      >
        <Icon name="chevronLeft" size={20} />
      </button>
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-chip">
        {avatar}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-base font-bold text-ink">{title}</p>
        <p className="truncate text-[13px] text-muted">{subtitle}</p>
      </div>
      {badge ? <Pill>{badge}</Pill> : null}
    </div>
  )
}
