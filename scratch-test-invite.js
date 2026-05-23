import 'dotenv/config'
import { getDb } from './src/lib/db.js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

async function testInvite() {
  const db = await getDb()
  console.log("DB connection successful.")
  try {
    const builder = await db.builder.create({
      data: {
        companyName: "Test Builder " + Date.now(),
        contactName: 'Owner',
        email: "testinvite_" + Date.now() + "@example.com",
        plan: 'professional',
        isActive: true,
      }
    })

    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 

    const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10)
    
    await db.user.create({
      data: {
        email: "testinvite_" + Date.now() + "@example.com",
        displayName: 'Owner',
        role: 'builder',
        builderRole: 'owner',
        builderId: builder.id,
        passwordHash: dummyPasswordHash,
        forcePasswordReset: true,
        resetToken: token,
        resetTokenExpires: expires,
        isActive: true,
      }
    })

    console.log("Invite success! Token:", token)
    
    // Test verification
    const user = await db.user.findFirst({
      where: { resetToken: token, resetTokenExpires: { gt: new Date() }, forcePasswordReset: true },
      include: { builder: true },
    })
    console.log("Verification user found:", user ? "YES" : "NO")

  } catch (err) {
    console.error("Invite failed:", err)
  }
}

testInvite()
