import postgres from "postgres"

/** Server-only Postgres client for the Supabase database (bypasses RLS; never import from client code). */
declare global {
  // eslint-disable-next-line no-var
  var __fglSql: ReturnType<typeof postgres> | undefined
}

function connectionString(pooled = true) {
  const raw =
    (pooled ? process.env.POSTGRES_URL : process.env.POSTGRES_URL_NON_POOLING) ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL
  if (!raw) throw new Error("No POSTGRES_URL configured")
  // Vercel's Supabase vars carry extra query params (supa=…, sslmode) that postgres.js would forward as settings.
  return raw.split("?")[0]
}

export function sql() {
  if (!globalThis.__fglSql) {
    globalThis.__fglSql = postgres(connectionString(true), {
      ssl: "require",
      prepare: false,
      max: 3,
      idle_timeout: 20,
    })
  }
  return globalThis.__fglSql
}

export function directSql() {
  return postgres(connectionString(false), { ssl: "require", max: 1 })
}

export const hasDb = () => Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL)
