import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { 
  prisma?: PrismaClient
  pgPool?: any
}

export const getDb = async (): Promise<PrismaClient> => {
  if (globalForPrisma.prisma && (globalForPrisma.prisma as any).appointment) return globalForPrisma.prisma

  const dbUrl =
    (typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined) ||
    (import.meta as any).env?.DATABASE_URL

  if (!dbUrl) throw new Error('DATABASE_URL is not set')

  const { PrismaPg } = await import('@prisma/adapter-pg')
  const pg = await import('pg')

  let pool = globalForPrisma.pgPool
  if (!pool) {
    const maxPoolSize = typeof process !== 'undefined' && process.env.DATABASE_POOL_MAX
      ? parseInt(process.env.DATABASE_POOL_MAX, 10)
      : 10

    pool = new pg.default.Pool({
      connectionString: dbUrl,
      max: maxPoolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
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

