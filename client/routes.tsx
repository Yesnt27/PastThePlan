import { createBrowserRouter, Navigate, useLocation } from "react-router"
import { Ask } from "./screens/Ask"
import { Board } from "./screens/Board"
import { ClosedBook, CoverPage } from "./screens/Cover"
import { Keeper } from "./screens/Keeper"
import { LoreDetail } from "./screens/LoreDetail"
import { LoreForm } from "./screens/LoreForm"
import { MyAgent } from "./screens/MyAgent"
import { NotFound, RouteError } from "./screens/NotFound"
import { Profile, ProfileEdit } from "./screens/Profile"
import { Shell } from "./screens/Shell"
import { useEffect } from "react"
import { useParams } from "react-router"
import { PEOPLE_ORDER } from "./data/seed"
import { actAs } from "./identity"

/** /as/sam: act as another member of the demo group (full reload so the store starts fresh). */
function ActAs() {
  const { id } = useParams()
  useEffect(() => {
    if (id && PEOPLE_ORDER.includes(id)) actAs(id)
    window.location.replace("/board")
  }, [id])
  return null
}

const basename = "/"

/** A fresh form per URL, so "We went" on one plan never inherits another draft. */
function LoreFormRoute({ mode }: { mode: "new" | "edit" }) {
  const { pathname, search } = useLocation()
  return <LoreForm key={`${pathname}${search}`} mode={mode} />
}

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: Shell,
      ErrorBoundary: RouteError,
      children: [
        { index: true, Component: ClosedBook },
        { path: "book", Component: CoverPage },
        { path: "board", Component: Board },
        { path: "shelf", element: <Navigate to="/board" replace /> },
        { path: "lore/new", element: <LoreFormRoute mode="new" /> },
        { path: "lore/:id", Component: LoreDetail },
        { path: "lore/:id/edit", element: <LoreFormRoute mode="edit" /> },
        { path: "keeper", Component: Keeper },
        { path: "ask", Component: Ask },
        { path: "me", Component: Profile },
        { path: "me/edit", Component: ProfileEdit },
        { path: "me/agent", Component: MyAgent },
        { path: "people/:id", Component: Profile },
        { path: "as/:id", Component: ActAs },
        { path: "*", Component: NotFound },
      ],
    },
  ],
  { basename },
)
