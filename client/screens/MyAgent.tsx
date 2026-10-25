import { useRef, useState } from "react"
import { useNavigate } from "react-router"
import { limitRows, PAIRING_CODE } from "../agent/memberAgent"
import { useActions, useStore } from "../state/store"
import {
  AgentCardBubble,
  Bubble,
  ChatHeader,
  Composer,
  QuickReplies,
  Thread,
  Typing,
} from "../ui/chat"
import { Icon } from "../ui/Icon"

/** "13 ASI:One · my private agent". Only John sees this; the group agent never sees these values. */
export function MyAgent() {
  const navigate = useNavigate()
  const { agent, agentBusy, limits } = useStore()
  const { sendAgent } = useActions()
  const [text, setText] = useState("")
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const send = (value: string) => {
    sendAgent(value)
    setText("")
  }
  const pick = (chip: string) => {
    if (chip.endsWith("…")) {
      setText(chip.replace("…", ""))
      input.current?.focus()
    } else send(chip)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white/55">
      <ChatHeader
        badge="Sealed"
        back="Back to your profile"
        onBack={() => navigate("/me")}
        avatar={<Icon name="lock" size={20} />}
        title="My agent"
        subtitle="Member agent · owner only"
      />

      <section
        className="shrink-0 border-b-[1.5px] border-hair bg-paper/70 px-4 py-2.5"
        aria-label="What my agent keeps private"
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          <Icon name="lock" size={16} />
          <span className="min-w-0 flex-1 text-[13px] text-ink">
            <b>Private to you.</b> Lore Keeper only hears “fits” or “doesn’t
            fit”.
          </span>
          <span className="text-xs font-bold text-plezi">
            {open ? "Hide" : "What I hold"}
          </span>
        </button>
        {open && (
          <dl className="mt-2.5 grid animate-fade-in grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl border-2 border-dashed border-plezi bg-agent p-3 text-[13px] text-ink">
            {limitRows(limits).map((r) => (
              <div key={r.key} className="contents">
                <dt className="font-bold">{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
            <dt className="font-bold">Paired</dt>
            <dd>
              Code <span className="font-mono">{PAIRING_CODE}</span>
            </dd>
          </dl>
        )}
      </section>

      <Thread
        label="Conversation with my agent"
        follow={`${agent.length}-${agentBusy}`}
      >
        {agent.map((m) =>
          m.kind === "text" ? (
            <Bubble key={m.id} from={m.from}>
              {m.text}
            </Bubble>
          ) : m.kind === "agent-card" ? (
            <AgentCardBubble key={m.id}>{m.text}</AgentCardBubble>
          ) : null,
        )}
        {agentBusy && <Typing />}
      </Thread>
      <QuickReplies
        items={[
          "profile",
          "fix: …",
          "forget",
          limits.calendar === "connected" ? "calendar off" : "calendar connect",
        ]}
        onPick={pick}
      />
      <Composer
        value={text}
        onChange={setText}
        onSend={send}
        placeholder="Message my agent…"
        inputRef={input}
        disabled={agentBusy}
      />
    </div>
  )
}
