import bcrypt from 'bcryptjs'
import { getDb } from './src/lib/db'

async function check() {
  const db = await getDb()
  
  // List all users
  const users = await db.user.findMany({ 
    select: { email: true, role: true, isActive: true, forcePasswordReset: true, builderId: true, displayName: true }
  })
  console.log('All users:', JSON.stringify(users, null, 2))
  
  // Check if demo builder exists, if not create it
  const demoEmail = 'demo@builder.com'
  let demoUser = await db.user.findUnique({ where: { email: demoEmail } })
  
  if (!demoUser) {
    console.log('\nDemo builder does not exist. Creating...')
    
    // Find or create a builder tenant
    let builder = await db.builder.findFirst()
    if (!builder) {
      builder = await db.builder.create({
        data: {
          companyName: 'Demo Homes LLC',
          contactName: 'Demo Owner',
          email: 'contact@demohomes.com',
          plan: 'pro',
          isActive: true,
        }
      })
      console.log('Created builder tenant:', builder.companyName)
    }
    
    const hash = await bcrypt.hash('Builder123!@#', 10)
    demoUser = await db.user.create({
      data: {
        email: demoEmail,
        displayName: 'Demo Builder',
        passwordHash: hash,
        role: 'builder',
        builderId: builder.id,
        builderRole: 'owner',
        forcePasswordReset: false,
        isActive: true,
      }
    })
    console.log('Created demo builder user:', demoUser.email)
  } else {
    // Reset password to known value
    const hash = await bcrypt.hash('Builder123!@#', 10)
    await db.user.update({
      where: { id: demoUser.id },
      data: { passwordHash: hash, forcePasswordReset: false, isActive: true }
    })
    console.log('\nDemo builder exists. Password reset to Builder123!@#')
  }
  
  console.log('\n✅ Ready to login:')
  console.log('   Email:    demo@builder.com')
  console.log('   Password: Builder123!@#')
}

check().catch(console.error).finally(() => process.exit(0))
