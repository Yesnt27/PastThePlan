import { isRouteErrorResponse, useRouteError } from "react-router"
import { ButtonLink } from "../ui/kit"

export function NotFound({
  what = "This page isn’t in the book.",
}: {
  what?: string
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-display text-[40px] font-bold leading-none text-ink">
        Hmm.
      </p>
      <p className="text-[15px] text-muted">{what}</p>
      <ButtonLink to="/board" className="mt-2">
        Back to the board
      </ButtonLink>
    </div>
  )
}

/** Route error boundary. Keeps the user inside the book instead of a blank screen. */
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Something went wrong."
  return (
    <div className="paper flex h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-display text-[40px] font-bold leading-none text-ink">
        A page tore.
      </p>
      <p className="max-w-sm text-[15px] text-muted">{message}</p>
      <a
        href="/board"
        className="mt-2 inline-flex h-12 items-center rounded-xl bg-ink px-5 font-bold text-white"
      >
        Reopen the board
      </a>
    </div>
  )
}
