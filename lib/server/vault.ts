import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/** AES-256-GCM per value. The key lives only in FGL_VAULT_KEY (base64, 32 bytes) on the server. */
function key() {
  const k = process.env.FGL_VAULT_KEY
  if (!k) throw new Error("FGL_VAULT_KEY is not set")
  const buf = Buffer.from(k, "base64")
  if (buf.length !== 32) throw new Error("FGL_VAULT_KEY must be 32 bytes, base64")
  return buf
}

export function seal(value: unknown, aad: string) {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", key(), iv)
  c.setAAD(Buffer.from(aad))
  const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()])
  return { ciphertext: ct.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") }
}

export function open<T = unknown>(row: { ciphertext: string; iv: string; tag: string }, aad: string): T {
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(row.iv, "base64"))
  d.setAAD(Buffer.from(aad))
  d.setAuthTag(Buffer.from(row.tag, "base64"))
  const pt = Buffer.concat([d.update(Buffer.from(row.ciphertext, "base64")), d.final()])
  return JSON.parse(pt.toString("utf8")) as T
}
