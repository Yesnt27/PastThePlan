import { useEffect, useRef, type ReactNode } from "react"
import { Icon } from "./Icon"

/** Bottom sheet over the current page. Escape or the backdrop closes it. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current()
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      previous?.focus?.()
    }
  }, [])

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 animate-fade-in bg-ink/35"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[92%] animate-sheet-up flex-col rounded-t-[26px] border-t-[1.5px] border-ink bg-paper shadow-[0_-8px_24px_rgba(0,0,0,0.18)] outline-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 place-items-center rounded-xl border-[1.5px] border-line bg-white hover:border-ink"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="no-scrollbar min-h-0 overflow-y-auto px-5 pb-6 pt-1">
          {children}
        </div>
      </div>
    </div>
  )
}
