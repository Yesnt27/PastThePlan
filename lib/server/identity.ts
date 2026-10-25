import { cookies } from "next/headers"
import { PEOPLE_ORDER } from "@/client/data/seed"

export const GROUP_ID = "wizards-pit"

/**
 * Demo identity: the person this browser is acting as (cookie set by /as/:id).
 * Discord login replaces this; until then it is a convenience, not an auth boundary.
 */
export async function currentPerson() {
  const c = (await cookies()).get("fgl_me")?.value
  return c && PEOPLE_ORDER.includes(c) ? c : "john"
}
