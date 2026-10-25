import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { scopedSuggestions, SUGGESTED_QUESTIONS } from "../agent/loreAgent"
import { fmtShort } from "../lib/dates"
import { useActions, useStore } from "../state/store"
import { AnswerView } from "../ui/Answer"
import { Bubble, Composer, QuickReplies, Thread, Typing } from "../ui/chat"
import { Icon } from "../ui/Icon"

export function Ask() {
  const [params] = useSearchParams()
  const { lore, asks } = useStore()
  const { ask } = useActions()
  const [text, setText] = useState("")
  const about = params.get("about")
  const scope = about ? lore.find((p) => p.id === about) : undefined
  const key = scope?.id ?? "all"
  const entries = asks.filter((a) => a.scope === key)
  const asked = new Set(entries.map((e) => e.question))
  const suggestions = (
    scope ? scopedSuggestions(scope) : SUGGESTED_QUESTIONS
  ).filter((q) => !asked.has(q))
  const pending = entries.some((e) => !e.answer)

  const send = (q: string) => {
    ask(q, scope?.id)
    setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white/55">
      <div className="shrink-0 border-b-[1.5px] border-hair pb-3 pl-6 pr-4 pt-1">
        <h1 className="text-[28px] font-extrabold uppercase leading-none text-ink">
          Ask the lore
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Answers come only from what’s been added. Quotes stay word for word.
        </p>
        {scope && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-xs text-muted">Only looking at</span>
            <span className="inline-flex h-7 items-center gap-1 rounded-full border-[1.5px] border-dashed border-plezi bg-agent pl-2.5 pr-1 text-xs font-semibold">
              <Link to={`/lore/${scope.id}`} className="hover:underline">
                {scope.title} · {fmtShort(scope.date)}
              </Link>
              <Link
                to="/ask"
                replace
                aria-label="Ask about all the lore instead"
                className="grid size-5 place-items-center rounded-full hover:bg-white"
              >
                <Icon name="close" size={14} />
              </Link>
            </span>
          </div>
        )}
      </div>

      <Thread
        label="Questions and answers"
        follow={`${key}-${entries.length}-${entries.at(-1)?.answer ? 1 : 0}`}
      >
        {entries.length === 0 && (
          <p className="text-center text-sm text-muted">
            {scope
              ? `Ask anything about ${scope.title}. Nothing outside this piece is searched.`
              : "Ask about anything the group has done."}
          </p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="flex flex-col gap-2">
            <Bubble from="me">{e.question}</Bubble>
            {e.answer ? (
              <AnswerView answer={e.answer} lore={lore} />
            ) : (
              <Typing label="Looking through the lore…" />
            )}
          </div>
        ))}
      </Thread>

      <QuickReplies items={pending ? [] : suggestions} onPick={send} />
      <Composer
        value={text}
        onChange={setText}
        onSend={send}
        disabled={pending}
        placeholder={
          scope
            ? `Ask about ${scope.title}…`
            : "Ask about your group’s history…"
        }
      />
    </div>
  )
}
