import bcrypt from 'bcryptjs'
import { getDb } from '../src/lib/db.server'

async function main() {
  const prisma = await getDb()
  console.log('Seeding database with default Admin and Builder account...')

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@leadforge.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!@#'

  // 1. Create a default builder tenant
  const defaultBuilder = await prisma.builder.create({
    data: {
      companyName: 'LeadForge Master Tenant',
      contactName: 'System Administrator',
      email: 'hello@leadforge.com',
      plan: 'enterprise',
      isActive: true,
    },
  })

  // 2. Create the Admin user
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12)
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      displayName: 'System Admin',
      passwordHash: adminPasswordHash,
      role: 'admin',
      builderRole: 'owner',
      forcePasswordReset: false,
    },
  })

  // 3. Create a demo builder user assigned to the default builder
  const demoBuilderEmail = 'demo@builder.com'
  const demoBuilderHash = await bcrypt.hash('Builder123!@#', 12)
  const demoBuilderUser = await prisma.user.upsert({
    where: { email: demoBuilderEmail },
    update: {},
    create: {
      email: demoBuilderEmail,
      displayName: 'Demo Builder',
      passwordHash: demoBuilderHash,
      role: 'builder',
      builderId: defaultBuilder.id,
      builderRole: 'owner',
      forcePasswordReset: false,
    },
  })

  console.log({
    message: 'Seeding completed',
    admin: { email: adminUser.email, role: adminUser.role },
    demoBuilder: { email: demoBuilderUser.email, role: demoBuilderUser.role, builderId: demoBuilderUser.builderId },
  })
}

main()
  .then(() => {
    console.log('Seed completed.')
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
