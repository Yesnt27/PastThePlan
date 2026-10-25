import { Link } from "react-router"
import { nameOf } from "../agent/text"
import type { LoreAnswer, LorePiece } from "../data/types"
import { fmtShort } from "../lib/dates"
import { Icon } from "./Icon"

/**
 * The lore agent's reply: summary text, then the quotes it leaned on (verbatim, attributed),
 * then citation chips back to the pieces it read.
 */
export function AnswerView({
  answer,
  lore,
}: {
  answer: LoreAnswer
  lore: LorePiece[]
}) {
  const byId = new Map(lore.map((p) => [p.id, p]))
  const cited = answer.citations
    .map((id) => byId.get(id))
    .filter((p): p is LorePiece => !!p)
  return (
    <div className="flex animate-pop-in">
      <div
        className={`w-full max-w-[94%] rounded-2xl border-2 border-dashed px-3.5 py-3 ${
          answer.found ? "border-plezi bg-agent" : "border-line bg-white"
        }`}
      >
        <p className="text-[15px] leading-[1.4] text-ink">{answer.text}</p>
        {answer.quotes.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-2">
            {answer.quotes.map((q) => (
              <li key={q.quoteId}>
                <blockquote className="rounded-xl border-[1.5px] border-ink bg-white px-3 py-2">
                  <p className="text-[15px] leading-snug text-ink">
                    “{q.text}”
                  </p>
                  <footer className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <Icon name="lock" size={12} />
                    <span>
                      {nameOf(q.by)}, word for word ·{" "}
                      {byId.get(q.loreId)?.title}
                    </span>
                  </footer>
                </blockquote>
              </li>
            ))}
          </ul>
        )}
        {cited.length > 0 && (
          <div className="mt-2.5">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              From the lore
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cited.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to={`/lore/${p.id}`}
                  className="inline-flex h-7 items-center gap-1 rounded-full border-[1.5px] border-ink bg-white pl-2.5 pr-1.5 text-xs font-semibold text-ink hover:bg-paper"
                >
                  {p.title} · {fmtShort(p.date)}
                  <Icon name="chevronRight" size={14} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
