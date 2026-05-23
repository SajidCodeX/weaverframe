const fs = require('fs')

// Fix dashboard.ts
let dashCode = fs.readFileSync('src/lib/dashboard.ts', 'utf8')
dashCode = dashCode.replace(/import \{ getTenantDb \} from '\.\/server-utils\.server'/g, '')
dashCode = dashCode.replace(/\.handler\(async \(([^)]*)\) => \{/g, '.handler(async ($1) => {\n    const { getTenantDb } = await import(\'./server-utils.server\');')
// Also fix checkAndSyncRencastLeads inside getDashboardData
dashCode = dashCode.replace(/await checkAndSyncRencastLeads\(\)/g, '')
// Wait, we need to add checkAndSyncRencastLeads dynamic import? No, checkAndSyncRencastLeads is defined in dashboard.ts.
// It uses getTenantDb? No, checkAndSyncRencastLeads uses getDb().
fs.writeFileSync('src/lib/dashboard.ts', dashCode)

// Fix admin.ts
let adminCode = fs.readFileSync('src/lib/admin.ts', 'utf8')
adminCode = adminCode.replace(/import \{ requireAdmin \} from '\.\/server-utils\.server'/g, '')
adminCode = adminCode.replace(/\.handler\(async \(([^)]*)\) => \{/g, '.handler(async ($1) => {\n    const { requireAdmin } = await import(\'./server-utils.server\');')
fs.writeFileSync('src/lib/admin.ts', adminCode)

console.log('Fixed imports')
