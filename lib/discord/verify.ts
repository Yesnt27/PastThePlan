import { createPublicKey, verify } from "node:crypto"

const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex")

export function verifyDiscord(body: string, signature: string | null, timestamp: string | null) {
  const pk = process.env.DISCORD_PUBLIC_KEY
  if (!pk || !signature || !timestamp) return false
  try {
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(pk, "hex")]), format: "der", type: "spki" })
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"))
  } catch {
    return false
  }
}
