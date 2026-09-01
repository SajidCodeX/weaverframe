import pkg from '@prisma/client'
const { PrismaClient } = pkg

const globalForPrisma = globalThis as unknown as { 
  prisma?: any
  pgPool?: any
}

export const getDb = async (): Promise<any> => {
  const dbUrlRaw =
    (typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined) ||
    (import.meta as any).env?.DATABASE_URL

  if (!dbUrlRaw) throw new Error('DATABASE_URL is not set')
  const dbUrl = String(dbUrlRaw).trim().replace(/^['\"]|['\"]$/g, '')

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

  // Recover from stale/ended pool after HMR reloads or unexpected terminations
  if (globalForPrisma.pgPool) {
    const existingPool = globalForPrisma.pgPool
    if (existingPool._ended || existingPool._clients?.length === 0 && existingPool._pendingQueue?.length === 0 && existingPool.totalCount === 0) {
      console.warn('[DB] Stale pg pool detected — destroying and recreating...')
      try { await existingPool.end() } catch {}
      globalForPrisma.pgPool = undefined
      globalForPrisma.prisma = undefined
    }
  }

  // Return existing healthy prisma instance
  if (globalForPrisma.prisma && (globalForPrisma.prisma as any).lead) return globalForPrisma.prisma

  let pool = globalForPrisma.pgPool
  if (!pool) {
    const maxPoolSize = typeof process !== 'undefined' && process.env.DATABASE_POOL_MAX
      ? parseInt(process.env.DATABASE_POOL_MAX, 10)
      : 10

    pool = new pg.default.Pool({
      connectionString: dbUrl,
      max: maxPoolSize,
      min: 1,               // Keep 1 warm connection to avoid cold-start on every request
      idleTimeoutMillis: 60000,    // 60s idle before releasing (allows time between user actions)
      connectionTimeoutMillis: 60000, // 60s — matches connect_timeout=60 in DATABASE_URL
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    })

    // Handle unexpected errors on idle pool clients — destroy and reset so next call reconnects cleanly
    pool.on('error', (err: any) => {
      console.error('[DB] Unexpected error on idle pg client:', err?.message || err)
      // Signal pool reset on next getDb() call
      if (err?.message?.includes('terminated')) {
        globalForPrisma.pgPool = undefined
        globalForPrisma.prisma = undefined
      }
    })

    globalForPrisma.pgPool = pool
  }

  const adapter = new PrismaPg(pool)

  const prisma = new PrismaClient({ adapter })
  globalForPrisma.prisma = prisma
  return prisma
}

export const warmDb = async (): Promise<void> => {
  try {
    const db = await getDb()
    await db.$queryRaw`SELECT 1`
  } catch (err) {
    console.warn('[DB WARMUP WARNING]:', err)
  }
}

// Transparent safety proxy so any legacy or dynamic `import { db }` continues to work
export const db: any = new Proxy({} as any, {
  get(_target, prop) {
    if (globalForPrisma.prisma) {
      return (globalForPrisma.prisma as any)[prop];
    }
    return new Proxy(() => {}, {
      get(_subTarget, subProp) {
        return async (...args: any[]) => {
          const client = await getDb();
          return client[prop][subProp](...args);
        };
      }
    });
  }
});


