import { useEffect } from "react"
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router"
import { art } from "../lib/asset"
import { useActions, useStore } from "../state/store"
import { BookButton } from "../ui/Icon"

type Chrome = {
  /** Previous page in the book, or a parent page. 'history' goes back when there is history. */
  back?: string
  forward?: string
  pencil: { to: string; label: string }
  surface: "desk" | "paper"
  tab?: "board"
}

const COMPOSE = {
  to: "/keeper?compose=1",
  label: "Plan something with Lore Keeper",
}

/** Bottom-bar wiring per page. Chevrons turn the pages of the book in this order. */
function chromeFor(pathname: string, search: URLSearchParams): Chrome {
  const seg = pathname.split("/").filter(Boolean)
  const [a, b, c] = seg
  if (!a) return { forward: "/book", pencil: COMPOSE, surface: "desk" }
  if (a === "book")
    return { back: "/", forward: "/board", pencil: COMPOSE, surface: "paper" }
  if (a === "board")
    return {
      back: "/book",
      forward: "/keeper",
      pencil: COMPOSE,
      surface: "paper",
      tab: "board",
    }
  if (a === "keeper")
    return {
      back: "/board",
      forward: "/ask",
      pencil: COMPOSE,
      surface: "paper",
    }
  if (a === "ask") {
    const about = search.get("about")
    return {
      back: about ? `/lore/${about}` : "/keeper",
      forward: "/me",
      pencil: COMPOSE,
      surface: "paper",
    }
  }
  if (a === "me") {
    if (b === "agent")
      return {
        back: "/me",
        pencil: { to: "/me/edit", label: "Edit profile" },
        surface: "paper",
      }
    if (b === "edit")
      return {
        back: "/me",
        pencil: { to: "/me/edit", label: "Edit profile" },
        surface: "paper",
      }
    return {
      back: "/ask",
      pencil: { to: "/me/edit", label: "Edit profile" },
      surface: "paper",
    }
  }
  if (a === "people")
    return {
      back: "history",
      pencil:
        b === "john" ? { to: "/me/edit", label: "Edit profile" } : COMPOSE,
      surface: "paper",
    }
  if (a === "lore") {
    if (b === "new")
      return { back: "history", pencil: COMPOSE, surface: "paper" }
    if (c === "edit")
      return {
        back: `/lore/${b}`,
        pencil: { to: `/lore/${b}/edit`, label: "Edit this lore" },
        surface: "paper",
      }
    return {
      back: "history",
      pencil: { to: `/lore/${b}/edit`, label: "Edit this lore" },
      surface: "paper",
    }
  }
  return { back: "/board", pencil: COMPOSE, surface: "paper" }
}

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const { notice } = useStore()
  const { notify } = useActions()
  const search = new URLSearchParams(location.search)
  const chrome = chromeFor(location.pathname, search)
  const onBoard = location.pathname === "/board"

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => notify(undefined), 2800)
    return () => clearTimeout(t)
  }, [notice, notify])

  const goBack = () => {
    if (chrome.back === "history") {
      // "default" means this was the first page loaded, so there is nothing to go back to.
      if (location.key !== "default") navigate(-1)
      else navigate("/board")
    } else if (chrome.back) navigate(chrome.back)
  }

  const filterHref = () => {
    const next = new URLSearchParams(onBoard ? location.search : "")
    next.set("sheet", "filter")
    return `/board?${next.toString()}`
  }

  return (
    <div className="flex h-dvh justify-center bg-shell md:items-center md:py-6">
      <div
        className={`relative flex h-full w-full max-w-[440px] flex-col overflow-hidden md:h-[min(920px,100%)] md:rounded-[10px] md:shadow-book ${
          chrome.surface === "paper" ? "paper" : "bg-shell"
        }`}
      >
        {chrome.surface === "paper" && <Spine />}

        <header className="relative z-20 flex shrink-0 items-center justify-between pb-2 pl-6 pr-4 pt-4">
          <Link
            to="/book"
            aria-label="PastThePlan — open the book"
            title="PastThePlan"
            className="block rounded-md"
          >
            <img
              src={art.logo}
              alt=""
              className="h-[38px] w-[31px] object-contain"
              draggable={false}
            />
          </Link>
          <nav aria-label="Book tools" className="flex items-center gap-1">
            <BookButton
              icon="plus"
              label="New lore"
              onClick={() => navigate("/lore/new")}
            />
            <BookButton
              icon="search"
              label="Ask the lore"
              onClick={() => navigate("/ask")}
            />
            <BookButton
              icon="sliders"
              label="Group and filter the board"
              onClick={() => navigate(filterHref(), { replace: onBoard })}
            />
          </nav>
        </header>

        <main
          id="page"
          className={`relative z-10 flex min-h-0 flex-1 flex-col ${
            navigation.state === "loading" ? "opacity-70" : ""
          }`}
        >
          <Outlet />
        </main>

        <nav
          aria-label="Pages"
          className="relative z-20 flex shrink-0 items-center justify-between px-6 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 sm:px-10"
        >
          <BookButton
            icon="back"
            label="Previous page"
            onClick={goBack}
            disabled={!chrome.back}
          />
          <div className="flex items-center gap-1.5">
            <BookButton
              icon="pencil"
              mirrored
              label={chrome.pencil.label}
              onClick={() => navigate(chrome.pencil.to)}
            />
            <BookButton
              icon="stack"
              mirrored
              label="The board"
              active={chrome.tab === "board"}
              onClick={() => navigate("/board")}
            />
            <BookButton
              icon="close"
              mirrored
              label="Close the book"
              onClick={() => navigate("/")}
              disabled={location.pathname === "/"}
            />
          </div>
          <BookButton
            icon="forward"
            mirrored
            label="Next page"
            onClick={() => chrome.forward && navigate(chrome.forward)}
            disabled={!chrome.forward}
          />
        </nav>

        {notice && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 bottom-20 z-40 flex justify-center px-6"
          >
            <p
              key={notice.id}
              className="animate-pop-in rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
            >
              {notice.text}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** The dark binding along the left edge of an open page. */
function Spine() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 z-30 w-3 bg-binding"
    >
      <img
        src={art.spine}
        alt=""
        className="absolute inset-y-0 left-0 h-full w-3 object-cover opacity-90"
      />
    </div>
  )
}
