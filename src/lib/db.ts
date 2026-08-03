import pkg from '@prisma/client'
const { PrismaClient } = pkg

const globalForPrisma = globalThis as unknown as { 
  prisma?: any
  pgPool?: any
}

export const getDb = async (): Promise<any> => {
  if (globalForPrisma.prisma && (globalForPrisma.prisma as any).appointment) return globalForPrisma.prisma

  const dbUrlRaw =
    (typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined) ||
    (import.meta as any).env?.DATABASE_URL

  if (!dbUrlRaw) throw new Error('DATABASE_URL is not set')
  const dbUrl = String(dbUrlRaw).trim().replace(/^['"]|['"]$/g, '')

  let parsed: URL
  try {
    parsed = new URL(dbUrl)
  } catch {
    throw new Error('DATABASE_URL is not a valid URL. Use: postgresql://user:password@host:5432/dbname?sslmode=require')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must start with postgres:// or postgresql://')
  }
  if (!parsed.hostname) {
    throw new Error('DATABASE_URL host is missing. If your password has special characters like @ : / # ? &, URL-encode it.')
  }
  if (parsed.hostname !== 'localhost' && !/^[a-zA-Z0-9.-]+$/.test(parsed.hostname)) {
    throw new Error('DATABASE_URL host is malformed. This usually means the password contains special characters and is not URL-encoded.')
  }

  const { PrismaPg } = await import('@prisma/adapter-pg')
  const pg = await import('pg')

  let pool = globalForPrisma.pgPool
  if (!pool) {
    const maxPoolSize = typeof process !== 'undefined' && process.env.DATABASE_POOL_MAX
      ? parseInt(process.env.DATABASE_POOL_MAX, 10)
      : 10 // Increased from 5 to 10 to handle parallel router fetches without severe queueing

    pool = new pg.default.Pool({
      connectionString: dbUrl,
      max: maxPoolSize,
      min: 0, // Don't keep idle connections open (Neon auto-suspends)
      idleTimeoutMillis: 10000,  // Release idle connections quickly
      connectionTimeoutMillis: 10000, // Match Neon's connect_timeout=10
    })

    // Handle unexpected errors on idle pool clients to prevent process crash
    pool.on('error', (err: any) => {
      console.error('Unexpected error on idle PostgreSQL client:', err)
    })

    globalForPrisma.pgPool = pool
  }

  const adapter = new PrismaPg(pool)

  const prisma = new PrismaClient({ adapter })
  globalForPrisma.prisma = prisma
  return prisma
}
