/**
 * Keeps the in-browser store in step with the server: shared actions are posted in order,
 * and the latest state is polled (cheap 204 when nothing changed). Without a database the
 * app keeps running on the seed data.
 */
const PERSIST = new Set([
  "lore/add",
  "lore/patch",
  "plan/add",
  "plan/patch",
  "plan/vote",
  "area/add",
  "profile/patch",
  "person/piece",
  "keeper/push",
  "agent/push",
  "limits/set",
])

type AnyAction = { type: string }
let queue: AnyAction[] = []
let flushing = false
let version = -1
let online = true

export function syncAction(a: AnyAction) {
  if (!online || !PERSIST.has(a.type)) return
  queue.push(a)
  void flush()
}

async function flush() {
  if (flushing) return
  flushing = true
  try {
    while (queue.length) {
      const batch = queue.splice(0, queue.length)
      try {
        await fetch("/api/actions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ actions: batch }),
        })
      } catch {
        /* offline: the next poll reconciles */
      }
    }
  } finally {
    flushing = false
  }
}

export function startSync(onSnapshot: (snap: Record<string, unknown>) => void) {
  let stop = false
  const tick = async () => {
    if (stop) return
    if (!document.hidden && !flushing && !queue.length) {
      try {
        const r = await fetch(`/api/state?v=${version}`, { cache: "no-store" })
        if (r.status === 200) {
          const snap = (await r.json()) as Record<string, unknown> & { version: number }
          if (!flushing && !queue.length && typeof snap.version === "number") {
            version = snap.version
            onSnapshot(snap)
          }
        } else if (r.status === 204 && version < 0) {
          online = false // no database configured: stay on seed data
          return
        }
      } catch {
        /* retry on the next tick */
      }
    }
    setTimeout(tick, 2500)
  }
  void tick()
  return () => {
    stop = true
  }
}

export async function uploadPhoto(file: File): Promise<string | null> {
  try {
    const fd = new FormData()
    fd.append("file", file)
    const r = await fetch("/api/upload", { method: "POST", body: fd })
    if (!r.ok) return null
    return ((await r.json()) as { url?: string }).url ?? null
  } catch {
    return null
  }
}
