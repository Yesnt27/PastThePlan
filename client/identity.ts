import { PEOPLE_ORDER, setMe } from "./data/seed"

/** Who this browser acts as. Set by /as/:id; must run before the store module evaluates. */
if (typeof document !== "undefined") {
  const m = document.cookie.match(/(?:^|;\s*)fgl_me=([a-z]+)/)
  if (m && PEOPLE_ORDER.includes(m[1])) setMe(m[1])
}

export function actAs(id: string) {
  document.cookie = `fgl_me=${id}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
}
